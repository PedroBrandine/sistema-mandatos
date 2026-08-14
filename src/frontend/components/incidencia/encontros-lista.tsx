"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

import { buscarEncontrosDoContrato, type EncontroResumo } from "@backend/queries/incidencia";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { participanteSchema } from "@backend/schemas/encontro";
import { createClient } from "@backend/supabase/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

const STATUS_LABEL: Record<string, string> = {
  planejado: "Planejado",
  realizado: "Realizado",
  cancelado: "Cancelado",
  remarcado: "Remarcado",
};

interface UsuarioOption {
  id: number;
  nome: string;
}

interface ParticipanteLinha {
  idParticipacao: number;
  nomeExibido: string;
  origem: "legisla" | "mandato" | "externo";
}

// INC-16. Lista de fat_encontro do contrato (buscarEncontrosDoContrato) +
// gestão de participantes por encontro -- INSERT/DELETE direto em
// rel_encontro_participante (sem RPC, design.md Tech Decisions). XOR
// id_usuario/nome_livre respeitado na UI (o toggle "Usuário do
// sistema"/"Nome externo" só mostra um campo por vez) e validado por
// participanteSchema.safeParse antes do INSERT -- ck_participante_identificacao
// continua como defesa de banco.
export interface EncontrosListaProps {
  idContrato: number;
  atualizarSinal: number;
}

export function EncontrosLista({ idContrato, atualizarSinal }: EncontrosListaProps) {
  const [encontros, setEncontros] = useState<EncontroResumo[]>([]);
  const [participantesPorEncontro, setParticipantesPorEncontro] = useState<Map<number, ParticipanteLinha[]>>(
    new Map()
  );
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const [formAberto, setFormAberto] = useState<number | null>(null);
  const [tipoIdentificacao, setTipoIdentificacao] = useState<"usuario" | "externo">("usuario");
  const [idUsuarioSelecionado, setIdUsuarioSelecionado] = useState<string>("");
  const [nomeLivre, setNomeLivre] = useState("");
  const [origem, setOrigem] = useState<"legisla" | "mandato" | "externo">("legisla");

  async function carregar() {
    const supabase = createClient();
    const lista = await buscarEncontrosDoContrato(supabase, idContrato);
    setEncontros(lista);

    if (lista.length === 0) {
      setParticipantesPorEncontro(new Map());
      return;
    }

    const ids = lista.map((e) => e.idEncontro);
    const { data } = await supabase
      .from("rel_encontro_participante")
      .select("id_participacao, id_encontro, id_usuario, nome_livre, origem")
      .in("id_encontro", ids);

    const idsUsuario = Array.from(
      new Set((data ?? []).map((p) => p.id_usuario).filter((id): id is number => id != null))
    );
    let nomesPorUsuario = new Map<number, string>();
    if (idsUsuario.length > 0) {
      const { data: usrs } = await supabase.from("dim_usuario").select("id_usuario, nome").in("id_usuario", idsUsuario);
      nomesPorUsuario = new Map((usrs ?? []).map((u) => [u.id_usuario, u.nome]));
    }

    const grupos = new Map<number, ParticipanteLinha[]>();
    for (const p of data ?? []) {
      const linha: ParticipanteLinha = {
        idParticipacao: p.id_participacao,
        nomeExibido: p.id_usuario != null ? (nomesPorUsuario.get(p.id_usuario) ?? "—") : (p.nome_livre ?? "—"),
        origem: p.origem as ParticipanteLinha["origem"],
      };
      const grupo = grupos.get(p.id_encontro) ?? [];
      grupo.push(linha);
      grupos.set(p.id_encontro, grupo);
    }
    setParticipantesPorEncontro(grupos);
  }

  useEffect(() => {
    void carregar();
    // idContrato/atualizarSinal são os únicos gatilhos de refetch -- carregar
    // em si é recriada a cada render, incluí-la quebraria o efeito em loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idContrato, atualizarSinal]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("dim_usuario")
      .select("id_usuario, nome")
      .order("nome")
      .then(({ data }) => setUsuarios((data ?? []).map((u) => ({ id: u.id_usuario, nome: u.nome }))));
  }, []);

  function abrirFormParticipante(idEncontro: number) {
    setFormAberto(idEncontro);
    setTipoIdentificacao("usuario");
    setIdUsuarioSelecionado("");
    setNomeLivre("");
    setOrigem("legisla");
    setErro(null);
  }

  async function adicionarParticipante(idEncontro: number) {
    setErro(null);
    const payload = {
      id_encontro: idEncontro,
      id_usuario: tipoIdentificacao === "usuario" && idUsuarioSelecionado ? Number(idUsuarioSelecionado) : null,
      nome_livre: tipoIdentificacao === "externo" && nomeLivre.trim() ? nomeLivre.trim() : null,
      origem,
      presente: true,
    };

    const validado = participanteSchema.safeParse(payload);
    if (!validado.success) {
      setErro(validado.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from("rel_encontro_participante").insert(payload);
    if (error) {
      setErro(mapeiaErroRpc(error).message);
      return;
    }
    setFormAberto(null);
    void carregar();
  }

  async function removerParticipante(idParticipacao: number) {
    const supabase = createClient();
    const { error } = await supabase.from("rel_encontro_participante").delete().eq("id_participacao", idParticipacao);
    if (error) {
      setErro(mapeiaErroRpc(error).message);
      return;
    }
    void carregar();
  }

  // Edição leve de status (context.md: "Dialog de criação/edição de
  // status") -- direto na lista, sem reabrir EncontroForm inteiro.
  // ck_encontro_realizado (status='realizado' exige dt_realizada) segue
  // como defesa de banco -- se status vira 'realizado' sem essa data já
  // preenchida, o UPDATE falha e mapeiaErroRpc traduz a mensagem.
  async function alterarStatus(idEncontro: number, novoStatus: string) {
    setErro(null);
    const supabase = createClient();
    const payload: { status: string; dt_realizada?: string } =
      novoStatus === "realizado" ? { status: novoStatus, dt_realizada: new Date().toISOString() } : { status: novoStatus };
    const { error } = await supabase.from("fat_encontro").update(payload).eq("id_encontro", idEncontro);
    if (error) {
      setErro(mapeiaErroRpc(error).message);
      return;
    }
    void carregar();
  }

  if (encontros.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum encontro cadastrado ainda.</p>;
  }

  return (
    <div className="grid gap-4">
      {erro && <ErroInline mensagem={erro} />}
      {encontros.map((e) => {
        const participantes = participantesPorEncontro.get(e.idEncontro) ?? [];
        return (
          <div key={e.idEncontro} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{e.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {e.dtPrevistaInicio ? new Date(e.dtPrevistaInicio).toLocaleDateString("pt-BR") : "—"}
                  {e.dtRealizada ? ` · Realizado em ${new Date(e.dtRealizada).toLocaleDateString("pt-BR")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{STATUS_LABEL[e.status] ?? e.status}</Badge>
                <Select value={e.status} onValueChange={(v) => void alterarStatus(e.idEncontro, v)}>
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planejado">Planejado</SelectItem>
                    <SelectItem value="realizado">Realizado (hoje)</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                    <SelectItem value="remarcado">Remarcado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Participantes</p>
              {participantes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum participante ainda.</p>
              ) : (
                <Table>
                  <TableBody>
                    {participantes.map((p) => (
                      <TableRow key={p.idParticipacao}>
                        <TableCell className="text-sm">{p.nomeExibido}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.origem}</TableCell>
                        <TableCell className="w-10">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void removerParticipante(p.idParticipacao)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {formAberto === e.idEncontro ? (
                <div className="grid gap-2 rounded-md border border-dashed p-3">
                  <div className="flex gap-2">
                    <Select value={tipoIdentificacao} onValueChange={(v) => setTipoIdentificacao(v as "usuario" | "externo")}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="usuario">Usuário do sistema</SelectItem>
                        <SelectItem value="externo">Nome externo</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={origem} onValueChange={(v) => setOrigem(v as typeof origem)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="legisla">Legisla</SelectItem>
                        <SelectItem value="mandato">Mandato</SelectItem>
                        <SelectItem value="externo">Externo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {tipoIdentificacao === "usuario" ? (
                    <Select value={idUsuarioSelecionado} onValueChange={setIdUsuarioSelecionado}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o usuário" />
                      </SelectTrigger>
                      <SelectContent>
                        {usuarios.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="Nome do participante"
                      value={nomeLivre}
                      onChange={(ev) => setNomeLivre(ev.target.value)}
                    />
                  )}
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => void adicionarParticipante(e.idEncontro)}>
                      Adicionar
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setFormAberto(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-fit"
                  onClick={() => abrirFormParticipante(e.idEncontro)}
                >
                  Adicionar participante
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

import { buscarEtapasDoProduto, buscarContratoParaFicha, type EtapaResumo } from "@backend/queries/contrato";
import { criarEncontro, type ParticipanteEncontroInput } from "@backend/rpc/encontro";
import { createClient } from "@backend/supabase/client";

import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P2: Agenda na
// ficha e Novo Agendamento" AC2/AC4/AC5/AC6 (FMC-30, FMC-31, FMC-32).
// design.md, Components "EncontroForm" -- reescrita completa: a versão
// anterior fazia INSERT direto em fat_encontro (INC-15/17); esta chama
// app.criar_encontro (T18/T19, SECURITY INVOKER, AD-024) e grava encontro +
// participantes numa transação única.
//
// idProduto é OPCIONAL (SPEC_DEVIATION do design.md, que lista `idProduto`
// como prop obrigatória): quando ausente, o componente resolve sozinho via
// buscarContratoParaFicha(idContrato) -- o mesmo dado que a T37 já buscava
// para montar a Agenda da ficha. Razão: o único outro chamador hoje,
// /contratos/[id]/encontros/page.tsx (INC-15..18, rota preservada por A-01/
// A-22), não conhece idProduto e está fora do Where desta task -- exigir a
// prop quebraria aquele caller sem necessidade. Quem já tem idProduto à mão
// (T37) pode passá-lo e poupar a consulta extra.
export interface EncontroFormProps {
  idContrato: number;
  idProduto?: number;
  onConcluido: (criado?: { idEncontro: number }) => void;
  onCancelar: () => void;
}

interface TipoRegistroOption {
  id: number;
  nome: string;
}

interface UsuarioOption {
  id: number;
  nome: string;
}

interface ParticipanteState {
  idUsuario: number | null;
  nomeLivre: string | null;
  origem: "legisla" | "mandato" | "externo";
  nomeExibido: string;
}

const SEM_VINCULO = "_nenhum";

export function EncontroForm({ idContrato, idProduto, onConcluido, onCancelar }: EncontroFormProps) {
  const [idProdutoResolvido, setIdProdutoResolvido] = useState<number | null>(idProduto ?? null);
  const [etapas, setEtapas] = useState<EtapaResumo[]>([]);
  const [tipos, setTipos] = useState<TipoRegistroOption[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([]);

  const [titulo, setTitulo] = useState("");
  const [idEtapa, setIdEtapa] = useState<number | null>(null);
  const [idTipoRegistro, setIdTipoRegistro] = useState<number | null>(null);
  const [dtInicio, setDtInicio] = useState("");
  const [dtFim, setDtFim] = useState("");
  const [local, setLocal] = useState("");
  const [tema, setTema] = useState("");

  const [participantes, setParticipantes] = useState<ParticipanteState[]>([]);
  const [tipoIdentificacao, setTipoIdentificacao] = useState<"usuario" | "externo">("usuario");
  const [idUsuarioNovo, setIdUsuarioNovo] = useState("");
  const [origemNovo, setOrigemNovo] = useState<"legisla" | "mandato">("legisla");
  const [nomeLivreNovo, setNomeLivreNovo] = useState("");

  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // FMC-31 (AC4): Etapa lista só ref_etapa DO PRODUTO do contrato -- quando
  // idProduto não chega por prop, resolve pelo mesmo caminho de
  // buscarContratoParaFicha (contrato.ts) que a ficha já usa.
  useEffect(() => {
    if (idProduto !== undefined) {
      setIdProdutoResolvido(idProduto);
      return;
    }
    let cancelado = false;
    buscarContratoParaFicha(createClient(), idContrato).then((contrato) => {
      if (!cancelado) setIdProdutoResolvido(contrato?.idProduto ?? null);
    });
    return () => {
      cancelado = true;
    };
  }, [idContrato, idProduto]);

  useEffect(() => {
    if (idProdutoResolvido === null) return;
    let cancelado = false;
    buscarEtapasDoProduto(createClient(), idProdutoResolvido).then((lista) => {
      if (!cancelado) setEtapas(lista);
    });
    return () => {
      cancelado = true;
    };
  }, [idProdutoResolvido]);

  // FMC-31 (AC4): escolher Etapa filtra os Tipos daquela etapa. Trocar de
  // etapa limpa o Tipo escolhido -- um Tipo da etapa anterior não é uma opção
  // válida na nova.
  useEffect(() => {
    setIdTipoRegistro(null);
    if (idEtapa === null) {
      setTipos([]);
      return;
    }
    let cancelado = false;
    createClient()
      .from("ref_tipo_registro")
      .select("id_tipo_registro, nome")
      .eq("id_etapa", idEtapa)
      .eq("ativo", true)
      .then(({ data }: { data: { id_tipo_registro: number; nome: string }[] | null }) => {
        if (!cancelado) {
          setTipos((data ?? []).map((t) => ({ id: t.id_tipo_registro, nome: t.nome })));
        }
      });
    return () => {
      cancelado = true;
    };
  }, [idEtapa]);

  useEffect(() => {
    let cancelado = false;
    createClient()
      .from("dim_usuario")
      .select("id_usuario, nome")
      .order("nome")
      .then(({ data }: { data: { id_usuario: number; nome: string }[] | null }) => {
        if (!cancelado) setUsuarios((data ?? []).map((u) => ({ id: u.id_usuario, nome: u.nome })));
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // FMC-32 (AC6): participante externo grava nome_livre + origem='externo';
  // usuário grava id_usuario -- nunca os dois (ck_participante_identificacao).
  function adicionarParticipante() {
    if (tipoIdentificacao === "usuario") {
      if (!idUsuarioNovo) return;
      const usuario = usuarios.find((u) => String(u.id) === idUsuarioNovo);
      setParticipantes((atual) => [
        ...atual,
        {
          idUsuario: Number(idUsuarioNovo),
          nomeLivre: null,
          origem: origemNovo,
          nomeExibido: usuario?.nome ?? "",
        },
      ]);
      setIdUsuarioNovo("");
    } else {
      const nome = nomeLivreNovo.trim();
      if (nome === "") return;
      setParticipantes((atual) => [
        ...atual,
        { idUsuario: null, nomeLivre: nome, origem: "externo", nomeExibido: nome },
      ]);
      setNomeLivreNovo("");
    }
  }

  function removerParticipante(indice: number) {
    setParticipantes((atual) => atual.filter((_, i) => i !== indice));
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);

    if (titulo.trim() === "" || idEtapa === null || idTipoRegistro === null || dtInicio === "") {
      setErro("Preencha Título, Etapa, Tipo de Registro e o início antes de salvar.");
      return;
    }

    setEnviando(true);
    const entrada: ParticipanteEncontroInput[] = participantes.map((p) => ({
      idUsuario: p.idUsuario,
      nomeLivre: p.nomeLivre,
      origem: p.origem,
    }));

    try {
      const { idEncontro } = await criarEncontro(createClient(), {
        idContrato,
        titulo: titulo.trim(),
        idEtapa,
        idTipoRegistro,
        dtInicio,
        dtFim: dtFim || null,
        // PF2-06 (.specs/features/pente-fino-2026-09-23/spec.md): campo
        // Modalidade removido do formulário -- para de enviar o valor
        // (coluna aceita NULL, dado histórico de encontros antigos
        // permanece intocado).
        modalidade: null,
        local: local || null,
        tema: tema || null,
        participantes: entrada,
      });
      setEnviando(false);
      onConcluido({ idEncontro });
    } catch (e) {
      setEnviando(false);
      setErro(e instanceof Error ? e.message : "Não foi possível criar o encontro.");
    }
  }

  return (
    <form onSubmit={(e) => void enviar(e)} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="encontro-titulo">Título</Label>
        <Input id="encontro-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="encontro-etapa">Etapa do Produto</Label>
          <Select
            value={idEtapa !== null ? String(idEtapa) : SEM_VINCULO}
            onValueChange={(v) => setIdEtapa(v === SEM_VINCULO ? null : Number(v))}
          >
            <SelectTrigger id="encontro-etapa" className="w-full">
              <SelectValue placeholder="Selecione a etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_VINCULO}>Selecione a etapa</SelectItem>
              {etapas.map((etapa) => (
                <SelectItem key={etapa.idEtapa} value={String(etapa.idEtapa)}>
                  {etapa.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="encontro-tipo">Tipo de Registro</Label>
          <Select
            value={idTipoRegistro !== null ? String(idTipoRegistro) : SEM_VINCULO}
            onValueChange={(v) => setIdTipoRegistro(v === SEM_VINCULO ? null : Number(v))}
            disabled={idEtapa === null}
          >
            <SelectTrigger id="encontro-tipo" className="w-full">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_VINCULO}>Selecione o tipo</SelectItem>
              {tipos.map((tipo) => (
                <SelectItem key={tipo.id} value={String(tipo.id)}>
                  {tipo.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="encontro-dt-inicio">Início</Label>
          <Input
            id="encontro-dt-inicio"
            type="datetime-local"
            value={dtInicio}
            onChange={(e) => setDtInicio(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="encontro-dt-fim">Fim (opcional)</Label>
          <Input
            id="encontro-dt-fim"
            type="datetime-local"
            value={dtFim}
            onChange={(e) => setDtFim(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="encontro-local">Local (opcional)</Label>
        <Input id="encontro-local" value={local} onChange={(e) => setLocal(e.target.value)} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="encontro-tema">Tema Prioritário (opcional)</Label>
        <Input id="encontro-tema" value={tema} onChange={(e) => setTema(e.target.value)} />
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium">Participantes</p>
        {participantes.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum participante adicionado ainda.</p>
        )}
        <ul className="grid gap-1.5">
          {participantes.map((p, indice) => (
            <li key={`${p.nomeExibido}-${indice}`} className="flex items-center gap-2">
              <span className="flex-1 text-sm">{p.nomeExibido}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => removerParticipante(indice)}>
                Remover
              </Button>
            </li>
          ))}
        </ul>

        <div className="grid gap-2 rounded-md border border-dashed p-3">
          <div className="flex gap-2">
            <Select
              value={tipoIdentificacao}
              onValueChange={(v) => setTipoIdentificacao(v as "usuario" | "externo")}
            >
              <SelectTrigger className="w-48" aria-label="Tipo de participante">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usuario">Usuário do sistema</SelectItem>
                <SelectItem value="externo">Participante externo</SelectItem>
              </SelectContent>
            </Select>

            {tipoIdentificacao === "usuario" && (
              <Select value={origemNovo} onValueChange={(v) => setOrigemNovo(v as "legisla" | "mandato")}>
                <SelectTrigger className="w-40" aria-label="Origem do participante">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="legisla">Legisla</SelectItem>
                  <SelectItem value="mandato">Mandato</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {tipoIdentificacao === "usuario" ? (
            <Select value={idUsuarioNovo} onValueChange={setIdUsuarioNovo}>
              <SelectTrigger className="w-full" aria-label="Selecione o usuário">
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
              aria-label="Nome do participante externo"
              placeholder="Nome do participante externo"
              value={nomeLivreNovo}
              onChange={(e) => setNomeLivreNovo(e.target.value)}
            />
          )}

          <Button type="button" variant="outline" className="w-fit" onClick={adicionarParticipante}>
            Adicionar participante
          </Button>
        </div>
      </div>

      {erro && <ErroInline titulo="Não foi possível criar o encontro" mensagem={erro} />}

      <div className="flex gap-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Criar Encontro"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

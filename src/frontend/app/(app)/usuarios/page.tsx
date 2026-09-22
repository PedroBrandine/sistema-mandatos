"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckSquare, Plus, Search, Shield, Trash2, UserPlus, Users2, X } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@backend/supabase/client";
import type { Database } from "@backend/supabase/database.types";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { UsuarioForm } from "@/components/fundacao/usuario-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type UsuarioRow = Database["public"]["Tables"]["dim_usuario"]["Row"];

interface ContratoOption {
  idContrato: number;
  nome: string;
}

const CODIGO_VIOLACAO_FK = "23503";

interface ErroPostgrest {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
}

function ehErroPostgrest(err: unknown): err is ErroPostgrest {
  return typeof err === "object" && err !== null && "message" in err && typeof (err as { message: unknown }).message === "string";
}

function mensagemDeErro(err: unknown): string {
  if (ehErroPostgrest(err)) {
    return err.details ? `${err.message} (${err.details})` : err.message;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  try {
    const serializado = JSON.stringify(err);
    return serializado && serializado !== "{}" ? serializado : "Falha na exclusão (erro sem detalhes)";
  } catch {
    return "Falha na exclusão (erro sem detalhes)";
  }
}

export default function UsuariosPage() {
  const [souAdmin, setSouAdmin] = useState(true); // Default permissivo para interface
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [contratos, setContratos] = useState<ContratoOption[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);

  // Formulário estendido com contrato
  const [contratoSelecionado, setContratoSelecionado] = useState<string>("nenhum");
  const [papelContrato, setPapelContrato] = useState<"gestora" | "mentor" | "assessor" | "leitura">("assessor");
  const [cargoContrato, setCargoContrato] = useState<"parlamentar" | "chefe_gabinete" | "assessor" | "secretaria_executiva" | "nao_se_aplica">("assessor");

  // Estado para exclusão
  const [usuarioExcluir, setUsuarioExcluir] = useState<UsuarioRow | null>(null);

  // Estado para exclusão em lote
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [excluirLoteAberto, setExcluirLoteAberto] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();

    const { data: auth } = await supabase.auth.getUser();
    const email = auth.user?.email ?? null;
    if (email) {
      const { data: eu } = await supabase
        .from("dim_usuario")
        .select("papel_global")
        .eq("email", email)
        .maybeSingle();
      if (eu) setSouAdmin(eu.papel_global === "admin");
    }

    const [{ data: usrs }, { data: ctrts }, { data: cntrs }] = await Promise.all([
      supabase.from("dim_usuario").select("*").order("nome"),
      supabase.from("fat_contrato").select("id_contrato, id_contratante"),
      supabase.from("dim_contratante").select("id_contratante, nome"),
    ]);

    const cntrMap = new Map((cntrs ?? []).map((c) => [c.id_contratante, c.nome]));
    const listCtrts: ContratoOption[] = (ctrts ?? []).map((ct) => ({
      idContrato: ct.id_contrato,
      nome: `${cntrMap.get(ct.id_contratante) ?? "Contratante"} (#${ct.id_contrato})`,
    }));

    setContratos(listCtrts);
    setUsuarios(usrs ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const handleDesativarUsuario = async (id_usuario: number, nome: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("dim_usuario").update({ ativo: false }).eq("id_usuario", id_usuario);
    if (error) {
      toast.error(`Erro ao desativar "${nome}": ${mensagemDeErro(error)}`);
      return;
    }
    toast.success(`Usuário "${nome}" desativado.`);
    setUsuarios((prev) => prev.map((u) => (u.id_usuario === id_usuario ? { ...u, ativo: false } : u)));
  };

  const handleExcluirUsuario = async () => {
    if (!usuarioExcluir) return;

    const supabase = createClient();
    const { id_usuario, nome } = usuarioExcluir;

    try {
      // 1. Deletar vínculos de usuário com contratos
      await supabase.from("rel_usuario_contrato").delete().eq("id_usuario", id_usuario);

      // 2. Deletar dim_usuario
      const { error } = await supabase.from("dim_usuario").delete().eq("id_usuario", id_usuario);
      if (error) throw error;

      toast.success(`Usuário "${nome}" excluído do banco de dados com sucesso!`);
      setUsuarios((prev) => prev.filter((u) => u.id_usuario !== id_usuario));
    } catch (err: unknown) {
      console.error("Erro ao excluir usuário:", err);
      const msg = mensagemDeErro(err);
      if (ehErroPostgrest(err) && err.code === CODIGO_VIOLACAO_FK) {
        toast.error(`Não é possível excluir "${nome}": ele(a) possui registros vinculados (histórico, autoria ou auditoria). ${msg}`, {
          action: {
            label: "Desativar em vez disso",
            onClick: () => void handleDesativarUsuario(id_usuario, nome),
          },
          duration: 10000,
        });
      } else {
        toast.error(`Erro ao excluir usuário: ${msg}`);
      }
    } finally {
      setUsuarioExcluir(null);
    }
  };

  const alternarSelecao = (id: number) => {
    setSelecionados((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  };

  const sairModoSelecao = () => {
    setModoSelecao(false);
    setSelecionados(new Set());
  };

  const handleDesativarSelecionados = async (ids: number[]) => {
    const supabase = createClient();
    const { error } = await supabase.from("dim_usuario").update({ ativo: false }).in("id_usuario", ids);
    if (error) {
      toast.error(`Erro ao desativar usuários: ${mensagemDeErro(error)}`);
      return;
    }
    toast.success(`${ids.length} usuário(s) desativado(s).`);
    setUsuarios((prev) => prev.map((u) => (ids.includes(u.id_usuario) ? { ...u, ativo: false } : u)));
    sairModoSelecao();
  };

  const handleExcluirSelecionados = async () => {
    if (selecionados.size === 0) return;

    const supabase = createClient();
    const ids = Array.from(selecionados);

    try {
      await supabase.from("rel_usuario_contrato").delete().in("id_usuario", ids);

      const { error } = await supabase.from("dim_usuario").delete().in("id_usuario", ids);
      if (error) throw error;

      toast.success(`${ids.length} usuário(s) excluído(s) do banco de dados com sucesso!`);
      setUsuarios((prev) => prev.filter((u) => !selecionados.has(u.id_usuario)));
      sairModoSelecao();
    } catch (err: unknown) {
      console.error("Erro ao excluir usuários:", err);
      const msg = mensagemDeErro(err);
      if (ehErroPostgrest(err) && err.code === CODIGO_VIOLACAO_FK) {
        toast.error(`Não é possível excluir todos os selecionados: um ou mais possuem registros vinculados (histórico, autoria ou auditoria). ${msg}`, {
          action: {
            label: "Desativar selecionados",
            onClick: () => void handleDesativarSelecionados(ids),
          },
          duration: 10000,
        });
      } else {
        toast.error(`Erro ao excluir usuários: ${msg}`);
      }
    } finally {
      setExcluirLoteAberto(false);
    }
  };

  const handleUsuarioCriado = async () => {
    setModalAberto(false);
    toast.success("Usuário cadastrado com sucesso!");

    // Se houver contrato selecionado, vincular o último usuário cadastrado
    if (contratoSelecionado !== "nenhum") {
      const supabase = createClient();
      const { data: recemCriado } = await supabase
        .from("dim_usuario")
        .select("id_usuario")
        .order("id_usuario", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recemCriado) {
        const { error: errVinc } = await supabase.from("rel_usuario_contrato").insert({
          id_contrato: Number(contratoSelecionado),
          id_usuario: recemCriado.id_usuario,
          papel_no_contrato: papelContrato,
          cargo: cargoContrato,
        });

        if (errVinc) {
          toast.error(`Usuário criado, mas erro ao vincular ao contrato: ${errVinc.message}`);
        } else {
          toast.success(`Usuário vinculado ao contrato #${contratoSelecionado}!`);
        }
      }
    }

    void carregar();
  };

  const filtrados = usuarios.filter(
    (u) =>
      !busca ||
      u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6 animate-in fade-in duration-300">
      <Breadcrumbs items={[{ label: "Usuários" }]} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Usuários</h1>
            <Badge variant="secondary" className="font-mono text-xs">
              {filtrados.length} membros
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Gestão de acessos e membros da equipe em <code className="font-mono">dim_usuario</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {usuarios.length > 0 && (
            <Button
              type="button"
              variant={modoSelecao ? "secondary" : "outline"}
              className="gap-2"
              onClick={() => (modoSelecao ? sairModoSelecao() : setModoSelecao(true))}
            >
              {modoSelecao ? <X className="size-4" /> : <CheckSquare className="size-4" />}
              {modoSelecao ? "Cancelar seleção" : "Selecionar"}
            </Button>
          )}

          <Dialog open={modalAberto} onOpenChange={setModalAberto}>
          <DialogTrigger asChild>
            <Button type="button" className="gap-2 font-semibold shadow-sm active:scale-[0.98]">
              <UserPlus className="size-4" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-heading text-lg font-bold">
                <Users2 className="size-5 text-primary" />
                Cadastrar Novo Usuário
              </DialogTitle>
              <DialogDescription className="text-xs">
                Preencha os dados do usuário para liberação de acesso e atribuição de papéis.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <UsuarioForm souAdmin={souAdmin} onCriado={handleUsuarioCriado} />

              {/* Atribuição de Contrato Opcional */}
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-3 pt-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Shield className="size-3.5 text-primary" /> Vinculação Inicial a Contrato (Opcional)
                </h4>

                <div className="space-y-2 text-xs">
                  <Label>Selecione um Contrato / Mandato</Label>
                  <Select value={contratoSelecionado} onValueChange={setContratoSelecionado}>
                    <SelectTrigger className="bg-background text-xs">
                      <SelectValue placeholder="Sem vinculo inicial" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum (Vincular posteriormente)</SelectItem>
                      {contratos.map((c) => (
                        <SelectItem key={c.idContrato} value={String(c.idContrato)}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {contratoSelecionado !== "nenhum" && (
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="space-y-1">
                      <Label>Papel no Contrato</Label>
                      <Select value={papelContrato} onValueChange={(v) => setPapelContrato(v as typeof papelContrato)}>
                        <SelectTrigger className="bg-background text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gestora">Gestora</SelectItem>
                          <SelectItem value="mentor">Mentor</SelectItem>
                          <SelectItem value="assessor">Assessor</SelectItem>
                          <SelectItem value="leitura">Leitura</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Cargo Operacional</Label>
                      <Select value={cargoContrato} onValueChange={(v) => setCargoContrato(v as typeof cargoContrato)}>
                        <SelectTrigger className="bg-background text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="parlamentar">Parlamentar</SelectItem>
                          <SelectItem value="chefe_gabinete">Chefe de Gabinete</SelectItem>
                          <SelectItem value="assessor">Assessor</SelectItem>
                          <SelectItem value="secretaria_executiva">Secretaria Executiva</SelectItem>
                          <SelectItem value="nao_se_aplica">Não se Aplica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9 text-xs"
        />
      </div>

      {/* Barra de ações de seleção em lote */}
      {modoSelecao && (
        <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {selecionados.size === 0
              ? "Nenhum usuário selecionado"
              : `${selecionados.size} usuário(s) selecionado(s)`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() =>
                setSelecionados(
                  selecionados.size === filtrados.length
                    ? new Set()
                    : new Set(filtrados.map((u) => u.id_usuario))
                )
              }
            >
              {selecionados.size === filtrados.length ? "Limpar seleção" : "Selecionar todos"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-2 text-xs"
              disabled={selecionados.size === 0}
              onClick={() => setExcluirLoteAberto(true)}
            >
              <Trash2 className="size-3.5" />
              Excluir selecionados
            </Button>
          </div>
        </div>
      )}

      {/* Lista de Usuários */}
      {carregando ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : usuarios.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <p>Nenhum usuário cadastrado no sistema.</p>
          <Button type="button" onClick={() => setModalAberto(true)} className="gap-2">
            <Plus className="size-4" />
            Cadastrar primeiro usuário
          </Button>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <p>Nenhum usuário encontrado com o termo pesquisado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((u) => {
            const selecionado = selecionados.has(u.id_usuario);
            return (
            <Card
              key={u.id_usuario}
              className={`border shadow-sm flex flex-col justify-between transition-shadow ${
                modoSelecao
                  ? `cursor-pointer hover:shadow-md ${selecionado ? "border-primary ring-1 ring-primary" : "border-border/60"}`
                  : "border-border/60 hover:shadow-md"
              }`}
              onClick={modoSelecao ? () => alternarSelecao(u.id_usuario) : undefined}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  {modoSelecao && (
                    <input
                      type="checkbox"
                      checked={selecionado}
                      onChange={() => alternarSelecao(u.id_usuario)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 size-4 shrink-0 accent-primary"
                    />
                  )}
                  <div className="space-y-1 flex-1 min-w-0">
                    <CardTitle className="text-base font-bold">{u.nome}</CardTitle>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <Badge
                    variant={u.papel_global === "admin" ? "default" : "secondary"}
                    className="capitalize font-mono text-[10px]"
                  >
                    {u.papel_global}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="grid gap-1.5 text-xs text-muted-foreground py-2">
                {u.telefone && (
                  <div className="flex justify-between items-center border-b border-border/40 pb-1">
                    <span>Telefone:</span>
                    <span className="font-mono text-foreground">{u.telefone}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span>ID Usuário:</span>
                  <code className="font-mono text-foreground">#{u.id_usuario}</code>
                </div>
              </CardContent>

              {!modoSelecao && (
                <div className="px-6 pb-3 pt-1 flex justify-end border-t border-border/40">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setUsuarioExcluir(u)}
                    className="size-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Excluir Usuário"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDeleteDialog
        open={Boolean(usuarioExcluir)}
        onOpenChange={(open) => !open && setUsuarioExcluir(null)}
        title="Excluir Usuário"
        itemNome={usuarioExcluir?.nome}
        description="Esta ação removerá permanentemente o usuário e seus vínculos de papéis no banco de dados do Supabase."
        onConfirm={handleExcluirUsuario}
      />

      {/* Modal de Confirmação de Exclusão em Lote */}
      <ConfirmDeleteDialog
        open={excluirLoteAberto}
        onOpenChange={setExcluirLoteAberto}
        title="Excluir Usuários Selecionados"
        description={`Esta ação removerá permanentemente ${selecionados.size} usuário(s) e seus vínculos de papéis no banco de dados do Supabase. Esta ação é permanente e não poderá ser desfeita.`}
        onConfirm={handleExcluirSelecionados}
      />
    </div>
  );
}

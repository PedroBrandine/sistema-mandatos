"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Shield, Trash2, UserPlus, Users2 } from "lucide-react";
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
      const msg = err instanceof Error ? err.message : "Falha na exclusão";
      toast.error(`Erro ao excluir usuário: ${msg}`);
    } finally {
      setUsuarioExcluir(null);
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
          {filtrados.map((u) => (
            <Card key={u.id_usuario} className="border border-border/60 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
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
            </Card>
          ))}
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
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderKanban, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@backend/supabase/client";
import type { Database } from "@backend/supabase/database.types";
import { projetoSchema } from "@backend/schemas/projeto";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

type ProjetoRow = Database["public"]["Tables"]["ref_projeto"]["Row"];
type ProdutoOption = { id_produto: number; nome: string };

const CODIGO_VIOLACAO_FK = "23503";

interface ErroPostgrest {
  message: string;
  details?: string | null;
  code?: string;
}

function ehErroPostgrest(err: unknown): err is ErroPostgrest {
  return typeof err === "object" && err !== null && "message" in err;
}

function mensagemDeErro(err: unknown): string {
  if (ehErroPostgrest(err)) return err.details ? `${err.message} (${err.details})` : err.message;
  if (err instanceof Error) return err.message;
  return "Falha na operação (erro sem detalhes)";
}

const FORM_VAZIO = {
  nome: "",
  tematica: "",
  id_produto_padrao: "nenhum" as string,
  dt_inicio: "",
  dt_fim: "",
  ativo: true,
};

export default function ProjetosPage() {
  const [projetos, setProjetos] = useState<ProjetoRow[]>([]);
  const [produtos, setProdutos] = useState<ProdutoOption[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<ProjetoRow | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [projetoExcluir, setProjetoExcluir] = useState<ProjetoRow | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();
    const [{ data: prjs }, { data: prds }] = await Promise.all([
      supabase.from("ref_projeto").select("*").order("nome"),
      supabase.from("ref_produto").select("id_produto, nome").order("nome"),
    ]);
    setProjetos(prjs ?? []);
    setProdutos(prds ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrirNovo = () => {
    setEditando(null);
    setForm(FORM_VAZIO);
    setErroForm(null);
    setModalAberto(true);
  };

  const abrirEdicao = (p: ProjetoRow) => {
    setEditando(p);
    setForm({
      nome: p.nome,
      tematica: p.tematica ?? "",
      id_produto_padrao: p.id_produto_padrao ? String(p.id_produto_padrao) : "nenhum",
      dt_inicio: p.dt_inicio ?? "",
      dt_fim: p.dt_fim ?? "",
      ativo: p.ativo,
    });
    setErroForm(null);
    setModalAberto(true);
  };

  const handleSalvar = async () => {
    const analisado = projetoSchema.safeParse({
      nome: form.nome,
      tematica: form.tematica || null,
      id_produto_padrao: form.id_produto_padrao === "nenhum" ? null : Number(form.id_produto_padrao),
      dt_inicio: form.dt_inicio || null,
      dt_fim: form.dt_fim || null,
      ativo: form.ativo,
    });

    if (!analisado.success) {
      setErroForm(analisado.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }

    setSalvando(true);
    setErroForm(null);
    const supabase = createClient();

    const { error } = editando
      ? await supabase.from("ref_projeto").update(analisado.data).eq("id_projeto", editando.id_projeto)
      : await supabase.from("ref_projeto").insert(analisado.data);

    setSalvando(false);

    if (error) {
      setErroForm(mensagemDeErro(error));
      return;
    }

    toast.success(editando ? `Projeto "${form.nome}" atualizado.` : `Projeto "${form.nome}" cadastrado.`);
    setModalAberto(false);
    void carregar();
  };

  const handleExcluir = async () => {
    if (!projetoExcluir) return;
    const supabase = createClient();
    const { id_projeto, nome } = projetoExcluir;

    try {
      const { error } = await supabase.from("ref_projeto").delete().eq("id_projeto", id_projeto);
      if (error) throw error;
      toast.success(`Projeto "${nome}" excluído.`);
      setProjetos((prev) => prev.filter((p) => p.id_projeto !== id_projeto));
    } catch (err: unknown) {
      const msg = mensagemDeErro(err);
      if (ehErroPostgrest(err) && err.code === CODIGO_VIOLACAO_FK) {
        toast.error(`Não é possível excluir "${nome}": há contratos ou registros vinculados a este projeto. ${msg}`, {
          action: {
            label: "Inativar em vez disso",
            onClick: async () => {
              const supabase = createClient();
              const { error: errInativar } = await supabase
                .from("ref_projeto")
                .update({ ativo: false })
                .eq("id_projeto", id_projeto);
              if (errInativar) {
                toast.error(`Erro ao inativar "${nome}": ${mensagemDeErro(errInativar)}`);
                return;
              }
              toast.success(`Projeto "${nome}" inativado.`);
              void carregar();
            },
          },
          duration: 10000,
        });
      } else {
        toast.error(`Erro ao excluir projeto: ${msg}`);
      }
    } finally {
      setProjetoExcluir(null);
    }
  };

  const filtrados = projetos.filter((p) => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()));
  const nomeProduto = (id: number | null) => produtos.find((p) => p.id_produto === id)?.nome;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6 animate-in fade-in duration-300">
      <Breadcrumbs items={[{ label: "Projetos" }]} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Projetos</h1>
            <Badge variant="secondary" className="font-mono text-xs">
              {filtrados.length} projeto(s)
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Cadastro de projetos usados por contratos e coalizões (<code className="font-mono">ref_projeto</code>)
          </p>
        </div>

        <Dialog open={modalAberto} onOpenChange={setModalAberto}>
          <DialogTrigger asChild>
            <Button type="button" className="gap-2 font-semibold" onClick={abrirNovo}>
              <Plus className="size-4" />
              Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-heading text-lg font-bold">
                <FolderKanban className="size-5 text-primary" />
                {editando ? "Editar Projeto" : "Cadastrar Projeto"}
              </DialogTitle>
              <DialogDescription className="text-xs">Nome, temática e produto padrão do projeto.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
              </div>

              <div className="space-y-1.5">
                <Label>Temática</Label>
                <Input value={form.tematica} onChange={(e) => setForm((f) => ({ ...f, tematica: e.target.value }))} />
              </div>

              <div className="space-y-1.5">
                <Label>Produto padrão</Label>
                <Select
                  value={form.id_produto_padrao}
                  onValueChange={(v) => setForm((f) => ({ ...f, id_produto_padrao: v }))}
                >
                  <SelectTrigger className="bg-background text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum</SelectItem>
                    {produtos.map((p) => (
                      <SelectItem key={p.id_produto} value={String(p.id_produto)}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Início</Label>
                  <Input type="date" value={form.dt_inicio} onChange={(e) => setForm((f) => ({ ...f, dt_inicio: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fim</Label>
                  <Input type="date" value={form.dt_fim} onChange={(e) => setForm((f) => ({ ...f, dt_fim: e.target.value }))} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <Label className="text-xs">Ativo</Label>
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))} />
              </div>

              {erroForm && <p className="text-xs text-destructive">{erroForm}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)} disabled={salvando}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSalvar} disabled={salvando} className="gap-2">
                {salvando && <Loader2 className="size-4 animate-spin" />}
                {editando ? "Salvar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9 text-xs"
        />
      </div>

      {carregando ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <p>Nenhum projeto encontrado.</p>
          <Button type="button" onClick={abrirNovo} className="gap-2">
            <Plus className="size-4" />
            Cadastrar primeiro projeto
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((p) => (
            <Card key={p.id_projeto} className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-bold">{p.nome}</CardTitle>
                  <Badge variant={p.ativo ? "default" : "secondary"} className="text-[10px]">
                    {p.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-1.5 text-xs text-muted-foreground py-2">
                {p.tematica && <p className="text-foreground">{p.tematica}</p>}
                {nomeProduto(p.id_produto_padrao) && (
                  <div className="flex justify-between border-b border-border/40 pb-1">
                    <span>Produto padrão:</span>
                    <span className="font-mono text-foreground">{nomeProduto(p.id_produto_padrao)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>ID:</span>
                  <code className="font-mono text-foreground">#{p.id_projeto}</code>
                </div>
              </CardContent>
              <div className="flex justify-end gap-1 border-t border-border/40 px-6 pb-3 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => abrirEdicao(p)} className="text-xs">
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setProjetoExcluir(p)}
                  className="size-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Excluir Projeto"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={Boolean(projetoExcluir)}
        onOpenChange={(open) => !open && setProjetoExcluir(null)}
        title="Excluir Projeto"
        itemNome={projetoExcluir?.nome}
        description="Esta ação removerá permanentemente o projeto do banco de dados."
        onConfirm={handleExcluir}
      />
    </div>
  );
}

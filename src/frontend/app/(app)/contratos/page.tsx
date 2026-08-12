"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FileText, Kanban, Plus, Trash2, Users2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@backend/supabase/client";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

interface ContratoItem {
  idContrato: number;
  nomeContratante: string;
  nomeProduto: string;
  dtInicio: string;
  status: "ativo" | "concluido" | "nao_concluido" | string;
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState<ContratoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroProduto, setFiltroProduto] = useState<string>("todos");
  const [produtosDisponiveis, setProdutosDisponiveis] = useState<string[]>([]);
  const [statusDisponiveis, setStatusDisponiveis] = useState<string[]>([]);

  // Estado para exclusão
  const [contratoExcluir, setContratoExcluir] = useState<ContratoItem | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();

    const [{ data: contratosData }, { data: contratantesData }, { data: produtosData }] =
      await Promise.all([
        supabase.from("fat_contrato").select("*").order("id_contrato", { ascending: false }),
        supabase.from("dim_contratante").select("id_contratante, nome"),
        supabase.from("ref_produto").select("id_produto, nome"),
      ]);

    const contratantesPorId = new Map((contratantesData ?? []).map((c) => [c.id_contratante, c.nome]));
    const produtosPorId = new Map((produtosData ?? []).map((p) => [p.id_produto, p.nome]));

    const lista: ContratoItem[] = (contratosData ?? []).map((c) => ({
      idContrato: c.id_contrato,
      nomeContratante: contratantesPorId.get(c.id_contratante) ?? `Contratante #${c.id_contratante}`,
      nomeProduto: produtosPorId.get(c.id_produto) ?? `Produto #${c.id_produto}`,
      dtInicio: c.dt_inicio ? new Date(c.dt_inicio).toLocaleDateString("pt-BR") : "—",
      status: c.status,
    }));

    const produtosSet = new Set<string>();
    const statusSet = new Set<string>();
    lista.forEach((c) => {
      produtosSet.add(c.nomeProduto);
      statusSet.add(c.status);
    });
    setProdutosDisponiveis(Array.from(produtosSet).sort());
    setStatusDisponiveis(Array.from(statusSet).sort());

    setContratos(lista);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const handleAtualizarStatus = async (idContrato: number, novoStatus: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("fat_contrato")
      .update({ status: novoStatus })
      .eq("id_contrato", idContrato);

    if (error) {
      toast.error("Erro ao alterar status do contrato");
      return;
    }

    toast.success(`Status do contrato #${idContrato} alterado para ${novoStatus.toUpperCase()}`);
    setContratos((prev) =>
      prev.map((c) => (c.idContrato === idContrato ? { ...c, status: novoStatus } : c))
    );
  };

  const handleExcluirContrato = async () => {
    if (!contratoExcluir) return;

    const supabase = createClient();
    const { idContrato, nomeContratante, nomeProduto } = contratoExcluir;

    try {
      await supabase.from("rel_usuario_contrato").delete().eq("id_contrato", idContrato);
      await supabase.from("rel_coalizao_membro").delete().eq("id_contrato", idContrato);
      // operacao-regua-instanciacao: trigger AFTER INSERT em fat_contrato
      // agora popula fat_etapa_contrato/rel_formulario_contrato/dim_planejamento
      // (ON DELETE RESTRICT) -- precisam sair antes de fat_contrato.
      await supabase.from("fat_etapa_contrato").delete().eq("id_contrato", idContrato);
      await supabase.from("rel_formulario_contrato").delete().eq("id_contrato", idContrato);
      await supabase.from("dim_planejamento").delete().eq("id_contrato", idContrato);

      const { error } = await supabase.from("fat_contrato").delete().eq("id_contrato", idContrato);
      if (error) throw error;

      toast.success(`Contrato #${idContrato} (${nomeProduto} - ${nomeContratante}) excluído com sucesso!`);
      setContratos((prev) => prev.filter((c) => c.idContrato !== idContrato));
    } catch (err: unknown) {
      console.error("Erro ao excluir contrato:", err);
      const msg = err instanceof Error ? err.message : "Falha na exclusão";
      toast.error(`Erro ao excluir contrato: ${msg}`);
    } finally {
      setContratoExcluir(null);
    }
  };

  const filtrados = contratos.filter(
    (c) =>
      (filtroStatus === "todos" || c.status === filtroStatus) &&
      (filtroProduto === "todos" || c.nomeProduto === filtroProduto)
  );

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6 animate-in fade-in duration-300">
      <Breadcrumbs items={[{ label: "Contratos" }]} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Contratos</h1>
            <Badge variant="secondary" className="font-mono text-xs">
              {filtrados.length} encontrados
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Âncoras de contratação e gestão operacional de produtos
          </p>
        </div>

        <Link href="/mandatos/novo">
          <Button type="button" className="gap-2 font-semibold shadow-sm active:scale-[0.98]">
            <Plus className="size-4" />
            Novo Contrato
          </Button>
        </Link>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm">
        <Select value={filtroProduto} onValueChange={setFiltroProduto}>
          <SelectTrigger className="bg-background text-xs">
            <SelectValue placeholder="Filtrar por Produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Produtos</SelectItem>
            {produtosDisponiveis.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="bg-background text-xs">
            <SelectValue placeholder="Filtrar por Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            {statusDisponiveis.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid de Contratos */}
      {carregando ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : contratos.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <p>Nenhum contrato registrado no banco de dados.</p>
          <Link href="/mandatos/novo">
            <Button type="button" className="gap-2">
              <Plus className="size-4" />
              Abrir novo contrato
            </Button>
          </Link>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <p>Nenhum contrato encontrado com os filtros selecionados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((c) => (
            <Card key={c.idContrato} className="border border-border/60 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold">{c.nomeContratante}</CardTitle>
                  <p className="text-xs text-muted-foreground">Contrato #{c.idContrato}</p>
                </div>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <FileText className="size-4" />
                </div>
              </CardHeader>

              <CardContent className="grid gap-3 text-xs py-2">
                <div className="flex justify-between items-center border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Produto:</span>
                  <span className="font-semibold text-foreground">{c.nomeProduto}</span>
                </div>
                <div className="flex justify-between items-center border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Data de Início:</span>
                  <span className="font-mono text-foreground">{c.dtInicio}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-muted-foreground">Status do Contrato:</span>
                  <Select
                    value={c.status}
                    onValueChange={(val) => handleAtualizarStatus(c.idContrato, val)}
                  >
                    <SelectTrigger className="w-32 h-7 text-[11px] font-semibold uppercase font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                      <SelectItem value="nao_concluido">Não Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>

              <CardFooter className="pt-3 flex items-center justify-between border-t border-border/40 bg-muted/20">
                <div className="flex items-center gap-1">
                  <Link href={`/contratos/${c.idContrato}/vinculos`}>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-semibold gap-1 text-primary">
                      <Users2 className="size-3.5" /> Equipe
                    </Button>
                  </Link>
                  <Link href={`/contratos/${c.idContrato}/planejamento`}>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-semibold gap-1 text-primary">
                      <Kanban className="size-3.5" /> Plan.
                    </Button>
                  </Link>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setContratoExcluir(c)}
                  className="size-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Excluir Contrato"
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDeleteDialog
        open={Boolean(contratoExcluir)}
        onOpenChange={(open) => !open && setContratoExcluir(null)}
        title="Excluir Contrato"
        itemNome={`Contrato #${contratoExcluir?.idContrato} (${contratoExcluir?.nomeProduto})`}
        description="Esta ação excluirá o contrato e seus vínculos com usuários e coalizões do Supabase."
        onConfirm={handleExcluirContrato}
      />
    </div>
  );
}

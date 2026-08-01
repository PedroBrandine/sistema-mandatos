"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@backend/supabase/client";
import { CoalizaoCard, type CoalizaoCardProps } from "@/components/fundacao/coalizao-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

type CoalizaoCartao = CoalizaoCardProps["coalizao"];

export default function CoalizoesPage() {
  const [coalizoes, setCoalizoes] = useState<CoalizaoCartao[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Estado para exclusão
  const [coalizaoExcluir, setCoalizaoExcluir] = useState<{
    idCoalizao: number;
    idContratante: number;
    nome: string;
  } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();

    const [{ data: coalizoesData }, { data: contratantesData }] = await Promise.all([
      supabase.from("dim_coalizao").select("*").order("id_coalizao", { ascending: false }),
      supabase.from("dim_contratante").select("*"),
    ]);

    const contratantesPorId = new Map((contratantesData ?? []).map((c) => [c.id_contratante, c]));

    const lista: CoalizaoCartao[] = (coalizoesData ?? []).map((co) => {
      const contratante = contratantesPorId.get(co.id_contratante);
      return {
        idCoalizao: co.id_coalizao,
        idContratante: co.id_contratante,
        nome: contratante?.nome ?? `Coalizão #${co.id_coalizao}`,
        sgUf: contratante?.sg_uf ?? null,
        nmMunicipio: contratante?.nm_municipio ?? null,
      };
    });

    setCoalizoes(lista);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const handleExcluirCoalizao = async () => {
    if (!coalizaoExcluir) return;

    const supabase = createClient();
    const { idCoalizao, idContratante, nome } = coalizaoExcluir;

    try {
      // 1. Excluir membros da coalizão
      await supabase.from("rel_coalizao_membro").delete().eq("id_coalizao", idCoalizao);

      // 2. Excluir dim_coalizao
      const { error } = await supabase.from("dim_coalizao").delete().eq("id_coalizao", idCoalizao);
      if (error) throw error;

      // 3. Excluir dim_contratante
      await supabase.from("dim_contratante").delete().eq("id_contratante", idContratante);

      toast.success(`Coalizão "${nome}" excluída com sucesso!`);
      setCoalizoes((prev) => prev.filter((c) => c.idCoalizao !== idCoalizao));
    } catch (err: unknown) {
      console.error("Erro ao excluir coalizão:", err);
      const msg = err instanceof Error ? err.message : "Falha na exclusão";
      toast.error(`Erro ao excluir coalizão: ${msg}`);
    } finally {
      setCoalizaoExcluir(null);
    }
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6 animate-in fade-in duration-300">
      <Breadcrumbs items={[{ label: "Coalizões" }]} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Coalizões</h1>
            <Badge variant="secondary" className="font-mono text-xs">
              {coalizoes.length} ativas
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Gestão de articulações e bancadas em <code className="font-mono">dim_coalizao</code>
          </p>
        </div>

        <Link href="/coalizoes/novo">
          <Button type="button" className="gap-2 font-semibold shadow-sm active:scale-[0.98]">
            <Plus className="size-4" />
            Nova Coalizão
          </Button>
        </Link>
      </div>

      {carregando ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : coalizoes.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <p>Nenhuma coalizão cadastrada ainda.</p>
          <Link href="/coalizoes/novo">
            <Button type="button" className="gap-2">
              <Plus className="size-4" />
              Cadastrar primeira coalizão
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coalizoes.map((co) => (
            <CoalizaoCard
              key={co.idCoalizao}
              coalizao={co}
              onDelete={(idCoalizao, idContratante, nome) => {
                setCoalizaoExcluir({ idCoalizao, idContratante, nome });
              }}
            />
          ))}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDeleteDialog
        open={Boolean(coalizaoExcluir)}
        onOpenChange={(open) => !open && setCoalizaoExcluir(null)}
        title="Excluir Coalizão"
        itemNome={coalizaoExcluir?.nome}
        description="Esta ação excluirá a coalizão e os vínculos de seus membros do Supabase."
        onConfirm={handleExcluirCoalizao}
      />
    </div>
  );
}

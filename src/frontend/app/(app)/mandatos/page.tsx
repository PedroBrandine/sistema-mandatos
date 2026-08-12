"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@backend/supabase/client";
import { MandatoCard, type MandatoCardProps } from "@/components/fundacao/mandato-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

type MandatoCartao = MandatoCardProps["mandato"];

export default function MandatosPage() {
  const [mandatos, setMandatos] = useState<MandatoCartao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroUf, setFiltroUf] = useState<string>("todos");
  const [filtroPartido, setFiltroPartido] = useState<string>("todos");
  const [ufsDisponiveis, setUfsDisponiveis] = useState<string[]>([]);
  const [partidosDisponiveis, setPartidosDisponiveis] = useState<string[]>([]);

  // Estado para exclusão
  const [mandatoExcluir, setMandatoExcluir] = useState<{
    idMandato: number;
    idContratante: number;
    nome: string;
  } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();

    const [{ data: mandatosData }, { data: contratantesData }, { data: partidosData }, { data: cargosData }] =
      await Promise.all([
        supabase.from("dim_mandato").select("*").order("id_mandato", { ascending: false }),
        supabase.from("dim_contratante").select("*"),
        supabase.from("ref_partido").select("id_partido, sigla"),
        supabase.from("ref_cargo").select("id_cargo, nome"),
      ]);

    const contratantesPorId = new Map((contratantesData ?? []).map((c) => [c.id_contratante, c]));
    const partidosPorId = new Map((partidosData ?? []).map((p) => [p.id_partido, p.sigla]));
    const cargosPorId = new Map((cargosData ?? []).map((c) => [c.id_cargo, c.nome]));

    const lista: MandatoCartao[] = (mandatosData ?? []).map((m) => {
      const contratante = contratantesPorId.get(m.id_contratante);
      return {
        idMandato: m.id_mandato,
        idContratante: m.id_contratante,
        nomeUrna: m.nm_urna,
        nomeContratante: contratante?.nome ?? `Contratante #${m.id_contratante}`,
        sgUf: contratante?.sg_uf ?? null,
        siglaPartido: m.id_partido_atual != null ? (partidosPorId.get(m.id_partido_atual) ?? null) : null,
        nomeCargo: m.id_cargo_atual != null ? (cargosPorId.get(m.id_cargo_atual) ?? null) : null,
      };
    });

    const ufs = new Set<string>();
    const pts = new Set<string>();
    lista.forEach((m) => {
      if (m.sgUf) ufs.add(m.sgUf);
      if (m.siglaPartido) pts.add(m.siglaPartido);
    });
    setUfsDisponiveis(Array.from(ufs).sort());
    setPartidosDisponiveis(Array.from(pts).sort());

    setMandatos(lista);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const handleExcluirMandato = async () => {
    if (!mandatoExcluir) return;

    const supabase = createClient();
    const { idMandato, idContratante, nome } = mandatoExcluir;

    try {
      // 1. Excluir vínculo TSE se houver
      await supabase.from("rel_mandato_candidatura").delete().eq("id_mandato", idMandato);

      // 2. Buscar contratos atrelados a este contratante
      const { data: contratos } = await supabase
        .from("fat_contrato")
        .select("id_contrato")
        .eq("id_contratante", idContratante);

      if (contratos && contratos.length > 0) {
        const idsContratos = contratos.map((c) => c.id_contrato);
        // Excluir vínculos de usuários e membros de coalizão desses contratos
        await supabase.from("rel_usuario_contrato").delete().in("id_contrato", idsContratos);
        await supabase.from("rel_coalizao_membro").delete().in("id_contrato", idsContratos);
        // operacao-regua-instanciacao: trigger AFTER INSERT em fat_contrato
        // agora popula fat_etapa_contrato/rel_formulario_contrato/dim_planejamento
        // (ON DELETE RESTRICT) -- precisam sair antes de fat_contrato.
        await supabase.from("fat_etapa_contrato").delete().in("id_contrato", idsContratos);
        await supabase.from("rel_formulario_contrato").delete().in("id_contrato", idsContratos);
        await supabase.from("dim_planejamento").delete().in("id_contrato", idsContratos);
        // Excluir os contratos
        await supabase.from("fat_contrato").delete().eq("id_contratante", idContratante);
      }

      // 3. Excluir dim_mandato
      const { error: errMandato } = await supabase.from("dim_mandato").delete().eq("id_mandato", idMandato);
      if (errMandato) throw errMandato;

      // 4. Excluir dim_contratante
      await supabase.from("dim_contratante").delete().eq("id_contratante", idContratante);

      toast.success(`Mandato "${nome}" excluído do banco de dados com sucesso!`);
      setMandatos((prev) => prev.filter((m) => m.idMandato !== idMandato));
    } catch (err: unknown) {
      console.error("Erro ao excluir mandato:", err);
      const msg = err instanceof Error ? err.message : "Falha na exclusão";
      toast.error(`Erro ao excluir mandato: ${msg}`);
    } finally {
      setMandatoExcluir(null);
    }
  };

  const filtrados = mandatos.filter((m) => {
    const nome = m.nomeUrna ?? m.nomeContratante;
    const bateBusca = !busca || nome.toLowerCase().includes(busca.toLowerCase());
    const bateUf = filtroUf === "todos" || m.sgUf === filtroUf;
    const batePartido = filtroPartido === "todos" || m.siglaPartido === filtroPartido;
    return bateBusca && bateUf && batePartido;
  });

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6 animate-in fade-in duration-300">
      <Breadcrumbs items={[{ label: "Mandatos" }]} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold uppercase tracking-tight">Mandatos</h1>
            <Badge variant="secondary" className="font-mono text-xs">
              {filtrados.length} cadastrados
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Gestão de parlamentares e mandatos em <code className="font-mono">dim_mandato</code>
          </p>
        </div>

        <Link href="/mandatos/novo">
          <Button type="button" className="gap-2 font-semibold shadow-sm active:scale-[0.98]">
            <Plus className="size-4" />
            Novo Mandato
          </Button>
        </Link>
      </div>

      {/* Barra de Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-border/60 bg-card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <Select value={filtroUf} onValueChange={setFiltroUf}>
          <SelectTrigger className="bg-background text-xs">
            <SelectValue placeholder="Filtrar por UF" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as UFs</SelectItem>
            {ufsDisponiveis.map((uf) => (
              <SelectItem key={uf} value={uf}>
                {uf}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroPartido} onValueChange={setFiltroPartido}>
          <SelectTrigger className="bg-background text-xs">
            <SelectValue placeholder="Filtrar por Partido" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Partidos</SelectItem>
            {partidosDisponiveis.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Conteúdo / Cards */}
      {carregando ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : mandatos.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <p>Nenhum mandato cadastrado no banco de dados ainda.</p>
          <Link href="/mandatos/novo">
            <Button type="button" className="gap-2">
              <Plus className="size-4" />
              Cadastrar primeiro mandato
            </Button>
          </Link>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <p>Nenhum mandato encontrado com os filtros atuais.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((m) => (
            <MandatoCard
              key={m.idMandato}
              mandato={m}
              onDelete={(idMandato, idContratante, nome) => {
                setMandatoExcluir({ idMandato, idContratante, nome });
              }}
            />
          ))}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDeleteDialog
        open={Boolean(mandatoExcluir)}
        onOpenChange={(open) => !open && setMandatoExcluir(null)}
        title="Excluir Mandato"
        itemNome={mandatoExcluir?.nome}
        description="Esta ação excluirá o mandato e seus vínculos relacionados do banco de dados do Supabase. Não poderá ser desfeita."
        onConfirm={handleExcluirMandato}
      />
    </div>
  );
}

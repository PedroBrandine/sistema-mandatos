"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Landmark,
  Save,
  Trash2,
  Users2,
  Vote,
  ExternalLink,
  Kanban,
} from "lucide-react";
import { toast } from "sonner";

import { buscarPerfilCandidatura, buscarPerfilEleitoradoCandidatura, buscarTodasCandidaturasPorTitulo } from "@backend/queries/tse";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { marcarCandidaturaVigente } from "@backend/rpc/mandato";
import { contratanteSchema } from "@backend/schemas/contratante";
import { mandatoSchema } from "@backend/schemas/mandato";
import { createClient } from "@backend/supabase/client";
import type { Database } from "@backend/supabase/database.types";
import type { PerfilCandidatura, PerfilEleitorado } from "@backend/types/fundacao";

import { ContratanteFields } from "@/components/fundacao/contratante-fields";
import { PerfilEleitoradoChart } from "@/components/fundacao/perfil-eleitorado-chart";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ContratoRow = Database["public"]["Tables"]["fat_contrato"]["Row"];
type CandidaturaRow = Database["public"]["Tables"]["rel_mandato_candidatura"]["Row"];

interface PerfilVotacao {
  qtVotosTotal: number | null;
  nmMunicipioPrincipal: string | null;
  nmUrna: string | null;
  dsCargo: string | null;
  sgPartido: string | null;
}

interface PerfilTseCandidatura {
  votacao: PerfilVotacao | null;
  pessoal: PerfilCandidatura | null;
  eleitorado: PerfilEleitorado | null;
}

const detalheSchema = z.object({
  contratante: contratanteSchema,
  mandato: mandatoSchema,
});
type DetalheFormValues = z.infer<typeof detalheSchema>;

export default function MandatoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const idMandato = Number(id);

  const [carregando, setCarregando] = useState(true);
  const [idContratante, setIdContratante] = useState<number | null>(null);
  const [candidaturas, setCandidaturas] = useState<CandidaturaRow[]>([]);
  const [perfisTse, setPerfisTse] = useState<Record<number, PerfilTseCandidatura>>({});
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [produtosMap, setProdutosMap] = useState<Map<number, string>>(new Map());
  const [anoAberto, setAnoAberto] = useState<number | null>(null);
  const [modalExcluir, setModalExcluir] = useState(false);
  const [nomeExibicao, setNomeExibicao] = useState(`Mandato #${idMandato}`);

  const form = useForm<DetalheFormValues>({
    resolver: zodResolver(detalheSchema),
    mode: "onChange",
    defaultValues: { contratante: { nome: "" }, mandato: {} },
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();

    // Carregar produtos para nome
    const { data: produtosData } = await supabase.from("ref_produto").select("id_produto, nome");
    setProdutosMap(new Map((produtosData ?? []).map((p) => [p.id_produto, p.nome])));

    const { data: mandato } = await supabase
      .from("dim_mandato")
      .select("*")
      .eq("id_mandato", idMandato)
      .maybeSingle();

    if (mandato) {
      setIdContratante(mandato.id_contratante);

      const { data: contratante } = await supabase
        .from("dim_contratante")
        .select("*")
        .eq("id_contratante", mandato.id_contratante)
        .maybeSingle();

      const titulo = mandato.nm_urna ?? contratante?.nome ?? `Mandato #${idMandato}`;
      setNomeExibicao(titulo);

      form.reset({
        contratante: {
          nome: contratante?.nome ?? "",
          sg_uf: contratante?.sg_uf ?? null,
          nm_municipio: contratante?.nm_municipio ?? null,
        },
        mandato: {
          nm_civil: mandato.nm_civil,
          nm_urna: mandato.nm_urna,
          nr_titulo_eleitoral: mandato.nr_titulo_eleitoral,
          ds_genero: mandato.ds_genero,
          ds_raca: mandato.ds_raca as any,
          ds_identidade_genero: mandato.ds_identidade_genero,
          ds_orientacao_sexual: mandato.ds_orientacao_sexual,
          fl_pcd: mandato.fl_pcd,
        },
      });

      const { data: candidaturasData } = await supabase
        .from("rel_mandato_candidatura")
        .select("*")
        .eq("id_mandato", idMandato)
        .order("ano_eleicao", { ascending: false });

      let cList = candidaturasData ?? [];

      // Puxar da base TSE pelo título de eleitor (join por titulo -> sequencial do candidato)
      if (mandato.nr_titulo_eleitoral) {
        const completas = await buscarTodasCandidaturasPorTitulo(supabase, mandato.nr_titulo_eleitoral);

        for (const comp of completas) {
          const jaExiste = cList.some(
            (c) => c.ano_eleicao === comp.anoEleicao && c.sq_candidato === comp.sqCandidato
          );
          if (!jaExiste) {
            cList.push({
              id_vinculo_tse: -comp.sqCandidato,
              id_mandato: idMandato,
              ano_eleicao: comp.anoEleicao,
              sq_candidato: comp.sqCandidato,
              nr_turno: comp.nrTurno,
              metodo_match: "titulo_eleitoral",
              confianca: "alta",
              status: "confirmado",
              id_usuario_validou: null,
              validado_em: null,
              criado_em: new Date().toISOString(),
              eh_mandato_vigente: false,
            });
          }
        }
      }

      cList.sort((a, b) => b.ano_eleicao - a.ano_eleicao);
      setCandidaturas(cList);
      if (cList.length > 0 && anoAberto === null) {
        setAnoAberto(cList[0].ano_eleicao);
      }

      const entradas = await Promise.all(
        cList.map(async (c) => {
          const chave = { anoEleicao: c.ano_eleicao, sqCandidato: c.sq_candidato, nrTurno: c.nr_turno };
          const [resumo, pessoal, eleitorado] = await Promise.all([
            supabase
              .schema("tse")
              .from("mv_candidatura_resumo")
              .select("qt_votos_total, nm_municipio_principal, nm_urna, ds_cargo, sg_partido")
              .eq("ano_eleicao", chave.anoEleicao)
              .eq("sq_candidato", chave.sqCandidato)
              .eq("nr_turno", chave.nrTurno)
              .maybeSingle()
              .then(({ data }) => data ?? null),
            buscarPerfilCandidatura(supabase, chave).catch(() => null),
            buscarPerfilEleitoradoCandidatura(supabase, chave).catch(() => null),
          ]);

          let qtVotosTotal = resumo?.qt_votos_total ?? null;
          if (qtVotosTotal == null) {
            const { data: votosZona } = await supabase
              .schema("tse")
              .from("fat_votacao_zona")
              .select("qt_votos_nominais")
              .eq("sq_candidato", c.sq_candidato);
            if (votosZona && votosZona.length > 0) {
              qtVotosTotal = votosZona.reduce((acc, curr) => acc + (curr.qt_votos_nominais ?? 0), 0);
            }
          }

          const perfil: PerfilTseCandidatura = {
            votacao: resumo || qtVotosTotal !== null
              ? {
                  qtVotosTotal,
                  nmMunicipioPrincipal: resumo?.nm_municipio_principal ?? pessoal?.nmUe ?? null,
                  nmUrna: resumo?.nm_urna ?? mandato.nm_urna,
                  dsCargo: resumo?.ds_cargo ?? null,
                  sgPartido: resumo?.sg_partido ?? null,
                }
              : null,
            pessoal,
            eleitorado,
          };
          return [c.id_vinculo_tse, perfil] as const;
        })
      );
      setPerfisTse(Object.fromEntries(entradas));

      const { data: contratosData } = await supabase
        .from("fat_contrato")
        .select("*")
        .eq("id_contratante", mandato.id_contratante)
        .order("dt_inicio", { ascending: false });
      setContratos(contratosData ?? []);
    }
    setCarregando(false);
  }, [idMandato, form, anoAberto]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvar(valores: DetalheFormValues) {
    if (idContratante == null) return;
    const supabase = createClient();

    const { error: erroContratante } = await supabase
      .from("dim_contratante")
      .update({
        nome: valores.contratante.nome,
        sg_uf: valores.contratante.sg_uf ?? null,
        nm_municipio: valores.contratante.nm_municipio ?? null,
      })
      .eq("id_contratante", idContratante);

    const { error: erroMandato } = await supabase
      .from("dim_mandato")
      .update({
        nm_civil: valores.mandato.nm_civil ?? null,
        nm_urna: valores.mandato.nm_urna ?? null,
        nr_titulo_eleitoral: valores.mandato.nr_titulo_eleitoral ?? null,
      })
      .eq("id_mandato", idMandato);

    const erro = erroContratante ?? erroMandato;
    if (erro) {
      toast.error(mapeiaErroRpc(erro).message);
      return;
    }
    toast.success("Alterações salvas com sucesso!");
    void carregar();
  }

  async function atualizarStatusContrato(idContrato: number, novoStatus: "ativo" | "concluido" | "nao_concluido") {
    const supabase = createClient();
    const { error } = await supabase
      .from("fat_contrato")
      .update({ status: novoStatus })
      .eq("id_contrato", idContrato);

    if (error) {
      toast.error("Erro ao atualizar status do contrato");
      return;
    }

    toast.success("Status do contrato atualizado!");
    setContratos((prev) =>
      prev.map((c) => (c.id_contrato === idContrato ? { ...c, status: novoStatus } : c))
    );
  }

  async function marcarVigente(idVinculoTse: number) {
    const supabase = createClient();
    try {
      await marcarCandidaturaVigente(supabase, idVinculoTse);
      toast.success("Candidatura marcada como vigente!");
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível marcar esta candidatura como vigente.");
    }
  }

  const handleExcluir = async () => {
    if (idContratante == null) return;
    const supabase = createClient();

    try {
      await supabase.from("rel_mandato_candidatura").delete().eq("id_mandato", idMandato);
      const { data: ctrts } = await supabase.from("fat_contrato").select("id_contrato").eq("id_contratante", idContratante);
      if (ctrts && ctrts.length > 0) {
        const ids = ctrts.map((c) => c.id_contrato);
        await supabase.from("rel_usuario_contrato").delete().in("id_contrato", ids);
        await supabase.from("rel_coalizao_membro").delete().in("id_contrato", ids);
        // operacao-regua-instanciacao: trigger AFTER INSERT em fat_contrato
        // agora popula fat_etapa_contrato/rel_formulario_contrato/dim_planejamento
        // (ON DELETE RESTRICT) -- precisam sair antes de fat_contrato.
        await supabase.from("fat_etapa_contrato").delete().in("id_contrato", ids);
        await supabase.from("rel_formulario_contrato").delete().in("id_contrato", ids);
        await supabase.from("dim_planejamento").delete().in("id_contrato", ids);
        await supabase.from("fat_contrato").delete().eq("id_contratante", idContratante);
      }
      await supabase.from("dim_mandato").delete().eq("id_mandato", idMandato);
      await supabase.from("dim_contratante").delete().eq("id_contratante", idContratante);

      toast.success(`Mandato "${nomeExibicao}" excluído com sucesso!`);
      router.push("/mandatos");
    } catch (err: unknown) {
      console.error(err);
      toast.error("Falha ao excluir mandato.");
    }
  };

  if (carregando) {
    return (
      <div className="mx-auto grid max-w-5xl gap-6 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6 animate-in fade-in duration-300">
      <Breadcrumbs
        items={[
          { label: "Mandatos", href: "/mandatos" },
          { label: nomeExibicao },
        ]}
      />

      {/* Header do Detalhe */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Landmark className="size-5" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold">{nomeExibicao}</h1>
            <p className="text-xs text-muted-foreground">Ficha completa e inteligência eleitoral do mandato</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setModalExcluir(true)}
            className="gap-1.5 text-xs font-semibold"
          >
            <Trash2 className="size-4" />
            Excluir Mandato
          </Button>
        </div>
      </div>

      {/* Formulário Principal de Edição */}
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Landmark className="size-4 text-primary" /> Dados Cadastrais do Mandato
          </CardTitle>
          <CardDescription className="text-xs">
            Atualização de registros em <code className="font-mono">dim_contratante</code> e <code className="font-mono">dim_mandato</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(salvar)} className="grid gap-4">
              <ContratanteFields control={form.control} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="mandato.nm_civil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Nome civil completo</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} className="text-xs" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mandato.nm_urna"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Nome de Urna</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} className="text-xs" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mandato.nr_titulo_eleitoral"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Número do Título Eleitoral</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} className="text-xs font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 border-t border-border/60 pt-3">
                <FormField
                  control={form.control}
                  name="mandato.ds_raca"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-primary">Etnia / Cor / Raça</FormLabel>
                      <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full text-xs bg-background">
                            <SelectValue placeholder="Selecione etnia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {["Branca", "Preta", "Parda", "Amarela", "Indígena"].map((opt) => (
                            <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mandato.ds_genero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Gênero (TSE)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} placeholder="Ex: FEMININO" className="text-xs" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mandato.ds_identidade_genero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Identidade de Gênero</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} placeholder="Ex: Mulher Cisgênero" className="text-xs" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mandato.fl_pcd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">PcD</FormLabel>
                      <Select
                        value={field.value === true ? "sim" : field.value === false ? "nao" : undefined}
                        onValueChange={(v) => field.onChange(v === "sim")}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full text-xs bg-background">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="sim" className="text-xs">Sim</SelectItem>
                          <SelectItem value="nao" className="text-xs">Não</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" size="sm" className="gap-2 font-semibold shadow-sm">
                  <Save className="size-4" />
                  Salvar Alterações
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Accordion Menu Expandido por Ano de Eleição (Candidaturas TSE) */}
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Vote className="size-4 text-emerald-600 dark:text-emerald-400" /> Candidaturas no TSE
          </CardTitle>
          <CardDescription className="text-xs">
            Menu expandido por ano eleitoral com inteligência e votação real do TSE
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {candidaturas.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Nenhuma candidatura vinculada no TSE.
            </div>
          ) : (
            <div className="grid gap-3">
              {candidaturas.map((c) => {
                const perfil = perfisTse[c.id_vinculo_tse];
                const estaAberto = anoAberto === c.ano_eleicao;

                return (
                  <div
                    key={c.id_vinculo_tse}
                    className="rounded-xl border border-border/60 bg-card overflow-hidden transition-all shadow-sm"
                  >
                    {/* Header do Accordion */}
                    <button
                      type="button"
                      onClick={() => setAnoAberto(estaAberto ? null : c.ano_eleicao)}
                      className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 font-mono font-bold text-sm">
                          {c.ano_eleicao}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">
                              Eleição {c.ano_eleicao} — {perfil?.votacao?.dsCargo ?? "Cargo"}
                            </span>
                            {c.eh_mandato_vigente && (
                              <Badge className="bg-emerald-600 gap-1 text-[10px]">
                                <CheckCircle2 className="size-3" /> Vigente
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {perfil?.votacao?.nmUrna ?? "—"} • {perfil?.votacao?.sgPartido ?? "—"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-muted-foreground">Votos apurados</p>
                          <p className="font-heading font-bold text-sm text-emerald-600 dark:text-emerald-400">
                            {perfil?.votacao?.qtVotosTotal != null
                              ? perfil.votacao.qtVotosTotal.toLocaleString("pt-BR")
                              : "—"}
                          </p>
                        </div>
                        {estaAberto ? (
                          <ChevronUp className="size-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-5 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Conteúdo Expandido do Accordion */}
                    {estaAberto && (
                      <div className="p-5 grid gap-6 border-t border-border/40 bg-card text-xs animate-in slide-in-from-top-2 duration-200">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-border/40">
                          <div>
                            <span className="font-semibold text-muted-foreground">Município Principal: </span>
                            <span className="font-bold text-foreground">
                              {perfil?.votacao?.nmMunicipioPrincipal ?? perfil?.pessoal?.nmUe ?? "—"}
                            </span>
                          </div>
                          {!c.eh_mandato_vigente && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void marcarVigente(c.id_vinculo_tse)}
                              className="text-xs font-medium w-fit"
                            >
                              Marcar como candidatura vigente
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                          {/* Card 1: Votação */}
                          <div className="rounded-lg bg-muted/40 p-4 border space-y-1.5">
                            <p className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                              Desempenho Eleitoral
                            </p>
                            <p className="text-2xl font-bold font-heading text-foreground">
                              {perfil?.votacao?.qtVotosTotal != null
                                ? perfil.votacao.qtVotosTotal.toLocaleString("pt-BR")
                                : "—"} <span className="text-xs font-normal text-muted-foreground">votos</span>
                            </p>
                            <p className="text-muted-foreground">
                              Turno: <span className="font-semibold text-foreground">{c.nr_turno}º Turno</span>
                            </p>
                          </div>

                          {/* Card 2: Perfil Pessoal */}
                          {perfil?.pessoal && (
                            <div className="rounded-lg bg-muted/40 p-4 border space-y-1.5">
                              <p className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                                Perfil Pessoal (TSE)
                              </p>
                              <p>Idade: <span className="font-semibold text-foreground">{perfil.pessoal.idade ?? "—"}</span></p>
                              <p>Gênero: <span className="font-semibold text-foreground">{perfil.pessoal.genero ?? "—"}</span></p>
                              <p>Cor/Raça: <span className="font-semibold text-foreground">{perfil.pessoal.corRaca ?? "—"}</span></p>
                              <p>Instrução: <span className="font-semibold text-foreground">{perfil.pessoal.grauInstrucao ?? "—"}</span></p>
                            </div>
                          )}

                          {/* Card 3: Perfil do Eleitorado */}
                          {perfil?.eleitorado && (
                            <div className="rounded-lg bg-muted/40 p-4 border space-y-2">
                              <p className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                                Eleitorado da Base
                              </p>
                              <PerfilEleitoradoChart titulo="Gênero" dados={perfil.eleitorado.genero} />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contratos do Mandato (Com Produto, Início, Alteração de Status, Equipe e Planejamento) */}
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="size-4 text-blue-600 dark:text-blue-400" /> Contratos do Mandato
            </CardTitle>
            <CardDescription className="text-xs">
              Produtos contratados, status operacional, equipe e link direto para o planejamento
            </CardDescription>
          </div>
          <Link href={`/mandatos/novo`}>
            <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
              <FileText className="size-3.5" />
              Abrir Novo Contrato
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {contratos.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Nenhum contrato ativo ou finalizado para este mandato.
            </div>
          ) : (
            <div className="grid gap-4">
              {contratos.map((c) => {
                const nomeProduto = produtosMap.get(c.id_produto) ?? `Produto #${c.id_produto}`;
                return (
                  <div
                    key={c.id_contrato}
                    className="rounded-xl border border-border/60 bg-card p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-foreground">{nomeProduto}</span>
                        <Badge variant="outline" className="font-mono text-xs">
                          #{c.id_contrato}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Início: <span className="font-mono font-medium text-foreground">{c.dt_inicio}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Alteração direta do status */}
                      <Select
                        value={c.status}
                        onValueChange={(val: "ativo" | "concluido" | "nao_concluido") =>
                          atualizarStatusContrato(c.id_contrato, val)
                        }
                      >
                        <SelectTrigger className="w-36 h-8 text-xs font-semibold uppercase font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativo">Ativo</SelectItem>
                          <SelectItem value="concluido">Concluído</SelectItem>
                          <SelectItem value="nao_concluido">Não Concluído</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Gerenciar Equipe */}
                      <Link href={`/contratos/${c.id_contrato}/vinculos`}>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold h-8">
                          <Users2 className="size-3.5 text-primary" />
                          Gerenciar Equipe
                        </Button>
                      </Link>

                      {/* Planejamento */}
                      <Link href={`/contratos/${c.id_contrato}/planejamento`}>
                        <Button variant="default" size="sm" className="gap-1.5 text-xs font-semibold h-8 shadow-sm">
                          <Kanban className="size-3.5" />
                          Planejamento
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDeleteDialog
        open={modalExcluir}
        onOpenChange={setModalExcluir}
        title="Excluir Mandato"
        itemNome={nomeExibicao}
        description="Esta ação removerá permanentemente o mandato, suas candidaturas e contratos vinculados no Supabase."
        onConfirm={handleExcluir}
      />
    </div>
  );
}

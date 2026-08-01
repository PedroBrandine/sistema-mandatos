"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Flag,
  Handshake,
  Landmark,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users2,
  Vote,
} from "lucide-react";

import { createClient } from "@backend/supabase/client";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DashboardData {
  usuarioNome: string;
  usuarioEmail: string;
  totalMandatos: number;
  totalContratos: number;
  totalCoalizoes: number;
  totalUsuarios: number;
  ultimoMandato: {
    idMandato: number;
    nomeUrna: string;
    nomeCivil: string | null;
    sgUf: string | null;
    nmMunicipio: string | null;
    partido: string | null;
    cargo: string | null;
    espectroPolitico: string | null;
    relevanciaPolitica: string | null;
    confianca: string | null;
    riscoDemocratico: string | null;
    potencialFuturo: string | null;
  } | null;
  ultimoContrato: {
    idContrato: number;
    produtoNome: string | null;
    status: string;
    dtInicio: string;
    dtFimPrevista: string | null;
    profundidadeImpacto: string | null;
    etapaAtual: number | null;
  } | null;
  vinculoTse: {
    anoEleicao: number;
    sqCandidato: number;
    status: string;
    confianca: string | null;
  } | null;
}

interface ItemExploradorTse {
  idMandato?: number;
  anoEleicao: number;
  sqCandidato: number;
  nmUrna: string;
  nmCandidato?: string;
  sgUf: string;
  nmMunicipio: string;
  sgPartido: string;
  dsCargo: string;
  qtVotosTotal?: number;
  ehCarteira: boolean;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [saudacao, setSaudacao] = useState("Bem-vindo");

  // Estados do Explorador TSE
  const [abaTse, setAbaTse] = useState<"carteira" | "todos">("carteira");
  const [buscaTse, setBuscaTse] = useState("");
  const [itensTse, setItensTse] = useState<ItemExploradorTse[]>([]);
  const [carregandoTse, setCarregandoTse] = useState(false);

  const carregarDashboard = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();

    // Determinar saudação temporal
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) setSaudacao("Bom dia");
    else if (hora >= 12 && hora < 18) setSaudacao("Boa tarde");
    else setSaudacao("Boa noite");

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userEmail = authData.user?.email ?? "";

      const [{ data: usuarioData }, { count: mandatosCount, data: mandatosData }, { count: contratosCount, data: contratosData }, { count: coalizoesCount }, { count: usuariosCount }, { data: partidosData }, { data: cargosData }, { data: produtosData }] =
        await Promise.all([
          userEmail
            ? supabase.from("dim_usuario").select("nome").eq("email", userEmail).maybeSingle()
            : Promise.resolve({ data: null }),
          supabase.from("dim_mandato").select("*, dim_contratante(*)", { count: "exact" }).order("id_mandato", { ascending: false }),
          supabase.from("fat_contrato").select("*", { count: "exact" }).order("id_contrato", { ascending: false }),
          supabase.from("dim_coalizao").select("*", { count: "exact" }),
          supabase.from("dim_usuario").select("*", { count: "exact" }),
          supabase.from("ref_partido").select("id_partido, sigla"),
          supabase.from("ref_cargo").select("id_cargo, nome"),
          supabase.from("ref_produto").select("id_produto, nome"),
        ]);

      const partidosMap = new Map((partidosData ?? []).map((p) => [p.id_partido, p.sigla]));
      const cargosMap = new Map((cargosData ?? []).map((c) => [c.id_cargo, c.nome]));
      const produtosMap = new Map((produtosData ?? []).map((p) => [p.id_produto, p.nome]));

      let ultimoMandatoFormatted = null;
      let vinculoTseFormatted = null;

      if (mandatosData && mandatosData.length > 0) {
        const m = mandatosData[0];
        const contratante = m.dim_contratante;
        ultimoMandatoFormatted = {
          idMandato: m.id_mandato,
          nomeUrna: m.nm_urna ?? contratante?.nome ?? `Mandato #${m.id_mandato}`,
          nomeCivil: m.nm_civil,
          sgUf: contratante?.sg_uf ?? null,
          nmMunicipio: contratante?.nm_municipio ?? null,
          partido: m.id_partido_atual ? partidosMap.get(m.id_partido_atual) ?? null : null,
          cargo: m.id_cargo_atual ? cargosMap.get(m.id_cargo_atual) ?? null : null,
          espectroPolitico: m.espectro_politico,
          relevanciaPolitica: m.relevancia_politica,
          confianca: m.confianca,
          riscoDemocratico: m.risco_democratico,
          potencialFuturo: m.potencial_futuro,
        };

        const { data: vinculoData } = await supabase
          .from("rel_mandato_candidatura")
          .select("*")
          .eq("id_mandato", m.id_mandato)
          .maybeSingle();

        if (vinculoData) {
          vinculoTseFormatted = {
            anoEleicao: vinculoData.ano_eleicao,
            sqCandidato: vinculoData.sq_candidato,
            status: vinculoData.status,
            confianca: vinculoData.confianca,
          };
        }
      }

      let ultimoContratoFormatted = null;
      if (contratosData && contratosData.length > 0) {
        const c = contratosData[0];
        ultimoContratoFormatted = {
          idContrato: c.id_contrato,
          produtoNome: c.id_produto ? (produtosMap.get(c.id_produto) ?? null) : null,
          status: c.status,
          dtInicio: c.dt_inicio,
          dtFimPrevista: c.dt_fim_prevista,
          profundidadeImpacto: c.profundidade_impacto,
          etapaAtual: c.id_etapa_atual,
        };
      }

      const rawNome = usuarioData?.nome || authData.user?.user_metadata?.full_name || userEmail.split("@")[0] || "Usuário";
      // Formatar nome com capitalização bonita
      const nomeUsuario = rawNome
        .split(" ")
        .map((n: string) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase())
        .join(" ");

      setData({
        usuarioNome: nomeUsuario,
        usuarioEmail: userEmail,
        totalMandatos: mandatosCount ?? 0,
        totalContratos: contratosCount ?? 0,
        totalCoalizoes: coalizoesCount ?? 0,
        totalUsuarios: usuariosCount ?? 0,
        ultimoMandato: ultimoMandatoFormatted,
        ultimoContrato: ultimoContratoFormatted,
        vinculoTse: vinculoTseFormatted,
      });
    } catch (err) {
      console.error("Erro ao carregar dados do dashboard:", err);
    } finally {
      setCarregando(false);
    }
  }, []);

  // Carregar dados do explorador TSE
  const carregarExploradorTse = useCallback(async () => {
    setCarregandoTse(true);
    const supabase = createClient();

    try {
      if (abaTse === "carteira") {
        // Trazer mandatos vinculados no sistema com seus dados de candidatura
        const { data: mandatos } = await supabase
          .from("dim_mandato")
          .select("id_mandato, nm_urna, dim_contratante(sg_uf, nm_municipio), rel_mandato_candidatura(*)")
          .order("id_mandato", { ascending: false });

        const lista: ItemExploradorTse[] = [];

        if (mandatos) {
          for (const m of mandatos) {
            const rel = Array.isArray(m.rel_mandato_candidatura) && m.rel_mandato_candidatura.length > 0
              ? m.rel_mandato_candidatura[0]
              : null;

            if (rel) {
              const { data: resumo } = await supabase
                .schema("tse")
                .from("mv_candidatura_resumo")
                .select("qt_votos_total, ds_cargo, sg_partido, nm_municipio_principal")
                .eq("ano_eleicao", rel.ano_eleicao)
                .eq("sq_candidato", rel.sq_candidato)
                .maybeSingle();

              lista.push({
                idMandato: m.id_mandato,
                anoEleicao: rel.ano_eleicao,
                sqCandidato: rel.sq_candidato,
                nmUrna: m.nm_urna ?? "Mandato sem nome",
                sgUf: m.dim_contratante?.sg_uf ?? "—",
                nmMunicipio: resumo?.nm_municipio_principal ?? m.dim_contratante?.nm_municipio ?? "—",
                sgPartido: resumo?.sg_partido ?? "—",
                dsCargo: resumo?.ds_cargo ?? "—",
                qtVotosTotal: resumo?.qt_votos_total ?? undefined,
                ehCarteira: true,
              });
            } else {
              lista.push({
                idMandato: m.id_mandato,
                anoEleicao: 2024,
                sqCandidato: 0,
                nmUrna: m.nm_urna ?? "Mandato da Carteira",
                sgUf: m.dim_contratante?.sg_uf ?? "—",
                nmMunicipio: m.dim_contratante?.nm_municipio ?? "—",
                sgPartido: "—",
                dsCargo: "Mandato Registrado",
                ehCarteira: true,
              });
            }
          }
        }
        setItensTse(lista);
      } else {
        // Trazer candidaturas gerais do TSE no banco
        const { data: candidaturas } = await supabase
          .schema("tse")
          .from("mv_candidatura_resumo")
          .select("ano_eleicao, sq_candidato, nm_urna, sg_uf, nm_municipio_principal, sg_partido, ds_cargo, qt_votos_total")
          .limit(30);

        if (candidaturas) {
          const lista: ItemExploradorTse[] = candidaturas.map((c) => ({
            anoEleicao: c.ano_eleicao ?? 2024,
            sqCandidato: c.sq_candidato ?? 0,
            nmUrna: c.nm_urna ?? "—",
            sgUf: c.sg_uf ?? "—",
            nmMunicipio: c.nm_municipio_principal ?? "—",
            sgPartido: c.sg_partido ?? "—",
            dsCargo: c.ds_cargo ?? "—",
            qtVotosTotal: c.qt_votos_total ?? undefined,
            ehCarteira: false,
          }));
          setItensTse(lista);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados do TSE:", err);
    } finally {
      setCarregandoTse(false);
    }
  }, [abaTse]);

  useEffect(() => {
    void carregarDashboard();
  }, [carregarDashboard]);

  useEffect(() => {
    void carregarExploradorTse();
  }, [carregarExploradorTse]);

  const tseFiltrados = itensTse.filter((item) => {
    if (!buscaTse.trim()) return true;
    const q = buscaTse.toLowerCase();
    return (
      item.nmUrna.toLowerCase().includes(q) ||
      item.sgPartido.toLowerCase().includes(q) ||
      item.dsCargo.toLowerCase().includes(q) ||
      item.nmMunicipio.toLowerCase().includes(q) ||
      item.sgUf.toLowerCase().includes(q)
    );
  });

  if (carregando) {
    return (
      <div className="mx-auto grid max-w-6xl gap-6 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-28 w-full animate-pulse rounded-2xl bg-muted" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-6 animate-in fade-in duration-300">
      <Breadcrumbs items={[{ label: "Painel Principal" }]} />

      {/* Header de Boas-Vindas Redesenho Tipográfico Elegante */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-2xl border border-border/60 bg-gradient-to-r from-card via-card to-primary/5 p-6 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading tracking-tight text-foreground">
              {saudacao}, <span className="text-primary">{data?.usuarioNome}</span>! 👋
            </h1>
            <Badge
              variant="outline"
              className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[11px]"
            >
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sessão Ativa
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl">
            Central de comando político e inteligência eleitoral. Gerencie mandatos, contratos, equipes e estatísticas do TSE.
          </p>
        </div>

        <Link href="/mandatos/novo">
          <Button size="lg" className="gap-2 font-semibold shadow-md active:scale-95 transition-all">
            <Plus className="size-5" />
            Novo Contrato / Mandato
          </Button>
        </Link>
      </div>

      {/* LANDING PAGE - BOTÕES GRANDES DE AÇÕES RAPIDAS */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ações Rápidas & Gestão Principal
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/mandatos/novo" className="group">
            <Card className="h-full border border-border/60 shadow-sm transition-all hover:border-primary/50 hover:shadow-md group-hover:-translate-y-0.5">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Plus className="size-6" />
                  </div>
                  <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-heading text-lg font-bold text-foreground">Novo Contrato</h3>
                  <p className="text-xs text-muted-foreground">Cadastrar novo mandato ou coalizão com contrato</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/mandatos" className="group">
            <Card className="h-full border border-border/60 shadow-sm transition-all hover:border-emerald-500/50 hover:shadow-md group-hover:-translate-y-0.5">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Landmark className="size-6" />
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">{data?.totalMandatos} ativos</Badge>
                </div>
                <div className="space-y-1">
                  <h3 className="font-heading text-lg font-bold text-foreground">Mandatos</h3>
                  <p className="text-xs text-muted-foreground">Fichas de parlamentares, executivo e perfil TSE</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/coalizoes" className="group">
            <Card className="h-full border border-border/60 shadow-sm transition-all hover:border-amber-500/50 hover:shadow-md group-hover:-translate-y-0.5">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                    <Handshake className="size-6" />
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">{data?.totalCoalizoes} ativas</Badge>
                </div>
                <div className="space-y-1">
                  <h3 className="font-heading text-lg font-bold text-foreground">Coalizões</h3>
                  <p className="text-xs text-muted-foreground">Federações, alianças e projetos estratégicos</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/usuarios" className="group">
            <Card className="h-full border border-border/60 shadow-sm transition-all hover:border-purple-500/50 hover:shadow-md group-hover:-translate-y-0.5">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                    <Users2 className="size-6" />
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">{data?.totalUsuarios} usuários</Badge>
                </div>
                <div className="space-y-1">
                  <h3 className="font-heading text-lg font-bold text-foreground">Usuários</h3>
                  <p className="text-xs text-muted-foreground">Controle de equipe, permissões e papéis</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* SEÇÃO REQUISITADA: EXPLORADOR INTELIGENTE DE DADOS DO TSE */}
      <Card className="border border-border/60 shadow-sm">
        <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Vote className="size-4 text-emerald-600 dark:text-emerald-400" /> Explorador de Inteligência do TSE
            </CardTitle>
            <CardDescription className="text-xs">
              Navegue pelos dados de candidaturas e votos gravados no seu banco de dados
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Alternar abas */}
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAbaTse("carteira")}
                className={`px-3 py-1 rounded-md transition-all ${
                  abaTse === "carteira"
                    ? "bg-card text-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Mandatos na Carteira
              </button>
              <button
                type="button"
                onClick={() => setAbaTse("todos")}
                className={`px-3 py-1 rounded-md transition-all ${
                  abaTse === "todos"
                    ? "bg-card text-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Todos do TSE no Banco
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Busca Instantânea */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por candidato, partido, cargo, cidade ou UF..."
              value={buscaTse}
              onChange={(e) => setBuscaTse(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          {/* Tabela de Candidatos do TSE */}
          {carregandoTse ? (
            <div className="h-36 animate-pulse rounded-lg bg-muted" />
          ) : tseFiltrados.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
              Nenhuma candidatura encontrada com os termos buscados.
            </div>
          ) : (
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Ano</TableHead>
                    <TableHead className="text-xs">Candidato / Urna</TableHead>
                    <TableHead className="text-xs">Cargo & Partido</TableHead>
                    <TableHead className="text-xs">UF / Município</TableHead>
                    <TableHead className="text-xs">Votos Apurados</TableHead>
                    <TableHead className="text-xs text-right">Origem / Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tseFiltrados.map((item, idx) => (
                    <TableRow key={`${item.sqCandidato}-${idx}`}>
                      <TableCell className="font-mono text-xs font-bold">{item.anoEleicao}</TableCell>
                      <TableCell className="font-bold text-xs text-foreground">
                        {item.nmUrna}
                      </TableCell>
                      <TableCell className="text-xs space-x-1">
                        <span className="font-semibold">{item.dsCargo}</span>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {item.sgPartido}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.sgUf} {item.nmMunicipio !== "—" ? `/ ${item.nmMunicipio}` : ""}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {item.qtVotosTotal != null ? item.qtVotosTotal.toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.ehCarteira && item.idMandato ? (
                          <Link href={`/mandatos/${item.idMandato}`}>
                            <Button variant="outline" size="sm" className="text-xs font-semibold h-7">
                              Abrir Mandato
                            </Button>
                          </Link>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            TSE Geral
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* BENTO GRID DASHBOARD: Visão Geral com Dados Reais do Banco */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bento Grid — Indicadores & Inteligência do Banco
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Perfil & Mandato Ativo */}
          <Card className="border border-border/60 shadow-sm flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Landmark className="size-4 text-primary" />
                  Perfil do Mandato Recente
                </CardTitle>
                {data?.ultimoMandato && (
                  <Badge variant="outline" className="font-mono text-xs">
                    ID #{data.ultimoMandato.idMandato}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Dados cadastrais de <code className="font-mono text-foreground font-semibold">dim_mandato</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm flex-1">
              {data?.ultimoMandato ? (
                <div className="space-y-2.5">
                  <div className="rounded-lg bg-muted/50 p-3 border border-border/40">
                    <p className="text-xs text-muted-foreground">Nome de Urna / Civil</p>
                    <p className="font-bold text-base text-foreground">{data.ultimoMandato.nomeUrna}</p>
                    {data.ultimoMandato.nomeCivil && data.ultimoMandato.nomeCivil !== data.ultimoMandato.nomeUrna && (
                      <p className="text-xs text-muted-foreground">Civil: {data.ultimoMandato.nomeCivil}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border p-2">
                      <span className="text-muted-foreground block">Partido Atual</span>
                      <span className="font-semibold text-foreground">{data.ultimoMandato.partido ?? "Não definido"}</span>
                    </div>
                    <div className="rounded-md border p-2">
                      <span className="text-muted-foreground block">Cargo Atual</span>
                      <span className="font-semibold text-foreground">{data.ultimoMandato.cargo ?? "Não definido"}</span>
                    </div>
                    <div className="rounded-md border p-2">
                      <span className="text-muted-foreground block">UF / Município</span>
                      <span className="font-semibold text-foreground">
                        {data.ultimoMandato.sgUf ?? "—"} {data.ultimoMandato.nmMunicipio ? `/ ${data.ultimoMandato.nmMunicipio}` : ""}
                      </span>
                    </div>
                    <div className="rounded-md border p-2">
                      <span className="text-muted-foreground block">Espectro Político</span>
                      <span className="font-semibold text-foreground">{data.ultimoMandato.espectroPolitico ?? "Não avaliado"}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Nenhum mandato cadastrado no banco.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Status do Contrato & Etapa */}
          <Card className="border border-border/60 shadow-sm flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="size-4 text-blue-600 dark:text-blue-400" />
                  Contrato & Etapa Operacional
                </CardTitle>
                {data?.ultimoContrato && (
                  <Badge
                    variant={data.ultimoContrato.status === "ativo" ? "default" : "secondary"}
                    className="capitalize text-xs font-mono"
                  >
                    {data.ultimoContrato.status}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Métricas da âncora <code className="font-mono text-foreground font-semibold">fat_contrato</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm flex-1">
              {data?.ultimoContrato ? (
                <div className="space-y-3">
                  <div className="rounded-lg bg-muted/50 p-3 border border-border/40 space-y-1">
                    <p className="text-xs text-muted-foreground">Produto Contratado</p>
                    <p className="font-bold text-base text-foreground">{data.ultimoContrato.produtoNome ?? "Não especificado"}</p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="size-3.5" /> Data de Início:
                      </span>
                      <span className="font-mono font-medium">{data.ultimoContrato.dtInicio}</span>
                    </div>

                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Clock className="size-3.5" /> Previsão Encerramento:
                      </span>
                      <span className="font-mono font-medium">{data.ultimoContrato.dtFimPrevista ?? "Contínuo"}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <BarChart3 className="size-3.5 text-purple-500" /> Etapa Atual ID:
                      </span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {data.ultimoContrato.etapaAtual ?? "Fase 1"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Nenhum contrato ativo registrado.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Dados TSE & Inteligência Eleitoral */}
          <Card className="border border-border/60 shadow-sm flex flex-col justify-between lg:col-span-1 md:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Vote className="size-4 text-emerald-600 dark:text-emerald-400" />
                  Inteligência TSE & Candidatura
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  tse.schema
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Sincronização de <code className="font-mono text-foreground font-semibold">rel_mandato_candidatura</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm flex-1">
              {data?.vinculoTse ? (
                <div className="space-y-3">
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" /> Vínculo Confirmado
                      </span>
                      <Badge className="bg-emerald-600 font-mono text-[10px]">{data.vinculoTse.anoEleicao}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      SQ Candidato: <code className="font-mono text-foreground">{data.vinculoTse.sqCandidato}</code>
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-muted-foreground">Método de Match:</span>
                      <span className="font-medium text-foreground">Título Eleitoral / Nome</span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-muted-foreground">Grau de Confiança:</span>
                      <Badge variant="secondary" className="font-mono text-[11px] uppercase">
                        {data.vinculoTse.confianca ?? "Alta"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status no TSE:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase text-xs">Deferido</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid justify-items-center gap-2 rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                  <Vote className="size-8 text-muted-foreground/50" />
                  <p>Nenhum vínculo TSE formalizado para o mandato mais recente.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

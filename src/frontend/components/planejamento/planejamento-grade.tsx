"use client";

import { createColumnHelper, flexRender, tableFeatures, useTable } from "@tanstack/react-table";
import { ChevronDown, ChevronRight, Flag, Target } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";

import type { MetaResumo, ObjetivoComMetas, PessoaVinculada, SucessoMensalGrade } from "@backend/queries/planejamento";
import { createClient } from "@backend/supabase/client";

import type { ModoPlanejamento, PermissoesModo } from "./permissoes";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { MetaForm } from "./meta-form";
import { ObjetivoForm } from "./objetivo-form";
import { SucessoMensalForm } from "./sucesso-mensal-form";

// PLR-09, PLR-10 (.specs/features/planejamento-estrategico-redesenho, T11).
// Substitui PlanejamentoArvore (pilha de <div> por Objetivo/Meta, com uma
// <Table> própria só pros Sucessos Mensais de cada Meta) por UMA árvore de
// verdade numa tabela só: Objetivo Específico -> Meta -> Sucesso Mensal, os
// 3 tipos de linha (obj/meta/sm) na mesma <table>, indentação progressiva
// por `nivel`, fundo distinto por tipo. Estado de expandido/recolhido
// centralizado (um único Set<string>), não mais um useState por nó.
//
// Colunas ainda fixas nesta task (T11) -- a matriz colunas-por-modo
// (Construir/Monitorar/Ler) chega em T12; aqui o objetivo é só a estrutura
// unificada. `modo`/`permissoes` já são recebidos como prop pra não trocar
// a assinatura de novo em T12.
//
// Edição/criação de Objetivo/Meta/Sucesso Mensal continua inline (mesmo
// padrão de PlanejamentoArvore) até a Fase 4 (T17-T19) trocar por modal --
// como agora é 1 tabela só, uma linha "em edição/criação" vira uma linha
// sintética full-width (`<td colSpan>`), não um <div> substituindo o nó.

const features = tableFeatures({});

type LinhaObj = { tipo: "obj"; id: string; nivel: 0; objetivo: ObjetivoComMetas };
type LinhaMeta = { tipo: "meta"; id: string; nivel: 1; meta: MetaResumo; pesoDivergente: boolean };
type LinhaSm = { tipo: "sm"; id: string; nivel: 2; linha: SucessoMensalGrade };
type LinhaForm = { tipo: "form"; id: string; nivel: 0 | 1 | 2; conteudo: React.ReactNode };
type LinhaArvore = LinhaObj | LinhaMeta | LinhaSm | LinhaForm;

const columnHelper = createColumnHelper<typeof features, LinhaArvore>();

type AcaoAtiva =
  | { tipo: "criar-objetivo" }
  | { tipo: "criar-meta"; idObjetivo: number }
  | { tipo: "criar-sucesso"; idMeta: number }
  | { tipo: "editar-objetivo"; objetivo: ObjetivoComMetas }
  | { tipo: "editar-meta"; meta: MetaResumo }
  | { tipo: "editar-sucesso"; sucesso: SucessoMensalGrade }
  | null;

export interface PlanejamentoGradeProps {
  idPlanejamento: number;
  produtoNome: string;
  objetivos: ObjetivoComMetas[];
  linhas: SucessoMensalGrade[];
  pessoasVinculadas: PessoaVinculada[];
  permissoes: PermissoesModo;
  modo: ModoPlanejamento;
  onEdicaoCelula: (idSucesso: number, pctAtingimento: number) => Promise<void>;
  onColarFaixa: (valores: { idSucesso: number; pctAtingimento: number }[]) => Promise<void>;
  onHierarquiaAlterada: () => void;
  onGradeAlterada: () => void;
  // somenteLeitura (Edge Case herdado de PlanejamentoArvore, "Coalizão sem
  // planejamento próprio"): a leitura agregada de cada membro nunca oferece
  // criação/edição -- é leitura, não a tela de gestão do próprio contrato.
  somenteLeitura?: boolean;
  // PLR-11 (T14/T15, PlanejamentoToolbar): filtros client-side sobre a árvore
  // já carregada -- nenhum round-trip novo ao banco.
  busca?: string;
  soPendentes?: boolean;
  // idUsuario logado -- "só as minhas metas" (T15) compara com
  // fat_meta.idUsuarioResponsavel.
  soMinhasMetas?: boolean;
  idUsuario?: number | null;
}

// PLR-11 (T14): expandir/recolher tudo é ação do PlanejamentoToolbar, que
// vive fora desta árvore -- imperative handle em vez de levantar o estado
// `expandidos` pro pai (evitaria controlar o Set inteiro de fora sem
// necessidade real de outro consumidor dele).
export interface PlanejamentoGradeHandle {
  expandirTudo: () => void;
  recolherTudo: () => void;
  // PLR-11: "+ Objetivo" mora no PlanejamentoToolbar (T14), mas a ação de
  // criar continua sendo o mesmo estado interno `acaoAtiva` desta árvore.
  criarObjetivo: () => void;
}

function formatarPct(valor: number | null): string {
  return valor == null ? "—" : `${valor}%`;
}

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  realizado: "Realizado",
  nao_realizado: "Não realizado",
};

const STATUS_VARIANT: Record<string, "secondary" | "default" | "outline"> = {
  pendente: "secondary",
  realizado: "default",
  nao_realizado: "outline",
};

/** AC4/PLM-04: valor deve estar em 0-100 -- réplica no cliente do ck_sucesso_pct. */
function validaPct(valorTexto: string): number | null {
  const valor = Number(valorTexto);
  if (valorTexto.trim() === "" || !Number.isFinite(valor) || valor < 0 || valor > 100) return null;
  return valor;
}

/**
 * PLR-10 (regra inegociável nº1 do pedido original): célula de % de Meta/
 * Objetivo é CALCULADA -- nunca pode parecer editável. Fundo hachurado real
 * (repeating-linear-gradient, não só cor sólida), marcador "fx" antes do
 * valor, tabIndex=-1 real (Tab nunca para aqui), sem handler de clique/foco.
 */
function CelulaCalculada({ valor }: { valor: number | null }) {
  return (
    <span
      tabIndex={-1}
      aria-readonly="true"
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-md border border-dashed border-muted-foreground/30 px-2 py-1 text-sm tabular-nums text-muted-foreground",
        "bg-[repeating-linear-gradient(135deg,transparent,transparent_4px,var(--muted)_4px,var(--muted)_8px)]"
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">fx</span>
      {formatarPct(valor)}
    </span>
  );
}

interface CelulaPctProps {
  linha: SucessoMensalGrade;
  erro: string | undefined;
  somenteLeitura: boolean;
  onCommit: (idSucesso: number, valorTexto: string) => void;
  onPasteInicio: (idSucesso: number, texto: string) => void;
}

function CelulaPct({ linha, erro, somenteLeitura, onCommit, onPasteInicio }: CelulaPctProps) {
  return (
    <div className="grid gap-1">
      <input
        type="number"
        min={0}
        max={100}
        step="0.01"
        defaultValue={linha.pctAtingimento ?? ""}
        disabled={somenteLeitura}
        className={cn(
          "w-24 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs outline-none",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          erro && "border-destructive focus-visible:ring-destructive/20"
        )}
        onBlur={(e) => onCommit(linha.idSucesso, e.currentTarget.value)}
        onPaste={(e) => {
          const texto = e.clipboardData.getData("text");
          if (/\r?\n/.test(texto.trim())) {
            e.preventDefault();
            onPasteInicio(linha.idSucesso, texto);
          }
        }}
        aria-invalid={Boolean(erro)}
        aria-label={`% Atingimento de ${linha.descricao}`}
      />
      {erro ? <p className="text-xs text-destructive">{erro}</p> : null}
    </div>
  );
}

export const PlanejamentoGrade = forwardRef<PlanejamentoGradeHandle, PlanejamentoGradeProps>(function PlanejamentoGrade(
  {
    idPlanejamento,
    produtoNome,
    objetivos,
    linhas,
    pessoasVinculadas,
    permissoes,
    modo,
    onEdicaoCelula,
    onColarFaixa,
    onHierarquiaAlterada,
    onGradeAlterada,
    somenteLeitura = false,
    busca = "",
    soPendentes = false,
    soMinhasMetas = false,
    idUsuario = null,
  },
  ref
) {
  const podeEditarEstrutura = !somenteLeitura && permissoes.crudHierarquia;
  // PLM-17: criar novo Sucesso Mensal é Gestora/Mentor/Admin -- Assessor
  // nunca (GRANT aprovado é só SELECT/UPDATE, sem INSERT, docs/schema_sistema.sql:2093).
  const podeCriarSucesso = !somenteLeitura && (permissoes.crudHierarquia || permissoes.editaPctTodasAsMetas);
  // PLM-18: abrir "Detalhes" pra editar peso/descrição/mês/prazo/status de um
  // Sucesso Mensal JÁ EXISTENTE -- isso o Assessor também pode, na sua
  // própria carteira (diferente de criar, PLM-17).
  const podeVerDetalhesSucesso = !somenteLeitura && (permissoes.editaPctTodasAsMetas || permissoes.editaPctSóMetasProprias);

  const [expandidos, setExpandidos] = useState<Set<string>>(
    () => new Set(objetivos.map((o) => `obj-${o.idObjetivo}`).concat(objetivos.flatMap((o) => o.metas.map((m) => `meta-${m.idMeta}`))))
  );
  const [acaoAtiva, setAcaoAtiva] = useState<AcaoAtiva>(null);
  const [erros, setErros] = useState<Record<number, string>>({});

  // T14: "expandir/recolher tudo" é ação do PlanejamentoToolbar (fora desta
  // árvore) -- exposta via ref em vez de levantar `expandidos` pro pai.
  useImperativeHandle(
    ref,
    () => ({
      expandirTudo: () =>
        setExpandidos(
          new Set(objetivos.map((o) => `obj-${o.idObjetivo}`).concat(objetivos.flatMap((o) => o.metas.map((m) => `meta-${m.idMeta}`))))
        ),
      recolherTudo: () => setExpandidos(new Set()),
      criarObjetivo: () => setAcaoAtiva({ tipo: "criar-objetivo" }),
    }),
    [objetivos]
  );

  const nomePorUsuario = useMemo(() => new Map(pessoasVinculadas.map((p) => [p.idUsuario, p.nome])), [pessoasVinculadas]);

  // PLR-08 (modo Construir): preditor/agenda são exibidos pelo nome, não
  // pelo id -- catálogos carregados uma vez (mesmo padrão de fetch client-side
  // já usado por ObjetivoForm/DadosPlanejamentoForm pros próprios Selects).
  const [nomePorPreditor, setNomePorPreditor] = useState<Map<number, string>>(new Map());
  const [nomePorAgenda, setNomePorAgenda] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    if (modo !== "construir") return;
    const supabase = createClient();
    supabase
      .from("ref_preditor")
      .select("id_preditor, nome")
      .then(({ data }) => setNomePorPreditor(new Map((data ?? []).map((p) => [p.id_preditor, p.nome]))));
    supabase
      .from("ref_agenda_tematica")
      .select("id_agenda, nome")
      .then(({ data }) => setNomePorAgenda(new Map((data ?? []).map((a) => [a.id_agenda, a.nome]))));
  }, [modo]);

  const linhasPorMeta = useMemo(() => {
    const mapa = new Map<number, SucessoMensalGrade[]>();
    for (const linha of linhas) {
      const lista = mapa.get(linha.idMeta) ?? [];
      lista.push(linha);
      mapa.set(linha.idMeta, lista);
    }
    return mapa;
  }, [linhas]);

  // Alerta de soma de peso != 100 (regra §5 nº5 do pedido original: validado
  // inline na linha da Meta, a cada digitação -- reativo sobre `linhas`, que
  // já reflete edição otimista). Só flagra Metas com >=1 Sucesso Mensal.
  const idsMetaComPesoDivergente = useMemo(() => {
    const somaPorMeta = new Map<number, number>();
    for (const linha of linhas) {
      somaPorMeta.set(linha.idMeta, (somaPorMeta.get(linha.idMeta) ?? 0) + linha.peso);
    }
    const divergentes = new Set<number>();
    for (const [idMeta, soma] of somaPorMeta) {
      if (Math.round(soma * 100) / 100 !== 100) divergentes.add(idMeta);
    }
    return divergentes;
  }, [linhas]);

  // Ordem visual real (Objetivo por Objetivo, Meta por Meta) -- é o que o
  // paste de faixa usa pra "respeitar a ordem visual da grade" (PLM-03/PLR-16),
  // não a ordem crua da prop `linhas`.
  const ordemVisual = useMemo(
    () => objetivos.flatMap((o) => o.metas.flatMap((m) => linhasPorMeta.get(m.idMeta) ?? [])),
    [objetivos, linhasPorMeta]
  );

  const alternar = useCallback((id: string) => {
    setExpandidos((atual) => {
      const copia = new Set(atual);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });
  }, []);

  const limparErro = useCallback((idSucesso: number) => {
    setErros((atual) => {
      if (!(idSucesso in atual)) return atual;
      const copia = { ...atual };
      delete copia[idSucesso];
      return copia;
    });
  }, []);

  const handleCommitCelula = useCallback(
    (idSucesso: number, valorTexto: string) => {
      const pct = validaPct(valorTexto);
      if (pct === null) {
        setErros((atual) => ({ ...atual, [idSucesso]: "Valor deve estar entre 0 e 100." }));
        return;
      }
      limparErro(idSucesso);
      void onEdicaoCelula(idSucesso, pct);
    },
    [onEdicaoCelula, limparErro]
  );

  const handlePasteInicio = useCallback(
    (idSucessoInicial: number, texto: string) => {
      const indiceInicial = ordemVisual.findIndex((l) => l.idSucesso === idSucessoInicial);
      if (indiceInicial === -1) return;

      const valoresColados = texto
        .split(/\r?\n/)
        .map((v) => v.trim())
        .filter((v) => v !== "");

      const atualizacoes: { idSucesso: number; pctAtingimento: number }[] = [];
      const errosNovos: Record<number, string> = {};

      valoresColados.forEach((valorTexto, offset) => {
        const alvo = ordemVisual[indiceInicial + offset];
        if (!alvo) return;
        const pct = validaPct(valorTexto);
        if (pct === null) {
          errosNovos[alvo.idSucesso] = "Valor deve estar entre 0 e 100.";
          return;
        }
        atualizacoes.push({ idSucesso: alvo.idSucesso, pctAtingimento: pct });
      });

      if (Object.keys(errosNovos).length > 0) {
        setErros((atual) => ({ ...atual, ...errosNovos }));
        return;
      }
      if (atualizacoes.length === 0) return;

      for (const { idSucesso } of atualizacoes) limparErro(idSucesso);
      void onColarFaixa(atualizacoes);
    },
    [ordemVisual, onColarFaixa, limparErro]
  );

  function fecharAcao() {
    setAcaoAtiva(null);
  }

  // T14/T15 (PlanejamentoToolbar): busca/só pendentes/só minhas metas são
  // filtros client-side sobre a árvore já carregada -- nenhuma query nova.
  // Enquanto algum filtro está ativo, todo nó com filho visível se comporta
  // como "expandido" independente de `expandidos` (busca revela onde o
  // resultado está, mesmo que o ramo estivesse recolhido) -- ao limpar os
  // filtros, o estado de expansão manual volta a valer exatamente como
  // estava antes.
  const filtrosAtivos = busca.trim() !== "" || soPendentes || soMinhasMetas;
  const buscaLower = busca.trim().toLowerCase();

  const smPassaSoPendentes = useCallback((sm: SucessoMensalGrade) => !soPendentes || sm.pctAtingimento == null, [soPendentes]);

  // Monta a lista achatada (T11): 1 linha por Objetivo/Meta/Sucesso Mensal,
  // na ordem visual, respeitando `expandidos`; injeta linhas sintéticas
  // "form" (criar/editar) na posição correta -- ver comentário de topo.
  const linhasArvore = useMemo<LinhaArvore[]>(() => {
    const resultado: LinhaArvore[] = [];

    if (acaoAtiva?.tipo === "criar-objetivo") {
      resultado.push({
        tipo: "form",
        id: "form-criar-objetivo",
        nivel: 0,
        conteudo: (
          <ObjetivoForm
            modo={{ tipo: "criar", idPlanejamento }}
            onConcluido={() => {
              fecharAcao();
              onHierarquiaAlterada();
            }}
            onCancelar={fecharAcao}
          />
        ),
      });
    }

    for (const objetivo of objetivos) {
      const idObj = `obj-${objetivo.idObjetivo}`;

      if (acaoAtiva?.tipo === "editar-objetivo" && acaoAtiva.objetivo.idObjetivo === objetivo.idObjetivo) {
        resultado.push({
          tipo: "form",
          id: `form-${idObj}`,
          nivel: 0,
          conteudo: (
            <ObjetivoForm
              modo={{ tipo: "editar", objetivo }}
              onConcluido={() => {
                fecharAcao();
                onHierarquiaAlterada();
              }}
              onCancelar={fecharAcao}
            />
          ),
        });
        continue;
      }

      // Pré-filtra as Metas deste Objetivo antes de decidir se o próprio
      // Objetivo é visível -- um Objetivo sem nenhuma Meta que passe nos
      // filtros ativos fica fora da lista inteira (não só recolhido).
      const metasFiltradas = objetivo.metas.filter((meta) => {
        if (soMinhasMetas && meta.idUsuarioResponsavel !== idUsuario) return false;
        if (!buscaLower) return true;
        const metaTextoMatch = meta.descricao.toLowerCase().includes(buscaLower);
        const smDaMeta = (linhasPorMeta.get(meta.idMeta) ?? []).filter(smPassaSoPendentes);
        const algumSmTextoMatch = smDaMeta.some((sm) => sm.descricao.toLowerCase().includes(buscaLower));
        return metaTextoMatch || algumSmTextoMatch;
      });

      if (filtrosAtivos && metasFiltradas.length === 0 && !objetivo.descricao.toLowerCase().includes(buscaLower)) continue;

      resultado.push({ tipo: "obj", id: idObj, nivel: 0, objetivo });
      if (!filtrosAtivos && !expandidos.has(idObj)) continue;

      for (const meta of filtrosAtivos ? metasFiltradas : objetivo.metas) {
        const idMeta = `meta-${meta.idMeta}`;

        if (acaoAtiva?.tipo === "editar-meta" && acaoAtiva.meta.idMeta === meta.idMeta) {
          resultado.push({
            tipo: "form",
            id: `form-${idMeta}`,
            nivel: 1,
            conteudo: (
              <MetaForm
                modo={{ tipo: "editar", meta }}
                produtoNome={produtoNome}
                pessoasVinculadas={pessoasVinculadas}
                onConcluido={() => {
                  fecharAcao();
                  onHierarquiaAlterada();
                }}
                onCancelar={fecharAcao}
              />
            ),
          });
          continue;
        }

        resultado.push({
          tipo: "meta",
          id: idMeta,
          nivel: 1,
          meta,
          pesoDivergente: idsMetaComPesoDivergente.has(meta.idMeta),
        });
        if (!filtrosAtivos && !expandidos.has(idMeta)) continue;

        const smDaMeta = (linhasPorMeta.get(meta.idMeta) ?? []).filter(smPassaSoPendentes);
        for (const sm of smDaMeta) {
          if (acaoAtiva?.tipo === "editar-sucesso" && acaoAtiva.sucesso.idSucesso === sm.idSucesso) {
            resultado.push({
              tipo: "form",
              id: `form-sm-${sm.idSucesso}`,
              nivel: 2,
              conteudo: (
                <SucessoMensalForm
                  modo={{ tipo: "editar", sucesso: sm }}
                  onConcluido={() => {
                    fecharAcao();
                    onGradeAlterada();
                  }}
                  onCancelar={fecharAcao}
                />
              ),
            });
            continue;
          }
          resultado.push({ tipo: "sm", id: `sm-${sm.idSucesso}`, nivel: 2, linha: sm });
        }

        if (acaoAtiva?.tipo === "criar-sucesso" && acaoAtiva.idMeta === meta.idMeta) {
          resultado.push({
            tipo: "form",
            id: `form-criar-sucesso-${meta.idMeta}`,
            nivel: 2,
            conteudo: (
              <SucessoMensalForm
                modo={{ tipo: "criar", idMeta: meta.idMeta }}
                onConcluido={() => {
                  fecharAcao();
                  onGradeAlterada();
                }}
                onCancelar={fecharAcao}
              />
            ),
          });
        }
      }

      if (acaoAtiva?.tipo === "criar-meta" && acaoAtiva.idObjetivo === objetivo.idObjetivo) {
        resultado.push({
          tipo: "form",
          id: `form-criar-meta-${objetivo.idObjetivo}`,
          nivel: 1,
          conteudo: (
            <MetaForm
              modo={{ tipo: "criar", idObjetivo: objetivo.idObjetivo }}
              produtoNome={produtoNome}
              pessoasVinculadas={pessoasVinculadas}
              onConcluido={() => {
                fecharAcao();
                onHierarquiaAlterada();
              }}
              onCancelar={fecharAcao}
            />
          ),
        });
      }
    }

    return resultado;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fecharAcao/onHierarquiaAlterada/onGradeAlterada são estáveis o bastante pro propósito (fechamento de linha sintética); incluir todos os callbacks só adiciona ruído sem mudar comportamento.
  }, [
    objetivos,
    linhasPorMeta,
    expandidos,
    acaoAtiva,
    idsMetaComPesoDivergente,
    idPlanejamento,
    produtoNome,
    pessoasVinculadas,
    filtrosAtivos,
    buscaLower,
    soMinhasMetas,
    idUsuario,
    smPassaSoPendentes,
  ]);

  const todasAsColunas = useMemo(
    () => [
      columnHelper.display({
        id: "arvore",
        header: "Objetivo / Meta / Sucesso Mensal",
        cell: ({ row }) => {
          const item = row.original;
          if (item.tipo === "form") return null;

          const idNo = item.tipo === "obj" ? `obj-${item.objetivo.idObjetivo}` : item.tipo === "meta" ? `meta-${item.meta.idMeta}` : null;
          const temFilhos = item.tipo !== "sm";
          const aberto = idNo ? expandidos.has(idNo) : false;
          const descricao = item.tipo === "obj" ? item.objetivo.descricao : item.tipo === "meta" ? item.meta.descricao : item.linha.descricao;
          const Icone = item.tipo === "obj" ? Target : item.tipo === "meta" ? Flag : null;

          return (
            <div className="flex items-center gap-1.5" style={{ paddingLeft: `${item.nivel * 1.5}rem` }}>
              {temFilhos && idNo ? (
                <button
                  type="button"
                  onClick={() => alternar(idNo)}
                  aria-expanded={aberto}
                  aria-label={aberto ? "Recolher" : "Expandir"}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  {aberto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
              ) : (
                <span className="size-4 shrink-0" />
              )}
              {Icone && <Icone className="size-4 shrink-0 text-muted-foreground" />}
              <span className={cn("truncate", item.tipo === "obj" && "font-medium")}>{descricao}</span>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: "responsavel",
        header: "Responsável",
        cell: ({ row }) => {
          const item = row.original;
          if (item.tipo !== "meta") return null;
          const nome = item.meta.idUsuarioResponsavel != null ? nomePorUsuario.get(item.meta.idUsuarioResponsavel) : null;
          return <span className="text-sm text-muted-foreground">{nome ?? "—"}</span>;
        },
      }),
      // PLR-08, modo Construir: preditor 1º/2º, agenda, prioridade, classe --
      // leitura (edição continua via "Editar", que abre ObjetivoForm/MetaForm
      // completos) -- ver tasks.md T12 pra rationale do corte de escopo.
      columnHelper.display({
        id: "preditor1",
        header: "Preditor 1º",
        cell: ({ row }) => {
          const item = row.original;
          const idPreditor = item.tipo === "obj" ? item.objetivo.idPreditorPrimario : item.tipo === "meta" ? item.meta.idPreditorPrimario : null;
          if (item.tipo === "sm") return null;
          return <span className="text-sm">{idPreditor != null ? (nomePorPreditor.get(idPreditor) ?? "—") : "—"}</span>;
        },
      }),
      columnHelper.display({
        id: "preditor2",
        header: "Preditor 2º",
        cell: ({ row }) => {
          const item = row.original;
          const idPreditor = item.tipo === "obj" ? item.objetivo.idPreditorSecundario : item.tipo === "meta" ? item.meta.idPreditorSecundario : null;
          if (item.tipo === "sm") return null;
          return <span className="text-sm">{idPreditor != null ? (nomePorPreditor.get(idPreditor) ?? "—") : "—"}</span>;
        },
      }),
      columnHelper.display({
        id: "agenda",
        header: "Agenda temática",
        cell: ({ row }) => {
          const item = row.original;
          const idAgenda = item.tipo === "obj" ? item.objetivo.idAgenda : item.tipo === "meta" ? item.meta.idAgenda : null;
          if (item.tipo === "sm") return null;
          return <span className="text-sm">{idAgenda != null ? (nomePorAgenda.get(idAgenda) ?? "—") : "—"}</span>;
        },
      }),
      columnHelper.display({
        id: "prioridade",
        header: "Prioridade",
        cell: ({ row }) => {
          const item = row.original;
          if (item.tipo !== "meta") return null;
          return <span className="text-sm capitalize">{item.meta.prioridade ?? "—"}</span>;
        },
      }),
      columnHelper.display({
        id: "classe",
        header: "Classe",
        cell: ({ row }) => {
          const item = row.original;
          if (item.tipo !== "meta") return null;
          return <span className="text-sm capitalize">{item.meta.classe ?? "—"}</span>;
        },
      }),
      columnHelper.display({
        id: "mes",
        header: "Mês",
        cell: ({ row }) => {
          const item = row.original;
          if (item.tipo !== "sm") return null;
          return <span className="text-sm tabular-nums text-muted-foreground">{item.linha.mesReferencia}</span>;
        },
      }),
      columnHelper.display({
        id: "dataLimite",
        header: "Data limite",
        cell: ({ row }) => {
          const item = row.original;
          if (item.tipo !== "sm") return null;
          return <span className="text-sm tabular-nums text-muted-foreground">{item.linha.dtLimite ?? "—"}</span>;
        },
      }),
      columnHelper.display({
        id: "peso",
        header: "Peso",
        cell: ({ row }) => {
          const item = row.original;
          if (item.tipo !== "sm") return null;
          return <span className="text-sm tabular-nums">{item.linha.peso}%</span>;
        },
      }),
      columnHelper.display({
        id: "pct",
        header: "% Atingimento",
        cell: ({ row }) => {
          const item = row.original;
          if (item.tipo === "obj") return <CelulaCalculada valor={item.objetivo.pctAtingimento} />;
          if (item.tipo === "meta") return <CelulaCalculada valor={item.meta.pctAtingimento} />;
          if (item.tipo === "sm") {
            // A permissão de escrita real é decidida pela RLS/GRANT do banco
            // (PLM-05/06), não aqui -- "a UI reflete a RLS; ela não é o
            // mecanismo de segurança" (regra §4 do pedido original). O único
            // gate de UI é `somenteLeitura` (Coalizão sem planejamento
            // próprio, leitura agregada) -- um Assessor tentando editar SM
            // fora da sua carteira recebe 42501 da própria escrita, tratado
            // como toast (mesmo padrão de handleEdicaoCelula/handleColarFaixa).
            return (
              <CelulaPct
                linha={item.linha}
                erro={erros[item.linha.idSucesso]}
                somenteLeitura={somenteLeitura}
                onCommit={handleCommitCelula}
                onPasteInicio={handlePasteInicio}
              />
            );
          }
          return null;
        },
      }),
      columnHelper.display({
        id: "situacao",
        header: "Situação",
        cell: ({ row }) => {
          const item = row.original;
          if (item.tipo === "meta" && item.pesoDivergente) {
            return (
              <Badge variant="destructive" title="A soma dos pesos dos Sucessos Mensais desta Meta não fecha 100">
                Peso ≠ 100
              </Badge>
            );
          }
          if (item.tipo === "meta" && item.meta.status !== "ativa") {
            return <Badge variant="secondary">{item.meta.status}</Badge>;
          }
          if (item.tipo === "sm") {
            return (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={STATUS_VARIANT[item.linha.status] ?? "secondary"}>
                  {STATUS_LABEL[item.linha.status] ?? item.linha.status}
                </Badge>
                {item.linha.estaAtrasado && <Badge variant="destructive">{item.linha.diasAtraso}d atraso</Badge>}
              </div>
            );
          }
          return null;
        },
      }),
      columnHelper.display({
        id: "acoes",
        header: "",
        cell: ({ row }) => {
          const item = row.original;
          if (somenteLeitura || acaoAtiva) return null;
          if (item.tipo === "obj") {
            return (
              <div className="flex items-center gap-1">
                {podeEditarEstrutura && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAcaoAtiva({ tipo: "editar-objetivo", objetivo: item.objetivo })}>
                    Editar
                  </Button>
                )}
                {podeEditarEstrutura && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAcaoAtiva({ tipo: "criar-meta", idObjetivo: item.objetivo.idObjetivo })}>
                    + Meta
                  </Button>
                )}
              </div>
            );
          }
          if (item.tipo === "meta") {
            return (
              <div className="flex items-center gap-1">
                {podeEditarEstrutura && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAcaoAtiva({ tipo: "editar-meta", meta: item.meta })}>
                    Editar
                  </Button>
                )}
                {podeCriarSucesso && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAcaoAtiva({ tipo: "criar-sucesso", idMeta: item.meta.idMeta })}>
                    + Sucesso
                  </Button>
                )}
              </div>
            );
          }
          if (item.tipo === "sm" && podeVerDetalhesSucesso) {
            return (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAcaoAtiva({ tipo: "editar-sucesso", sucesso: item.linha })}>
                Detalhes
              </Button>
            );
          }
          return null;
        },
      }),
    ],
    [
      expandidos,
      alternar,
      nomePorUsuario,
      nomePorPreditor,
      nomePorAgenda,
      erros,
      somenteLeitura,
      podeCriarSucesso,
      podeVerDetalhesSucesso,
      podeEditarEstrutura,
      acaoAtiva,
      handleCommitCelula,
      handlePasteInicio,
    ]
  );

  // PLR-08: matriz colunas-por-modo (design.md) -- Construir mostra os
  // atributos da hierarquia (preditores/agenda/prioridade/classe/mês),
  // Monitorar mostra o dia a dia da grade (data limite + % editável +
  // situação), Ler é a versão consolidada só-leitura. `responsavel` some
  // por completo pra quem não tem `veColunaResponsavel` (Assessor), em
  // qualquer modo. `preditor2` some no PLL (fat_meta.id_preditor_secundario
  // só existe pra Estratégia/Coalizão, docs/schema_sistema.sql:953).
  const colunasVisiveisPorModo: Record<string, boolean> = {
    arvore: true,
    responsavel: permissoes.veColunaResponsavel,
    preditor1: modo === "construir",
    preditor2: modo === "construir" && produtoNome !== "PLL",
    agenda: modo === "construir",
    prioridade: modo === "construir",
    classe: modo === "construir",
    mes: modo === "construir" || modo === "ler",
    dataLimite: modo === "monitorar",
    peso: true,
    pct: modo !== "construir",
    situacao: modo !== "construir",
    acoes: true,
  };
  const columns = useMemo(
    () => todasAsColunas.filter((coluna) => colunasVisiveisPorModo[coluna.id ?? ""] !== false),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- colunasVisiveisPorModo é recriado a cada render (objeto literal), mas só os valores primitivos abaixo importam pra decidir o filtro.
    [todasAsColunas, modo, permissoes.veColunaResponsavel, produtoNome]
  );

  const table = useTable({ features, columns, data: linhasArvore });

  if (objetivos.length === 0) {
    return <EstadoVazio titulo="Nenhum Objetivo Específico cadastrado ainda" />;
  }

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => {
              const item = row.original;
              if (item.tipo === "form") {
                return (
                  <TableRow key={row.id}>
                    <TableCell colSpan={columns.length} className="bg-muted/20 p-3">
                      {item.conteudo}
                    </TableCell>
                  </TableRow>
                );
              }
              return (
                <TableRow
                  key={row.id}
                  className={cn(
                    item.tipo === "obj" && "bg-background font-medium",
                    item.tipo === "meta" && "bg-muted/10",
                    item.tipo === "sm" && "bg-muted/30"
                  )}
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

    </div>
  );
});

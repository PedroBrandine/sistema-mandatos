"use client";

import { createColumnHelper, flexRender, tableFeatures, useTable } from "@tanstack/react-table";
import { ChevronDown, ChevronRight, Flag, History, Loader2, Target } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";

import type { MetaResumo, ObjetivoComMetas, PessoaVinculada, SucessoMensalGrade } from "@backend/queries/planejamento";
import { createClient } from "@backend/supabase/client";

import type { ModoPlanejamento, PermissoesModo } from "./permissoes";

import { normalizaEntradaPct } from "@/lib/planejamento-formato";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { ModalDetalheItem } from "./modal-detalhe-item";
import { ModalHistorico } from "./modal-historico";
import { useUndoPlanejamento } from "./use-undo-planejamento";

// PLR-09, PLR-10 (.specs/features/planejamento-estrategico-redesenho, T11).
// Substitui PlanejamentoArvore (pilha de <div> por Objetivo/Meta, com uma
// <Table> própria só pros Sucessos Mensais de cada Meta) por UMA árvore de
// verdade numa tabela só: Objetivo Específico -> Meta -> Sucesso Mensal, os
// 3 tipos de linha (obj/meta/sm) na mesma <table>, indentação progressiva
// por `nivel`, fundo distinto por tipo. Estado de expandido/recolhido
// centralizado (um único Set<string>), não mais um useState por nó.
//
// PLR-12/13/14 (T19): edição/criação de Objetivo/Meta/Sucesso Mensal e o
// histórico de auditoria abrem em modal (ModalDetalheItem/ModalHistorico),
// não mais como linha inline -- só 1 dos 2 pode estar aberto por vez (2
// useState distintos, nunca os dois setados juntos, ver handlers abaixo).

const features = tableFeatures({});

type LinhaObj = { tipo: "obj"; id: string; nivel: 0; objetivo: ObjetivoComMetas };
type LinhaMeta = { tipo: "meta"; id: string; nivel: 1; meta: MetaResumo; pesoDivergente: boolean };
type LinhaSm = { tipo: "sm"; id: string; nivel: 2; linha: SucessoMensalGrade };
type LinhaArvore = LinhaObj | LinhaMeta | LinhaSm;

const columnHelper = createColumnHelper<typeof features, LinhaArvore>();

// Exportado pra ModalDetalheItem (T17/T19) reusar a mesma forma -- 1 fonte
// de verdade do que "editar/criar item da hierarquia" significa.
export type AcaoAtiva =
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
  // Success Criteria (spec.md "Limpar uma célula de % grava NULL"): `null`
  // é "apagar o valor", nunca erro de validação -- ver handleCommitCelula.
  // PLR-19: a Promise DEVE rejeitar em erro de escrita (nunca engolir e
  // resolver como sucesso) -- é o sinal que esta árvore usa pra reverter o
  // valor otimista exibido na célula.
  onEdicaoCelula: (idSucesso: number, pctAtingimento: number | null) => Promise<void>;
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
  // PLR-17 (T22, PlanejamentoToolbar): a toolbar só precisa saber QUANTAS
  // células estão marcadas (pra mostrar "Aplicar aos N selecionados") -- o
  // `Set` inteiro continua vivendo aqui, fonte única do estilo "marcada".
  onSelecaoMudou?: (quantidade: number) => void;
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
  // PLR-17 (T22): aplica `valor` a todas as células marcadas via shift+clique,
  // reusando o mesmo caminho de escrita em lote do paste de faixa (PLM-03/
  // AD-024 -- N updates soltos deixariam estado parcial se um falhasse).
  aplicarEmMassa: (valor: number) => void;
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
  // PLR-19: em voo (onCommit/onPasteInicio/aplicarEmMassa/undo já
  // dispararam a escrita, resposta do servidor ainda não chegou) -- desabilita
  // a célula (evita 2ª escrita concorrente na mesma) e mostra o spinner.
  salvando: boolean;
  onCommit: (idSucesso: number, valorTexto: string) => void;
  onPasteInicio: (idSucesso: number, texto: string) => void;
  // PLR-15 (T20): ids na ordem visual da árvore -- só assim `ArrowDown`/
  // `ArrowUp`/`Home`/`End` sabem pra qual célula ir (não há outra estrutura
  // de "próxima linha" numa lista achatada por Objetivo/Meta).
  ordemVisualIds: number[];
  // PLR-17 (T22): shift+clique marca/desmarca a célula pra edição em massa.
  marcada: boolean;
  onAlternarMarcada: (idSucesso: number) => void;
}

function idCampoPct(idSucesso: number): string {
  return `planejamento-pct-${idSucesso}`;
}

function CelulaPct({
  linha,
  erro,
  somenteLeitura,
  salvando,
  onCommit,
  onPasteInicio,
  ordemVisualIds,
  marcada,
  onAlternarMarcada,
}: CelulaPctProps) {
  return (
    <div className="grid gap-1">
      <div className="relative w-fit">
        <input
          id={idCampoPct(linha.idSucesso)}
          // PLR-16 (T21): `type="text"` + `inputMode="decimal"` -- um
          // `type="number"` nativo rejeita vírgula e `%` tanto na digitação
          // quanto no paste, antes de `normalizaEntradaPct` sequer rodar.
          type="text"
          inputMode="decimal"
          defaultValue={linha.pctAtingimento ?? ""}
          disabled={somenteLeitura || salvando}
          aria-busy={salvando}
          className={cn(
            "w-24 rounded-md border border-input bg-transparent px-2 py-1 pr-6 text-sm shadow-xs outline-none",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            erro && "border-destructive focus-visible:ring-destructive/20",
            marcada && "ring-2 ring-primary border-primary",
            salvando && "opacity-60"
          )}
          // PLR-17 (T22): shift+clique marca/desmarca sem impedir o foco normal
          // (o clique continua focando a célula pra edição de teclado também).
          onClick={(e) => {
            if (e.shiftKey) onAlternarMarcada(linha.idSucesso);
          }}
          onBlur={(e) => onCommit(linha.idSucesso, e.currentTarget.value)}
          onPaste={(e) => {
            const texto = e.clipboardData.getData("text");
            // Sempre nós decidimos o valor final (nunca o paste bruto do
            // browser) -- faixa (múltiplas linhas) vai pro split de T21/PLM-03;
            // valor único passa pelo mesmo caminho de commit da digitação
            // manual, só que a partir do texto colado em vez do teclado.
            e.preventDefault();
            if (/\r?\n/.test(texto.trim())) {
              onPasteInicio(linha.idSucesso, texto);
              return;
            }
            const pct = normalizaEntradaPct(texto);
            e.currentTarget.value = pct != null ? String(pct) : texto;
            onCommit(linha.idSucesso, texto);
          }}
          onKeyDown={(e) => {
            // PLR-15: Tab já funciona nativamente (ordem do DOM) -- estes 4
            // casos são os únicos que precisam de handler explícito.
            if (e.key === "Escape") {
              e.currentTarget.value = String(linha.pctAtingimento ?? "");
              return;
            }
            const indiceAtual = ordemVisualIds.indexOf(linha.idSucesso);
            if (indiceAtual === -1) return;
            let alvo: number | undefined;
            if (e.key === "Enter" || e.key === "ArrowDown") alvo = ordemVisualIds[indiceAtual + 1];
            else if (e.key === "ArrowUp") alvo = ordemVisualIds[indiceAtual - 1];
            else if (e.key === "Home") alvo = ordemVisualIds[0];
            else if (e.key === "End") alvo = ordemVisualIds[ordemVisualIds.length - 1];
            else return;
            e.preventDefault();
            if (alvo != null) document.getElementById(idCampoPct(alvo))?.focus();
          }}
          aria-invalid={Boolean(erro)}
          aria-label={`% Atingimento de ${linha.descricao}`}
        />
        {salvando && (
          <Loader2
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        )}
      </div>
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
    onSelecaoMudou,
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
  // PLR-13/14: histórico é um estado independente de `acaoAtiva` -- os 2
  // nunca abrem juntos na prática (cada botão seta só o seu), mas mantê-los
  // separados evita que abrir um precise saber fechar o outro.
  const [historicoAlvo, setHistoricoAlvo] = useState<{ tabela: string; idRegistro: number; titulo: string } | null>(null);
  const [erros, setErros] = useState<Record<number, string>>({});
  // PLR-17 (T22): células marcadas via shift+clique, pra aplicar 1 valor a
  // todas de uma vez (toolbar). Vive aqui (não no pai) -- é a mesma árvore
  // que decide o estilo visual "marcada" célula a célula.
  const [celulasMarcadas, setCelulasMarcadas] = useState<Set<number>>(new Set());
  // PLR-19: células com uma escrita em voo (célula única, faixa colada,
  // massa ou undo) -- CelulaPct usa pra mostrar o spinner/desabilitar
  // durante o request. Um único Set aqui (não por caminho de escrita)
  // porque o indicador visual é o mesmo não importa QUAL ação disparou a
  // escrita.
  const [celulasSalvando, setCelulasSalvando] = useState<Set<number>>(new Set());

  const alternarMarcada = useCallback(
    (idSucesso: number) => {
      setCelulasMarcadas((atual) => {
        const copia = new Set(atual);
        if (copia.has(idSucesso)) copia.delete(idSucesso);
        else copia.add(idSucesso);
        return copia;
      });
    },
    []
  );

  // Notifica o pai (contador "N selecionadas" da toolbar) fora do updater de
  // `setCelulasMarcadas` -- updater precisa ser puro, o callback do pai não.
  useEffect(() => {
    onSelecaoMudou?.(celulasMarcadas.size);
  }, [celulasMarcadas, onSelecaoMudou]);

  // PLR-18 (T23): valor ANTES da edição -- é o que o undo precisa gravar de
  // volta. Lido de `linhas` (a prop, sempre o estado confirmado mais
  // recente) no momento do commit, nunca guardado com antecedência. Fica
  // aqui (antes do `useImperativeHandle` abaixo) porque `aplicarEmMassa`
  // também precisa dele.
  const pctAtualPorId = useMemo(() => new Map(linhas.map((l) => [l.idSucesso, l.pctAtingimento])), [linhas]);

  // PLR-19: envelope único de "salvamento otimista com reversão em erro",
  // usado pelos 4 caminhos de escrita desta árvore (célula única, faixa
  // colada, massa, undo) -- `celulasSalvando` liga o spinner/desabilita a
  // célula durante o request; em erro, cada `<input>` (descontrolado,
  // `defaultValue`) volta a mostrar `valoresAnteriores` via DOM direto --
  // não há outro jeito de reverter visualmente um valor que o próprio
  // usuário já digitou/colou, já que a escrita nunca chegou a acontecer no
  // banco (o toast de erro é responsabilidade de onEdicaoCelula/onColarFaixa
  // em page.tsx, que agora relançam o erro em vez de engolir).
  const escreverCelulas = useCallback(async (ids: number[], valoresAnteriores: Map<number, number | null>, acao: () => Promise<void>) => {
    setCelulasSalvando((atual) => {
      const copia = new Set(atual);
      for (const id of ids) copia.add(id);
      return copia;
    });
    try {
      await acao();
    } catch {
      for (const id of ids) {
        const campo = document.getElementById(idCampoPct(id)) as HTMLInputElement | null;
        if (campo) campo.value = String(valoresAnteriores.get(id) ?? "");
      }
    } finally {
      setCelulasSalvando((atual) => {
        const copia = new Set(atual);
        for (const id of ids) copia.delete(id);
        return copia;
      });
    }
  }, []);

  // PLR-18/19: undo também passa pelo envelope de salvando/reversão -- o
  // "valor anterior" pro rollback do PRÓPRIO undo (se a reescrita falhar) é
  // o valor que a célula tinha ANTES do Ctrl+Z, não o valor que o undo
  // estava tentando restaurar.
  const restaurarComSalvando = useCallback(
    async (valores: { idSucesso: number; pctAtingimento: number }[]) => {
      const anteriores = new Map(valores.map((v) => [v.idSucesso, pctAtualPorId.get(v.idSucesso) ?? null]));
      await escreverCelulas(
        valores.map((v) => v.idSucesso),
        anteriores,
        () => onColarFaixa(valores)
      );
    },
    [onColarFaixa, pctAtualPorId, escreverCelulas]
  );
  const { empilhar: empilharUndo, desfazer } = useUndoPlanejamento(restaurarComSalvando);

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
      aplicarEmMassa: (valor: number) => {
        if (celulasMarcadas.size === 0) return;
        const idsMarcados = Array.from(celulasMarcadas);
        const atualizacoes = idsMarcados.map((idSucesso) => ({ idSucesso, pctAtingimento: valor }));
        const anteriores = new Map(idsMarcados.map((idSucesso) => [idSucesso, pctAtualPorId.get(idSucesso) ?? null]));
        empilharUndo(idsMarcados.map((idSucesso) => ({ idSucesso, valorAnterior: anteriores.get(idSucesso) ?? null })));
        void escreverCelulas(idsMarcados, anteriores, () => onColarFaixa(atualizacoes));
        setCelulasMarcadas(new Set());
      },
    }),
    [objetivos, celulasMarcadas, onColarFaixa, empilharUndo, pctAtualPorId, escreverCelulas]
  );

  // PLR-18: Ctrl+Z (ou Cmd+Z no Mac) desfaz a última escrita, sem sair da
  // tela. Listener no `document` -- a árvore não tem um único elemento raiz
  // óbvio pra focar/capturar o atalho, e o Sucesso Mensal editado pode não
  // estar mais com foco (ex.: usuário clicou em outro lugar da página) sem
  // que isso deva impedir o undo. Ignorado quando o alvo do evento é um
  // campo de outro formulário (ex.: um dos modais abertos) -- undo desta
  // árvore não deveria interferir com o undo nativo de um `<textarea>` aberto.
  useEffect(() => {
    if (somenteLeitura) return;
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      const dentroDeOutroFormulario = alvo?.closest("[role='dialog']");
      if (dentroDeOutroFormulario) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void desfazer();
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [somenteLeitura, desfazer]);

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
  // PLR-15 (T20): navegação por teclado da célula de % precisa só dos ids,
  // na mesma ordem visual já usada pelo paste de faixa (PLM-03/PLR-16).
  const ordemVisualIds = useMemo(() => ordemVisual.map((l) => l.idSucesso), [ordemVisual]);

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
      const valorAnterior = pctAtualPorId.get(idSucesso) ?? null;

      // Success Criteria (spec.md "Limpar uma célula de % grava NULL"):
      // campo vazio é uma AÇÃO ("apagar"), não uma entrada inválida --
      // precisa ser checado ANTES de `normalizaEntradaPct`, que retorna
      // `null` pros dois casos e não teria como diferenciá-los depois.
      if (valorTexto.trim() === "") {
        if (valorAnterior == null) return; // já está vazio -- nada a escrever
        limparErro(idSucesso);
        empilharUndo([{ idSucesso, valorAnterior }]);
        void escreverCelulas([idSucesso], new Map([[idSucesso, valorAnterior]]), () => onEdicaoCelula(idSucesso, null));
        return;
      }

      const pct = normalizaEntradaPct(valorTexto);
      if (pct === null) {
        setErros((atual) => ({ ...atual, [idSucesso]: "Valor deve estar entre 0 e 100." }));
        return;
      }
      limparErro(idSucesso);
      // PLR-18: empilha ANTES de escrever -- o valor "anterior" é o que
      // `linhas` ainda mostra neste render, antes da atualização otimista.
      empilharUndo([{ idSucesso, valorAnterior }]);
      void escreverCelulas([idSucesso], new Map([[idSucesso, valorAnterior]]), () => onEdicaoCelula(idSucesso, pct));
    },
    [onEdicaoCelula, limparErro, empilharUndo, pctAtualPorId, escreverCelulas]
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
        const pct = normalizaEntradaPct(valorTexto);
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
      // PLR-18: 1 entrada de undo por célula da faixa, empilhadas juntas --
      // `Ctrl+Z` desfaz a faixa inteira de uma vez, não célula por célula.
      const anteriores = new Map(atualizacoes.map(({ idSucesso }) => [idSucesso, pctAtualPorId.get(idSucesso) ?? null]));
      empilharUndo(atualizacoes.map(({ idSucesso }) => ({ idSucesso, valorAnterior: anteriores.get(idSucesso) ?? null })));
      void escreverCelulas(
        atualizacoes.map(({ idSucesso }) => idSucesso),
        anteriores,
        () => onColarFaixa(atualizacoes)
      );
    },
    [ordemVisual, onColarFaixa, limparErro, empilharUndo, pctAtualPorId, escreverCelulas]
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

  // Monta a lista achatada (T11, simplificada em T19): 1 linha por
  // Objetivo/Meta/Sucesso Mensal, na ordem visual, respeitando `expandidos`.
  // Até T16 esta função também injetava linhas sintéticas "form"
  // (criar/editar) na posição do nó -- T19 troca isso por `ModalDetalheItem`
  // (overlay, fora da árvore), então a lista voltou a refletir só o dado
  // real, sem ramificar por `acaoAtiva`.
  const linhasArvore = useMemo<LinhaArvore[]>(() => {
    const resultado: LinhaArvore[] = [];

    for (const objetivo of objetivos) {
      const idObj = `obj-${objetivo.idObjetivo}`;

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
          resultado.push({ tipo: "sm", id: `sm-${sm.idSucesso}`, nivel: 2, linha: sm });
        }
      }
    }

    return resultado;
  }, [
    objetivos,
    linhasPorMeta,
    expandidos,
    idsMetaComPesoDivergente,
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
                salvando={celulasSalvando.has(item.linha.idSucesso)}
                onCommit={handleCommitCelula}
                onPasteInicio={handlePasteInicio}
                ordemVisualIds={ordemVisualIds}
                marcada={celulasMarcadas.has(item.linha.idSucesso)}
                onAlternarMarcada={alternarMarcada}
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
        // PLR-13: ícone de histórico é discreto, sempre no fim da linha,
        // gated por `permissoes.veAuditoria` -- independente de
        // `somenteLeitura` (ver histórico é leitura, não escrita).
        cell: ({ row }) => {
          const item = row.original;
          const [tabela, idRegistro, titulo] =
            item.tipo === "obj"
              ? (["fat_objetivo_especifico", item.objetivo.idObjetivo, item.objetivo.descricao] as const)
              : item.tipo === "meta"
                ? (["fat_meta", item.meta.idMeta, item.meta.descricao] as const)
                : (["fat_sucesso_mensal", item.linha.idSucesso, item.linha.descricao] as const);

          const botaoHistorico = permissoes.veAuditoria && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Ver histórico"
              aria-label={`Ver histórico de ${titulo}`}
              onClick={() => setHistoricoAlvo({ tabela, idRegistro, titulo })}
            >
              <History className="size-3.5" />
            </Button>
          );

          if (somenteLeitura) return botaoHistorico || null;

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
                {botaoHistorico}
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
                {botaoHistorico}
              </div>
            );
          }
          return (
            <div className="flex items-center gap-1">
              {podeVerDetalhesSucesso && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setAcaoAtiva({ tipo: "editar-sucesso", sucesso: item.linha })}>
                  Detalhes
                </Button>
              )}
              {botaoHistorico}
            </div>
          );
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
      permissoes.veAuditoria,
      handleCommitCelula,
      handlePasteInicio,
      ordemVisualIds,
      celulasMarcadas,
      celulasSalvando,
      alternarMarcada,
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

  // Modais (PLR-12/13/14) renderizam nos 2 ramos abaixo -- inclusive quando
  // `objetivos.length === 0` (EstadoVazio): o botão "+ Objetivo" do
  // PlanejamentoToolbar chama `criarObjetivo()` via ref mesmo com a árvore
  // vazia, e o modal precisa existir pra abrir.
  const modais = (
    <>
      <ModalDetalheItem
        acao={acaoAtiva}
        idPlanejamento={idPlanejamento}
        produtoNome={produtoNome}
        pessoasVinculadas={pessoasVinculadas}
        onFechar={fecharAcao}
        onHierarquiaAlterada={onHierarquiaAlterada}
        onGradeAlterada={onGradeAlterada}
      />
      {historicoAlvo && (
        <ModalHistorico
          tabela={historicoAlvo.tabela}
          idRegistro={historicoAlvo.idRegistro}
          titulo={historicoAlvo.titulo}
          aberto
          onFechar={() => setHistoricoAlvo(null)}
        />
      )}
    </>
  );

  if (objetivos.length === 0) {
    return (
      <>
        <EstadoVazio titulo="Nenhum Objetivo Específico cadastrado ainda" />
        {modais}
      </>
    );
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

      {modais}
    </div>
  );
});

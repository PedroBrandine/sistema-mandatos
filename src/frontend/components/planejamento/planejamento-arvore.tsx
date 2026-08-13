"use client";

import { createColumnHelper, flexRender, tableFeatures, useTable } from "@tanstack/react-table";
import { ChevronDown, ChevronRight, Flag, Target } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import type { MetaResumo, ObjetivoComMetas, PessoaVinculada, SucessoMensalGrade } from "@backend/queries/planejamento";

import { usePapelGlobal } from "@/hooks/use-papel-global";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { MetaForm } from "./meta-form";
import { ObjetivoForm } from "./objetivo-form";
import { SucessoMensalForm } from "./sucesso-mensal-form";

// PLM-01/02/03/04/08/10/11/12/13/14. Substitui HierarquiaPlanejamento +
// GradeSucessosMensais (duas seções desconectadas -- a árvore Objetivo->Meta
// num bloco, a grade de Sucesso Mensal agrupada por Meta em outro, repetindo
// a lista de Metas duas vezes) por uma única árvore de verdade: Objetivo
// Específico -> Meta -> Sucesso Mensal, cada nível expansível/recolhível.
// Pedro (2026-08-12): "ficou ruim [...] preciso que a tela do planejamento
// estratégico seja em tree view a partir dos objetivos específicos, metas e
// sucessos mensais". Refatoração de apresentação -- nenhum contrato de
// backend muda (mesmas queries, mesmos RPCs, mesmas ACs de PLM-01 a PLM-18);
// só a composição visual.
//
// A tabela de Sucesso Mensal (TanStack v9, ver rationale original em
// git blame de grade-sucessos-mensais.tsx) continua uma por Meta -- Rules of
// Hooks: useTable não pode ser chamado dentro de um .map() do componente pai,
// por isso <SucessosMensaisDaMeta> é seu próprio componente, instanciado uma
// vez por <NoMeta>. O estado de paste-range (erros, ordem visual pra
// distribuir uma faixa colada) continua no topo da árvore, não em cada
// tabela -- uma faixa colada pode atravessar a Meta em que começou e cair na
// próxima (AC3), então "ordem visual" tem que ser a árvore inteira.

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, SucessoMensalGrade>();

export interface PlanejamentoArvoreProps {
  idPlanejamento: number;
  produtoNome: string;
  objetivos: ObjetivoComMetas[];
  linhas: SucessoMensalGrade[];
  pessoasVinculadas: PessoaVinculada[];
  onEdicaoCelula: (idSucesso: number, pctAtingimento: number) => Promise<void>;
  onColarFaixa: (valores: { idSucesso: number; pctAtingimento: number }[]) => Promise<void>;
  // onHierarquiaAlterada: refetch após criar/editar Objetivo ou Meta.
  // onGradeAlterada: refetch após criar/editar detalhes de um Sucesso Mensal
  // (PLM-17/18 -- muda campos que a atualização otimista de onEdicaoCelula
  // não cobre). Duas funções, não uma: editar um Objetivo não precisa
  // recarregar a grade, e vice-versa.
  onHierarquiaAlterada: () => void;
  onGradeAlterada: () => void;
  // somenteLeitura (Edge Case do spec.md, "Coalizão sem planejamento
  // próprio"): a leitura agregada de cada membro nunca oferece criação/edição
  // -- é leitura, não a tela de gestão do próprio contrato do membro.
  somenteLeitura?: boolean;
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

/** AC4: valor deve estar em 0-100 -- réplica no cliente do ck_sucesso_pct, pra feedback imediato. */
function validaPct(valorTexto: string): number | null {
  const valor = Number(valorTexto);
  if (valorTexto.trim() === "" || !Number.isFinite(valor) || valor < 0 || valor > 100) return null;
  return valor;
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
          // Mais de uma linha colada: é uma faixa -- trata via onPasteInicio,
          // que distribui pelas linhas seguintes (não deixa o browser colar
          // o texto multi-linha bruto na própria célula).
          if (/\r?\n/.test(texto.trim())) {
            e.preventDefault();
            onPasteInicio(linha.idSucesso, texto);
          }
          // Colagem de 1 valor só: deixa o browser colar normal, o onBlur
          // seguinte valida e comita como uma edição de célula única.
        }}
        aria-invalid={Boolean(erro)}
        aria-label={`% Atingimento de ${linha.descricao}`}
      />
      {erro ? <p className="text-xs text-destructive">{erro}</p> : null}
    </div>
  );
}

interface SucessosMensaisDaMetaProps {
  linhas: SucessoMensalGrade[];
  erros: Record<number, string>;
  somenteLeitura: boolean;
  onCommitCelula: (idSucesso: number, valorTexto: string) => void;
  onPasteInicio: (idSucesso: number, texto: string) => void;
  onEditarDetalhes: (linha: SucessoMensalGrade) => void;
}

/** Tabela editável (TanStack) dos Sucessos Mensais de UMA Meta -- puramente apresentacional, sem estado de formulário próprio (isso é do <NoMeta> pai). */
function SucessosMensaisDaMeta({
  linhas,
  erros,
  somenteLeitura,
  onCommitCelula,
  onPasteInicio,
  onEditarDetalhes,
}: SucessosMensaisDaMetaProps) {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("descricao", { header: "Sucesso Mensal" }),
        columnHelper.accessor("peso", { header: "Peso", cell: (info) => `${info.getValue()}%` }),
        columnHelper.display({
          id: "pct",
          header: "% Atingimento",
          cell: ({ row }) => (
            <CelulaPct
              linha={row.original}
              erro={erros[row.original.idSucesso]}
              somenteLeitura={somenteLeitura}
              onCommit={onCommitCelula}
              onPasteInicio={onPasteInicio}
            />
          ),
        }),
        columnHelper.display({
          id: "status",
          header: "Status",
          cell: ({ row }) => (
            <Badge variant={STATUS_VARIANT[row.original.status] ?? "secondary"}>
              {STATUS_LABEL[row.original.status] ?? row.original.status}
            </Badge>
          ),
        }),
        columnHelper.display({
          id: "atraso",
          header: "Atraso",
          cell: ({ row }) =>
            row.original.estaAtrasado ? (
              <Badge variant="destructive">{row.original.diasAtraso} dia(s)</Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        }),
        columnHelper.display({
          id: "acoes",
          header: "",
          cell: ({ row }) =>
            somenteLeitura ? null : (
              <Button type="button" variant="ghost" size="sm" onClick={() => onEditarDetalhes(row.original)}>
                Detalhes
              </Button>
            ),
        }),
      ]),
    [erros, somenteLeitura, onCommitCelula, onPasteInicio, onEditarDetalhes]
  );

  const table = useTable({ features, columns, data: linhas });

  if (linhas.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum Sucesso Mensal cadastrado neste mês.</p>;
  }

  return (
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
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getAllCells().map((cell) => (
              <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface NoMetaProps {
  meta: MetaResumo;
  produtoNome: string;
  pessoasVinculadas: PessoaVinculada[];
  linhas: SucessoMensalGrade[];
  erros: Record<number, string>;
  pesoDivergente: boolean;
  podeEditarEstrutura: boolean;
  podeCriarSucesso: boolean;
  somenteLeitura: boolean;
  onCommitCelula: (idSucesso: number, valorTexto: string) => void;
  onPasteInicio: (idSucesso: number, texto: string) => void;
  onHierarquiaAlterada: () => void;
  onGradeAlterada: () => void;
}

/** Nó "Meta" da árvore: cabeçalho (descrição + badges + Editar) e, expandido, os Sucessos Mensais dessa Meta. */
function NoMeta({
  meta,
  produtoNome,
  pessoasVinculadas,
  linhas,
  erros,
  pesoDivergente,
  podeEditarEstrutura,
  podeCriarSucesso,
  somenteLeitura,
  onCommitCelula,
  onPasteInicio,
  onHierarquiaAlterada,
  onGradeAlterada,
}: NoMetaProps) {
  const [aberto, setAberto] = useState(true);
  const [editando, setEditando] = useState(false);
  const [criandoSucesso, setCriandoSucesso] = useState(false);
  const [editandoSucesso, setEditandoSucesso] = useState<SucessoMensalGrade | null>(null);

  if (editando) {
    return (
      <div className="rounded-md border bg-muted/20 p-3">
        <MetaForm
          modo={{ tipo: "editar", meta }}
          produtoNome={produtoNome}
          pessoasVinculadas={pessoasVinculadas}
          onConcluido={() => {
            setEditando(false);
            onHierarquiaAlterada();
          }}
          onCancelar={() => setEditando(false)}
        />
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-muted/20">
      <div className="flex items-center justify-between gap-2 p-3">
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
          aria-expanded={aberto}
        >
          {aberto ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
          <Flag className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{meta.descricao}</span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {meta.status !== "ativa" && <Badge variant="secondary">{meta.status}</Badge>}
          {pesoDivergente && (
            <Badge variant="destructive" title="A soma dos pesos dos Sucessos Mensais desta Meta não fecha 100">
              Peso ≠ 100
            </Badge>
          )}
          <Badge variant="outline">{formatarPct(meta.pctAtingimento)}</Badge>
          {podeEditarEstrutura && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(true)}>
              Editar
            </Button>
          )}
        </div>
      </div>

      {aberto && (
        <div className="grid gap-3 border-t p-3 pl-8">
          <SucessosMensaisDaMeta
            linhas={linhas}
            erros={erros}
            somenteLeitura={somenteLeitura}
            onCommitCelula={onCommitCelula}
            onPasteInicio={onPasteInicio}
            onEditarDetalhes={setEditandoSucesso}
          />

          {editandoSucesso && (
            <SucessoMensalForm
              modo={{ tipo: "editar", sucesso: editandoSucesso }}
              onConcluido={() => {
                setEditandoSucesso(null);
                onGradeAlterada();
              }}
              onCancelar={() => setEditandoSucesso(null)}
            />
          )}

          {!somenteLeitura &&
            podeCriarSucesso &&
            !editandoSucesso &&
            (criandoSucesso ? (
              <SucessoMensalForm
                modo={{ tipo: "criar", idMeta: meta.idMeta }}
                onConcluido={() => {
                  setCriandoSucesso(false);
                  onGradeAlterada();
                }}
                onCancelar={() => setCriandoSucesso(false)}
              />
            ) : (
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setCriandoSucesso(true)}>
                + Sucesso Mensal
              </Button>
            ))}
        </div>
      )}
    </div>
  );
}

interface NoObjetivoProps {
  objetivo: ObjetivoComMetas;
  produtoNome: string;
  pessoasVinculadas: PessoaVinculada[];
  linhasPorMeta: Map<number, SucessoMensalGrade[]>;
  erros: Record<number, string>;
  idsMetaComPesoDivergente: Set<number>;
  podeEditarEstrutura: boolean;
  podeCriarSucesso: boolean;
  somenteLeitura: boolean;
  onCommitCelula: (idSucesso: number, valorTexto: string) => void;
  onPasteInicio: (idSucesso: number, texto: string) => void;
  onHierarquiaAlterada: () => void;
  onGradeAlterada: () => void;
}

/** Nó "Objetivo Específico" da árvore: cabeçalho (descrição + % + Editar) e, expandido, as Metas desse Objetivo. */
function NoObjetivo({
  objetivo,
  produtoNome,
  pessoasVinculadas,
  linhasPorMeta,
  erros,
  idsMetaComPesoDivergente,
  podeEditarEstrutura,
  podeCriarSucesso,
  somenteLeitura,
  onCommitCelula,
  onPasteInicio,
  onHierarquiaAlterada,
  onGradeAlterada,
}: NoObjetivoProps) {
  const [aberto, setAberto] = useState(true);
  const [editando, setEditando] = useState(false);
  const [criandoMeta, setCriandoMeta] = useState(false);

  if (editando) {
    return (
      <div className="rounded-lg border p-4">
        <ObjetivoForm
          modo={{ tipo: "editar", objetivo }}
          onConcluido={() => {
            setEditando(false);
            onHierarquiaAlterada();
          }}
          onCancelar={() => setEditando(false)}
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between gap-2 p-4">
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={aberto}
        >
          {aberto ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
          <Target className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{objetivo.descricao}</span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline">{formatarPct(objetivo.pctAtingimento)}</Badge>
          {podeEditarEstrutura && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(true)}>
              Editar
            </Button>
          )}
        </div>
      </div>

      {aberto && (
        <div className="grid gap-3 border-t p-4 pl-8">
          {objetivo.metas.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma Meta cadastrada ainda.</p>
          )}

          {objetivo.metas.map((meta) => (
            <NoMeta
              key={meta.idMeta}
              meta={meta}
              produtoNome={produtoNome}
              pessoasVinculadas={pessoasVinculadas}
              linhas={linhasPorMeta.get(meta.idMeta) ?? []}
              erros={erros}
              pesoDivergente={idsMetaComPesoDivergente.has(meta.idMeta)}
              podeEditarEstrutura={podeEditarEstrutura}
              podeCriarSucesso={podeCriarSucesso}
              somenteLeitura={somenteLeitura}
              onCommitCelula={onCommitCelula}
              onPasteInicio={onPasteInicio}
              onHierarquiaAlterada={onHierarquiaAlterada}
              onGradeAlterada={onGradeAlterada}
            />
          ))}

          {podeEditarEstrutura &&
            (criandoMeta ? (
              <MetaForm
                modo={{ tipo: "criar", idObjetivo: objetivo.idObjetivo }}
                produtoNome={produtoNome}
                pessoasVinculadas={pessoasVinculadas}
                onConcluido={() => {
                  setCriandoMeta(false);
                  onHierarquiaAlterada();
                }}
                onCancelar={() => setCriandoMeta(false)}
              />
            ) : (
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setCriandoMeta(true)}>
                + Meta
              </Button>
            ))}
        </div>
      )}
    </div>
  );
}

export function PlanejamentoArvore({
  idPlanejamento,
  produtoNome,
  objetivos,
  linhas,
  pessoasVinculadas,
  onEdicaoCelula,
  onColarFaixa,
  onHierarquiaAlterada,
  onGradeAlterada,
  somenteLeitura = false,
}: PlanejamentoArvoreProps) {
  const { papel } = usePapelGlobal();
  // PLM-14 (achado de bug real, corrigido na revisão anterior): o gate de
  // criar/editar Objetivo/Meta é só gestora/admin -- Mentor só tem GRANT
  // SELECT nessas duas tabelas (docs/schema_sistema.sql:2084-2089), não
  // INSERT/UPDATE. podeCriarSucesso é um gate diferente (Mentor também
  // grava fat_sucesso_mensal, docs/schema_sistema.sql:2093).
  const podeEditarEstrutura = !somenteLeitura && (papel === "gestora" || papel === "admin");
  const podeCriarSucesso = !somenteLeitura && (papel === "gestora" || papel === "mentor" || papel === "admin");

  const [criandoObjetivo, setCriandoObjetivo] = useState(false);
  const [erros, setErros] = useState<Record<number, string>>({});

  const linhasPorMeta = useMemo(() => {
    const mapa = new Map<number, SucessoMensalGrade[]>();
    for (const linha of linhas) {
      const lista = mapa.get(linha.idMeta) ?? [];
      lista.push(linha);
      mapa.set(linha.idMeta, lista);
    }
    return mapa;
  }, [linhas]);

  // Alerta de soma de peso ≠ 100 (Edge Case do spec.md: alerta, nunca
  // bloqueio de uso diário) -- só flagra Metas que já têm Sucesso Mensal
  // neste mês (uma Meta sem nenhum ainda não é "divergente", é vazia).
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

  // Ordem visual real (Objetivo por Objetivo, Meta por Meta, na ordem em que
  // a árvore renderiza) -- é o que o paste de faixa (AC3) usa pra "respeitar
  // a ordem visual da grade", não a ordem crua da prop `linhas`. Uma faixa
  // colada dentro da tabela de uma Meta pode continuar na Meta seguinte (ou
  // no Objetivo seguinte) -- por isso essa ordem cobre a árvore inteira, não
  // só a Meta em que o paste começou.
  const ordemVisual = useMemo(
    () => objetivos.flatMap((o) => o.metas.flatMap((m) => linhasPorMeta.get(m.idMeta) ?? [])),
    [objetivos, linhasPorMeta]
  );

  const limparErro = useCallback((idSucesso: number) => {
    setErros((atual) => {
      if (!(idSucesso in atual)) return atual;
      const copia = { ...atual };
      delete copia[idSucesso];
      return copia;
    });
  }, []);

  // PLM-02: salva só a célula editada, sem recarregar a árvore inteira (AC
  // literal + risco de adoção AD-028) -- delegado ao onEdicaoCelula do
  // chamador, que já faz a atualização otimista do estado local.
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

  // SPEC_DEVIATION (interpretação de "colar um intervalo de células", AC3):
  // sem UI de seleção de faixa por arraste (fora de escopo -- nenhuma spec
  // diz COMO selecionar), o paste começa na célula com foco e distribui os
  // valores colados (um por linha) na ordem visual da árvore a partir dali.
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
        if (!alvo) return; // faixa colada é maior que o restante da árvore -- ignora o excedente
        const pct = validaPct(valorTexto);
        if (pct === null) {
          errosNovos[alvo.idSucesso] = "Valor deve estar entre 0 e 100.";
          return;
        }
        atualizacoes.push({ idSucesso: alvo.idSucesso, pctAtingimento: pct });
      });

      if (Object.keys(errosNovos).length > 0) {
        // AC4: nenhuma célula da faixa salva se alguma for inválida -- mesma
        // atomicidade do lado do banco (app.atualiza_sucessos_mensais_lote).
        setErros((atual) => ({ ...atual, ...errosNovos }));
        return;
      }
      if (atualizacoes.length === 0) return;

      for (const { idSucesso } of atualizacoes) limparErro(idSucesso);
      void onColarFaixa(atualizacoes);
    },
    [ordemVisual, onColarFaixa, limparErro]
  );

  return (
    <div className="grid gap-3">
      {objetivos.length === 0 && <EstadoVazio titulo="Nenhum Objetivo Específico cadastrado ainda" />}

      {objetivos.map((objetivo) => (
        <NoObjetivo
          key={objetivo.idObjetivo}
          objetivo={objetivo}
          produtoNome={produtoNome}
          pessoasVinculadas={pessoasVinculadas}
          linhasPorMeta={linhasPorMeta}
          erros={erros}
          idsMetaComPesoDivergente={idsMetaComPesoDivergente}
          podeEditarEstrutura={podeEditarEstrutura}
          podeCriarSucesso={podeCriarSucesso}
          somenteLeitura={somenteLeitura}
          onCommitCelula={handleCommitCelula}
          onPasteInicio={handlePasteInicio}
          onHierarquiaAlterada={onHierarquiaAlterada}
          onGradeAlterada={onGradeAlterada}
        />
      ))}

      {podeEditarEstrutura &&
        (criandoObjetivo ? (
          <ObjetivoForm
            modo={{ tipo: "criar", idPlanejamento }}
            onConcluido={() => {
              setCriandoObjetivo(false);
              onHierarquiaAlterada();
            }}
            onCancelar={() => setCriandoObjetivo(false)}
          />
        ) : (
          <Button type="button" variant="outline" className="w-fit" onClick={() => setCriandoObjetivo(true)}>
            + Objetivo
          </Button>
        ))}
    </div>
  );
}

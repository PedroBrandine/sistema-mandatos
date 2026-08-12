"use client";

import { createColumnHelper, flexRender, tableFeatures, useTable } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";

import type { SucessoMensalGrade } from "@backend/queries/planejamento";

import { usePapelGlobal } from "@/hooks/use-papel-global";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { SucessoMensalForm } from "./sucesso-mensal-form";

// PLM-01/02/03/04. Primeiro consumidor real de @tanstack/react-table no
// repo (design.md "Risks & Concerns" -- sem precedente local de célula
// editável/tabulação/paste a reaproveitar).
//
// @tanstack/react-table@9 (não v8, que é o que a maioria dos exemplos por aí
// ensina -- ver node_modules/@tanstack/react-table/skills/migrate-v8-to-v9):
// useTable (não useReactTable), sem getCoreRowModel (automático), features
// registradas via tableFeatures() -- aqui vazio, sem sort/filter/paginação.
//
// Um <TabelaMeta> por Meta (Rules of Hooks: useTable não pode ser chamado
// dentro de um .map() do componente pai) -- cada instância usa TanStack de
// verdade (columnHelper, flexRender, getHeaderGroups/getRowModel) pras 5
// colunas fixas; o agrupamento por Meta em si é feito fora da tabela (um
// <TabelaMeta> por grupo), não pela feature de grouping do TanStack -- essa
// é voltada a pivot/agregação com expand/collapse, mais do que este spec
// pede (só "agrupados por Meta", sem colapsar/agregar).
//
// SPEC_DEVIATION (interpretação de "colar um intervalo de células", AC3):
// sem UI de seleção de faixa por arraste (fora de escopo -- nenhuma spec diz
// COMO selecionar), o paste começa na célula com foco e distribui os valores
// colados (um por linha) na ordem visual da grade a partir dali -- o padrão
// comum de "colar uma coluna inteira" em grades sem seleção de intervalo
// dedicada. Ordem visual = ordem de renderização (agrupado por Meta, depois
// por id_sucesso), não a ordem crua da prop `linhas`.

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, SucessoMensalGrade>();

export interface GradeSucessosMensaisProps {
  metas: { idMeta: number; descricao: string }[];
  linhas: SucessoMensalGrade[];
  somenteLeitura?: boolean;
  onEdicaoCelula: (idSucesso: number, pctAtingimento: number) => Promise<void>;
  onColarFaixa: (valores: { idSucesso: number; pctAtingimento: number }[]) => Promise<void>;
  // PLM-17/18: criar um Sucesso Mensal novo ou editar peso/descrição/mês/
  // prazo/status de um existente muda campos que a atualização otimista de
  // onEdicaoCelula não cobre -- dispara um refetch completo da grade
  // (diferente de PLM-02, que é sobre o fluxo de edição rápida de %,
  // exercitado a cada tecla; criar/editar detalhes é ação rara).
  onAlterado?: () => void;
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

interface TabelaMetaProps {
  idMeta: number;
  descricaoMeta: string;
  linhas: SucessoMensalGrade[];
  erros: Record<number, string>;
  somenteLeitura: boolean;
  onCommitCelula: (idSucesso: number, valorTexto: string) => void;
  onPasteInicio: (idSucesso: number, texto: string) => void;
  onAlterado?: () => void;
}

function TabelaMeta({
  idMeta,
  descricaoMeta,
  linhas,
  erros,
  somenteLeitura,
  onCommitCelula,
  onPasteInicio,
  onAlterado,
}: TabelaMetaProps) {
  // PLM-17/18: "+ Sucesso Mensal" e "Detalhes" por linha -- ações raras
  // (diferente da edição de % na própria célula), por isso um form
  // completo abre abaixo da tabela em vez de célula inline (T14 já cobre
  // o caso frequente).
  const [criando, setCriando] = useState(false);
  const [editandoSucesso, setEditandoSucesso] = useState<SucessoMensalGrade | null>(null);
  // PLM-17 AC2: Assessor não tem GRANT INSERT em fat_sucesso_mensal (só
  // SELECT, UPDATE, docs/schema_sistema.sql:2093) -- "+ Sucesso Mensal" não
  // aparece pra esse papel. Editar detalhes (UPDATE) continua pra todo
  // papel com escrita na linha -- RLS já decide o resto, mesma lógica de
  // onEdicaoCelula.
  const { papel } = usePapelGlobal();
  const podeCriarSucesso = papel === "gestora" || papel === "mentor" || papel === "admin";

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
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditandoSucesso(row.original)}>
                Detalhes
              </Button>
            ),
        }),
      ]),
    [erros, somenteLeitura, onCommitCelula, onPasteInicio]
  );

  const table = useTable({ features, columns, data: linhas });

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">{descricaoMeta}</p>
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

      {editandoSucesso && (
        <SucessoMensalForm
          modo={{ tipo: "editar", sucesso: editandoSucesso }}
          onConcluido={() => {
            setEditandoSucesso(null);
            onAlterado?.();
          }}
          onCancelar={() => setEditandoSucesso(null)}
        />
      )}

      {!somenteLeitura &&
        podeCriarSucesso &&
        !editandoSucesso &&
        (criando ? (
          <SucessoMensalForm
            modo={{ tipo: "criar", idMeta }}
            onConcluido={() => {
              setCriando(false);
              onAlterado?.();
            }}
            onCancelar={() => setCriando(false)}
          />
        ) : (
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setCriando(true)}>
            + Sucesso Mensal
          </Button>
        ))}
    </div>
  );
}

export function GradeSucessosMensais({
  metas,
  linhas,
  somenteLeitura = false,
  onEdicaoCelula,
  onColarFaixa,
  onAlterado,
}: GradeSucessosMensaisProps) {
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

  // Ordem visual real (agrupada por Meta, na ordem em que `metas` chega) --
  // é o que o paste de faixa (AC3) usa pra "respeitar a ordem visual da
  // grade", não a ordem crua da prop `linhas`.
  const ordemVisual = useMemo(
    () => metas.flatMap((m) => linhasPorMeta.get(m.idMeta) ?? []),
    [metas, linhasPorMeta]
  );

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
        if (!alvo) return; // faixa colada é maior que o restante da grade -- ignora o excedente
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

  if (metas.length === 0) return null;

  return (
    <div className="grid gap-6">
      {metas.map((meta) => (
        <TabelaMeta
          key={meta.idMeta}
          idMeta={meta.idMeta}
          descricaoMeta={meta.descricao}
          linhas={linhasPorMeta.get(meta.idMeta) ?? []}
          erros={erros}
          somenteLeitura={somenteLeitura}
          onCommitCelula={handleCommitCelula}
          onPasteInicio={handlePasteInicio}
          onAlterado={onAlterado}
        />
      ))}
    </div>
  );
}

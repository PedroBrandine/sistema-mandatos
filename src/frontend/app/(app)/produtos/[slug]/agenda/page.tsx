"use client";

import { use, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  buscarEncontrosDoMes,
  buscarOpcoesContrato,
  buscarOpcoesGestora,
  buscarOpcoesProjeto,
  type EncontroAgenda,
} from "@backend/queries/agenda";
import type { ProdutoSlug } from "@backend/queries/produto";
import { buscarRegistrosDaAgenda, type RegistroAgenda } from "@backend/queries/registros-agenda";
import { marcarPresenca } from "@backend/rpc/encontro";
import { descreveErroDesconhecido } from "@backend/rpc/errors";
import { createClient } from "@backend/supabase/client";

import { AgendaMes, hojeNoFusoDoProduto } from "@/components/estrategia/agenda-mes";
import { EncontroPopover } from "@/components/estrategia/encontro-popover";
import { FiltrosAgenda, type ValorFiltrosAgenda } from "@/components/estrategia/filtros-agenda";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProdutoAtual } from "@/hooks/use-produto-atual";
import { cn } from "@/lib/utils";

// EST-12/EST-13 (T30b, .specs/features/redesenho-estrategia-tela-first/tasks.md).
// Fecha a lacuna de planejamento da Fase 7, quarta ocorrência do mesmo padrão
// (T18b, T21b, T33b): T25-T30 entregaram queries, RPC e componentes testados
// isoladamente, e nenhuma task os ligava a esta rota, que seguia servindo
// `<EmDesenvolvimento titulo="Agenda em desenvolvimento" />` de `13d72f2`.
// O Verifier da Fase 7 (validation-fase7.md) reprovou por isso: 5 dos 12 ACs
// de EST-12/EST-13 tinham só metade coberta, e a metade faltante não era
// teste ausente -- era comportamento que não existia em lugar nenhum.
//
// Esta página é a montagem: orquestra buscarEncontrosDoMes (T25),
// buscarRegistrosDaAgenda (T27) e marcarPresenca (T29), no mesmo padrão do
// dashboard (T18b/T33b) -- useQuery para leitura, useMutation para escrita,
// componentes presentational recebendo tudo por prop.
//
// AD-046 NÃO reduz a profundidade desta task: o popover grava (marcar
// presença), então vale AD-042 integral -- os dois lados de cada condicional,
// estado vazio e estado de erro, em `page.test.tsx`.
//
// Ajuste de fidelidade visual — Agenda (2026-09-14, Figma 163:4): a barra de
// filtros de gestora/projeto/contrato e o botão "+ Novo agendamento" citados
// acima como fora de escopo entram aqui. `FiltroAgenda` já aceitava os três
// recortes por interseção (idGestora, idProjeto, idContrato via
// resolverIdsContratoDoFiltro) -- faltava só o controle, então esta task
// LIGA a UI aos três, sem tocar no encanamento de queries/agenda.ts.
//
// "+ Novo agendamento" é SPEC-PRECISION GAP: não existe (Fase 7 nem
// Incidência) uma tela de criação de encontro no nível do PRODUTO, sem
// contrato já conhecido -- `encontroSchema` (schemas/encontro.ts) exige
// id_contrato, e a única superfície de criação hoje é o Dialog de
// EncontroForm em /contratos/[id]/encontros (INC-15..18). O botão reaproveita
// essa rota (mesma lógica de "Adicionar registro" do popover, EST-13 AC6) com
// o contrato do FILTRO ativo, e fica desabilitado -- nunca escondido, AD-005
// -- até a usuária escolher um contrato, com o motivo no `title`.

function mesDoDia(dia: string): { ano: number; mes: number } {
  return { ano: Number(dia.slice(0, 4)), mes: Number(dia.slice(5, 7)) };
}

// `ocorrido_em` é DATE puro. `new Date("2026-09-18").toLocaleDateString()`
// leria meia-noite UTC e voltaria um dia no fuso do produto -- a mesma classe
// de erro que FUSO_HORARIO_PRODUTO evita na grade. Formatar por fatia de
// string não tem esse risco.
function dataBr(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function ProdutoAgendaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params) as { slug: ProdutoSlug };
  const { data: produto, isLoading: carregandoProduto } = useProdutoAtual(slug);
  const idProduto = produto?.idProduto;

  const router = useRouter();
  const queryClient = useQueryClient();

  // L-002: o relógio é lido AQUI, uma vez, e desce por prop. Nem AgendaMes
  // nem EncontroPopover chamam `new Date()` -- os dois expõem `hoje` como
  // prop exatamente para que a data de referência seja decidida num lugar só.
  const hoje = useMemo(() => hojeNoFusoDoProduto(new Date()), []);

  // EST-12 AC1: a Agenda abre no MÊS CORRENTE, derivado do mesmo `hoje`.
  const [periodo, setPeriodo] = useState<{ ano: number; mes: number }>(() => mesDoDia(hoje));
  const [idEncontroSelecionado, setIdEncontroSelecionado] = useState<number | null>(null);

  // Ajuste de fidelidade visual — Agenda (2026-09-14, Figma 163:4
  // "filter-bar"): os três recortes que `FiltroAgenda` já aceitava, agora com
  // controle na tela. Estado vazio (`{}`) não adiciona nenhuma chave ao
  // filtro passado às queries -- gestora/projeto/contrato continuam
  // opcionais nelas.
  const [filtro, setFiltro] = useState<ValorFiltrosAgenda>({});

  const { data: gestoras } = useQuery({
    queryKey: ["agenda-opcoes-gestora"],
    queryFn: () => buscarOpcoesGestora(createClient()),
  });
  const { data: projetos } = useQuery({
    queryKey: ["agenda-opcoes-projeto"],
    queryFn: () => buscarOpcoesProjeto(createClient()),
  });
  const { data: contratos } = useQuery({
    queryKey: ["agenda-opcoes-contrato", idProduto],
    queryFn: () => buscarOpcoesContrato(createClient(), idProduto as number),
    enabled: idProduto !== undefined,
  });

  const chaveEncontros = ["agenda-encontros", idProduto, periodo.ano, periodo.mes, filtro] as const;

  // EST-12 AC3: ano/mes entram na queryKey, então navegar de mês é uma
  // consulta nova -- a grade não pode exibir mês novo com dado velho.
  const {
    data: encontros,
    isLoading: carregandoEncontros,
    isError: erroEncontros,
    refetch: refetchEncontros,
  } = useQuery({
    queryKey: chaveEncontros,
    queryFn: () =>
      buscarEncontrosDoMes(createClient(), {
        idProduto: idProduto as number,
        ano: periodo.ano,
        mes: periodo.mes,
        ...filtro,
      }),
    enabled: idProduto !== undefined,
  });

  // EST-12 AC5: a lista de Registros acompanha o recorte da grade e, quando
  // há encontro selecionado, filtra por ele. A MESMA consulta alimenta a
  // lista e o popover: com um encontro selecionado, estes registros são
  // exatamente os dele (é o que o popover precisa para a contagem de AC2).
  const {
    data: registros,
    isError: erroRegistros,
    refetch: refetchRegistros,
  } = useQuery({
    queryKey: ["agenda-registros", idProduto, periodo.ano, periodo.mes, idEncontroSelecionado, filtro],
    queryFn: () =>
      buscarRegistrosDaAgenda(createClient(), {
        idProduto: idProduto as number,
        ano: periodo.ano,
        mes: periodo.mes,
        idEncontro: idEncontroSelecionado ?? undefined,
        ...filtro,
      }),
    enabled: idProduto !== undefined,
  });

  // O estado guarda o ID, não o objeto: depois de marcar presença, o encontro
  // é relido da lista já invalidada, e o popover aberto passa a exibir
  // "Realizada" sem precisar sincronizar uma cópia à mão (EST-13 AC4, "reflete
  // na tela"). Guardar o objeto deixaria o popover congelado no status antigo.
  const encontroSelecionado =
    encontros?.find((e) => e.idEncontro === idEncontroSelecionado) ?? null;

  const {
    mutate: marcarPresencaNoEncontro,
    isPending: marcandoPresenca,
    error: erroPresencaBruto,
    reset: limparErroPresenca,
  } = useMutation({
    mutationFn: (input: { idEncontro: number }) => marcarPresenca(createClient(), input),
    onSuccess: () => {
      // EST-13 AC4: a grade e a lista releem -- é a invalidação que faz o
      // card virar "Realizada" na célula, não um patch local.
      void queryClient.invalidateQueries({ queryKey: chaveEncontros });
      void queryClient.invalidateQueries({ queryKey: ["agenda-registros"] });
    },
  });

  // O erro da RPC nunca some em silêncio (AD-005). `marcarPresenca` já
  // traduz o PostgrestError por `mapeiaErroRpc`, então aqui chega um Error de
  // verdade; `descreveErroDesconhecido` é a mesma rede de segurança que a T24
  // colocou no wizard de mandato (mandato-wizard.tsx:344) para o caso de algo
  // escapar como objeto cru -- o objeto do PostgREST NÃO é `Error` em runtime
  // (vem de JSON.parse), e foi exatamente isso que escondeu um bug por
  // semanas. Ver ErroBancoNaoMapeadoError em backend/rpc/errors.ts.
  const erroPresenca = erroPresencaBruto ? descreveErroDesconhecido(erroPresencaBruto) : null;

  function irParaMes(destino: { ano: number; mes: number }) {
    // A seleção não sobrevive à troca de mês: o encontro selecionado não está
    // mais na grade exibida, e manter o id filtraria a lista por um encontro
    // que a usuária não vê mais.
    setIdEncontroSelecionado(null);
    limparErroPresenca();
    setPeriodo(destino);
  }

  function selecionarEncontro(encontro: EncontroAgenda) {
    limparErroPresenca();
    setIdEncontroSelecionado(encontro.idEncontro);
  }

  if (carregandoProduto || carregandoEncontros) {
    return <CarregandoSkeleton variante="cards" />;
  }

  if (erroEncontros) {
    return (
      <ErroInline
        mensagem="Não foi possível carregar os encontros da Agenda."
        onRetry={() => refetchEncontros()}
      />
    );
  }

  const encontrosDoMes = encontros ?? [];
  const registrosDoRecorte = registros ?? [];

  return (
    <div className="grid gap-6">
      <FiltrosAgenda
        filtro={filtro}
        onChange={setFiltro}
        gestoras={gestoras ?? []}
        projetos={projetos ?? []}
        contratos={contratos ?? []}
      />

      <AgendaMes
        ano={periodo.ano}
        mes={periodo.mes}
        encontros={encontrosDoMes}
        hoje={hoje}
        onMudarMes={irParaMes}
        onSelecionarEncontro={selecionarEncontro}
        onNovoAgendamento={() => {
          if (filtro.idContrato !== undefined) {
            router.push(`/contratos/${filtro.idContrato}/encontros`);
          }
        }}
        novoAgendamentoDesabilitado={filtro.idContrato === undefined}
        motivoNovoAgendamentoDesabilitado="Selecione um contrato no filtro para agendar um novo encontro."
      />

      {/* EST-12 AC4 / EST-13: o popover existe enquanto há encontro
          selecionado, e some quando a seleção é desfeita. O gatilho é um
          âncora sr-only logo abaixo da grade, não a grade inteira: o contrato
          de AgendaMes entrega o encontro clicado (`onSelecionarEncontro`), não
          o elemento DOM dele, e envolver o calendário inteiro num
          PopoverTrigger faria cada clique numa célula alternar o popover por
          conta do toggle do Radix (react-popover/dist/index.mjs:96). Ancorar
          na célula exigiria mudar AgendaMes, que está fora do Where desta
          task. */}
      {encontroSelecionado && (
        <EncontroPopover
          encontro={encontroSelecionado}
          registros={registrosDoRecorte}
          hoje={hoje}
          aberto
          onAbertoChange={(estaAberto) => {
            if (!estaAberto) setIdEncontroSelecionado(null);
          }}
          onMarcarPresenca={(input) => marcarPresencaNoEncontro(input)}
          onAdicionarRegistro={(input) => router.push(`/contratos/${input.idContrato}/encontros`)}
          marcandoPresenca={marcandoPresenca}
          erroPresenca={erroPresenca}
        >
          <span className="sr-only">Detalhe do encontro {encontroSelecionado.titulo}</span>
        </EncontroPopover>
      )}

      {erroRegistros ? (
        <ErroInline
          mensagem="Não foi possível carregar os registros da Agenda."
          onRetry={() => refetchRegistros()}
        />
      ) : (
        <ListaRegistros
          registros={registrosDoRecorte}
          encontroSelecionado={encontroSelecionado}
          mesSemEncontro={encontrosDoMes.length === 0}
          onLimparFiltro={() => setIdEncontroSelecionado(null)}
        />
      )}
    </div>
  );
}

// Ajuste de fidelidade visual — Agenda (2026-09-14, Figma 163:4
// "registros-table"): badge de Tipo com cor própria por tipo ("Sprint",
// "Monitoramento", "Diagnóstico" no mock do Figma têm cada um sua cor). SPEC-
// PRECISION GAP: `ref_tipo_registro` (docs/schema_sistema.sql) não tem coluna
// de cor -- os nomes reais do catálogo (`catalogos_referencia_seed.sql`:
// "Sprint", "Monitoramento mensal", "Diagnóstico de Organograma" etc.) nem
// batem literalmente com os rótulos do mock. Em vez de uma tabela nome->cor
// que quebraria a cada tipo novo, a cor sai de hash do NOME sobre uma paleta
// FIXA das cores da marca (globals.css) -- determinística (o mesmo tipo
// sempre pinta igual) e nunca exige código novo pra um tipo futuro.
const PALETA_BADGE_TIPO = [
  { bg: "bg-secondary", fg: "text-secondary-foreground" }, // vinho #571730
  { bg: "bg-chart-4", fg: "text-foreground" }, // verde-água #4ABFB2
  { bg: "bg-chart-3", fg: "text-foreground" }, // vermelho #EB5454
  { bg: "bg-chart-2", fg: "text-foreground" }, // dourado #FFD278
  { bg: "bg-chart-5", fg: "text-foreground" }, // roxo #BA6BED
  { bg: "bg-primary", fg: "text-primary-foreground" }, // teal #035252
] as const;

function hashDeterministico(valor: string): number {
  let hash = 0;
  for (let i = 0; i < valor.length; i += 1) {
    hash = (hash * 31 + valor.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function corBadgeTipo(tipoRegistro: string): (typeof PALETA_BADGE_TIPO)[number] {
  return PALETA_BADGE_TIPO[hashDeterministico(tipoRegistro) % PALETA_BADGE_TIPO.length];
}

// Ajuste de fidelidade visual — Agenda (2026-09-14, Figma 163:4 "avatar" na
// célula de Responsável): círculo com a inicial do nome. SPEC-PRECISION GAP:
// `RegistroAgenda.nomeAutor` (queries/registros-agenda.ts) não carrega URL de
// foto -- não existe esse campo em `dim_usuario` (docs/schema_sistema.sql) --
// então o avatar é a inicial, nunca uma imagem inventada.
function AvatarResponsavel({ nome }: { nome: string }) {
  const inicial = nome.trim().charAt(0).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground"
    >
      {inicial || "?"}
    </span>
  );
}

// Lista "Registros de Agenda" do Figma `163:4`: fica abaixo do calendário,
// com a contagem do recorte e — quando um encontro está selecionado — o chip
// de filtro ativo removível que EST-12 AC5 exige. Colunas na ordem do design:
// Tipo, Data, Descrição, Responsável.
function ListaRegistros({
  registros,
  encontroSelecionado,
  mesSemEncontro,
  onLimparFiltro,
}: {
  registros: RegistroAgenda[];
  encontroSelecionado: EncontroAgenda | null;
  mesSemEncontro: boolean;
  onLimparFiltro: () => void;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-0.5">
          <h2 className="font-heading text-xl">Registros de Agenda</h2>
          <p className="text-sm text-muted-foreground">
            {registros.length === 1 ? "1 registro encontrado" : `${registros.length} registros encontrados`}
          </p>
        </div>

        {encontroSelecionado && (
          <Badge variant="secondary" className="gap-1 py-1 pl-3 pr-1">
            Mostrando registros de: {encontroSelecionado.titulo}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-5"
              aria-label="Remover filtro de encontro"
              onClick={onLimparFiltro}
            >
              <X className="size-3.5" />
            </Button>
          </Badge>
        )}
      </div>

      {registros.length === 0 ? (
        // Edge case do spec: mês sem encontro renderiza a grade completa e
        // vazia, com o estado explicativo AQUI -- nunca uma grade muda sem
        // explicação (AD-005). A mensagem distingue "não há encontro no mês"
        // de "há encontros, mas nenhum registro no recorte": são causas
        // diferentes e a usuária age diferente em cada uma.
        <EstadoVazio
          titulo={mesSemEncontro ? "Nenhum encontro neste mês" : "Nenhum registro no recorte"}
          mensagem={
            mesSemEncontro
              ? "Este mês não tem encontro agendado, por isso a grade está vazia. Use as setas para navegar até outro mês."
              : encontroSelecionado
                ? "Este encontro ainda não tem registro vinculado."
                : "Os encontros deste mês ainda não têm registros vinculados."
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Responsável</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.map((registro) => {
              const cor = corBadgeTipo(registro.tipoRegistro);
              return (
                <TableRow key={registro.idRegistro}>
                  <TableCell>
                    <Badge className={cn(cor.bg, cor.fg, "font-bold")}>{registro.tipoRegistro}</Badge>
                  </TableCell>
                  <TableCell>{dataBr(registro.ocorridoEm)}</TableCell>
                  {/* Nulo vira ausência explícita, nunca célula em branco (AD-005). */}
                  <TableCell>{registro.resumo ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <AvatarResponsavel nome={registro.nomeAutor} />
                      {registro.nomeAutor}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

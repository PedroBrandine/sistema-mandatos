"use client";

import { use, useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { buscarEncontrosDoMes, type EncontroAgenda } from "@backend/queries/agenda";
import { buscarContratoParaFicha } from "@backend/queries/contrato";
import { buscarRegistrosDaAgenda, type RegistroAgenda } from "@backend/queries/registros-agenda";
import { marcarPresenca } from "@backend/rpc/encontro";
import { descreveErroDesconhecido } from "@backend/rpc/errors";
import { createClient } from "@backend/supabase/client";

import { AgendaMes, hojeNoFusoDoProduto } from "@/components/estrategia/agenda-mes";
import { EncontroPopover } from "@/components/estrategia/encontro-popover";
import { EncontroForm } from "@/components/incidencia/encontro-form";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, "P2: Agenda na
// ficha e Novo Agendamento" AC1/AC3 (FMC-29). tasks.md T37 Done-when: grade do
// mês recortada por CONTRATO (não por produto, ao contrário de
// /produtos/[slug]/agenda), reusando AgendaMes/EncontroPopover/
// buscarEncontrosDoMes/buscarRegistrosDaAgenda (EST-12/13, já entregues por
// redesenho-estrategia-tela-first).
//
// FiltroAgenda (queries/agenda.ts) exige idProduto -- este contrato já
// resolve pra UM produto conhecido (buscarContratoParaFicha), então não há
// barra de filtros de gestora/projeto/contrato aqui: o recorte é fixo no
// próprio contrato da ficha, sempre com idContrato preenchido.
//
// Sem onAdicionarRegistro no EncontroPopover: mesmo caminho de T32
// (encontro-popover.tsx) -- "Adicionar registro" abre RegistroEncontroForm
// inline, já vinculado ao encontro, em vez de navegar para outra rota.
//
// "Novo agendamento" (AC2 da mesma story, FMC-30) não tem Done-when próprio
// nesta task nem é tocado por T38 (Where = só encontro-form.tsx) ou T39
// (Where = só rótulos) -- sem ligar o botão aqui, a ação nunca ganharia
// composição na ficha. EncontroForm é chamado com a MESMA assinatura de hoje
// (idContrato/onConcluido/onCancelar), então a reescrita da T38 não quebra
// esta chamada.
function mesDoDia(dia: string): { ano: number; mes: number } {
  return { ano: Number(dia.slice(0, 4)), mes: Number(dia.slice(5, 7)) };
}

// `ocorrido_em` é DATE puro -- formatar por fatia de string evita o mesmo
// risco de fuso que FUSO_HORARIO_PRODUTO existe para evitar na grade.
function dataBr(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function ContratoAgendaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idContrato = Number(id);

  const queryClient = useQueryClient();

  // L-002: o relógio é lido AQUI, uma vez.
  const hoje = useMemo(() => hojeNoFusoDoProduto(new Date()), []);

  const [periodo, setPeriodo] = useState<{ ano: number; mes: number }>(() => mesDoDia(hoje));
  const [idEncontroSelecionado, setIdEncontroSelecionado] = useState<number | null>(null);
  const [dialogNovoAgendamentoAberto, setDialogNovoAgendamentoAberto] = useState(false);

  const {
    data: contrato,
    isLoading: carregandoContrato,
    isError: erroContrato,
  } = useQuery({
    queryKey: ["contrato-ficha", idContrato],
    queryFn: () => buscarContratoParaFicha(createClient(), idContrato),
  });

  const idProduto = contrato?.idProduto;

  const chaveEncontros = ["ficha-agenda-encontros", idContrato, periodo.ano, periodo.mes] as const;

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
        idContrato,
      }),
    enabled: idProduto !== undefined,
  });

  const {
    data: registros,
    isError: erroRegistros,
    refetch: refetchRegistros,
  } = useQuery({
    queryKey: ["ficha-agenda-registros", idContrato, periodo.ano, periodo.mes, idEncontroSelecionado],
    queryFn: () =>
      buscarRegistrosDaAgenda(createClient(), {
        idProduto: idProduto as number,
        ano: periodo.ano,
        mes: periodo.mes,
        idContrato,
        idEncontro: idEncontroSelecionado ?? undefined,
      }),
    enabled: idProduto !== undefined,
  });

  const encontroSelecionado = encontros?.find((e) => e.idEncontro === idEncontroSelecionado) ?? null;

  const {
    mutate: marcarPresencaNoEncontro,
    isPending: marcandoPresenca,
    error: erroPresencaBruto,
    reset: limparErroPresenca,
  } = useMutation({
    mutationFn: (input: { idEncontro: number }) => marcarPresenca(createClient(), input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: chaveEncontros });
      void queryClient.invalidateQueries({ queryKey: ["ficha-agenda-registros"] });
    },
  });

  const erroPresenca = erroPresencaBruto ? descreveErroDesconhecido(erroPresencaBruto) : null;

  function irParaMes(destino: { ano: number; mes: number }) {
    setIdEncontroSelecionado(null);
    limparErroPresenca();
    setPeriodo(destino);
  }

  function selecionarEncontro(encontro: EncontroAgenda) {
    limparErroPresenca();
    setIdEncontroSelecionado(encontro.idEncontro);
  }

  if (carregandoContrato || carregandoEncontros) {
    return <CarregandoSkeleton variante="cards" />;
  }

  if (erroContrato) {
    return <ErroInline mensagem="Não foi possível carregar o contrato desta ficha." />;
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
      <AgendaMes
        ano={periodo.ano}
        mes={periodo.mes}
        encontros={encontrosDoMes}
        hoje={hoje}
        onMudarMes={irParaMes}
        onSelecionarEncontro={selecionarEncontro}
        onNovoAgendamento={() => setDialogNovoAgendamentoAberto(true)}
      />

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
        <ListaRegistrosDaFicha registros={registrosDoRecorte} mesSemEncontro={encontrosDoMes.length === 0} />
      )}

      <Dialog open={dialogNovoAgendamentoAberto} onOpenChange={setDialogNovoAgendamentoAberto}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
          </DialogHeader>
          <EncontroForm
            idContrato={idContrato}
            onConcluido={() => {
              setDialogNovoAgendamentoAberto(false);
              void queryClient.invalidateQueries({ queryKey: chaveEncontros });
            }}
            onCancelar={() => setDialogNovoAgendamentoAberto(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Lista "Registros de Agenda" recortada pelo contrato da ficha. Colunas na
// MESMA ordem de /produtos/[slug]/agenda hoje (Tipo, Data, Descrição,
// Responsável) -- a correção de rótulo (FMC-33) é escopo da T39, que toca as
// duas telas juntas.
function ListaRegistrosDaFicha({
  registros,
  mesSemEncontro,
}: {
  registros: RegistroAgenda[];
  mesSemEncontro: boolean;
}) {
  return (
    <section className="grid gap-3">
      <div className="grid gap-0.5">
        <h2 className="font-heading text-xl">Registros de Agenda</h2>
        <p className="text-sm text-muted-foreground">
          {registros.length === 1 ? "1 registro encontrado" : `${registros.length} registros encontrados`}
        </p>
      </div>

      {registros.length === 0 ? (
        // Edge case do spec, mesmo texto de /produtos/[slug]/agenda: mês sem
        // encontro renderiza a grade completa e vazia, com o estado
        // explicativo -- nunca uma grade muda sem explicação (AD-005).
        <EstadoVazio
          titulo={mesSemEncontro ? "Nenhum encontro neste mês" : "Nenhum registro no recorte"}
          mensagem={
            mesSemEncontro
              ? "Este mês não tem encontro agendado, por isso a grade está vazia. Use as setas para navegar até outro mês."
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
            {registros.map((registro) => (
              <TableRow key={registro.idRegistro}>
                <TableCell>{registro.tipoRegistro}</TableCell>
                <TableCell>{dataBr(registro.ocorridoEm)}</TableCell>
                {/* Nulo vira ausência explícita, nunca célula em branco (AD-005). */}
                <TableCell>{registro.resumo ?? "—"}</TableCell>
                <TableCell>{registro.nomeAutor}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

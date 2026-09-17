"use client";

import { useState } from "react";
import {
  Calendar,
  CheckSquare,
  Folder,
  Link2,
  type LucideIcon,
  MapPin,
  MessageCircle,
  Tag,
  Users,
} from "lucide-react";
import Link from "next/link";

import type { EncontroAgenda } from "@backend/queries/agenda";
import type { RegistroAgenda } from "@backend/queries/registros-agenda";
import { createClient } from "@backend/supabase/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import {
  RegistroEncontroForm,
  type ParticipanteRegistroEncontro,
} from "../incidencia/registro-encontro-form";
import { diaNoFusoDoProduto, horaNoFusoDoProduto } from "./agenda-mes";

// FMC-14 (design.md, AD-061): exceção documentada à AD-057 -- este popover
// continua abrindo RegistroEncontroForm inline, com Etapa/Tipo/Encontro
// herdados, em vez de redirecionar para a aba de Incidência.
//
// EncontroAgenda (backend/queries/agenda.ts) só resolve nomeEtapa/nomeTipo
// (texto), não os ids numéricos que app.criar_registro exige -- a leitura
// original descarta id_etapa/id_tipo_registro depois de resolver os nomes
// (mesmo padrão de buscarNomesPorId). Tocar agenda.ts para expor os ids
// quebraria os testes `toEqual` de EST-13/agenda.test.ts (feature alheia,
// já validada). Resolução: quando não há `onAdicionarRegistro` (uso novo,
// aba Agenda da ficha), este componente busca id_etapa/id_tipo_registro de
// fat_encontro por id_encontro, e qtd_prevista/schema_campos de
// ref_tipo_registro por id_tipo_registro -- as duas únicas colunas que
// faltam, com uma consulta pequena e local a este arquivo (T32).
function origemParticipanteRegistro(origem: string): ParticipanteRegistroEncontro["origem"] {
  if (origem === "mandato") return "mandato";
  if (origem === "externo") return "externo";
  return "legisla";
}

// EST-13 (T28, design.md "AgendaMes + EncontroPopover"). Tela de ESCRITA --
// AD-046 mantém aqui a profundidade integral de AD-042: os dois lados de cada
// condicional, estado vazio e estado de erro seguem exigidos. Esta task cobre
// só a leitura (AC1, AC2); marcar presença e adicionar registro entram na T30.
//
// O conteúdo é um componente próprio, separado do wrapper de Popover, pelo
// mesmo motivo empírico que levou a extrair useBuscaTse na T22: o Portal do
// Radix atrapalha a asserção direta em jsdom. Assim os testes de exibição
// batem em ConteudoEncontro sem depender do portal, e um teste só cobre a
// composição Popover -> conteúdo.

const STATUS_LABEL: Record<EncontroAgenda["status"], string> = {
  planejado: "Agendada",
  realizado: "Realizada",
  cancelado: "Cancelada",
  remarcado: "Remarcada",
};

const STATUS_VARIANT: Record<EncontroAgenda["status"], "default" | "secondary" | "outline"> = {
  planejado: "default",
  realizado: "secondary",
  cancelado: "outline",
  remarcado: "outline",
};

const MODALIDADE_LABEL: Record<string, string> = {
  presencial: "Presencial",
  online: "Online",
};

// Ausência é "—", nunca string vazia nem valor inventado (AD-005).
const AUSENTE = "—";

const MESES_ABREVIADOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function textoOuAusente(valor: string | null | undefined): string {
  return valor && valor.trim() !== "" ? valor : AUSENTE;
}

// "15/set/2026, 14:00 – 15:30" — formato do Figma 90:206, com o mês abreviado
// em texto. Sem dt_prevista_inicio não há data/horário a exibir: devolve a
// ausência, nunca uma data inventada.
export function formatarDataHorario(inicio: string | null, fim: string | null): string {
  if (!inicio) return AUSENTE;
  const [ano, mes, dia] = diaNoFusoDoProduto(inicio).split("-");
  const base = `${dia}/${MESES_ABREVIADOS[Number(mes) - 1]}/${ano}, ${horaNoFusoDoProduto(inicio)}`;
  return fim ? `${base} – ${horaNoFusoDoProduto(fim)}` : base;
}

// Figma 90:206 junta modalidade e local numa linha só ("Presencial · Gabinete
// 312") em vez de dois campos separados. Cada metade pode faltar
// independentemente: só modalidade, só local, ou nenhum dos dois (AD-005).
export function formatarModalidadeLocal(modalidade: string | null, local: string | null): string {
  const partes = [
    modalidade ? MODALIDADE_LABEL[modalidade] ?? modalidade : null,
    local && local.trim() !== "" ? local : null,
  ].filter((p): p is string => p !== null);
  return partes.length > 0 ? partes.join(" · ") : AUSENTE;
}

// Figma 90:206 mostra os dois primeiros nomes e resume o resto em "+N", em vez
// de derramar a lista inteira numa linha.
const MAX_PARTICIPANTES_VISIVEIS = 2;

export function formatarParticipantes(nomes: string[]): string {
  if (nomes.length === 0) return AUSENTE;
  const visiveis = nomes.slice(0, MAX_PARTICIPANTES_VISIVEIS);
  const restantes = nomes.length - visiveis.length;
  return restantes > 0 ? `${visiveis.join(", ")}, +${restantes}` : visiveis.join(", ");
}

// Linha rótulo/valor do Figma: ícone + rótulo em caixa alta pequeno, valor
// abaixo. Substitui a grade de 2 colunas anterior.
function Campo({
  icone: Icone,
  rotulo,
  valor,
  children,
}: {
  icone: LucideIcon;
  rotulo: string;
  valor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icone aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="grid gap-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </p>
        {children ?? <p className="text-sm">{valor}</p>}
      </div>
    </div>
  );
}

// EST-13 AC3: o aviso e a ação de presença existem só quando a data prevista
// JÁ PASSOU **e** o status é `planejado`. As duas metades são independentes e
// cada uma tem caso dos dois lados no teste (lição L-036): um encontro futuro
// planejado não oferece a ação, e um encontro vencido já realizado também
// não. Comparação de strings "YYYY-MM-DD" no fuso do produto -- nunca Date
// contra Date, que reintroduziria o fuso da máquina.
export function encontroVencido(encontro: EncontroAgenda, hoje: string): boolean {
  if (encontro.status !== "planejado") return false;
  if (!encontro.dtPrevistaInicio) return false;
  return diaNoFusoDoProduto(encontro.dtPrevistaInicio) < hoje;
}

export interface ConteudoEncontroProps {
  encontro: EncontroAgenda;
  /** Registros já filtrados por este encontro (buscarRegistrosDaAgenda, T27). */
  registros: RegistroAgenda[];
  /** Data de referência "YYYY-MM-DD" — explícita, nunca lida do relógio (L-002). */
  hoje: string;
  onMarcarPresenca?: (input: { idEncontro: number }) => void;
  onAdicionarRegistro?: (input: { idEncontro: number; idContrato: number }) => void;
  marcandoPresenca?: boolean;
  /** Falha da RPC de presença, já traduzida por mapeiaErroRpc. */
  erroPresenca?: string | null;
}

export function ConteudoEncontro({
  encontro,
  registros,
  hoje,
  onMarcarPresenca,
  onAdicionarRegistro,
  marcandoPresenca = false,
  erroPresenca = null,
}: ConteudoEncontroProps) {
  const participantes = encontro.participantes.map((p) => p.nome).filter((n) => n.trim() !== "");
  const vencido = encontroVencido(encontro, hoje);

  // T32 (FMC-14): sem `onAdicionarRegistro` (uso novo, aba Agenda da ficha),
  // "Adicionar registro" abre RegistroEncontroForm inline, já vinculado ao
  // encontro -- Etapa/Tipo chegam sem a usuária digitar nada. Com
  // `onAdicionarRegistro` (uso alheio, Agenda produto-escopo de
  // redesenho-estrategia-tela-first, EST-13 AC6), o comportamento antigo de
  // navegação continua intocado.
  const [carregandoDadosRegistro, setCarregandoDadosRegistro] = useState(false);
  const [erroDadosRegistro, setErroDadosRegistro] = useState<string | null>(null);
  const [dadosRegistro, setDadosRegistro] = useState<{
    idEtapa: number;
    idTipoRegistro: number;
    qtdPrevista: number | null;
    schemaCampos: unknown;
  } | null>(null);
  const [mostrarFormularioRegistro, setMostrarFormularioRegistro] = useState(false);

  async function handleAdicionarRegistro() {
    if (onAdicionarRegistro) {
      onAdicionarRegistro({ idEncontro: encontro.idEncontro, idContrato: encontro.idContrato });
      return;
    }

    setErroDadosRegistro(null);
    setCarregandoDadosRegistro(true);
    const supabase = createClient();

    const { data: linhaEncontro, error: erroEncontro } = await supabase
      .from("fat_encontro")
      .select("id_etapa, id_tipo_registro")
      .eq("id_encontro", encontro.idEncontro)
      .maybeSingle();

    if (erroEncontro || !linhaEncontro || linhaEncontro.id_etapa == null || linhaEncontro.id_tipo_registro == null) {
      setCarregandoDadosRegistro(false);
      setErroDadosRegistro("Não foi possível preparar o formulário de registro.");
      return;
    }

    const { data: linhaTipo, error: erroTipo } = await supabase
      .from("ref_tipo_registro")
      .select("qtd_prevista, schema_campos")
      .eq("id_tipo_registro", linhaEncontro.id_tipo_registro)
      .maybeSingle();

    setCarregandoDadosRegistro(false);
    if (erroTipo || !linhaTipo) {
      setErroDadosRegistro("Não foi possível preparar o formulário de registro.");
      return;
    }

    setDadosRegistro({
      idEtapa: linhaEncontro.id_etapa,
      idTipoRegistro: linhaEncontro.id_tipo_registro,
      qtdPrevista: linhaTipo.qtd_prevista,
      schemaCampos: linhaTipo.schema_campos,
    });
    setMostrarFormularioRegistro(true);
  }

  return (
    <div className="grid gap-3">
      {/* Figma 90:206: badge de status ACIMA do título, cada um na sua linha,
          e o título no display da marca. */}
      <div className="grid gap-1.5">
        <div>
          <Badge variant={STATUS_VARIANT[encontro.status]}>{STATUS_LABEL[encontro.status]}</Badge>
        </div>
        <p className="font-heading text-xl text-secondary">{encontro.titulo}</p>
      </div>

      {/* Lista vertical com ícone por campo, na ordem do Figma. Modalidade e
          local ocupam UMA linha ("Presencial · Gabinete 312"). */}
      <div className="grid gap-2.5">
        <Campo icone={Tag} rotulo="Etapa" valor={textoOuAusente(encontro.nomeEtapa)} />
        <Campo icone={Folder} rotulo="Tipo" valor={textoOuAusente(encontro.nomeTipo)} />
        <Campo
          icone={Calendar}
          rotulo="Data e horário"
          valor={formatarDataHorario(encontro.dtPrevistaInicio, encontro.dtPrevistaFim)}
        />
        <Campo
          icone={MapPin}
          rotulo="Modalidade"
          valor={formatarModalidadeLocal(encontro.modalidade, encontro.local)}
        />
        <Campo
          icone={MessageCircle}
          rotulo="Tema"
          valor={textoOuAusente(encontro.temaPrioritario)}
        />
        <Campo icone={Users} rotulo="Participantes">
          <div className="flex items-center gap-2">
            {participantes.length > 0 && (
              <div aria-hidden="true" className="flex -space-x-1.5">
                {participantes.slice(0, 4).map((nome) => (
                  <span
                    key={nome}
                    className="size-5 rounded-full bg-secondary ring-2 ring-popover"
                  />
                ))}
              </div>
            )}
            <p className="text-sm">{formatarParticipantes(participantes)}</p>
          </div>
        </Campo>
      </div>

      {/* EST-13 AC2: contagem e link só existem quando há registro vinculado.
          Sem registro, nem a contagem nem o link são renderizados -- não é um
          "0 registros" cinza, é ausência. Figma 90:206 separa os dois: a
          contagem à esquerda, o link "Ver registros" à direita. */}
      {registros.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="flex items-center gap-2 text-sm">
            <Link2 aria-hidden="true" className="size-4 text-chart-4" />
            {registros.length === 1
              ? "1 registro vinculado"
              : `${registros.length} registros vinculados`}
          </span>
          <Link
            href={`/contratos/${encontro.idContrato}/encontros`}
            className="text-sm font-medium text-secondary underline-offset-4 hover:underline"
          >
            Ver registros →
          </Link>
        </div>
      )}

      {/* EST-13 AC3: aviso + ação de presença, só no encontro vencido e
          planejado. Caixa âmbar do Figma 90:206.
          O controle é BOTÃO com ícone de caixa marcada, não <input checkbox>:
          visualmente é o do desenho, mas marcar presença é uma escrita
          irreversível de mão única (planejado -> realizado), e checkbox
          anuncia estado alternável para leitor de tela. SPEC-PRECISION: o
          Figma desenha o controle, não a semântica. */}
      {vencido && (
        <div className="grid gap-2 rounded-md border border-chart-2 bg-chart-2/20 p-3">
          <p className="text-xs text-foreground">
            A data prevista já passou. Marque presença para registrar como Realizada.
          </p>
          <button
            type="button"
            disabled={marcandoPresenca}
            onClick={() => onMarcarPresenca?.({ idEncontro: encontro.idEncontro })}
            className="flex w-fit items-center gap-2 text-sm font-medium text-foreground disabled:opacity-60"
          >
            <CheckSquare aria-hidden="true" className="size-4" />
            {marcandoPresenca ? "Marcando…" : "Marcar presença"}
          </button>
        </div>
      )}

      {/* Erro da escrita pelo componente padrão do projeto (lição L-008),
          nunca por um elemento ad-hoc. */}
      {erroPresenca && <ErroInline titulo="Não foi possível marcar presença" mensagem={erroPresenca} />}

      {erroDadosRegistro && (
        <ErroInline titulo="Não foi possível abrir o formulário" mensagem={erroDadosRegistro} />
      )}

      {/* T32 (FMC-14, AD-061): com onAdicionarRegistro (uso alheio,
          EST-13 AC6), o botão preserva o comportamento antigo -- os dois
          identificadores vão no callback, sem abrir nada aqui. Sem
          onAdicionarRegistro (uso novo, aba Agenda da ficha), o botão abre
          RegistroEncontroForm inline, já vinculado ao encontro e ao
          contrato, com Etapa/Tipo herdados (T31). */}
      {mostrarFormularioRegistro && dadosRegistro ? (
        <RegistroEncontroForm
          idContrato={encontro.idContrato}
          idEncontro={encontro.idEncontro}
          idEtapa={dadosRegistro.idEtapa}
          idTipoRegistro={dadosRegistro.idTipoRegistro}
          nomeEtapa={textoOuAusente(encontro.nomeEtapa)}
          nomeTipo={textoOuAusente(encontro.nomeTipo)}
          qtdPrevista={dadosRegistro.qtdPrevista}
          schemaCampos={dadosRegistro.schemaCampos}
          encontroDados={{ local: encontro.local }}
          participantesEncontro={encontro.participantes.map((p) => ({
            nomeLivre: p.nome,
            origem: origemParticipanteRegistro(p.origem),
            nome: p.nome,
          }))}
          onConcluido={() => setMostrarFormularioRegistro(false)}
          onCancelar={() => setMostrarFormularioRegistro(false)}
        />
      ) : (
        <Button
          type="button"
          className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
          disabled={carregandoDadosRegistro}
          onClick={() => void handleAdicionarRegistro()}
        >
          {carregandoDadosRegistro ? "Preparando…" : "Adicionar registro"}
        </Button>
      )}
    </div>
  );
}

export interface EncontroPopoverProps extends ConteudoEncontroProps {
  children: React.ReactNode;
  aberto?: boolean;
  onAbertoChange?: (aberto: boolean) => void;
}

// O rest repassa TODAS as props de conteúdo (incluindo hoje, callbacks e
// estado de erro) em vez de listá-las uma a uma: uma prop nova acrescentada a
// ConteudoEncontroProps passa a chegar sozinha, sem virar prop silenciosamente
// descartada aqui.
export function EncontroPopover({
  children,
  aberto,
  onAbertoChange,
  ...conteudo
}: EncontroPopoverProps) {
  return (
    <Popover open={aberto} onOpenChange={onAbertoChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <ConteudoEncontro {...conteudo} />
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type { ObjetivoComMetas, PessoaVinculada, SucessoMensalGrade } from "@backend/queries/planejamento";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { criarSucessosEmLote, moverItemHierarquia } from "@backend/rpc/planejamento";
import {
  sucessoMensalLoteSchema,
  sucessoMensalSchema,
  type SucessoMensalInput,
  type SucessoMensalLoteInput,
} from "@backend/schemas/planejamento";
import { createClient } from "@backend/supabase/client";

import { expandeMesesEmSucessos } from "./planejamento-lote";
import type { PermissoesModo } from "./permissoes";

import { derivaSituacao } from "@/lib/planejamento-formato";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// PF-02 (T8, .specs/features/pente-fino-2026-09/tasks.md), AC2: "situação não
// altera independente da % de atingimento" era o bug relatado -- a edição
// tinha um <Select> de Status totalmente manual, dessincronizado do %. A
// Situação agora é sempre DERIVADA do % de atingimento corrente, nunca
// digitada: >=100 é "realizado", qualquer outro valor (inclusive null, sem
// medição ainda) é "pendente". Mesmos rótulos/badge de
// planejamento-grade.tsx (STATUS_LABEL/STATUS_VARIANT), duplicados aqui em
// vez de exportados de lá -- T8 está escopado só a este arquivo.
//
// `derivaSituacao` mora em lib/planejamento-formato.ts (correção de
// 2026-09-22, .specs/STATE.md): T8 só cobria este modal -- a edição inline da
// grade e o colar em faixa escreviam pct_atingimento sem nunca tocar em
// status, reabrindo o mesmo bug pelos outros três caminhos de escrita. A
// derivação real agora vive num trigger de banco (migration 20260922151933),
// que é quem garante o valor final nos 4 caminhos; esta cópia da função só
// precisa concordar com o trigger para a UI não piscar um valor errado antes
// do round-trip.
const SITUACAO_LABEL: Record<string, string> = {
  pendente: "Pendente",
  realizado: "Realizado",
  nao_realizado: "Não realizado",
};

const SITUACAO_VARIANT: Record<string, "secondary" | "default" | "outline"> = {
  pendente: "secondary",
  realizado: "default",
  nao_realizado: "outline",
};

// PLM-17/18 + PLV-04/05/06 (T19, .specs/features/planejamento-estrategico-v2).
// INSERT/UPDATE direto em fat_sucesso_mensal na EDIÇÃO (AD-024, 1 linha só);
// na CRIAÇÃO passa a ser sempre lote (mesmo 1 mês marcado é um lote de
// tamanho 1) -- app.cria_sucessos_mensais_lote é quem faz o INSERT, nunca o
// cliente.
//
// PLV-05 muda uma decisão de PLM-18: `pct_atingimento` ERA "fora dos dois
// modos, é campo da grade". Agora é o oposto -- "% editável só no SM;
// travado nos demais" (AC7) -- porque é o ÚNICO nível da hierarquia onde o
// número é digitado, não calculado pela cascata. Meta/Objetivo usam
// <CelulaCalculada> (celula-calculada.tsx); Sucesso Mensal usa <Input
// type="number"> de verdade.
//
// Responsável entra aqui (não estava no escopo textual da T19, mas
// pessoasVinculadas já chegava até modal-detalhe-item.tsx sem uso nenhum, e
// sem esta tela `id_usuario_responsavel` não tinha NENHUM caminho de
// escrita -- nem na grade (só lê/deriva, T9), nem em lugar nenhum). O
// Independent Test de PLV-03 ("atribuir responsável só ao primeiro [SM]")
// só é executável se existir onde atribuir.
//
// Criação e edição viraram dois COMPONENTES distintos (SucessoMensalFormCriar/
// SucessoMensalFormEditar) em vez de um `useForm` só com campos condicionais:
// os dois usam schemas diferentes (lote vs. item único, `meses: string[]`
// contra `mes_referencia: string`), e teriam que trocar de resolver e de
// shape do formulário no meio da vida do componente -- React Hook Form não
// foi feito para isso. `SucessoMensalForm` só despacha pelo modo.
export type SucessoMensalFormModo = { tipo: "criar"; idMeta: number } | { tipo: "editar"; sucesso: SucessoMensalGrade };

export interface SucessoMensalFormProps {
  modo: SucessoMensalFormModo;
  pessoasVinculadas: PessoaVinculada[];
  // PLV-09 (T20). Só usados na edição: a Vinculação (select de Meta) e a
  // leitura do Objetivo derivado dela. Criação não move nada -- um SM novo já
  // nasce preso à Meta de onde "+ Novo Sucesso Mensal" foi clicado.
  objetivos: ObjetivoComMetas[];
  permissoes: PermissoesModo;
  onConcluido: () => void;
  onCancelar: () => void;
}

// PLV-09 AC3 (regra inegociável): o Objetivo do SM é SEMPRE leitura, derivado
// da Meta -- nunca um select próprio. O select de Objetivo do SM sugeriria
// que dá para pendurar um Sucesso Mensal direto no Objetivo, o que a FK não
// permite (fat_sucesso_mensal só referencia fat_meta).
function nomeObjetivoDaMeta(objetivos: ObjetivoComMetas[], idMeta: number): string | null {
  return objetivos.find((o) => o.metas.some((m) => m.idMeta === idMeta))?.descricao ?? null;
}

/** "YYYY-MM-DD"/"YYYY-MM-01" -> "YYYY-MM" pro <input type="month">. */
function paraInputMes(dataIso: string): string {
  return dataIso.slice(0, 7);
}

/** "YYYY-MM" do <input type="month"> -> "YYYY-MM-01" (ck_sucesso_mes: sempre dia 1). */
function paraMesReferencia(valorInputMes: string): string {
  return `${valorInputMes}-01`;
}

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function mesesDoAno(ano: number): string[] {
  return MESES_ABREV.map((_, indice) => `${ano}-${String(indice + 1).padStart(2, "0")}-01`);
}

// PLV-06 AC1. Grade de seleção múltipla -- cada tile é um mês marcável, nunca
// um datepicker (mesmo raciocínio do <input type="month"> da edição: a UI
// torna ck_sucesso_mes inatingível em vez de confiar em validação depois).
// Ano fixo no corrente: não há conceito de "ciclo do plano" com início/fim
// definidos em nenhum lugar do schema ou do design -- inventar um seletor de
// ano seria resolver uma pergunta que ninguém fez.
function GradeDeMeses({ selecionados, onAlternar }: { selecionados: string[]; onAlternar: (mes: string) => void }) {
  const ano = new Date().getFullYear();
  const meses = mesesDoAno(ano);
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">Atribuição de meses — {ano}</span>
      <div role="group" aria-label="Meses" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {meses.map((mes, indice) => {
          const marcado = selecionados.includes(mes);
          return (
            <button
              key={mes}
              type="button"
              role="checkbox"
              aria-checked={marcado}
              onClick={() => onAlternar(mes)}
              className={cn(
                "rounded-md border px-2 py-1.5 text-sm transition-colors",
                marcado
                  ? "border-secondary bg-secondary/10 font-medium text-secondary"
                  : "border-input text-muted-foreground hover:bg-muted"
              )}
            >
              {MESES_ABREV[indice]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface CamposCriarProps {
  idMeta: number;
  pessoasVinculadas: PessoaVinculada[];
  onConcluido: () => void;
  onCancelar: () => void;
}

function SucessoMensalFormCriar({ idMeta, pessoasVinculadas, onConcluido, onCancelar }: CamposCriarProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<SucessoMensalLoteInput>({
    resolver: zodResolver(sucessoMensalLoteSchema),
    mode: "onChange",
    defaultValues: {
      id_meta: idMeta,
      descricao: "",
      peso: 100,
      status: "pendente",
      meses: [],
    },
  });

  async function enviar(valores: SucessoMensalLoteInput) {
    setEnviando(true);
    setErro(null);
    const supabase = createClient();

    const base = {
      descricao: valores.descricao,
      peso: valores.peso,
      status: valores.status,
      dtLimite: valores.dt_limite ?? null,
      // % de atingimento NÃO entra na base do lote (AD-005): um Sucesso
      // Mensal recém-criado nasce sem medição, e pré-preencher todos os N
      // irmãos com o mesmo % seria fingir uma medição que ainda não
      // aconteceu. Quem quiser medir, mede depois, um a um, na edição.
      pctAtingimento: null,
      idUsuarioResponsavel: valores.id_usuario_responsavel ?? null,
    };

    try {
      // expandeMesesEmSucessos NÃO escreve -- só normaliza a seleção da grade
      // no array que a RPC espera (dedupe, dia 1, ordenado). A escrita é
      // sempre criarSucessosEmLote: um INSERT atômico, uma cascata só (AC6).
      const { meses } = expandeMesesEmSucessos(base, valores.meses, idMeta);
      await criarSucessosEmLote(supabase, idMeta, base, meses);
    } catch (erroCapturado) {
      setEnviando(false);
      setErro(erroCapturado instanceof Error ? erroCapturado.message : "Erro ao criar os Sucessos Mensais.");
      return;
    }

    setEnviando(false);
    onConcluido();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(enviar)} className="grid gap-4 rounded-lg border p-4">
        <FormField
          control={form.control}
          name="descricao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição do Sucesso Mensal</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="id_usuario_responsavel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Responsável (opcional)</FormLabel>
              <Select
                value={field.value ? String(field.value) : undefined}
                onValueChange={(v) => field.onChange(Number(v))}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Herda o da Meta" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {pessoasVinculadas.map((p) => (
                    <SelectItem key={p.idUsuario} value={String(p.idUsuario)}>
                      {p.nome} ({p.papelNoContrato})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="peso"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Peso (0–100)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dt_limite"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prazo (opcional)</FormLabel>
              <FormControl>
                <Input type="date" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="meses"
          render={({ field }) => (
            <FormItem>
              <GradeDeMeses
                selecionados={field.value}
                onAlternar={(mes) =>
                  field.onChange(field.value.includes(mes) ? field.value.filter((m) => m !== mes) : [...field.value, mes])
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />
        {erro && <ErroInline mensagem={erro} />}
        <div className="flex gap-2">
          <Button type="submit" disabled={enviando || !form.formState.isValid}>
            {enviando ? "Salvando..." : "Criar Sucesso Mensal"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}

interface CamposEditarProps {
  sucesso: SucessoMensalGrade;
  pessoasVinculadas: PessoaVinculada[];
  objetivos: ObjetivoComMetas[];
  permissoes: PermissoesModo;
  onConcluido: () => void;
  onCancelar: () => void;
}

function SucessoMensalFormEditar({ sucesso, pessoasVinculadas, objetivos, permissoes, onConcluido, onCancelar }: CamposEditarProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<SucessoMensalInput>({
    resolver: zodResolver(sucessoMensalSchema),
    mode: "onChange",
    defaultValues: {
      id_sucesso: sucesso.idSucesso,
      id_meta: sucesso.idMeta,
      descricao: sucesso.descricao,
      mes_referencia: sucesso.mesReferencia,
      dt_limite: sucesso.dtLimite,
      peso: sucesso.peso,
      pct_atingimento: sucesso.pctAtingimento,
      status: sucesso.status,
      id_usuario_responsavel: sucesso.idUsuarioResponsavel,
    },
  });

  // Metas de todo o Planejamento, achatadas -- candidatas a destino da
  // vinculação. O Objetivo (leitura) é derivado do id_meta SELECIONADO no
  // formulário agora, não do banco: é assim que "leitura, nunca editável
  // diretamente" fica óbvio na tela -- escolher outra Meta muda o Objetivo
  // mostrado, sem que o usuário tenha tocado num select de Objetivo.
  const metas = objetivos.flatMap((o) => o.metas);
  const idMetaAtual = form.watch("id_meta");
  const nomeObjetivo = nomeObjetivoDaMeta(objetivos, idMetaAtual);

  async function enviar(valores: SucessoMensalInput) {
    setEnviando(true);
    setErro(null);
    const supabase = createClient();

    const payload = {
      descricao: valores.descricao,
      mes_referencia: valores.mes_referencia,
      dt_limite: valores.dt_limite ?? null,
      peso: valores.peso,
      pct_atingimento: valores.pct_atingimento ?? null,
      // AC2: Situação é sempre derivada do % corrente no momento do submit,
      // nunca o valor que viesse de um <Select> manual -- ver derivaSituacao.
      status: derivaSituacao(valores.pct_atingimento),
      id_usuario_responsavel: valores.id_usuario_responsavel ?? null,
    };

    // PLV-09 AC2. Mesma ordem de MetaForm: a RPC que cruza tabelas primeiro
    // (troca a FK, marca as DUAS Metas envolvidas como desatualizadas,
    // AD-024), o UPDATE comum depois. Payload nunca inclui id_meta.
    if (valores.id_meta !== sucesso.idMeta) {
      try {
        await moverItemHierarquia(supabase, "sucesso", sucesso.idSucesso, valores.id_meta);
      } catch (erroCapturado) {
        setEnviando(false);
        setErro(erroCapturado instanceof Error ? erroCapturado.message : "Erro ao mover o Sucesso Mensal de Meta.");
        return;
      }
    }

    const { error } = await supabase.from("fat_sucesso_mensal").update(payload).eq("id_sucesso", sucesso.idSucesso);
    setEnviando(false);
    if (error) {
      setErro(mapeiaErroRpc(error).message);
      return;
    }
    onConcluido();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(enviar)} className="grid gap-4 rounded-lg border p-4">
        <FormField
          control={form.control}
          name="descricao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição do Sucesso Mensal</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="id_usuario_responsavel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Responsável (opcional)</FormLabel>
              <Select
                value={field.value ? String(field.value) : undefined}
                onValueChange={(v) => field.onChange(Number(v))}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Herda o da Meta" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {pessoasVinculadas.map((p) => (
                    <SelectItem key={p.idUsuario} value={String(p.idUsuario)}>
                      {p.nome} ({p.papelNoContrato})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* PLV-04 AC2/AC3 / Edge Case do spec.md: seletor de mês, nunca campo de
            data livre -- ck_sucesso_mes exige sempre dia 1, <input
            type="month"> torna esse erro inatingível pela UI. Distinto de
            Prazo (dt_limite) logo abaixo -- são campos diferentes. */}
        <FormField
          control={form.control}
          name="mes_referencia"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mês de referência</FormLabel>
              <FormControl>
                <Input
                  type="month"
                  value={field.value ? paraInputMes(field.value) : ""}
                  onChange={(e) => field.onChange(e.target.value ? paraMesReferencia(e.target.value) : "")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* PLV-09 AC2/AC3. Vinculação inteira gated por moveHierarquia -- sem a
            capacidade, nem o select de Meta nem a leitura de Objetivo aparecem
            (mesmo raciocínio de crudHierarquia/Editar em outros forms: sem a
            capacidade, a seção some por completo, não vira texto morto). */}
        {permissoes.moveHierarquia && (
          <div className="grid gap-4 rounded-md border p-3">
            <FormField
              control={form.control}
              name="id_meta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vinculação — Meta</FormLabel>
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {metas.map((m) => (
                        <SelectItem key={m.idMeta} value={String(m.idMeta)}>
                          {m.descricao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* AC3, regra inegociável: Objetivo é SEMPRE leitura aqui -- nunca
                um <Select>. Um select sugeriria pendurar o SM direto no
                Objetivo, o que fat_sucesso_mensal.id_meta não permite. */}
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Objetivo</span>
              <p className="text-sm text-muted-foreground">{nomeObjetivo ?? "—"}</p>
            </div>
          </div>
        )}
        <FormField
          control={form.control}
          name="peso"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Peso (0–100)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dt_limite"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prazo (opcional)</FormLabel>
              <FormControl>
                <Input type="date" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* PLV-05 AC7: único nível da hierarquia onde % é DIGITADO, não
            calculado -- <Input> de verdade, nunca <CelulaCalculada> (essa é a
            trava de Meta/Objetivo, PLR-10). Limpar o campo grava NULL (mesma
            convenção de handleEdicaoCelula na grade), não 0 -- ausência de
            medição é diferente de medição zero (AD-005). */}
        <FormField
          control={form.control}
          name="pct_atingimento"
          render={({ field }) => (
            <FormItem>
              <FormLabel>% de atingimento</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* AC2: Situação nunca é um <Select> aqui -- é a mesma leitura que o
            Objetivo já usa (texto/derivado), recalculada a cada tecla no %
            (form.watch), nunca setada manualmente pela usuária. */}
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Situação</span>
          <div>
            {(() => {
              const situacao = derivaSituacao(form.watch("pct_atingimento"));
              return <Badge variant={SITUACAO_VARIANT[situacao]}>{SITUACAO_LABEL[situacao]}</Badge>;
            })()}
          </div>
        </div>
        {erro && <ErroInline mensagem={erro} />}
        <div className="flex gap-2">
          <Button type="submit" disabled={enviando || !form.formState.isValid}>
            {enviando ? "Salvando..." : "Salvar alterações"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function SucessoMensalForm({ modo, pessoasVinculadas, objetivos, permissoes, onConcluido, onCancelar }: SucessoMensalFormProps) {
  if (modo.tipo === "criar") {
    return (
      <SucessoMensalFormCriar
        idMeta={modo.idMeta}
        pessoasVinculadas={pessoasVinculadas}
        onConcluido={onConcluido}
        onCancelar={onCancelar}
      />
    );
  }
  return (
    <SucessoMensalFormEditar
      sucesso={modo.sucesso}
      pessoasVinculadas={pessoasVinculadas}
      objetivos={objetivos}
      permissoes={permissoes}
      onConcluido={onConcluido}
      onCancelar={onCancelar}
    />
  );
}

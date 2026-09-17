"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import type { ObjetivoComMetas } from "@backend/queries/planejamento";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { objetivoEspecificoSchema, type ObjetivoEspecificoInput } from "@backend/schemas/planejamento";
import { createClient } from "@backend/supabase/client";

import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RefOption {
  id: number;
  nome: string;
}

// PLM-10/PLM-12. INSERT ou UPDATE direto (fat_objetivo_especifico), sem RPC
// -- 1 linha só, sem invariante multi-tabela (AD-024), mesmo padrão de
// ContratoForm (modo "abrir"/"encerrar" -> aqui "criar"/"editar").
// Renderização inline condicional na página, sem <Dialog> -- não há
// precedente de dialog de criação neste repo (só ConfirmDeleteDialog); os
// formulários existentes (ContratoForm, CoalizaoForm) já seguem esse padrão.
//
// SWOT (oportunidade/ameaca) saiu do produto (AD-049): o formulário não
// oferece mais os dois campos e o payload não os envia. As colunas seguem em
// fat_objetivo_especifico com o dado histórico -- remoção de coluna é decisão
// separada, ver AD-049.
//
// PLV-07 + decisão de Pedro (2026-09-16): Preditor 1º/2º e Agenda temática
// FICAM, embora o modal do Figma (271:808) não os desenhe. O sistema grava os
// três campos no Objetivo e a grade os exibe na linha do Objetivo -- tirá-los
// daqui deixaria valor em tela sem nenhum caminho de edição.
export type ObjetivoFormModo = { tipo: "criar"; idPlanejamento: number } | { tipo: "editar"; objetivo: ObjetivoComMetas };

export interface ObjetivoFormProps {
  modo: ObjetivoFormModo;
  onConcluido: (criado?: { idObjetivo: number }) => void;
  onCancelar: () => void;
}

export function ObjetivoForm({ modo, onConcluido, onCancelar }: ObjetivoFormProps) {
  const [preditores, setPreditores] = useState<RefOption[]>([]);
  const [agendas, setAgendas] = useState<RefOption[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const STATUS_OBJETIVO = [
    // PLV-02. Masculino de propósito: ck_objetivo_status usa ativo/pausado/
    // descartado porque Objetivo é masculino; a Meta usa o feminino.
    { valor: "ativo", rotulo: "Ativo" },
    { valor: "pausado", rotulo: "Pausado" },
    { valor: "descartado", rotulo: "Descartado" },
  ] as const;

  const form = useForm<ObjetivoEspecificoInput>({
    resolver: zodResolver(objetivoEspecificoSchema),
    mode: "onChange",
    defaultValues:
      modo.tipo === "criar"
        ? { id_planejamento: modo.idPlanejamento, descricao: "", status: "ativo" }
        : {
            id_objetivo: modo.objetivo.idObjetivo,
            id_planejamento: modo.objetivo.idPlanejamento,
            descricao: modo.objetivo.descricao,
            id_preditor_primario: modo.objetivo.idPreditorPrimario,
            id_preditor_secundario: modo.objetivo.idPreditorSecundario,
            id_agenda: modo.objetivo.idAgenda,
            // PLV-02. O controle de Status entra em T17; aqui o valor só precisa
            // existir porque objetivoEspecificoSchema.status é obrigatório (sem
            // .default(), mesma convenção de metaSchema).
            status: modo.objetivo.status ?? "ativo",
          },
  });

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("ref_preditor")
      .select("id_preditor, nome")
      .eq("ativo", true)
      .then(({ data }) => setPreditores((data ?? []).map((p) => ({ id: p.id_preditor, nome: p.nome }))));
    supabase
      .from("ref_agenda_tematica")
      .select("id_agenda, nome")
      .eq("ativo", true)
      .then(({ data }) => setAgendas((data ?? []).map((a) => ({ id: a.id_agenda, nome: a.nome }))));
  }, []);

  async function enviar(valores: ObjetivoEspecificoInput) {
    setEnviando(true);
    setErro(null);
    const supabase = createClient();

    // PLV-02. `status` FALTAVA aqui: o schema já o exigia e o formulário já o
    // tinha em defaultValues, mas ele nunca entrava no payload -- editar um
    // Objetivo pausado o devolvia a 'ativo' em silêncio, porque o UPDATE não
    // mandava a coluna e o DEFAULT não é reaplicado em UPDATE... pior: o valor
    // antigo ficava, e a escolha do usuário era descartada sem aviso.
    const payload = {
      descricao: valores.descricao,
      status: valores.status,
      id_preditor_primario: valores.id_preditor_primario ?? null,
      id_preditor_secundario: valores.id_preditor_secundario ?? null,
      id_agenda: valores.id_agenda ?? null,
    };

    if (modo.tipo === "criar") {
      const { data, error } = await supabase
        .from("fat_objetivo_especifico")
        .insert({ id_planejamento: modo.idPlanejamento, ...payload })
        .select("id_objetivo")
        .single();
      setEnviando(false);
      if (error) {
        setErro(mapeiaErroRpc(error).message);
        return;
      }
      onConcluido(data ? { idObjetivo: data.id_objetivo } : undefined);
      return;
    }

    const { error } = await supabase.from("fat_objetivo_especifico").update(payload).eq("id_objetivo", modo.objetivo.idObjetivo);
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
              <FormLabel>Descrição do Objetivo</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {STATUS_OBJETIVO.map((s) => (
                    <SelectItem key={s.valor} value={s.valor}>
                      {s.rotulo}
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
          name="id_preditor_primario"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preditor primário (opcional)</FormLabel>
              <Select
                value={field.value ? String(field.value) : undefined}
                onValueChange={(v) => {
                  const novoPrimario = Number(v);
                  field.onChange(novoPrimario);
                  // ck_objetivo_preditores: secundário não pode repetir o
                  // primário. Trocar o primário para o valor que o secundário já
                  // tinha violaria a constraint em silêncio até o submit --
                  // limpa aqui, no mesmo instante da troca.
                  if (form.getValues("id_preditor_secundario") === novoPrimario) {
                    form.setValue("id_preditor_secundario", null);
                  }
                }}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {preditores.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.nome}
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
          name="id_preditor_secundario"
          render={({ field }) => {
            // ck_objetivo_preditores: secundário exige primário e não pode
            // repeti-lo. Desabilitar em vez de deixar o Select aberto e falhar
            // só no submit -- o gate aparece no exato controle que causaria a
            // violação, no momento em que ela seria possível.
            const primario = form.watch("id_preditor_primario");
            return (
              <FormItem>
                <FormLabel>Preditor secundário (opcional)</FormLabel>
                <Select
                  disabled={primario == null}
                  value={field.value ? String(field.value) : undefined}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={primario == null ? "Escolha o primário primeiro" : "Nenhum"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {preditores
                      .filter((p) => p.id !== primario)
                      .map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            );
          }}
        />
        <FormField
          control={form.control}
          name="id_agenda"
          render={({ field }) => (
            <FormItem>
              {/* CAT-16: ref_agenda_tematica está vazio de propósito (levantamento
                  humano pendente) -- placeholder marcado em vez de rótulo limpo,
                  pra não sugerir catálogo aprovado (checklist figma-dominio-legisla). */}
              <FormLabel>Agenda temática {agendas.length === 0 && "(catálogo pendente)"} (opcional)</FormLabel>
              <Select
                value={field.value ? String(field.value) : undefined}
                onValueChange={(v) => field.onChange(Number(v))}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {agendas.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {erro && <ErroInline mensagem={erro} />}
        <div className="flex gap-2">
          <Button type="submit" disabled={enviando || !form.formState.isValid}>
            {enviando ? "Salvando..." : modo.tipo === "criar" ? "Criar Objetivo" : "Salvar alterações"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}

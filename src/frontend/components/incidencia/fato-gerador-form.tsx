"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { buscarInsightsDoContrato, buscarNiveisIip, buscarTipologiasAtivas, type RefOption } from "@backend/queries/incidencia";
import { buscarPlanejamentoCompleto } from "@backend/queries/planejamento";
import { criarFatoGerador } from "@backend/rpc/fato-gerador";
import { fatoGeradorSchema, type FatoGeradorInput } from "@backend/schemas/fato-gerador";
import { createClient } from "@backend/supabase/client";

import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const SEM_VINCULO = "_nenhum";

// INC-01, INC-02. Componente "burro" quanto a Dialog -- só recebe callbacks,
// nunca sabe se está num <Dialog> ou inline (mesmo padrão de UsuarioForm, ver
// design.md/context.md "Onde vivem as novas ações de UI"). Chama
// app.criar_fato_gerador (RPC, AD-024) via criarFatoGerador -- fato +
// vínculo(s) opcional(is) na mesma transação, id_usuario_autor resolvido no
// servidor (app.id_usuario()), nunca enviado pelo client.
export interface FatoGeradorFormProps {
  idContrato: number;
  onConcluido: (criado?: { idFatoGerador: number }) => void;
  onCancelar: () => void;
}

export function FatoGeradorForm({ idContrato, onConcluido, onCancelar }: FatoGeradorFormProps) {
  const [tipologias, setTipologias] = useState<RefOption[]>([]);
  const [niveis, setNiveis] = useState<{ codigo: string; rotulo: string }[]>([]);
  const [preditores, setPreditores] = useState<RefOption[]>([]);
  const [metas, setMetas] = useState<RefOption[]>([]);
  const [insights, setInsights] = useState<RefOption[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<FatoGeradorInput>({
    resolver: zodResolver(fatoGeradorSchema),
    mode: "onChange",
    defaultValues: {
      id_contrato: idContrato,
      dt_ocorrencia: new Date().toISOString().slice(0, 10),
    },
  });

  useEffect(() => {
    const supabase = createClient();

    // Catálogos -- mesmo padrão inline de objetivo-form.tsx (ref_preditor
    // fetched direto do form, não centralizado em queries/).
    void buscarTipologiasAtivas(supabase).then(setTipologias);
    void buscarNiveisIip(supabase).then(setNiveis);
    void buscarInsightsDoContrato(supabase, idContrato).then((lista) =>
      setInsights(lista.map((i) => ({ id: i.idInsight, nome: i.conteudo.slice(0, 60) })))
    );
    supabase
      .from("ref_preditor")
      .select("id_preditor, nome")
      .eq("ativo", true)
      .then(({ data }) => setPreditores((data ?? []).map((p) => ({ id: p.id_preditor, nome: p.nome }))));
    void buscarPlanejamentoCompleto(supabase, idContrato).then((planejamento) =>
      setMetas(
        (planejamento?.objetivos ?? []).flatMap((o) => o.metas.map((m) => ({ id: m.idMeta, nome: m.descricao })))
      )
    );
  }, [idContrato]);

  async function enviar(valores: FatoGeradorInput) {
    setEnviando(true);
    setErro(null);
    const supabase = createClient();
    try {
      const { idFatoGerador } = await criarFatoGerador(supabase, {
        idContrato: valores.id_contrato,
        idTipologia: valores.id_tipologia,
        nivelD1: valores.nivel_d1 ?? null,
        nivelD2: valores.nivel_d2 ?? null,
        nivelD3: valores.nivel_d3 ?? null,
        idPreditor1: valores.id_preditor_1 ?? null,
        idPreditor2: valores.id_preditor_2 ?? null,
        contribuicaoLegisla: valores.contribuicao_legisla ?? null,
        descricaoEvidencia: valores.descricao_evidencia ?? null,
        dtOcorrencia: valores.dt_ocorrencia,
        idMetaOrigem: valores.id_meta_origem ?? null,
        idInsightOrigem: valores.id_insight_origem ?? null,
      });
      onConcluido({ idFatoGerador });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao criar Fato Gerador.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(enviar)} className="grid gap-4">
        <FormField
          control={form.control}
          name="id_tipologia"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipologia</FormLabel>
              <Select value={field.value ? String(field.value) : undefined} onValueChange={(v) => field.onChange(Number(v))}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a tipologia" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {tipologias.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(["nivel_d1", "nivel_d2", "nivel_d3"] as const).map((nome, i) => (
            <FormField
              key={nome}
              control={form.control}
              name={nome}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{`Nível D${i + 1}`}</FormLabel>
                  <Select
                    value={field.value ?? SEM_VINCULO}
                    onValueChange={(v) => field.onChange(v === SEM_VINCULO ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={SEM_VINCULO}>Nenhum</SelectItem>
                      {niveis.map((n) => (
                        <SelectItem key={n.codigo} value={n.codigo}>
                          {n.rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
        {/* ck_fato_niveis (ao menos um D1/D2/D3) -- mensagem de refine vive em nivel_d1, mostrada uma vez só */}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="id_preditor_1"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preditor primário (opcional)</FormLabel>
                <Select
                  value={field.value ? String(field.value) : SEM_VINCULO}
                  onValueChange={(v) => field.onChange(v === SEM_VINCULO ? null : Number(v))}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SEM_VINCULO}>Nenhum</SelectItem>
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
            name="id_preditor_2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preditor secundário (opcional)</FormLabel>
                <Select
                  value={field.value ? String(field.value) : SEM_VINCULO}
                  onValueChange={(v) => field.onChange(v === SEM_VINCULO ? null : Number(v))}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SEM_VINCULO}>Nenhum</SelectItem>
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
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="contribuicao_legisla"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contribuição Legisla (0-5, opcional)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={5}
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dt_ocorrencia"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de ocorrência</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="descricao_evidencia"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição / evidência (opcional)</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} rows={2} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="id_meta_origem"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meta de origem (opcional)</FormLabel>
                <Select
                  value={field.value ? String(field.value) : SEM_VINCULO}
                  onValueChange={(v) => field.onChange(v === SEM_VINCULO ? null : Number(v))}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SEM_VINCULO}>Nenhuma</SelectItem>
                    {metas.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.nome}
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
            name="id_insight_origem"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Insight de origem (opcional)</FormLabel>
                <Select
                  value={field.value ? String(field.value) : SEM_VINCULO}
                  onValueChange={(v) => field.onChange(v === SEM_VINCULO ? null : Number(v))}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SEM_VINCULO}>Nenhum</SelectItem>
                    {insights.map((i) => (
                      <SelectItem key={i.id} value={String(i.id)}>
                        {i.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {erro && <ErroInline mensagem={erro} />}
        <div className="flex gap-2">
          <Button type="submit" disabled={enviando || !form.formState.isValid}>
            {enviando ? "Salvando..." : "Criar Fato Gerador"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}

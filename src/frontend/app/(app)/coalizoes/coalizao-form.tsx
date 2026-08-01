"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Check, Flag, Globe2, Layers, MapPin, Sparkles } from "lucide-react";

import { DuplicataDetectadaError } from "@backend/rpc/errors";
import { criarCoalizao } from "@backend/rpc/coalizao";
import { coalizaoSchema } from "@backend/schemas/coalizao";
import { contratanteSchema } from "@backend/schemas/contratante";
import { createClient } from "@backend/supabase/client";
import type { CoalizaoCriada, ContratanteSimilar } from "@backend/types/fundacao";

import { DuplicataWarningDialog } from "@/components/fundacao/duplicata-warning-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const AGENDAS_TEMATICAS_SUGERIDAS = [
  "Educação",
  "Saúde",
  "Segurança Pública",
  "Meio Ambiente & Clima",
  "Economia & Finanças",
  "Direitos Humanos",
  "Infraestrutura & Mobilidade",
  "Tecnologia & Inovação",
  "Assistência Social",
  "Cultura & Esporte",
  "Desenvolvimento Regional",
  "Reforma Tributária",
];

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const criarCoalizaoFormSchema = z.object({
  contratante: contratanteSchema,
  coalizao: coalizaoSchema,
});
type CriarCoalizaoFormValues = z.infer<typeof criarCoalizaoFormSchema>;

export interface CoalizaoFormProps {
  onCriada: (coalizao: CoalizaoCriada) => void;
}

export function CoalizaoForm({ onCriada }: CoalizaoFormProps) {
  const [similares, setSimilares] = useState<ContratanteSimilar[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<CriarCoalizaoFormValues>({
    resolver: zodResolver(criarCoalizaoFormSchema),
    mode: "onChange",
    defaultValues: {
      contratante: { nome: "", sg_uf: null, nm_municipio: null },
      coalizao: {
        classificacao: "Subnacional",
        agenda_tematica: [],
        possui_planejamento_proprio: false,
      },
    },
  });

  const agendaAtual = form.watch("coalizao.agenda_tematica") || [];
  const classificacaoAtual = form.watch("coalizao.classificacao");

  function toggleAgenda(item: string) {
    const atual = new Set(agendaAtual);
    if (atual.has(item)) {
      atual.delete(item);
    } else {
      atual.add(item);
    }
    form.setValue("coalizao.agenda_tematica", Array.from(atual), { shouldValidate: true, shouldDirty: true });
  }

  async function enviar(valores: CriarCoalizaoFormValues, ignorarDuplicata = false) {
    setEnviando(true);
    setErro(null);
    try {
      const supabase = createClient();
      const resultado = await criarCoalizao(supabase, {
        contratante: valores.contratante,
        coalizao: valores.coalizao,
        ignorarDuplicata,
      });
      setSimilares(null);
      onCriada(resultado);
    } catch (e) {
      if (e instanceof DuplicataDetectadaError) {
        setSimilares(e.similares);
      } else {
        setErro(e instanceof Error ? e.message : "Erro ao cadastrar coalizão.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => enviar(v))} className="grid gap-6">
          {/* Nome da Coalizão */}
          <FormField
            control={form.control}
            name="contratante.nome"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold text-sm">Nome da Coalizão</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} placeholder="Ex: Frente de Defesa da Primeira Infância" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Classificação: Nacional vs Subnacional */}
          <div className="space-y-2">
            <FormLabel className="font-semibold text-sm">Classificação Geográfica</FormLabel>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  form.setValue("coalizao.classificacao", "Nacional", { shouldValidate: true });
                  form.setValue("contratante.sg_uf", null);
                }}
                className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  classificacaoAtual === "Nacional"
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary font-bold shadow-sm"
                    : "border-border hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                <Globe2 className="size-5 shrink-0" />
                <div>
                  <div className="text-xs uppercase tracking-wider font-bold">Nacional</div>
                  <div className="text-[11px] opacity-80">Abrangência em todo o território federal</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => form.setValue("coalizao.classificacao", "Subnacional", { shouldValidate: true })}
                className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  classificacaoAtual === "Subnacional"
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary font-bold shadow-sm"
                    : "border-border hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                <MapPin className="size-5 shrink-0" />
                <div>
                  <div className="text-xs uppercase tracking-wider font-bold">Subnacional</div>
                  <div className="text-[11px] opacity-80">Atuação estadual ou municipal específica</div>
                </div>
              </button>
            </div>
          </div>

          {/* Seleção de UF e Município se Subnacional */}
          {classificacaoAtual === "Subnacional" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border p-4 bg-muted/20 animate-in fade-in duration-300">
              <FormField
                control={form.control}
                name="contratante.sg_uf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado (UF)</FormLabel>
                    <FormControl>
                      <select
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">Selecione a UF</option>
                        {UFS.map((uf) => (
                          <option key={uf} value={uf}>
                            {uf}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contratante.nm_municipio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Município (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="Ex: Campinas" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Agenda Temática (Múltipla Seleção com Tags) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <FormLabel className="font-semibold text-sm flex items-center gap-1.5">
                <Sparkles className="size-4 text-amber-500" /> Agenda Temática (Múltipla Seleção)
              </FormLabel>
              {agendaAtual.length > 0 && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {agendaAtual.length} selecionada(s)
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {AGENDAS_TEMATICAS_SUGERIDAS.map((item) => {
                const selecionado = agendaAtual.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleAgenda(item)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      selecionado
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {selecionado && <Check className="size-3" />}
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Planejamento Próprio */}
          <FormField
            control={form.control}
            name="coalizao.possui_planejamento_proprio"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-3 rounded-xl border p-4 shadow-sm bg-card">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value ?? false}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </FormControl>
                <div className="space-y-0.5 cursor-pointer" onClick={() => field.onChange(!field.value)}>
                  <FormLabel className="!mt-0 font-semibold cursor-pointer">Possui Planejamento Próprio</FormLabel>
                  <p className="text-xs text-muted-foreground">Marque se a coalizão gerencia planejamento estratégico autônomo</p>
                </div>
              </FormItem>
            )}
          />

          {erro && <p className="text-sm font-medium text-red-500">{erro}</p>}

          <Button type="submit" disabled={enviando} size="lg" className="w-full sm:w-auto font-semibold">
            {enviando ? "Salvando Coalizão..." : "Cadastrar Coalizão"}
          </Button>
        </form>
      </Form>

      {similares && (
        <DuplicataWarningDialog
          candidatos={similares}
          onConfirmar={() => void enviar(form.getValues(), true)}
          onCancelar={() => setSimilares(null)}
        />
      )}
    </>
  );
}

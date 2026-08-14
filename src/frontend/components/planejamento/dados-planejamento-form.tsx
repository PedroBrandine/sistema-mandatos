"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import type { PlanejamentoCompleto, PreditorPrioritarioLinha } from "@backend/queries/planejamento";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { substituirPreditoresPlanejamento } from "@backend/rpc/planejamento";
import { dadosPlanejamentoSchema, type DadosPlanejamentoInput } from "@backend/schemas/planejamento";
import { createClient } from "@backend/supabase/client";

import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface RefOption {
  id: number;
  nome: string;
}

// PLM-15/16. dim_planejamento já existe sempre (1:1 com fat_contrato, criada
// por operacao-regua-instanciacao) -- este form é sempre UPDATE, nunca
// INSERT (diferente de ObjetivoForm/MetaForm/SucessoMensalForm, que também
// criam). objetivo_ano/legado/analise_conjuntura/id_perfil_atuacao via
// UPDATE direto (AD-024, 1 linha); os até-3 preditores prioritários via
// app.substitui_preditores_planejamento (T18, RPC nova -- DELETE+INSERT do
// conjunto inteiro precisa de atomicidade, AD-024).
//
// 3 slots fixos de Select (não um array dinâmico) -- o schema já limita a 3
// (ck_planejamento_preditor_ordem BETWEEN 1 AND 3), simples o bastante pra
// não precisar de useFieldArray.
export interface DadosPlanejamentoFormProps {
  planejamento: PlanejamentoCompleto;
  preditoresAtuais: PreditorPrioritarioLinha[];
  // PLR-05 (.specs/features/planejamento-estrategico-redesenho): perfil de atuacao
  // (id_perfil_atuacao/ref_perfil_atuacao) so existe no levantamento de campos por
  // produto do PLL -- Estrategia/Coalizao nunca usam esse campo (gap real: antes
  // desta feature o formulario mostrava sempre, para os 3 produtos).
  produtoNome: string;
  onConcluido: () => void;
}

export function DadosPlanejamentoForm({ planejamento, preditoresAtuais, produtoNome, onConcluido }: DadosPlanejamentoFormProps) {
  const [perfis, setPerfis] = useState<RefOption[]>([]);
  const [preditoresDisponiveis, setPreditoresDisponiveis] = useState<RefOption[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const porOrdem = new Map(preditoresAtuais.map((p) => [p.ordem, p.idPreditor]));
  const [slotsPreditores, setSlotsPreditores] = useState<(number | null)[]>([
    porOrdem.get(1) ?? null,
    porOrdem.get(2) ?? null,
    porOrdem.get(3) ?? null,
  ]);

  const form = useForm<DadosPlanejamentoInput>({
    resolver: zodResolver(dadosPlanejamentoSchema),
    mode: "onChange",
    defaultValues: {
      objetivo_ano: planejamento.objetivoAno,
      legado: planejamento.legado,
      analise_conjuntura: planejamento.analiseConjuntura,
      id_perfil_atuacao: planejamento.idPerfilAtuacao,
    },
  });

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("ref_perfil_atuacao")
      .select("id_perfil, nome")
      .eq("ativo", true)
      .then(({ data }) => setPerfis((data ?? []).map((p) => ({ id: p.id_perfil, nome: p.nome }))));
    supabase
      .from("ref_preditor")
      .select("id_preditor, nome")
      .eq("ativo", true)
      .then(({ data }) => setPreditoresDisponiveis((data ?? []).map((p) => ({ id: p.id_preditor, nome: p.nome }))));
  }, []);

  async function enviar(valores: DadosPlanejamentoInput) {
    setEnviando(true);
    setErro(null);
    const supabase = createClient();

    const { error } = await supabase
      .from("dim_planejamento")
      .update({
        objetivo_ano: valores.objetivo_ano ?? null,
        legado: valores.legado ?? null,
        analise_conjuntura: valores.analise_conjuntura ?? null,
        id_perfil_atuacao: valores.id_perfil_atuacao ?? null,
      })
      .eq("id_planejamento", planejamento.idPlanejamento);
    if (error) {
      setEnviando(false);
      setErro(mapeiaErroRpc(error).message);
      return;
    }

    try {
      const preditoresParaSalvar = slotsPreditores
        .map((idPreditor, indice) => (idPreditor ? { idPreditor, ordem: indice + 1 } : null))
        .filter((v): v is { idPreditor: number; ordem: number } => v !== null);
      await substituirPreditoresPlanejamento(supabase, planejamento.idPlanejamento, preditoresParaSalvar);
    } catch (erroPreditores) {
      setEnviando(false);
      setErro(erroPreditores instanceof Error ? erroPreditores.message : "Erro ao salvar os preditores prioritários.");
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
          name="objetivo_ano"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Objetivo do ano (opcional)</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} rows={2} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="legado"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Legado (opcional)</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} rows={2} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="analise_conjuntura"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Análise de conjuntura (opcional)</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} rows={2} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {produtoNome === "PLL" && (
          <FormField
            control={form.control}
            name="id_perfil_atuacao"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Perfil de atuação (opcional)</FormLabel>
                <Select
                  value={field.value ? String(field.value) : undefined}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {perfis.map((p) => (
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
        )}

        <div className="grid gap-2">
          <p className="text-sm font-medium">Preditores prioritários (até 3, opcional)</p>
          {[0, 1, 2].map((indice) => (
            <Select
              key={indice}
              value={slotsPreditores[indice] ? String(slotsPreditores[indice]) : undefined}
              onValueChange={(v) =>
                setSlotsPreditores((atual) => atual.map((s, i) => (i === indice ? Number(v) : s)))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={`Preditor prioritário ${indice + 1} (nenhum)`} />
              </SelectTrigger>
              <SelectContent>
                {preditoresDisponiveis.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>

        {erro && <ErroInline mensagem={erro} />}
        <Button type="submit" disabled={enviando || !form.formState.isValid} className="w-fit">
          {enviando ? "Salvando..." : "Salvar dados do Planejamento"}
        </Button>
      </form>
    </Form>
  );
}

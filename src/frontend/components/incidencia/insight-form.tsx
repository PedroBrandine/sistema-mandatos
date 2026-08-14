"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { buscarPilaresInsight, type RefOption } from "@backend/queries/incidencia";
import { buscarGradeSucessosMensais, buscarPlanejamentoCompleto } from "@backend/queries/planejamento";
import { criarInsight } from "@backend/rpc/insight";
import { insightSchema, type InsightInput } from "@backend/schemas/insight";
import { createClient } from "@backend/supabase/client";

import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const SEM_VINCULO = "_nenhum";

// INC-12, INC-13, INC-14. Componente "burro" quanto a Dialog (mesmo padrão de
// FatoGeradorForm/UsuarioForm). Chama app.criar_insight (RPC, AD-024) via
// criarInsight -- insight + até 2 vínculos opcionais (Meta e/ou Sucesso) na
// mesma transação; id_usuario_autor resolvido no servidor.
export interface InsightFormProps {
  idContrato: number;
  onConcluido: (criado?: { idInsight: number }) => void;
  onCancelar: () => void;
}

export function InsightForm({ idContrato, onConcluido, onCancelar }: InsightFormProps) {
  const [pilares, setPilares] = useState<RefOption[]>([]);
  const [registros, setRegistros] = useState<RefOption[]>([]);
  const [metas, setMetas] = useState<RefOption[]>([]);
  const [sucessos, setSucessos] = useState<RefOption[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<InsightInput>({
    resolver: zodResolver(insightSchema),
    mode: "onChange",
    defaultValues: { id_contrato: idContrato, conteudo: "" },
  });

  useEffect(() => {
    const supabase = createClient();

    void buscarPilaresInsight(supabase).then(setPilares);

    // Registro de origem: precisa de todo o contrato (não escopado a 1
    // etapa, ao contrário de buscarRegistrosDaEtapa) -- sem query
    // centralizada pra esse caso, fetch inline (mesmo padrão de
    // ref_preditor em objetivo-form.tsx).
    supabase
      .from("fat_registro")
      .select("id_registro, ocorrido_em, resumo")
      .eq("id_contrato", idContrato)
      .order("ocorrido_em", { ascending: false })
      .then(({ data }) =>
        setRegistros(
          (data ?? []).map((r) => ({
            id: r.id_registro,
            nome: `${new Date(r.ocorrido_em).toLocaleDateString("pt-BR")} — ${r.resumo ?? "sem resumo"}`,
          }))
        )
      );

    void buscarPlanejamentoCompleto(supabase, idContrato).then((planejamento) => {
      const listaMetas = (planejamento?.objetivos ?? []).flatMap((o) =>
        o.metas.map((m) => ({ id: m.idMeta, nome: m.descricao }))
      );
      setMetas(listaMetas);

      const idsMeta = listaMetas.map((m) => m.id);
      void buscarGradeSucessosMensais(supabase, idsMeta).then((grade) =>
        setSucessos(grade.map((s) => ({ id: s.idSucesso, nome: `${s.mesReferencia} — ${s.descricao}` })))
      );
    });
  }, [idContrato]);

  async function enviar(valores: InsightInput) {
    setEnviando(true);
    setErro(null);
    const supabase = createClient();
    try {
      const { idInsight } = await criarInsight(supabase, {
        idContrato: valores.id_contrato,
        conteudo: valores.conteudo,
        desdobramentos: valores.desdobramentos ?? null,
        comprovacaoDados: valores.comprovacao_dados ?? null,
        ocorridoEm: valores.ocorrido_em ?? null,
        idPilar: valores.id_pilar ?? null,
        idRegistro: valores.id_registro ?? null,
        idMetaOrigem: valores.id_meta_origem ?? null,
        idSucessoOrigem: valores.id_sucesso_origem ?? null,
      });
      onConcluido({ idInsight });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao criar Insight.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(enviar)} className="grid gap-4">
        <FormField
          control={form.control}
          name="conteudo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conteúdo</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="desdobramentos"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Desdobramentos (opcional)</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} rows={2} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="comprovacao_dados"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Comprovação / dados (opcional)</FormLabel>
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
            name="ocorrido_em"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data (opcional)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="id_pilar"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pilar (opcional)</FormLabel>
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
                    {pilares.map((p) => (
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

        <FormField
          control={form.control}
          name="id_registro"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Registro de origem (opcional)</FormLabel>
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
                  {registros.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            name="id_sucesso_origem"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sucesso Mensal de origem (opcional)</FormLabel>
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
                    {sucessos.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.nome}
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
            {enviando ? "Salvando..." : "Criar Insight"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}

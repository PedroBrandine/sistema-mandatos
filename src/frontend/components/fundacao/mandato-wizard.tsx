"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { DuplicataDetectadaError } from "@backend/rpc/errors";
import { criarMandato } from "@backend/rpc/mandato";
import { contratanteSchema } from "@backend/schemas/contratante";
import { mandatoSchema } from "@backend/schemas/mandato";
import { createClient } from "@backend/supabase/client";
import type { CandidaturaSugerida, ContratanteSimilar, MandatoCriado } from "@backend/types/fundacao";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ContratanteFields } from "./contratante-fields";
import { DuplicataWarningDialog } from "./duplicata-warning-dialog";
import { TseMatchSearch } from "./tse-match-search";

const wizardSchema = z.object({
  contratante: contratanteSchema,
  mandato: mandatoSchema,
});
type WizardFormValues = z.infer<typeof wizardSchema>;

interface RefOption {
  id: number;
  nome: string;
}

type Passo = { tipo: "buscar" } | { tipo: "revisar"; candidatura: CandidaturaSugerida } | { tipo: "manual" };

export interface MandatoWizardProps {
  onCriado: (mandato: MandatoCriado) => void;
}

// Fluxo de cadastro de mandato (FND-TSE-01 a 06, FND-TSM-01/02): busca TSE
// (TseMatchSearch, T31) -> confirmar sugestão (criarMandato, T28) ou cadastro
// manual (criarMandato sem candidatura) -> aviso de duplicata
// (DuplicataWarningDialog, T30) quando MDU01.
export function MandatoWizard({ onCriado }: MandatoWizardProps) {
  const [passo, setPasso] = useState<Passo>({ tipo: "buscar" });
  const [cargos, setCargos] = useState<RefOption[]>([]);
  const [partidos, setPartidos] = useState<RefOption[]>([]);
  const [similares, setSimilares] = useState<ContratanteSimilar[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const form = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    mode: "onChange",
    defaultValues: { contratante: { nome: "" }, mandato: {} },
  });

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("ref_cargo")
      .select("id_cargo, nome")
      .eq("ativo", true)
      .then(({ data }) => setCargos((data ?? []).map((c) => ({ id: c.id_cargo, nome: c.nome }))));
    supabase
      .from("ref_partido")
      .select("id_partido, sigla")
      .eq("ativo", true)
      .then(({ data }) => setPartidos((data ?? []).map((p) => ({ id: p.id_partido, nome: p.sigla }))));
  }, []);

  function iniciarRevisao(candidatura: CandidaturaSugerida) {
    form.reset({
      contratante: {
        nome: candidatura.nmUrna ?? candidatura.nmCandidato ?? "",
        sg_uf: candidatura.sgUf ?? null,
        nm_municipio: candidatura.nmMunicipioPrincipal ?? null,
      },
      mandato: {
        nm_civil: candidatura.nmCandidato ?? null,
        nm_urna: candidatura.nmUrna ?? null,
        nr_titulo_eleitoral: candidatura.nrTituloEleitoral ?? null,
      },
    });
    setErro(null);
    setPasso({ tipo: "revisar", candidatura });
  }

  function iniciarManual() {
    form.reset({ contratante: { nome: "" }, mandato: {} });
    setErro(null);
    setPasso({ tipo: "manual" });
  }

  // SPEC_DEVIATION: spec.md (P1, AC3) descreve "rejeitar uma candidatura
  // sugerida" como gravar rel_mandato_candidatura.status='rejeitado' -- mas
  // essa tabela exige id_mandato NOT NULL (supabase/migrations/
  // 0010_tse_e_candidatura.sql:171) e, neste wizard (/mandatos/novo), nenhum
  // mandato existe ainda no momento em que uma sugestão é descartada (só
  // passa a existir quando uma candidatura é confirmada ou o cadastro manual
  // é salvo). Rejeitar aqui só pode, portanto, descartar a sugestão da tela
  // de revisão e devolver à busca -- exatamente o efeito exigido pelo AC3
  // ("sem criar mandato, e permitir nova busca"), sem nenhuma escrita no
  // banco porque não existe linha para atualizar. `onRejeitarSugestao`
  // (update direto por id_vinculo_tse, design.md) permanece disponível para
  // telas futuras que revisem candidaturas já vinculadas a um mandato
  // existente (ex.: um caso reeleito com uma segunda candidatura pendente).
  function rejeitarERebuscar() {
    setSimilares(null);
    setErro(null);
    setPasso({ tipo: "buscar" });
  }

  async function submeter(valores: WizardFormValues, ignorarDuplicata = false) {
    setEnviando(true);
    setErro(null);
    try {
      const supabase = createClient();
      const candidatura = passo.tipo === "revisar" ? passo.candidatura : null;
      const resultado = await criarMandato(supabase, {
        contratante: valores.contratante,
        mandato: valores.mandato,
        candidatura: candidatura
          ? {
              ano_eleicao: candidatura.anoEleicao,
              sq_candidato: candidatura.sqCandidato,
              nr_turno: candidatura.nrTurno,
              metodo_match: candidatura.metodoMatch,
              confianca: candidatura.confianca,
            }
          : null,
        ignorarDuplicata,
      });
      setSimilares(null);
      onCriado(resultado);
    } catch (e) {
      if (e instanceof DuplicataDetectadaError) {
        setSimilares(e.similares);
      } else {
        setErro(e instanceof Error ? e.message : "Erro ao cadastrar mandato.");
      }
    } finally {
      setEnviando(false);
    }
  }

  if (passo.tipo === "buscar") {
    return (
      <div className="grid gap-6">
        <TseMatchSearch onSelecionar={iniciarRevisao} />
        <Button type="button" variant="outline" onClick={iniciarManual} className="w-fit">
          Cadastro manual (sem candidatura do TSE)
        </Button>
      </div>
    );
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => submeter(v))} className="grid gap-6">
          <ContratanteFields control={form.control} />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="mandato.nm_civil"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome civil</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="mandato.nr_titulo_eleitoral"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título eleitoral</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="mandato.id_cargo_atual"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cargo</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : undefined}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cargos.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.nome}
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
              name="mandato.id_partido_atual"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Partido</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : undefined}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {partidos.map((p) => (
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

          {erro && <p className="text-sm text-red-500">{erro}</p>}

          <div className="flex gap-2">
            {passo.tipo === "revisar" && (
              <Button type="button" variant="outline" onClick={rejeitarERebuscar}>
                Rejeitar e buscar novamente
              </Button>
            )}
            <Button type="submit" disabled={enviando}>
              {enviando ? "Salvando..." : passo.tipo === "revisar" ? "Confirmar candidatura" : "Cadastrar manualmente"}
            </Button>
          </div>
        </form>
      </Form>

      {similares && (
        <DuplicataWarningDialog
          candidatos={similares}
          onConfirmar={() => void submeter(form.getValues(), true)}
          onCancelar={() => setSimilares(null)}
        />
      )}
    </>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ChevronRight, IdCard, Landmark, Lock, Pencil, Stamp, Users, XCircle } from "lucide-react";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

const identidadesGenero = ["Mulher Cisgênero", "Homem Cisgênero", "Mulher Trans", "Homem Trans", "Não-binário", "Outros"];
const orientacoes = ["Heterossexual", "Homossexual", "Bissexual", "Pansexual", "Assexual", "Outros"];
const niveisClassificacao = ["Baixo", "Médio", "Alto"];

// Eyebrow label + ícone reutilizados nas zonas da ficha (T7 design pass).
function ZonaEyebrow({ icon: Icon, children }: { icon: typeof Users; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 font-heading text-xs uppercase tracking-wider text-muted-foreground">
      <Icon className="size-3.5" />
      {children}
    </p>
  );
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

  const isBuscando = passo.tipo === "buscar";

  return (
    <div className="w-full space-y-6">

      {/* FONTE OFICIAL: busca na base do TSE */}
      <Card className="overflow-hidden border-none shadow-sm">
        {isBuscando ? (
          <>
            <CardHeader className="bg-muted/40 pb-4">
              <CardTitle className="flex items-center gap-2 font-heading text-xs uppercase tracking-wider text-muted-foreground">
                <Landmark className="size-3.5 text-primary" />
                Fonte oficial · base do TSE
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-6">
                <TseMatchSearch onSelecionar={iniciarRevisao} />
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  <span>Fora do TSE (suplência, assessor, CG)?</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <Button type="button" variant="outline" onClick={iniciarManual} className="mx-auto w-full border-dashed sm:w-auto">
                  Cadastro manual pela mesma tela
                </Button>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex flex-col items-start gap-4 bg-primary p-6 text-primary-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className={
                  passo.tipo === "revisar"
                    ? "flex size-12 shrink-0 -rotate-6 items-center justify-center rounded-full border-2 border-dashed border-primary-foreground/50"
                    : "flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-primary-foreground/30"
                }
              >
                {passo.tipo === "revisar" ? <Stamp className="size-5" /> : <Pencil className="size-5" />}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-primary-foreground/70">
                  {passo.tipo === "revisar" ? "Candidatura TSE vinculada" : "Cadastro manual"}
                </p>
                <p className="font-heading text-lg uppercase leading-tight">
                  {passo.tipo === "revisar" ? passo.candidatura.nmCandidato : "Preenchimento integral"}
                </p>
                <p className="mt-0.5 text-xs text-primary-foreground/70">
                  {passo.tipo === "revisar"
                    ? "Nome, UF, município, título, cargo e partido vieram do TSE — somente leitura."
                    : "Nenhum dado foi importado. Você preenche tudo abaixo."}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={rejeitarERebuscar}
              className="text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <XCircle className="mr-2 size-4" /> Cancelar e buscar novamente
            </Button>
          </CardContent>
        )}
      </Card>

      {!isBuscando && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => submeter(v))} className="animate-in fade-in duration-500">
            <Card className="overflow-hidden shadow-sm">

              {/* FICHA DO MANDATO */}
              <CardContent className="grid gap-6 pt-6">
                <ZonaEyebrow icon={IdCard}>Ficha do mandato</ZonaEyebrow>
                <ContratanteFields control={form.control} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="mandato.nm_civil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome civil</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="Ex: João da Silva" />
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
                          <Input {...field} value={field.value ?? ""} placeholder="Apenas números (12 dígitos)" maxLength={12} />
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
                            <SelectTrigger className="w-full bg-background">
                              <SelectValue placeholder="Selecione o cargo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {cargos.length === 0 && <SelectItem value="0" disabled>Carregando...</SelectItem>}
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
                            <SelectTrigger className="w-full bg-background">
                              <SelectValue placeholder="Selecione o partido" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {partidos.length === 0 && <SelectItem value="0" disabled>Carregando...</SelectItem>}
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
              </CardContent>

              {/* COMPLEMENTO: o que o TSE não cobre */}
              <CardContent className="grid gap-4 border-t border-border pt-6">
                <div>
                  <ZonaEyebrow icon={Users}>Complemento · o TSE não cobre</ZonaEyebrow>
                  <p className="mt-1 text-xs text-muted-foreground">Autodeclarado, preenchimento opcional.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="mandato.ds_identidade_genero"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Identidade de Gênero</FormLabel>
                        <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full bg-background">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {identidadesGenero.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mandato.ds_orientacao_sexual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orientação Sexual</FormLabel>
                        <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full bg-background">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {orientacoes.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mandato.fl_pcd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PcD</FormLabel>
                        <Select
                          value={field.value === true ? "sim" : field.value === false ? "nao" : undefined}
                          onValueChange={(v) => field.onChange(v === "sim")}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full bg-background">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="sim">Sim</SelectItem>
                            <SelectItem value="nao">Não</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>

              {/* USO INTERNO: classificação confidencial da Legisla */}
              <CardContent className="border-t border-border pt-6">
                <div className="rounded-lg border border-dashed border-secondary/40 bg-secondary/5 p-5">
                  <div className="flex items-center gap-2">
                    <Lock className="size-3.5 text-secondary" />
                    <p className="font-heading text-xs uppercase tracking-wider text-secondary">Uso interno da Legisla</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Não aparece para o contratante nem em relatórios externos.</p>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                    <FormField
                      control={form.control}
                      name="mandato.potencial_futuro"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Potencial de futuro</FormLabel>
                          <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="w-full bg-background">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {niveisClassificacao.map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="mandato.relevancia_politica"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Relevância política</FormLabel>
                          <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="w-full bg-background">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {niveisClassificacao.map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="mandato.confianca"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confiança</FormLabel>
                          <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="w-full bg-background">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {niveisClassificacao.map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="mandato.risco_democratico"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Risco democrático</FormLabel>
                          <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="w-full bg-background">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {niveisClassificacao.map((opt) => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>

              {/* AÇÃO: salvar mandato (o contrato é aberto depois, em outra tela) */}
              <CardContent className="flex flex-col gap-4 border-t border-border bg-muted/40 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Depois de salvar, você abre um contrato para vincular este mandato a um produto.
                </p>
                <div className="flex w-full items-center gap-3 sm:w-auto">
                  <Button type="button" variant="outline" onClick={rejeitarERebuscar} disabled={enviando} className="w-full sm:w-auto">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={enviando} className="group w-full sm:w-auto">
                    {enviando ? "Salvando..." : "Salvar mandato"}
                    {!enviando && <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {erro && (
              <div className="mt-6 flex items-center gap-2 rounded-lg bg-destructive/15 p-4 text-sm font-medium text-destructive">
                <XCircle className="size-4" />
                {erro}
              </div>
            )}
          </form>
        </Form>
      )}

      {similares && (
        <DuplicataWarningDialog
          candidatos={similares}
          onConfirmar={() => void submeter(form.getValues(), true)}
          onCancelar={() => setSimilares(null)}
        />
      )}
    </div>
  );
}

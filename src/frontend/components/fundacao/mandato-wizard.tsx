"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CheckCircle2, ChevronRight, Search, XCircle } from "lucide-react";

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
    <div className="mx-auto w-full max-w-4xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* STEP 1: BUSCAR NA BASE DO TSE */}
      <Card className="border-l-4 border-l-primary shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="text-xs tracking-wider text-muted-foreground uppercase font-semibold flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary">1</span>
            Buscar na base do TSE
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {isBuscando ? (
            <div className="grid gap-6">
              <TseMatchSearch onSelecionar={iniciarRevisao} />
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                <span>Fora do TSE (suplência, assessor, CG)?</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <Button type="button" variant="outline" onClick={iniciarManual} className="w-full sm:w-auto mx-auto border-dashed">
                Cadastro manual pela mesma tela
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border bg-accent/20 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-green-500" />
                  {passo.tipo === "revisar" ? `Candidatura TSE vinculada: ${passo.candidatura.nmCandidato}` : "Modo de Cadastro Manual"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {passo.tipo === "revisar" 
                    ? "Importado do TSE (somente leitura): nome · uf · município · nr_titulo · cargo · partido" 
                    : "Você optou por preencher os dados integralmente de forma manual."}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={rejeitarERebuscar} className="text-muted-foreground hover:text-destructive">
                <XCircle className="mr-2 size-4" /> Cancelar e buscar novamente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!isBuscando && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => submeter(v))} className="space-y-6 animate-in fade-in duration-700">
            
            {/* DADOS BÁSICOS (TSE COBRE PARTE) */}
            <Card className="shadow-sm">
              <CardContent className="pt-6 grid gap-6">
                <ContratanteFields control={form.control} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </Card>

            {/* STEP 2: COMPLEMENTAR */}
            <Card className="border-l-4 border-l-blue-500 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="text-xs tracking-wider text-muted-foreground uppercase font-semibold flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-blue-500">2</span>
                  Complementar (O que o TSE não cobre)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              </CardContent>
            </Card>

            {/* STEP 3: CLASSIFICAÇÃO INTERNA */}
            <Card className="border-l-4 border-l-purple-500 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="text-xs tracking-wider text-muted-foreground uppercase font-semibold flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/20 text-purple-500">3</span>
                  Classificação Interna da Legisla
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
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
              </CardContent>
            </Card>

            {/* STEP 4: AÇÕES */}
            <Card className="border-l-4 border-l-orange-500 shadow-sm bg-gradient-to-r from-orange-500/5 to-transparent overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-xs tracking-wider text-muted-foreground uppercase font-semibold flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500/20 text-orange-500">4</span>
                  Vincular ao Produto — Cria o Contrato
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Search className="size-4 text-muted-foreground" />
                  fat_Contrato: localizador · produto=estrategia
                </div>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <Button type="button" variant="outline" onClick={rejeitarERebuscar} disabled={enviando} className="w-full sm:w-auto">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={enviando} className="w-full sm:w-auto group relative overflow-hidden transition-all hover:scale-[1.02] bg-zinc-900 text-white hover:bg-zinc-800">
                    <span className="relative z-10 flex items-center gap-2">
                      {enviando ? "Salvando..." : "Criar cadastro e abrir Pontapé"} 
                      {!enviando && <ChevronRight className="size-4 group-hover:translate-x-1 transition-transform" />}
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {erro && (
              <div className="p-4 rounded-lg bg-destructive/15 text-destructive text-sm font-medium flex items-center gap-2 animate-in fade-in">
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

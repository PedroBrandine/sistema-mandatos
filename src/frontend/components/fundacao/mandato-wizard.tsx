"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ChevronRight, IdCard, Landmark, Lock, Pencil, Stamp, Users, XCircle, FileSignature } from "lucide-react";

import { DuplicataDetectadaError, ViolacaoUnicaError } from "@backend/rpc/errors";
import { criarMandato } from "@backend/rpc/mandato";
import { contratanteSchema } from "@backend/schemas/contratante";
import { mandatoSchema } from "@backend/schemas/mandato";
import { createClient } from "@backend/supabase/client";
import type { CandidaturaSugerida, ContratanteSimilar, MandatoCriado } from "@backend/types/fundacao";
import { buscarMandatoExistentePorTitulo, type MandatoExistenteResumo } from "@backend/queries/mandato";
import { buscarPerfilCandidatura } from "@backend/queries/tse";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ContratanteFields } from "./contratante-fields";
import { DuplicataWarningDialog } from "./duplicata-warning-dialog";
import { TseMatchSearch } from "./tse-match-search";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRouter } from "next/navigation";

const coalizaoSchema = z.object({
  id_coalizao: z.number().optional().nullable(),
  papel: z.enum(["membro", "secretaria_executiva", "grupo_trabalho"]).optional().nullable(),
  nome_grupo: z.string().optional().nullable(),
}).superRefine((val, ctx) => {
  if (val.id_coalizao) {
    if (!val.papel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Obrigatório quando vinculado a coalizão",
        path: ["papel"],
      });
    }
    if (val.papel === "grupo_trabalho" && (!val.nome_grupo || val.nome_grupo.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Obrigatório para Grupo de Trabalho",
        path: ["nome_grupo"],
      });
    }
  }
});

const wizardSchema = z.object({
  contratante: contratanteSchema.optional(),
  mandato: mandatoSchema.optional(),
  contrato: z.object({
    id_produto: z.number().min(1, "Obrigatório"),
    id_projeto: z.number().optional().nullable(),
    dt_inicio: z.string().min(10, "Data inválida"),
  }),
  coalizao: coalizaoSchema.optional(),
});
type WizardFormValues = z.infer<typeof wizardSchema>;

interface RefOption {
  id: number;
  nome: string;
  cd_cargo_tse?: number;
}

type Passo = 
  | { tipo: "buscar" } 
  | { tipo: "revisar"; candidatura: CandidaturaSugerida } 
  | { tipo: "manual" }
  | { tipo: "existente"; mandato: MandatoExistenteResumo };

export interface MandatoWizardProps {
  onCriado: (mandato: MandatoCriado) => void;
}

const racas = ["Branca", "Preta", "Parda", "Amarela", "Indígena"];
const identidadesGenero = ["Mulher Cisgênero", "Homem Cisgênero", "Mulher Trans", "Homem Trans", "Não-binário", "Outros"];
const orientacoes = ["Heterossexual", "Homossexual", "Bissexual", "Pansexual", "Assexual", "Outros"];
const niveisClassificacao = ["Baixo", "Médio", "Alto"];

function normalizaRaca(raca: string | null | undefined): "Branca" | "Preta" | "Parda" | "Amarela" | "Indígena" | null {
  if (!raca) return null;
  const r = raca.trim().toUpperCase();
  if (r.includes("BRANCA")) return "Branca";
  if (r.includes("PRETA")) return "Preta";
  if (r.includes("PARDA")) return "Parda";
  if (r.includes("AMARELA")) return "Amarela";
  if (r.includes("INDIGENA") || r.includes("INDÍGENA")) return "Indígena";
  return null;
}

function ZonaEyebrow({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 font-heading text-xs uppercase tracking-wider text-muted-foreground">
      <Icon className="size-3.5" />
      {children}
    </p>
  );
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export function MandatoWizard({ onCriado }: MandatoWizardProps) {
  const router = useRouter();
  const [passo, setPasso] = useState<Passo>({ tipo: "buscar" });
  const [cargos, setCargos] = useState<RefOption[]>([]);
  const [partidos, setPartidos] = useState<RefOption[]>([]);
  const [produtos, setProdutos] = useState<RefOption[]>([]);
  const [projetos, setProjetos] = useState<RefOption[]>([]);
  const [coalizoes, setCoalizoes] = useState<RefOption[]>([]);
  const [similares, setSimilares] = useState<ContratanteSimilar[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // CMU-04 (AC5): quando a checagem prévia passa mas o INSERT ainda assim
  // colide com dim_mandato_nr_titulo_eleitoral_key (condição de corrida --
  // outra sessão cadastrou o mesmo título entre a checagem e o envio), guarda
  // o título que colidiu para oferecer a mesma ação do passo "existente".
  const [duplicataTitulo, setDuplicataTitulo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [checandoExistente, setChecandoExistente] = useState(false);

  const form = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    mode: "onChange",
    defaultValues: { 
      contratante: { nome: "" }, 
      mandato: {}, 
      contrato: { id_produto: 1, dt_inicio: hoje() },
      coalizao: {}
    },
  });

  const coalizaoSelecionada = form.watch("coalizao.id_coalizao");
  const papelSelecionado = form.watch("coalizao.papel");

  useEffect(() => {
    const supabase = createClient();
    supabase.from("ref_cargo").select("id_cargo, nome, cd_cargo_tse").eq("ativo", true)
      .then(({ data }) => setCargos((data ?? []).map((c) => ({ id: c.id_cargo, nome: c.nome, cd_cargo_tse: c.cd_cargo_tse ?? undefined }))));
    supabase.from("ref_partido").select("id_partido, sigla").eq("ativo", true)
      .then(({ data }) => setPartidos((data ?? []).map((p) => ({ id: p.id_partido, nome: p.sigla }))));
    supabase.from("ref_produto").select("id_produto, nome").eq("ativo", true)
      .then(({ data }) => setProdutos((data ?? []).map((p) => ({ id: p.id_produto, nome: p.nome }))));
    supabase.from("ref_projeto").select("id_projeto, nome").eq("ativo", true)
      .then(({ data }) => setProjetos((data ?? []).map((p) => ({ id: p.id_projeto, nome: p.nome }))));
    supabase.from("dim_contratante").select("id_contratante, nome").eq("tipo_contratante", "coalizao")
      .then(({ data }) => setCoalizoes((data ?? []).map((c) => ({ id: c.id_contratante, nome: c.nome }))));
  }, []);

  async function checkExistente(nrTituloEleitoral: string | null | undefined): Promise<boolean> {
    if (!nrTituloEleitoral || nrTituloEleitoral.trim().length === 0) return false;
    setChecandoExistente(true);
    const supabase = createClient();
    const existente = await buscarMandatoExistentePorTitulo(supabase, nrTituloEleitoral);
    setChecandoExistente(false);
    
    if (existente) {
      setErro(null);
      form.reset({
        contratante: {
          nome: existente.nomeContratante || existente.nmUrna || "Mandato Existente",
          sg_uf: null,
          nm_municipio: null,
        },
        contrato: { id_produto: 1, dt_inicio: hoje() },
        coalizao: {},
      });
      setPasso({ tipo: "existente", mandato: existente });
      return true;
    }
    return false;
  }

  async function iniciarRevisao(candidatura: CandidaturaSugerida) {
    if (await checkExistente(candidatura.nrTituloEleitoral)) return;

    // Buscar genero, raca e municipio no perfil TSE
    const supabase = createClient();
    let generoTse: string | null = null;
    let racaTse: "Branca" | "Preta" | "Parda" | "Amarela" | "Indígena" | null = null;
    let municipioTse: string | null = candidatura.nmMunicipioPrincipal ?? null;
    try {
       const perfil = await buscarPerfilCandidatura(supabase, {
          anoEleicao: candidatura.anoEleicao,
          sqCandidato: candidatura.sqCandidato,
          nrTurno: candidatura.nrTurno
       });
       if (perfil?.genero) {
         generoTse = perfil.genero.toUpperCase();
       }
       if (perfil?.corRaca) {
         racaTse = normalizaRaca(perfil.corRaca);
       }
       if (!municipioTse && perfil?.nmUe && perfil.nmUe !== candidatura.sgUf) {
         municipioTse = perfil.nmUe;
       }
    } catch(e) {}

    const idPartido = partidos.find(p => p.nome === candidatura.sgPartido)?.id;
    const idCargo = cargos.find(c => c.cd_cargo_tse === candidatura.cdCargo)?.id;

    form.reset({
      contratante: {
        nome: candidatura.nmUrna ?? candidatura.nmCandidato ?? "",
        sg_uf: candidatura.sgUf ?? null,
        nm_municipio: municipioTse,
      },
      mandato: {
        nm_civil: candidatura.nmCandidato ?? null,
        nm_urna: candidatura.nmUrna ?? null,
        nr_titulo_eleitoral: candidatura.nrTituloEleitoral ?? null,
        id_partido_atual: idPartido,
        id_cargo_atual: idCargo,
        ds_genero: generoTse,
        ds_raca: racaTse,
      },
      contrato: { id_produto: 1, dt_inicio: hoje() },
      coalizao: {}
    });
    setErro(null);
    setPasso({ tipo: "revisar", candidatura });
  }

  function iniciarManual() {
    form.reset({ 
      contratante: { nome: "" }, 
      mandato: {}, 
      contrato: { id_produto: 1, dt_inicio: hoje() },
      coalizao: {}
    });
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
    setDuplicataTitulo(null);
    try {
      const supabase = createClient();
      
      // Manual check when they type an existing titulo during manual step
      if (passo.tipo === "manual" && !ignorarDuplicata && valores.mandato?.nr_titulo_eleitoral) {
         if (await checkExistente(valores.mandato.nr_titulo_eleitoral)) {
            setEnviando(false);
            return;
         }
      }

      const candidatura = passo.tipo === "revisar" ? passo.candidatura : null;
      const idContratanteExistente = passo.tipo === "existente" ? passo.mandato.idContratante : undefined;

      const resultado = await criarMandato(supabase, {
        contratante: idContratanteExistente ? undefined : valores.contratante,
        mandato: idContratanteExistente ? undefined : valores.mandato,
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
        contrato: {
          id_produto: valores.contrato.id_produto,
          id_projeto: valores.contrato.id_projeto || null,
          dt_inicio: valores.contrato.dt_inicio,
        },
        coalizao: valores.coalizao?.id_coalizao ? {
          id_coalizao: valores.coalizao.id_coalizao,
          papel: valores.coalizao.papel,
          nome_grupo: valores.coalizao.nome_grupo || null,
        } : null,
        idContratanteExistente,
      });
      setSimilares(null);
      onCriado(resultado);
      router.push(`/mandatos/${resultado.idMandato}`);
    } catch (e) {
      if (e instanceof DuplicataDetectadaError) {
        setSimilares(e.similares);
      } else if (e instanceof ViolacaoUnicaError && e.constraint === "dim_mandato_nr_titulo_eleitoral_key") {
        // Condição de corrida: a checagem prévia (checkExistente) passou, mas
        // outra sessão cadastrou o mesmo título eleitoral entre a checagem e
        // este envio. Mensagem amigável já vem de mapeiaErroRpc; a ação de
        // "ver mandato existente" fica no botão abaixo do erro (ver JSX).
        setErro(e.message);
        setDuplicataTitulo(valores.mandato?.nr_titulo_eleitoral ?? null);
      } else {
        setErro(e instanceof Error ? e.message : "Erro ao cadastrar mandato ou contrato.");
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
                <Button type="button" variant="outline" onClick={iniciarManual} className="mx-auto w-full border-dashed sm:w-auto" disabled={checandoExistente}>
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
                  {passo.tipo === "revisar" ? "Candidatura TSE vinculada" : (passo.tipo === "existente" ? "Mandato Existente" : "Cadastro manual")}
                </p>
                <p className="font-heading text-lg uppercase leading-tight">
                  {passo.tipo === "revisar" ? passo.candidatura.nmCandidato : (passo.tipo === "existente" ? (passo.mandato.nomeContratante || passo.mandato.nmUrna) : "Preenchimento integral")}
                </p>
                <p className="mt-0.5 text-xs text-primary-foreground/70">
                  {passo.tipo === "revisar"
                    ? "Nome, UF, município, título, cargo e partido vieram do TSE — somente leitura."
                    : (passo.tipo === "existente" ? "Este mandato já está cadastrado. Prossiga para abrir um novo contrato." : "Nenhum dado foi importado. Você preenche tudo abaixo.")}
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

              {passo.tipo === "existente" && (
                 <CardContent className="pt-6">
                    <Alert variant="default" className="bg-primary/5 border-primary/20 text-primary">
                      <IdCard className="size-4" />
                      <AlertTitle>Mandato já cadastrado</AlertTitle>
                      <AlertDescription>
                        Identificamos este mandato pelo título eleitoral. Você está abrindo um novo contrato para ele (ex: reeleição, novo produto).
                      </AlertDescription>
                    </Alert>
                 </CardContent>
              )}

              {/* FICHA DO MANDATO (apenas se não for existente) */}
              {passo.tipo !== "existente" && (
                <>
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
                              <Input 
                                {...field} 
                                value={field.value ?? ""} 
                                placeholder="Apenas números (12 dígitos)" 
                                maxLength={12} 
                                readOnly={passo.tipo === "revisar"}
                                className={passo.tipo === "revisar" ? "bg-muted/50 cursor-default focus-visible:ring-0" : ""}
                              />
                            </FormControl>
                            {passo.tipo === "revisar" && <p className="text-[10px] text-muted-foreground mt-1">Vindo do TSE</p>}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="mandato.ds_genero"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gênero Oficial (TSE)</FormLabel>
                            <Select
                              value={field.value ?? undefined}
                              onValueChange={(v) => field.onChange(v)}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full bg-background">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="FEMININO">Feminino</SelectItem>
                                <SelectItem value="MASCULINO">Masculino</SelectItem>
                                <SelectItem value="NÃO DIVULGÁVEL">Não Divulgável</SelectItem>
                              </SelectContent>
                            </Select>
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
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                      <FormField
                        control={form.control}
                        name="mandato.ds_raca"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Etnia / Cor / Raça</FormLabel>
                            <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="w-full bg-background">
                                  <SelectValue placeholder="Selecione etnia" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {racas.map((opt) => (
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

                  {/* USO INTERNO */}
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
                </>
              )}

              {/* CONTRATO & COALIZAO */}
              <CardContent className="grid gap-6 border-t border-border pt-6">
                <ZonaEyebrow icon={FileSignature}>Abertura de Contrato</ZonaEyebrow>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="contrato.id_produto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Produto <span className="text-destructive">*</span></FormLabel>
                        <Select
                          value={field.value ? String(field.value) : undefined}
                          onValueChange={(v) => field.onChange(Number(v))}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full bg-background">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {produtos.map((p) => (
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
                    name="contrato.id_projeto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Projeto (opcional)</FormLabel>
                        <Select
                          value={field.value ? String(field.value) : undefined}
                          onValueChange={(v) => field.onChange(Number(v))}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full bg-background">
                              <SelectValue placeholder="Nenhum" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {projetos.map((p) => (
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
                    name="contrato.dt_inicio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de início <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="pt-4 border-t border-border/50">
                  <p className="mb-4 text-sm font-medium text-foreground">Vinculação à Coalizão (opcional)</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="coalizao.id_coalizao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Coalizão existente</FormLabel>
                          <Select
                            value={field.value ? String(field.value) : undefined}
                            onValueChange={(v) => field.onChange(Number(v))}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full bg-background">
                                <SelectValue placeholder="Nenhuma" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {coalizoes.map((c) => (
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
                    {coalizaoSelecionada ? (
                      <FormField
                        control={form.control}
                        name="coalizao.papel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Papel na coalizão</FormLabel>
                            <Select
                              value={field.value ?? undefined}
                              onValueChange={(v) => field.onChange(v)}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full bg-background">
                                  <SelectValue placeholder="Selecione o papel" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="membro">Membro</SelectItem>
                                <SelectItem value="secretaria_executiva">Secretaria Executiva</SelectItem>
                                <SelectItem value="grupo_trabalho">Grupo de Trabalho</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : <div />}
                    {papelSelecionado === "grupo_trabalho" ? (
                      <FormField
                        control={form.control}
                        name="coalizao.nome_grupo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome do Grupo</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value ?? ""} placeholder="Ex: GT de Educação" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : <div />}
                  </div>
                </div>
              </CardContent>

              {/* AÇÃO: salvar mandato e contrato */}
              <CardContent className="flex flex-col gap-4 border-t border-border bg-muted/40 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Abertura integrada de {passo.tipo === "existente" ? "contrato" : "mandato e contrato"}.
                </p>
                <div className="flex w-full items-center gap-3 sm:w-auto">
                  <Button type="button" variant="outline" onClick={rejeitarERebuscar} disabled={enviando} className="w-full sm:w-auto">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={enviando} className="group w-full sm:w-auto">
                    {enviando ? "Salvando..." : (passo.tipo === "existente" ? "Abrir Contrato" : "Salvar Mandato & Contrato")}
                    {!enviando && <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {erro && (
              <div className="mt-6 flex flex-col gap-3 rounded-lg bg-destructive/15 p-4 text-sm font-medium text-destructive">
                <div className="flex items-center gap-2">
                  <XCircle className="size-4" />
                  {erro}
                </div>
                {duplicataTitulo && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    disabled={checandoExistente}
                    onClick={() => void checkExistente(duplicataTitulo)}
                  >
                    Ver mandato existente / abrir contrato para ele
                  </Button>
                )}
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

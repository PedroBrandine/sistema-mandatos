"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { buscarPerfilCandidatura, buscarPerfilEleitoradoCandidatura } from "@backend/queries/tse";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { marcarCandidaturaVigente } from "@backend/rpc/mandato";
import { contratanteSchema } from "@backend/schemas/contratante";
import { mandatoSchema } from "@backend/schemas/mandato";
import { createClient } from "@backend/supabase/client";
import type { Database } from "@backend/supabase/database.types";
import type { PerfilCandidatura, PerfilEleitorado } from "@backend/types/fundacao";

import { ContratanteFields } from "@/components/fundacao/contratante-fields";
import { PerfilEleitoradoChart } from "@/components/fundacao/perfil-eleitorado-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ContratoRow = Database["public"]["Tables"]["fat_contrato"]["Row"];
type CandidaturaRow = Database["public"]["Tables"]["rel_mandato_candidatura"]["Row"];

// CAD-09: bloco de votação -- só os 2 campos em destaque no card (total de
// votos + município principal), lido direto de tse.mv_candidatura_resumo
// (mesma MV já usada por buscarCandidaturas, sem precisar de função nova).
interface PerfilVotacao {
  qtVotosTotal: number | null;
  nmMunicipioPrincipal: string | null;
}

interface PerfilTseCandidatura {
  votacao: PerfilVotacao | null;
  pessoal: PerfilCandidatura | null;
  eleitorado: PerfilEleitorado | null;
}

const detalheSchema = z.object({
  contratante: contratanteSchema,
  mandato: mandatoSchema,
});
type DetalheFormValues = z.infer<typeof detalheSchema>;

// Detalhe e edição de mandato (FND-TSE-04): edição de dim_mandato/
// dim_contratante via `update` direto (single-table, sem RPC) + ação
// "marcar como vigente" numa candidatura (marcarCandidaturaVigente, T28).
export default function MandatoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idMandato = Number(id);

  const [carregando, setCarregando] = useState(true);
  const [idContratante, setIdContratante] = useState<number | null>(null);
  const [candidaturas, setCandidaturas] = useState<CandidaturaRow[]>([]);
  const [perfisTse, setPerfisTse] = useState<Record<number, PerfilTseCandidatura>>({});
  const [contratos, setContratos] = useState<ContratoRow[]>([]);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const form = useForm<DetalheFormValues>({
    resolver: zodResolver(detalheSchema),
    mode: "onChange",
    defaultValues: { contratante: { nome: "" }, mandato: {} },
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    const supabase = createClient();
    const { data: mandato } = await supabase
      .from("dim_mandato")
      .select("*")
      .eq("id_mandato", idMandato)
      .maybeSingle();

    if (mandato) {
      setIdContratante(mandato.id_contratante);

      const { data: contratante } = await supabase
        .from("dim_contratante")
        .select("*")
        .eq("id_contratante", mandato.id_contratante)
        .maybeSingle();

      form.reset({
        contratante: {
          nome: contratante?.nome ?? "",
          sg_uf: contratante?.sg_uf ?? null,
          nm_municipio: contratante?.nm_municipio ?? null,
        },
        mandato: {
          nm_civil: mandato.nm_civil,
          nm_urna: mandato.nm_urna,
          nr_titulo_eleitoral: mandato.nr_titulo_eleitoral,
        },
      });

      const { data: candidaturasData } = await supabase
        .from("rel_mandato_candidatura")
        .select("*")
        .eq("id_mandato", idMandato)
        .order("ano_eleicao", { ascending: false });
      setCandidaturas(candidaturasData ?? []);

      // CAD-09 a CAD-12: perfil TSE rico por candidatura -- votação (leitura
      // direta de mv_candidatura_resumo), perfil pessoal e perfil do
      // eleitorado (T9/T10). Candidatura sem match real (cadastro manual) ou
      // qualquer falha de fonte TSE vira dado ausente (catch -> null), nunca
      // quebra a tela (spec.md AC4/AC5 da história de perfil TSE).
      const entradas = await Promise.all(
        (candidaturasData ?? []).map(async (c) => {
          const chave = { anoEleicao: c.ano_eleicao, sqCandidato: c.sq_candidato, nrTurno: c.nr_turno };
          const [resumo, pessoal, eleitorado] = await Promise.all([
            supabase
              .schema("tse")
              .from("mv_candidatura_resumo")
              .select("qt_votos_total, nm_municipio_principal")
              .eq("ano_eleicao", chave.anoEleicao)
              .eq("sq_candidato", chave.sqCandidato)
              .eq("nr_turno", chave.nrTurno)
              .maybeSingle()
              .then(({ data }) => data ?? null),
            buscarPerfilCandidatura(supabase, chave).catch(() => null),
            buscarPerfilEleitoradoCandidatura(supabase, chave).catch(() => null),
          ]);
          const perfil: PerfilTseCandidatura = {
            votacao: resumo
              ? { qtVotosTotal: resumo.qt_votos_total, nmMunicipioPrincipal: resumo.nm_municipio_principal }
              : null,
            pessoal,
            eleitorado,
          };
          return [c.id_vinculo_tse, perfil] as const;
        })
      );
      setPerfisTse(Object.fromEntries(entradas));

      const { data: contratosData } = await supabase
        .from("fat_contrato")
        .select("*")
        .eq("id_contratante", mandato.id_contratante)
        .order("dt_inicio", { ascending: false });
      setContratos(contratosData ?? []);
    }
    setCarregando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idMandato]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvar(valores: DetalheFormValues) {
    if (idContratante == null) return;
    setMensagem(null);
    const supabase = createClient();

    const { error: erroContratante } = await supabase
      .from("dim_contratante")
      .update({
        nome: valores.contratante.nome,
        sg_uf: valores.contratante.sg_uf ?? null,
        nm_municipio: valores.contratante.nm_municipio ?? null,
      })
      .eq("id_contratante", idContratante);

    const { error: erroMandato } = await supabase
      .from("dim_mandato")
      .update({
        nm_civil: valores.mandato.nm_civil ?? null,
        nm_urna: valores.mandato.nm_urna ?? null,
        nr_titulo_eleitoral: valores.mandato.nr_titulo_eleitoral ?? null,
      })
      .eq("id_mandato", idMandato);

    const erro = erroContratante ?? erroMandato;
    if (erro) {
      setMensagem(mapeiaErroRpc(erro).message);
      return;
    }
    setMensagem("Alterações salvas.");
  }

  async function marcarVigente(idVinculoTse: number) {
    setMensagem(null);
    const supabase = createClient();
    try {
      await marcarCandidaturaVigente(supabase, idVinculoTse);
      await carregar();
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : "Não foi possível marcar esta candidatura como vigente.");
    }
  }

  if (carregando) {
    return <p className="p-6 text-sm text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-8 p-6">
      <div>
        <h1 className="mb-6 text-xl font-semibold">Mandato #{idMandato}</h1>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(salvar)} className="grid gap-4">
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
            </div>
            {mensagem && <p className="text-sm">{mensagem}</p>}
            <Button type="submit" className="w-fit">
              Salvar
            </Button>
          </form>
        </Form>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Candidaturas TSE</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confiança</TableHead>
              <TableHead>Vigente</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidaturas.map((c) => (
              <TableRow key={c.id_vinculo_tse}>
                <TableCell>{c.ano_eleicao}</TableCell>
                <TableCell>{c.status}</TableCell>
                <TableCell>
                  <Badge variant="outline">{c.confianca}</Badge>
                </TableCell>
                <TableCell>{c.eh_mandato_vigente ? "Sim" : "Não"}</TableCell>
                <TableCell>
                  {!c.eh_mandato_vigente && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void marcarVigente(c.id_vinculo_tse)}
                    >
                      Marcar como vigente
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {candidaturas.length > 0 && (
          <div className="mt-4 grid gap-4">
            {candidaturas.map((c) => {
              const perfil = perfisTse[c.id_vinculo_tse];
              return (
                <Card key={c.id_vinculo_tse}>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Perfil eleitoral — {c.ano_eleicao}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-6 sm:grid-cols-3">
                    {/* CAD-09: votação -- bloco inteiro omitido quando não há
                        nenhuma linha em mv_candidatura_resumo pra essa
                        candidatura (design.md Error Handling Strategy) */}
                    {perfil?.votacao && (
                      <div>
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          Votação
                        </p>
                        <p className="font-heading text-3xl">
                          {perfil.votacao.qtVotosTotal != null
                            ? perfil.votacao.qtVotosTotal.toLocaleString("pt-BR")
                            : "—"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {perfil.votacao.nmMunicipioPrincipal ?? "—"}
                        </p>
                      </div>
                    )}

                    {/* CAD-10: perfil pessoal -- bloco inteiro omitido quando
                        não há linha em tse.dim_candidatura; campo individual
                        (ex.: idade) mostra "—" quando o dado de origem é null */}
                    {perfil?.pessoal && (
                      <div className="grid gap-1 text-sm">
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          Perfil da candidatura
                        </p>
                        <p>Idade: {perfil.pessoal.idade ?? "—"}</p>
                        <p>Gênero: {perfil.pessoal.genero ?? "—"}</p>
                        <p>Cor/raça: {perfil.pessoal.corRaca ?? "—"}</p>
                        <p>Instrução: {perfil.pessoal.grauInstrucao ?? "—"}</p>
                        <p>Ocupação: {perfil.pessoal.ocupacao ?? "—"}</p>
                        <p>Coligação: {perfil.pessoal.coligacao ?? "—"}</p>
                      </div>
                    )}

                    {/* CAD-11/CAD-12: perfil do eleitorado -- bloco omitido
                        por completo quando não há município principal */}
                    {perfil?.eleitorado && (
                      <div className="grid gap-3">
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          Perfil do eleitorado
                        </p>
                        <PerfilEleitoradoChart titulo="Gênero" dados={perfil.eleitorado.genero} />
                        <PerfilEleitoradoChart titulo="Faixa etária" dados={perfil.eleitorado.faixaEtaria} />
                        <PerfilEleitoradoChart titulo="Escolaridade" dados={perfil.eleitorado.grauEscolaridade} />
                      </div>
                    )}

                    {!perfil?.votacao && !perfil?.pessoal && !perfil?.eleitorado && (
                      <p className="text-sm text-muted-foreground">
                        Sem dados TSE disponíveis pra esta candidatura.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-medium">Contratos</h2>
          <Link href={`/mandatos/${idMandato}/contratos/novo`}>
            <Button type="button" variant="outline" size="sm">
              Novo contrato
            </Button>
          </Link>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Início</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contratos.map((c) => (
              <TableRow key={c.id_contrato}>
                <TableCell>{c.dt_inicio}</TableCell>
                <TableCell>{c.status}</TableCell>
                <TableCell>
                  <Link href={`/contratos/${c.id_contrato}/vinculos`} className="text-sm underline">
                    Vínculos
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

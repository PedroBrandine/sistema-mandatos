"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  buscarDimensoesGipAtivas,
  buscarGipDoContrato,
  buscarSubmissaoPropria,
  type DimensaoGip,
} from "@backend/queries/formulario";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { createClient } from "@backend/supabase/client";
import type { Json } from "@backend/supabase/database.types";

import { usePapelGlobal } from "@/hooks/use-papel-global";
import { Button } from "@/components/ui/button";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export interface FormularioGipFormProps {
  idContrato: number;
}

const MOMENTOS = [
  { valor: "inicio", rotulo: "Início" },
  { valor: "meio", rotulo: "Meio" },
  { valor: "fim", rotulo: "Fim" },
] as const;
type Momento = (typeof MOMENTOS)[number]["valor"];

interface RespostasGip {
  posicaoLideranca: boolean;
  rotinaTrabalho: string;
  comunicacaoInterna: string;
  rotinasFeedback: string;
  gipEstruturaOrganizada: boolean;
  gipEntregasAcontecendo: boolean;
  dimensoes: Record<string, number>;
}

// FRM-15 a FRM-19 (design.md, Components -> FormularioGipForm). Tela sob
// medida -- 3 ações (início/meio/fim), campos fixos + 4 dimensões. Grava
// direto em fat_submissao (mesmo padrão de FormularioGenericoForm, T18);
// fat_gip/fat_gip_dimensao são 100% derivadas pelo trigger app.trg_deriva_gip
// (T8) -- este componente nunca escreve nelas.
//
// SPEC_DEVIATION: design.md não lista uma checagem de papel explícita aqui
// -- mas o catálogo endereça GIP a respondente='gestora' (context.md), e
// FormularioGenericoForm já tem o mesmo tipo de bloqueio (FRM-09/"não é o
// respondente"). Mentor/Assessor navegando direto pra /formularios/gip
// recebem o mesmo tipo de aviso, em vez de um formulário quebrado -- RLS já
// bloqueia a escrita de qualquer jeito (defesa em profundidade).
export function FormularioGipForm({ idContrato }: FormularioGipFormProps) {
  const { papel, idUsuario, carregando: carregandoPapel } = usePapelGlobal();
  const podeResponder = papel === "admin" || papel === "gestora";

  const idFormularioQuery = useQuery({
    queryKey: ["formulario-gip-id"],
    queryFn: async (): Promise<{ idFormulario: number; permiteEdicaoAberta: boolean; versaoFormulario: number }> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ref_formulario")
        .select("id_formulario, permite_edicao_aberta, versao")
        .eq("codigo", "gip")
        .single();
      if (error) throw mapeiaErroRpc(error);
      return {
        idFormulario: data.id_formulario,
        permiteEdicaoAberta: data.permite_edicao_aberta,
        versaoFormulario: data.versao,
      };
    },
  });

  const dimensoesQuery = useQuery({
    queryKey: ["gip-dimensoes-ativas"],
    queryFn: () => buscarDimensoesGipAtivas(createClient()),
  });

  const evolucaoQuery = useQuery({
    queryKey: ["gip-evolucao", idContrato],
    queryFn: () => buscarGipDoContrato(createClient(), idContrato),
  });

  if (carregandoPapel || idFormularioQuery.isLoading || dimensoesQuery.isLoading || evolucaoQuery.isLoading) {
    return <CarregandoSkeleton variante="list" />;
  }

  if (!podeResponder) {
    return (
      <EstadoVazio
        titulo="Você não é o respondente deste formulário"
        mensagem="O GIP é preenchido pela Gestora ou Admin do contrato."
      />
    );
  }

  if (idFormularioQuery.isError || dimensoesQuery.isError || evolucaoQuery.isError) {
    return (
      <ErroInline
        mensagem="Não foi possível carregar o GIP."
        onRetry={() => {
          void idFormularioQuery.refetch();
          void dimensoesQuery.refetch();
          void evolucaoQuery.refetch();
        }}
      />
    );
  }

  const { idFormulario, permiteEdicaoAberta, versaoFormulario } = idFormularioQuery.data!;
  const dimensoes = dimensoesQuery.data ?? [];
  const evolucao = evolucaoQuery.data ?? [];
  const momentosAplicados = new Set(evolucao.map((e) => e.momento));

  return (
    <div className="grid gap-6">
      {evolucao.length > 0 && (
        <div className="grid gap-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Evolução já aplicada</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dimensão</TableHead>
                <TableHead>Momento</TableHead>
                <TableHead>Régua dos sonhos</TableHead>
                <TableHead>Onde chegamos</TableHead>
                <TableHead>Gap</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evolucao.map((linha) => (
                <TableRow key={`${linha.momento}-${linha.dimensao}`}>
                  <TableCell className="font-medium">{linha.nomeDimensao}</TableCell>
                  <TableCell className="capitalize">{linha.momento}</TableCell>
                  <TableCell>{linha.reguaSonhos ?? "—"}</TableCell>
                  <TableCell>{linha.ondeChegamos ?? "—"}</TableCell>
                  <TableCell>{linha.gap ?? "—"}</TableCell>
                  <TableCell className="capitalize">{linha.situacao ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex gap-2">
        {MOMENTOS.map((m) => (
          <MomentoTab key={m.valor} momento={m} jaAplicado={momentosAplicados.has(m.valor)} />
        ))}
      </div>
    </div>
  );

  // Componente interno que decide, por aba, se mostra os campos (habilitado)
  // ou um aviso de "já aplicado" (desabilitado -- permite_edicao_aberta=false).
  function MomentoTab({
    momento,
    jaAplicado,
  }: {
    momento: (typeof MOMENTOS)[number];
    jaAplicado: boolean;
  }) {
    const [ativo, setAtivo] = useState(false);
    const bloqueado = jaAplicado && !permiteEdicaoAberta;

    if (!ativo) {
      return (
        <Button type="button" variant={jaAplicado ? "outline" : "default"} disabled={bloqueado} onClick={() => setAtivo(true)}>
          {m_rotulo(momento, jaAplicado)}
        </Button>
      );
    }

    return (
      <CamposGip
        idContrato={idContrato}
        idFormulario={idFormulario}
        versaoFormulario={versaoFormulario}
        idUsuario={idUsuario as number}
        momento={momento.valor}
        dimensoes={dimensoes}
        onFechar={() => setAtivo(false)}
      />
    );
  }
}

function m_rotulo(momento: (typeof MOMENTOS)[number], jaAplicado: boolean): string {
  return jaAplicado ? `${momento.rotulo} (aplicado)` : momento.rotulo;
}

function campoDimensaoZod(d: DimensaoGip) {
  return z.number().int().min(d.valorMin).max(d.valorMax);
}

// Wrapper que resolve a submissão própria (se existir) antes de montar o
// formulário -- useForm só pode ser chamado 1x por instância e sua
// defaultValues só é lida no mount (React Hook Form não reage a mudanças
// depois), então CamposGipForm (que possui o useForm) só nasce depois que
// submissaoQuery resolve. Mesmo padrão de FormularioGenericoForm/
// FormularioGenericoCampos (T18) -- e evita o erro de Rules of Hooks de ter
// useForm/useMutation atrás de um retorno condicional.
function CamposGip({
  idContrato,
  idFormulario,
  versaoFormulario,
  idUsuario,
  momento,
  dimensoes,
  onFechar,
}: {
  idContrato: number;
  idFormulario: number;
  versaoFormulario: number;
  idUsuario: number;
  momento: Momento;
  dimensoes: DimensaoGip[];
  onFechar: () => void;
}) {
  const submissaoQuery = useQuery({
    queryKey: ["gip-submissao-propria", idContrato, idFormulario, idUsuario, momento],
    queryFn: () => buscarSubmissaoPropria(createClient(), idContrato, idFormulario, idUsuario, momento),
  });

  if (submissaoQuery.isLoading) {
    return <CarregandoSkeleton />;
  }

  return (
    <CamposGipForm
      idContrato={idContrato}
      idFormulario={idFormulario}
      versaoFormulario={versaoFormulario}
      idUsuario={idUsuario}
      momento={momento}
      dimensoes={dimensoes}
      existente={submissaoQuery.data ?? null}
      onFechar={onFechar}
    />
  );
}

function CamposGipForm({
  idContrato,
  idFormulario,
  versaoFormulario,
  idUsuario,
  momento,
  dimensoes,
  existente,
  onFechar,
}: {
  idContrato: number;
  idFormulario: number;
  versaoFormulario: number;
  idUsuario: number;
  momento: Momento;
  dimensoes: DimensaoGip[];
  existente: Awaited<ReturnType<typeof buscarSubmissaoPropria>>;
  onFechar: () => void;
}) {
  const queryClient = useQueryClient();

  const dimensoesShape = useMemo(
    () => Object.fromEntries(dimensoes.map((d) => [d.codigo, campoDimensaoZod(d)])),
    [dimensoes]
  );
  const schema = useMemo(
    () =>
      z.object({
        posicaoLideranca: z.boolean(),
        rotinaTrabalho: z.string().min(1, "Obrigatório"),
        comunicacaoInterna: z.string().min(1, "Obrigatório"),
        rotinasFeedback: z.string().min(1, "Obrigatório"),
        gipEstruturaOrganizada: z.boolean(),
        gipEntregasAcontecendo: z.boolean(),
        dimensoes: z.object(dimensoesShape),
      }),
    [dimensoesShape]
  );

  const respostasExistentes = (existente?.respostas ?? {}) as Record<string, unknown>;
  const dimensoesExistentes = (respostasExistentes.dimensoes ?? {}) as Record<string, number>;

  const defaultValues: RespostasGip = {
    posicaoLideranca: (respostasExistentes.posicao_lideranca as boolean) ?? false,
    rotinaTrabalho: (respostasExistentes.rotina_trabalho as string) ?? "",
    comunicacaoInterna: (respostasExistentes.comunicacao_interna as string) ?? "",
    rotinasFeedback: (respostasExistentes.rotinas_feedback as string) ?? "",
    gipEstruturaOrganizada: (respostasExistentes.gip_estrutura_organizada as boolean) ?? false,
    gipEntregasAcontecendo: (respostasExistentes.gip_entregas_acontecendo as boolean) ?? false,
    dimensoes: Object.fromEntries(dimensoes.map((d) => [d.codigo, dimensoesExistentes[d.codigo] ?? d.valorMin])),
  };

  const form = useForm<RespostasGip>({
    resolver: zodResolver(schema) as unknown as Resolver<RespostasGip>,
    mode: "onChange",
    defaultValues,
  });

  const mutation = useMutation({
    mutationFn: async (valores: RespostasGip) => {
      const supabase = createClient();
      // FRM-15 a FRM-19: contrato JSONB verbatim do design.md -- grava só em
      // fat_submissao, nunca em fat_gip/fat_gip_dimensao (100% trigger).
      const respostas: Json = {
        posicao_lideranca: valores.posicaoLideranca,
        rotina_trabalho: valores.rotinaTrabalho,
        comunicacao_interna: valores.comunicacaoInterna,
        rotinas_feedback: valores.rotinasFeedback,
        gip_estrutura_organizada: valores.gipEstruturaOrganizada,
        gip_entregas_acontecendo: valores.gipEntregasAcontecendo,
        dimensoes: valores.dimensoes,
      } as Json;

      if (existente) {
        const { error } = await supabase
          .from("fat_submissao")
          .update({ respostas, atualizada_em: new Date().toISOString() })
          .eq("id_submissao", existente.idSubmissao);
        if (error) throw mapeiaErroRpc(error);
        return;
      }

      const { error } = await supabase.from("fat_submissao").insert({
        id_contrato: idContrato,
        id_formulario: idFormulario,
        versao_formulario: versaoFormulario,
        id_usuario_respondente: idUsuario,
        momento,
        respostas,
      });
      if (error) throw mapeiaErroRpc(error);
    },
    onSuccess: () => {
      toast.success("GIP registrado com sucesso.");
      void queryClient.invalidateQueries({ queryKey: ["gip-evolucao", idContrato] });
      void queryClient.invalidateQueries({ queryKey: ["gip-submissao-propria", idContrato, idFormulario, idUsuario, momento] });
      onFechar();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="grid gap-4 rounded-lg border p-4">
        <FormField
          control={form.control}
          name="posicaoLideranca"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between">
              <FormLabel>Ocupa posição de liderança</FormLabel>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="rotinaTrabalho"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rotina de trabalho</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="comunicacaoInterna"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Comunicação interna</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="rotinasFeedback"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rotinas de feedback</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="gipEstruturaOrganizada"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between">
              <FormLabel>Estrutura organizada</FormLabel>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="gipEntregasAcontecendo"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between">
              <FormLabel>Entregas acontecendo</FormLabel>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {dimensoes.map((d) => (
          <FormField
            key={d.idDimensao}
            control={form.control}
            name={`dimensoes.${d.codigo}`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{d.nome}</FormLabel>
                <FormControl>
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: d.valorMax - d.valorMin + 1 }, (_, i) => d.valorMin + i).map((opcao) => (
                        <SelectItem key={opcao} value={String(opcao)}>
                          {opcao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending || !form.formState.isValid}>
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
          <Button type="button" variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { buscarReguaDoContrato } from "@backend/queries/etapa-contrato";
import {
  buscarEncontrosDoContrato,
  buscarTiposRegistroDaEtapa,
  type RefOption,
} from "@backend/queries/incidencia";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { registroSchema, type RegistroInput } from "@backend/schemas/registro";
import { createClient } from "@backend/supabase/client";
import { usePapelGlobal } from "@/hooks/use-papel-global";

import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const SEM_VINCULO = "_nenhum";

// INC-09, INC-10, INC-11, FGC-17 (T23, fatos-geradores-ciclo-vida). INSERT/
// UPDATE direto (sem RPC -- fat_registro é 1 tabela só, design.md Tech
// Decisions). id_usuario_autor (NOT NULL, sem RPC) vem de usePapelGlobal,
// nunca digitado no formulário; RLS (fat_registro.WITH CHECK) rejeitaria
// qualquer outro valor mesmo que o form tentasse enviar.
//
// `canal` removido (achado de Execute: FMC-19 já tinha tirado a coluna do
// `registroSchema` -- `feat(ficha): schemas Zod da ficha; remove canal do
// produto` -- e este arquivo ficou desatualizado, com erro de tipo. Corrigido
// aqui, junto da extensão desta task, spec.md P1 Registro AC11).
//
// T23: `idEtapa` vira opcional -- fora da tela de etapa (a aba nova,
// AD-057) não há `codigo` de rota para resolvê-lo. Sem `idEtapa` fixado, o
// form busca a régua do contrato (buscarReguaDoContrato, já existe --
// nenhuma query nova) e exige a escolha explícita antes de habilitar
// Salvar (AC4 do spec: o vínculo com a etapa nunca pode ser perdido na
// migração do formulário). A etapa em si não é coluna de `fat_registro` --
// serve só para filtrar quais Tipos de Registro (`ref_tipo_registro`) fazem
// sentido oferecer.
export interface RegistroExistente {
  idRegistro: number;
  idTipoRegistro: number;
  ocorridoEm: string;
  nrSequencia: number | null;
  idEncontro: number | null;
  resumo: string | null;
}

export interface RegistroFormProps {
  idContrato: number;
  idEtapa?: number;
  registroExistente?: RegistroExistente;
  onConcluido: () => void;
}

export function RegistroForm({ idContrato, idEtapa, registroExistente, onConcluido }: RegistroFormProps) {
  const { idUsuario, carregando: carregandoUsuario } = usePapelGlobal();
  const [etapas, setEtapas] = useState<RefOption[]>([]);
  const [etapaEscolhida, setEtapaEscolhida] = useState<number | null>(idEtapa ?? null);
  const [tipos, setTipos] = useState<RefOption[]>([]);
  const [encontros, setEncontros] = useState<RefOption[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const precisaEscolherEtapa = idEtapa === undefined;
  const etapaEfetiva = idEtapa ?? etapaEscolhida;

  const form = useForm<RegistroInput>({
    resolver: zodResolver(registroSchema),
    mode: "onChange",
    defaultValues: registroExistente
      ? {
          id_contrato: idContrato,
          id_tipo_registro: registroExistente.idTipoRegistro,
          ocorrido_em: registroExistente.ocorridoEm,
          nr_sequencia: registroExistente.nrSequencia,
          id_encontro: registroExistente.idEncontro,
          resumo: registroExistente.resumo,
        }
      : {
          id_contrato: idContrato,
          ocorrido_em: new Date().toISOString().slice(0, 10),
        },
  });

  useEffect(() => {
    if (!precisaEscolherEtapa) return;
    const supabase = createClient();
    void buscarReguaDoContrato(supabase, idContrato).then((regua) =>
      setEtapas(regua.map((e) => ({ id: e.idEtapa, nome: e.nome })))
    );
  }, [idContrato, precisaEscolherEtapa]);

  useEffect(() => {
    // Sem `setTipos([])` aqui de propósito (achado de lint,
    // react-hooks/set-state-in-effect): `tipos` já nasce `[]` (useState
    // acima) e `etapaEfetiva` só transiciona null -> valor nesta UI (nunca
    // volta a null depois de escolhida) -- reafirmar `[]` só custaria um
    // render extra sem mudar nada visível.
    if (etapaEfetiva == null) return;
    const supabase = createClient();
    void buscarTiposRegistroDaEtapa(supabase, etapaEfetiva).then(setTipos);
    void buscarEncontrosDoContrato(supabase, idContrato).then((lista) =>
      setEncontros(lista.map((e) => ({ id: e.idEncontro, nome: e.titulo })))
    );
  }, [idContrato, etapaEfetiva]);

  async function enviar(valores: RegistroInput) {
    if (!idUsuario) {
      setErro("Não foi possível identificar o usuário autor. Recarregue a página e tente novamente.");
      return;
    }

    setEnviando(true);
    setErro(null);
    const supabase = createClient();

    const payload = {
      id_contrato: valores.id_contrato,
      id_tipo_registro: valores.id_tipo_registro,
      nr_sequencia: valores.nr_sequencia ?? undefined,
      id_encontro: valores.id_encontro ?? undefined,
      ocorrido_em: valores.ocorrido_em,
      resumo: valores.resumo ?? undefined,
      // conteudo: sem campo no formulário (nenhuma menção em spec.md/design.md
      // como campo de UI) -- omitido do payload, DEFAULT '{}'::jsonb da coluna
      // assume (mesmo rationale documentado em schemas/registro.ts).
    };

    const { error } = registroExistente
      ? await supabase.from("fat_registro").update(payload).eq("id_registro", registroExistente.idRegistro)
      : await supabase.from("fat_registro").insert({ ...payload, id_usuario_autor: idUsuario });

    setEnviando(false);
    if (error) {
      setErro(mapeiaErroRpc(error).message);
      return;
    }

    if (!registroExistente) {
      form.reset({ id_contrato: idContrato, ocorrido_em: new Date().toISOString().slice(0, 10) });
    }
    onConcluido();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(enviar)} className="grid gap-4 rounded-lg border p-4">
        {precisaEscolherEtapa && (
          <div className="grid gap-2">
            <FormLabel>Etapa</FormLabel>
            <Select
              value={etapaEscolhida ? String(etapaEscolhida) : undefined}
              onValueChange={(v) => setEtapaEscolhida(Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent>
                {etapas.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="id_tipo_registro"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Registro</FormLabel>
                <Select value={field.value ? String(field.value) : undefined} onValueChange={(v) => field.onChange(Number(v))}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {tipos.map((t) => (
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
          <FormField
            control={form.control}
            name="ocorrido_em"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ocorrido em</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="nr_sequencia"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nº sequência (opcional)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
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
            name="id_encontro"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Encontro de origem (opcional)</FormLabel>
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
                    {encontros.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.nome}
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
          name="resumo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Resumo (opcional)</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} rows={2} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {erro && <ErroInline mensagem={erro} />}
        <div>
          <Button
            type="submit"
            disabled={enviando || carregandoUsuario || !form.formState.isValid || (precisaEscolherEtapa && !etapaEscolhida)}
          >
            {enviando ? "Salvando..." : registroExistente ? "Salvar" : "Registrar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { mapeiaErroRpc } from "@backend/rpc/errors";
import { substituirVinculo } from "@backend/rpc/vinculo";
import { vinculoSchema, type VinculoInput } from "@backend/schemas/vinculo";
import { createClient } from "@backend/supabase/client";
import type { Database } from "@backend/supabase/database.types";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type VinculoRow = Database["public"]["Tables"]["rel_usuario_contrato"]["Row"];
export interface UsuarioOption {
  id: number;
  nome: string;
}

const CARGOS = ["parlamentar", "chefe_gabinete", "assessor", "secretaria_executiva", "nao_se_aplica"] as const;
const PAPEIS = ["gestora", "mentor", "assessor", "leitura"] as const;

export type VinculoFormModo =
  | { tipo: "adicionar" }
  | { tipo: "editar"; vinculo: VinculoRow }
  | { tipo: "substituir"; vinculo: VinculoRow };

export interface VinculoFormProps {
  idContrato: number;
  modo: VinculoFormModo;
  usuarios: UsuarioOption[];
  onConcluido: () => void;
  onCancelar: () => void;
}

function areasParaTexto(areas: string[] | null | undefined): string {
  return (areas ?? []).join(", ");
}
function textoParaAreas(texto: string): string[] | null {
  const lista = texto
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return lista.length > 0 ? lista : null;
}

// cargo/grau_responsabilidade/areas -- mesmo shape de VinculoEditavel (T25),
// mas com o `areas` de string[] representado como texto separado por vírgula
// no input (conversão feita em textoParaAreas/areasParaTexto).
const editavelSchema = z.object({
  cargo: z.enum(CARGOS).nullable().optional(),
  grau_responsabilidade: z.string().nullable().optional(),
  areasTexto: z.string().optional(),
});
type EditavelFormValues = z.infer<typeof editavelSchema>;

// Adicionar (insert, uq_vinculo é o backstop de FND-USR-07), editar (update
// só cargo/grau/áreas -- FND-USR-04, nunca dt_inicio/dt_fim) e substituir
// (substituirVinculo RPC, T28 -- FND-USR-05) um vínculo usuário-contrato.
export function VinculoForm({ idContrato, modo, usuarios, onConcluido, onCancelar }: VinculoFormProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [idUsuarioNovo, setIdUsuarioNovo] = useState<number | null>(null);

  const formAdicionar = useForm<VinculoInput>({
    resolver: zodResolver(vinculoSchema),
    mode: "onChange",
    defaultValues: { id_contrato: idContrato, id_usuario: 0, papel_no_contrato: "assessor" },
  });

  const formEditavel = useForm<EditavelFormValues>({
    resolver: zodResolver(editavelSchema),
    mode: "onChange",
    defaultValues:
      modo.tipo !== "adicionar"
        ? {
            cargo: modo.vinculo.cargo as EditavelFormValues["cargo"],
            grau_responsabilidade: modo.vinculo.grau_responsabilidade,
            areasTexto: areasParaTexto(modo.vinculo.areas),
          }
        : {},
  });

  async function submeterAdicionar(v: VinculoInput) {
    setEnviando(true);
    setErro(null);
    const supabase = createClient();
    const { error } = await supabase.from("rel_usuario_contrato").insert({
      id_contrato: idContrato,
      id_usuario: v.id_usuario,
      papel_no_contrato: v.papel_no_contrato,
      cargo: v.cargo ?? null,
      grau_responsabilidade: v.grau_responsabilidade ?? null,
      areas: v.areas ?? null,
    });
    setEnviando(false);
    if (error) {
      setErro(mapeiaErroRpc(error).message);
      return;
    }
    onConcluido();
  }

  async function submeterEditar(v: EditavelFormValues) {
    if (modo.tipo === "adicionar") return;
    setEnviando(true);
    setErro(null);
    const supabase = createClient();
    // FND-USR-04: só cargo/grau/áreas -- o payload nem inclui as chaves
    // dt_inicio/dt_fim, então não há como alterá-las por acidente aqui.
    const { error } = await supabase
      .from("rel_usuario_contrato")
      .update({
        cargo: v.cargo ?? null,
        grau_responsabilidade: v.grau_responsabilidade ?? null,
        areas: textoParaAreas(v.areasTexto ?? ""),
      })
      .eq("id_vinculo", modo.vinculo.id_vinculo);
    setEnviando(false);
    if (error) {
      setErro(mapeiaErroRpc(error).message);
      return;
    }
    onConcluido();
  }

  async function submeterSubstituir(v: EditavelFormValues) {
    if (modo.tipo !== "substituir") return;
    if (idUsuarioNovo == null) {
      setErro("Selecione a pessoa que vai substituir o vínculo.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const supabase = createClient();
      await substituirVinculo(supabase, {
        idVinculoAntigo: modo.vinculo.id_vinculo,
        idUsuarioNovo,
        cargo: v.cargo ?? null,
        grauResponsabilidade: v.grau_responsabilidade ?? null,
        areas: textoParaAreas(v.areasTexto ?? ""),
      });
      onConcluido();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao substituir vínculo.");
    } finally {
      setEnviando(false);
    }
  }

  if (modo.tipo === "adicionar") {
    return (
      <Form {...formAdicionar}>
        <form onSubmit={formAdicionar.handleSubmit(submeterAdicionar)} className="grid gap-4">
          <FormField
            control={formAdicionar.control}
            name="id_usuario"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pessoa</FormLabel>
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
                    {usuarios.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formAdicionar.control}
            name="papel_no_contrato"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Papel no contrato</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PAPEIS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formAdicionar.control}
            name="cargo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cargo</FormLabel>
                <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CARGOS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formAdicionar.control}
            name="grau_responsabilidade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Grau de responsabilidade</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {erro && <p className="text-sm text-red-500">{erro}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancelar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Salvando..." : "Adicionar vínculo"}
            </Button>
          </div>
        </form>
      </Form>
    );
  }

  if (modo.tipo === "editar") {
    return (
      <Form {...formEditavel}>
        <form onSubmit={formEditavel.handleSubmit(submeterEditar)} className="grid gap-4">
          <FormField
            control={formEditavel.control}
            name="cargo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cargo</FormLabel>
                <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CARGOS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formEditavel.control}
            name="grau_responsabilidade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Grau de responsabilidade</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={formEditavel.control}
            name="areasTexto"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Áreas (separadas por vírgula)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {erro && <p className="text-sm text-red-500">{erro}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancelar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </Form>
    );
  }

  return (
    <Form {...formEditavel}>
      <form onSubmit={formEditavel.handleSubmit(submeterSubstituir)} className="grid gap-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium">Nova pessoa</label>
          <Select
            value={idUsuarioNovo ? String(idUsuarioNovo) : undefined}
            onValueChange={(v) => setIdUsuarioNovo(Number(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {usuarios.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <FormField
          control={formEditavel.control}
          name="cargo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cargo</FormLabel>
              <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CARGOS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={formEditavel.control}
          name="grau_responsabilidade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Grau de responsabilidade</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {erro && <p className="text-sm text-red-500">{erro}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando}>
            {enviando ? "Substituindo..." : "Substituir"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

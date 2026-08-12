"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { emitirConvite } from "@backend/rpc/convite";
import { convidarSchema, type ConvidarInput } from "@backend/schemas/convite";
import { createClient } from "@backend/supabase/client";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CARGOS = ["parlamentar", "chefe_gabinete", "assessor", "secretaria_executiva", "nao_se_aplica"] as const;
const PAPEIS = ["mentor", "assessor"] as const;

export interface ConviteFormProps {
  idContrato: number;
  onConcluido: () => void;
  onCancelar: () => void;
}

function textoParaAreas(texto: string): string[] | null {
  const lista = texto
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return lista.length > 0 ? lista : null;
}

// CVT-01. Emite um convite (Mentor/Assessor externo) pra este contrato --
// e-mail, papel (só mentor/assessor -- CVT-07), cargo, grau e áreas. Ao
// suceder, mostra a URL uma única vez (nunca reexibida -- só o hash fica
// gravado, T1); "áreas" fica fora do RHF/convidarSchema (mesmo padrão de
// VinculoForm.textoParaAreas), convertida no submit.
export function ConviteForm({ idContrato, onConcluido, onCancelar }: ConviteFormProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [areasTexto, setAreasTexto] = useState("");
  const [urlGerada, setUrlGerada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const form = useForm<ConvidarInput>({
    resolver: zodResolver(convidarSchema),
    mode: "onChange",
    defaultValues: { papel_no_contrato: "assessor" },
  });

  async function submeter(v: ConvidarInput) {
    setEnviando(true);
    setErro(null);
    try {
      const supabase = createClient();
      const { caminho } = await emitirConvite(supabase, {
        idContrato,
        email: v.email,
        papelNoContrato: v.papel_no_contrato,
        cargo: v.cargo ?? null,
        grauResponsabilidade: v.grau_responsabilidade ?? null,
        areas: textoParaAreas(areasTexto),
      });
      setUrlGerada(`${window.location.origin}${caminho}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao emitir convite.");
    } finally {
      setEnviando(false);
    }
  }

  async function copiarUrl() {
    if (!urlGerada) return;
    await navigator.clipboard.writeText(urlGerada);
    setCopiado(true);
  }

  if (urlGerada) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Copie e repasse este link manualmente (Slack/WhatsApp) -- ele não será mostrado de novo.
        </p>
        <div className="flex items-center gap-2">
          <Input readOnly value={urlGerada} />
          <Button type="button" variant="outline" onClick={() => void copiarUrl()}>
            {copiado ? "Copiado!" : "Copiar"}
          </Button>
        </div>
        <Button type="button" onClick={onConcluido}>
          Concluir
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submeter)} className="grid gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
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
          control={form.control}
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
          control={form.control}
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
        <div className="grid gap-2">
          <label className="text-sm font-medium">Áreas (separadas por vírgula)</label>
          <Input value={areasTexto} onChange={(e) => setAreasTexto(e.target.value)} />
        </div>
        {erro && <p className="text-sm text-red-500">{erro}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando}>
            {enviando ? "Convidando..." : "Convidar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

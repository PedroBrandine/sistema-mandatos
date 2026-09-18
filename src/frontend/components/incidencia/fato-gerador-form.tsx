"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import {
  buscarNiveisIip,
  buscarTipologiasCompletas,
  type TipologiaCompleta,
} from "@backend/queries/incidencia";
import { criarFatoGerador } from "@backend/rpc/fato-gerador";
import { fatoGeradorSchema, type FatoGeradorInput } from "@backend/schemas/fato-gerador";
import { createClient } from "@backend/supabase/client";

import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { OrigemFato } from "./seletor-origem";

// INC-01, INC-02, FGC-01..FGC-12 (T17, fatos-geradores-ciclo-vida).
// Componente "burro" quanto a Dialog -- só recebe callbacks, nunca sabe se
// está num <Dialog> ou inline (mesmo padrão de UsuarioForm, ver
// design.md/context.md "Onde vivem as novas ações de UI"). Chama
// app.criar_fato_gerador (RPC, AD-024) via criarFatoGerador -- fato +
// vínculo(s) opcional(is) na mesma transação, id_usuario_autor resolvido no
// servidor (app.id_usuario()), nunca enviado pelo client.
//
// Achado de UAT (Pedro, 2026-08-14): a 1ª versão deste form expunha
// Tipologia como 1 Select achatado (51 itens, "Grupo · Tipologia · Estado"
// truncado) e Nível D1-D3/Preditor 1-2 como Selects livres. Errado: o CSV
// real (docs/DB_Fatos_Geradores - Ref_Tipologias.csv) trata Preditor/Nível
// como atributo FIXO de cada combinação Grupo+Tipologia+Estado, não escolha
// por ocorrência -- já gravado em ref_tipologia.{nivel_d1_padrao,...,
// id_preditor_1,id_preditor_2} desde o seed (T1). Refeito como cascata
// Grupo→Tipologia→Estado (cada passo filtra o próximo) que resolve
// id_tipologia e deriva nível/preditor automaticamente (somente leitura) --
// a Gestora não escolhe nível nem preditor. NÃO TOCAR nesta cascata (T17
// só estende o resto do formulário).
//
// T17 (FatoGeradorWizard, T16): este form vira o passo 2 -- natureza
// (situacaoInicial) e origem (origemInicial) já vêm escolhidas do passo 1,
// então os Selects de "Meta de origem"/"Insight de origem" que existiam
// aqui saem (duplicariam a escolha) e viram uma exibição somente leitura da
// origem já escolhida. Data de ocorrência/prevista alternam conforme
// situacaoInicial (spec.md P1 AC10/AC11); Título passa a ser obrigatório
// (fatoGeradorSchema, T8).
//
// Fix pós-Verifier (validation.md gap 1, 2026-09-17): edição via
// `fatoGeradorExistente` -- UPDATE direto em fat_fato_gerador (RLS
// p_por_contrato já cobre, é FOR ALL, mesma classe de marcarFatoRealizado/
// T10), sem passar pelo wizard (a natureza/origem não são reabertas na
// edição -- mudar `situacao` é responsabilidade só de RealizarFatoDialog/T19,
// e origem não tem UI de edição desenhada). `origemInicial` vira opcional:
// ausente em edição, o bloco "Origem: ..." simplesmente não aparece (sem
// nova busca só pra exibir contexto). Grupo/Tipologia/Estado continuam
// editáveis -- reaproveita a cascata inteira, só populada a partir da
// tipologia existente assim que o catálogo carrega.
export interface FatoGeradorExistente {
  idFatoGerador: number;
  idTipologia: number;
  titulo: string | null;
  contribuicaoLegisla: number | null;
  descricaoEvidencia: string | null;
  dtOcorrencia: string | null;
  dtPrevista: string | null;
}

export interface FatoGeradorFormProps {
  idContrato: number;
  situacaoInicial: "projetado" | "realizado";
  origemInicial?: OrigemFato;
  fatoGeradorExistente?: FatoGeradorExistente;
  onConcluido: (criado?: { idFatoGerador: number }) => void;
  onCancelar: () => void;
}

function origemParaCampos(origem: OrigemFato) {
  return {
    id_meta_origem: origem.tipo === "meta" ? origem.id : null,
    id_insight_origem: origem.tipo === "insight" ? origem.id : null,
    id_pre_insight_origem: origem.tipo === "pre_insight" ? origem.id : null,
    id_registro_origem: origem.tipo === "registro" ? origem.id : null,
  };
}

const RÓTULO_ORIGEM: Record<Exclude<OrigemFato["tipo"], "sem_origem">, string> = {
  pre_insight: "Pré-Insight",
  registro: "Registro",
  insight: "Insight",
  meta: "Meta",
};

function rotuloOrigem(origem: OrigemFato): string {
  if (origem.tipo === "sem_origem") return "Sem origem";
  return `${RÓTULO_ORIGEM[origem.tipo]}: ${origem.rotulo}`;
}

export function FatoGeradorForm({
  idContrato,
  situacaoInicial,
  origemInicial,
  fatoGeradorExistente,
  onConcluido,
  onCancelar,
}: FatoGeradorFormProps) {
  const [tipologias, setTipologias] = useState<TipologiaCompleta[]>([]);
  const [niveis, setNiveis] = useState<{ codigo: string; rotulo: string }[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Cascata Grupo -> Tipologia -> Estado -- estado de UI (não campo do
  // schema); só a combinação completa vira id_tipologia + nível/preditor
  // derivados (aplicarCombinacao), via form.setValue.
  const [grupo, setGrupo] = useState<string | null>(null);
  const [tipologiaNome, setTipologiaNome] = useState<string | null>(null);
  const [estado, setEstado] = useState<string | null>(null);

  const form = useForm<FatoGeradorInput>({
    resolver: zodResolver(fatoGeradorSchema),
    mode: "onChange",
    defaultValues: fatoGeradorExistente
      ? {
          id_contrato: idContrato,
          situacao: situacaoInicial,
          titulo: fatoGeradorExistente.titulo ?? "",
          contribuicao_legisla: fatoGeradorExistente.contribuicaoLegisla,
          descricao_evidencia: fatoGeradorExistente.descricaoEvidencia,
          dt_ocorrencia: fatoGeradorExistente.dtOcorrencia,
          dt_prevista: fatoGeradorExistente.dtPrevista,
        }
      : {
          id_contrato: idContrato,
          situacao: situacaoInicial,
          dt_ocorrencia: situacaoInicial === "realizado" ? new Date().toISOString().slice(0, 10) : null,
          dt_prevista: null,
          ...(origemInicial ? origemParaCampos(origemInicial) : {}),
        },
  });

  useEffect(() => {
    const supabase = createClient();
    void buscarTipologiasCompletas(supabase).then(setTipologias);
    void buscarNiveisIip(supabase).then(setNiveis);
  }, []);

  // Popula a cascata (Grupo/Tipologia/Estado) a partir da tipologia existente
  // assim que o catálogo carrega -- só roda em edição. Escalonado em 3
  // efeitos (achado real de teste: setar grupo/tipologiaNome/estado juntos
  // na MESMA render faz o <Select> de Tipologia/Estado transicionar de
  // disabled+uncontrolled para enabled+controlled na mesma tick -- o Radix
  // não reflete o valor nesse caso, "Select is changing from uncontrolled
  // to controlled" no console. Um passo por render, cada Select já enabled
  // quando ganha valor, resolve.
  useEffect(() => {
    if (!fatoGeradorExistente || tipologias.length === 0 || grupo !== null) return;
    const linha = tipologias.find((t) => t.idTipologia === fatoGeradorExistente.idTipologia);
    if (linha) setGrupo(linha.grupo);
  }, [fatoGeradorExistente, tipologias, grupo]);

  useEffect(() => {
    if (!fatoGeradorExistente || !grupo || tipologiaNome !== null) return;
    const linha = tipologias.find((t) => t.idTipologia === fatoGeradorExistente.idTipologia);
    if (linha) setTipologiaNome(linha.tipologia);
  }, [fatoGeradorExistente, grupo, tipologias, tipologiaNome]);

  useEffect(() => {
    if (!fatoGeradorExistente || !tipologiaNome || estado !== null) return;
    const linha = tipologias.find((t) => t.idTipologia === fatoGeradorExistente.idTipologia);
    if (!linha) return;
    setEstado(linha.estado);
    form.setValue("id_tipologia", linha.idTipologia, { shouldValidate: true });
    form.setValue("nivel_d1", linha.nivelD1Padrao, { shouldValidate: true });
    form.setValue("nivel_d2", linha.nivelD2Padrao, { shouldValidate: true });
    form.setValue("nivel_d3", linha.nivelD3Padrao, { shouldValidate: true });
    form.setValue("id_preditor_1", linha.idPreditor1, { shouldValidate: true });
    form.setValue("id_preditor_2", linha.idPreditor2, { shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `form` (useForm) é
    // estável entre renders, mesmo padrão de selecionarEstado não incluí-lo.
  }, [fatoGeradorExistente, tipologiaNome, tipologias, estado]);

  // Set() preserva ordem de 1ª ocorrência -- tipologias já vem ordenada por
  // id_tipologia (ordem do seed = ordem numérica do Grupo no CSV, 1..11).
  const grupos = useMemo(() => Array.from(new Set(tipologias.map((t) => t.grupo))), [tipologias]);
  const tipologiasDoGrupo = useMemo(
    () => Array.from(new Set(tipologias.filter((t) => t.grupo === grupo).map((t) => t.tipologia))),
    [tipologias, grupo]
  );
  const estadosDaTipologia = useMemo(
    () => tipologias.filter((t) => t.grupo === grupo && t.tipologia === tipologiaNome),
    [tipologias, grupo, tipologiaNome]
  );
  const tipologiaResolvida = estadosDaTipologia.find((t) => t.estado === estado);

  function rotuloNivel(codigo: string | null): string {
    if (!codigo) return "—";
    return niveis.find((n) => n.codigo === codigo)?.rotulo ?? codigo;
  }

  function limparDerivados() {
    form.setValue("id_tipologia", undefined as unknown as number, { shouldValidate: true });
    form.setValue("nivel_d1", null, { shouldValidate: true });
    form.setValue("nivel_d2", null, { shouldValidate: true });
    form.setValue("nivel_d3", null, { shouldValidate: true });
    form.setValue("id_preditor_1", null, { shouldValidate: true });
    form.setValue("id_preditor_2", null, { shouldValidate: true });
  }

  function selecionarGrupo(v: string) {
    setGrupo(v);
    setTipologiaNome(null);
    setEstado(null);
    limparDerivados();
  }

  function selecionarTipologia(v: string) {
    setTipologiaNome(v);
    setEstado(null);
    limparDerivados();
  }

  function selecionarEstado(v: string) {
    setEstado(v);
    const linha = estadosDaTipologia.find((t) => t.estado === v);
    if (!linha) return;
    form.setValue("id_tipologia", linha.idTipologia, { shouldValidate: true });
    form.setValue("nivel_d1", linha.nivelD1Padrao, { shouldValidate: true });
    form.setValue("nivel_d2", linha.nivelD2Padrao, { shouldValidate: true });
    form.setValue("nivel_d3", linha.nivelD3Padrao, { shouldValidate: true });
    form.setValue("id_preditor_1", linha.idPreditor1, { shouldValidate: true });
    form.setValue("id_preditor_2", linha.idPreditor2, { shouldValidate: true });
  }

  async function enviar(valores: FatoGeradorInput) {
    setEnviando(true);
    setErro(null);
    const supabase = createClient();

    if (fatoGeradorExistente) {
      // UPDATE direto -- sem RPC (nenhuma invariante multi-tabela na
      // edição: origem/rel_fato_origem não é tocada aqui). RLS
      // p_por_contrato já cobre UPDATE (FOR ALL, mesma classe de T10).
      const { error } = await supabase
        .from("fat_fato_gerador")
        .update({
          id_tipologia: valores.id_tipologia,
          nivel_d1: valores.nivel_d1 ?? null,
          nivel_d2: valores.nivel_d2 ?? null,
          nivel_d3: valores.nivel_d3 ?? null,
          id_preditor_1: valores.id_preditor_1 ?? null,
          id_preditor_2: valores.id_preditor_2 ?? null,
          titulo: valores.titulo,
          contribuicao_legisla: valores.contribuicao_legisla ?? null,
          descricao_evidencia: valores.descricao_evidencia ?? null,
          dt_ocorrencia: valores.dt_ocorrencia ?? null,
          dt_prevista: valores.dt_prevista ?? null,
        })
        .eq("id_fato_gerador", fatoGeradorExistente.idFatoGerador);

      setEnviando(false);
      if (error) {
        setErro(error.message);
        return;
      }
      onConcluido();
      return;
    }

    try {
      const { idFatoGerador } = await criarFatoGerador(supabase, {
        idContrato: valores.id_contrato,
        idTipologia: valores.id_tipologia,
        titulo: valores.titulo,
        situacao: valores.situacao,
        nivelD1: valores.nivel_d1 ?? null,
        nivelD2: valores.nivel_d2 ?? null,
        nivelD3: valores.nivel_d3 ?? null,
        idPreditor1: valores.id_preditor_1 ?? null,
        idPreditor2: valores.id_preditor_2 ?? null,
        contribuicaoLegisla: valores.contribuicao_legisla ?? null,
        descricaoEvidencia: valores.descricao_evidencia ?? null,
        dtOcorrencia: valores.dt_ocorrencia ?? null,
        dtPrevista: valores.dt_prevista ?? null,
        idMetaOrigem: valores.id_meta_origem ?? null,
        idInsightOrigem: valores.id_insight_origem ?? null,
        idPreInsightOrigem: valores.id_pre_insight_origem ?? null,
        idRegistroOrigem: valores.id_registro_origem ?? null,
      });
      onConcluido({ idFatoGerador });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao criar Fato Gerador.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(enviar)} className="grid gap-4">
        {/* Origem já escolhida no passo 1 do wizard (T16) -- somente
            leitura aqui, nunca reoferecida como Select (evita duplicar a
            escolha e divergir do que foi selecionado). Ausente em edição
            (fatoGeradorExistente): editar não reabre a origem. */}
        {origemInicial && (
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            Origem: {rotuloOrigem(origemInicial)}
          </div>
        )}

        <FormField
          control={form.control}
          name="titulo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Figma node-id 118-96 mostra Grupo/Tipologia/Estado como 3 linhas
            empilhadas, não 3 colunas -- ajuste de fidelidade (T13, pente-fino
            2026-09): o Dialog que hospeda este form (aba-incidencia.tsx) é
            estreito o bastante para 3 colunas espremerem o texto das opções
            (nomes de tipologia/estado são longos), causando a sobreposição
            relatada. Empilhar remove o risco em qualquer resolução. */}
        <div className="grid grid-cols-1 gap-3">
          <div className="grid gap-1.5">
            <FormLabel>Grupo</FormLabel>
            <Select value={grupo ?? undefined} onValueChange={selecionarGrupo}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o grupo" />
              </SelectTrigger>
              <SelectContent>
                {grupos.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <FormLabel>Tipologia</FormLabel>
            <Select value={tipologiaNome ?? undefined} onValueChange={selecionarTipologia} disabled={!grupo}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={grupo ? "Selecione a tipologia" : "Selecione o grupo primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {tipologiasDoGrupo.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <FormLabel>Estado</FormLabel>
            <Select value={estado ?? undefined} onValueChange={selecionarEstado} disabled={!tipologiaNome}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={tipologiaNome ? "Selecione o estado" : "Selecione a tipologia primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {estadosDaTipologia.map((t) => (
                  <SelectItem key={t.idTipologia} value={t.estado}>
                    {t.estado}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {form.formState.errors.nivel_d1 && !tipologiaResolvida && (
          <p className="text-sm text-destructive">Selecione Grupo, Tipologia e Estado.</p>
        )}

        {/* Nível D1-D3 e Preditor 1/2 são derivados da combinação
            Grupo+Tipologia+Estado (ref_tipologia.*_padrao) -- não são
            escolha da Gestora (achado de UAT, 2026-08-14). Só leitura. */}
        {tipologiaResolvida && (
          <div className="grid grid-cols-1 gap-3 rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
            {/* D1/D2/D3 continuam lado a lado (3 valores curtos, mesmo
                arranjo do frame 118-96) -- só Preditor 1/2 saem da grade
                (T13): são frases longas (ver figma-dominio-legisla,
                "Predicado" x "Preditor") que espremidas em coluna
                colidiam com o texto vizinho no Dialog estreito. */}
            <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              <p>
                <span className="text-muted-foreground">Nível D1:</span> {rotuloNivel(tipologiaResolvida.nivelD1Padrao)}
              </p>
              <p>
                <span className="text-muted-foreground">Nível D2:</span> {rotuloNivel(tipologiaResolvida.nivelD2Padrao)}
              </p>
              <p>
                <span className="text-muted-foreground">Nível D3:</span> {rotuloNivel(tipologiaResolvida.nivelD3Padrao)}
              </p>
            </div>
            <p>
              <span className="text-muted-foreground">Preditor 1:</span> {tipologiaResolvida.nomePreditor1 ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Preditor 2:</span> {tipologiaResolvida.nomePreditor2 ?? "—"}
            </p>
          </div>
        )}

        {/* Contribuição/Data também empilhadas (Figma 118-96): cada uma é
            uma linha própria no frame, não duas colunas. */}
        <FormField
          control={form.control}
          name="contribuicao_legisla"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contribuição Legisla (0-5, opcional)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {situacaoInicial === "realizado" ? (
          <FormField
            control={form.control}
            name="dt_ocorrencia"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de ocorrência</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={form.control}
            name="dt_prevista"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data prevista</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="descricao_evidencia"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição / evidência (opcional)</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} rows={2} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {erro && <ErroInline mensagem={erro} />}
        <div className="flex gap-2">
          <Button type="submit" disabled={enviando || !form.formState.isValid}>
            {enviando ? "Salvando..." : fatoGeradorExistente ? "Salvar" : "Criar Fato Gerador"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}

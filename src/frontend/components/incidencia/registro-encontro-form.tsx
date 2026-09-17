"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { criarRegistro, type ArtefatoRegistroInput, type ParticipanteRegistroInput } from "@backend/rpc/registro";
import { createClient } from "@backend/supabase/client";

import { parseSchemaCampos } from "@/lib/camada-dinamica";
import { rotuloSequencia } from "@/lib/ficha-formatos";

import { Button } from "@/components/ui/button";
import { ErroInline } from "@/components/ui/erro-inline";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { CamadaDinamica } from "./camada-dinamica";

// Spec anchor: .specs/features/ficha-mandato-contrato/spec.md, P1 Registro de
// encontro com camada dinâmica (FMC-14, FMC-15, FMC-18, FMC-19, FMC-21).
// design.md, Components "RegistroEncontroForm" -- ver o comentário de colisão
// no próprio design.md antes desta seção: este componente NÃO é
// `registro-form.tsx` (esse pertence a `fatos-geradores-ciclo-vida`, Etapa/
// Tipo selecionáveis, edição, escrita direta). Aqui Etapa/Tipo são herdados
// do encontro e IMUTÁVEIS (A-16) -- por isso chegam como texto (nomeEtapa/
// nomeTipo), nunca como <Select>.
//
// Props deliberadamente maiores que a assinatura mínima de design.md (que só
// lista idContrato/idEncontro?/idEtapa/idTipoRegistro/onConcluido/onCancelar):
// nomeEtapa/nomeTipo/qtdPrevista/schemaCampos/encontroDados/
// participantesEncontro/nrSequencia chegam TODOS por prop, sem query nova
// aqui dentro -- decisão registrada no handoff desta task: T31 depende só de
// T30/T21/T16 (nenhuma query), então quem resolve esses dados a partir de
// idEncontro/idTipoRegistro é o chamador (T32, dentro do próprio arquivo do
// popover). Presença em particular É explicitamente "via prop, não query
// nova" (instrução do lote) -- os demais seguem o mesmo padrão por simetria e
// para manter este componente testável sem mockar Supabase.
export interface ParticipanteRegistroEncontro {
  idUsuario?: number | null;
  nomeLivre?: string | null;
  origem: "legisla" | "mandato" | "externo";
  /** Nome para exibição -- resolvido pelo chamador (dim_usuario ou nome_livre). */
  nome: string;
}

export interface RegistroEncontroFormProps {
  idContrato: number;
  /** Ausente = registro retroativo (A-08), sempre tipo Legisla Aliada. */
  idEncontro?: number | null;
  idEtapa: number;
  idTipoRegistro: number;
  nomeEtapa: string;
  nomeTipo: string;
  /** ref_tipo_registro.qtd_prevista -- null quando o tipo não declara denominador (A-13). */
  qtdPrevista: number | null;
  /**
   * Prévia informativa do número de sequência (não autoritativa -- o servidor
   * atribui o valor definitivo em `app.criar_registro`, MAX+1 sob FOR UPDATE,
   * A-13/FMC-15 AC3). `undefined`/`null` = ainda não conhecida; a linha
   * simplesmente não é renderizada.
   */
  nrSequencia?: number | null;
  /** JSONB cru de ref_tipo_registro.schema_campos -- parseado aqui dentro. */
  schemaCampos: unknown;
  /** Dados achatados de fat_encontro (ex.: { local: "Gabinete 312" }) para os
   * campos `leitura_encontro` da camada dinâmica (A-15/FMC-20). `null`/
   * ausente = sem encontro (A-08), campos leitura_encontro somem. */
  encontroDados?: Record<string, string | null> | null;
  /** Participantes do encontro, para pré-marcar "Presentes" (FMC-18 AC10).
   * Ausente/vazio = registro sem encontro -- lista livre (A-08). */
  participantesEncontro?: ParticipanteRegistroEncontro[];
  onConcluido: () => void;
  onCancelar: () => void;
}

interface PresencaState extends ParticipanteRegistroEncontro {
  marcado: boolean;
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RegistroEncontroForm({
  idContrato,
  idEncontro,
  idTipoRegistro,
  nomeEtapa,
  nomeTipo,
  qtdPrevista,
  nrSequencia = null,
  schemaCampos,
  encontroDados = null,
  participantesEncontro = [],
  onConcluido,
  onCancelar,
}: RegistroEncontroFormProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [nomeLivreNovo, setNomeLivreNovo] = useState("");

  // FMC-18 AC10: com encontro, "Presentes" pré-marcada dos participantes já
  // convidados; a edição daqui em diante só toca rel_registro_participante,
  // nunca o `presente` de rel_encontro_participante (A-21) -- esta lista vive
  // inteiramente em estado local, sem escrever em fat_encontro.
  const [presencas, setPresencas] = useState<PresencaState[]>(() =>
    participantesEncontro.map((p) => ({ ...p, marcado: true }))
  );

  const { campos } = useMemo(() => parseSchemaCampos(schemaCampos), [schemaCampos]);

  const form = useForm<{ ocorrido_em: string; resumo: string; conteudo: Record<string, string>; artefatos: Record<string, { url?: string; descricao?: string }> }>({
    defaultValues: { ocorrido_em: hoje(), resumo: "", conteudo: {}, artefatos: {} },
  });

  const sequenciaLabel = rotuloSequencia(nrSequencia, qtdPrevista);

  function alternarPresenca(index: number) {
    setPresencas((atual) => atual.map((p, i) => (i === index ? { ...p, marcado: !p.marcado } : p)));
  }

  function removerPresenca(index: number) {
    setPresencas((atual) => atual.filter((_, i) => i !== index));
  }

  // A-08: sem encontro, "Presentes" é lista livre -- cada nome digitado vira
  // um participante de origem "externo" (registro retroativo é sempre
  // Legisla Aliada, tipicamente presença externa), sem tentar identificar
  // um usuário do sistema.
  function adicionarPresencaLivre() {
    const nome = nomeLivreNovo.trim();
    if (nome === "") return;
    setPresencas((atual) => [...atual, { nomeLivre: nome, origem: "externo", nome, marcado: true }]);
    setNomeLivreNovo("");
  }

  async function enviar(valores: {
    ocorrido_em: string;
    resumo: string;
    conteudo: Record<string, string>;
    artefatos: Record<string, { url?: string; descricao?: string }>;
  }) {
    setEnviando(true);
    setErro(null);

    const conteudo: Record<string, unknown> = {};
    for (const campo of campos) {
      if (campo.tipo === "texto_curto" || campo.tipo === "texto_longo") {
        const valor = valores.conteudo?.[campo.chave];
        if (valor !== undefined && valor !== "") conteudo[campo.chave] = valor;
      }
    }

    const artefatos: ArtefatoRegistroInput[] = [];
    for (const campo of campos) {
      if (campo.tipo !== "link") continue;
      const valor = valores.artefatos?.[campo.chave];
      if (!valor?.url || valor.url.trim() === "") continue;
      artefatos.push({
        tipo: campo.artefatoTipo ?? "outro",
        url: valor.url,
        descricao: valor.descricao ?? null,
      });
    }

    const presentes: ParticipanteRegistroInput[] = presencas
      .filter((p) => p.marcado)
      .map((p) => ({ idUsuario: p.idUsuario ?? null, nomeLivre: p.nomeLivre ?? null, origem: p.origem }));

    try {
      await criarRegistro(createClient(), {
        idContrato,
        idEncontro: idEncontro ?? null,
        idTipoRegistro,
        ocorridoEm: valores.ocorrido_em,
        resumo: valores.resumo || null,
        conteudo,
        artefatos,
        presentes,
      });
      setEnviando(false);
      onConcluido();
    } catch (e) {
      setEnviando(false);
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o registro.");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(enviar)} className="grid gap-4 rounded-lg border p-4">
      {/* FMC-14/A-16: Etapa e Tipo em leitura, sem nenhum controle de edição --
          herdados do encontro (ou, no registro retroativo, do vínculo
          Legisla Aliada resolvido pelo chamador) e imutáveis. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1">
          <p className="text-xs font-medium text-muted-foreground">Etapa</p>
          <p className="text-sm">{nomeEtapa}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-xs font-medium text-muted-foreground">Tipo</p>
          <p className="text-sm">{nomeTipo}</p>
        </div>
      </div>

      {/* FMC-15 AC2: "nº X de Y" com qtd_prevista, "nº X" sem -- os dois lados
          de rotuloSequencia (T16). Sem nr conhecido, a linha não aparece. */}
      {sequenciaLabel && <p className="text-sm text-muted-foreground">{sequenciaLabel}</p>}

      <div className="grid gap-1.5">
        <Label htmlFor="registro-encontro-ocorrido-em">Ocorrido em</Label>
        <Input id="registro-encontro-ocorrido-em" type="date" {...form.register("ocorrido_em")} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="registro-encontro-resumo">Resumo</Label>
        <Textarea id="registro-encontro-resumo" {...form.register("resumo")} />
      </div>

      {/* FMC-19/AC11: nenhum campo "Canal" -- removido do produto, não só
          escondido; não há nenhuma referência a ele neste formulário. */}

      <div className="grid gap-2">
        <p className="text-sm font-medium">Camada dinâmica · {nomeTipo}</p>
        <CamadaDinamica campos={campos} encontro={encontroDados} control={form.control} />
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium">Presentes</p>
        {presencas.length === 0 && idEncontro == null && (
          <p className="text-sm text-muted-foreground">Nenhum presente adicionado ainda.</p>
        )}
        <ul className="grid gap-1.5">
          {presencas.map((p, index) => (
            <li key={`${p.nome}-${index}`} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`presenca-${index}`}
                checked={p.marcado}
                onChange={() => alternarPresenca(index)}
              />
              <Label htmlFor={`presenca-${index}`} className="flex-1 font-normal">
                {p.nome}
              </Label>
              {idEncontro == null && (
                <Button type="button" variant="ghost" size="sm" onClick={() => removerPresenca(index)}>
                  Remover
                </Button>
              )}
            </li>
          ))}
        </ul>

        {/* A-08: sem encontro, lista livre -- adicionar nome digitado. */}
        {idEncontro == null && (
          <div className="flex items-center gap-2">
            <Input
              aria-label="Nome do presente"
              placeholder="Nome do presente"
              value={nomeLivreNovo}
              onChange={(e) => setNomeLivreNovo(e.target.value)}
            />
            <Button type="button" variant="outline" onClick={adicionarPresencaLivre}>
              Adicionar
            </Button>
          </div>
        )}
      </div>

      {erro && <ErroInline titulo="Não foi possível salvar o registro" mensagem={erro} />}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

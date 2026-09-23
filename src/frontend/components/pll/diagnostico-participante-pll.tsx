"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  buscarCadastroParticipanteFicha,
  buscarDadosTseFicha,
} from "@backend/queries/pll-ficha";
import { atualizarCamposEditaveisParticipante, type CamposEditaveisParticipante } from "@backend/queries/pll-cadastro";
import { createClient } from "@backend/supabase/client";

import { usePapelGlobal } from "@/hooks/use-papel-global";
import { EditorAmbicaoPolitica } from "@/components/pll/editor-ambicao-politica";
import { EditorListaTexto } from "@/components/pll/editor-lista-texto";
import { EditorSwot } from "@/components/pll/editor-swot";
import { FichaAfinidadeAgenda } from "@/components/pll/ficha-afinidade-agenda";
import { FichaDadosTse } from "@/components/pll/ficha-dados-tse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { EstadoVazio } from "@/components/ui/estado-vazio";

// diagnostico-participante-pll (.specs/features/diagnostico-participante-pll/
// spec.md, DPP-01..DPP-04). Corpo de LEITURA+EDIÇÃO do Diagnóstico do
// Mentorado (Dados TSE, Composição Partidária da Casa, Afinidade de Agenda,
// Desafios/Destaques/Ambição Política/SWOT) -- extraído de
// produtos/pll/participantes/[id]/page.tsx (T15/T19) para ser a MESMA
// implementação usada pela aba "Diagnóstico" de /contratos/[id] quando o
// contrato é do produto PLL. Componente busca seus próprios dados
// (idCadastroParticipante já resolvido pelo chamador) -- nem a página
// standalone nem a aba de contrato duplicam esta lógica.
//
// `onVincular`: a página standalone navega de volta pra lista de
// participantes (não há vínculo ainda); a aba de contrato omite o prop --
// aqui o contrato JÁ existe, então "Vincular ao TSE" não se aplica
// (Edge Case da spec, DPP-*).

export interface DiagnosticoParticipantePllProps {
  idCadastroParticipante: number;
  onVincular?: () => void;
}

function ComposicaoPartidariaCasa({ composicao }: { composicao: { siglaPartido: string; quantidade: number; percentual: number }[] }) {
  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Composição Partidária da Casa</CardTitle>
      </CardHeader>
      <CardContent>
        {/* PLL-CP-19: nunca gráfico vazio sem explicação. */}
        {composicao.length === 0 ? (
          <EstadoVazio titulo="Dados indisponíveis para esta Casa/ano" />
        ) : (
          <ul className="grid gap-2">
            {composicao.map((linha) => (
              <li key={linha.siglaPartido} className="flex items-center justify-between text-sm">
                <span className="font-semibold">{linha.siglaPartido}</span>
                <span className="text-muted-foreground">
                  {linha.quantidade} ({linha.percentual.toFixed(1)}%)
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function DiagnosticoParticipantePll({ idCadastroParticipante, onVincular }: DiagnosticoParticipantePllProps) {
  const queryClient = useQueryClient();

  // PLL-CP-23: Assessor vê os 3 blocos editáveis só leitura -- mesma regra
  // de FichaMentoradoPage (T19). Enquanto o papel carrega, o padrão é
  // somente-leitura (AD-002: a decisão real de autorização é da RLS, este
  // `readOnly` só evita a UI oferecer um controle que a escrita recusaria).
  const { papel, carregando: carregandoPapel } = usePapelGlobal();
  const somenteLeitura = carregandoPapel || papel === "assessor";

  const { data: participante, isLoading: carregandoParticipante } = useQuery({
    queryKey: ["pll-ficha-participante", idCadastroParticipante],
    queryFn: () => buscarCadastroParticipanteFicha(createClient(), idCadastroParticipante),
    enabled: Number.isFinite(idCadastroParticipante),
  });

  const vinculadoTse = participante?.idVinculoTse != null;

  const { data: dadosTse, isLoading: carregandoTse } = useQuery({
    queryKey: ["pll-ficha-tse", participante?.idVinculoTse],
    queryFn: () => buscarDadosTseFicha(createClient(), participante!.idVinculoTse!),
    enabled: vinculadoTse,
  });

  const { mutate: salvarCampos } = useMutation({
    mutationFn: (campos: CamposEditaveisParticipante) =>
      atualizarCamposEditaveisParticipante(createClient(), idCadastroParticipante, campos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pll-ficha-participante", idCadastroParticipante] });
    },
  });

  if (carregandoParticipante) {
    return <CarregandoSkeleton variante="cards" />;
  }

  if (!participante) {
    return (
      <EstadoVazio
        titulo="Participante não encontrado"
        mensagem="Este participante não existe ou você não tem acesso a ele."
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {carregandoTse && vinculadoTse ? (
          <CarregandoSkeleton variante="cards" />
        ) : (
          <FichaDadosTse
            vinculadoTse={vinculadoTse}
            candidaturas={dadosTse?.candidaturas ?? []}
            onVincular={onVincular}
          />
        )}

        <FichaAfinidadeAgenda
          notaEducacao={participante.notaEducacao}
          notaSegurancaPublica={participante.notaSegurancaPublica}
          notaModernizacaoEstado={participante.notaModernizacaoEstado}
          notaClima={participante.notaClima}
          outrasPautas={participante.outrasPautas}
          especifiquePauta={participante.especifiquePauta}
        />

        {vinculadoTse && <ComposicaoPartidariaCasa composicao={dadosTse?.composicao ?? []} />}
      </div>

      {/* T19: blocos editáveis -- Desafios/Destaques (T17), Ambição Política
          e SWOT (T18). Assessor vê os 3 sem nenhum botão de editar (PLL-CP-23). */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Desafios</CardTitle>
          </CardHeader>
          <CardContent>
            <EditorListaTexto
              titulo="Desafios"
              itens={participante.desafios}
              onChange={(itens) => salvarCampos({ desafios: itens })}
              readOnly={somenteLeitura}
              placeholder="Adicionar desafio…"
            />
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Destaques</CardTitle>
          </CardHeader>
          <CardContent>
            <EditorListaTexto
              titulo="Destaques"
              itens={participante.destaques}
              onChange={(itens) => salvarCampos({ destaques: itens })}
              readOnly={somenteLeitura}
              placeholder="Adicionar destaque…"
            />
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm">
          <CardContent className="pt-6">
            <EditorAmbicaoPolitica
              texto={participante.ambicaoTexto}
              tags={participante.ambicaoTags}
              onChangeTexto={(texto) => salvarCampos({ ambicaoTexto: texto })}
              onChangeTags={(tags) => salvarCampos({ ambicaoTags: tags })}
              readOnly={somenteLeitura}
            />
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-sm">
          <CardContent className="pt-6">
            <EditorSwot
              forcas={participante.swotForcas}
              fraquezas={participante.swotFraquezas}
              oportunidades={participante.swotOportunidades}
              ameacas={participante.swotAmeacas}
              onChangeForcas={(itens) => salvarCampos({ swotForcas: itens })}
              onChangeFraquezas={(itens) => salvarCampos({ swotFraquezas: itens })}
              onChangeOportunidades={(itens) => salvarCampos({ swotOportunidades: itens })}
              onChangeAmeacas={(itens) => salvarCampos({ swotAmeacas: itens })}
              readOnly={somenteLeitura}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

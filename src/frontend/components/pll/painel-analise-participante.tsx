import type { AnaliseParticipantePll } from "@backend/queries/pll-dashboard";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { RoscaAnalise } from "./rosca-analise";

// pll-dashboard-agenda T18 (design.md "Components", PLL-DB-15). Painel
// "Análise do participante" (Figma 44:477): selo "N Participantes Ativos" +
// 4 roscas (Identidade de gênero, Orientação sexual, Cor/raça, Tempo na
// política), lendo fat_cadastro_participante via buscarAnaliseParticipantePll
// (T16).
export interface PainelAnaliseParticipanteProps {
  analise: AnaliseParticipantePll;
}

export function PainelAnaliseParticipante({ analise }: PainelAnaliseParticipanteProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Análise do participante</CardTitle>
        {/* PLL-DB-15: selo com contratos status='ativo' do recorte -- não
            depende da planilha de cadastro estar preenchida (AD-003, número
            já vem pronto de buscarAnaliseParticipantePll). */}
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          {analise.participantesAtivos} Participantes Ativos
        </span>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        <RoscaAnalise
          titulo="Identidade de gênero"
          n={analise.identidadeGenero.n}
          suprimido={analise.identidadeGenero.suprimido}
          categorias={analise.identidadeGenero.categorias}
          semResposta={analise.identidadeGenero.semResposta}
        />
        <RoscaAnalise
          titulo="Orientação sexual"
          n={analise.orientacaoSexual.n}
          suprimido={analise.orientacaoSexual.suprimido}
          categorias={analise.orientacaoSexual.categorias}
          semResposta={analise.orientacaoSexual.semResposta}
        />
        <RoscaAnalise
          titulo="Cor/raça"
          n={analise.corRaca.n}
          suprimido={analise.corRaca.suprimido}
          categorias={analise.corRaca.categorias}
          semResposta={analise.corRaca.semResposta}
        />
        <RoscaAnalise
          titulo="Tempo na política"
          n={analise.tempoNaPolitica.n}
          suprimido={analise.tempoNaPolitica.suprimido}
          categorias={analise.tempoNaPolitica.categorias}
          semResposta={analise.tempoNaPolitica.semResposta}
        />
      </CardContent>
    </Card>
  );
}

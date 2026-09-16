import type {
  FatoGeradorResumo,
  InsightResumo,
  PreInsightResumo,
  RegistroResumo,
  TimelineItem,
} from "@backend/queries/incidencia";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// FGC-11 (T20, fatos-geradores-ciclo-vida). Painel lateral de detalhe da
// Linha do Tempo -- spec.md P1 "Linha do Tempo" AC4: exibe os atributos de
// classificação quando o item selecionado é Fato Gerador. Data sem hora em
// todo lugar (FGC-12) -- hora só sobrevive em criadoEm (metadado de
// auditoria, AC5), que este painel NÃO exibe (não há pedido de tela pra
// isso; auditoria fica para uma tela própria se vier a existir).
//
// Fato sem origem: nenhum badge de erro/pendência aqui -- é o card que
// exibe o item, e "sem origem" nunca aparece como "Não Conectado"
// (reincidência catalogada pela skill figma-dominio-legisla). Este
// componente simplesmente não recebe/renderiza informação de origem --
// quem mostra "de onde veio" é o Ciclo de Vida (CadeiaLista, T21), não a
// Linha do Tempo.
export interface PainelDetalheProps {
  item: TimelineItem | null;
  registro?: RegistroResumo;
  insight?: InsightResumo;
  fatoGerador?: FatoGeradorResumo;
  preInsight?: PreInsightResumo;
  // Achado do Verifier (fix task pós-T25): spec.md "A aba como casa única"
  // AC2 exige editar a partir da Linha do Tempo sem sair da aba. Opcional de
  // propósito -- o chamador (página) só passa quando aquele TIPO de item
  // tem formulário com modo de edição pronto (Registro/Insight/Pré-Insight,
  // T23/T24/fix); Fato Gerador ainda não tem edição (wizard é só criação),
  // então o botão simplesmente não aparece para esse tipo.
  onEditar?: () => void;
}

function formatarData(data: string | null): string {
  if (!data) return "—";
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

const ROTULO_TIPO: Record<TimelineItem["tipo"], string> = {
  pre_insight: "Pré-Insight",
  registro: "Registro",
  insight: "Insight",
  fato_gerador: "Fato Gerador",
};

export function PainelDetalhe({ item, registro, insight, fatoGerador, preInsight, onEditar }: PainelDetalheProps) {
  if (!item) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Selecione um item da linha do tempo para ver o detalhe.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <Badge variant="outline">{ROTULO_TIPO[item.tipo]}</Badge>
          <CardTitle className="mt-2 text-base">{item.titulo ?? "—"}</CardTitle>
        </div>
        {onEditar && (
          <Button type="button" variant="outline" size="sm" onClick={onEditar}>
            Editar
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Data: </span>
          {formatarData(item.dataEvento)}
        </div>

        {item.tipo === "registro" && registro && (
          <>
            <div>
              <span className="text-muted-foreground">Tipo de Registro: </span>
              {registro.tipoRegistro}
            </div>
            <div>
              <span className="text-muted-foreground">Autor: </span>
              {registro.nomeAutor}
            </div>
            {registro.resumo && <p>{registro.resumo}</p>}
          </>
        )}

        {item.tipo === "insight" && insight && (
          <>
            <div>
              <span className="text-muted-foreground">Pilar: </span>
              {insight.pilar ?? "—"}
            </div>
            <p>{insight.conteudo}</p>
          </>
        )}

        {item.tipo === "pre_insight" && preInsight && <p>{preInsight.conteudo}</p>}

        {item.tipo === "fato_gerador" && fatoGerador && (
          <>
            <div>
              <span className="text-muted-foreground">Tipologia: </span>
              {fatoGerador.tipologia}
            </div>
            <div>
              <span className="text-muted-foreground">Situação: </span>
              {fatoGerador.situacao === "projetado" ? "PROJETADO" : "Realizado"}
            </div>
            {/* Régua de 4 posições, sem legenda descritiva (reincidência
                catalogada -- figma-dominio-legisla): "Nível D1/D2/D3", nunca
                um nome inventado como "Grau de Impacto". */}
            <div>Nível D1: {fatoGerador.niveis.d1 ?? "—"}</div>
            <div>Nível D2: {fatoGerador.niveis.d2 ?? "—"}</div>
            <div>Nível D3: {fatoGerador.niveis.d3 ?? "—"}</div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

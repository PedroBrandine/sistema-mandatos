import { Network } from "lucide-react";

import type {
  FatoGeradorResumo,
  InsightResumo,
  PreInsightResumo,
  RegistroResumo,
  TimelineItem,
} from "@backend/queries/incidencia";
import { DESTAQUE_FATO_GERADOR, posicaoNivel, TIPO_ESTILO, TIPO_ROTULO, TOTAL_NIVEIS } from "@/lib/incidencia-visual";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// FGC-11 (T20, fatos-geradores-ciclo-vida). Painel lateral de detalhe da
// Linha do Tempo -- spec.md P1 "Linha do Tempo" AC4: exibe os atributos de
// classificação quando o item selecionado é Fato Gerador. Data sem hora em
// todo lugar (FGC-12) -- hora só sobrevive em criadoEm (metadado de
// auditoria, AC5). O rodapé com autor usa `item.nomeAutor` (view já resolve
// o nome, T-fix pós-Verifier) -- é metadado de quem registrou, não a data do
// fato, por isso pode mostrar nome mesmo sem exibir hora em lugar nenhum.
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
  // AC2 exige editar a partir da Linha do Tempo sem sair da aba. Opcional --
  // o chamador (página) só passa quando tem um handler de edição pronto
  // para aquele item (as 4 entidades têm, desde o fix de Fato Gerador em
  // fato-gerador-form.tsx); sem `onEditar`, o botão simplesmente não
  // aparece.
  onEditar?: () => void;
  // Acerto de fidelidade visual (pós-Verifier, mockup 108:4): navegação
  // cruzada pro Ciclo de Vida a partir de um Fato Gerador. Só aparece
  // quando o chamador passa o handler (TimelineFeed só passa para
  // fato_gerador -- é o único tipo com identidade de cadeia, D-8).
  onVerNoCicloDeVida?: () => void;
}

function formatarData(data: string | null): string {
  if (!data) return "—";
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function RegraNivel({ rotulo, valor }: { rotulo: "D1" | "D2" | "D3"; valor: string | null }) {
  const preenchidos = posicaoNivel(valor);
  return (
    <div className="flex items-center justify-between gap-3">
      <span>
        Nível {rotulo}: {valor ?? "—"}
      </span>
      <div className="flex gap-1">
        {Array.from({ length: TOTAL_NIVEIS }, (_, i) => (
          <span
            key={i}
            className="h-2 w-5 rounded-sm bg-muted"
            style={i < preenchidos ? { background: DESTAQUE_FATO_GERADOR } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export function PainelDetalhe({
  item,
  registro,
  insight,
  fatoGerador,
  preInsight,
  onEditar,
  onVerNoCicloDeVida,
}: PainelDetalheProps) {
  if (!item) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Selecione um item da linha do tempo para ver o detalhe.
        </CardContent>
      </Card>
    );
  }

  const cor = TIPO_ESTILO[item.tipo];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="grid gap-2">
          <span
            className="w-fit rounded border px-2 py-0.5 text-[11px] font-bold uppercase"
            style={{ background: cor.bg, borderColor: cor.border, color: cor.text }}
          >
            {TIPO_ROTULO[item.tipo]}
          </span>
          <CardTitle className="text-base">{item.titulo ?? "—"}</CardTitle>
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
            <div className="rounded-md bg-muted/50 p-3">
              <span className="text-muted-foreground">Tipologia: </span>
              {fatoGerador.tipologia}
            </div>
            <div>
              <span className="text-muted-foreground">Situação: </span>
              {fatoGerador.situacao === "projetado" ? "PROJETADO" : "Realizado"}
            </div>
            {fatoGerador.descricaoEvidencia && <p className="text-muted-foreground">{fatoGerador.descricaoEvidencia}</p>}
            {/* Régua de 4 posições, sem legenda descritiva (reincidência
                catalogada -- figma-dominio-legisla): "Nível D1/D2/D3", nunca
                um nome inventado como "Grau de Impacto". */}
            <div className="grid gap-2">
              <RegraNivel rotulo="D1" valor={fatoGerador.niveis.d1} />
              <RegraNivel rotulo="D2" valor={fatoGerador.niveis.d2} />
              <RegraNivel rotulo="D3" valor={fatoGerador.niveis.d3} />
            </div>
            {onVerNoCicloDeVida && (
              <Button
                type="button"
                variant="outline"
                className="justify-center gap-2"
                style={{ borderColor: DESTAQUE_FATO_GERADOR, color: DESTAQUE_FATO_GERADOR, background: "#f0fdf4" }}
                onClick={onVerNoCicloDeVida}
              >
                <Network className="size-3.5" />
                Ver no Ciclo de Vida
              </Button>
            )}
          </>
        )}

        {item.nomeAutor && (
          <div className="flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ background: DESTAQUE_FATO_GERADOR }}
            >
              {item.nomeAutor.charAt(0).toUpperCase()}
            </span>
            <span>{item.nomeAutor}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

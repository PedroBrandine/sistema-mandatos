import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVazio } from "@/components/ui/estado-vazio";

// pll-cadastro-participantes T14 (design.md "Components" -- ficha-afinidade-agenda;
// PLL-CP-16). Bloco "Afinidade de Agenda" da Ficha do Mentorado -- as 4
// notas 1-5 (D-5 do spec.md) do PRÓPRIO participante + os chips de "outras
// pautas" que ele marcou. Não confundir com PainelAfinidadeAgenda
// (pll-dashboard-agenda, componentes/pll/painel-afinidade-agenda.tsx): aquele
// agrega a distribuição de notas de TODOS os participantes do recorte; este
// mostra as notas de UM participante só, na Ficha dele.
//
// Presentational (mesmo padrão de FichaDadosTse) -- os campos vêm direto de
// fat_cadastro_participante, resolvidos pela página (T15).

const PAUTAS_FIXAS = [
  { chave: "notaEducacao", rotulo: "Educação" },
  { chave: "notaSegurancaPublica", rotulo: "Segurança Pública" },
  { chave: "notaModernizacaoEstado", rotulo: "Modernização do Estado" },
  { chave: "notaClima", rotulo: "Clima" },
] as const;

export interface FichaAfinidadeAgendaProps {
  notaEducacao: number | null;
  notaSegurancaPublica: number | null;
  notaModernizacaoEstado: number | null;
  notaClima: number | null;
  outrasPautas: string[];
  especifiquePauta: string | null;
}

function NotaPauta({ rotulo, nota }: { rotulo: string; nota: number | null }) {
  return (
    <div className="grid gap-1">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      {nota == null ? (
        <p className="text-sm font-semibold text-muted-foreground">—</p>
      ) : (
        <div className="flex items-center gap-1" aria-label={`${rotulo}: nota ${nota} de 5`}>
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={`size-2.5 rounded-full ${i < nota ? "bg-primary" : "bg-muted"}`}
              aria-hidden="true"
            />
          ))}
          <span className="ml-1 text-sm font-bold">{nota}/5</span>
        </div>
      )}
    </div>
  );
}

export function FichaAfinidadeAgenda({
  notaEducacao,
  notaSegurancaPublica,
  notaModernizacaoEstado,
  notaClima,
  outrasPautas,
  especifiquePauta,
}: FichaAfinidadeAgendaProps) {
  const notas: Record<(typeof PAUTAS_FIXAS)[number]["chave"], number | null> = {
    notaEducacao,
    notaSegurancaPublica,
    notaModernizacaoEstado,
    notaClima,
  };

  const semNenhumDado =
    notaEducacao == null &&
    notaSegurancaPublica == null &&
    notaModernizacaoEstado == null &&
    notaClima == null &&
    outrasPautas.length === 0 &&
    !especifiquePauta;

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Afinidade de Agenda</CardTitle>
      </CardHeader>
      <CardContent>
        {semNenhumDado ? (
          <EstadoVazio
            titulo="Nenhuma pauta prioritária informada"
            mensagem="A planilha de inscrição deste participante não trouxe as pautas prioritárias."
          />
        ) : (
          <div className="grid gap-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {PAUTAS_FIXAS.map((pauta) => (
                <NotaPauta key={pauta.chave} rotulo={pauta.rotulo} nota={notas[pauta.chave]} />
              ))}
            </div>

            <div>
              <p className="mb-2 text-xs text-muted-foreground">Outras pautas prioritárias</p>
              {outrasPautas.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {outrasPautas.map((pauta) => (
                    <Badge key={pauta} variant="outline">
                      {pauta}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {especifiquePauta && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Especifique a pauta</p>
                <p className="text-sm">{especifiquePauta}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

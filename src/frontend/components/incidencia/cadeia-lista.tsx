import { ArrowRight, Landmark } from "lucide-react";

import type { CadeiaItem } from "@backend/queries/incidencia";
import type { ContratoIdentificado, MapaContratos } from "@/lib/incidencia-contrato";
import { rotulaCadeias, type CadeiaRotulada, type ItemCadeia, type OrigemCadeia } from "@/lib/incidencia-cadeia";
import { TIPO_ESTILO, TIPO_ROTULO, type EstiloTipo } from "@/lib/incidencia-visual";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EstadoVazio } from "@/components/ui/estado-vazio";

import { RealizarFatoDialog } from "./realizar-fato-dialog";

// FGC-13/FGC-14 (T21, fatos-geradores-ciclo-vida). Lista de cadeias do Ciclo
// de Vida -- letra posicional gerada no render (rotulaCadeias, T14, AD-053),
// nunca lida do banco. Cadeia com mais de 1 Fato Gerador marcada "Origem
// comum" (spec.md P2 AC3); cadeia direta no fato (1 elemento, sem
// rel_fato_origem) renderiza normal, sem marca de incompletude (AC4); seção
// própria "Cadeia Projetada (em análise)" para cadeias só de fatos
// projetados (AC5).
//
// Acerto de fidelidade visual (pós-Verifier, mockup 109:4): card horizontal
// com o passo de origem (Pré-Insight/Registro/Insight/Meta) antes da seta
// pro Fato Gerador -- buscarCadeiasIncidencia (T-fix) já resolve
// `item.origem` a partir de chaveOrigem. Sem origem (cadeia direta no fato),
// mostra só o passo do Fato Gerador, sem seta nem card vazio.
export interface CadeiaListaProps {
  cadeias: CadeiaItem[];
  // T14 (pente-fino 2026-09, PF-08): recarrega os dados depois de marcar um
  // Fato Gerador projetado como realizado pelo card.
  onRealizado?: () => void;
  // T16 (pente-fino 2026-09, PF-08 AC4): clique no passo do Fato Gerador
  // abre o detalhe (fato + origem associada). Sem handler, o card continua
  // só leitura (mesmo comportamento de antes do T16).
  onAbrirDetalhe?: (item: ItemCadeia) => void;
  // Aba agregada do produto: cada cadeia diz de qual mandato é. Ausente na
  // aba do contrato.
  contratos?: MapaContratos;
}

const COR_FATO_GERADOR = TIPO_ESTILO.fato_gerador;
const DESTAQUE_FATO = "#571730";
// Meta é conceito de `planejamento-estrategico`, fora dos 4 tipos da
// Incidência -- cor própria, não faz parte de TIPO_ESTILO.
const COR_META: EstiloTipo = { dot: "#d84315", bg: "#fff8e1", border: "#ffe4b8", text: "#d84315" };

function corOrigem(tipo: OrigemCadeia["tipo"]): EstiloTipo {
  return tipo === "meta" ? COR_META : TIPO_ESTILO[tipo];
}

function rotuloOrigem(tipo: OrigemCadeia["tipo"]): string {
  return tipo === "meta" ? "Meta" : TIPO_ROTULO[tipo];
}

// Grupos por chaveOrigem nunca cruzam mandatos (ids de origem são únicos), então
// o primeiro item basta para dizer de quem é a cadeia inteira.
function contratoDaCadeia(cadeia: CadeiaRotulada, contratos?: MapaContratos): ContratoIdentificado | undefined {
  const id = cadeia.itens[0]?.idContrato;
  return id != null ? contratos?.get(id) : undefined;
}

function formatarData(data: string | null): string {
  if (!data) return "—";
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function PassoCard({
  rotulo,
  cor,
  titulo,
  data,
  destaque,
  projetado,
  onClick,
}: {
  rotulo: string;
  cor: EstiloTipo;
  titulo: string;
  data: string | null;
  destaque?: boolean;
  // T14 (pente-fino 2026-09, PF-08): só o passo de Fato Gerador pode estar
  // projetado -- os passos de origem (Pré-Insight/Registro/Insight/Meta) não
  // têm essa dimensão.
  projetado?: boolean;
  // T16 (pente-fino 2026-09, PF-08 AC4): quando presente, o passo do Fato
  // Gerador vira clicável -- abre o detalhe (origem + fato). Os passos de
  // origem nunca recebem `onClick` (ver Cadeia abaixo): são só contexto.
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "grid min-w-0 flex-1 gap-2 rounded-lg border bg-card p-3 text-sm",
        onClick && "text-left transition-colors hover:bg-muted/50"
      )}
      style={{
        borderLeftWidth: destaque ? 4 : undefined,
        borderLeftColor: destaque ? DESTAQUE_FATO : undefined,
        borderStyle: projetado ? "dashed" : undefined,
        opacity: projetado ? 0.85 : 1,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className="rounded border px-2 py-0.5 text-[10px] font-bold uppercase"
            style={{ background: cor.bg, borderColor: cor.border, color: cor.text }}
          >
            {rotulo}
          </span>
          {projetado && (
            <span className="rounded border border-dashed border-muted-foreground/50 px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
              Projetado
            </span>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{formatarData(data)}</span>
      </div>
      <p className="line-clamp-2">{titulo}</p>
    </Tag>
  );
}

function Cadeia({
  cadeia,
  onRealizado,
  onAbrirDetalhe,
  contrato,
}: {
  cadeia: CadeiaRotulada;
  onRealizado?: () => void;
  onAbrirDetalhe?: (item: ItemCadeia) => void;
  contrato?: ContratoIdentificado;
}) {
  const origem = cadeia.itens[0]?.origem ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <CardTitle className="text-sm">{cadeia.rotulo}</CardTitle>
          {contrato && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-secondary">
              <Landmark className="size-3" />
              {contrato.nome}
            </span>
          )}
        </div>
        {cadeia.origemComum && <Badge variant="outline">Origem comum</Badge>}
      </CardHeader>
      <CardContent>
        <div className="flex items-stretch gap-3">
          {origem && (
            <>
              <PassoCard rotulo={rotuloOrigem(origem.tipo)} cor={corOrigem(origem.tipo)} titulo={origem.titulo} data={origem.dataEvento} />
              <div className="flex shrink-0 items-center">
                <ArrowRight className="size-4 text-muted-foreground" />
              </div>
            </>
          )}

          {cadeia.itens.length === 1 ? (
            <div className="grid min-w-0 flex-1 gap-2">
              <PassoCard
                rotulo={TIPO_ROTULO.fato_gerador}
                cor={COR_FATO_GERADOR}
                titulo={cadeia.itens[0].titulo ?? "—"}
                data={cadeia.itens[0].dataEvento}
                destaque
                projetado={cadeia.itens[0].situacao === "projetado"}
                onClick={onAbrirDetalhe ? () => onAbrirDetalhe(cadeia.itens[0]) : undefined}
              />
              {cadeia.itens[0].situacao === "projetado" && onRealizado && (
                <div className="flex justify-end">
                  <RealizarFatoDialog idFatoGerador={cadeia.itens[0].idFatoGerador} onConcluido={onRealizado} />
                </div>
              )}
            </div>
          ) : (
            <div
              className="grid min-w-0 flex-1 gap-1 rounded-lg border bg-card p-3 text-sm"
              style={{ borderLeftWidth: 4, borderLeftColor: DESTAQUE_FATO }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase" style={{ color: DESTAQUE_FATO }}>
                  {cadeia.itens.length} Fatos Geradores
                </span>
              </div>
              <div className="grid divide-y">
                {cadeia.itens.map((item) => {
                  const projetado = item.situacao === "projetado";
                  const Linha = onAbrirDetalhe ? "button" : "div";
                  return (
                    <div key={item.idFatoGerador} className="grid gap-1.5 py-2 first:pt-0 last:pb-0">
                      <Linha
                        type={onAbrirDetalhe ? "button" : undefined}
                        onClick={onAbrirDetalhe ? () => onAbrirDetalhe(item) : undefined}
                        className={cn(
                          "flex items-center justify-between gap-3",
                          onAbrirDetalhe && "text-left transition-colors hover:bg-muted/50"
                        )}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {item.titulo ?? "—"}
                          {projetado && (
                            <span className="rounded border border-dashed border-muted-foreground/50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                              Projetado
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-muted-foreground">{formatarData(item.dataEvento)}</span>
                      </Linha>
                      {projetado && onRealizado && (
                        <div className="flex justify-end">
                          <RealizarFatoDialog idFatoGerador={item.idFatoGerador} onConcluido={onRealizado} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CadeiaLista({ cadeias, onRealizado, onAbrirDetalhe, contratos }: CadeiaListaProps) {
  if (cadeias.length === 0) {
    return <EstadoVazio titulo="Nenhuma cadeia ainda" mensagem="Cadeias aparecem aqui a partir do primeiro Fato Gerador." />;
  }

  const agrupadas = rotulaCadeias(cadeias);

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        {agrupadas.realizadas.map((cadeia) => (
          <Cadeia
            key={cadeia.rotulo}
            cadeia={cadeia}
            onRealizado={onRealizado}
            onAbrirDetalhe={onAbrirDetalhe}
            contrato={contratoDaCadeia(cadeia, contratos)}
          />
        ))}
      </div>

      {agrupadas.projetadas.length > 0 && (
        <div className="grid gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">Cadeia Projetada (em análise)</h3>
          {agrupadas.projetadas.map((cadeia) => (
            <Cadeia
            key={cadeia.rotulo}
            cadeia={cadeia}
            onRealizado={onRealizado}
            onAbrirDetalhe={onAbrirDetalhe}
            contrato={contratoDaCadeia(cadeia, contratos)}
          />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Info, LinkIcon, Pencil } from "lucide-react";

import type { ParticipantePll } from "@backend/queries/pll-cadastro";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LegendaCamposPlanilhaPll } from "@/components/pll/legenda-campos-planilha-pll";

// T8 (design.md "Components" -- ListaParticipantesPll; PLL-CP-05…09). Tabela
// de participantes importados: busca + filtros (Partido/UF) + indicador TSE
// ✓/✕ + status de cadastro + ações. Server-side (busca/filtro/paginação são
// resolvidos por buscarCadastroParticipantesPll, T7) -- este componente é
// presentational, controlado pelo pai (T9) via `filtro`/`onFiltroChange`.
//
// D-1 (spec.md, reincidência do Dashboard/Agenda do PLL): a coluna é
// "Parlamentar", nunca "Deputado(a)".

export interface FiltroListaParticipantesPll {
  busca?: string;
  partido?: string;
  uf?: string;
}

export interface ListaParticipantesPllProps {
  participantes: ParticipantePll[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
  filtro: FiltroListaParticipantesPll;
  onFiltroChange: (filtro: FiltroListaParticipantesPll) => void;
  onPaginaChange: (pagina: number) => void;
  /** Opções fechadas do filtro (partidos/UFs presentes na base do produto). */
  partidos: string[];
  ufs: string[];
  /** T12 wire: ausente = botão "Vincular TSE"/"Editar vínculo" não aparece.
   * Sessão 22/09: também abre o mesmo VincularTseDialog para uma linha JÁ
   * vinculada (PLL-CP-12, troca de vínculo já suportada no backend) -- o
   * rótulo muda para "Editar vínculo" conforme `vinculadoTse`. */
  onVincularTse?: (participante: ParticipantePll) => void;
  /** Sessão 23/09: ausente = botão "Editar" não aparece. Corrige os campos
   * autodeclarados do Anexo A já importados (ver EditarParticipanteDialog). */
  onEditar?: (participante: ParticipantePll) => void;
}

// Sessão 23/09: "preciso que as informações do mentorado (assessor) e do
// mandato estejam sinalizadas ou visíveis... para linkar com o TSE preciso
// comparar as informações". A tabela só tem coluna pra Nome/Partido/UF/
// Parlamentar -- os campos que ajudam a desambiguar candidatos com nome
// parecido (cargos e mandatos anteriores, rede social, cor/raça do
// parlamentar, partido filiado do próprio assessor) ficam neste popover por
// linha, sem inflar a tabela com mais colunas.
function InfoComparacaoTse({ participante }: { participante: ParticipantePll }) {
  const linhas: [string, string | null][] = [
    ["Partido filiado (do assessor)", participante.partidoFiliado],
    ["Cor/raça do parlamentar", participante.corRacaParlamentar],
    ["Cargos anteriores", participante.cargosAnteriores],
    ["Mandatos anteriores", participante.mandatosAnteriores],
    ["Instagram/rede social", participante.redeSocial],
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Ver dados autodeclarados de ${participante.nomeCompleto} para comparar com o TSE`}
        >
          <Info className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="grid gap-2">
          <p className="text-xs font-bold uppercase text-muted-foreground">Dados para comparar com o TSE</p>
          <dl className="grid gap-1.5 text-sm">
            {linhas.map(([rotulo, valor]) => (
              <div key={rotulo}>
                <dt className="text-xs text-muted-foreground">{rotulo}</dt>
                <dd>{valor ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const PAPEL_LABEL: Record<ParticipantePll["papel"], string> = {
  mentorado: "Mentorado",
  mentor: "Mentor",
};

const STATUS_LABEL: Record<ParticipantePll["statusCadastro"], string> = {
  completo: "Completo",
  incompleto: "Incompleto",
  pendente_revisao: "Pendente de revisão",
};

const STATUS_BADGE_CLASS: Record<ParticipantePll["statusCadastro"], string> = {
  completo: "border-transparent bg-emerald-50 text-emerald-700",
  incompleto: "border-transparent bg-destructive/10 text-destructive",
  pendente_revisao: "border-transparent bg-amber-50 text-amber-700",
};

function FiltrosListaParticipantesPll({
  filtro,
  onFiltroChange,
  partidos,
  ufs,
}: {
  filtro: FiltroListaParticipantesPll;
  onFiltroChange: (filtro: FiltroListaParticipantesPll) => void;
  partidos: string[];
  ufs: string[];
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Input
        value={filtro.busca ?? ""}
        onChange={(e) => onFiltroChange({ ...filtro, busca: e.target.value || undefined })}
        placeholder="Buscar por nome, e-mail ou parlamentar…"
        aria-label="Buscar por nome, e-mail ou parlamentar"
        className="sm:max-w-xs"
      />
      <Select
        value={filtro.partido ?? "todos"}
        onValueChange={(v) => onFiltroChange({ ...filtro, partido: v === "todos" ? undefined : v })}
      >
        <SelectTrigger aria-label="Filtrar por partido" className="sm:w-40">
          <SelectValue placeholder="Partido" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os partidos</SelectItem>
          {partidos.map((partido) => (
            <SelectItem key={partido} value={partido}>
              {partido}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filtro.uf ?? "todos"}
        onValueChange={(v) => onFiltroChange({ ...filtro, uf: v === "todos" ? undefined : v })}
      >
        <SelectTrigger aria-label="Filtrar por UF" className="sm:w-32">
          <SelectValue placeholder="UF" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todas as UFs</SelectItem>
          {ufs.map((uf) => (
            <SelectItem key={uf} value={uf}>
              {uf}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// PLL-CP-08: "Mostrando X–Y de N registros" + navegação anterior/próxima.
function PaginacaoListaParticipantesPll({
  pagina,
  tamanhoPagina,
  total,
  onPaginaChange,
}: {
  pagina: number;
  tamanhoPagina: number;
  total: number;
  onPaginaChange: (pagina: number) => void;
}) {
  if (total === 0) return null;
  const inicio = (pagina - 1) * tamanhoPagina + 1;
  const fim = Math.min(pagina * tamanhoPagina, total);
  const totalPaginas = Math.ceil(total / tamanhoPagina);

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Mostrando {inicio}–{fim} de {total} registros
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Página anterior"
          disabled={pagina <= 1}
          onClick={() => onPaginaChange(pagina - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Próxima página"
          disabled={pagina >= totalPaginas}
          onClick={() => onPaginaChange(pagina + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function ListaParticipantesPll({
  participantes,
  total,
  pagina,
  tamanhoPagina,
  filtro,
  onFiltroChange,
  onPaginaChange,
  partidos,
  ufs,
  onVincularTse,
  onEditar,
}: ListaParticipantesPllProps) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <FiltrosListaParticipantesPll
            filtro={filtro}
            onFiltroChange={onFiltroChange}
            partidos={partidos}
            ufs={ufs}
          />
        </div>
        <LegendaCamposPlanilhaPll />
      </div>

      {participantes.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum participante encontrado"
          mensagem="Nenhum participante corresponde à busca ou aos filtros aplicados."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome Completo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Partido</TableHead>
                <TableHead>UF</TableHead>
                {/* D-1: "Parlamentar", nunca "Deputado(a)". */}
                <TableHead>Parlamentar</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Mentor(a)</TableHead>
                <TableHead>TSE</TableHead>
                <TableHead>Status</TableHead>
                <TableHead aria-label="Comparar com o TSE" />
                <TableHead aria-hidden="true" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {participantes.map((participante) => (
                <TableRow key={participante.idCadastroParticipante}>
                  <TableCell>{participante.nomeCompleto}</TableCell>
                  <TableCell>{PAPEL_LABEL[participante.papel]}</TableCell>
                  {/* AD-005: campo obrigatório vazio nunca em branco. */}
                  <TableCell>{participante.siglaPartido ?? "—"}</TableCell>
                  <TableCell>{participante.siglaUf ?? "—"}</TableCell>
                  <TableCell>{participante.nomeParlamentar ?? "—"}</TableCell>
                  <TableCell>{participante.email}</TableCell>
                  <TableCell>{participante.telefone ?? "—"}</TableCell>
                  <TableCell>{participante.nomeMentorPareado ?? "—"}</TableCell>
                  <TableCell>
                    <span
                      aria-label={participante.vinculadoTse ? "Vinculado ao TSE" : "Não vinculado ao TSE"}
                      className={participante.vinculadoTse ? "text-emerald-600" : "text-destructive"}
                    >
                      {participante.vinculadoTse ? "✓" : "✕"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={STATUS_BADGE_CLASS[participante.statusCadastro]}
                    >
                      {STATUS_LABEL[participante.statusCadastro]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <InfoComparacaoTse participante={participante} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      {onEditar && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Editar ${participante.nomeCompleto}`}
                          onClick={() => onEditar(participante)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      {onVincularTse && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onVincularTse(participante)}
                        >
                          <LinkIcon className="size-3.5" />
                          {participante.vinculadoTse ? "Editar vínculo" : "Vincular TSE"}
                        </Button>
                      )}
                      {/* PF3-01 (.specs/features/pente-fino-2026-09-23-lote2/spec.md):
                          já vinculado ao TSE tem id_contrato -- leva pra ficha
                          completa do contrato, não pra página standalone
                          (que fica só como fallback pra quem ainda não tem
                          contrato). */}
                      <Link
                        href={
                          participante.idContrato !== null
                            ? `/contratos/${participante.idContrato}/informacoes`
                            : `/produtos/pll/participantes/${participante.idCadastroParticipante}`
                        }
                        className="text-sm font-bold text-secondary hover:underline"
                      >
                        Ver ficha
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PaginacaoListaParticipantesPll
        pagina={pagina}
        tamanhoPagina={tamanhoPagina}
        total={total}
        onPaginaChange={onPaginaChange}
      />
    </div>
  );
}

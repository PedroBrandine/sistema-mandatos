"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, LinkIcon } from "lucide-react";

import type { ParticipantePll } from "@backend/queries/pll-cadastro";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
}: ListaParticipantesPllProps) {
  return (
    <div className="grid gap-4">
      <FiltrosListaParticipantesPll
        filtro={filtro}
        onFiltroChange={onFiltroChange}
        partidos={partidos}
        ufs={ufs}
      />

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
                    <div className="flex items-center justify-end gap-2">
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
                      <Link
                        href={`/produtos/pll/participantes/${participante.idCadastroParticipante}`}
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

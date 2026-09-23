"use client";

import { useState } from "react";

import { atualizarStatusEncontro, criarEncontro, marcarPresenca } from "@backend/rpc/encontro";
import { descreveErroDesconhecido } from "@backend/rpc/errors";
import { createClient } from "@backend/supabase/client";
import type { AgendaMentoriasPll } from "@backend/queries/pll-mentorias";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErroInline } from "@/components/ui/erro-inline";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// diagnostico-participante-pll (Agenda PLL, Figma 328:1262). Grade fixa de
// Mentorias -- decidido com o Pedro (23/09): substitui inteiramente o
// calendário genérico pra contrato PLL (não convive com ele). "Registro do
// Mentor"/"Registro do Mandato" do Figma NÃO tem onde gravar hoje
// (fat_registro só permite 1 registro por slot, ver uq_registro_sequencia) --
// decisão do Pedro: mostra o registro real único, sem inventar a 2ª caixa.

const STATUS_LABEL: Record<string, string> = {
  planejado: "Planejado",
  realizado: "Realizado",
  cancelado: "Cancelado",
  remarcado: "Remarcado",
};

const STATUS_DOT: Record<string, string> = {
  planejado: "bg-zinc-400",
  realizado: "bg-emerald-500",
  remarcado: "bg-amber-500",
  cancelado: "bg-red-500",
};

function formatarData(iso: string | null): string {
  if (!iso) return "Não preenchido";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export interface TabelaMentoriasPllProps {
  idContrato: number;
  agenda: AgendaMentoriasPll;
  onAtualizado: () => void;
}

export function TabelaMentoriasPll({ idContrato, agenda, onAtualizado }: TabelaMentoriasPllProps) {
  const [slotParaAgendar, setSlotParaAgendar] = useState<number | null>(null);
  const [carregandoAcao, setCarregandoAcao] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function executarAcao(idEncontro: number, acao: () => Promise<void>) {
    setErro(null);
    setCarregandoAcao(idEncontro);
    try {
      await acao();
      onAtualizado();
    } catch (e) {
      setErro(descreveErroDesconhecido(e));
    } finally {
      setCarregandoAcao(null);
    }
  }

  return (
    <div className="grid gap-6">
      {erro && <ErroInline mensagem={erro} />}

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        {(["planejado", "realizado", "remarcado", "cancelado"] as const).map((valor) => (
          <span key={valor} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${STATUS_DOT[valor]}`} aria-hidden="true" />
            {STATUS_LABEL[valor]}
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mentoria</TableHead>
              <TableHead>Data prevista</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Mentor</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agenda.slots.map((slot) => (
              <TableRow key={slot.nrSequencia}>
                <TableCell className="font-bold">Mentoria {slot.nrSequencia}</TableCell>
                <TableCell className={slot.dtPrevistaInicio ? undefined : "text-muted-foreground"}>
                  {formatarData(slot.dtPrevistaInicio)}
                </TableCell>
                <TableCell>
                  {slot.status ? (
                    <Badge variant="outline" className="gap-1.5">
                      <span className={`size-2 rounded-full ${STATUS_DOT[slot.status]}`} aria-hidden="true" />
                      {STATUS_LABEL[slot.status]}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className={agenda.nomeMentor ? undefined : "text-muted-foreground"}>
                  {agenda.nomeMentor ?? "Não preenchido"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {(slot.status === null || slot.status === "cancelado" || slot.status === "remarcado") && (
                      <Button size="sm" variant="outline" onClick={() => setSlotParaAgendar(slot.nrSequencia)}>
                        Agendar
                      </Button>
                    )}
                    {slot.status === "planejado" && slot.idEncontro !== null && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={carregandoAcao === slot.idEncontro}
                          onClick={() =>
                            void executarAcao(slot.idEncontro!, () => marcarPresenca(createClient(), { idEncontro: slot.idEncontro! }))
                          }
                        >
                          Marcar presença
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={carregandoAcao === slot.idEncontro}
                          onClick={() =>
                            void executarAcao(slot.idEncontro!, () =>
                              atualizarStatusEncontro(createClient(), { idEncontro: slot.idEncontro!, status: "remarcado" })
                            )
                          }
                        >
                          Remarcar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={carregandoAcao === slot.idEncontro}
                          onClick={() =>
                            void executarAcao(slot.idEncontro!, () =>
                              atualizarStatusEncontro(createClient(), { idEncontro: slot.idEncontro!, status: "cancelado" })
                            )
                          }
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3">
        <h2 className="font-heading text-xl">Registros</h2>
        {agenda.slots.map((slot) => (
          <div key={slot.nrSequencia} className="grid gap-2 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">Mentoria {slot.nrSequencia}</p>
              {slot.status && (
                <Badge variant="outline" className="gap-1.5">
                  <span className={`size-2 rounded-full ${STATUS_DOT[slot.status]}`} aria-hidden="true" />
                  {STATUS_LABEL[slot.status]}
                </Badge>
              )}
            </div>
            {slot.registro ? (
              <div className="grid gap-1">
                <p className="text-sm">{slot.registro.resumo ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Registrado por {slot.registro.nomeAutor}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aguardando realização do encontro</p>
            )}
          </div>
        ))}
      </div>

      <DialogAgendarMentoria
        idContrato={idContrato}
        idEtapa={agenda.idEtapa}
        idTipoRegistro={agenda.idTipoRegistro}
        nrSequencia={slotParaAgendar}
        onOpenChange={(aberto) => {
          if (!aberto) setSlotParaAgendar(null);
        }}
        onAgendado={() => {
          setSlotParaAgendar(null);
          onAtualizado();
        }}
      />
    </div>
  );
}

interface DialogAgendarMentoriaProps {
  idContrato: number;
  idEtapa: number;
  idTipoRegistro: number;
  nrSequencia: number | null;
  onOpenChange: (aberto: boolean) => void;
  onAgendado: () => void;
}

function DialogAgendarMentoria({
  idContrato,
  idEtapa,
  idTipoRegistro,
  nrSequencia,
  onOpenChange,
  onAgendado,
}: DialogAgendarMentoriaProps) {
  const [dtInicio, setDtInicio] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function agendar() {
    if (!dtInicio || nrSequencia === null) return;
    setEnviando(true);
    setErro(null);
    try {
      await criarEncontro(createClient(), {
        idContrato,
        titulo: `Mentoria ${nrSequencia}`,
        idEtapa,
        idTipoRegistro,
        dtInicio: new Date(dtInicio).toISOString(),
        participantes: [],
        nrSequencia,
      });
      setDtInicio("");
      onAgendado();
    } catch (e) {
      setErro(descreveErroDesconhecido(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={nrSequencia !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Agendar Mentoria {nrSequencia}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="mentoria-dt-inicio">Data e horário</Label>
          <Input
            id="mentoria-dt-inicio"
            type="datetime-local"
            value={dtInicio}
            onChange={(e) => setDtInicio(e.target.value)}
          />
        </div>
        {erro && <ErroInline mensagem={erro} />}
        <DialogFooter>
          <Button type="button" onClick={() => void agendar()} disabled={!dtInicio || enviando}>
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

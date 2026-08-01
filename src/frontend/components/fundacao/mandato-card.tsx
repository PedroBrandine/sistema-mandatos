"use client";

import Link from "next/link";
import { ArrowUpRight, Eye, Landmark, Trash2 } from "lucide-react";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface MandatoCardProps {
  mandato: {
    idMandato: number;
    idContratante: number;
    nomeUrna: string | null;
    nomeContratante: string;
    sgUf: string | null;
    siglaPartido: string | null;
    nomeCargo: string | null;
  };
  onDelete?: (idMandato: number, idContratante: number, nome: string) => void;
}

export function MandatoCard({ mandato, onDelete }: MandatoCardProps) {
  const nome = mandato.nomeUrna ?? mandato.nomeContratante;

  return (
    <Card className="group relative border border-border/60 transition-all duration-200 hover:border-primary/50 hover:shadow-md flex flex-col justify-between">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold leading-tight group-hover:text-primary transition-colors">
              {nome}
            </CardTitle>
            {mandato.nomeUrna && mandato.nomeUrna !== mandato.nomeContratante && (
              <p className="text-xs text-muted-foreground truncate">{mandato.nomeContratante}</p>
            )}
          </div>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Landmark className="size-4" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-2 text-xs text-muted-foreground py-2">
        <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
          <span>UF / Município</span>
          <span className="font-medium text-foreground">{mandato.sgUf ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
          <span>Partido</span>
          <Badge variant="secondary" className="font-mono text-[11px]">
            {mandato.siglaPartido ?? "—"}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span>Cargo</span>
          <span className="font-medium text-foreground truncate max-w-[140px]">{mandato.nomeCargo ?? "—"}</span>
        </div>
      </CardContent>

      <CardFooter className="pt-2 flex items-center justify-between gap-2 border-t border-border/40">
        <Link href={`/mandatos/${mandato.idMandato}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs font-medium">
            <Eye className="size-3.5" />
            Ver Ficha
          </Button>
        </Link>

        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(mandato.idMandato, mandato.idContratante, nome);
            }}
            className="size-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Excluir Mandato"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

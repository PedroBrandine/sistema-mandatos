"use client";

import Link from "next/link";
import { Eye, Handshake, Trash2 } from "lucide-react";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface CoalizaoCardProps {
  coalizao: {
    idCoalizao: number;
    idContratante: number;
    nome: string;
    sgUf: string | null;
    nmMunicipio: string | null;
  };
  onDelete?: (idCoalizao: number, idContratante: number, nome: string) => void;
}

export function CoalizaoCard({ coalizao, onDelete }: CoalizaoCardProps) {
  return (
    <Card className="group relative border border-border/60 transition-all duration-200 hover:border-amber-500/50 hover:shadow-md flex flex-col justify-between">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold leading-tight group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              {coalizao.nome}
            </CardTitle>
            <p className="text-xs text-muted-foreground">Coalizão #{coalizao.idCoalizao}</p>
          </div>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Handshake className="size-4" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-2 text-xs text-muted-foreground py-2">
        <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
          <span>UF</span>
          <span className="font-medium text-foreground">{coalizao.sgUf ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Município</span>
          <span className="font-medium text-foreground">{coalizao.nmMunicipio ?? "—"}</span>
        </div>
      </CardContent>

      <CardFooter className="pt-2 flex items-center justify-between gap-2 border-t border-border/40">
        <Link href={`/coalizoes/${coalizao.idCoalizao}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs font-medium">
            <Eye className="size-3.5" />
            Ver Coalizão
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
              onDelete(coalizao.idCoalizao, coalizao.idContratante, coalizao.nome);
            }}
            className="size-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Excluir Coalizão"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { createClient } from "@backend/supabase/client";
import { buscarContratosPorEtapa, type FiltroRecorte } from "@backend/queries/visao-gerencial";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";

interface EtapaContratosModalProps {
  idEtapa: number | null;
  nomeEtapa: string;
  filtro: FiltroRecorte;
  onClose: () => void;
}

// visao-gerencial-g3-g6, T24 (GER-11). Detalhe de item do Bloco 1 abre em
// modal, nunca navega direto (regra de layout do pedido original -- só a
// linha do próprio contrato, dentro do modal, navega). SPEC_DEVIATION:
// design.md previa link pro Kanban do produto; cada contrato aqui linka pra
// própria ficha (/contratos/[id]) -- destino mais preciso (o contrato
// específico clicado, não o board inteiro) e evita resolver slug de produto
// a partir do nome (nenhuma tabela nova pra isso).
export function EtapaContratosModal({ idEtapa, nomeEtapa, filtro, onClose }: EtapaContratosModalProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["contratos-por-etapa", idEtapa, filtro],
    queryFn: () => buscarContratosPorEtapa(createClient(), idEtapa as number, filtro),
    enabled: idEtapa !== null,
  });

  return (
    <Dialog open={idEtapa !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contratos em &ldquo;{nomeEtapa}&rdquo;</DialogTitle>
        </DialogHeader>

        {isError ? (
          <ErroInline mensagem="Não foi possível carregar os contratos desta etapa." />
        ) : isLoading ? (
          <CarregandoSkeleton variante="list" linhas={3} />
        ) : !data || data.length === 0 ? (
          <EstadoVazio titulo="Nenhum contrato nesta etapa" mensagem="Ajuste o recorte da barra pra ver outros contratos." />
        ) : (
          <ul className="grid gap-1.5">
            {data.map((c) => (
              <li key={c.idContrato}>
                <Link
                  href={`/contratos/${c.idContrato}`}
                  className="block rounded-lg border border-border/60 px-3 py-2 text-sm hover:bg-muted"
                >
                  {c.nomeContratante}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { buscarAvaliacaoNps } from "@backend/queries/formulario";
import { atualizarAvaliacaoNps } from "@backend/rpc/formulario";
import { createClient } from "@backend/supabase/client";

import { usePapelGlobal } from "@/hooks/use-papel-global";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface NpsAvaliacoesCardProps {
  idProduto: number;
}

function formatarMedia(media: number | null): string {
  return media == null ? "—" : media.toFixed(1);
}

function formatarNps(nps: number | null): string {
  return nps == null ? "—" : String(nps);
}

// FRM-20, FRM-21, FRM-23 (design.md, Components -> NpsAvaliacoesCard). Card
// de NPS agregado -- só visível a Gestora/Admin (usePapelGlobal, dependência
// listada no design.md); GRANT em mv_avaliacao_nps já nega a leitura pra
// Mentor/Assessor no banco (T10) -- este check de papel é a 2a camada
// (dupla defesa, não a única), consistente com o resto da feature.
export function NpsAvaliacoesCard({ idProduto }: NpsAvaliacoesCardProps) {
  const { papel, carregando: carregandoPapel } = usePapelGlobal();
  const podeVer = papel === "admin" || papel === "gestora";
  const queryClient = useQueryClient();

  const avaliacoesQuery = useQuery({
    queryKey: ["avaliacoes-nps", idProduto],
    queryFn: () => buscarAvaliacaoNps(createClient(), idProduto),
    enabled: podeVer,
  });

  const atualizarMutation = useMutation({
    mutationFn: () => atualizarAvaliacaoNps(createClient()),
    onSuccess: () => {
      toast.success("Avaliações de NPS atualizadas.");
      void queryClient.invalidateQueries({ queryKey: ["avaliacoes-nps", idProduto] });
    },
    onError: (error) => toast.error(error.message),
  });

  if (carregandoPapel || !podeVer) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Avaliações de NPS</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={atualizarMutation.isPending}
          onClick={() => atualizarMutation.mutate()}
        >
          {atualizarMutation.isPending ? "Atualizando..." : "Atualizar"}
        </Button>
      </CardHeader>
      <CardContent>
        {avaliacoesQuery.isLoading ? (
          <CarregandoSkeleton variante="list" />
        ) : avaliacoesQuery.isError ? (
          <ErroInline mensagem="Não foi possível carregar as avaliações de NPS." onRetry={() => void avaliacoesQuery.refetch()} />
        ) : (avaliacoesQuery.data ?? []).length === 0 ? (
          <EstadoVazio titulo="Nenhuma avaliação de NPS ainda" mensagem="Atualize depois que houver respostas." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Métrica</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Respostas</TableHead>
                <TableHead>Média</TableHead>
                <TableHead>Promotores</TableHead>
                <TableHead>Neutros</TableHead>
                <TableHead>Detratores</TableHead>
                <TableHead>NPS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(avaliacoesQuery.data ?? []).map((a) => (
                <TableRow key={`${a.idFormulario}-${a.idProjetoGrupo}-${a.idMetrica}`}>
                  <TableCell className="font-medium">{a.rotulo}</TableCell>
                  <TableCell className="text-muted-foreground">{a.agrupador ?? "—"}</TableCell>
                  <TableCell>{a.nrRespostas}</TableCell>
                  <TableCell>{formatarMedia(a.media)}</TableCell>
                  <TableCell>{a.promotores}</TableCell>
                  <TableCell>{a.neutros}</TableCell>
                  <TableCell>{a.detratores}</TableCell>
                  <TableCell className="font-medium">{a.ehNps ? formatarNps(a.nps) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { buscarFormulariosDoContrato, type FormularioListado } from "@backend/queries/formulario";
import { mapeiaErroRpc } from "@backend/rpc/errors";
import { createClient } from "@backend/supabase/client";

import { usePapelGlobal, type PapelGlobal } from "@/hooks/use-papel-global";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface FormulariosListaProps {
  idContrato: number;
}

// FRM-01, FRM-02, FRM-03, FRM-14 (design.md "FormulariosLista"). Gestora/
// Admin veem os 16 formulários do produto + toggle abrir/fechar (RLS já nega
// a escrita pra Mentor/Assessor -- FRM-03 -- então esconder o botão pra eles
// aqui é defesa em profundidade, não a única barreira). Mentor/Assessor veem
// só os endereçados ao papel dele, já filtrados por buscarFormulariosDoContrato.
// useQuery/useMutation (não useEffect+useState): mesmo padrão já adotado por
// kanban-board.tsx/carteira-ponderada-card.tsx (AD-021/AD-029, TanStack Query).
//
// SPEC_DEVIATION: design.md descrevia a assinatura como
// `<FormulariosLista idContrato idProduto />`, mas buscarFormulariosDoContrato
// (T14, já commitado) não recebe idProduto -- não haveria consumidor real
// pro prop. Reason: um prop morto falharia lint (no-unused-vars) sem ganho
// nenhum; removido em vez de plumbing sem uso.
export function FormulariosLista({ idContrato }: FormulariosListaProps) {
  const { papel, idUsuario, carregando: carregandoPapel } = usePapelGlobal();
  const queryClient = useQueryClient();
  const queryKey = ["formularios-contrato", idContrato, papel, idUsuario] as const;

  const {
    data: formularios,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () =>
      buscarFormulariosDoContrato(createClient(), idContrato, papel as PapelGlobal, idUsuario as number),
    enabled: papel != null && idUsuario != null,
  });

  // FRM-01/02: escrita direta em rel_formulario_contrato (sem RPC, AD-024 --
  // 1 linha só), mesmo padrão de sucesso-mensal-form.tsx/vinculos/page.tsx.
  const {
    mutate: alternarEstado,
    isPending,
    variables: itemEmVoo,
  } = useMutation({
    mutationFn: async (item: FormularioListado) => {
      const supabase = createClient();
      const agora = new Date().toISOString();
      const payload =
        item.estado === "aberto"
          ? { estado: "fechado", dt_fechamento: agora }
          : { estado: "aberto", dt_abertura: agora, id_usuario_abriu: idUsuario };

      const { error } = await supabase
        .from("rel_formulario_contrato")
        .update(payload)
        .eq("id_abertura", item.idAbertura);
      if (error) throw mapeiaErroRpc(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error) => toast.error(error.message),
  });

  const podeAdministrar = papel === "admin" || papel === "gestora";

  if (carregandoPapel || isLoading) {
    return <CarregandoSkeleton variante="table" />;
  }

  if (isError) {
    return <ErroInline mensagem="Não foi possível carregar os formulários." onRetry={() => refetch()} />;
  }

  if (!formularios || formularios.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhum formulário disponível"
        mensagem="Não há formulários visíveis para o seu papel neste contrato."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Formulário</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Sua resposta</TableHead>
          {podeAdministrar && <TableHead className="text-right">Ação</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {formularios.map((item) => (
          <TableRow key={item.idFormulario}>
            <TableCell className="font-medium">
              <Link href={`/contratos/${idContrato}/formularios/${item.codigo}`} className="hover:underline">
                {item.nome}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant={item.estado === "aberto" ? "default" : "secondary"}>
                {item.estado === "aberto" ? "Aberto" : "Fechado"}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {item.jaRespondeu ? "Respondido" : "Pendente"}
            </TableCell>
            {podeAdministrar && (
              <TableCell className="text-right">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending && itemEmVoo?.idAbertura === item.idAbertura}
                  onClick={() => alternarEstado(item)}
                >
                  {isPending && itemEmVoo?.idAbertura === item.idAbertura
                    ? "..."
                    : item.estado === "aberto"
                      ? "Fechar"
                      : "Abrir"}
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

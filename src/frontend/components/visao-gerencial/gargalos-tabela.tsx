"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@backend/supabase/client";
import {
  buscarPendencias,
  type CategoriaPendencia,
  type FiltroRecorte,
  type LinhaPendencia,
} from "@backend/queries/visao-gerencial";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EstadoVazio } from "@/components/ui/estado-vazio";

const ROTULO_CATEGORIA: Record<CategoriaPendencia, string> = {
  cadastro: "Cadastro",
  formulario_aberto: "Formulário aberto",
  etapa_atrasada: "Etapa atrasada",
  encontro_vencido: "Encontro vencido",
  sem_registro_recente: "Sem registro recente",
  sucesso_mensal_atrasado: "Sucesso Mensal atrasado",
};

// Cada categoria navega pra tela onde o dado de origem se corrige (GER-21).
// Nunca modal, nunca "resolver"/"ignorar" -- a pendência só some quando o
// dado de origem muda.
function destinoPendencia(linha: LinhaPendencia): string {
  switch (linha.categoria) {
    case "etapa_atrasada":
      return `/contratos/${linha.idContrato}/etapas/${linha.detalhe}`;
    case "formulario_aberto":
      return `/contratos/${linha.idContrato}/formularios`;
    case "encontro_vencido":
      return `/contratos/${linha.idContrato}/encontros`;
    case "sucesso_mensal_atrasado":
      return `/contratos/${linha.idContrato}/planejamento`;
    case "cadastro":
      return `/contratos/${linha.idContrato}/informacoes`;
    case "sem_registro_recente":
    default:
      return `/contratos/${linha.idContrato}`;
  }
}

type Agrupamento = "nenhum" | "categoria" | "gestora";
const TAMANHO_PAGINA = 50;

// TableRow (components/ui/table.tsx) é um <tr> puro, sem suporte a asChild
// -- <Link> como filho de <tr> seria HTML inválido (achado real, T29).
// onClick + onKeyDown (Enter/Espaço) no próprio <tr>, focável via tabIndex,
// é o padrão de "linha inteira clicável" acessível sem essa dependência.
function LinhaTabela({ linha }: { linha: LinhaPendencia }) {
  const router = useRouter();
  const destino = destinoPendencia(linha);

  return (
    <TableRow
      className="cursor-pointer"
      tabIndex={0}
      role="link"
      onClick={() => router.push(destino)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(destino);
        }
      }}
    >
      <TableCell>{linha.nomeContratante}</TableCell>
      <TableCell>{ROTULO_CATEGORIA[linha.categoria]}</TableCell>
      <TableCell>{linha.detalhe ?? "—"}</TableCell>
      <TableCell>{new Date(linha.dtReferencia).toLocaleDateString("pt-BR")}</TableCell>
      <TableCell>{linha.diasEmAberto}</TableCell>
      <TableCell>{linha.nomeGestora ?? "—"}</TableCell>
    </TableRow>
  );
}

function Cabecalho() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Mandato</TableHead>
        <TableHead>Categoria</TableHead>
        <TableHead>Detalhe</TableHead>
        <TableHead>Data de referência</TableHead>
        <TableHead>Dias em aberto</TableHead>
        <TableHead>Gestora</TableHead>
      </TableRow>
    </TableHeader>
  );
}

// visao-gerencial-g3-g6, T29 (Bloco 3, GER-19/20/21/22). Agrupamento via
// <details>/<summary> nativo -- acessível por teclado/leitor de tela sem
// dependência nova (nenhum primitivo "accordion" instalado no projeto).
// Paginação client-side por ACUMULAÇÃO (nunca useQuery keyed por página --
// isso trocaria a página exibida em vez de somar a ela) a partir da 1ª
// página já buscada no servidor (GargalosBloco) -- nunca traz a tabela
// inteira de uma vez. `key={JSON.stringify(filtro)}` no componente pai
// remonta este componente (zera o acumulado) quando o recorte muda.
export function GargalosTabela({
  linhasIniciais,
  totalInicial,
  filtro,
}: {
  linhasIniciais: LinhaPendencia[];
  totalInicial: number;
  filtro: FiltroRecorte;
}) {
  const [agrupamento, setAgrupamento] = useState<Agrupamento>("nenhum");
  const [linhas, setLinhas] = useState<LinhaPendencia[]>(linhasIniciais);
  const [total, setTotal] = useState(totalInicial);
  const [pagina, setPagina] = useState(1);
  const [carregandoMais, setCarregandoMais] = useState(false);

  const podeCarregarMais = linhas.length < total;

  async function carregarMais() {
    setCarregandoMais(true);
    try {
      const proximaPagina = pagina + 1;
      const resultado = await buscarPendencias(createClient(), filtro, proximaPagina, TAMANHO_PAGINA);
      setLinhas((prev) => [...prev, ...resultado.linhas]);
      setTotal(resultado.total);
      setPagina(proximaPagina);
    } finally {
      setCarregandoMais(false);
    }
  }

  if (linhas.length === 0) {
    return <EstadoVazio titulo="Sem pendências neste recorte" mensagem="Nenhuma das 6 categorias tem item em aberto." />;
  }

  const grupos =
    agrupamento === "nenhum"
      ? null
      : linhas.reduce((acc, linha) => {
          const chave = agrupamento === "categoria" ? ROTULO_CATEGORIA[linha.categoria] : linha.nomeGestora ?? "Sem Gestora";
          const lista = acc.get(chave) ?? [];
          lista.push(linha);
          acc.set(chave, lista);
          return acc;
        }, new Map<string, LinhaPendencia[]>());

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{total} pendência(s) no recorte</p>
        <Select value={agrupamento} onValueChange={(v) => setAgrupamento(v as Agrupamento)}>
          <SelectTrigger className="bg-background text-xs sm:w-48">
            <SelectValue placeholder="Agrupar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nenhum">Sem agrupamento</SelectItem>
            <SelectItem value="categoria">Agrupar por categoria</SelectItem>
            <SelectItem value="gestora">Agrupar por Gestora</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {grupos ? (
        <div className="grid gap-2">
          {[...grupos.entries()].map(([chave, itens]) => (
            <details key={chave} className="rounded-lg border border-border/60" open>
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                {chave} <span className="text-xs font-normal text-muted-foreground">({itens.length})</span>
              </summary>
              <Table>
                <Cabecalho />
                <TableBody>
                  {itens.map((linha) => (
                    <LinhaTabela key={`${linha.idContrato}-${linha.categoria}-${linha.detalhe}`} linha={linha} />
                  ))}
                </TableBody>
              </Table>
            </details>
          ))}
        </div>
      ) : (
        <Table>
          <Cabecalho />
          <TableBody>
            {linhas.map((linha) => (
              <LinhaTabela key={`${linha.idContrato}-${linha.categoria}-${linha.detalhe}`} linha={linha} />
            ))}
          </TableBody>
        </Table>
      )}

      {podeCarregarMais && (
        <Button variant="outline" size="sm" className="justify-self-center" onClick={carregarMais} disabled={carregandoMais}>
          {carregandoMais ? "Carregando..." : "Carregar mais"}
        </Button>
      )}
    </div>
  );
}

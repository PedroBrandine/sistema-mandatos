"use client";

import { use, useEffect, useState } from "react";

import { createClient } from "@backend/supabase/client";
import {
  buscarPessoasComPapelNoProduto,
  contarContratosEAssessoresAtivos,
} from "@backend/queries/contrato";
import { buscarProjetosDoProduto } from "@backend/queries/kanban";
import type { ProdutoSlug } from "@backend/queries/produto";
import { useProdutoAtual } from "@/hooks/use-produto-atual";
import { EmDesenvolvimento } from "@/components/app-shell/em-desenvolvimento";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Papel = "gestora" | "mentor";

interface Pessoa {
  idUsuario: number;
  nome: string;
}

interface Projeto {
  idProjeto: number;
  nome: string;
}

interface Contagens {
  contratosAtivos: number;
  assessoresAtivos: number;
}

// NAV-10/NAV-11: contagem de contratos e assessores ativos do produto, com
// filtro em cascata papel -> pessoa (AC2, literal ao spec). slug já validado
// pelo layout.tsx pai (T13).
export default function ProdutoDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params) as { slug: ProdutoSlug };
  const { data: produto } = useProdutoAtual(slug);

  const [papel, setPapel] = useState<Papel | "todos">("todos");
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [idUsuario, setIdUsuario] = useState<number | "todos">("todos");
  const [contagens, setContagens] = useState<Contagens | null>(null);

  // KAN-03/KAN-10: filtro de projeto + "Minha carteira" do board Kanban --
  // combinam por AND com o filtro papel+pessoa já existente acima (T10).
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [idProjeto, setIdProjeto] = useState<number | "todos">("todos");
  const [minhaCarteira, setMinhaCarteira] = useState(false);

  // Papel escolhido repopula a lista de pessoas daquele papel (a pessoa
  // selecionada é resetada no próprio handler do Select de papel, abaixo).
  // Sem papel escolhido não busca nada -- o Select de pessoa fica disabled
  // nesse caso, então uma lista desatualizada não chega a ser exibida.
  useEffect(() => {
    if (!produto || papel === "todos") return;
    let cancelado = false;
    buscarPessoasComPapelNoProduto(createClient(), produto.idProduto, papel).then((lista) => {
      if (!cancelado) setPessoas(lista);
    });
    return () => {
      cancelado = true;
    };
  }, [produto, papel]);

  // Recalcula as duas contagens -- sem filtro (padrão) ou restritas aos
  // contratos onde a pessoa escolhida tem vínculo ativo naquele papel.
  useEffect(() => {
    if (!produto) return;
    let cancelado = false;
    const filtro = papel !== "todos" && idUsuario !== "todos" ? { papel, idUsuario } : undefined;

    contarContratosEAssessoresAtivos(createClient(), produto.idProduto, filtro).then((resultado) => {
      if (!cancelado) setContagens(resultado);
    });
    return () => {
      cancelado = true;
    };
  }, [produto, papel, idUsuario]);

  // KAN-03: popula o Select de projeto com só os projetos com contrato no
  // produto atual -- independente do filtro papel+pessoa (dimensão própria).
  useEffect(() => {
    if (!produto) return;
    let cancelado = false;
    buscarProjetosDoProduto(createClient(), produto.idProduto).then((lista) => {
      if (!cancelado) setProjetos(lista);
    });
    return () => {
      cancelado = true;
    };
  }, [produto]);

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <Select
          value={papel}
          onValueChange={(v) => {
            setPapel(v as Papel | "todos");
            setIdUsuario("todos");
          }}
        >
          <SelectTrigger className="bg-background text-xs">
            <SelectValue placeholder="Filtrar por papel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="gestora">Gestora</SelectItem>
            <SelectItem value="mentor">Mentor</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={String(idUsuario)}
          onValueChange={(v) => setIdUsuario(v === "todos" ? "todos" : Number(v))}
          disabled={papel === "todos"}
        >
          <SelectTrigger className="bg-background text-xs">
            <SelectValue placeholder="Filtrar por pessoa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as pessoas</SelectItem>
            {pessoas.map((p) => (
              <SelectItem key={p.idUsuario} value={String(p.idUsuario)}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(idProjeto)}
          onValueChange={(v) => setIdProjeto(v === "todos" ? "todos" : Number(v))}
        >
          <SelectTrigger className="bg-background text-xs">
            <SelectValue placeholder="Filtrar por projeto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os projetos</SelectItem>
            {projetos.map((p) => (
              <SelectItem key={p.idProjeto} value={String(p.idProjeto)}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Label className="justify-start gap-2 rounded-lg border border-input bg-background px-2.5 text-xs">
          <Switch checked={minhaCarteira} onCheckedChange={setMinhaCarteira} />
          Minha carteira
        </Label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contratos ativos</CardTitle>
          </CardHeader>
          <CardContent className="font-heading text-3xl font-bold">
            {contagens ? contagens.contratosAtivos : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Assessores ativos</CardTitle>
          </CardHeader>
          <CardContent className="font-heading text-3xl font-bold">
            {contagens ? contagens.assessoresAtivos : "—"}
          </CardContent>
        </Card>
      </div>

      <EmDesenvolvimento
        titulo="Planejamento em desenvolvimento"
        mensagem="Kanban e indicadores de planejamento chegam em uma próxima etapa."
      />
    </div>
  );
}

import type { PlanejamentoKpi } from "@backend/queries/planejamento";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// PLV-11 (T21, .specs/features/planejamento-estrategico-v2/spec.md "P2: KPIs e
// filtro por Objetivo" AC1). Os 4 cartões de topo da aba Construir a
// estrutura -- Atingimento total do plano, Metas prioritárias, Sucessos
// Mensais e Fatos Geradores (AC1, ordem literal da spec).
//
// Números saem de vw_planejamento_kpi (AD-003): este componente só formata o
// que buscarPlanejamentoKpis já trouxe, nunca agrega nada sozinho.
// "Fatos Geradores" era placeholder ("Em desenvolvimento") até
// fatos-geradores-ciclo-vida concluir -- concluída em 2026-09-18, a view
// ganhou nr_fatos_geradores (AD-064) e o cartão virou número real, mesma
// regra de "—" dos outros 3. Só a contagem: o IIP e a quebra por dimensão
// continuam de fora, de propósito, para não duplicar o IipCard que já mora
// na aba Fatos Geradores e Registros > Ciclo de Vida do mesmo contrato.
//
// AC4/AD-005: plano sem nenhuma Meta faz a view devolver NULL em cada coluna
// agregada (não a linha inteira -- dim_planejamento sempre tem uma linha via
// LEFT JOIN), então o vazio aparece campo a campo, e cada cartão mostra "—",
// nunca "0". Um plano com 0% de atingimento e um plano sem Meta nenhuma são
// diagnósticos opostos; confundi-los aqui seria repetir o erro que a cascata
// já evita com COALESCE(...,0) só onde há Sucesso Mensal de verdade.
//
// "Metas prioritárias" reproduz o "3 de 7" do mockup (227:194) com dado real,
// não inventado: `metasPrioritarias` e `metasAtivas` são as DUAS colunas que a
// view expõe, contadas por CHECK diferentes (prioridade='alta' e
// status='ativa') -- a fração é honesta. "Sucessos Mensais" no mockup mostra
// "8 de 12", mas a view só expõe UMA contagem (sem numerador/denominador
// próprios); mostrar uma fração inventada seria a mesma classe de erro que a
// skill figma-dominio-legisla cataloga contra "valor de exemplo" em catálogo
// vazio -- aqui é fração de exemplo em dado real. Fica como contagem simples.
export interface PlanejamentoKpisProps {
  kpis: PlanejamentoKpi | null;
  carregando: boolean;
}

function Cartao({
  titulo,
  valor,
  tracejado,
  placeholder,
}: {
  titulo: string;
  valor: string;
  tracejado?: boolean;
  placeholder?: boolean;
}) {
  return (
    <Card className={tracejado ? "border-dashed" : undefined}>
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={placeholder ? "text-sm text-muted-foreground" : "text-lg font-semibold tabular-nums"}>
          {valor}
        </p>
      </CardContent>
    </Card>
  );
}

export function PlanejamentoKpis({ kpis, carregando }: PlanejamentoKpisProps) {
  // "…" enquanto carrega -- distinto de "—" (ausência real de dado, AD-005) e
  // de um número (dado presente). Três estados, três leituras diferentes.
  const formata = (valor: number | null | undefined): string => {
    if (carregando) return "…";
    return valor == null ? "—" : String(valor);
  };

  const atingimento = carregando ? "…" : kpis?.pctAtingimento != null ? `${kpis.pctAtingimento}%` : "—";
  // Fração só existe inteira: metasPrioritarias sem metasAtivas (ou vice-versa)
  // não vira "3" solto -- um número sem o "de quantas" pareceria total, não
  // recorte. Cai em "—" como as outras ausências.
  const metasPrioritarias =
    !carregando && kpis?.metasPrioritarias != null && kpis?.metasAtivas != null
      ? `${kpis.metasPrioritarias} de ${kpis.metasAtivas}`
      : formata(null);
  const sucessosMensais = formata(kpis?.sucessosMensais);
  // fatos-geradores-ciclo-vida concluiu em 2026-09-18 (AD-064) -- a contagem
  // já tem dono. "—" segue o mesmo AD-005 dos outros 3 cartões: contrato sem
  // nenhum Fato Gerador realizado é ausência de dado, não zero.
  const fatosGeradores = formata(kpis?.nrFatosGeradores);

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Cartao titulo="Atingimento total do plano" valor={atingimento} />
      <Cartao titulo="Metas prioritárias" valor={metasPrioritarias} />
      <Cartao titulo="Sucessos Mensais" valor={sucessosMensais} />
      <Cartao titulo="Fatos Geradores" valor={fatosGeradores} />
    </div>
  );
}

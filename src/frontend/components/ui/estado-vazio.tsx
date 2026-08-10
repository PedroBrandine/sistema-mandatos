export interface EstadoVazioProps {
  titulo: string;
  mensagem?: string;
  acao?: React.ReactNode;
}

/**
 * Estado vazio padronizado com CTA opcional -- generaliza a caixa de borda
 * pontilhada duplicada hoje em mandatos/page.tsx ("nenhum cadastrado" /
 * "nenhum encontrado com filtros").
 */
export function EstadoVazio({ titulo, mensagem, acao }: EstadoVazioProps) {
  return (
    <div className="grid justify-items-center gap-4 rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
      <div className="grid gap-1">
        <p className="font-medium text-foreground">{titulo}</p>
        {mensagem ? <p>{mensagem}</p> : null}
      </div>
      {acao}
    </div>
  );
}

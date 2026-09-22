import { EditorListaTexto } from "./editor-lista-texto";

// pll-cadastro-participantes T18 (design.md "Components" -- EditorSwot;
// PLL-CP-24, PLL-CP-25). Análise SWOT do perfil político do parlamentar --
// conceito distinto do Oportunidade/Ameaça de fat_objetivo_especifico (spec.md
// "Revisão de mockup", já removido de lá; convive sem reabrir a remoção).
// 4 quadrantes independentes (Forças/Fraquezas/Oportunidades/Ameaças),
// reaproveitando EditorListaTexto (T17) em cada um -- cada quadrante tem seu
// próprio estado vazio, sem esconder os outros 3 já preenchidos (PLL-CP-25).
//
// `readOnly` (PLL-CP-23, T19): propagado aos 4 EditorListaTexto.

export interface EditorSwotProps {
  forcas: string[];
  fraquezas: string[];
  oportunidades: string[];
  ameacas: string[];
  onChangeForcas: (itens: string[]) => void;
  onChangeFraquezas: (itens: string[]) => void;
  onChangeOportunidades: (itens: string[]) => void;
  onChangeAmeacas: (itens: string[]) => void;
  readOnly?: boolean;
}

export function EditorSwot({
  forcas,
  fraquezas,
  oportunidades,
  ameacas,
  onChangeForcas,
  onChangeFraquezas,
  onChangeOportunidades,
  onChangeAmeacas,
  readOnly = false,
}: EditorSwotProps) {
  return (
    <div className="grid gap-4">
      <p className="text-sm font-bold">Análise SWOT</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <EditorListaTexto
          titulo="Forças"
          itens={forcas}
          onChange={onChangeForcas}
          readOnly={readOnly}
          placeholder="Adicionar força…"
        />
        <EditorListaTexto
          titulo="Fraquezas"
          itens={fraquezas}
          onChange={onChangeFraquezas}
          readOnly={readOnly}
          placeholder="Adicionar fraqueza…"
        />
        <EditorListaTexto
          titulo="Oportunidades"
          itens={oportunidades}
          onChange={onChangeOportunidades}
          readOnly={readOnly}
          placeholder="Adicionar oportunidade…"
        />
        <EditorListaTexto
          titulo="Ameaças"
          itens={ameacas}
          onChange={onChangeAmeacas}
          readOnly={readOnly}
          placeholder="Adicionar ameaça…"
        />
      </div>
    </div>
  );
}

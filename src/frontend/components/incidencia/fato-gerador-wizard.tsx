"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { FatoGeradorForm } from "./fato-gerador-form";
import { SeletorOrigem, type OrigemFato } from "./seletor-origem";

// FGC-01/FGC-02 (T16, fatos-geradores-ciclo-vida). Wizard de 2 passos: passo
// 1 pergunta a natureza (Já aconteceu/Ainda vai acontecer) + a origem
// (SeletorOrigem, T15); passo 2 envolve fato-gerador-form.tsx (T17) --
// achado principal do design.md, a cascata Grupo->Tipologia->Estado já
// existe e não é reescrita.
//
// situacaoInicial/origemInicial são passados para o passo 2 como props
// (fato-gerador-form.tsx ganha esses 2 props em T17, próxima task do
// mesmo lote -- FatoGeradorFormProps ainda não os declara neste commit,
// mas a Gate desta task é só `npm run test:unit`, sem checagem de tipo, e
// T17 fecha a extensão logo em seguida). O estado de passo 1 (situacao,
// origem) vive neste componente, não no passo 2 -- por isso "Voltar"
// preserva o preenchido (Edge Case da spec.md).
export type NaturezaFato = "realizado" | "projetado";

export interface FatoGeradorWizardProps {
  idContrato: number;
  onConcluido: (criado?: { idFatoGerador: number }) => void;
  onCancelar: () => void;
}

export function FatoGeradorWizard({ idContrato, onConcluido, onCancelar }: FatoGeradorWizardProps) {
  const [passo, setPasso] = useState<1 | 2>(1);
  const [situacao, setSituacao] = useState<NaturezaFato | null>(null);
  const [origem, setOrigem] = useState<OrigemFato | null>(null);

  const podeAvancar = situacao !== null && origem !== null;

  if (passo === 2 && situacao !== null && origem !== null) {
    return (
      <div className="grid gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => setPasso(1)} className="w-fit">
          ← Voltar
        </Button>
        <FatoGeradorForm
          idContrato={idContrato}
          situacaoInicial={situacao}
          origemInicial={origem}
          onConcluido={onConcluido}
          onCancelar={onCancelar}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <p className="text-sm font-medium">O que aconteceu?</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={situacao === "realizado" ? "default" : "outline"}
            onClick={() => setSituacao("realizado")}
          >
            Já aconteceu
          </Button>
          <Button
            type="button"
            variant={situacao === "projetado" ? "default" : "outline"}
            onClick={() => setSituacao("projetado")}
          >
            Ainda vai acontecer
          </Button>
        </div>
      </div>

      <SeletorOrigem idContrato={idContrato} valor={origem} onSelecionar={setOrigem} />

      <div className="flex gap-2">
        <Button type="button" onClick={() => setPasso(2)} disabled={!podeAvancar}>
          Avançar
        </Button>
        <Button type="button" variant="outline" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

"use client";

import { Info } from "lucide-react";

import { MAPA_CABECALHOS } from "@backend/schemas/cadastro-participante-pll";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Pedro, 23/09: "preciso de um balão na página com a cola dos campos da
// planilha que eu importo". Reaproveita MAPA_CABECALHOS (fonte única do
// parser, cadastro-participante-pll.ts) -- os grupos abaixo só reproduzem a
// divisão do Anexo A (spec.md, "Dados Pessoais (12) / Dados do Mandato
// autodeclarados (7) / Pautas Prioritárias (6)") para leitura; o mapeamento
// cabeçalho -> campo em si nunca é digitado de novo aqui.
const GRUPOS: { titulo: string; cabecalhos: string[] }[] = [
  {
    titulo: "Dados pessoais (mentorado/assessor)",
    cabecalhos: [
      "Você é um(a) [Mentorado/Mentor]",
      "Nome Completo",
      "Data de nascimento",
      "E-mail",
      "Telefone (com DDD)",
      "Identidade de gênero",
      "Orientação sexual",
      "Cor/raça",
      "Deficiências",
      "Partido filiado",
      "Tempo na política",
      "Já conhecia a Legisla",
    ],
  },
  {
    titulo: "Dados do mandato (autodeclarados -- usados no match com o TSE)",
    cabecalhos: [
      "Nome do Parlamentar",
      "Cor/raça do parlamentar",
      "Partido do parlamentar",
      "Estado de eleição",
      "Cargos anteriores",
      "Mandatos anteriores",
      "Instagram/rede social",
    ],
  },
  {
    titulo: "Pautas prioritárias",
    cabecalhos: [
      "Educação",
      "Segurança pública",
      "Modernização do Estado",
      "Clima",
      "Outras pautas prioritárias",
      "Especifique a pauta",
    ],
  },
];

export function LegendaCamposPlanilhaPll() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="Ver mapa de campos da planilha">
          <Info className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-[70vh] overflow-y-auto" align="start">
        <div className="grid gap-4">
          <div>
            <p className="text-sm font-bold">Campos da planilha (Anexo A)</p>
            <p className="text-xs text-muted-foreground">
              Cabeçalho exato da coluna na planilha -&gt; campo gravado no cadastro do participante.
            </p>
          </div>
          {GRUPOS.map((grupo) => (
            <div key={grupo.titulo} className="grid gap-1.5">
              <p className="text-xs font-bold uppercase text-muted-foreground">{grupo.titulo}</p>
              <ul className="grid gap-1 text-xs">
                {grupo.cabecalhos.map((cabecalho) => (
                  <li key={cabecalho} className="flex items-baseline justify-between gap-2">
                    <span>{cabecalho}</span>
                    <code className="shrink-0 rounded bg-muted px-1 py-0.5 text-[11px] text-muted-foreground">
                      {MAPA_CABECALHOS[cabecalho]}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

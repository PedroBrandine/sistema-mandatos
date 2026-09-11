"use client";

import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { Search } from "lucide-react";

import { buscarCandidaturas } from "@backend/queries/tse";
import { createClient } from "@backend/supabase/client";
import type { CandidaturaSugerida } from "@backend/types/fundacao";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ErroInline } from "@/components/ui/erro-inline";

const VARIANTE_CONFIANCA: Record<CandidaturaSugerida["confianca"], "default" | "secondary" | "outline"> = {
  alta: "default",
  media: "secondary",
  baixa: "outline",
};

export interface TseMatchSearchProps {
  onSelecionar: (candidatura: CandidaturaSugerida) => void;
}

interface ParametrosBuscaTse {
  nome: string;
  sgUf: string;
  anoEleicao: string;
}

interface EstadoBuscaTse {
  buscando: boolean;
  erro: string | null;
  resultadosExibidos: CandidaturaSugerida[] | null;
  modoManualAtivo: boolean;
}

// Estado + efeito de busca isolados do JSX (Popover/Command) de propósito:
// achado empírico de T22 -- com Popover+Command (Radix) montados, o
// setTimeout real do `use-debounce` nunca chega a disparar em jsdom (o loop
// de posicionamento do Radix Popper satura o event loop), tornando a busca
// impossível de exercitar via clique+digitação em teste de componente, com
// ou sem timers falsos. Extrair a lógica para este hook -- sem Popover/
// Command na árvore -- permite testar EST-10 AC1/AC2/AC8 via `renderHook`,
// que é rápido e determinístico, sem abrir mão de nenhuma ramificação.
// Exportado (não usado fora deste arquivo) só para isso.
export function useBuscaTse({ nome, sgUf, anoEleicao }: ParametrosBuscaTse): EstadoBuscaTse {
  const [debouncedNome] = useDebounce(nome, 500);
  const [resultados, setResultados] = useState<CandidaturaSugerida[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [modoManual, setModoManual] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // EST-10 AC1/AC2 (mín. 3 letras): abaixo de 3 letras não busca. A limpeza de
  // `resultados`/`modoManual` acontece via derivação (resultadosExibidos/
  // modoManualAtivo abaixo), não por setState síncrono aqui dentro -- eslint
  // react-hooks/set-state-in-effect (lint:frontend, Done-when de T22) rejeita
  // ajustar estado a partir de props/state já disponíveis no corpo do efeito.
  useEffect(() => {
    if (debouncedNome.length < 3) {
      return;
    }

    async function buscar() {
      setBuscando(true);
      setErro(null);
      try {
        const supabase = createClient();
        const resultado = await buscarCandidaturas(supabase, {
          nome: debouncedNome.trim() || undefined,
          sgUf: sgUf.trim() || undefined,
          anoEleicao: anoEleicao ? Number(anoEleicao) : undefined,
        });
        setResultados(resultado);
        if (resultado.length === 0) setModoManual(true);
      } catch {
        setErro("Não foi possível buscar candidaturas agora. Tente novamente.");
      } finally {
        setBuscando(false);
      }
    }

    void buscar();
  }, [debouncedNome, sgUf, anoEleicao]);

  // Derivado em vez de resetado por setState no efeito acima: abaixo de 3
  // letras a busca anterior não deve aparecer nem contar como "modo manual".
  const buscaAtiva = debouncedNome.length >= 3;
  const resultadosExibidos = buscaAtiva ? resultados : null;
  const modoManualAtivo = buscaAtiva && modoManual;

  return { buscando, erro, resultadosExibidos, modoManualAtivo };
}

interface ResultadosBuscaTseProps {
  buscando: boolean;
  erro: string | null;
  resultados: CandidaturaSugerida[] | null;
  onSelecionar: (candidatura: CandidaturaSugerida) => void;
}

// Os 4 estados da lista (buscando / erro / vazio / com resultados) num
// componente puro, guiado só por props: é o que torna EST-10 AC8 e o estado
// vazio testáveis no DOM de verdade. Dentro do <Popover> o conteúdo só
// monta depois de um clique que o jsdom não consegue estabilizar (ver
// comentário de `useBuscaTse`), mas <Command> sozinho monta normalmente --
// então o teste renderiza este componente dentro de um <Command> e assere o
// <ErroInline> e o "Nenhuma candidatura encontrada" renderizados, em vez de
// só inspecionar a string de estado do hook.
export function ResultadosBuscaTse({ buscando, erro, resultados, onSelecionar }: ResultadosBuscaTseProps) {
  return (
    <CommandList>
      {buscando && <div className="p-4 text-center text-sm text-muted-foreground">Buscando...</div>}
      {/* EST-10 AC8: espelho TSE indisponível vira ErroInline -- o botão
          "Cadastro manual" continua acessível porque vive fora deste
          componente, como um irmão do TseMatchSearch (ver MandatoWizard),
          nunca condicionado a este estado de erro. */}
      {erro && (
        <div className="p-2">
          <ErroInline titulo="Não foi possível buscar" mensagem={erro} />
        </div>
      )}
      {!buscando && !erro && resultados !== null && resultados.length === 0 && (
        <CommandEmpty>Nenhuma candidatura encontrada.</CommandEmpty>
      )}
      {!buscando && !erro && resultados !== null && resultados.length > 0 && (
        <CommandGroup heading="Resultados">
          {resultados.map((candidatura) => (
            <CommandItem
              key={`${candidatura.sqCandidato}-${candidatura.anoEleicao}-${candidatura.nrTurno}`}
              onSelect={() => onSelecionar(candidatura)}
              className="flex flex-col items-start py-2 cursor-pointer"
            >
              <div className="font-medium">
                {candidatura.nmUrna ?? candidatura.nmCandidato ?? "—"}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span>{candidatura.sgUf ?? "—"}</span>
                <span>•</span>
                <span>{candidatura.sgPartido ?? "—"}</span>
                <span>•</span>
                <span>{candidatura.anoEleicao}</span>
                <span>•</span>
                <Badge variant={VARIANTE_CONFIANCA[candidatura.confianca]} className="text-[10px] h-4 px-1.5">
                  {candidatura.confianca}
                </Badge>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </CommandList>
  );
}

export function TseMatchSearch({ onSelecionar }: TseMatchSearchProps) {
  const [nome, setNome] = useState("");
  const [sgUf, setSgUf] = useState("");
  const [anoEleicao, setAnoEleicao] = useState("");
  const [open, setOpen] = useState(false);
  const { buscando, erro, resultadosExibidos, modoManualAtivo } = useBuscaTse({ nome, sgUf, anoEleicao });

  function selecionar(candidatura: CandidaturaSugerida) {
    onSelecionar(modoManualAtivo ? { ...candidatura, metodoMatch: "manual" } : candidatura);
    setOpen(false);
  }

  return (
    <div className="grid gap-4">
      {/* `w-full` no botão de busca ignorava os irmãos deste flex: empurrava
          os campos UF e Ano (`shrink-0`) para fora da linha, onde o
          `overflow-hidden` do Card do MandatoWizard os cortava. `flex-1
          min-w-0` reparte a linha entre os três. */}
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="min-w-0 flex-1 justify-between font-normal text-muted-foreground"
            >
              Buscar candidato no TSE (mín. 3 letras)...
              <Search className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput 
                placeholder="Digite o nome..." 
                value={nome} 
                onValueChange={setNome} 
              />
              <ResultadosBuscaTse
                buscando={buscando}
                erro={erro}
                resultados={resultadosExibidos}
                onSelecionar={selecionar}
              />
            </Command>
          </PopoverContent>
        </Popover>
        <Input
          placeholder="UF"
          maxLength={2}
          value={sgUf}
          onChange={(e) => setSgUf(e.target.value.toUpperCase())}
          className="w-20 shrink-0"
        />
        <Input
          placeholder="Ano"
          inputMode="numeric"
          value={anoEleicao}
          onChange={(e) => setAnoEleicao(e.target.value.replace(/\D/g, ""))}
          className="w-24 shrink-0"
        />
      </div>
    </div>
  );
}

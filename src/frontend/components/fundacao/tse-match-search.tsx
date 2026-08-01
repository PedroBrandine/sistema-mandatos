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

const VARIANTE_CONFIANCA: Record<CandidaturaSugerida["confianca"], "default" | "secondary" | "outline"> = {
  alta: "default",
  media: "secondary",
  baixa: "outline",
};

export interface TseMatchSearchProps {
  onSelecionar: (candidatura: CandidaturaSugerida) => void;
}

export function TseMatchSearch({ onSelecionar }: TseMatchSearchProps) {
  const [nome, setNome] = useState("");
  const [debouncedNome] = useDebounce(nome, 500);
  const [sgUf, setSgUf] = useState("");
  const [anoEleicao, setAnoEleicao] = useState("");
  const [resultados, setResultados] = useState<CandidaturaSugerida[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [modoManual, setModoManual] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (debouncedNome.length < 3) {
      setResultados(null);
      setModoManual(false);
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

  function selecionar(candidatura: CandidaturaSugerida) {
    onSelecionar(modoManual ? { ...candidatura, metodoMatch: "manual" } : candidatura);
    setOpen(false);
  }

  return (
    <div className="grid gap-4">
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between font-normal text-muted-foreground"
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
              <CommandList>
                {buscando && <div className="p-4 text-center text-sm text-muted-foreground">Buscando...</div>}
                {erro && <div className="p-4 text-center text-sm text-red-500">{erro}</div>}
                {!buscando && !erro && resultados !== null && resultados.length === 0 && (
                  <CommandEmpty>
                    Nenhuma candidatura encontrada.
                  </CommandEmpty>
                )}
                {!buscando && !erro && resultados !== null && resultados.length > 0 && (
                  <CommandGroup heading="Resultados">
                    {resultados.map((candidatura) => (
                      <CommandItem
                        key={`${candidatura.sqCandidato}-${candidatura.anoEleicao}-${candidatura.nrTurno}`}
                        onSelect={() => selecionar(candidatura)}
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

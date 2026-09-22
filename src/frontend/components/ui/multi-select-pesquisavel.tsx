"use client";

import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Filtro de lista: dropdown com busca e seleção múltipla. Substitui o <Select>
// nas barras de filtro (Gestora, Projeto, Contrato, Etapa, Status, UF...) --
// com dezenas de opções o Select obrigava a rolar a lista inteira e só aceitava
// um valor. Filtros de DATA continuam sendo <Input type="date">, fora daqui.
//
// Controlado: `valores` vazio significa "sem filtro" (todas as opções), o mesmo
// papel do valor-sentinela "todos" dos Selects antigos, só que sem sentinela.
// O texto do gatilho sem seleção é o `placeholder` (ex.: "Todas as gestoras").
export interface OpcaoMultiSelect<T extends string | number> {
  valor: T;
  rotulo: string;
}

// As listas de opções das telas chegam como { id, nome } (dim_usuario,
// ref_projeto...); este adaptador evita repetir o map em cada barra de filtro.
export function opcoesDeIdNome(lista: { id: number; nome: string }[]): OpcaoMultiSelect<number>[] {
  return lista.map((o) => ({ valor: o.id, rotulo: o.nome }));
}

// Filtro sem valores marcados vira `undefined`, não `[]`: mantém o estado do
// filtro idêntico ao de "nunca mexeu" (o botão "Limpar filtros" devolve `{}`).
export function listaOuUndefined<T>(lista: T[]): T[] | undefined {
  return lista.length > 0 ? lista : undefined;
}

export interface MultiSelectPesquisavelProps<T extends string | number> {
  opcoes: OpcaoMultiSelect<T>[];
  valores: T[];
  onChange: (valores: T[]) => void;
  placeholder: string;
  // aria-label do gatilho. Sem ele, o próprio placeholder nomeia o controle --
  // mas o placeholder some da tela quando há seleção, e o leitor de tela não.
  rotulo?: string;
  // Plural usado no resumo com 2+ seleções: "3 gestoras". Sem ele: "3 selecionados".
  rotuloPlural?: string;
  placeholderBusca?: string;
  className?: string;
  disabled?: boolean;
}

// Busca sem acento e sem caixa: "acao" encontra "Ação". O cmdk compara o texto
// que passarmos em `keywords`, então o rótulo entra ali (e não em `value`, que
// aqui é o id da opção e não deve casar com o que a pessoa digita).
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function filtrarPorRotulo(_value: string, busca: string, keywords?: string[]): number {
  return normalizar((keywords ?? []).join(" ")).includes(normalizar(busca.trim())) ? 1 : 0;
}

export function MultiSelectPesquisavel<T extends string | number>({
  opcoes,
  valores,
  onChange,
  placeholder,
  rotulo,
  rotuloPlural = "selecionados",
  placeholderBusca = "Buscar...",
  className,
  disabled,
}: MultiSelectPesquisavelProps<T>) {
  function alternar(valor: T) {
    onChange(valores.includes(valor) ? valores.filter((v) => v !== valor) : [...valores, valor]);
  }

  const selecionadas = opcoes.filter((o) => valores.includes(o.valor));
  let resumo = placeholder;
  if (selecionadas.length === 1) resumo = selecionadas[0].rotulo;
  else if (selecionadas.length > 1) resumo = `${selecionadas.length} ${rotuloPlural}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          // aria-expanded e aria-controls vêm do PopoverTrigger (Radix os injeta
          // no filho via asChild); o lint estático não enxerga isso.
          // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
          role="combobox"
          aria-haspopup="listbox"
          aria-label={rotulo ?? placeholder}
          disabled={disabled}
          data-placeholder={selecionadas.length === 0 ? "" : undefined}
          className={cn(
            "flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50",
            className
          )}
        >
          <span className="line-clamp-1 text-left">{resumo}</span>
          <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-56 gap-0 p-0">
        <Command filter={filtrarPorRotulo} className="rounded-lg!">
          <CommandInput placeholder={placeholderBusca} aria-label={`Buscar em ${rotulo ?? placeholder}`} />
          <CommandList>
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            <CommandGroup>
              {opcoes.map((o) => {
                const marcada = valores.includes(o.valor);
                return (
                  <CommandItem
                    key={o.valor}
                    value={String(o.valor)}
                    keywords={[o.rotulo]}
                    aria-checked={marcada}
                    // O check de CommandItem aparece com data-checked="true".
                    data-checked={marcada}
                    onSelect={() => alternar(o.valor)}
                  >
                    {o.rotulo}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="border-t border-border p-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full font-semibold text-secondary hover:text-secondary"
            disabled={valores.length === 0}
            onClick={() => onChange([])}
          >
            Limpar seleção
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

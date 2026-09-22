import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { MultiSelectPesquisavel } from "./multi-select-pesquisavel";

// O Popover do Radix (portal, FocusScope, aria-hidden nos irmãos) leva dezenas
// de segundos por teste em jsdom -- mesmo obstáculo já registrado em
// encontro-popover.test.tsx, e a mesma saída: o primitivo é stubado e o
// conteúdo fica sempre montado. Abrir/fechar é comportamento do Radix
// (dependência); aqui se testa o que é DESTE componente: resumo do gatilho,
// alternar opções, busca e "Limpar seleção".
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// cmdk usa ResizeObserver e scrollIntoView, que o jsdom não implementa.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(cleanup);

const OPCOES = [
  { valor: 1, rotulo: "Ana Gestora" },
  { valor: 2, rotulo: "Bruno Ação" },
  { valor: 3, rotulo: "Carla Mendes" },
];

describe("MultiSelectPesquisavel", () => {
  it("sem seleção mostra o placeholder", () => {
    render(
      <MultiSelectPesquisavel opcoes={OPCOES} valores={[]} onChange={vi.fn()} placeholder="Todas as gestoras" rotulo="Gestora" />
    );

    expect(screen.getByRole("combobox", { name: "Gestora" })).toHaveTextContent("Todas as gestoras");
  });

  it("com uma seleção mostra o nome; com várias, a contagem no plural informado", () => {
    const { rerender } = render(
      <MultiSelectPesquisavel opcoes={OPCOES} valores={[2]} onChange={vi.fn()} placeholder="Todas" rotulo="Gestora" rotuloPlural="gestoras" />
    );
    expect(screen.getByRole("combobox", { name: "Gestora" })).toHaveTextContent("Bruno Ação");

    rerender(
      <MultiSelectPesquisavel opcoes={OPCOES} valores={[1, 3]} onChange={vi.fn()} placeholder="Todas" rotulo="Gestora" rotuloPlural="gestoras" />
    );
    expect(screen.getByRole("combobox", { name: "Gestora" })).toHaveTextContent("2 gestoras");
  });

  it("clicar numa opção a adiciona, sem tirar as já marcadas", () => {
    const onChange = vi.fn();
    render(<MultiSelectPesquisavel opcoes={OPCOES} valores={[1]} onChange={onChange} placeholder="Todas" rotulo="Gestora" />);

    fireEvent.click(screen.getByRole("option", { name: "Carla Mendes" }));

    expect(onChange).toHaveBeenCalledWith([1, 3]);
  });

  it("clicar numa opção já marcada a remove", () => {
    const onChange = vi.fn();
    render(<MultiSelectPesquisavel opcoes={OPCOES} valores={[1, 3]} onChange={onChange} placeholder="Todas" rotulo="Gestora" />);

    fireEvent.click(screen.getByRole("option", { name: "Ana Gestora" }));

    expect(onChange).toHaveBeenCalledWith([3]);
  });

  it("a busca filtra a lista sem diferenciar acento nem caixa", () => {
    render(<MultiSelectPesquisavel opcoes={OPCOES} valores={[]} onChange={vi.fn()} placeholder="Todas" rotulo="Gestora" />);

    fireEvent.change(screen.getByPlaceholderText("Buscar..."), { target: { value: "acao" } });

    expect(screen.getByRole("option", { name: "Bruno Ação" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Ana Gestora" })).not.toBeInTheDocument();
  });

  it("busca sem resultado mostra o estado vazio", () => {
    render(<MultiSelectPesquisavel opcoes={OPCOES} valores={[]} onChange={vi.fn()} placeholder="Todas" rotulo="Gestora" />);

    fireEvent.change(screen.getByPlaceholderText("Buscar..."), { target: { value: "zzz" } });

    expect(screen.getByText("Nenhum resultado.")).toBeInTheDocument();
  });

  it("a busca não casa com o id da opção, só com o rótulo", () => {
    render(<MultiSelectPesquisavel opcoes={[{ valor: 7, rotulo: "Alfa" }, { valor: 8, rotulo: "Beta" }]} valores={[]} onChange={vi.fn()} placeholder="Todas" rotulo="Gestora" />);

    fireEvent.change(screen.getByPlaceholderText("Buscar..."), { target: { value: "7" } });

    expect(screen.getByText("Nenhum resultado.")).toBeInTheDocument();
  });

  it("'Limpar seleção' devolve lista vazia e fica desabilitado sem seleção", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <MultiSelectPesquisavel opcoes={OPCOES} valores={[1, 2]} onChange={onChange} placeholder="Todas" rotulo="Gestora" />
    );

    fireEvent.click(screen.getByRole("button", { name: "Limpar seleção" }));
    expect(onChange).toHaveBeenCalledWith([]);

    rerender(<MultiSelectPesquisavel opcoes={OPCOES} valores={[]} onChange={onChange} placeholder="Todas" rotulo="Gestora" />);
    expect(screen.getByRole("button", { name: "Limpar seleção" })).toBeDisabled();
  });

  it("acumula várias escolhas em uso controlado", () => {
    function Controlado() {
      const [valores, setValores] = useState<number[]>([]);
      return <MultiSelectPesquisavel opcoes={OPCOES} valores={valores} onChange={setValores} placeholder="Todas" rotulo="Gestora" rotuloPlural="gestoras" />;
    }
    render(<Controlado />);

    fireEvent.click(screen.getByRole("option", { name: "Ana Gestora" }));
    fireEvent.click(screen.getByRole("option", { name: "Carla Mendes" }));

    expect(screen.getByRole("combobox", { name: "Gestora" })).toHaveTextContent("2 gestoras");
    expect(screen.getByRole("option", { name: "Bruno Ação" })).toBeInTheDocument();
  });
});

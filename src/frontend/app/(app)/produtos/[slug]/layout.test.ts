import { describe, expect, it } from "vitest";

import ProdutoLayout from "./layout";

// EST-03 AC4 (spec-precision gap fechado em 2026-09-14, era comportamento
// correto por inspeção de código sem nenhum teste automatizado -- ver
// validation.md e tasks.md, desvio 4 do Batch 3). `ProdutoLayout` é Server
// Component (função async, Next 16 -- params é Promise): chamamos a função
// direto, sem @testing-library/react, porque não há nada para renderizar em
// jsdom aqui -- só o comportamento de lançar (ou não) `notFound()`.
describe("ProdutoLayout (EST-03 AC4)", () => {
  it("slug inválido chama notFound() -- digest de 404, não um throw genérico", async () => {
    await expect(
      ProdutoLayout({ children: null, params: Promise.resolve({ slug: "produto-que-nao-existe" }) })
    ).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });

  // Lado oposto: slug válido não lança, e o resultado envolve o children em
  // ProdutoShell -- não é só "não quebrou", é "montou a árvore certa".
  it("slug válido não chama notFound() e renderiza ProdutoShell com o slug", async () => {
    const resultado = await ProdutoLayout({
      children: "conteudo-de-teste",
      params: Promise.resolve({ slug: "estrategia" }),
    });

    expect(resultado.props.slug).toBe("estrategia");
    expect(resultado.props.children).toBe("conteudo-de-teste");
  });
});

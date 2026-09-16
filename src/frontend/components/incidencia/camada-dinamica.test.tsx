import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useForm } from "react-hook-form";

import { parseSchemaCampos, type CampoDinamico } from "@/lib/camada-dinamica";
import { CamadaDinamica } from "./camada-dinamica";

// Spec anchor: .specs/features/ficha-mandato-contrato/tasks.md, T30 Done-when
// (FMC-16 AC4/AC5/AC8, FMC-17 AC6/AC7, FMC-20 AC12, FMC-22) --
//  - texto_curto/texto_longo -> input/textarea
//  - link -> URL + descrição
//  - leitura_encontro -> leitura, some sem encontro (dois lados)
//  - arquivo -> bloco "em desenvolvimento", sem upload
//  - lista vazia -> "Nenhum campo extra necessário para este Tipo de Registro"
//  - campo ignorado pelo parser não quebra o render
//
// AD-042 integral: cada condicional (leitura_encontro com/sem encontro) tem
// os dois lados testados.

afterEach(cleanup);

// Harness: CamadaDinamica exige um `control` de react-hook-form -- este
// wrapper cria um useForm() real e repassa o control, mesmo padrão de
// qualquer FormField do projeto.
function Harness({ campos, encontro }: { campos: CampoDinamico[]; encontro: Record<string, string | null> | null }) {
  const { control } = useForm();
  return <CamadaDinamica campos={campos} encontro={encontro} control={control} />;
}

describe("CamadaDinamica — texto_curto/texto_longo (FMC-16 AC4/AC8)", () => {
  it("texto_curto renderiza um input de texto", () => {
    render(
      <Harness
        campos={[{ chave: "resumo_curto", rotulo: "Resumo curto", tipo: "texto_curto" }]}
        encontro={null}
      />
    );

    const campo = screen.getByLabelText("Resumo curto");
    expect(campo.tagName).toBe("INPUT");
  });

  it("texto_longo renderiza uma textarea", () => {
    render(
      <Harness
        campos={[{ chave: "adequacoes", rotulo: "Adequações a serem realizadas", tipo: "texto_longo" }]}
        encontro={null}
      />
    );

    const campo = screen.getByLabelText("Adequações a serem realizadas");
    expect(campo.tagName).toBe("TEXTAREA");
  });
});

describe("CamadaDinamica — link (FMC-17 AC6)", () => {
  it("renderiza um input de URL e um de descrição", () => {
    render(
      <Harness
        campos={[
          { chave: "organograma", rotulo: "Organograma", tipo: "link", artefatoTipo: "organograma" },
        ]}
        encontro={null}
      />
    );

    expect(screen.getByLabelText("Organograma")).toBeInTheDocument();
    expect(screen.getByLabelText("Descrição de Organograma")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("https://")).toBeInTheDocument();
  });
});

describe("CamadaDinamica — leitura_encontro (FMC-20 AC12) — os dois lados", () => {
  const CAMPO_LOCAL: CampoDinamico = {
    chave: "local",
    rotulo: "Local",
    tipo: "leitura_encontro",
    origem: "local",
  };

  it("COM encontro exibe o valor em leitura, sem controle editável", () => {
    render(<Harness campos={[CAMPO_LOCAL]} encontro={{ local: "Gabinete 312" }} />);

    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("Gabinete 312")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("SEM encontro o campo inteiro some -- lado oposto (A-08)", () => {
    render(<Harness campos={[CAMPO_LOCAL]} encontro={null} />);

    expect(screen.queryByText("Local")).not.toBeInTheDocument();
  });

  it("valor ausente no encontro exibe — (AD-005), nunca string vazia", () => {
    render(<Harness campos={[CAMPO_LOCAL]} encontro={{ local: null as unknown as string }} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("CamadaDinamica — arquivo (FMC-22)", () => {
  it("renderiza bloco 'em desenvolvimento', sem controle de upload", () => {
    render(
      <Harness
        campos={[{ chave: "fotos", rotulo: "Fotos", tipo: "arquivo", artefatoTipo: "foto", estado: "em_desenvolvimento" }]}
        encontro={null}
      />
    );

    expect(screen.getByText("Fotos (em desenvolvimento)")).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument();
  });
});

describe("CamadaDinamica — lista vazia", () => {
  it("exibe a mensagem padrão quando não há campos declarados", () => {
    render(<Harness campos={[]} encontro={null} />);

    expect(
      screen.getByText("Nenhum campo extra necessário para este Tipo de Registro")
    ).toBeInTheDocument();
  });
});

describe("CamadaDinamica — campo ignorado pelo parser não quebra o render (edge case da spec.md)", () => {
  it("integra com parseSchemaCampos: o campo desconhecido nunca chega ao renderer, o resto renderiza normalmente", () => {
    const { campos, ignorados } = parseSchemaCampos({
      versao: 1,
      campos: [
        { chave: "resumo_curto", rotulo: "Resumo curto", tipo: "texto_curto" },
        { chave: "assinatura_digital", rotulo: "Assinatura Digital", tipo: "assinatura_biometrica" },
      ],
    });

    expect(ignorados).toEqual(["assinatura_digital"]);

    render(<Harness campos={campos} encontro={null} />);

    expect(screen.getByLabelText("Resumo curto")).toBeInTheDocument();
    expect(screen.queryByText("Assinatura Digital")).not.toBeInTheDocument();
  });
});

describe("CamadaDinamica — Imersão (Anexo C #8), vários tipos juntos", () => {
  it("renderiza local em leitura, campo de texto e nenhum campo a mais quando não há link declarado no schema desta linha", () => {
    render(
      <Harness
        campos={[
          { chave: "local", rotulo: "Local", tipo: "leitura_encontro", origem: "local" },
          { chave: "observacoes", rotulo: "Observações", tipo: "texto_longo" },
        ]}
        encontro={{ local: "Auditório Central" }}
      />
    );

    expect(screen.getByText("Auditório Central")).toBeInTheDocument();
    expect(screen.getByLabelText("Observações")).toBeInTheDocument();
  });
});

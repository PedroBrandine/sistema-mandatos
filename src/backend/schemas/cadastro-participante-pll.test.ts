import { describe, expect, it } from "vitest";

import { linhaCadastroPllSchema, validarLinhasCadastroPll } from "./cadastro-participante-pll";

// Espelha o Anexo A (25 campos) de
// .specs/features/pll-cadastro-participantes/spec.md e o Test Coverage
// Matrix de tasks.md T3 ("Cada um dos 25 campos: válido + inválido; e-mail
// duplicado no arquivo").

const LINHA_VALIDA = {
  papel: "mentorado",
  nome_completo: "Fulana de Tal",
  dt_nascimento: "1990-01-01",
  email: "fulana@example.com",
  telefone: "11999999999",
  identidade_genero: "Mulher cis",
  orientacao_sexual: "Heterossexual",
  cor_raca: "Parda",
  deficiencias: "Nenhuma",
  partido_filiado: "PT",
  tempo_na_politica: "5 anos",
  conhecia_legisla: true,
  nome_parlamentar: "Dep. Fulano",
  cor_raca_parlamentar: "Branca",
  partido_parlamentar: "PT",
  estado_eleicao: "SP",
  cargos_anteriores: "Vereador",
  mandatos_anteriores: "1",
  rede_social: "@fulano",
  nota_educacao: 5,
  nota_seguranca_publica: 4,
  nota_modernizacao_estado: 3,
  nota_clima: 2,
  outras_pautas: ["Saúde"],
  especifique_pauta: "Mobilidade urbana",
} as const;

describe("linhaCadastroPllSchema", () => {
  it("aceita uma linha válida com os 25 campos do Anexo A preenchidos", () => {
    const resultado = linhaCadastroPllSchema.safeParse(LINHA_VALIDA);
    expect(resultado.success).toBe(true);
  });

  it("aceita uma linha válida só com os 3 campos obrigatórios (os demais 22 ausentes)", () => {
    const resultado = linhaCadastroPllSchema.safeParse({
      papel: "mentorado",
      nome_completo: "Fulano de Tal",
      email: "fulano@example.com",
    });
    expect(resultado.success).toBe(true);
  });

  // Sessão ao vivo com Pedro (22/09): Mentor não é cadastrado por este
  // caminho -- mentor já existe como usuário do sistema (dim_usuario), o
  // enum do banco (ck_cadastro_papel) segue aceitando 'mentor' só por
  // compatibilidade com linhas antigas, nunca para entrada nova.
  it("rejeita papel: 'mentor' -- não é cadastrado por este formulário", () => {
    const resultado = linhaCadastroPllSchema.safeParse({
      papel: "mentor",
      nome_completo: "Fulano de Tal",
      email: "fulano@example.com",
    });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toContain("Mentor não é cadastrado por este formulário");
    }
  });

  // Campos obrigatórios (NOT NULL na tabela): papel, nome_completo, email.
  it.each(["papel", "nome_completo", "email"] as const)(
    "rejeita ausência do campo obrigatório '%s'",
    (campoObrigatorio) => {
      const linha = { ...LINHA_VALIDA };
      delete (linha as Record<string, unknown>)[campoObrigatorio];
      const resultado = linhaCadastroPllSchema.safeParse(linha);
      expect(resultado.success).toBe(false);
    }
  );

  it("rejeita nome_completo vazio", () => {
    const resultado = linhaCadastroPllSchema.safeParse({ ...LINHA_VALIDA, nome_completo: "   " });
    expect(resultado.success).toBe(false);
  });

  it("rejeita email malformado", () => {
    const resultado = linhaCadastroPllSchema.safeParse({ ...LINHA_VALIDA, email: "nao-e-email" });
    expect(resultado.success).toBe(false);
  });

  it("normaliza email para minúsculas (ck_cadastro_email: lower(btrim(email)))", () => {
    const resultado = linhaCadastroPllSchema.safeParse({ ...LINHA_VALIDA, email: "Fulana@EXAMPLE.com" });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.email).toBe("fulana@example.com");
  });

  it("rejeita papel fora de mentorado/mentor", () => {
    const resultado = linhaCadastroPllSchema.safeParse({ ...LINHA_VALIDA, papel: "coordenador" });
    expect(resultado.success).toBe(false);
  });

  // Cada um dos 25 campos do Anexo A: válido (LINHA_VALIDA já cobre) + inválido.
  const CASOS_INVALIDOS: Array<[campo: keyof typeof LINHA_VALIDA, valorInvalido: unknown]> = [
    ["papel", "coordenador"],
    ["nome_completo", ""],
    ["dt_nascimento", 12345],
    ["email", "nao-e-email"],
    ["telefone", "N/A"],
    ["identidade_genero", "Não informado"],
    ["orientacao_sexual", "N/A"],
    ["cor_raca", ""],
    ["deficiencias", "Não coletado"],
    ["partido_filiado", "N/A"],
    ["tempo_na_politica", "Pendente de Atualização"],
    ["conhecia_legisla", "sim"],
    ["nome_parlamentar", "N/A"],
    ["cor_raca_parlamentar", ""],
    ["partido_parlamentar", "N/A"],
    ["estado_eleicao", "SPX"],
    ["cargos_anteriores", "N/A"],
    ["mandatos_anteriores", "Nao se aplica"],
    ["rede_social", "N/A"],
    ["nota_educacao", 6],
    ["nota_seguranca_publica", 0],
    ["nota_modernizacao_estado", -1],
    ["nota_clima", 5.5],
    ["outras_pautas", ["Pauta Inventada"]],
    ["especifique_pauta", "N/A"],
  ];

  it.each(CASOS_INVALIDOS)("rejeita valor inválido para '%s': %j", (campo, valorInvalido) => {
    const resultado = linhaCadastroPllSchema.safeParse({ ...LINHA_VALIDA, [campo]: valorInvalido });
    expect(resultado.success).toBe(false);
  });

  it("aceita estado_eleicao minúsculo e normaliza para maiúsculo (ex.: 'sp' -> 'SP')", () => {
    const resultado = linhaCadastroPllSchema.safeParse({ ...LINHA_VALIDA, estado_eleicao: "sp" });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.estado_eleicao).toBe("SP");
  });

  it("aceita outras_pautas com múltiplas opções da lista fixa (D-5)", () => {
    const resultado = linhaCadastroPllSchema.safeParse({
      ...LINHA_VALIDA,
      outras_pautas: ["Saúde", "Tecnologia", "Economia"],
    });
    expect(resultado.success).toBe(true);
  });

  // PF2-02 (.specs/features/pente-fino-2026-09-23/spec.md) AC1/AC2/AC3.
  describe("telefone", () => {
    it("rejeita telefone com 12 dígitos (caso relatado: '191919191919')", () => {
      const resultado = linhaCadastroPllSchema.safeParse({ ...LINHA_VALIDA, telefone: "191919191919" });
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].message).toBe("telefone deve ter 10 ou 11 dígitos (DDD + fixo ou celular)");
      }
    });

    it("rejeita telefone com menos de 10 dígitos", () => {
      const resultado = linhaCadastroPllSchema.safeParse({ ...LINHA_VALIDA, telefone: "119999" });
      expect(resultado.success).toBe(false);
    });

    it("aceita telefone com 10 dígitos (DDD + fixo)", () => {
      const resultado = linhaCadastroPllSchema.safeParse({ ...LINHA_VALIDA, telefone: "1933334444" });
      expect(resultado.success).toBe(true);
    });

    it("aceita telefone com 11 dígitos (DDD + celular)", () => {
      const resultado = linhaCadastroPllSchema.safeParse({ ...LINHA_VALIDA, telefone: "11999999999" });
      expect(resultado.success).toBe(true);
    });

    it("aceita telefone formatado com parênteses/traço/espaço, contando só os dígitos", () => {
      const resultado = linhaCadastroPllSchema.safeParse({ ...LINHA_VALIDA, telefone: "(19) 1919-1919" });
      expect(resultado.success).toBe(true);
    });

    it("telefone formatado com contagem de dígitos errada continua rejeitado (edge case: máscara não isenta a regra)", () => {
      const resultado = linhaCadastroPllSchema.safeParse({ ...LINHA_VALIDA, telefone: "(19) 1919-191919" });
      expect(resultado.success).toBe(false);
    });

    it("telefone ausente continua aceito, sem regressão (campo não obrigatório)", () => {
      const linha = { ...LINHA_VALIDA } as Record<string, unknown>;
      delete linha.telefone;
      const resultado = linhaCadastroPllSchema.safeParse(linha);
      expect(resultado.success).toBe(true);
    });

    it("telefone null continua aceito, sem regressão", () => {
      const resultado = linhaCadastroPllSchema.safeParse({ ...LINHA_VALIDA, telefone: null });
      expect(resultado.success).toBe(true);
    });
  });
});

describe("validarLinhasCadastroPll", () => {
  it("PLL-CP-01: um lote todo válido retorna todas as linhas em `validas`, sem erros", () => {
    const linhaB = { ...LINHA_VALIDA, email: "outra@example.com" };
    const resultado = validarLinhasCadastroPll([LINHA_VALIDA, linhaB]);
    expect(resultado.erros).toEqual([]);
    expect(resultado.validas).toHaveLength(2);
    expect(resultado.validas.map((l) => l.email)).toEqual(["fulana@example.com", "outra@example.com"]);
  });

  // PLL-CP-02: "SHALL rejeitar a importação inteira com a lista de erros por
  // coluna/linha -- nunca importar parcialmente sem avisar o que ficou de fora".
  it("PLL-CP-02: uma linha inválida invalida o LOTE INTEIRO (validas fica vazio)", () => {
    const linhaInvalida = { ...LINHA_VALIDA, email: "outra@example.com", papel: "invalido" };
    const resultado = validarLinhasCadastroPll([LINHA_VALIDA, linhaInvalida]);
    expect(resultado.validas).toEqual([]);
    expect(resultado.erros.length).toBeGreaterThan(0);
  });

  it("PLL-CP-02: o erro identifica a linha (1-based) e o campo que falhou", () => {
    const linhaInvalida = { ...LINHA_VALIDA, email: "outra@example.com", nota_educacao: 9 };
    const resultado = validarLinhasCadastroPll([LINHA_VALIDA, linhaInvalida]);
    const erroNota = resultado.erros.find((e) => e.campo === "nota_educacao");
    expect(erroNota).toBeDefined();
    expect(erroNota?.linha).toBe(2);
  });

  // Edge case da spec.md: "WHEN a planilha tem uma linha com e-mail duplicado
  // dentro do MESMO ARQUIVO THEN o sistema SHALL rejeitar a importação
  // inteira, apontando as linhas em conflito".
  it("edge case: 2 linhas com o mesmo e-mail no lote rejeitam com os índices das DUAS linhas na mensagem", () => {
    const linha1 = { ...LINHA_VALIDA, email: "duplicado@example.com" };
    const linha2 = { ...LINHA_VALIDA, nome_completo: "Outra Pessoa", email: "duplicado@example.com" };
    const resultado = validarLinhasCadastroPll([linha1, linha2]);
    expect(resultado.validas).toEqual([]);
    const errosDuplicidade = resultado.erros.filter((e) => e.campo === "email");
    expect(errosDuplicidade).toHaveLength(2);
    expect(errosDuplicidade.map((e) => e.linha).sort()).toEqual([1, 2]);
    for (const erro of errosDuplicidade) {
      expect(erro.mensagem).toContain("1");
      expect(erro.mensagem).toContain("2");
      expect(erro.mensagem).toContain("duplicado@example.com");
    }
  });

  it("e-mail duplicado é detectado após a normalização para minúsculas (mesma pessoa, capitalização diferente)", () => {
    const linha1 = { ...LINHA_VALIDA, email: "Duplicado@Example.com" };
    const linha2 = { ...LINHA_VALIDA, nome_completo: "Outra Pessoa", email: "duplicado@example.com" };
    const resultado = validarLinhasCadastroPll([linha1, linha2]);
    expect(resultado.validas).toEqual([]);
    expect(resultado.erros.some((e) => e.campo === "email")).toBe(true);
  });

  it("lote vazio retorna validas e erros vazios", () => {
    const resultado = validarLinhasCadastroPll([]);
    expect(resultado.validas).toEqual([]);
    expect(resultado.erros).toEqual([]);
  });
});

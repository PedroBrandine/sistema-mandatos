import { describe, it, expect } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: ficha-mandato-contrato T10 Done-when
// (.specs/features/ficha-mandato-contrato/tasks.md), migration
// 20260916152329_ficha_seed_agenda_tematica.sql -- spec.md Anexo B (30
// temas, fecha CAT-16 por A-06) e AC4 de "P1 Informações Gerais do mandato"
// ("o seletor de áreas temáticas... lista os 30 temas do seed, ordenados por
// ordem").
//
// Contagem exata e valores exatos -- não só "não está vazio" (task
// instruction).

const ESPERADOS = [
  "Educação",
  "Saúde",
  "Assistência e Desenvolvimento Social",
  "Segurança Pública",
  "Justiça e Cidadania",
  "Direitos Humanos",
  "Meio Ambiente e Clima",
  "Mulheres",
  "Igualdade Racial",
  "LGBTQIA+",
  "Infância e Juventude",
  "Pessoa com Deficiência",
  "Povos Indígenas e Comunidades Tradicionais",
  "Trabalho, Emprego e Renda",
  "Cidades, Mobilidade e Moradia",
  "Cultura",
  "Esporte e Lazer",
  "Ciência, Tecnologia e Inovação",
  "Democracia e Reforma Política",
  "Transparência e Controle Social",
  "Pessoa Idosa",
  "Agricultura Familiar e Segurança Alimentar",
  "Economia e Desenvolvimento Produtivo",
  "Tributação e Justiça Fiscal",
  "Saneamento e Recursos Hídricos",
  "Energia e Transição Energética",
  "Saúde Mental",
  "Migração e Refúgio",
  "Proteção e Bem-Estar Animal",
  "Defesa do Consumidor",
];

describe("ficha-mandato-contrato T10 -- seed de 30 agendas temáticas (fecha CAT-16)", () => {
  it("ref_agenda_tematica tem exatamente 30 linhas, ordem 1..30 e os nomes do Anexo B, nesta ordem", async () => {
    const rows = await runSql<{ nome: string; ordem: number; ativo: boolean }>(`
      SELECT nome, ordem, ativo FROM ref_agenda_tematica ORDER BY ordem;
    `);
    expect(rows).toHaveLength(30);
    expect(rows.map((r) => r.ordem)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(rows.map((r) => r.nome)).toEqual(ESPERADOS);
    for (const row of rows) {
      expect(row.ativo, row.nome).toBe(true);
    }
  });

  it("ON CONFLICT (nome) DO NOTHING: reaplicar o INSERT não duplica nem altera a contagem", async () => {
    await runSql(`
      INSERT INTO ref_agenda_tematica (nome, ordem) VALUES ('Educação', 1), ('Saúde', 2)
      ON CONFLICT (nome) DO NOTHING;
    `);
    const [{ total }] = await runSql<{ total: number }>(`SELECT count(*)::int AS total FROM ref_agenda_tematica;`);
    expect(total).toBe(30);
  });
});

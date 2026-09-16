import { describe, it, expect } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: ficha-mandato-contrato T13 Done-when
// (.specs/features/ficha-mandato-contrato/tasks.md), migration
// 20260916153258_ficha_schema_campos_tipos.sql -- design.md "Contrato de
// ref_tipo_registro.schema_campos" e spec.md Anexo C (FMC-16, FMC-17,
// FMC-34):
//  - cada um dos 9 tipos tem o contrato {"versao": 1, "campos": [...]}, com a
//    lista exata de chave/tipo do Anexo C.
//  - tipos sem campo extra ficam "campos": [] (declarado vazio), não {}.
//  - organograma NÃO é seedado (B-02) -- schema_campos permanece o default
//    '{}' (não declarado).
//  - sprint.qtd_prevista = 4.

interface Campo {
  chave: string;
  tipo: string;
}

async function schemaCamposDoTipo(codigo: string): Promise<{ versao: number; campos: Campo[] } | Record<string, never>> {
  const [{ schema_campos }] = await runSql<{ schema_campos: { versao: number; campos: Campo[] } | Record<string, never> }>(`
    SELECT schema_campos FROM ref_tipo_registro WHERE codigo = '${codigo}';
  `);
  return schema_campos;
}

function chavesETipos(campos: Campo[]): { chave: string; tipo: string }[] {
  return campos.map((c) => ({ chave: c.chave, tipo: c.tipo }));
}

describe("ficha-mandato-contrato T13 -- schema_campos dos 9 tipos de registro + qtd_prevista de sprint", () => {
  it("pontape: 1 campo link (termo_assinado)", async () => {
    const sc = (await schemaCamposDoTipo("pontape")) as { versao: number; campos: Campo[] };
    expect(sc.versao).toBe(1);
    expect(chavesETipos(sc.campos)).toEqual([{ chave: "termo_assinado", tipo: "link" }]);
  });

  it("comite_politico: 1 campo link (mapa_politico)", async () => {
    const sc = (await schemaCamposDoTipo("comite_politico")) as { versao: number; campos: Campo[] };
    expect(sc.versao).toBe(1);
    expect(chavesETipos(sc.campos)).toEqual([{ chave: "mapa_politico", tipo: "link" }]);
  });

  it("escuta_diagnostica: 1 campo link (escuta_diagnostica)", async () => {
    const sc = (await schemaCamposDoTipo("escuta_diagnostica")) as { versao: number; campos: Campo[] };
    expect(sc.versao).toBe(1);
    expect(chavesETipos(sc.campos)).toEqual([{ chave: "escuta_diagnostica", tipo: "link" }]);
  });

  it("imersao: local (leitura_encontro) + 4 links + 1 arquivo, 6 campos no total", async () => {
    const sc = (await schemaCamposDoTipo("imersao")) as { versao: number; campos: Campo[] };
    expect(sc.versao).toBe(1);
    expect(chavesETipos(sc.campos)).toEqual([
      { chave: "local", tipo: "leitura_encontro" },
      { chave: "cronograma", tipo: "link" },
      { chave: "pre_planejamento", tipo: "link" },
      { chave: "mural", tipo: "link" },
      { chave: "planilha_monitoramento", tipo: "link" },
      { chave: "fotos", tipo: "arquivo" },
    ]);
  });

  it("imersao: planilha_monitoramento mapeia para ck_artefato_tipo='outro' (A-19); fotos fica 'em_desenvolvimento' (FMC-22)", async () => {
    const sc = (await schemaCamposDoTipo("imersao")) as { versao: number; campos: (Campo & { artefato_tipo?: string; estado?: string })[] };
    const porChave = Object.fromEntries(sc.campos.map((c) => [c.chave, c]));
    expect(porChave["planilha_monitoramento"].artefato_tipo).toBe("outro");
    expect(porChave["fotos"].estado).toBe("em_desenvolvimento");
  });

  it("sprint: nenhum campo extra, mas 'campos' é declarado ([]), não '{}' (não declarado)", async () => {
    const sc = (await schemaCamposDoTipo("sprint")) as { versao: number; campos: Campo[] };
    expect(sc.versao).toBe(1);
    expect(sc.campos).toEqual([]);
  });

  it("diagnostico_organograma: adequacoes (texto_longo) + organograma (link)", async () => {
    const sc = (await schemaCamposDoTipo("diagnostico_organograma")) as { versao: number; campos: Campo[] };
    expect(sc.versao).toBe(1);
    expect(chavesETipos(sc.campos)).toEqual([
      { chave: "adequacoes", tipo: "texto_longo" },
      { chave: "organograma", tipo: "link" },
    ]);
  });

  it("monitoramento: nenhum campo extra, declarado vazio", async () => {
    const sc = (await schemaCamposDoTipo("monitoramento")) as { versao: number; campos: Campo[] };
    expect(sc.versao).toBe(1);
    expect(sc.campos).toEqual([]);
  });

  it("legisla_aliada: nenhum campo extra, declarado vazio", async () => {
    const sc = (await schemaCamposDoTipo("legisla_aliada")) as { versao: number; campos: Campo[] };
    expect(sc.versao).toBe(1);
    expect(sc.campos).toEqual([]);
  });

  it("replicacao: 1 campo link (material_replicacao)", async () => {
    const sc = (await schemaCamposDoTipo("replicacao")) as { versao: number; campos: Campo[] };
    expect(sc.versao).toBe(1);
    expect(chavesETipos(sc.campos)).toEqual([{ chave: "material_replicacao", tipo: "link" }]);
  });

  it("organograma: NÃO é seedado (B-02) -- schema_campos permanece o default '{}', ativo=false", async () => {
    const [row] = await runSql<{ schema_campos: Record<string, never>; ativo: boolean }>(`
      SELECT schema_campos, ativo FROM ref_tipo_registro WHERE codigo = 'organograma';
    `);
    expect(row.schema_campos).toEqual({});
    expect(row.ativo).toBe(false);
  });

  it("sprint.qtd_prevista = 4 (FMC-34); nome 'Reunião Semanal' já vinha de TIP-01, não reescrito", async () => {
    const [row] = await runSql<{ nome: string; qtd_prevista: number }>(`
      SELECT nome, qtd_prevista FROM ref_tipo_registro WHERE codigo = 'sprint';
    `);
    expect(row.qtd_prevista).toBe(4);
    expect(row.nome).toBe("Reunião Semanal");
  });
});

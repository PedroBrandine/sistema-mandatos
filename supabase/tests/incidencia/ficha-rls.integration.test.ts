import { describe, it, expect } from "vitest";
import { runSql } from "../helpers/sql";

// Spec anchor: ficha-mandato-contrato T7 Done-when
// (.specs/features/ficha-mandato-contrato/tasks.md), migration
// 20260916150213_ficha_rls.sql -- design.md "Code Reuse Analysis" > "Padrões
// a replicar verbatim":
//  - fat_artefato: p_por_contrato (id_contrato próprio), mesmo padrão de
//    fat_encontro/fat_insight/fat_fato_gerador
//    (20260813192341_incidencia_encontros_rls.sql).
//  - rel_registro_participante: p_heranca via EXISTS contra fat_registro
//    (que já tem p_por_contrato + FORCE RLS desde a mesma migration de
//    incidencia).
//  - rel_mandato_agenda_tematica: p_heranca pela cadeia
//    mandato -> contratante -> contrato, mesmo predicado de dim_mandato em
//    0011_fundacao_rls.sql.
//  - USING e WITH CHECK explícitos nas 3 (nunca FOR ALL reaproveitando só o
//    USING -- lição FND-USR-02).
//
// spec.md, Sweep de dimensões implícitas: "FMC-35 -- RLS em fat_artefato,
// rel_mandato_agenda_tematica e ref_nivel_dimensao_gip, no padrão AD-030/
// AD-001".
//
// Achado confirmado ANTES de escrever este arquivo (consulta direta via
// `supabase db query --linked`, ver Post-Gate Review do commit): nenhuma role
// legisla_* (nem admin/gestora) tem GRANT de nenhum verbo nas 3 tabelas ainda
// -- "ALL TABLES IN SCHEMA public" só cobre o que existia no momento do
// último GRANT em bloco, e nenhuma migration de T2/T3/T4 (que criaram estas
// tabelas) reemitiu esse GRANT. Reemitir é o escopo de T8 (AD-025), que a
// própria tasks.md instrui a testar "no arquivo de T7" -- por isso este
// arquivo cobre só a ESTRUTURA da RLS (pg_policies/pg_class, via service_role
// que não passa pelo GRANT de role) e T8 adiciona os testes de
// comportamento (usuário com/sem vínculo, admin/gestora) que só fazem
// sentido depois que o GRANT existir. Sem isso, um teste de comportamento pré-
// T8 falharia com "permission denied for table" para QUALQUER role, inclusive
// admin/gestora -- confundindo ausência de GRANT com falha de RLS.

interface PolicyRow {
  tablename: string;
  policyname: string;
  qual: string | null;
  with_check: string | null;
}

describe("ficha-mandato-contrato T7 -- RLS de fat_artefato/rel_registro_participante/rel_mandato_agenda_tematica", () => {
  it("fat_artefato: ENABLE + FORCE ROW LEVEL SECURITY ativos", async () => {
    const [row] = await runSql<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relname = 'fat_artefato';
    `);
    expect(row.relrowsecurity).toBe(true);
    expect(row.relforcerowsecurity).toBe(true);
  });

  it("rel_registro_participante: ENABLE + FORCE ROW LEVEL SECURITY ativos", async () => {
    const [row] = await runSql<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relname = 'rel_registro_participante';
    `);
    expect(row.relrowsecurity).toBe(true);
    expect(row.relforcerowsecurity).toBe(true);
  });

  it("rel_mandato_agenda_tematica: ENABLE + FORCE ROW LEVEL SECURITY ativos", async () => {
    const [row] = await runSql<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(`
      SELECT relrowsecurity, relforcerowsecurity FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relname = 'rel_mandato_agenda_tematica';
    `);
    expect(row.relrowsecurity).toBe(true);
    expect(row.relforcerowsecurity).toBe(true);
  });

  it("fat_artefato: policy p_por_contrato com USING e WITH CHECK explícitos, filtrando por id_contrato/carteira", async () => {
    const [row] = await runSql<PolicyRow>(`
      SELECT tablename, policyname, qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'fat_artefato';
    `);
    expect(row.policyname).toBe("p_por_contrato");
    expect(row.qual).not.toBeNull();
    expect(row.with_check).not.toBeNull();
    expect(row.qual).toContain("contratos_do_usuario");
    expect(row.with_check).toContain("contratos_do_usuario");
  });

  it("rel_registro_participante: policy p_heranca com USING e WITH CHECK explícitos, herdando de fat_registro", async () => {
    const [row] = await runSql<PolicyRow>(`
      SELECT tablename, policyname, qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'rel_registro_participante';
    `);
    expect(row.policyname).toBe("p_heranca");
    expect(row.qual).not.toBeNull();
    expect(row.with_check).not.toBeNull();
    expect(row.qual).toContain("fat_registro");
    expect(row.with_check).toContain("fat_registro");
  });

  it("rel_mandato_agenda_tematica: policy p_heranca com USING e WITH CHECK explícitos, herdando pela cadeia mandato->contratante->contrato", async () => {
    const [row] = await runSql<PolicyRow>(`
      SELECT tablename, policyname, qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'rel_mandato_agenda_tematica';
    `);
    expect(row.policyname).toBe("p_heranca");
    expect(row.qual).not.toBeNull();
    expect(row.with_check).not.toBeNull();
    expect(row.qual).toContain("dim_mandato");
    expect(row.qual).toContain("fat_contrato");
    expect(row.with_check).toContain("dim_mandato");
    expect(row.with_check).toContain("fat_contrato");
  });

  it("fat_artefato: predicado permite bypass de admin/gestora nos dois lados (USING e WITH CHECK)", async () => {
    const [row] = await runSql<PolicyRow>(`
      SELECT qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'fat_artefato';
    `);
    expect(row.qual).toContain("papel_atual");
    expect(row.with_check).toContain("papel_atual");
  });

  it("rel_mandato_agenda_tematica: predicado permite bypass de admin/gestora nos dois lados (USING e WITH CHECK)", async () => {
    const [row] = await runSql<PolicyRow>(`
      SELECT qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'rel_mandato_agenda_tematica';
    `);
    expect(row.qual).toContain("papel_atual");
    expect(row.with_check).toContain("papel_atual");
  });

  it("rel_registro_participante: USING e WITH CHECK usam o mesmo predicado de herança (p_heranca não distingue leitura de escrita)", async () => {
    const [row] = await runSql<PolicyRow>(`
      SELECT qual, with_check FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'rel_registro_participante';
    `);
    expect(row.qual).toBe(row.with_check);
  });
});

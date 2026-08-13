# Incidência & Encontros Context

**Gathered:** 2026-08-13
**Spec:** `.specs/features/incidencia-encontros/spec.md`
**Status:** ✅ Ready for design — os 4 pontos + os 2 achados novos (surgidos ao receber o CSV)
foram confirmados ao vivo com Pedro em duas rodadas.

---

## Feature Boundary

Camada de Incidência (Registro, Insight, Fato Gerador, IIP — AD-014) + Encontros (OPR-03), extraída
verbatim de `docs/schema_sistema.sql` (AD-008): `fat_encontro`+`rel_encontro_participante`,
`fat_registro`, `fat_insight`+`rel_insight_origem`, `fat_fato_gerador`+`rel_fato_origem`,
`mv_iip_contrato`, os 2 triggers de validação de vínculo (produto↔registro, contrato↔insight) — e a
tarefa obrigatória de substituir `vw_carteira` reduzida (AD-032) pela versão completa quando
`mv_iip_contrato`/`fat_registro` existirem.

---

## Implementation Decisions

### `ref_tipologia` — conteúdo real, não placeholder

- Pedro anexou `docs/DB_Fatos_Geradores - Ref_Tipologias.csv` (51 linhas, dado de negócio real e
  aprovado — mesmo tratamento dos catálogos já seedados na Trilha C). Seed verbatim numa migration
  nova; **não** é conteúdo provisório/placeholder.
- Achado ao ler o CSV: usa um 4º nível "Máximo" que `ref_nivel_iip` não tinha (só baixo/médio/alto
  seedados pela Trilha C). Pedro confirmou adicionar `codigo='maximo'`, `valor=4`, `ordem=4`.
- Achado ao ler o CSV: não traz `id_indicador`/peso — toda `ref_tipologia` nasce com
  `id_indicador = NULL`. Pedro confirmou **não** seedar nenhum indicador provisório: `nr_fatos`
  conta certo, `iip_provisorio` fica `NULL` (não um número parcial) até `ref_indicador` ganhar
  conteúdo real (CAT-16, sem data). UI mostra "sem dado suficiente" nesse caso — mesmo padrão
  AD-005 já usado pela mediana de `vw_ciclo_etapa`.
- Mapeamento `Preditor_1`/`Preditor_2` do CSV (rótulos curtos: "Priorizar Agenda", "Pautar
  Debates", "Protagonizar Espaços", "Construir Partido", "Articular Entrega") para
  `ref_preditor.nome` (rótulos completos já seedados pela Trilha C) é 1:1 por tema/ordem — não
  criar preditor novo, só mapear na migration de seed. `"—"` no CSV = `NULL` (sem preditor 2).

### IIP na tela

- Card na ficha do contrato (`ficha-contrato-chrome.tsx`), perto dos botões
  "Registrar Insight"/"Registrar Fato Gerador" — "IIP (provisório): X · Y fatos geradores",
  visível ao abrir qualquer contrato. Não é o painel G3-G6 completo (fora de escopo, roadmap §7).

### Refresh de `mv_iip_contrato`

- Síncrono ao abrir a tela que exibe o IIP (o card acima) — mesmo padrão de
  `app.recalcula_pendentes` (`planejamento-planilha-monitoramento`). Sem `pg_cron` (não
  provisionado no projeto).

### Onde vivem as novas ações de UI

- Os botões "Registrar Insight"/"Registrar Fato Gerador" do chrome (hoje `toast("Em
  desenvolvimento")`) passam a abrir um `Dialog` de verdade, mesmo padrão de Dialog+React Hook
  Form já em uso em `objetivo-form.tsx` (`planejamento-planilha-monitoramento`).
- Registro ganha um botão "Registrar" dentro da aba de etapa (`etapas/[codigo]/page.tsx`), abrindo
  o mesmo padrão de Dialog — lista de Registros da etapa abaixo da tabela de régua já existente.
- Encontro ganha aba própria "Encontros" no chrome (`RouteTabs`), com lista de Encontros do
  contrato + Dialog de criação/edição de status.

### Agent's Discretion

- Layout interno de cada Dialog (ordem de campos, agrupamento visual) — desde que sigam o padrão
  visual já estabelecido (shadcn/ui, `objetivo-form.tsx` como referência mais próxima).
- Onde exatamente dentro do card de IIP mostrar `nr_fatos`/`dt_ultimo_registro` (mesmo card ou
  linha secundária) — não especificado pelo Pedro, fica a critério do Design.

### Declined / Undiscussed Gray Areas → Assumptions

Nenhuma — os 4 pontos + os 2 achados novos (surgidos ao ler o CSV) foram todos discutidos ao vivo
com Pedro, em duas rodadas (2026-08-13). Nenhuma gray area foi declinada ou ficou sem dono. Se
novas surgirem em Design, entram aqui como adendo antes de Tasks.

---

## Specific References

- `objetivo-form.tsx` (`src/frontend/components/planejamento/`) é a referência explícita de
  Dialog+RHF para os formulários novos desta feature.
- Card de IIP replica o padrão visual dos botões já existentes no chrome (mesma área, mesmo
  tamanho de componente) — não uma seção nova e destacada.

---

## Deferred Ideas

- Painel G3-G6 completo da Visão Gerencial (IIP em série histórica, GIP) — feature futura,
  roadmap §7 (Saída). Fora de escopo desta feature; o card do contrato é a única exposição
  desta fatia.
- Aba "Incidência" única concentrando Registro/Insight/Fato Gerador/Encontro numa lista — opção
  descartada em favor de manter os pontos de entrada já existentes (chrome) + aba própria só para
  Encontros, que tem fluxo de status (planejado→realizado) diferente dos outros três.

---

## Pendências antes de Design

Nenhuma. Todas as decisões (4 pontos originais + 2 achados do CSV) estão fechadas em
`spec.md` → Assumptions & Open Questions. Pronto para Design.

// PLR-07 (.specs/features/planejamento-estrategico-redesenho/spec.md). Fonte única de
// verdade de papel×modo -> capacidades, definida em design.md ("PERMISSOES -- fonte única
// de verdade"). Nenhum componente do redesenho checa `papel === "..."` diretamente -- todos
// recebem `permissoes: PermissoesModo` (e, quando precisam do papel bruto só para exibição,
// recebem `papel` também, mas nunca decidem capacidade a partir dele).
//
// Achado 2 (context.md): papel `legisla` foi descartado -- Interno Legisla continua
// `papel_global='gestora'` (AD-018 inalterada); o modo Ler é a escolha de UI que substitui a
// distinção, disponível para qualquer `gestora`. `admin` replica o perfil de `gestora` nesta
// tela (impersonation é gap de plataforma, fora de escopo -- Achado 5).

export type PapelPlanejamento = "gestora" | "mentor" | "assessor" | "admin";
export type ModoPlanejamento = "construir" | "monitorar" | "ler";

export interface PermissoesModo {
  modosDisponiveis: ModoPlanejamento[];
  modoPadrao: ModoPlanejamento;
  crudHierarquia: boolean; // criar/editar Objetivo/Meta (modal)
  editaPctTodasAsMetas: boolean; // Mentor/Gestora/Admin: qualquer Meta da carteira/contrato
  editaPctSóMetasProprias: boolean; // Assessor: só fat_meta.id_usuario_responsavel = auth.uid()
  veIip: boolean; // placeholder enquanto incidencia-encontros não conclui
  veIncidencia: boolean; // idem
  veAuditoria: boolean;
  veColunaResponsavel: boolean;
}

export const PERMISSOES: Record<PapelPlanejamento, PermissoesModo> = {
  gestora: {
    modosDisponiveis: ["construir", "monitorar", "ler"],
    modoPadrao: "monitorar",
    crudHierarquia: true,
    editaPctTodasAsMetas: true,
    editaPctSóMetasProprias: false,
    veIip: true,
    veIncidencia: true,
    veAuditoria: true,
    veColunaResponsavel: true,
  },
  mentor: {
    modosDisponiveis: ["monitorar", "ler"],
    modoPadrao: "monitorar",
    crudHierarquia: false,
    editaPctTodasAsMetas: true,
    editaPctSóMetasProprias: false,
    veIip: true,
    veIncidencia: true,
    veAuditoria: false,
    veColunaResponsavel: true,
  },
  assessor: {
    modosDisponiveis: ["monitorar"],
    modoPadrao: "monitorar",
    crudHierarquia: false,
    editaPctTodasAsMetas: false,
    editaPctSóMetasProprias: true,
    veIip: false,
    veIncidencia: false,
    veAuditoria: false,
    veColunaResponsavel: false,
  },
  admin: {
    modosDisponiveis: ["construir", "monitorar", "ler"],
    modoPadrao: "monitorar",
    crudHierarquia: true,
    editaPctTodasAsMetas: true,
    editaPctSóMetasProprias: false,
    veIip: true,
    veIncidencia: true,
    veAuditoria: true,
    veColunaResponsavel: true,
  },
};

// veIip/veIncidencia ficam true no objeto (é o alvo final, já confirmado pelo GRANT aprovado
// -- AD-008), mas os componentes que os consomem (indicador de IIP no header, contador de
// incidência na Meta) renderizam placeholder fixo "em desenvolvimento" nesta feature,
// independente do valor aqui -- ver ContextoEstrategico/PlanejamentoHeader (Fase 2). Quando
// incidencia-encontros/formularios-produto concluírem, só o componente de leitura muda, não
// este objeto.

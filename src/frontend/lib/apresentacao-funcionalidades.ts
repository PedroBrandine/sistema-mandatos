// Conteúdo da tela "Apresentação - Funcionalidades" (`/apresentacao-funcionalidades`).
//
// Dado estático, escrito à mão -- não vem do Supabase. Este arquivo descreve o
// PROJETO (o que já foi entregue no código, o que falta), não um número de
// negócio do sistema (mandato, contrato, indicador) -- por isso não está sujeito
// a AD-003 (Saída só lê de view/MV): não existe view para "quantas features
// foram entregues", essa informação vive em `.specs/roadmap.md` e
// `.specs/STATE.md`, e este arquivo é a tradução manual disso para uma tela de
// apresentação. Precisa ser atualizado à mão sempre que o roadmap avançar --
// não há como derivar automaticamente sem uma fonte estruturada, que não existe.
//
// Levantamento em 2026-09-22, a partir de `.specs/roadmap.md` (estado por
// camada de dado) e `.specs/STATE.md` (decisões AD-001..AD-064 e handoffs de
// feature).
export const ATUALIZADO_EM = "2026-09-22";

export type StatusCamada = "completo" | "parcial" | "pendente";

export interface CamadaDado {
  nome: string;
  status: StatusCamada;
  detalhe: string;
}

// Estado real por camada do modelo de dados aprovado (docs/schema_sistema.sql),
// na ordem de dependência da arquitetura (AD-007): Plataforma/Fundação primeiro,
// Saída por último.
export const CAMADAS_DADO: CamadaDado[] = [
  { nome: "Plataforma", status: "completo", detalhe: "Usuários, vínculos, auditoria" },
  { nome: "Fundação", status: "completo", detalhe: "Mandatos, contratos, coalizões, espelho TSE" },
  { nome: "Catálogos", status: "completo", detalhe: "16/16 tabelas de referência provisionadas" },
  { nome: "Operação", status: "parcial", detalhe: "Régua de etapas e Kanban prontos; formulários de produto ainda não finalizados" },
  { nome: "Planejamento", status: "completo", detalhe: "Objetivo → Meta → Sucesso Mensal, grade editável" },
  { nome: "Incidência", status: "completo", detalhe: "Encontros, registros, insights, fatos geradores, IIP" },
  { nome: "Saída", status: "parcial", detalhe: "Números de Impacto pronto; Visão Gerencial existe mas será revista; falta snapshot mensal e exportação" },
];

export interface ItemEntregue {
  titulo: string;
  descricao: string;
}

export interface BlocoEntregue {
  titulo: string;
  itens: ItemEntregue[];
}

// "O que já foi entregue" -- por módulo de produto, não por camada técnica
// (é assim que quem usa o sistema reconhece o que já pode fazer).
export const ENTREGUE: BlocoEntregue[] = [
  {
    titulo: "Acesso e usuários",
    itens: [
      {
        titulo: "Login interno",
        descricao: "Senha padrão combinada manualmente, para os e-mails já pré-disponibilizados da equipe Legisla",
      },
      { titulo: "4 papéis com permissão no banco", descricao: "Gestora de Mandato, Mentor/Consultor, Assessor, Admin do Sistema" },
    ],
  },
  {
    titulo: "Cadastro",
    itens: [
      { titulo: "Mandato", descricao: "Parlamentar com dado oficial do TSE (cargo, partido, eleição)" },
      { titulo: "Contrato", descricao: "Vínculo Legisla ↔ mandato/coalizão, por produto (Estratégia, PLL, Coalizão)" },
      { titulo: "Coalizão", descricao: "Agrupamento de mandatos" },
      { titulo: "Hub por produto", descricao: "Página inicial com as 4 áreas: Estratégia, PLL, Coalizão, Visão Gerencial" },
    ],
  },
  {
    titulo: "Operação do contrato",
    itens: [
      { titulo: "Régua de etapas", descricao: "Previsto × realizado, atraso calculado automaticamente" },
      { titulo: "Kanban de etapas", descricao: "Arrastar o card grava a transição real, com data e autor" },
    ],
  },
  {
    titulo: "Planejamento Estratégico",
    itens: [
      { titulo: "Hierarquia de metas", descricao: "Objetivo Específico → Meta → Sucesso Mensal" },
      { titulo: "Grade editável", descricao: "Tela de maior uso do Assessor, com atingimento calculado em cascata" },
    ],
  },
  {
    titulo: "Incidência política",
    itens: [
      { titulo: "Encontros, Insights e Fatos Geradores", descricao: "Registro do que acontece em campo" },
      { titulo: "IIP — Índice de Incidência Política", descricao: "Fórmula final fechada em 20/09/2026" },
    ],
  },
  {
    titulo: "Números de Impacto",
    itens: [
      { titulo: "Visão do Mandato e Evolução do GIP", descricao: "Agregados por área cliente, organização inteira" },
    ],
  },
];

export type StatusPendencia = "nao_iniciado" | "em_andamento" | "debito";

export const ROTULO_STATUS_PENDENCIA: Record<StatusPendencia, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  debito: "Débito técnico",
};

export interface ItemFalta {
  titulo: string;
  descricao: string;
  status: StatusPendencia;
}

export interface BlocoFalta {
  titulo: string;
  itens: ItemFalta[];
}

// "O que ainda falta" -- cada item com o status real (não iniciado / em
// andamento / débito já mapeado), para não passar a impressão de que tudo
// pendente está no mesmo estágio.
export const FALTA: BlocoFalta[] = [
  {
    titulo: "Saída (fechamento e exportação)",
    itens: [
      {
        titulo: "Snapshot mensal",
        descricao: "Job que fecha o mês e grava histórico permanente de atingimento/IIP",
        status: "nao_iniciado",
      },
      {
        titulo: "Exportação",
        descricao: "Google Sheets/CSV",
        status: "nao_iniciado",
      },
    ],
  },
  {
    titulo: "Agenda (Estratégia, PLL, Coalizão)",
    itens: [
      {
        titulo: "Telas ainda não conectadas",
        descricao: "Componentes já construídos (calendário, popover, presença), faltando ligar à rota",
        status: "em_andamento",
      },
    ],
  },
  {
    titulo: "Formulários de produto",
    itens: [
      {
        titulo: "Ainda não finalizados",
        descricao: "Preenchimento em campo pelos formulários do produto segue em ajuste",
        status: "em_andamento",
      },
    ],
  },
  {
    titulo: "Visão Gerencial",
    itens: [
      {
        titulo: "Revisão completa da tela",
        descricao: "Indicadores existem e funcionam tecnicamente, mas a tela inteira será revista -- não considerar concluída",
        status: "em_andamento",
      },
    ],
  },
  {
    titulo: "PLL",
    itens: [
      { titulo: "Cadastro de Participantes", descricao: "Spec em rascunho, 5 decisões em aberto", status: "nao_iniciado" },
      { titulo: "Dashboard e Agenda do PLL", descricao: "Spec em rascunho, 1 pendência bloqueante", status: "nao_iniciado" },
    ],
  },
  {
    titulo: "Planejamento Estratégico v2",
    itens: [
      {
        titulo: "Validação formal",
        descricao: "Implementação concluída (26/26 tarefas); falta revisão independente antes de fechar",
        status: "em_andamento",
      },
    ],
  },
  {
    titulo: "Débitos técnicos mapeados",
    itens: [
      {
        titulo: "Revisão dos Tipos de Registro",
        descricao: "Migration escrita e commitada, ainda não aplicada no banco de desenvolvimento",
        status: "debito",
      },
      {
        titulo: "Campo \"Presentes\" em Registro",
        descricao: "Pedido pela operação; modelo de dados hoje não tem onde guardar isso",
        status: "debito",
      },
      {
        titulo: "Controle de acesso de \"Gestão de Usuários\"",
        descricao: "Hoje só esconde o link na interface; não bloqueia a URL direta no banco",
        status: "debito",
      },
      {
        titulo: "Menu de conta na barra superior",
        descricao: "Avatar existe visualmente, sem menu de conta nem logout",
        status: "debito",
      },
    ],
  },
  {
    titulo: "Redesenho visual (Figma)",
    itens: [
      {
        titulo: "Coalizão e PLL",
        descricao: "Ainda não passaram pelo redesenho tela-first (Estratégia já passou, 9 fases concluídas)",
        status: "em_andamento",
      },
      {
        titulo: "Catálogos de levantamento humano",
        descricao: "Agendas temáticas e tipologias, com a área de Monitoramento -- sem data marcada",
        status: "nao_iniciado",
      },
    ],
  },
  {
    titulo: "Acesso",
    itens: [
      {
        titulo: "SSO Google Workspace",
        descricao: "Hoje login por senha combinada manualmente, solução temporária",
        status: "debito",
      },
      {
        titulo: "Convite por contrato",
        descricao: "Fluxo de acesso externo (Mentor/Consultor e Assessor) existe, mas ainda será revisto",
        status: "em_andamento",
      },
    ],
  },
];

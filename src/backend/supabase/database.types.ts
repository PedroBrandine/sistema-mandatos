export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  app: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consumir_convite: {
        Args: { p_nome: string; p_token_hash: string }
        Returns: Json
      }
      contratante_similar: {
        Args: { p_nm_municipio: string; p_nome: string; p_sg_uf: string }
        Returns: {
          id_contratante: number
          nm_municipio: string
          nome: string
          sg_uf: string
        }[]
      }
      contratos_do_usuario: { Args: never; Returns: number[] }
      cria_particoes_log: {
        Args: { p_de: string; p_meses?: number }
        Returns: undefined
      }
      criar_coalizao: {
        Args: {
          p_coalizao: Json
          p_contratante: Json
          p_ignorar_duplicata?: boolean
        }
        Returns: Json
      }
      criar_mandato: {
        Args: {
          p_candidatura?: Json
          p_coalizao?: Json
          p_contratante?: Json
          p_contrato?: Json
          p_id_contratante_existente?: number
          p_ignorar_duplicata?: boolean
          p_mandato?: Json
        }
        Returns: Json
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      emitir_convite: {
        Args: {
          p_areas: string[]
          p_cargo: string
          p_email: string
          p_grau_responsabilidade: string
          p_id_contrato: number
          p_papel: string
          p_token_hash: string
        }
        Returns: number
      }
      f_unaccent: { Args: { "": string }; Returns: string }
      id_usuario: { Args: never; Returns: number }
      id_usuario_sistema: { Args: never; Returns: number }
      instancia_contrato: {
        Args: { p_id_contrato: number }
        Returns: undefined
      }
      marcar_candidatura_vigente: {
        Args: { p_id_vinculo_tse: number }
        Returns: undefined
      }
      normaliza_nome: { Args: { "": string }; Returns: string }
      papel_atual: { Args: never; Returns: string }
      pre_request: { Args: never; Returns: undefined }
      substituir_vinculo: {
        Args: {
          p_areas?: string[]
          p_cargo?: string
          p_grau_responsabilidade?: string
          p_id_usuario_novo: number
          p_id_vinculo_antigo: number
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      convite_contrato: {
        Row: {
          areas: string[] | null
          cargo: string | null
          criado_em: string
          dt_expiracao: string
          dt_uso: string | null
          email: string
          grau_responsabilidade: string | null
          id_contrato: number
          id_convite: number
          id_usuario_convidou: number
          papel_no_contrato: string
          token_hash: string
        }
        Insert: {
          areas?: string[] | null
          cargo?: string | null
          criado_em?: string
          dt_expiracao: string
          dt_uso?: string | null
          email: string
          grau_responsabilidade?: string | null
          id_contrato: number
          id_convite?: number
          id_usuario_convidou: number
          papel_no_contrato: string
          token_hash: string
        }
        Update: {
          areas?: string[] | null
          cargo?: string | null
          criado_em?: string
          dt_expiracao?: string
          dt_uso?: string | null
          email?: string
          grau_responsabilidade?: string | null
          id_contrato?: number
          id_convite?: number
          id_usuario_convidou?: number
          papel_no_contrato?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "convite_contrato_id_contrato_fkey"
            columns: ["id_contrato"]
            isOneToOne: false
            referencedRelation: "fat_contrato"
            referencedColumns: ["id_contrato"]
          },
          {
            foreignKeyName: "convite_contrato_id_usuario_convidou_fkey"
            columns: ["id_usuario_convidou"]
            isOneToOne: false
            referencedRelation: "dim_usuario"
            referencedColumns: ["id_usuario"]
          },
        ]
      }
      convite_tentativa: {
        Row: {
          id_tentativa: number
          ip: unknown
          ocorrido_em: string
        }
        Insert: {
          id_tentativa?: number
          ip: unknown
          ocorrido_em?: string
        }
        Update: {
          id_tentativa?: number
          ip?: unknown
          ocorrido_em?: string
        }
        Relationships: []
      }
      dim_coalizao: {
        Row: {
          agenda_tematica: string[] | null
          classificacao: string | null
          id_coalizao: number
          id_contratante: number
          id_projeto_origem: number | null
          possui_planejamento_proprio: boolean
        }
        Insert: {
          agenda_tematica?: string[] | null
          classificacao?: string | null
          id_coalizao?: number
          id_contratante: number
          id_projeto_origem?: number | null
          possui_planejamento_proprio?: boolean
        }
        Update: {
          agenda_tematica?: string[] | null
          classificacao?: string | null
          id_coalizao?: number
          id_contratante?: number
          id_projeto_origem?: number | null
          possui_planejamento_proprio?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "dim_coalizao_id_contratante_fkey"
            columns: ["id_contratante"]
            isOneToOne: true
            referencedRelation: "dim_contratante"
            referencedColumns: ["id_contratante"]
          },
          {
            foreignKeyName: "dim_coalizao_id_projeto_origem_fkey"
            columns: ["id_projeto_origem"]
            isOneToOne: false
            referencedRelation: "ref_projeto"
            referencedColumns: ["id_projeto"]
          },
        ]
      }
      dim_contratante: {
        Row: {
          atualizado_em: string
          criado_em: string
          id_contratante: number
          id_partido_relacionado: number | null
          localizador_legado: string | null
          nm_municipio: string | null
          nome: string
          nome_normalizado: string | null
          sg_uf: string | null
          tipo_contratante: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id_contratante?: number
          id_partido_relacionado?: number | null
          localizador_legado?: string | null
          nm_municipio?: string | null
          nome: string
          nome_normalizado?: string | null
          sg_uf?: string | null
          tipo_contratante: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id_contratante?: number
          id_partido_relacionado?: number | null
          localizador_legado?: string | null
          nm_municipio?: string | null
          nome?: string
          nome_normalizado?: string | null
          sg_uf?: string | null
          tipo_contratante?: string
        }
        Relationships: [
          {
            foreignKeyName: "dim_contratante_id_partido_relacionado_fkey"
            columns: ["id_partido_relacionado"]
            isOneToOne: false
            referencedRelation: "ref_partido"
            referencedColumns: ["id_partido"]
          },
        ]
      }
      dim_mandato: {
        Row: {
          atualizado_partido_cargo_em: string | null
          confianca: string | null
          ds_genero: string | null
          ds_identidade_genero: string | null
          ds_orientacao_sexual: string | null
          ds_raca: string | null
          espectro_politico: string | null
          fl_pcd: boolean | null
          id_cargo_atual: number | null
          id_contratante: number
          id_mandato: number
          id_mandato_legado: number | null
          id_partido_atual: number | null
          nm_civil: string | null
          nm_social: string | null
          nm_urna: string | null
          nr_titulo_eleitoral: string | null
          origem_partido_cargo: string | null
          potencial_futuro: string | null
          relevancia_politica: string | null
          risco_democratico: string | null
        }
        Insert: {
          atualizado_partido_cargo_em?: string | null
          confianca?: string | null
          ds_genero?: string | null
          ds_identidade_genero?: string | null
          ds_orientacao_sexual?: string | null
          ds_raca?: string | null
          espectro_politico?: string | null
          fl_pcd?: boolean | null
          id_cargo_atual?: number | null
          id_contratante: number
          id_mandato?: number
          id_mandato_legado?: number | null
          id_partido_atual?: number | null
          nm_civil?: string | null
          nm_social?: string | null
          nm_urna?: string | null
          nr_titulo_eleitoral?: string | null
          origem_partido_cargo?: string | null
          potencial_futuro?: string | null
          relevancia_politica?: string | null
          risco_democratico?: string | null
        }
        Update: {
          atualizado_partido_cargo_em?: string | null
          confianca?: string | null
          ds_genero?: string | null
          ds_identidade_genero?: string | null
          ds_orientacao_sexual?: string | null
          ds_raca?: string | null
          espectro_politico?: string | null
          fl_pcd?: boolean | null
          id_cargo_atual?: number | null
          id_contratante?: number
          id_mandato?: number
          id_mandato_legado?: number | null
          id_partido_atual?: number | null
          nm_civil?: string | null
          nm_social?: string | null
          nm_urna?: string | null
          nr_titulo_eleitoral?: string | null
          origem_partido_cargo?: string | null
          potencial_futuro?: string | null
          relevancia_politica?: string | null
          risco_democratico?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dim_mandato_id_cargo_atual_fkey"
            columns: ["id_cargo_atual"]
            isOneToOne: false
            referencedRelation: "ref_cargo"
            referencedColumns: ["id_cargo"]
          },
          {
            foreignKeyName: "dim_mandato_id_contratante_fkey"
            columns: ["id_contratante"]
            isOneToOne: true
            referencedRelation: "dim_contratante"
            referencedColumns: ["id_contratante"]
          },
          {
            foreignKeyName: "dim_mandato_id_partido_atual_fkey"
            columns: ["id_partido_atual"]
            isOneToOne: false
            referencedRelation: "ref_partido"
            referencedColumns: ["id_partido"]
          },
        ]
      }
      dim_planejamento: {
        Row: {
          analise_conjuntura: string | null
          atingimento_desatualizado: boolean
          atualizado_em: string
          criado_em: string
          id_contrato: number
          id_perfil_atuacao: number | null
          id_planejamento: number
          legado: string | null
          objetivo_ano: string | null
          pct_atingimento: number | null
        }
        Insert: {
          analise_conjuntura?: string | null
          atingimento_desatualizado?: boolean
          atualizado_em?: string
          criado_em?: string
          id_contrato: number
          id_perfil_atuacao?: number | null
          id_planejamento?: number
          legado?: string | null
          objetivo_ano?: string | null
          pct_atingimento?: number | null
        }
        Update: {
          analise_conjuntura?: string | null
          atingimento_desatualizado?: boolean
          atualizado_em?: string
          criado_em?: string
          id_contrato?: number
          id_perfil_atuacao?: number | null
          id_planejamento?: number
          legado?: string | null
          objetivo_ano?: string | null
          pct_atingimento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dim_planejamento_id_contrato_fkey"
            columns: ["id_contrato"]
            isOneToOne: true
            referencedRelation: "fat_contrato"
            referencedColumns: ["id_contrato"]
          },
          {
            foreignKeyName: "dim_planejamento_id_perfil_atuacao_fkey"
            columns: ["id_perfil_atuacao"]
            isOneToOne: false
            referencedRelation: "ref_perfil_atuacao"
            referencedColumns: ["id_perfil"]
          },
        ]
      }
      dim_usuario: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          email: string
          id_usuario: number
          nome: string
          papel_global: string
          telefone: string | null
          ultimo_acesso_em: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          email: string
          id_usuario?: number
          nome: string
          papel_global: string
          telefone?: string | null
          ultimo_acesso_em?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          email?: string
          id_usuario?: number
          nome?: string
          papel_global?: string
          telefone?: string | null
          ultimo_acesso_em?: string | null
        }
        Relationships: []
      }
      fat_contrato: {
        Row: {
          atualizado_em: string
          criado_em: string
          dt_fim: string | null
          dt_fim_prevista: string | null
          dt_inicio: string
          id_cargo_no_contrato: number | null
          id_contratante: number
          id_contrato: number
          id_contrato_anterior: number | null
          id_etapa_atual: number | null
          id_partido_no_contrato: number | null
          id_produto: number
          id_projeto: number | null
          localizador_legado: string | null
          motivo_encerramento: string | null
          profundidade_impacto: string | null
          status: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          dt_fim?: string | null
          dt_fim_prevista?: string | null
          dt_inicio: string
          id_cargo_no_contrato?: number | null
          id_contratante: number
          id_contrato?: number
          id_contrato_anterior?: number | null
          id_etapa_atual?: number | null
          id_partido_no_contrato?: number | null
          id_produto: number
          id_projeto?: number | null
          localizador_legado?: string | null
          motivo_encerramento?: string | null
          profundidade_impacto?: string | null
          status: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          dt_fim?: string | null
          dt_fim_prevista?: string | null
          dt_inicio?: string
          id_cargo_no_contrato?: number | null
          id_contratante?: number
          id_contrato?: number
          id_contrato_anterior?: number | null
          id_etapa_atual?: number | null
          id_partido_no_contrato?: number | null
          id_produto?: number
          id_projeto?: number | null
          localizador_legado?: string | null
          motivo_encerramento?: string | null
          profundidade_impacto?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fat_contrato_id_cargo_no_contrato_fkey"
            columns: ["id_cargo_no_contrato"]
            isOneToOne: false
            referencedRelation: "ref_cargo"
            referencedColumns: ["id_cargo"]
          },
          {
            foreignKeyName: "fat_contrato_id_contratante_fkey"
            columns: ["id_contratante"]
            isOneToOne: false
            referencedRelation: "dim_contratante"
            referencedColumns: ["id_contratante"]
          },
          {
            foreignKeyName: "fat_contrato_id_contrato_anterior_fkey"
            columns: ["id_contrato_anterior"]
            isOneToOne: false
            referencedRelation: "fat_contrato"
            referencedColumns: ["id_contrato"]
          },
          {
            foreignKeyName: "fat_contrato_id_partido_no_contrato_fkey"
            columns: ["id_partido_no_contrato"]
            isOneToOne: false
            referencedRelation: "ref_partido"
            referencedColumns: ["id_partido"]
          },
          {
            foreignKeyName: "fat_contrato_id_produto_fkey"
            columns: ["id_produto"]
            isOneToOne: false
            referencedRelation: "ref_produto"
            referencedColumns: ["id_produto"]
          },
          {
            foreignKeyName: "fat_contrato_id_projeto_fkey"
            columns: ["id_projeto"]
            isOneToOne: false
            referencedRelation: "ref_projeto"
            referencedColumns: ["id_projeto"]
          },
        ]
      }
      fat_etapa_contrato: {
        Row: {
          atualizado_em: string
          dt_conclusao: string | null
          dt_inicio: string | null
          dt_prevista_conclusao: string | null
          dt_prevista_inicio: string | null
          id_contrato: number
          id_etapa: number
          id_etapa_contrato: number
          status: string
        }
        Insert: {
          atualizado_em?: string
          dt_conclusao?: string | null
          dt_inicio?: string | null
          dt_prevista_conclusao?: string | null
          dt_prevista_inicio?: string | null
          id_contrato: number
          id_etapa: number
          id_etapa_contrato?: number
          status?: string
        }
        Update: {
          atualizado_em?: string
          dt_conclusao?: string | null
          dt_inicio?: string | null
          dt_prevista_conclusao?: string | null
          dt_prevista_inicio?: string | null
          id_contrato?: number
          id_etapa?: number
          id_etapa_contrato?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fat_etapa_contrato_id_contrato_fkey"
            columns: ["id_contrato"]
            isOneToOne: false
            referencedRelation: "fat_contrato"
            referencedColumns: ["id_contrato"]
          },
          {
            foreignKeyName: "fat_etapa_contrato_id_etapa_fkey"
            columns: ["id_etapa"]
            isOneToOne: false
            referencedRelation: "ref_etapa"
            referencedColumns: ["id_etapa"]
          },
        ]
      }
      log_auditoria: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "log_auditoria_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "dim_usuario"
            referencedColumns: ["id_usuario"]
          },
          {
            foreignKeyName: "log_auditoria_id_usuario_impersonado_fkey"
            columns: ["id_usuario_impersonado"]
            isOneToOne: false
            referencedRelation: "dim_usuario"
            referencedColumns: ["id_usuario"]
          },
        ]
      }
      log_auditoria_2026_07: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      log_auditoria_2026_08: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      log_auditoria_2026_09: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      log_auditoria_2026_10: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      log_auditoria_2026_11: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      log_auditoria_2026_12: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      log_auditoria_2027_01: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      log_auditoria_2027_02: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      log_auditoria_2027_03: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      log_auditoria_2027_04: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      log_auditoria_2027_05: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      log_auditoria_2027_06: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      log_auditoria_2027_07: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      log_auditoria_2027_08: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      log_auditoria_2027_09: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      log_auditoria_2027_10: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      log_auditoria_2027_11: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      log_auditoria_2027_12: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      log_auditoria_default: {
        Row: {
          acao: string
          id_log: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado: number | null
          ocorrido_em: string
          tabela: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          acao: string
          id_log?: number
          id_registro_alvo: number
          id_usuario: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          acao?: string
          id_log?: number
          id_registro_alvo?: number
          id_usuario?: number
          id_usuario_impersonado?: number | null
          ocorrido_em?: string
          tabela?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      ref_agenda_tematica: {
        Row: {
          ativo: boolean
          id_agenda: number
          nome: string
          ordem: number | null
        }
        Insert: {
          ativo?: boolean
          id_agenda?: number
          nome: string
          ordem?: number | null
        }
        Update: {
          ativo?: boolean
          id_agenda?: number
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      ref_cargo: {
        Row: {
          ativo: boolean
          cd_cargo_tse: number | null
          id_cargo: number
          nivel_federativo: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          cd_cargo_tse?: number | null
          id_cargo?: number
          nivel_federativo: string
          nome: string
        }
        Update: {
          ativo?: boolean
          cd_cargo_tse?: number | null
          id_cargo?: number
          nivel_federativo?: string
          nome?: string
        }
        Relationships: []
      }
      ref_dimensao_gip: {
        Row: {
          ativo: boolean
          codigo: string
          id_dimensao: number
          nome: string
          ordem: number
          valor_max: number
          valor_min: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          id_dimensao?: number
          nome: string
          ordem: number
          valor_max?: number
          valor_min?: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          id_dimensao?: number
          nome?: string
          ordem?: number
          valor_max?: number
          valor_min?: number
        }
        Relationships: []
      }
      ref_etapa: {
        Row: {
          codigo: string
          duracao_prevista_dias: number | null
          gera_registro: boolean
          id_etapa: number
          id_produto: number
          nome: string
          ordem: number
        }
        Insert: {
          codigo: string
          duracao_prevista_dias?: number | null
          gera_registro?: boolean
          id_etapa?: number
          id_produto: number
          nome: string
          ordem: number
        }
        Update: {
          codigo?: string
          duracao_prevista_dias?: number | null
          gera_registro?: boolean
          id_etapa?: number
          id_produto?: number
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "ref_etapa_id_produto_fkey"
            columns: ["id_produto"]
            isOneToOne: false
            referencedRelation: "ref_produto"
            referencedColumns: ["id_produto"]
          },
        ]
      }
      ref_formulario: {
        Row: {
          ativo: boolean
          codigo: string
          exige_anexo: boolean
          id_etapa: number
          id_formulario: number
          nome: string
          permite_edicao_aberta: boolean
          respondente: string | null
          schema_campos: Json
          versao: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          exige_anexo?: boolean
          id_etapa: number
          id_formulario?: number
          nome: string
          permite_edicao_aberta?: boolean
          respondente?: string | null
          schema_campos?: Json
          versao?: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          exige_anexo?: boolean
          id_etapa?: number
          id_formulario?: number
          nome?: string
          permite_edicao_aberta?: boolean
          respondente?: string | null
          schema_campos?: Json
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "ref_formulario_id_etapa_fkey"
            columns: ["id_etapa"]
            isOneToOne: false
            referencedRelation: "ref_etapa"
            referencedColumns: ["id_etapa"]
          },
        ]
      }
      ref_indicador: {
        Row: {
          ativo: boolean
          id_indicador: number
          nome: string
          peso_iip: number
        }
        Insert: {
          ativo?: boolean
          id_indicador?: number
          nome: string
          peso_iip: number
        }
        Update: {
          ativo?: boolean
          id_indicador?: number
          nome?: string
          peso_iip?: number
        }
        Relationships: []
      }
      ref_metrica_formulario: {
        Row: {
          agrupador: string | null
          ativo: boolean
          codigo_campo: string
          eh_nps: boolean
          id_formulario: number
          id_metrica: number
          rotulo: string
          tipo: string
        }
        Insert: {
          agrupador?: string | null
          ativo?: boolean
          codigo_campo: string
          eh_nps?: boolean
          id_formulario: number
          id_metrica?: number
          rotulo: string
          tipo: string
        }
        Update: {
          agrupador?: string | null
          ativo?: boolean
          codigo_campo?: string
          eh_nps?: boolean
          id_formulario?: number
          id_metrica?: number
          rotulo?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ref_metrica_formulario_id_formulario_fkey"
            columns: ["id_formulario"]
            isOneToOne: false
            referencedRelation: "ref_formulario"
            referencedColumns: ["id_formulario"]
          },
        ]
      }
      ref_nivel_iip: {
        Row: {
          codigo: string
          ordem: number
          rotulo: string
          valor: number
        }
        Insert: {
          codigo: string
          ordem: number
          rotulo: string
          valor: number
        }
        Update: {
          codigo?: string
          ordem?: number
          rotulo?: string
          valor?: number
        }
        Relationships: []
      }
      ref_partido: {
        Row: {
          ativo: boolean
          dt_fim_sigla: string | null
          dt_inicio_sigla: string | null
          id_partido: number
          nome: string | null
          numero: number | null
          sigla: string
        }
        Insert: {
          ativo?: boolean
          dt_fim_sigla?: string | null
          dt_inicio_sigla?: string | null
          id_partido?: number
          nome?: string | null
          numero?: number | null
          sigla: string
        }
        Update: {
          ativo?: boolean
          dt_fim_sigla?: string | null
          dt_inicio_sigla?: string | null
          id_partido?: number
          nome?: string | null
          numero?: number | null
          sigla?: string
        }
        Relationships: []
      }
      ref_perfil_atuacao: {
        Row: {
          ativo: boolean
          id_perfil: number
          nome: string
          ordem: number | null
        }
        Insert: {
          ativo?: boolean
          id_perfil?: number
          nome: string
          ordem?: number | null
        }
        Update: {
          ativo?: boolean
          id_perfil?: number
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      ref_pilar_insight: {
        Row: {
          ativo: boolean
          codigo: string
          id_pilar: number
          nome: string
          ordem: number | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          id_pilar?: number
          nome: string
          ordem?: number | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          id_pilar?: number
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      ref_preditor: {
        Row: {
          ativo: boolean
          id_preditor: number
          nome: string
          ordem: number | null
        }
        Insert: {
          ativo?: boolean
          id_preditor?: number
          nome: string
          ordem?: number | null
        }
        Update: {
          ativo?: boolean
          id_preditor?: number
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      ref_produto: {
        Row: {
          ativo: boolean
          id_produto: number
          nome: string
          operado_pelo_sistema: boolean
        }
        Insert: {
          ativo?: boolean
          id_produto?: number
          nome: string
          operado_pelo_sistema?: boolean
        }
        Update: {
          ativo?: boolean
          id_produto?: number
          nome?: string
          operado_pelo_sistema?: boolean
        }
        Relationships: []
      }
      ref_projeto: {
        Row: {
          ativo: boolean
          dt_fim: string | null
          dt_inicio: string | null
          id_produto_padrao: number | null
          id_projeto: number
          nome: string
          tematica: string | null
        }
        Insert: {
          ativo?: boolean
          dt_fim?: string | null
          dt_inicio?: string | null
          id_produto_padrao?: number | null
          id_projeto?: number
          nome: string
          tematica?: string | null
        }
        Update: {
          ativo?: boolean
          dt_fim?: string | null
          dt_inicio?: string | null
          id_produto_padrao?: number | null
          id_projeto?: number
          nome?: string
          tematica?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ref_projeto_id_produto_padrao_fkey"
            columns: ["id_produto_padrao"]
            isOneToOne: false
            referencedRelation: "ref_produto"
            referencedColumns: ["id_produto"]
          },
        ]
      }
      ref_tipo_registro: {
        Row: {
          ativo: boolean
          codigo: string
          id_etapa: number
          id_tipo_registro: number
          nome: string
          permite_multiplos: boolean
          qtd_prevista: number | null
          schema_campos: Json
        }
        Insert: {
          ativo?: boolean
          codigo: string
          id_etapa: number
          id_tipo_registro?: number
          nome: string
          permite_multiplos?: boolean
          qtd_prevista?: number | null
          schema_campos?: Json
        }
        Update: {
          ativo?: boolean
          codigo?: string
          id_etapa?: number
          id_tipo_registro?: number
          nome?: string
          permite_multiplos?: boolean
          qtd_prevista?: number | null
          schema_campos?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ref_tipo_registro_id_etapa_fkey"
            columns: ["id_etapa"]
            isOneToOne: false
            referencedRelation: "ref_etapa"
            referencedColumns: ["id_etapa"]
          },
        ]
      }
      ref_tipologia: {
        Row: {
          ativo: boolean
          estado: string
          grupo: string
          id_indicador: number | null
          id_preditor_1: number | null
          id_preditor_2: number | null
          id_tipologia: number
          nivel_d1_padrao: string | null
          nivel_d2_padrao: string | null
          nivel_d3_padrao: string | null
          observacao: string | null
          tipologia: string
        }
        Insert: {
          ativo?: boolean
          estado: string
          grupo: string
          id_indicador?: number | null
          id_preditor_1?: number | null
          id_preditor_2?: number | null
          id_tipologia?: number
          nivel_d1_padrao?: string | null
          nivel_d2_padrao?: string | null
          nivel_d3_padrao?: string | null
          observacao?: string | null
          tipologia: string
        }
        Update: {
          ativo?: boolean
          estado?: string
          grupo?: string
          id_indicador?: number | null
          id_preditor_1?: number | null
          id_preditor_2?: number | null
          id_tipologia?: number
          nivel_d1_padrao?: string | null
          nivel_d2_padrao?: string | null
          nivel_d3_padrao?: string | null
          observacao?: string | null
          tipologia?: string
        }
        Relationships: [
          {
            foreignKeyName: "ref_tipologia_id_indicador_fkey"
            columns: ["id_indicador"]
            isOneToOne: false
            referencedRelation: "ref_indicador"
            referencedColumns: ["id_indicador"]
          },
          {
            foreignKeyName: "ref_tipologia_id_preditor_1_fkey"
            columns: ["id_preditor_1"]
            isOneToOne: false
            referencedRelation: "ref_preditor"
            referencedColumns: ["id_preditor"]
          },
          {
            foreignKeyName: "ref_tipologia_id_preditor_2_fkey"
            columns: ["id_preditor_2"]
            isOneToOne: false
            referencedRelation: "ref_preditor"
            referencedColumns: ["id_preditor"]
          },
          {
            foreignKeyName: "ref_tipologia_nivel_d1_padrao_fkey"
            columns: ["nivel_d1_padrao"]
            isOneToOne: false
            referencedRelation: "ref_nivel_iip"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "ref_tipologia_nivel_d2_padrao_fkey"
            columns: ["nivel_d2_padrao"]
            isOneToOne: false
            referencedRelation: "ref_nivel_iip"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "ref_tipologia_nivel_d3_padrao_fkey"
            columns: ["nivel_d3_padrao"]
            isOneToOne: false
            referencedRelation: "ref_nivel_iip"
            referencedColumns: ["codigo"]
          },
        ]
      }
      rel_coalizao_membro: {
        Row: {
          dt_entrada: string
          dt_saida: string | null
          id_coalizao: number
          id_contrato: number
          id_membro: number
          nome_grupo: string | null
          papel: string
        }
        Insert: {
          dt_entrada?: string
          dt_saida?: string | null
          id_coalizao: number
          id_contrato: number
          id_membro?: number
          nome_grupo?: string | null
          papel: string
        }
        Update: {
          dt_entrada?: string
          dt_saida?: string | null
          id_coalizao?: number
          id_contrato?: number
          id_membro?: number
          nome_grupo?: string | null
          papel?: string
        }
        Relationships: [
          {
            foreignKeyName: "rel_coalizao_membro_id_coalizao_fkey"
            columns: ["id_coalizao"]
            isOneToOne: false
            referencedRelation: "dim_coalizao"
            referencedColumns: ["id_coalizao"]
          },
          {
            foreignKeyName: "rel_coalizao_membro_id_contrato_fkey"
            columns: ["id_contrato"]
            isOneToOne: false
            referencedRelation: "fat_contrato"
            referencedColumns: ["id_contrato"]
          },
        ]
      }
      rel_formulario_contrato: {
        Row: {
          dt_abertura: string | null
          dt_fechamento: string | null
          estado: string
          id_abertura: number
          id_contrato: number
          id_formulario: number
          id_usuario_abriu: number | null
        }
        Insert: {
          dt_abertura?: string | null
          dt_fechamento?: string | null
          estado?: string
          id_abertura?: number
          id_contrato: number
          id_formulario: number
          id_usuario_abriu?: number | null
        }
        Update: {
          dt_abertura?: string | null
          dt_fechamento?: string | null
          estado?: string
          id_abertura?: number
          id_contrato?: number
          id_formulario?: number
          id_usuario_abriu?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_formulario_contrato_id_contrato_fkey"
            columns: ["id_contrato"]
            isOneToOne: false
            referencedRelation: "fat_contrato"
            referencedColumns: ["id_contrato"]
          },
          {
            foreignKeyName: "rel_formulario_contrato_id_formulario_fkey"
            columns: ["id_formulario"]
            isOneToOne: false
            referencedRelation: "ref_formulario"
            referencedColumns: ["id_formulario"]
          },
          {
            foreignKeyName: "rel_formulario_contrato_id_usuario_abriu_fkey"
            columns: ["id_usuario_abriu"]
            isOneToOne: false
            referencedRelation: "dim_usuario"
            referencedColumns: ["id_usuario"]
          },
        ]
      }
      rel_mandato_candidatura: {
        Row: {
          ano_eleicao: number
          confianca: string
          criado_em: string
          eh_mandato_vigente: boolean
          id_mandato: number
          id_usuario_validou: number | null
          id_vinculo_tse: number
          metodo_match: string
          nr_turno: number
          sq_candidato: number
          status: string
          validado_em: string | null
        }
        Insert: {
          ano_eleicao: number
          confianca: string
          criado_em?: string
          eh_mandato_vigente?: boolean
          id_mandato: number
          id_usuario_validou?: number | null
          id_vinculo_tse?: number
          metodo_match: string
          nr_turno: number
          sq_candidato: number
          status?: string
          validado_em?: string | null
        }
        Update: {
          ano_eleicao?: number
          confianca?: string
          criado_em?: string
          eh_mandato_vigente?: boolean
          id_mandato?: number
          id_usuario_validou?: number | null
          id_vinculo_tse?: number
          metodo_match?: string
          nr_turno?: number
          sq_candidato?: number
          status?: string
          validado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rel_mandato_candidatura_id_mandato_fkey"
            columns: ["id_mandato"]
            isOneToOne: false
            referencedRelation: "dim_mandato"
            referencedColumns: ["id_mandato"]
          },
          {
            foreignKeyName: "rel_mandato_candidatura_id_usuario_validou_fkey"
            columns: ["id_usuario_validou"]
            isOneToOne: false
            referencedRelation: "dim_usuario"
            referencedColumns: ["id_usuario"]
          },
        ]
      }
      rel_usuario_contrato: {
        Row: {
          areas: string[] | null
          cargo: string | null
          criado_em: string
          dt_fim: string | null
          dt_inicio: string
          grau_responsabilidade: string | null
          id_contrato: number
          id_usuario: number
          id_vinculo: number
          papel_no_contrato: string
        }
        Insert: {
          areas?: string[] | null
          cargo?: string | null
          criado_em?: string
          dt_fim?: string | null
          dt_inicio?: string
          grau_responsabilidade?: string | null
          id_contrato: number
          id_usuario: number
          id_vinculo?: number
          papel_no_contrato: string
        }
        Update: {
          areas?: string[] | null
          cargo?: string | null
          criado_em?: string
          dt_fim?: string | null
          dt_inicio?: string
          grau_responsabilidade?: string | null
          id_contrato?: number
          id_usuario?: number
          id_vinculo?: number
          papel_no_contrato?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_vinculo_contrato"
            columns: ["id_contrato"]
            isOneToOne: false
            referencedRelation: "fat_contrato"
            referencedColumns: ["id_contrato"]
          },
          {
            foreignKeyName: "rel_usuario_contrato_id_usuario_fkey"
            columns: ["id_usuario"]
            isOneToOne: false
            referencedRelation: "dim_usuario"
            referencedColumns: ["id_usuario"]
          },
        ]
      }
    }
    Views: {
      vw_etapa_contrato: {
        Row: {
          atualizado_em: string | null
          codigo_etapa: string | null
          dias_atraso: number | null
          dt_conclusao: string | null
          dt_inicio: string | null
          dt_prevista_conclusao: string | null
          dt_prevista_inicio: string | null
          esta_atrasada: boolean | null
          id_contrato: number | null
          id_etapa: number | null
          id_etapa_contrato: number | null
          nome_etapa: string | null
          ordem: number | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fat_etapa_contrato_id_contrato_fkey"
            columns: ["id_contrato"]
            isOneToOne: false
            referencedRelation: "fat_contrato"
            referencedColumns: ["id_contrato"]
          },
          {
            foreignKeyName: "fat_etapa_contrato_id_etapa_fkey"
            columns: ["id_etapa"]
            isOneToOne: false
            referencedRelation: "ref_etapa"
            referencedColumns: ["id_etapa"]
          },
        ]
      }
    }
    Functions: {
      carrega_tse: { Args: { dados: Json; tabela: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  tse: {
    Tables: {
      dim_candidatura: {
        Row: {
          ano_eleicao: number
          carregado_em: string
          cd_cargo: number | null
          cd_eleicao: number | null
          ds_cargo: string | null
          ds_cor_raca: string | null
          ds_eleicao: string | null
          ds_genero: string | null
          ds_grau_instrucao: string | null
          ds_ocupacao: string | null
          ds_sit_tot_turno: string | null
          ds_situacao_candidatura: string | null
          dt_nascimento: string | null
          nm_candidato: string | null
          nm_coligacao: string | null
          nm_social: string | null
          nm_ue: string | null
          nm_urna: string | null
          nr_partido: number | null
          nr_titulo_eleitoral: string | null
          nr_turno: number
          sg_federacao: string | null
          sg_partido: string | null
          sg_ue: string | null
          sg_uf: string | null
          sq_candidato: number
        }
        Insert: {
          ano_eleicao: number
          carregado_em?: string
          cd_cargo?: number | null
          cd_eleicao?: number | null
          ds_cargo?: string | null
          ds_cor_raca?: string | null
          ds_eleicao?: string | null
          ds_genero?: string | null
          ds_grau_instrucao?: string | null
          ds_ocupacao?: string | null
          ds_sit_tot_turno?: string | null
          ds_situacao_candidatura?: string | null
          dt_nascimento?: string | null
          nm_candidato?: string | null
          nm_coligacao?: string | null
          nm_social?: string | null
          nm_ue?: string | null
          nm_urna?: string | null
          nr_partido?: number | null
          nr_titulo_eleitoral?: string | null
          nr_turno: number
          sg_federacao?: string | null
          sg_partido?: string | null
          sg_ue?: string | null
          sg_uf?: string | null
          sq_candidato: number
        }
        Update: {
          ano_eleicao?: number
          carregado_em?: string
          cd_cargo?: number | null
          cd_eleicao?: number | null
          ds_cargo?: string | null
          ds_cor_raca?: string | null
          ds_eleicao?: string | null
          ds_genero?: string | null
          ds_grau_instrucao?: string | null
          ds_ocupacao?: string | null
          ds_sit_tot_turno?: string | null
          ds_situacao_candidatura?: string | null
          dt_nascimento?: string | null
          nm_candidato?: string | null
          nm_coligacao?: string | null
          nm_social?: string | null
          nm_ue?: string | null
          nm_urna?: string | null
          nr_partido?: number | null
          nr_titulo_eleitoral?: string | null
          nr_turno?: number
          sg_federacao?: string | null
          sg_partido?: string | null
          sg_ue?: string | null
          sg_uf?: string | null
          sq_candidato?: number
        }
        Relationships: []
      }
      dim_candidatura_2022: {
        Row: {
          ano_eleicao: number
          carregado_em: string
          cd_cargo: number | null
          cd_eleicao: number | null
          ds_cargo: string | null
          ds_cor_raca: string | null
          ds_eleicao: string | null
          ds_genero: string | null
          ds_grau_instrucao: string | null
          ds_ocupacao: string | null
          ds_sit_tot_turno: string | null
          ds_situacao_candidatura: string | null
          dt_nascimento: string | null
          nm_candidato: string | null
          nm_coligacao: string | null
          nm_social: string | null
          nm_ue: string | null
          nm_urna: string | null
          nr_partido: number | null
          nr_titulo_eleitoral: string | null
          nr_turno: number
          sg_federacao: string | null
          sg_partido: string | null
          sg_ue: string | null
          sg_uf: string | null
          sq_candidato: number
        }
        Insert: {
          ano_eleicao: number
          carregado_em?: string
          cd_cargo?: number | null
          cd_eleicao?: number | null
          ds_cargo?: string | null
          ds_cor_raca?: string | null
          ds_eleicao?: string | null
          ds_genero?: string | null
          ds_grau_instrucao?: string | null
          ds_ocupacao?: string | null
          ds_sit_tot_turno?: string | null
          ds_situacao_candidatura?: string | null
          dt_nascimento?: string | null
          nm_candidato?: string | null
          nm_coligacao?: string | null
          nm_social?: string | null
          nm_ue?: string | null
          nm_urna?: string | null
          nr_partido?: number | null
          nr_titulo_eleitoral?: string | null
          nr_turno: number
          sg_federacao?: string | null
          sg_partido?: string | null
          sg_ue?: string | null
          sg_uf?: string | null
          sq_candidato: number
        }
        Update: {
          ano_eleicao?: number
          carregado_em?: string
          cd_cargo?: number | null
          cd_eleicao?: number | null
          ds_cargo?: string | null
          ds_cor_raca?: string | null
          ds_eleicao?: string | null
          ds_genero?: string | null
          ds_grau_instrucao?: string | null
          ds_ocupacao?: string | null
          ds_sit_tot_turno?: string | null
          ds_situacao_candidatura?: string | null
          dt_nascimento?: string | null
          nm_candidato?: string | null
          nm_coligacao?: string | null
          nm_social?: string | null
          nm_ue?: string | null
          nm_urna?: string | null
          nr_partido?: number | null
          nr_titulo_eleitoral?: string | null
          nr_turno?: number
          sg_federacao?: string | null
          sg_partido?: string | null
          sg_ue?: string | null
          sg_uf?: string | null
          sq_candidato?: number
        }
        Relationships: []
      }
      dim_candidatura_2024: {
        Row: {
          ano_eleicao: number
          carregado_em: string
          cd_cargo: number | null
          cd_eleicao: number | null
          ds_cargo: string | null
          ds_cor_raca: string | null
          ds_eleicao: string | null
          ds_genero: string | null
          ds_grau_instrucao: string | null
          ds_ocupacao: string | null
          ds_sit_tot_turno: string | null
          ds_situacao_candidatura: string | null
          dt_nascimento: string | null
          nm_candidato: string | null
          nm_coligacao: string | null
          nm_social: string | null
          nm_ue: string | null
          nm_urna: string | null
          nr_partido: number | null
          nr_titulo_eleitoral: string | null
          nr_turno: number
          sg_federacao: string | null
          sg_partido: string | null
          sg_ue: string | null
          sg_uf: string | null
          sq_candidato: number
        }
        Insert: {
          ano_eleicao: number
          carregado_em?: string
          cd_cargo?: number | null
          cd_eleicao?: number | null
          ds_cargo?: string | null
          ds_cor_raca?: string | null
          ds_eleicao?: string | null
          ds_genero?: string | null
          ds_grau_instrucao?: string | null
          ds_ocupacao?: string | null
          ds_sit_tot_turno?: string | null
          ds_situacao_candidatura?: string | null
          dt_nascimento?: string | null
          nm_candidato?: string | null
          nm_coligacao?: string | null
          nm_social?: string | null
          nm_ue?: string | null
          nm_urna?: string | null
          nr_partido?: number | null
          nr_titulo_eleitoral?: string | null
          nr_turno: number
          sg_federacao?: string | null
          sg_partido?: string | null
          sg_ue?: string | null
          sg_uf?: string | null
          sq_candidato: number
        }
        Update: {
          ano_eleicao?: number
          carregado_em?: string
          cd_cargo?: number | null
          cd_eleicao?: number | null
          ds_cargo?: string | null
          ds_cor_raca?: string | null
          ds_eleicao?: string | null
          ds_genero?: string | null
          ds_grau_instrucao?: string | null
          ds_ocupacao?: string | null
          ds_sit_tot_turno?: string | null
          ds_situacao_candidatura?: string | null
          dt_nascimento?: string | null
          nm_candidato?: string | null
          nm_coligacao?: string | null
          nm_social?: string | null
          nm_ue?: string | null
          nm_urna?: string | null
          nr_partido?: number | null
          nr_titulo_eleitoral?: string | null
          nr_turno?: number
          sg_federacao?: string | null
          sg_partido?: string | null
          sg_ue?: string | null
          sg_uf?: string | null
          sq_candidato?: number
        }
        Relationships: []
      }
      dim_candidatura_outras: {
        Row: {
          ano_eleicao: number
          carregado_em: string
          cd_cargo: number | null
          cd_eleicao: number | null
          ds_cargo: string | null
          ds_cor_raca: string | null
          ds_eleicao: string | null
          ds_genero: string | null
          ds_grau_instrucao: string | null
          ds_ocupacao: string | null
          ds_sit_tot_turno: string | null
          ds_situacao_candidatura: string | null
          dt_nascimento: string | null
          nm_candidato: string | null
          nm_coligacao: string | null
          nm_social: string | null
          nm_ue: string | null
          nm_urna: string | null
          nr_partido: number | null
          nr_titulo_eleitoral: string | null
          nr_turno: number
          sg_federacao: string | null
          sg_partido: string | null
          sg_ue: string | null
          sg_uf: string | null
          sq_candidato: number
        }
        Insert: {
          ano_eleicao: number
          carregado_em?: string
          cd_cargo?: number | null
          cd_eleicao?: number | null
          ds_cargo?: string | null
          ds_cor_raca?: string | null
          ds_eleicao?: string | null
          ds_genero?: string | null
          ds_grau_instrucao?: string | null
          ds_ocupacao?: string | null
          ds_sit_tot_turno?: string | null
          ds_situacao_candidatura?: string | null
          dt_nascimento?: string | null
          nm_candidato?: string | null
          nm_coligacao?: string | null
          nm_social?: string | null
          nm_ue?: string | null
          nm_urna?: string | null
          nr_partido?: number | null
          nr_titulo_eleitoral?: string | null
          nr_turno: number
          sg_federacao?: string | null
          sg_partido?: string | null
          sg_ue?: string | null
          sg_uf?: string | null
          sq_candidato: number
        }
        Update: {
          ano_eleicao?: number
          carregado_em?: string
          cd_cargo?: number | null
          cd_eleicao?: number | null
          ds_cargo?: string | null
          ds_cor_raca?: string | null
          ds_eleicao?: string | null
          ds_genero?: string | null
          ds_grau_instrucao?: string | null
          ds_ocupacao?: string | null
          ds_sit_tot_turno?: string | null
          ds_situacao_candidatura?: string | null
          dt_nascimento?: string | null
          nm_candidato?: string | null
          nm_coligacao?: string | null
          nm_social?: string | null
          nm_ue?: string | null
          nm_urna?: string | null
          nr_partido?: number | null
          nr_titulo_eleitoral?: string | null
          nr_turno?: number
          sg_federacao?: string | null
          sg_partido?: string | null
          sg_ue?: string | null
          sg_uf?: string | null
          sq_candidato?: number
        }
        Relationships: []
      }
      dim_perfil_eleitorado: {
        Row: {
          ano_eleicao: number
          carregado_em: string
          cd_municipio: number | null
          ds_estado_civil: string | null
          ds_faixa_etaria: string | null
          ds_genero: string | null
          ds_grau_escolaridade: string | null
          ds_identidade_genero: string | null
          ds_interprete_libras: string | null
          ds_quilombola: string | null
          ds_raca_cor: string | null
          id_perfil: number
          nm_municipio: string | null
          nr_zona: number | null
          qt_eleitores: number | null
          qt_eleitores_deficiencia: number | null
          sg_uf: string | null
        }
        Insert: {
          ano_eleicao: number
          carregado_em?: string
          cd_municipio?: number | null
          ds_estado_civil?: string | null
          ds_faixa_etaria?: string | null
          ds_genero?: string | null
          ds_grau_escolaridade?: string | null
          ds_identidade_genero?: string | null
          ds_interprete_libras?: string | null
          ds_quilombola?: string | null
          ds_raca_cor?: string | null
          id_perfil?: number
          nm_municipio?: string | null
          nr_zona?: number | null
          qt_eleitores?: number | null
          qt_eleitores_deficiencia?: number | null
          sg_uf?: string | null
        }
        Update: {
          ano_eleicao?: number
          carregado_em?: string
          cd_municipio?: number | null
          ds_estado_civil?: string | null
          ds_faixa_etaria?: string | null
          ds_genero?: string | null
          ds_grau_escolaridade?: string | null
          ds_identidade_genero?: string | null
          ds_interprete_libras?: string | null
          ds_quilombola?: string | null
          ds_raca_cor?: string | null
          id_perfil?: number
          nm_municipio?: string | null
          nr_zona?: number | null
          qt_eleitores?: number | null
          qt_eleitores_deficiencia?: number | null
          sg_uf?: string | null
        }
        Relationships: []
      }
      dim_perfil_eleitorado_2022: {
        Row: {
          ano_eleicao: number
          carregado_em: string
          cd_municipio: number | null
          ds_estado_civil: string | null
          ds_faixa_etaria: string | null
          ds_genero: string | null
          ds_grau_escolaridade: string | null
          ds_identidade_genero: string | null
          ds_interprete_libras: string | null
          ds_quilombola: string | null
          ds_raca_cor: string | null
          id_perfil: number
          nm_municipio: string | null
          nr_zona: number | null
          qt_eleitores: number | null
          qt_eleitores_deficiencia: number | null
          sg_uf: string | null
        }
        Insert: {
          ano_eleicao: number
          carregado_em?: string
          cd_municipio?: number | null
          ds_estado_civil?: string | null
          ds_faixa_etaria?: string | null
          ds_genero?: string | null
          ds_grau_escolaridade?: string | null
          ds_identidade_genero?: string | null
          ds_interprete_libras?: string | null
          ds_quilombola?: string | null
          ds_raca_cor?: string | null
          id_perfil?: number
          nm_municipio?: string | null
          nr_zona?: number | null
          qt_eleitores?: number | null
          qt_eleitores_deficiencia?: number | null
          sg_uf?: string | null
        }
        Update: {
          ano_eleicao?: number
          carregado_em?: string
          cd_municipio?: number | null
          ds_estado_civil?: string | null
          ds_faixa_etaria?: string | null
          ds_genero?: string | null
          ds_grau_escolaridade?: string | null
          ds_identidade_genero?: string | null
          ds_interprete_libras?: string | null
          ds_quilombola?: string | null
          ds_raca_cor?: string | null
          id_perfil?: number
          nm_municipio?: string | null
          nr_zona?: number | null
          qt_eleitores?: number | null
          qt_eleitores_deficiencia?: number | null
          sg_uf?: string | null
        }
        Relationships: []
      }
      dim_perfil_eleitorado_2024: {
        Row: {
          ano_eleicao: number
          carregado_em: string
          cd_municipio: number | null
          ds_estado_civil: string | null
          ds_faixa_etaria: string | null
          ds_genero: string | null
          ds_grau_escolaridade: string | null
          ds_identidade_genero: string | null
          ds_interprete_libras: string | null
          ds_quilombola: string | null
          ds_raca_cor: string | null
          id_perfil: number
          nm_municipio: string | null
          nr_zona: number | null
          qt_eleitores: number | null
          qt_eleitores_deficiencia: number | null
          sg_uf: string | null
        }
        Insert: {
          ano_eleicao: number
          carregado_em?: string
          cd_municipio?: number | null
          ds_estado_civil?: string | null
          ds_faixa_etaria?: string | null
          ds_genero?: string | null
          ds_grau_escolaridade?: string | null
          ds_identidade_genero?: string | null
          ds_interprete_libras?: string | null
          ds_quilombola?: string | null
          ds_raca_cor?: string | null
          id_perfil?: number
          nm_municipio?: string | null
          nr_zona?: number | null
          qt_eleitores?: number | null
          qt_eleitores_deficiencia?: number | null
          sg_uf?: string | null
        }
        Update: {
          ano_eleicao?: number
          carregado_em?: string
          cd_municipio?: number | null
          ds_estado_civil?: string | null
          ds_faixa_etaria?: string | null
          ds_genero?: string | null
          ds_grau_escolaridade?: string | null
          ds_identidade_genero?: string | null
          ds_interprete_libras?: string | null
          ds_quilombola?: string | null
          ds_raca_cor?: string | null
          id_perfil?: number
          nm_municipio?: string | null
          nr_zona?: number | null
          qt_eleitores?: number | null
          qt_eleitores_deficiencia?: number | null
          sg_uf?: string | null
        }
        Relationships: []
      }
      dim_perfil_eleitorado_outras: {
        Row: {
          ano_eleicao: number
          carregado_em: string
          cd_municipio: number | null
          ds_estado_civil: string | null
          ds_faixa_etaria: string | null
          ds_genero: string | null
          ds_grau_escolaridade: string | null
          ds_identidade_genero: string | null
          ds_interprete_libras: string | null
          ds_quilombola: string | null
          ds_raca_cor: string | null
          id_perfil: number
          nm_municipio: string | null
          nr_zona: number | null
          qt_eleitores: number | null
          qt_eleitores_deficiencia: number | null
          sg_uf: string | null
        }
        Insert: {
          ano_eleicao: number
          carregado_em?: string
          cd_municipio?: number | null
          ds_estado_civil?: string | null
          ds_faixa_etaria?: string | null
          ds_genero?: string | null
          ds_grau_escolaridade?: string | null
          ds_identidade_genero?: string | null
          ds_interprete_libras?: string | null
          ds_quilombola?: string | null
          ds_raca_cor?: string | null
          id_perfil?: number
          nm_municipio?: string | null
          nr_zona?: number | null
          qt_eleitores?: number | null
          qt_eleitores_deficiencia?: number | null
          sg_uf?: string | null
        }
        Update: {
          ano_eleicao?: number
          carregado_em?: string
          cd_municipio?: number | null
          ds_estado_civil?: string | null
          ds_faixa_etaria?: string | null
          ds_genero?: string | null
          ds_grau_escolaridade?: string | null
          ds_identidade_genero?: string | null
          ds_interprete_libras?: string | null
          ds_quilombola?: string | null
          ds_raca_cor?: string | null
          id_perfil?: number
          nm_municipio?: string | null
          nr_zona?: number | null
          qt_eleitores?: number | null
          qt_eleitores_deficiencia?: number | null
          sg_uf?: string | null
        }
        Relationships: []
      }
      fat_votacao_zona: {
        Row: {
          ano_eleicao: number
          carregado_em: string
          cd_eleicao: number
          cd_municipio: number
          ds_sit_tot_turno: string | null
          nm_municipio: string | null
          nr_turno: number
          nr_zona: number
          qt_votos_nominais: number | null
          qt_votos_nominais_validos: number | null
          sq_candidato: number
          st_voto_em_transito: boolean
        }
        Insert: {
          ano_eleicao: number
          carregado_em?: string
          cd_eleicao: number
          cd_municipio: number
          ds_sit_tot_turno?: string | null
          nm_municipio?: string | null
          nr_turno: number
          nr_zona: number
          qt_votos_nominais?: number | null
          qt_votos_nominais_validos?: number | null
          sq_candidato: number
          st_voto_em_transito?: boolean
        }
        Update: {
          ano_eleicao?: number
          carregado_em?: string
          cd_eleicao?: number
          cd_municipio?: number
          ds_sit_tot_turno?: string | null
          nm_municipio?: string | null
          nr_turno?: number
          nr_zona?: number
          qt_votos_nominais?: number | null
          qt_votos_nominais_validos?: number | null
          sq_candidato?: number
          st_voto_em_transito?: boolean
        }
        Relationships: []
      }
      fat_votacao_zona_2022: {
        Row: {
          ano_eleicao: number
          carregado_em: string
          cd_eleicao: number
          cd_municipio: number
          ds_sit_tot_turno: string | null
          nm_municipio: string | null
          nr_turno: number
          nr_zona: number
          qt_votos_nominais: number | null
          qt_votos_nominais_validos: number | null
          sq_candidato: number
          st_voto_em_transito: boolean
        }
        Insert: {
          ano_eleicao: number
          carregado_em?: string
          cd_eleicao: number
          cd_municipio: number
          ds_sit_tot_turno?: string | null
          nm_municipio?: string | null
          nr_turno: number
          nr_zona: number
          qt_votos_nominais?: number | null
          qt_votos_nominais_validos?: number | null
          sq_candidato: number
          st_voto_em_transito?: boolean
        }
        Update: {
          ano_eleicao?: number
          carregado_em?: string
          cd_eleicao?: number
          cd_municipio?: number
          ds_sit_tot_turno?: string | null
          nm_municipio?: string | null
          nr_turno?: number
          nr_zona?: number
          qt_votos_nominais?: number | null
          qt_votos_nominais_validos?: number | null
          sq_candidato?: number
          st_voto_em_transito?: boolean
        }
        Relationships: []
      }
      fat_votacao_zona_2024: {
        Row: {
          ano_eleicao: number
          carregado_em: string
          cd_eleicao: number
          cd_municipio: number
          ds_sit_tot_turno: string | null
          nm_municipio: string | null
          nr_turno: number
          nr_zona: number
          qt_votos_nominais: number | null
          qt_votos_nominais_validos: number | null
          sq_candidato: number
          st_voto_em_transito: boolean
        }
        Insert: {
          ano_eleicao: number
          carregado_em?: string
          cd_eleicao: number
          cd_municipio: number
          ds_sit_tot_turno?: string | null
          nm_municipio?: string | null
          nr_turno: number
          nr_zona: number
          qt_votos_nominais?: number | null
          qt_votos_nominais_validos?: number | null
          sq_candidato: number
          st_voto_em_transito?: boolean
        }
        Update: {
          ano_eleicao?: number
          carregado_em?: string
          cd_eleicao?: number
          cd_municipio?: number
          ds_sit_tot_turno?: string | null
          nm_municipio?: string | null
          nr_turno?: number
          nr_zona?: number
          qt_votos_nominais?: number | null
          qt_votos_nominais_validos?: number | null
          sq_candidato?: number
          st_voto_em_transito?: boolean
        }
        Relationships: []
      }
      fat_votacao_zona_outras: {
        Row: {
          ano_eleicao: number
          carregado_em: string
          cd_eleicao: number
          cd_municipio: number
          ds_sit_tot_turno: string | null
          nm_municipio: string | null
          nr_turno: number
          nr_zona: number
          qt_votos_nominais: number | null
          qt_votos_nominais_validos: number | null
          sq_candidato: number
          st_voto_em_transito: boolean
        }
        Insert: {
          ano_eleicao: number
          carregado_em?: string
          cd_eleicao: number
          cd_municipio: number
          ds_sit_tot_turno?: string | null
          nm_municipio?: string | null
          nr_turno: number
          nr_zona: number
          qt_votos_nominais?: number | null
          qt_votos_nominais_validos?: number | null
          sq_candidato: number
          st_voto_em_transito?: boolean
        }
        Update: {
          ano_eleicao?: number
          carregado_em?: string
          cd_eleicao?: number
          cd_municipio?: number
          ds_sit_tot_turno?: string | null
          nm_municipio?: string | null
          nr_turno?: number
          nr_zona?: number
          qt_votos_nominais?: number | null
          qt_votos_nominais_validos?: number | null
          sq_candidato?: number
          st_voto_em_transito?: boolean
        }
        Relationships: []
      }
      rel_rede_social: {
        Row: {
          ano_eleicao: number
          carregado_em: string
          ds_url: string
          nr_ordem_rede_social: number
          sq_candidato: number
        }
        Insert: {
          ano_eleicao: number
          carregado_em?: string
          ds_url: string
          nr_ordem_rede_social: number
          sq_candidato: number
        }
        Update: {
          ano_eleicao?: number
          carregado_em?: string
          ds_url?: string
          nr_ordem_rede_social?: number
          sq_candidato?: number
        }
        Relationships: []
      }
    }
    Views: {
      mv_candidatura_resumo: {
        Row: {
          ano_eleicao: number | null
          cd_cargo: number | null
          ds_cargo: string | null
          ds_sit_tot_turno: string | null
          ds_situacao_candidatura: string | null
          nm_candidato: string | null
          nm_municipio_principal: string | null
          nm_urna: string | null
          nr_partido: number | null
          nr_titulo_eleitoral: string | null
          nr_turno: number | null
          qt_votos_total: number | null
          sg_partido: string | null
          sg_uf: string | null
          sq_candidato: number | null
        }
        Relationships: []
      }
      mv_perfil_eleitorado_candidatura: {
        Row: {
          ano_eleicao: number | null
          categoria: string | null
          dimensao: string | null
          nr_turno: number | null
          qt_eleitores: number | null
          sq_candidato: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  app: {
    Enums: {},
  },
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  tse: {
    Enums: {},
  },
} as const

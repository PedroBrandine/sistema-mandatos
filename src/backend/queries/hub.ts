import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { buscarIdProdutoPorNome } from "./produto";

// EST-02 / AD-001 (T11). Monta os cards do Hub. A visibilidade de cada card
// NUNCA é decidida por `if (papel === 'x')` no componente -- é derivada do
// resultado real da leitura no banco: consulta negada por permissão (42501)
// -> card omitido; qualquer outro erro -> propaga (design.md, `HubProdutos`,
// nota AD-001). A ordem é sempre a mesma, mesmo com cards omitidos.
export interface CardHub {
  destino: string;
  tipo: "produto" | "ferramenta";
  titulo: string;
  descricao: string;
  icone: string;
  badge?: string;
}

const CODIGO_PERMISSAO_NEGADA = "42501";

function negadoPorPermissao(error: { code?: string } | null): boolean {
  return error !== null && error.code === CODIGO_PERMISSAO_NEGADA;
}

// AC3: contagem real de mandatos ativos da Estratégia. `count: 'exact',
// head: true` -- só o número, sem baixar linha nenhuma (mesmo padrão de
// performance já usado em buscarPendencias/queries/visao-gerencial.ts).
async function contarMandatosAtivosEstrategia(client: SupabaseClient<Database>): Promise<string | undefined> {
  const idProduto = await buscarIdProdutoPorNome(client, "Estratégia");
  if (idProduto === null) return undefined;

  const { count, error } = await client
    .from("fat_contrato")
    .select("id_contrato", { count: "exact", head: true })
    .eq("id_produto", idProduto)
    .eq("status", "ativo");
  if (negadoPorPermissao(error)) return undefined;
  if (error) throw error;

  return String(count ?? 0);
}

// AC7: card "Gestão de Usuários" só para Admin. RISCO ACEITO (documentado no
// commit desta task): dim_usuario permite SELECT completo a legisla_gestora
// via RLS `p_usuario` (`app.papel_atual() IN ('admin','gestora')`), então não
// existe hoje nenhuma consulta cujo 42501 distinga Admin de Gestora -- o
// padrão de negação-por-permissão usado nos demais cards não se aplica aqui.
// Esta função lê o papel_global da própria usuária (dado do banco, resolvido
// pela sessão autenticada) em vez de aceitar um papel já hardcoded/prop --
// mas não é enforcement de RLS. Enforcement real de "só Admin" em
// `/usuarios` continua dependendo de uma migration futura (fora do escopo
// desta task, que não inclui migration).
async function ehAdmin(client: SupabaseClient<Database>): Promise<boolean> {
  const { data: auth } = await client.auth.getUser();
  const email = auth.user?.email ?? null;
  if (!email) return false;

  const { data, error } = await client.from("dim_usuario").select("papel_global").eq("email", email).maybeSingle();
  if (negadoPorPermissao(error)) return false;
  if (error) throw error;

  return data?.papel_global === "admin";
}

// AC4: contagem real de fatos geradores registrados (organização inteira,
// mesmo espírito de AD-036 -- mv_numeros_impacto/Números de Impacto lê
// carteira-inteira, não recortada por usuária).
async function contarFatosGeradores(client: SupabaseClient<Database>): Promise<string> {
  const { count, error } = await client
    .from("fat_fato_gerador")
    .select("id_fato_gerador", { count: "exact", head: true });
  if (error) throw error;
  return String(count ?? 0);
}

// AC2: visibilidade de "Visão Gerencial" e "Números de Impacto" deriva do
// GRANT real das MVs que os alimentam -- mv_avaliacao_nps/mv_numeros_impacto
// nunca foram concedidas a legisla_mentor/legisla_assessor (AD-036,
// 20260831022144_saida_numeros_impacto_refresh.sql:28). A consulta aqui é só
// a sonda de permissão -- os dados de fato exibidos vêm de outras telas.
async function podeLerMvAvaliacaoNps(client: SupabaseClient<Database>): Promise<boolean> {
  const { error } = await client.from("mv_avaliacao_nps").select("id_formulario").limit(1);
  if (negadoPorPermissao(error)) return false;
  if (error) throw error;
  return true;
}

async function podeLerMvNumerosImpacto(client: SupabaseClient<Database>): Promise<boolean> {
  const { error } = await client.from("mv_numeros_impacto").select("id_contrato").limit(1);
  if (negadoPorPermissao(error)) return false;
  if (error) throw error;
  return true;
}

// EST-02 AC1/AC6: ordem fixa -- Estratégia, PLL, Coalizão, Visão Gerencial,
// Números de Impacto, Gestão de Usuários. Card cuja consulta de contador (ou
// sonda de permissão) foi negada some da lista; a ordem dos que restam nunca
// muda.
export async function buscarCardsHub(client: SupabaseClient<Database>): Promise<CardHub[]> {
  const [badgeEstrategia, podeVisaoGerencial, podeNumerosImpacto, admin] = await Promise.all([
    contarMandatosAtivosEstrategia(client),
    podeLerMvAvaliacaoNps(client),
    podeLerMvNumerosImpacto(client),
    ehAdmin(client),
  ]);

  const cards: (CardHub | null)[] = [
    {
      destino: "/produtos/estrategia",
      tipo: "produto",
      titulo: "Estratégia",
      descricao: "Mandatos, contratos e operação da consultoria estratégica",
      icone: "estrategia",
      badge: badgeEstrategia,
    },
    {
      destino: "/produtos/pll",
      tipo: "produto",
      titulo: "PLL",
      descricao: "Contratos e operação do produto PLL",
      icone: "pll",
    },
    {
      destino: "/produtos/coalizao",
      tipo: "produto",
      titulo: "Coalizão",
      descricao: "Federações, alianças e projetos estratégicos",
      icone: "coalizao",
    },
    podeVisaoGerencial
      ? {
          destino: "/visao-gerencial",
          tipo: "ferramenta",
          titulo: "Visão Gerencial",
          descricao: "Indicadores consolidados e análise estratégica de todos os produtos",
          icone: "visao-gerencial",
        }
      : null,
    podeNumerosImpacto
      ? {
          destino: "/numeros-impacto",
          tipo: "ferramenta",
          titulo: "Números de Impacto",
          descricao: "Contratos por contratante, ano da 1ª contratação e ordem do contrato",
          icone: "numeros-impacto",
          badge: await contarFatosGeradores(client),
        }
      : null,
    admin
      ? {
          destino: "/usuarios",
          tipo: "ferramenta",
          titulo: "Gestão de Usuários",
          descricao: "Gerencie usuários, permissões e acessos da plataforma",
          icone: "usuarios",
        }
      : null,
  ];

  return cards.filter((c): c is CardHub => c !== null);
}

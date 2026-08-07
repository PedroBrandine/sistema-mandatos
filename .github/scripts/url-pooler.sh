#!/usr/bin/env bash
#
# Descobre uma URL de conexão IPv4 para o Postgres do projeto e a exporta em
# DB_URL (via $GITHUB_ENV), para uso com `supabase ... --db-url`.
#
# POR QUE EXISTE
#
# `db.<ref>.supabase.co` resolve **só em IPv6** e os runners do GitHub não têm
# IPv6. Conferido dentro do runner em 07/08/2026:
#
#   getent ahostsv4 db.<ref>.supabase.co  -> (sem registro A)
#   ip -6 addr show scope global          -> 0 endereços
#
# Ou seja: `--linked` nunca vai conectar daqui, e a mensagem que a CLI dá
# ("failed to connect to postgres" + "setting the env var correctly:
# SUPABASE_DB_PASSWORD") aponta para o lado errado -- parece senha errada e é
# rede. O pooler (Supavisor) tem IPv4 e é o único caminho.
#
# Qual pooler regional atende o projeto vem da Management API, para não ficar
# chumbado no arquivo. Se a resposta mudar de formato, cai para sondar os
# candidatos da região -- e a sondagem é o próprio `supabase migration list`,
# que já está instalado e testa exatamente o que precisamos.
#
# Uso:
#   PROJECT_REF=<ref> SENHA=<senha> [REGIAO=sa-east-1] bash url-pooler.sh
#
set -euo pipefail

: "${PROJECT_REF:?PROJECT_REF não definido}"
: "${SENHA:?SENHA não definida}"
REGIAO="${REGIAO:-sa-east-1}"

# A senha entra numa URL; caracteres como @ : / ? # quebrariam o parsing.
senha_enc=$(printf %s "$SENHA" | jq -sRr @uri)
echo "::add-mask::$senha_enc"

candidatos=""

if [ -n "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  resposta=$(curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    "https://api.supabase.com/v1/projects/$PROJECT_REF/config/database/pooler" 2>/dev/null || true)
  # A resposta já veio como objeto e como array em versões diferentes da API;
  # aceitar os dois evita depender do formato.
  host=$(printf %s "$resposta" | jq -r 'if type=="array" then .[0] else . end | .db_host // empty' 2>/dev/null || true)
  porta=$(printf %s "$resposta" | jq -r 'if type=="array" then .[0] else . end | .db_port // empty' 2>/dev/null || true)
  if [ -n "$host" ]; then
    candidatos="$host:${porta:-5432}"
    echo "Management API indicou o pooler: $host:${porta:-5432}"
  else
    echo "Management API não devolveu db_host; vou sondar os candidatos da região."
  fi
fi

# Porta 5432 = modo sessão. Migrations usam prepared statements, que o modo
# transação (6543) não suporta.
candidatos="$candidatos aws-0-$REGIAO.pooler.supabase.com:5432 aws-1-$REGIAO.pooler.supabase.com:5432"

for alvo in $candidatos; do
  h=${alvo%:*}
  p=${alvo##*:}
  url="postgresql://postgres.$PROJECT_REF:$senha_enc@$h:$p/postgres"
  # A saída do probe é o único sinal que distingue senha errada
  # ("password authentication failed") de usuário/tenant errado ("Tenant or
  # user not found") de rede. Engolir isso custou um ciclo inteiro.
  if saida=$(supabase migration list --db-url "$url" 2>&1); then
    echo "::add-mask::$url"
    echo "Conectado via $h:$p"
    echo "DB_URL=$url" >> "${GITHUB_ENV:-/dev/stdout}"
    exit 0
  fi
  echo "--- sem conexão por $h:$p ---"
  printf '%s\n' "$saida" | tail -4
done

echo "::error::Nenhum pooler respondeu para $PROJECT_REF. Confira a senha do banco no secret correspondente e o host em Project Settings → Database → Connection pooling."
exit 1

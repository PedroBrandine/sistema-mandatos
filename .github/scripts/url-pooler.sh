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

# O probe precisa dizer POR QUE falhou: senha errada, tenant inexistente e
# rede inalcançável exigem correções completamente diferentes. A CLI do
# Supabase embrulha os três no mesmo "PgClient: Failed to connect", então
# quando houver `psql` a sondagem usa ele, que repassa a mensagem do Postgres
# literalmente ("password authentication failed", "Tenant or user not found").
if command -v psql >/dev/null 2>&1; then
  probe() { psql "$1" -tAc 'select 1' 2>&1; }
else
  echo "psql indisponível; sondando com a CLI (mensagens de erro mais pobres)."
  probe() { supabase migration list --db-url "$1" 2>&1; }
fi

erros=""
for alvo in $candidatos; do
  h=${alvo%:*}
  p=${alvo##*:}
  url="postgresql://postgres.$PROJECT_REF:$senha_enc@$h:$p/postgres"
  if saida=$(probe "$url"); then
    echo "::add-mask::$url"
    echo "Conectado via $h:$p"
    echo "DB_URL=$url" >> "${GITHUB_ENV:-/dev/stdout}"
    exit 0
  fi
  echo "--- sem conexão por $h:$p ---"
  printf '%s\n' "$saida" | tail -4
  erros="$erros $saida"
done

# As três causas possíveis exigem correções diferentes, e o log acima já
# distingue as três. Traduzir aqui evita que a próxima pessoa precise
# reconstruir o raciocínio.
if printf %s "$erros" | grep -q "password authentication failed"; then
  echo "::error::O pooler encontrou o projeto $PROJECT_REF e RECUSOU A SENHA. Host e usuário estão certos; o secret com a senha do banco é que está errado. Gere uma nova em Project Settings → Database → Reset database password e atualize o secret."
elif printf %s "$erros" | grep -q "tenant/user .* not found"; then
  echo "::error::Nenhum pooler da região $REGIAO conhece o projeto $PROJECT_REF. Confira o ref e o host em Project Settings → Database → Connection pooling."
else
  echo "::error::Não consegui conectar em $PROJECT_REF por nenhum pooler. Veja as mensagens acima."
fi
exit 1

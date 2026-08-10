#!/usr/bin/env bash
#
# Lê um `supabase db diff` na entrada padrão e escreve na saída apenas a deriva
# que é NOSSA. Um resumo do que foi ignorado vai para stderr.
#
# POR QUE EXISTE
#
# A primeira execução real do drift-check (10/08/2026) devolveu 274 linhas em
# produção e 312 em dev. Quase tudo era ruído: o banco de nuvem da Supabase tem
# objetos que o shadow database local não tem, então o diff acusa diferença sem
# que ninguém tenha mexido em nada. Um alarme que toca toda segunda-feira é um
# alarme que ninguém escuta -- e este existe para pegar SQL rodado à mão, que já
# causou seis divergências entre dev e prod, uma derrubando a produção inteira.
#
# O QUE É IGNORADO, E POR QUE CADA COISA
#
#   grant-plataforma    GRANT em bloco para anon/authenticated/service_role
#                       sobre objetos **de `public`**. A Supabase aplica isso
#                       sozinha nos projetos de nuvem.
#
#                       O recorte por schema é o ponto crítico da regra, não um
#                       detalhe. Uma primeira versão ignorava GRANT a essas três
#                       roles em qualquer schema -- e engolia exatamente a
#                       deriva que motivou este filtro: 30 concessões
#                       `GRANT ALL ON FUNCTION app.* TO anon` que existiam em
#                       dev e não em produção. Grants em `app`, `tse` e `stg`
#                       são nossos e aparecem.
#
#                       Grants `ON SCHEMA` também NÃO são ignorados -- foi um
#                       `GRANT USAGE ON SCHEMA app` ausente que derrubou a
#                       produção (migration 0028).
#
#   default-privileges  ALTER DEFAULT PRIVILEGES ... IN SCHEMA public, idem.
#                       Em outro schema, aparece.
#
#   trigger-plataforma  `public.ensure_rls` / `public.rls_auto_enable`, a rede
#                       de segurança da própria Supabase que liga RLS em tabela
#                       nova de `public`. Não é nossa e não está em migration.
#
#   particao-datada     Partições `log_auditoria_*`. A migration 0008 chama
#                       `app.cria_particoes_log(CURRENT_DATE, 18)` -- ela NÃO É
#                       DETERMINÍSTICA: o conjunto de partições depende do dia
#                       em que rodou, então um shadow construído hoje nunca vai
#                       bater com um banco provisionado há dez dias. Enquanto a
#                       0008 depender de CURRENT_DATE, esse diff é inevitável.
#
# O preço: uma alteração feita à mão numa partição de log, ou um grant em bloco
# malicioso, passariam batidos. Aceito conscientemente -- a alternativa era não
# ter alarme nenhum.
#
# POR QUE O PARSING É ASSIM
#
# A primeira versão separava statements por linha vazia (modo parágrafo do awk).
# Testada contra o diff real, ela colapsou o arquivo inteiro num bloco único --
# porque não havia linha vazia -- e devolveu "sem deriva". Falha silenciosa na
# direção mais perigosa possível: esconder deriva de verdade.
#
# Agora os statements são montados até o `;` final, com rastreio de
# dollar-quoting ($$ / $function$), senão o corpo de uma função viraria dezenas
# de fragmentos que não casam com regra nenhuma e passariam como deriva real.
# Se sobrar conteúdo sem `;` no fim, isso é reportado em vez de descartado.
#
set -euo pipefail

# Tira cores ANSI e a conversa do CLI, que não é SQL.
sed -e 's/\x1b\[[0-9;]*m//g' \
    -e '/^Creating shadow database/d' \
    -e '/^Diffing schemas/d' \
    -e '/^Found drop statements/d' \
    -e '/^WARN:/d' \
    -e '/^Initialising/d' \
    -e '/^Connecting to/d' \
    -e '/^Finished /d' \
    -e '/^-- Migration unit/d' \
    -e '/^-- Transaction mode/d' \
    -e '/^-- Boundary reason/d' \
    -e '/^SET check_function_bodies/d' |
awk '
function classifica(s,   motivo) {
  motivo = ""
  if (s ~ /^GRANT/ && s ~ /TO (anon|authenticated|service_role)/ && \
      s ~ /ON ([A-Z]+ )?public\./ && s !~ /ON SCHEMA/)
    motivo = "grant-plataforma"
  else if (s ~ /^ALTER DEFAULT PRIVILEGES/ && s ~ /IN SCHEMA public /)
    motivo = "default-privileges"
  else if (s ~ /rls_auto_enable|ensure_rls/)
    motivo = "trigger-plataforma"
  else if (s ~ /log_auditoria_[0-9]|log_auditoria_default/)
    motivo = "particao-datada"

  if (motivo != "") {
    ignorados[motivo]++
    total_ignorados++
    return
  }
  total_reais++
  print s ";\n"
}

{
  linha = $0
  if (linha ~ /^[[:space:]]*$/ && stmt == "") next

  stmt = (stmt == "" ? linha : stmt "\n" linha)

  # Rastreia abertura/fechamento de dollar-quoting na linha.
  resto = linha
  while (match(resto, /\$[A-Za-z_0-9]*\$/)) {
    tag = substr(resto, RSTART, RLENGTH)
    resto = substr(resto, RSTART + RLENGTH)
    if (dolar == "") dolar = tag
    else if (dolar == tag) dolar = ""
  }

  if (dolar != "") next                    # dentro de corpo de função/DO
  if (linha !~ /;[[:space:]]*$/) next      # statement ainda não terminou

  sub(/;[[:space:]]*$/, "", stmt)
  classifica(stmt)
  stmt = ""
}

END {
  if (stmt != "") {
    print "ATENCAO: sobrou conteudo sem `;` final; tratado como deriva real." > "/dev/stderr"
    total_reais++
    print stmt
  }
  if (total_ignorados == 0) {
    print "Nada foi ignorado como baseline." > "/dev/stderr"
  } else {
    printf("%d statement(s) ignorado(s) como baseline da plataforma:\n", total_ignorados) > "/dev/stderr"
    for (m in ignorados) printf("  %-20s %d\n", m, ignorados[m]) > "/dev/stderr"
  }
  printf("%d statement(s) restaram como deriva real.\n", total_reais + 0) > "/dev/stderr"
}
'

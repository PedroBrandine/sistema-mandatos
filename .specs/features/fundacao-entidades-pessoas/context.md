# Fundação — entidades & pessoas — Context

**Gathered:** 2026-07-30
**Spec:** `.specs/features/fundacao-entidades-pessoas/spec.md`
**Status:** Ready for design

---

## Feature Boundary

A camada Fundação (§2.2 da Constituição): cadastro de contratante/mandato (importação TSE + manual), cadastro e gestão de coalizões, cadastro e gestão de usuários (RBAC), abertura/ciclo/renovação de contrato (mecanismo que materializa o vínculo de Produto e Projeto), e a gestão do vínculo usuário↔contrato (incluir, editar, substituir, encerrar — assessor, mentor e gestora). A Fundação **registra e vincula**; não opera produto, não calcula atingimento, não lança incidência.

---

## Implementation Decisions

### Escopo do contrato (FND-04)

- Abertura, ciclo e renovação de contrato (`fat_contrato`) entram nesta spec — é o mecanismo que materializa o vínculo de Produto e Projeto pedido no escopo original. Sem isso, "vincular ao Produto e Projeto" não é especificável.
- Renovação **não tem ação dedicada "renovar"**: é campo do fluxo normal de abertura de contrato. Ao abrir um novo contrato, a Gestora escolhe opcionalmente, entre os contratos existentes do mesmo contratante, qual é o `id_contrato_anterior`. Não há pré-preenchimento automático nem botão especial.

### Fluxo de match TSE

- O match de candidatura (`rel_mandato_candidatura`) nasce por **sugestão automática**: algoritmo casa por nome + UF + cargo contra `tse.mv_candidatura_resumo` e grava a linha como `status='sugerido'` com `metodo_match` e `confianca`. A Gestora só confirma ou rejeita — não digita a busca do zero (mas pode buscar manualmente quando a sugestão falhar ou for descartada).
- Quando a Gestora confirma uma candidatura nova como `eh_mandato_vigente = true` e já existe outra candidatura vigente para o mesmo mandato, o sistema **desmarca automaticamente a anterior na mesma transação** — a Gestora não executa duas ações.

### Vínculo do assessor (e demais papéis usuário↔contrato)

- **Modelo temporal, nunca hard delete.** Substituir e excluir sempre gravam `dt_fim = hoje` na linha antiga de `rel_usuario_contrato`; nunca apagam a linha. Substituir, além disso, cria uma linha nova para a pessoa nova.
- **Excluir não desativa a pessoa.** Encerrar o vínculo (`dt_fim`) não toca `dim_usuario.ativo` — a pessoa continua existindo no sistema e pode ter vínculo com outros contratos.
- **Editar não é substituir.** Editar atribuições do vínculo aberto (cargo, grau de responsabilidade, áreas de atuação) é `UPDATE` na linha existente, sem tocar `dt_inicio`/`dt_fim` e sem criar linha nova.
- Esta regra vale genericamente para qualquer `papel_no_contrato` (gestora, mentor, assessor) e para os três produtos — não é lógica especial do assessor.

### Cadastro de usuário — quem pode

- **Gestora e Admin** podem criar/editar/desativar `dim_usuario` (a pessoa em si, não o vínculo com um contrato específico). Qualquer Gestora cadastra Mentor/Assessor; só o Admin cadastra outra Gestora (`papel_global = 'gestora'`).

### Duplicata no cadastro manual de contratante/mandato

- **Aviso não bloqueante.** Ao salvar, se `nome_normalizado` + UF/município baterem com um contratante existente, o sistema mostra o(s) contratante(s) parecido(s) e pede confirmação explícita — não impede o cadastro.

### Planejamento próprio da coalizão

- `possui_planejamento_proprio` é **editável a qualquer momento** depois da criação da coalizão, dentro desta spec — não é travado no cadastro.

### Agent's Discretion

- Layout exato dos formulários de cadastro (mandato, coalizão, usuário, contrato) — shadcn/ui + React Hook Form padrão do projeto (AD-021), sem preferência específica levantada.
- Algoritmo exato de match TSE (peso de nome vs. UF vs. cargo, limiar de confiança alta/média/baixa) — fica com o Design; o contrato de dados (`metodo_match`, `confianca`, `status`) já está fechado no schema.
- Concorrência: sem lock otimista nesta v1 — último `UPDATE` vence; `log_auditoria` (PLT-02, transversal) preserva o histórico de qualquer forma.

### Declined / Undiscussed Gray Areas → Assumptions

- **FND-05 (CRUD de catálogos `ref_*`) fica fora desta spec.** O escopo original do usuário não mencionou administração de catálogos; os 16 `ref_*` são pré-requisito (seed via migração/SQL), não uma tela desta feature. Vira spec própria quando/se a operação precisar editar catálogo pela UI em vez de migração.
- **Exclusão de contratante/mandato/coalizão já cadastrado não é capacidade desta spec.** O usuário só pediu exclusão do vínculo do assessor, nunca da entidade. `ON DELETE RESTRICT` no schema já impede apagar um contratante/mandato/coalizão com qualquer contrato vinculado; corrigir um cadastro incorreto é por edição de campo, não por exclusão de linha.
- **Rate limiting de magic link não é requisito desta spec** — é Plataforma (§5.5), transversal a todo login, não específico de Fundação.

---

## Specific References

Nenhuma referência visual ou de produto específico foi trazida pelo usuário — os formulários seguem o padrão shadcn/ui + Tailwind já decidido em AD-021.

---

## Deferred Ideas

- **FND-05 · CRUD de catálogos** — administração via UI dos 16 `ref_*` (hoje via SQL/seed). Fica para spec própria futura.
- **Exclusão física de contratante/mandato/coalizão sem contratos** — não pedida agora; se surgir necessidade de "desfazer cadastro por engano" sem contrato associado, vira decisão de uma spec futura (provavelmente ainda em FND).

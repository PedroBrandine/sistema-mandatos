---
name: ui-ux-pro-max
description: Diretrizes de excelência em UI/UX para aplicações SaaS modernas baseadas em Shadcn UI, Radix, Tailwind CSS e acessibilidade WCAG.
---

# UI/UX Pro Max Skill & Guidelines

## 1. Princípios de Design & Estética
- **Paleta de Cores Semântica**: Utilize tokens semânticos CSS (HSL/RGB) para suporte nativo a temas (Dark/Light Mode). Evite utilitários de cores sólidas sem contexto semântico.
  - `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--muted`, `--muted-foreground`, `--border`, `--accent`.
- **Bordas & Superfícies**: Prefira superfícies limpas com sombras sutis (`shadow-sm`) e bordas com opacidade reduzida (`border-border/60` ou `border-white/10`).
- **Tipografia**: Utilize fontes modernas legíveis (*Geist*, *Inter*, *Outfit*) com hierarquia clara (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-2xl`, `text-3xl font-bold`).

## 2. Padrões de Layout & Componentes
- **Bento Grid**: Para dashboards e telas de visão geral, organize cards em layouts Bento Grid assimétricos com `gap-4` ou `gap-6` e cantos arredondados (`rounded-xl` / `rounded-2xl`).
- **Composição Headless (Radix UI + Shadcn)**:
  - Modais e Dialogs: Sempre implemente com suporte a fechamento por `Esc` e clique fora (`DialogContent`, `DialogHeader`, `DialogFooter`).
  - Selects & Dropdowns: Utilize os primitivos do Radix para navegação segura com teclado e posicionamento dinâmico.
  - Ícones: Padronize com `lucide-react`, mantendo tamanhos consistentes (`w-4 h-4` para botões/menus, `w-5 h-5` para cabeçalhos).

## 3. Acessibilidade (WCAG 2.1 AA)
- **Navegação por Teclado**: Todo elemento interativo deve ter `:focus-visible` visível e destacado (ex: `focus-visible:ring-2 focus-visible:ring-ring`).
- **Leitores de Tela**: Adicione `aria-label` ou `sr-only` em botões apenas com ícones.
- **Contraste**: Mantenha contraste de texto sobre fundo de no mínimo **4.5:1** para texto normal e **3:1** para textos grandes.

## 4. Usabilidade, Feedbacks e Micro-interações
- **Feedback Visual Inmediato**: Botões interativos devem responder a toque/clique (`active:scale-[0.98] transition-transform duration-100`).
- **Carregamento Gracioso (Skeleton Loaders)**: Em chamadas assíncronas (Supabase/API), exiba esqueletos animados (`animate-pulse bg-muted rounded-md`) correspondentes à estrutura final em vez de carregadores genéricos centralizados.
- **Formulários Robustos**: Integre formulários com `react-hook-form` e `zod` com mensagens de erro inline descritivas abaixo dos inputs.

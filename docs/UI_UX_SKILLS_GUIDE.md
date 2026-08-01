# 🎨 UI/UX Skills & Component Reference Guide

Este documento consolida as **Skills de UI/UX**, padrões visuais e referências de repositórios famosos do GitHub integrados ao **Sistema Mandatos**.

---

## 📚 1. Repositórios Famosos de Referência

| Repositório | Propósito no Projeto | Links |
| :--- | :--- | :--- |
| **shadcn/ui** | Base de componentes acessíveis e customizáveis em Tailwind CSS. | [GitHub](https://github.com/shadcn-ui/ui) |
| **Radix UI Primitives** | Primitivas headless para acessibilidade e lógicas de estado interativas. | [GitHub](https://github.com/radix-ui/primitives) |
| **Lucide Icons** | Biblioteca oficial de ícones minimalistas em SVG. | [GitHub](https://github.com/lucide-icons/lucide) |
| **Magic UI & Aceternity** | Inspiração para micro-interações, gradientes e efeitos em landing pages. | [Magic UI](https://github.com/magicuidesign/magicui) \| [Aceternity](https://github.com/aceternity/ui) |
| **Tremor** | Referência para gráficos de performance, KPIs e analytics para dashboards. | [GitHub](https://github.com/tremorlabs/tremor) |

---

## 🛠️ 2. Skills de UI/UX Integradas ao Projeto

As diretrizes abaixo estão configuradas em `.claude/skills/ui-ux-pro-max/SKILL.md` e em `.cursorrules`:

### A. Paleta de Cores & Design Tokens (Tailwind + HSL)
- Mapeamento dinâmico via variáveis CSS para Light / Dark mode.
- Bordas translúcidas (`border-border/60`) e superfícies elevadas suaves (`shadow-sm`, `bg-card`).

### B. Formulários & Validação Ativa
- Toda entrada de dados utiliza **React Hook Form** integrado ao **Zod**.
- Trate sempre erros de validação diretamente abaixo do input com cor de alerta semântica (`text-destructive text-xs mt-1`).

### C. Acessibilidade (WCAG 2.1 AA)
- Foco visível padrão: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
- Ícones sem texto descritivo devem acompanhar `aria-label` ou rótulos acessíveis `<span class="sr-only">`.

### D. Padrão de Layout (Bento Grid)
```tsx
// Exemplo de Layout Bento Grid para Dashboards
<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
  <div className="md:col-span-2 lg:col-span-3 p-6 bg-card border rounded-xl shadow-sm">
    {/* Conteúdo Principal / Gráfico */}
  </div>
  <div className="p-6 bg-card border rounded-xl shadow-sm">
    {/* Resumo / KPI Secundário */}
  </div>
</div>
```

---

## 📂 3. Estrutura de Arquivos no Repositório
- **Skill de IA**: `.claude/skills/ui-ux-pro-max/SKILL.md`
- **Regras do Editor (Cursor)**: `.cursorrules`
- **Componentes Reutilizáveis**: `src/frontend/components/ui/`

import { EstadoVazio } from "@/components/ui/estado-vazio";

interface EmDesenvolvimentoProps {
  titulo: string;
  mensagem?: string;
}

// Placeholder padronizado "X em desenvolvimento" -- usado por Agenda, Visão
// Gerencial, Formulários, Planejamento e o bloco de Kanban/indicadores do
// Dashboard (ver design.md, Components -> EmDesenvolvimento). Reaproveita
// <EstadoVazio> (AD-029) sem alteração.
export function EmDesenvolvimento({ titulo, mensagem }: EmDesenvolvimentoProps) {
  return <EstadoVazio titulo={titulo} mensagem={mensagem} />;
}

import type { RegistroMentor } from "@backend/queries/pll-dashboard";

import { diaNoFusoDoProduto, horaNoFusoDoProduto } from "@/components/estrategia/agenda-mes";
import { EstadoVazio } from "@/components/ui/estado-vazio";

// pll-dashboard-agenda T11 (design.md "FeedRegistrosMentores", PLL-DB-12…14,
// D-7). Lista dos 10 Registros mais recentes dos mentores (Figma 44:477,
// "Registros e comentários dos mentores" -- renomeado para "Registros dos
// mentores": "Comentário" não é entidade do domínio, D-7).
//
// `hoje` é PROP OBRIGATÓRIA, no formato "YYYY-MM-DD" já no fuso do produto
// (mesma convenção de AgendaMes.hoje / hojeNoFusoDoProduto) -- nunca
// `new Date()` lido aqui dentro (lição L-002): quem monta a página decide a
// data de referência, o que torna PLL-DB-13 testável nos 3 casos (hoje,
// ontem, mais antigo) sem congelar relógio no teste deste componente.
const NOMES_MES_ABREV = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function diaAnterior(dia: string): string {
  const data = new Date(`${dia}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() - 1);
  return data.toISOString().slice(0, 10);
}

// PLL-DB-13: "Hoje às HH:mm" / "Ontem às HH:mm" nos dois dias mais recentes,
// "DD Mmm, AAAA" nos demais -- tudo no fuso do produto (D-7:
// fat_registro.ocorrido_em é TIMESTAMPTZ, então a hora é real).
export function formatarDataHoraRegistro(ocorridoEm: string, hoje: string): string {
  const dia = diaNoFusoDoProduto(ocorridoEm);
  const hora = horaNoFusoDoProduto(ocorridoEm);
  if (dia === hoje) return `Hoje às ${hora}`;
  if (dia === diaAnterior(hoje)) return `Ontem às ${hora}`;
  const [ano, mes, diaDoMes] = dia.split("-");
  const indiceMes = Number(mes) - 1;
  const nomeMes = indiceMes >= 0 && indiceMes < 12 ? NOMES_MES_ABREV[indiceMes] : mes;
  return `${diaDoMes} ${nomeMes}, ${ano}`;
}

export interface FeedRegistrosMentoresProps {
  registros: RegistroMentor[];
  /** Data de referência "YYYY-MM-DD" no fuso do produto (L-002). */
  hoje: string;
}

function ItemRegistro({ registro, hoje }: { registro: RegistroMentor; hoje: string }) {
  return (
    <li className="grid gap-1 border-b border-border/60 py-3 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-sm font-bold text-foreground">{registro.nomeAutor}</p>
        <p className="text-xs text-muted-foreground">{formatarDataHoraRegistro(registro.ocorridoEm, hoje)}</p>
      </div>
      <p className="text-xs text-muted-foreground">Mentorado: {registro.nomeMentorado ?? "—"}</p>
      {/* PLL-DB-14: resumo ausente vira "—", nunca célula/parágrafo em branco (AD-005). */}
      <p className="text-sm text-foreground">{registro.resumo ?? "—"}</p>
    </li>
  );
}

export function FeedRegistrosMentores({ registros, hoje }: FeedRegistrosMentoresProps) {
  return (
    <div className="grid gap-2">
      <p className="font-heading text-xl text-secondary">Registros dos mentores</p>

      {registros.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum registro no recorte"
          mensagem="Os mentores ainda não lançaram nenhum registro para o recorte atual."
        />
      ) : (
        <ul>
          {registros.map((registro) => (
            <ItemRegistro key={registro.idRegistro} registro={registro} hoje={hoje} />
          ))}
        </ul>
      )}
    </div>
  );
}

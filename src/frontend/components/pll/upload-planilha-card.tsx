"use client";

import { AlertCircle, Download, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

import {
  ErroCabecalhoDesconhecido,
  parseCadastroPll,
  validarLinhasCadastroPll,
  type ErroLinhaCadastroPll,
  type LinhaCadastroPll,
} from "@backend/schemas/cadastro-participante-pll";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErroInline } from "@/components/ui/erro-inline";
import { cn } from "@/lib/utils";

// PLL-CP-01…04 (spec.md), Figma 387:4 ("import-section-card"): upload +
// parse (T4) + validação (T3) + import. Presentational com uma orquestração
// fina por cima -- não busca dado, não escreve no banco: `onImportar` recebe
// as linhas já validadas e quem chama este componente (T9, fora do Lote 1)
// decide como persistir (upsertCadastroParticipantes, T5) e como recarregar
// métricas/última importação.

export interface MetricasCadastroPll {
  participantesCadastrados: number;
  pendentesRevisao: number;
  comDadosIncompletos: number;
}

export interface UltimaImportacaoPll {
  data: string;
  nomeUsuario: string;
}

export interface UploadPlanilhaCardProps {
  metricas: MetricasCadastroPll;
  ultimaImportacao: UltimaImportacaoPll | null;
  onImportar: (linhas: LinhaCadastroPll[]) => void | Promise<void>;
}

// AD-005: ausência é "—", nunca "N/A" -- mesmo padrão de
// incidencia/cadeia-lista.tsx `formatarData`.
function formatarData(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function UploadPlanilhaCard({ metricas, ultimaImportacao, onImportar }: UploadPlanilhaCardProps) {
  const [arrastando, setArrastando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [errosLinha, setErrosLinha] = useState<ErroLinhaCadastroPll[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function processarArquivo(arquivo: File) {
    setErroGeral(null);
    setErrosLinha(null);
    setCarregando(true);
    try {
      const conteudo = await arquivo.arrayBuffer();
      let linhasBrutas: unknown[];
      try {
        linhasBrutas = parseCadastroPll(conteudo);
      } catch (erro) {
        if (erro instanceof ErroCabecalhoDesconhecido) {
          setErroGeral(erro.message);
          return;
        }
        throw erro;
      }

      // PLL-CP-02: nunca importar parcialmente -- qualquer erro invalida o
      // lote inteiro, e a lista completa de erros por linha/coluna fica visível.
      const resultado = validarLinhasCadastroPll(linhasBrutas);
      if (resultado.erros.length > 0) {
        setErrosLinha(resultado.erros);
        return;
      }

      await onImportar(resultado.validas);
    } catch (erro) {
      setErroGeral(erro instanceof Error ? erro.message : "Falha ao importar a planilha.");
    } finally {
      setCarregando(false);
    }
  }

  function aoSelecionarArquivo(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (arquivo) void processarArquivo(arquivo);
  }

  function aoSoltarArquivo(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setArrastando(false);
    const arquivo = event.dataTransfer.files?.[0];
    if (arquivo) void processarArquivo(arquivo);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Importar planilha de cadastro</CardTitle>
        {/* Edge case da spec.md: exportar dados é P3/fora do MVP se não houver
            tempo -- mantido visível (fidelidade ao Figma 387:32) e desabilitado,
            em vez de implementar a exportação sem pedido explícito de task. */}
        <Button type="button" variant="outline" size="sm" disabled title="Exportar dados (em breve)">
          <Download />
          Exportar dados
        </Button>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[1fr_340px]">
        <div
          data-arrastando={arrastando}
          onDragOver={(event) => {
            event.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={aoSoltarArquivo}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/60 px-6 py-10 text-center",
            arrastando && "border-primary bg-primary/5"
          )}
        >
          <UploadCloud className="size-8 text-muted-foreground" aria-hidden />
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <span>Arraste o arquivo .xlsx aqui ou</span>
            <Button
              type="button"
              variant="vinho"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={carregando}
            >
              Selecionar arquivo
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            aria-label="Selecionar arquivo de planilha"
            onChange={aoSelecionarArquivo}
          />
          <p className="text-xs text-muted-foreground">
            Formatos aceitos: .xlsx, .csv — Última importação:{" "}
            {ultimaImportacao ? `${formatarData(ultimaImportacao.data)} por ${ultimaImportacao.nomeUsuario}` : "—"}
          </p>
        </div>

        <div className="rounded-lg border border-border/60 p-4">
          <p className="mb-3 text-sm font-medium">Métricas de cadastro</p>
          <dl className="grid gap-2 text-sm">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <dt className="text-muted-foreground">Participantes cadastrados</dt>
              <dd>{metricas.participantesCadastrados}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <dt className="text-muted-foreground">Pendentes de revisão</dt>
              <dd>{metricas.pendentesRevisao}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Com dados incompletos</dt>
              <dd>{metricas.comDadosIncompletos}</dd>
            </div>
          </dl>
        </div>
      </CardContent>

      {erroGeral ? (
        <CardContent>
          <ErroInline titulo="Não foi possível importar a planilha" mensagem={erroGeral} />
        </CardContent>
      ) : null}

      {errosLinha && errosLinha.length > 0 ? (
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>
              Importação rejeitada: {errosLinha.length} erro{errosLinha.length > 1 ? "s" : ""} encontrado
              {errosLinha.length > 1 ? "s" : ""}
            </AlertTitle>
            <AlertDescription>
              <p>Nenhuma linha foi importada. Corrija os itens abaixo e envie a planilha novamente.</p>
              <ul className="list-disc space-y-1 pl-5">
                {errosLinha.map((erro, indice) => (
                  <li key={indice}>
                    Linha {erro.linha}
                    {erro.campo ? `, campo "${erro.campo}"` : ""}: {erro.mensagem}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      ) : null}
    </Card>
  );
}

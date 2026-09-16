"use client";

import { use, useCallback, useEffect, useState } from "react";
import { notFound } from "next/navigation";

import { createClient } from "@backend/supabase/client";
import { buscarContratoParaFicha, type ContratoParaFicha } from "@backend/queries/contrato";
import { buscarInformacoesGeraisMandato, type InformacoesGeraisMandato } from "@backend/queries/ficha-mandato";

import { CardHistoricoContratos } from "@/components/fundacao/card-historico-contratos";
import { CardPontoFocal } from "@/components/fundacao/card-ponto-focal";
import { CardProjetosCoalizoes } from "@/components/fundacao/card-projetos-coalizoes";
import { CardSobreMandato } from "@/components/fundacao/card-sobre-mandato";
import { InformacoesTseMandato } from "@/components/fundacao/informacoes-tse-mandato";
import { CarregandoSkeleton } from "@/components/ui/carregando-skeleton";
import { ErroInline } from "@/components/ui/erro-inline";

// FMC-05..FMC-13 (.specs/features/ficha-mandato-contrato/spec.md, "P1:
// Informações Gerais do mandato"). Monta os 4 cards novos de T25-T28 mais a
// seção TSE já existente (informacoes-tse-mandato.tsx), que DESCE para uma
// seção própria dentro da mesma aba -- ela não é substituída (design.md,
// Code Reuse Analysis). Layout de duas colunas conforme o desenho `57:6`:
// coluna esquerda com a identidade editorial do mandato (Sobre o Mandato +
// Ponto Focal e Gestoras), coluna direita com o histórico administrativo
// (Histórico de Contratos + Projetos e Coalizões Vinculados); o TSE ocupa a
// largura cheia abaixo das duas.
//
// contrato: undefined=carregando, null=confirmado ausente/coalizão --
// notFound() só é chamado no corpo do render (nunca dentro do useEffect que
// popula o estado), mesmo padrão de ficha-contrato-chrome.tsx e das demais
// sub-rotas desta ficha. `erro` cobre a falha de
// buscarInformacoesGeraisMandato (RLS negando leitura, AD-001, ou qualquer
// outra falha de leitura) -- a query lança em vez de devolver undefined
// nesse caso, então precisa de try/catch aqui.
export default function InformacoesContratoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idContrato = Number(id);

  const [contrato, setContrato] = useState<ContratoParaFicha | null | undefined>(undefined);
  const [dados, setDados] = useState<InformacoesGeraisMandato | null | undefined>(undefined);
  const [erro, setErro] = useState<string | null>(null);

  const carregarDados = useCallback(async () => {
    setErro(null);
    try {
      const resultado = await buscarInformacoesGeraisMandato(createClient(), idContrato);
      setDados(resultado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar as informações gerais do mandato.");
    }
  }, [idContrato]);

  useEffect(() => {
    let cancelado = false;
    const supabase = createClient();

    buscarContratoParaFicha(supabase, idContrato).then((encontrado) => {
      if (cancelado) return;
      const valido = encontrado && encontrado.tipoContratante === "mandato" && encontrado.idMandato != null;
      setContrato(valido ? encontrado : null);
    });

    return () => {
      cancelado = true;
    };
  }, [idContrato]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  if (contrato === null) {
    notFound();
  }

  if (contrato === undefined || dados === undefined) {
    return erro ? <ErroInline mensagem={erro} onRetry={carregarDados} /> : <CarregandoSkeleton />;
  }

  if (erro) {
    return <ErroInline mensagem={erro} onRetry={carregarDados} />;
  }

  if (!dados) {
    // buscarInformacoesGeraisMandato devolve null quando o contrato não tem
    // dim_mandato -- não deveria acontecer aqui (contrato já filtrado acima
    // por tipoContratante === "mandato"), mas trata explicitamente em vez de
    // deixar a tela quebrar (AD-005).
    return (
      <ErroInline mensagem="Não foi possível carregar as informações gerais deste mandato." onRetry={carregarDados} />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-6">
          <CardSobreMandato
            idMandato={dados.idMandato}
            minibiografia={dados.minibiografia}
            principaisPautas={dados.principaisPautas}
            areasTematicas={dados.areasTematicas}
            contatoParlamentar={dados.contatoParlamentar}
            contatoChefeGabinete={dados.contatoChefeGabinete}
            onAtualizado={carregarDados}
          />
          <CardPontoFocal
            idContrato={idContrato}
            pontoFocal={dados.pontoFocal}
            gestoras={dados.gestoras}
            onAtualizado={carregarDados}
          />
        </div>

        <div className="grid gap-6">
          <CardHistoricoContratos contratos={dados.historicoContratos} />
          <CardProjetosCoalizoes projeto={dados.projeto} coalizoes={dados.coalizoes} />
        </div>
      </div>

      <InformacoesTseMandato idMandato={dados.idMandato} />
    </div>
  );
}

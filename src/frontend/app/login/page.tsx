import { LoginForm } from "@/components/login-form";

// Ref do projeto Supabase de PRODUÇÃO. O aviso de ambiente é derivado da URL
// do banco a que este build se conecta -- e não de uma flag separada, que
// poderia divergir da realidade. Se o app não estiver falando com o banco de
// produção, ele é um ambiente de desenvolvimento, ponto.
//
// `process.env.NEXT_PUBLIC_*` é inlinado em tempo de build (Next 16), e cada
// ambiente da Vercel builda com suas próprias variáveis: Production recebe o
// ref de prod, Preview e Development recebem o de dev. A referência abaixo
// precisa ser literal -- lookup dinâmico não é inlinado.
const REF_SUPABASE_PROD = "dgoutrbqfuyaroobhxdq";

// Falha para o lado seguro: sem a variável definida, mostra o aviso. É melhor
// avisar "desenvolvimento" por engano do que deixar produção sem distinção.
const ehProducao =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(REF_SUPABASE_PROD) ?? false;

// CVT-06/08. `msg` chega de /convite/[token]/consumir/route.ts
// (MotivoSemLogin em consumir-convite.ts) -- achado do Verifier independente
// (rodada 2, validation.md): a página nunca lia searchParams, então as 3
// mensagens distintas de pós-convite nunca apareciam pra ninguém.
const MENSAGENS_POS_CONVITE: Record<string, string> = {
  conta_existente: "Você já tem uma conta — entre com sua senha atual. Seu novo acesso já foi liberado.",
  sessao_ativa:
    "Sua conta foi criada, mas você já estava logado como outra pessoa. Saia e entre com a senha que você definiu para usar o novo acesso.",
  login_automatico_falhou: "Sua conta foi criada. Entre com a senha que você acabou de definir.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const mensagemPosConvite = msg ? MENSAGENS_POS_CONVITE[msg] : undefined;

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {!ehProducao && (
          <p
            role="status"
            className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-sm font-medium text-amber-700 dark:text-amber-400"
          >
            Ambiente de desenvolvimento
          </p>
        )}
        {mensagemPosConvite && (
          <p
            role="status"
            className="mb-4 rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-center text-sm font-medium text-blue-700 dark:text-blue-400"
          >
            {mensagemPosConvite}
          </p>
        )}
        <h1 className="mb-6 text-xl font-semibold">Entrar</h1>
        <LoginForm />
      </div>
    </div>
  );
}

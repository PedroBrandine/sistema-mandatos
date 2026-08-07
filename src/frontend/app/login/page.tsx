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

export default function LoginPage() {
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
        <h1 className="mb-6 text-xl font-semibold">Entrar</h1>
        <LoginForm />
      </div>
    </div>
  );
}

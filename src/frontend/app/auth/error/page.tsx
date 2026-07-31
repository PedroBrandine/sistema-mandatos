export default async function ErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold">Não foi possível entrar</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error ?? "Ocorreu um erro não especificado."}
        </p>
      </div>
    </div>
  );
}

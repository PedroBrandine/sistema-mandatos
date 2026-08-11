import { FichaContratoChrome } from "@/components/produtos/ficha-contrato-chrome";

// NAV-04: Server Component -- só resolve id (Next 16, params é Promise) e
// delega o fetch/cabeçalho/abas ao FichaContratoChrome (client). Layout
// aninhado do App Router faz /contratos/[id]/vinculos herdar este chrome de
// graça, sem alteração naquela rota (design.md, Code Reuse Analysis).
export default async function ContratoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <FichaContratoChrome idContrato={Number(id)}>{children}</FichaContratoChrome>;
}

import { Sidebar } from "@/components/app-shell/sidebar";

// CAD-14/CAD-15: layout aninhado (não root -- app/layout.tsx continua sendo
// o único root layout) que envolve toda tela autenticada com a sidebar fixa.
// O gate de auth continua 100% no proxy.ts (AD-002); este layout só decora
// quem já passou por ele, não decide acesso.
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

import type { Metadata } from "next";
import { Anton, Commissioner } from "next/font/google";
import "./globals.css";

import { Providers } from "@/components/providers";

// docs/Identidade Visual Legisla.md ("Tipografia"): Anton só para títulos
// grandes de página e números de KPI (sempre caixa alta); Commissioner para
// todo o resto -- rótulos, tabelas, botões, corpo. Substitui Outfit/Inter,
// que divergiam do documento aprovado (AD-027 manda a identidade visual
// entrar via CSS vars nestes dois tokens, nunca font-family hardcoded
// componente a componente). Anton só tem peso 400 no Google Fonts -- correto,
// a marca não usa Anton em outro peso.
const anton = Anton({
  variable: "--font-heading",
  weight: "400",
  subsets: ["latin"],
});

const commissioner = Commissioner({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sistema Mandatos - Legisla Brasil",
  description: "Gestão de mandatos, coalizões e vínculos eleitorais da Legisla Brasil",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${commissioner.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

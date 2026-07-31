import type { Metadata } from "next";
import { Anton, Commissioner } from "next/font/google";
import "./globals.css";

const anton = Anton({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "400",
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

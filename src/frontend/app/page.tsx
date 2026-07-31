import { redirect } from "next/navigation";

// Decisão de design (Tech Decisions, design.md): "/" era o scaffold padrão
// do create-next-app, nunca customizado. Agora que a sidebar existe em
// volta dele, redireciona pra /mandatos em vez de deixar o placeholder.
export default function Home() {
  redirect("/mandatos");
}

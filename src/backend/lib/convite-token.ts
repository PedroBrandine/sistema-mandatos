// CVT-02. Token de convite: gerado e hasheado via Web Crypto API
// (crypto.getRandomValues/crypto.subtle.digest), disponível tanto no
// navegador (emissão, ConviteForm) quanto no runtime Node do Route Handler
// (consumo, /convite/[token]/route.ts) sem dependência nova -- global
// `crypto`, sem import (design.md Tech Decisions).
//
// O token em claro nunca é persistido: só o hash (SHA-256 hex) vai pro
// banco, via app.emitir_convite. O token em claro só existe na URL devolvida
// uma vez ao emissor.

function bytesParaHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 32 bytes de entropia (256 bits), hex -- 64 caracteres. */
export function gerarToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesParaHex(bytes);
}

/** SHA-256 do token, hex -- 64 caracteres. Determinístico: mesma entrada, mesmo hash. */
export async function hashToken(token: string): Promise<string> {
  const bytesEntrada = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytesEntrada);
  return bytesParaHex(new Uint8Array(digest));
}

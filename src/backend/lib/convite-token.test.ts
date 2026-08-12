import { describe, expect, it } from "vitest";

import { gerarToken, hashToken } from "./convite-token";

describe("gerarToken", () => {
  it("devolve hex de 64 caracteres (32 bytes de entropia)", () => {
    const token = gerarToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("nunca colide em 1000 execuções", () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => gerarToken()));
    expect(tokens.size).toBe(1000);
  });
});

describe("hashToken", () => {
  it("é determinístico: mesma entrada produz o mesmo hash", async () => {
    const token = gerarToken();
    const hash1 = await hashToken(token);
    const hash2 = await hashToken(token);
    expect(hash1).toBe(hash2);
  });

  it("produz hex de 64 caracteres (SHA-256)", async () => {
    const hash = await hashToken("qualquer-entrada");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes de dois tokens diferentes são diferentes", async () => {
    const hash1 = await hashToken(gerarToken());
    const hash2 = await hashToken(gerarToken());
    expect(hash1).not.toBe(hash2);
  });
});

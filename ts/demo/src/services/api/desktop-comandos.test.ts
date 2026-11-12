// node --test src/services/api/desktop-comandos.test.ts  (npm run test:unit)
import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirEnvio, ehPararTudo } from "./desktop-comandos.ts";

test("reconhece variações de 'pare tudo'", () => {
  for (const t of ["pare tudo", "Oracle, pare tudo!", "PARAR TUDO", "oracle para tudo.", "interrompa agora"]) {
    assert.equal(ehPararTudo(t), true, t);
  }
  for (const t of ["pare tudo e abra o Figma", "não pare tudo", "parece tudo bem", "pare"]) {
    assert.equal(ehPararTudo(t), false, t);
  }
});

test("GB-03: 'pare tudo' passa mesmo durante uma execução", () => {
  assert.equal(decidirEnvio("Oracle, pare tudo", true), "parar");
  assert.equal(decidirEnvio("pare tudo", false), "parar");
  assert.equal(decidirEnvio("abra o Figma", true), "ignorar");
  assert.equal(decidirEnvio("abra o Figma", false), "enviar");
  assert.equal(decidirEnvio("   ", false), "ignorar");
});

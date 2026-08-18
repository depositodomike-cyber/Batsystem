import axios from "@/utils/axios";

/**
 * Cliente do contador de tokens da IA (backend ts/api → GET /uso/tokens).
 * Retorna o consumo do usuário logado nas janelas de 1h/24h/7d/30d. O JWT é
 * injetado automaticamente pelo axios (utils/jwt.ts → setSession).
 */

export interface UsoJanela {
  entrada: number;
  saida: number;
  total: number;
}

export interface UsoTokens {
  hora: UsoJanela;
  dia: UsoJanela;
  semana: UsoJanela;
  mes: UsoJanela;
}

const JANELAS = ["hora", "dia", "semana", "mes"] as const;

function numero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Uma janela sempre completa: campo ausente vira 0, `total` ausente vira a soma. */
function janela(v: unknown): UsoJanela {
  const o = (v ?? {}) as Record<string, unknown>;
  const entrada = numero(o.entrada);
  const saida = numero(o.saida);
  const total = o.total == null ? entrada + saida : numero(o.total);
  return { entrada, saida, total };
}

/**
 * Normaliza a resposta antes de entregá-la aos consumidores.
 *
 * O contador vive no header de TODA página autenticada e lia `uso.hora.total`
 * direto. Qualquer corpo fora do previsto — uma janela ausente, ou HTML de um
 * SPA fallback quando a chamada não chega à API — virava
 * `TypeError: Cannot read properties of undefined (reading 'total')`, que o
 * error boundary do React Router promovia à tela "Application error",
 * derrubando a rota inteira por causa de um widget de header.
 *
 * Corpo que não é objeto vira erro: os dois consumidores já tratam a rejeição
 * mantendo os últimos valores bons. O `console.warn` registra o que chegou,
 * para o caso não ficar invisível como ficou até agora.
 */
function normalizar(data: unknown): UsoTokens {
  if (!data || typeof data !== "object") {
    const amostra = String(data).replace(/\s+/g, " ").slice(0, 120);
    console.warn(`[uso/tokens] corpo inesperado (${typeof data}): ${amostra}`);
    throw new Error("GET /uso/tokens devolveu um corpo inesperado.");
  }

  const o = data as Record<string, unknown>;
  const ausentes = JANELAS.filter((k) => o[k] == null);
  if (ausentes.length) {
    console.warn(
      `[uso/tokens] janelas ausentes na resposta: ${ausentes.join(", ")}`,
      data,
    );
  }

  return {
    hora: janela(o.hora),
    dia: janela(o.dia),
    semana: janela(o.semana),
    mes: janela(o.mes),
  };
}

export async function fetchUsoTokensApi(): Promise<UsoTokens> {
  const { data } = await axios.get<unknown>("/uso/tokens");
  return normalizar(data);
}

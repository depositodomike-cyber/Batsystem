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

export async function fetchUsoTokensApi(): Promise<UsoTokens> {
  const { data } = await axios.get<UsoTokens>("/uso/tokens");
  return data;
}

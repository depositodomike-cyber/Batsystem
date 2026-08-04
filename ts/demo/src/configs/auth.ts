/**
 * Base URL da API (backend ts/api — NestJS).
 *
 * Definida por `VITE_API_URL` em `.env`. Fallback para o backend local em dev.
 */
export const JWT_HOST_API: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:3001";

import axios, { AxiosError, AxiosResponse } from "axios";
import { JWT_HOST_API } from "@/configs/auth";
import { repositorioPastaAtivo } from "@/app/pages/ceo/memoria-inventario";

const axiosInstance = axios.create({
  baseURL: JWT_HOST_API,
});

/** Header em que o repositório ativo viaja (ver RepositorioAtual, no backend). */
export const HEADER_REPOSITORIO = "X-Repositorio-Id";

/**
 * Injeta o repositório (contexto) ativo em toda requisição.
 *
 * Vai por header, e não no corpo, porque o ValidationPipe do backend roda com
 * `forbidNonWhitelisted: true`: um campo extra no body faria a requisição
 * falhar com 400, e incluí-lo exigiria mexer nos DTOs de todos os endpoints e
 * nos 28 clientes deste diretório. Assim nenhum deles muda.
 *
 * É o que isola o índice de notas por repositório: sem isso, sincronizar uma
 * pasta apaga as notas das outras e a IA responde misturando contextos.
 */
axiosInstance.interceptors.request.use((config) => {
  const repositorioId = repositorioPastaAtivo();
  if (repositorioId) config.headers.set(HEADER_REPOSITORIO, repositorioId);
  return config;
});

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) =>
    Promise.reject(error.response?.data || "Something went wrong")
);

export default axiosInstance;

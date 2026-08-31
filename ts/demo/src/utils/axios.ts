import axios, { AxiosError, AxiosResponse } from "axios";
import { JWT_HOST_API } from "@/configs/auth";
import { repositorioPastaAtivo } from "@/app/pages/ceo/memoria-inventario";
import { sessaoLocalAtiva, tokenArmazenado } from "@/utils/sessaoLocal";

const axiosInstance = axios.create({
  baseURL: JWT_HOST_API,
});

/**
 * Rejeição usada quando a requisição não obteve resposta HTTP nenhuma: servidor
 * fora do ar, DNS, ou preflight de CORS barrado.
 *
 * É constante exportada, e não um literal solto, porque `motivoLocal`
 * (services/api/contaBackend.ts) compara por identidade para decidir entrar em
 * modo local. Enquanto isso era a string "Something went wrong" repetida nos
 * dois arquivos, mudar o texto de um lado quebrava a detecção do outro em
 * silêncio.
 *
 * O texto muda em dev — a identidade, não. Em produção "servidor indisponível"
 * é tudo o que se pode dizer, mas em dev a causa quase sempre é a API local que
 * não subiu, e o erro genérico mandava procurar no lugar errado. Dizer QUAL
 * servidor não respondeu e QUAL comando o levanta economiza a investigação.
 */
export const ERRO_SEM_RESPOSTA = import.meta.env.DEV
  ? `A API não respondeu em ${JWT_HOST_API}. Rode "npm run start:dev" em ts/api (o Postgres sobe com "npm run db:up").`
  : "Servidor indisponível. Tente novamente.";

/** 401 recebido enquanto a sessão é local — ver utils/sessaoLocal.ts. */
export const ERRO_SESSAO_LOCAL =
  "Sua sessão está em modo local, sem acesso ao servidor. Saia e entre novamente para continuar.";

/**
 * Endpoints que estabelecem a sessão. Um 401 aqui é credencial errada, não
 * sessão local — traduzir seria enganoso, e `credenciaisInvalidas` depende
 * dessa distinção para decidir entre registrar e acusar conflito.
 */
const ROTAS_DE_SESSAO = ["/login", "/registrar"];

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

  // O token vem do storage a CADA requisição, e não de `axios.defaults`. O
  // header em defaults só existia depois que `setSession` rodava, no efeito
  // async do AuthProvider; como efeito de filho roda antes do efeito do pai,
  // MemoryProvider, ConversasProvider & cia. disparavam a primeira chamada sem
  // Authorization e levavam 401 — que o produto exibia como "servidor
  // indisponível". Aqui o storage é a fonte da verdade: sem token, o header sai
  // fora, para um `defaults` velho não vazar depois do logout.
  const token = tokenArmazenado();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  else config.headers.delete("Authorization");

  return config;
});

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (!error.response) return Promise.reject(ERRO_SEM_RESPOSTA);

    // Um 401 com token de protótipo não é sessão expirada: é uma sessão que
    // nunca existiu no servidor. Sem esta tradução o usuário vê o
    // "Unauthorized" do Nest, que não diz o que fazer a respeito.
    const rota = error.config?.url ?? "";
    if (
      error.response.status === 401 &&
      !ROTAS_DE_SESSAO.some((r) => rota.startsWith(r)) &&
      sessaoLocalAtiva()
    ) {
      return Promise.reject({
        message: ERRO_SESSAO_LOCAL,
        statusCode: 401,
      });
    }

    return Promise.reject(error.response.data || ERRO_SEM_RESPOSTA);
  }
);

export default axiosInstance;

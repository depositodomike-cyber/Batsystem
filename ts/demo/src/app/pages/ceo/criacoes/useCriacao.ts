import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
  criarCriacaoApi,
  obterCriacaoApi,
  salvarCriacaoApi,
  type CriacaoCompleta,
  type CriacaoStatus,
  type CriacaoTipo,
} from "@/services/api/criacoes";

// ----------------------------------------------------------------------
// Persistência de um trabalho do AI Studio.
//
// O contrato é declarativo: a tela diz, a cada render, "este é o meu estado
// atual, e ele vale a pena ser guardado ou não". O hook cuida do resto —
// quando criar, quando gravar, como não gravar duas vezes ao mesmo tempo.
//
// Três decisões que explicam o desenho:
//
// 1) RASCUNHO NÃO NASCE DE UM CLIQUE. Abrir "Criar planilha" não cria registro
//    nenhum; quem decide se já existe trabalho relevante é a tela, no campo
//    `relevante`. Sem isso a Home encheria de sessões vazias.
//
// 2) AUTOSAVE COM DEBOUNCE, e não a cada tecla. Um PATCH por caractere digitado
//    não ajudaria ninguém e castigaria o banco.
//
// 3) MARCOS GRAVAM NA HORA. Plano pronto, geração concluída e falha não esperam
//    o debounce: são os estados que a pessoa espera encontrar na Home se fechar
//    a aba no segundo seguinte.
// ----------------------------------------------------------------------

/** O retrato do trabalho num instante — o que a tela manda persistir. */
export interface EstadoCriacao {
  /**
   * Já há trabalho que valha um registro? `false` antes disso, e nada é criado.
   * Depois de criada, a criação continua sendo gravada de qualquer jeito: o
   * usuário pode apagar o briefing, e apagar também é uma alteração.
   */
  relevante: boolean;
  titulo: string;
  status: CriacaoStatus;
  etapa: string;
  dados: Record<string, unknown>;
}

/** ~1,5s parado é o sinal de que a pessoa terminou de escrever um trecho. */
const DEBOUNCE_MS = 1500;

export interface UsoCriacao {
  /** Id da criação, ou `null` enquanto ela não existe. */
  id: string | null;
  /** Retomando uma criação existente (veio `?criacao=` na URL). */
  carregando: boolean;
  /** A criação retomada. `null` numa criação nova. */
  carregada: CriacaoCompleta | null;
  /** Falha ao retomar — id inexistente, de outra pessoa, ou servidor fora. */
  erroAoCarregar: string | null;
  /** Grava com debounce. Chamar a cada mudança é o uso esperado. */
  sincronizar: (estado: EstadoCriacao) => void;
  /** Grava agora, sem esperar o debounce. Para marcos. */
  gravarAgora: (estado: EstadoCriacao) => Promise<void>;
}

export function useCriacao(tipo: CriacaoTipo): UsoCriacao {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * O id a retomar, lido só na montagem.
   *
   * Não pode ser `searchParams.get()` a cada render: este mesmo hook ESCREVE
   * `?criacao=` na URL assim que a criação nasce, e ler de volta faria o efeito
   * de retomada disparar sobre a criação que acabou de ser criada — buscando no
   * servidor o que já está na tela.
   */
  const [idInicial] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("criacao"),
  );

  const [id, setId] = useState<string | null>(idInicial);
  const [carregando, setCarregando] = useState(Boolean(idInicial));
  const [carregada, setCarregada] = useState<CriacaoCompleta | null>(null);
  const [erroAoCarregar, setErroAoCarregar] = useState<string | null>(null);

  // Refs, e não estado: estas coisas mudam no meio de operações assíncronas e
  // não devem provocar renderização.
  const idRef = useRef<string | null>(idInicial);
  const pendenteRef = useRef<EstadoCriacao | null>(null);
  const gravandoRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- retomar ----
  // Sem `setCarregando(true)` aqui: o estado já nasce `true` quando há id, e
  // este efeito roda uma vez só.
  useEffect(() => {
    if (!idInicial) return;
    let vivo = true;
    obterCriacaoApi(idInicial)
      .then((c) => {
        if (!vivo) return;
        idRef.current = c.id;
        setId(c.id);
        setCarregada(c);
      })
      .catch(() => {
        if (!vivo) return;
        // 404 aqui é o caso normal de um link velho ou de uma criação de outra
        // pessoa — e os dois merecem a mesma frase, porque a distinção é
        // justamente o que não deve vazar.
        setErroAoCarregar(
          "Esta criação não está mais disponível. Comece uma nova.",
        );
        idRef.current = null;
        setId(null);
      })
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [idInicial]);

  /**
   * A gravação em si.
   *
   * `gravandoRef` serializa: se uma escrita chega enquanto outra está no ar, a
   * nova fica pendente e roda logo depois. Sem isso, duas respostas fora de
   * ordem podem gravar um estado velho por cima de um novo.
   */
  const gravar = useCallback(
    async (estado: EstadoCriacao): Promise<void> => {
      if (gravandoRef.current) {
        pendenteRef.current = estado;
        return;
      }
      gravandoRef.current = true;
      try {
        // Laço, e não recursão: enquanto uma escrita está no ar, a próxima fica
        // na fila e é consumida aqui. É o que garante que a última versão
        // digitada seja a última a chegar ao banco.
        let atual: EstadoCriacao | null = estado;
        while (atual) {
          const agora: EstadoCriacao = atual;
          atual = null;
          if (!idRef.current && !agora.relevante) break;
          try {
            if (!idRef.current) {
              const criada = await criarCriacaoApi({
                tipo,
                titulo: agora.titulo,
                status: agora.status,
                etapa: agora.etapa,
                dados: agora.dados,
              });
              idRef.current = criada.id;
              setId(criada.id);
            } else {
              await salvarCriacaoApi(idRef.current, {
                titulo: agora.titulo,
                status: agora.status,
                etapa: agora.etapa,
                dados: agora.dados,
              });
            }
          } catch {
            // Silencioso de propósito: autosave que grita a cada falha de rede
            // atrapalha mais do que ajuda, e o trabalho continua na tela. O que
            // não pode é a falha sumir para sempre — por isso o estado volta
            // para a fila, e a próxima gravação tenta de novo.
            pendenteRef.current = agora;
            break;
          }
          atual = pendenteRef.current;
          pendenteRef.current = null;
        }
      } finally {
        gravandoRef.current = false;
      }
    },
    [tipo],
  );

  const sincronizar = useCallback(
    (estado: EstadoCriacao) => {
      pendenteRef.current = estado;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const atual = pendenteRef.current;
        pendenteRef.current = null;
        if (atual) void gravar(atual);
      }, DEBOUNCE_MS);
    },
    [gravar],
  );

  const gravarAgora = useCallback(
    async (estado: EstadoCriacao) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      pendenteRef.current = null;
      await gravar(estado);
    },
    [gravar],
  );

  // Sair da tela antes do debounce disparar não pode custar o que foi escrito.
  // A gravação segue sem `await` — a tela já está desmontando, e o que importa é
  // a requisição partir.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const atual = pendenteRef.current;
      pendenteRef.current = null;
      if (atual && (idRef.current || atual.relevante)) void gravar(atual);
    },
    [gravar],
  );

  // A URL passa a carregar o id assim que ele existe: recarregar a página, ou
  // voltar pelo histórico, cai na mesma criação em vez de numa tela em branco.
  useEffect(() => {
    if (!id || searchParams.get("criacao") === id) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("criacao", id);
        return next;
      },
      { replace: true },
    );
  }, [id, searchParams, setSearchParams]);

  return {
    id,
    carregando,
    carregada,
    erroAoCarregar,
    sincronizar,
    gravarAgora,
  };
}

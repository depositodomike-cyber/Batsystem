// Import Dependencies
import { useCallback, useEffect, useMemo, useState } from "react";

// Local Imports
import { buildMemoryCategories, type MemoryCategory } from "@/app/data/memoria";
import { listarPastasMemoria } from "@/utils/memoriaVault";
import { useRepositorioAtivo } from "@/app/pages/prototypes/contas/model/context";
import { PASTA_MEMORIA } from "./memoria-pastas";

// ----------------------------------------------------------------------
// Temas do Repositório = pastas do Repositório.
//
// Regra única da aplicação: em QUALQUER opção de gravar no Repositório (Regras,
// Notas, E-mail, Slack, IA Studio…) a lista de temas oferecida é a das pastas
// disponíveis na Pasta do Repositório — nunca uma lista paralela (squads, temas
// fixos…). Este hook é a fonte dessa lista.
//
// Fallback: quando a pasta ainda não foi escolhida, o navegador não suporta a
// File System Access API, a permissão não está concedida ou o vault está vazio,
// usamos os nomes canônicos de PASTA_MEMORIA — são exatamente as pastas que a
// aplicação cria na primeira gravação, então o tema escolhido continua sendo
// uma pasta válida do Repositório e o seletor nunca fica vazio.
// ----------------------------------------------------------------------

const PASTAS_PADRAO = Object.values(PASTA_MEMORIA) as string[];

export interface PastasMemoria {
  /** Temas (= pastas) para alimentar seletores e filtros. */
  temas: MemoryCategory[];
  /** Nomes crus das pastas disponíveis (sem ordenação garantida). */
  pastas: string[];
  /** Ainda lendo o vault — a lista exibida é a de fallback. */
  carregando: boolean;
  /** true quando a lista veio de fato das pastas do vault. */
  doVault: boolean;
  /** Relê o vault (ex.: depois de criar um grupo, que cria uma pasta). */
  recarregar: () => void;
}

export function usePastasMemoria(): PastasMemoria {
  const [pastas, setPastas] = useState<string[]>(PASTAS_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [doVault, setDoVault] = useState(false);
  const [tick, setTick] = useState(0);
  // As pastas vêm do vault do repositório ativo. Sem esta dependência a lista
  // continuaria mostrando as pastas do repositório anterior depois da troca.
  const repositorioId = useRepositorioAtivo()?.id ?? null;

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await listarPastasMemoria();
      if (!vivo) return;
      // Vault vazio cai no fallback: um seletor sem opções travaria a gravação.
      if (r.ok && r.pastas.length) {
        setPastas(r.pastas);
        setDoVault(true);
      } else {
        setPastas(PASTAS_PADRAO);
        setDoVault(false);
      }
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [tick, repositorioId]);

  const temas = useMemo(() => buildMemoryCategories(pastas), [pastas]);
  const recarregar = useCallback(() => setTick((t) => t + 1), []);

  return { temas, pastas, carregando, doVault, recarregar };
}

// Import Dependencies
import { useEffect, useRef, useState } from "react";

// Local Imports
import { fetchUsoTokensApi, type UsoTokens } from "@/services/api/uso";

// ----------------------------------------------------------------------
// Contador de tokens da IA no header (janelas de 1h/24h/7d/30d), portado do
// beculture/Confi. Consulta GET /uso/tokens do usuário logado e atualiza a cada
// minuto. Em erro (ex.: offline) mantém os últimos valores exibidos.
// ----------------------------------------------------------------------

const UM_MINUTO = 60_000;

/** Formata número grande de forma compacta em pt-BR: 950 · 1,2 mil · 3,4 mi. */
function fmtTokens(n: number): string {
  n = Number(n) || 0;
  if (n < 1000) return String(n);
  if (n < 1e6) return (n / 1e3).toFixed(n < 1e4 ? 1 : 0).replace(".", ",") + " mil";
  return (n / 1e6).toFixed(1).replace(".", ",") + " mi";
}

const ITENS: { chave: keyof UsoTokens; label: string }[] = [
  { chave: "hora", label: "1h" },
  { chave: "dia", label: "24h" },
  { chave: "semana", label: "7d" },
  { chave: "mes", label: "30d" },
];

export function TokenUsage() {
  const [uso, setUso] = useState<UsoTokens | null>(null);
  // Guarda o último valor bom para não piscar "—" a cada atualização/erro.
  const ultimoRef = useRef<UsoTokens | null>(null);

  useEffect(() => {
    let alive = true;
    const carregar = () => {
      fetchUsoTokensApi()
        .then((d) => {
          if (!alive) return;
          ultimoRef.current = d;
          setUso(d);
        })
        .catch(() => {
          /* sem conexão / não autenticado: mantém os últimos valores */
        });
    };
    carregar();
    const id = window.setInterval(carregar, UM_MINUTO);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const dados = uso ?? ultimoRef.current;

  const title = dados
    ? `Tokens consumidos pela IA\n· última hora: ${dados.hora.total.toLocaleString("pt-BR")}\n· 24 h: ${dados.dia.total.toLocaleString("pt-BR")}\n· 7 dias: ${dados.semana.total.toLocaleString("pt-BR")}\n· 30 dias: ${dados.mes.total.toLocaleString("pt-BR")}`
    : "Tokens consumidos pela IA";

  return (
    <div
      title={title}
      aria-label="Tokens consumidos pela IA (1h · 24h · 7 dias · 30 dias)"
      className="hidden items-center gap-2.5 rounded-full px-1 md:flex"
    >
      {ITENS.map(({ chave, label }, i) => (
        <div
          key={chave}
          className={
            i === 0
              ? "flex flex-col items-end leading-none"
              : "dark:border-dark-500 flex flex-col items-end border-l border-gray-200 pl-2.5 leading-none"
          }
        >
          <span className="text-primary-600 dark:text-primary-400 font-mono text-[13px] font-semibold tabular-nums">
            {dados ? fmtTokens(dados[chave].total) : "—"}
          </span>
          <span className="dark:text-dark-300 mt-0.5 text-[8px] font-medium tracking-wider text-gray-400 uppercase">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

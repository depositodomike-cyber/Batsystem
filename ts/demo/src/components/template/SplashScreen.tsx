// Import Dependencies
import { useEffect, useState } from "react";

import oracleEmblem from "@/assets/branding/oracle-emblem.svg";

// ----------------------------------------------------------------------

// Flag gravada no sessionStorage pelo AuthProvider quando um login acontece.
// O Root consome a flag para exibir a animação uma única vez após o login;
// refresh/novas visitas não exibem de novo até um próximo logout + login.
export const SPLASH_AFTER_LOGIN_KEY = "splashAfterLogin";

// Tempo mínimo que a animação fica em cena, para o logotipo se formar mesmo
// quando a sessão inicializa na hora. Enquanto ela roda o Root não monta o
// resto da árvore — inclusive o <Toaster/> —, então quem precisa avisar algo
// logo após o login tem de esperar este tempo.
export const SPLASH_MIN_DURATION = 2500;

// Fundo preto, o mesmo do dark mode padrão (scheme "black").
const BRAND_BG = "#000000";

// Entrada do logotipo: surge com leve zoom e depois "respira". Substitui o
// vídeo da marca anterior, que tinha o logotipo antigo gravado nos quadros.
const KEYFRAMES = `
@keyframes oracle-splash-in {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes oracle-splash-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.82; }
}`;

export function SplashScreen() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setReduceMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  return (
    <div
      className="stage fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: BRAND_BG }}
      aria-label="Oracle"
      role="img"
    >
      <style>{KEYFRAMES}</style>
      <div
        className="flex flex-col items-center"
        style={{
          // Acessibilidade: quem prefere menos movimento vê o logo estático.
          animation: reduceMotion
            ? undefined
            : "oracle-splash-in 700ms ease-out both, oracle-splash-pulse 1800ms ease-in-out 700ms infinite",
        }}
      >
        <img
          src={oracleEmblem}
          alt=""
          aria-hidden
          style={{ width: "min(70vw, 360px)", height: "auto" }}
        />
        <span
          style={{
            marginTop: "-1.5rem",
            color: "#FFFFFF",
            fontFamily: "Poppins, 'Segoe UI', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: "clamp(2rem, 6vw, 3rem)",
            letterSpacing: "-0.03em",
          }}
        >
          Oracle
        </span>
      </div>
    </div>
  );
}

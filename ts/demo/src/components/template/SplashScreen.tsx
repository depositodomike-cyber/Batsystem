// Import Dependencies
import { useEffect, useRef, useState } from "react";

// ----------------------------------------------------------------------

// Flag gravada no sessionStorage pelo AuthProvider quando um login acontece.
// O Root consome a flag para exibir a animação uma única vez após o login;
// refresh/novas visitas não exibem de novo até um próximo logout + login.
export const SPLASH_AFTER_LOGIN_KEY = "splashAfterLogin";

// Animação oficial da marca beculture (partículas de pessoas que convergem no
// logotipo "beculture"). Servida de /public/videos.
const LOADER_SRC = "/videos/beculture-loader.mp4";
const LOADER_POSTER = "/videos/beculture-loader-poster.jpg";

// Fundo navy da marca (mesmo do vídeo), para que o object-contain do vídeo
// se funda com a tela sem bordas visíveis.
const BRAND_BG = "#0D1829";

export function SplashScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setReduceMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  useEffect(() => {
    // Garante o autoplay mesmo quando o navegador ignora o atributo.
    videoRef.current?.play().catch(() => {});
  }, []);

  return (
    <div
      className="stage fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: BRAND_BG }}
      aria-label="beculture"
      role="img"
    >
      {reduceMotion ? (
        // Acessibilidade: quem prefere menos movimento vê o logo estático.
        <img
          src={LOADER_POSTER}
          alt="beculture"
          style={{ width: "min(82vw, 720px)", height: "auto" }}
        />
      ) : (
        <video
          ref={videoRef}
          src={LOADER_SRC}
          poster={LOADER_POSTER}
          autoPlay
          muted
          playsInline
          preload="auto"
          style={{ width: "min(82vw, 720px)", height: "auto" }}
        />
      )}
    </div>
  );
}

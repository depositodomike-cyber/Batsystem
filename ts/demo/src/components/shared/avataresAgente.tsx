// Avatares ilustrados (pessoas) para agentes personalizados — alternativa às
// iniciais no avatar do agente. Ilustrações próprias, no estilo flat de busto
// em círculo: fundo claro, ombros com a cor da roupa, rosto e cabelo variados.
//
// São ilustrações, não UI: as cores ficam fixas no desenho (como numa imagem)
// e funcionam igual no tema claro e no escuro. viewBox 40×40, recortado em
// círculo; o tamanho vem da `className` de quem usa.
import { useId, type ReactNode } from "react";

// ----------------------------------------------------------------------

interface PartesAvatar {
  fundo: string;
  pele: string;
  /** Tom um pouco mais escuro da pele (pescoço/sombra). */
  peleSombra: string;
  roupa: string;
  /** Desenho atrás da cabeça (cabelo longo, black power, coque). */
  tras?: ReactNode;
  /** Desenho na frente do rosto (franja, barba, óculos). */
  frente?: ReactNode;
  /** Detalhes da roupa (gola, gravata). */
  roupaDetalhe?: ReactNode;
}

function Busto({
  className,
  partes,
}: {
  className?: string;
  partes: PartesAvatar;
}) {
  const clip = useId();
  const { fundo, pele, peleSombra, roupa, tras, frente, roupaDetalhe } = partes;
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="20" cy="20" r="20" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <circle cx="20" cy="20" r="20" fill={fundo} />
        {tras}
        {/* Ombros */}
        <path d="M5 41 C5 31.5 11.5 27.5 20 27.5 C28.5 27.5 35 31.5 35 41 Z" fill={roupa} />
        {roupaDetalhe}
        {/* Pescoço */}
        <rect x="17.3" y="21.5" width="5.4" height="7" rx="2.2" fill={peleSombra} />
        {/* Orelhas + rosto */}
        <ellipse cx="13.7" cy="17.6" rx="1.3" ry="1.9" fill={peleSombra} />
        <ellipse cx="26.3" cy="17.6" rx="1.3" ry="1.9" fill={peleSombra} />
        <ellipse cx="20" cy="16.8" rx="6.4" ry="7.4" fill={pele} />
        {/* Olhos e sorriso — antes de `frente`, que pode cobri-los (óculos, barba) */}
        <circle cx="17.5" cy="17.4" r="0.75" fill="#2A2321" />
        <circle cx="22.5" cy="17.4" r="0.75" fill="#2A2321" />
        <path
          d="M18.2 20.6 Q20 21.9 21.8 20.6"
          fill="none"
          stroke="#2A2321"
          strokeWidth="0.7"
          strokeLinecap="round"
        />
        {frente}
      </g>
    </svg>
  );
}

// ----------------------------------------------------------------------

/** Mulher de cabelo longo e escuro. */
export function AvatarCabeloLongo({ className }: { className?: string }) {
  return (
    <Busto
      className={className}
      partes={{
        fundo: "#BFE0F2",
        pele: "#C98E6A",
        peleSombra: "#B47A57",
        roupa: "#EF7B6B",
        tras: (
          <path
            d="M12 18 C12 9.5 15.6 7.6 20 7.6 C24.4 7.6 28 9.5 28 18 L28.5 29 L11.5 29 Z"
            fill="#2B2321"
          />
        ),
        frente: (
          <path
            d="M13.4 15.4 C13.8 10.6 16.6 8.8 20 8.8 C23.4 8.8 26.2 10.6 26.6 15.4 C24.6 12.6 21.6 11.8 18.4 12.6 C16.4 13.1 14.8 14 13.4 15.4 Z"
            fill="#2B2321"
          />
        ),
      }}
    />
  );
}

/** Homem de cabelo curto e barba. */
export function AvatarBarba({ className }: { className?: string }) {
  return (
    <Busto
      className={className}
      partes={{
        fundo: "#D5DDE6",
        pele: "#8D5B3F",
        peleSombra: "#7A4C33",
        roupa: "#F5B83D",
        frente: (
          <>
            <path
              d="M13.6 15.2 C13.6 10.4 16.6 8.8 20 8.8 C23.4 8.8 26.4 10.4 26.4 15.2 C25 13 22.8 12.3 20 12.3 C17.2 12.3 15 13 13.6 15.2 Z"
              fill="#1E1A19"
            />
            <path
              d="M13.7 17.6 C13.8 22.6 16.4 24.6 20 24.6 C23.6 24.6 26.2 22.6 26.3 17.6 C25.2 20.2 23 21.2 20 21.2 C17 21.2 14.8 20.2 13.7 17.6 Z"
              fill="#1E1A19"
            />
          </>
        ),
      }}
    />
  );
}

/** Mulher ruiva de coque. */
export function AvatarCoque({ className }: { className?: string }) {
  return (
    <Busto
      className={className}
      partes={{
        fundo: "#C9E6F0",
        pele: "#F2C7A5",
        peleSombra: "#E2B18C",
        roupa: "#33466B",
        tras: <circle cx="20" cy="7.6" r="3.6" fill="#D9573F" />,
        frente: (
          <path
            d="M13.4 16 C13.4 10.6 16.4 9.2 20 9.2 C23.6 9.2 26.6 10.6 26.6 16 C25.4 12.9 22.9 12 20 12.6 C17 12 14.6 12.9 13.4 16 Z"
            fill="#D9573F"
          />
        ),
      }}
    />
  );
}

/** Homem de óculos, camisa e gravata. */
export function AvatarOculos({ className }: { className?: string }) {
  return (
    <Busto
      className={className}
      partes={{
        fundo: "#E4EEF5",
        pele: "#F0C29F",
        peleSombra: "#DEAA86",
        roupa: "#3F7DC4",
        roupaDetalhe: (
          <>
            <path d="M15.5 27.8 L20 32 L24.5 27.8 Z" fill="#FFFFFF" />
            <path d="M19 28.6 L21 28.6 L21.7 34.5 L20 36.4 L18.3 34.5 Z" fill="#1F2A44" />
          </>
        ),
        frente: (
          <>
            <path
              d="M13.6 15 C13.4 10.6 16.4 8.8 20.4 9 C24 9.2 26.6 11 26.4 15 C24.6 12.4 21 11.6 17.4 12.4 C15.8 12.8 14.6 13.6 13.6 15 Z"
              fill="#8A5A3B"
            />
            <g fill="none" stroke="#2A2A2A" strokeWidth="0.9">
              <circle cx="17.3" cy="17.4" r="2.1" />
              <circle cx="22.7" cy="17.4" r="2.1" />
              <path d="M19.4 17.3 L20.6 17.3" />
            </g>
          </>
        ),
      }}
    />
  );
}

/** Mulher de cabelo black power. */
export function AvatarBlackPower({ className }: { className?: string }) {
  return (
    <Busto
      className={className}
      partes={{
        fundo: "#FCE3CF",
        pele: "#6E4430",
        peleSombra: "#5E3826",
        roupa: "#2E9C8F",
        tras: <circle cx="20" cy="13.4" r="10" fill="#241B18" />,
        frente: (
          <path
            d="M13.6 15 C14.2 11.4 16.8 10 20 10 C23.2 10 25.8 11.4 26.4 15 C24.4 13.3 22.2 12.8 20 12.8 C17.8 12.8 15.6 13.3 13.6 15 Z"
            fill="#241B18"
          />
        ),
      }}
    />
  );
}

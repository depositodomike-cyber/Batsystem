// Indicador de "IA trabalhando": o logo da marca "respirando" (escala +
// opacidade) com um halo desfocado pulsando atras dele. Nao desenha texto
// nem fundo — quem usa decide o que aparece ao redor.

// Local Imports
import becultureLogo from "@/assets/branding/beculture-logo.svg";
import becultureLogoDark from "@/assets/branding/beculture-logo-dark.svg";
import { useThemeContext } from "@/app/contexts/theme/context";
import "./BrandLoadingSplash.css";

// ----------------------------------------------------------------------

/** Fundo sobre o qual o splash e desenhado - decide qual variante do logo usar. */
export type BrandLoadingSplashBackground = "black" | "white";

export interface BrandLoadingSplashProps {
  /**
   * Fundo onde o splash aparece. "black" usa a variante do logo feita para
   * fundo escuro; "white" usa a de fundo claro. Sem a prop, segue o tema
   * claro/escuro da aplicacao; passe um valor para fixar a variante.
   */
  background?: BrandLoadingSplashBackground;
  /** Lado do logo, em px. */
  logoSize?: number;
  /** Lado da area do halo, em px. Deve ser maior que `logoSize`. */
  haloSize?: number;
  /** Cor do halo (qualquer cor CSS valida). */
  haloColor?: string;
  /** Classe extra no elemento raiz, para posicionamento/margens. */
  className?: string;
  /**
   * Texto lido por leitores de tela. Passe o que esta acontecendo
   * ("Gerando dashboard...") ou `null` para deixar o splash decorativo.
   */
  label?: string | null;
}

export function BrandLoadingSplash({
  background,
  logoSize = 48,
  haloSize = 80,
  haloColor = "var(--color-primary-500)",
  className,
  label = "Carregando",
}: BrandLoadingSplashProps) {
  const { isDark } = useThemeContext();
  const onDark = background ? background === "black" : isDark;
  const src = onDark ? becultureLogoDark : becultureLogo;

  return (
    <div
      className={className ? `bls-root ${className}` : "bls-root"}
      style={{ width: haloSize, height: haloSize }}
      role={label ? "status" : undefined}
      aria-live={label ? "polite" : undefined}
      aria-hidden={label ? undefined : true}
    >
      <span className="bls-halo" style={{ backgroundColor: haloColor }} />
      <img
        src={src}
        alt=""
        className="bls-logo"
        style={{ width: logoSize, height: logoSize }}
      />
      {label ? (
        <span
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}

export default BrandLoadingSplash;

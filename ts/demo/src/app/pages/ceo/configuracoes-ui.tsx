// Import Dependencies
import { Switch } from "@/components/ui";

// ----------------------------------------------------------------------
// Peças visuais compartilhadas pelas seções de Configurações.
//
// Viviam dentro de `Configuracoes.tsx`, que era o único arquivo a renderizar
// seções. Saíram de lá quando Aparência ganhou arquivo próprio: importá-las de
// volta de `Configuracoes.tsx` fecharia um ciclo, já que é ele quem monta a
// seção.
// ----------------------------------------------------------------------

/** Bloco base de uma seção: cartão + título + descrição. */
export function SectionCard({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <div className="dark:border-dark-600 dark:bg-dark-700 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
      <h3 className="dark:text-dark-50 text-lg font-semibold text-gray-800">
        {titulo}
      </h3>
      <p className="dark:text-dark-300 mt-0.5 text-sm text-gray-500">
        {descricao}
      </p>
      <div className="dark:bg-dark-500 my-5 h-px bg-gray-200" />
      {children}
    </div>
  );
}

/** Linha com título/descrição à esquerda e um interruptor à direita. */
export function ToggleRow({
  nome,
  descricao,
  checked,
  onChange,
}: {
  nome: string;
  descricao: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="dark:text-dark-100 text-sm font-medium text-gray-800">
          {nome}
        </p>
        <p className="dark:text-dark-300 text-xs-plus mt-0.5 text-gray-500">
          {descricao}
        </p>
      </div>
      <Switch
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="shrink-0"
      />
    </div>
  );
}

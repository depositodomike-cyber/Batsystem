// ----------------------------------------------------------------------
// Campos com conexão ao Repositório — troque `<textarea>` por `<MemoriaTextarea>`
// (ou `<input>` por `<MemoriaInput>`) e o campo passa a abrir a lista de notas
// e regras quando a pessoa digita "[[".
//
// São drop-in: recebem exatamente as mesmas props do elemento nativo, inclusive
// `value`/`onChange` controlados. A inserção do wikilink usa o setter nativo do
// elemento + um evento `input` — assim o `onChange` de quem usa o campo é
// chamado como se a pessoa tivesse digitado, e nenhuma tela precisa de um
// segundo callback só para isso.
//
// Para os campos do design system (`@/components/ui/Form`), passe como
// polimórfico: <Textarea label="…" component={MemoriaTextarea} … />.
// ----------------------------------------------------------------------

import {
  forwardRef,
  useCallback,
  useRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { useMergedRef } from "@/hooks";
import { useMemoriaMentions } from "./useMemoriaMentions";

export type { AlvoMemoria } from "./alvos";

type Campo = HTMLTextAreaElement | HTMLInputElement;

/**
 * Escreve o valor "por fora" do React e avisa o campo. O setter do protótipo é
 * necessário porque o React guarda o último valor que ele mesmo escreveu: sem
 * ele, o evento `input` seria considerado redundante e o `onChange` da tela
 * nunca rodaria.
 */
function escreverValor(el: Campo, valor: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, valor);
  else el.value = valor;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Liga o gatilho "[[" a um campo controlado e devolve os handlers dele. */
function useCampoMemoria<T extends Campo>(desabilitado: boolean) {
  const ref = useRef<T | null>(null);

  const aplicar = useCallback((valor: string, cursor: number) => {
    const el = ref.current;
    if (!el) return;
    escreverValor(el, valor);
    // Depois do commit do React — que reescreve o `value` no DOM e jogaria o
    // cursor para o fim.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }, []);

  const mentions = useMemoriaMentions(ref, aplicar, desabilitado);
  return { ref, mentions };
}

// ----------------------------------------------------------------------

export type MemoriaTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const MemoriaTextarea = forwardRef<
  HTMLTextAreaElement,
  MemoriaTextareaProps
>(function MemoriaTextarea(
  { onChange, onKeyDown, onKeyUp, onClick, onBlur, disabled, ...rest },
  refExterna,
) {
  const { ref, mentions } = useCampoMemoria<HTMLTextAreaElement>(!!disabled);
  const refs = useMergedRef(ref, refExterna);

  return (
    <>
      <textarea
        {...rest}
        disabled={disabled}
        ref={refs}
        onChange={(e) => {
          onChange?.(e);
          mentions.sincronizar();
        }}
        onKeyDown={(e) => {
          if (mentions.aoTeclar(e)) return;
          onKeyDown?.(e);
        }}
        onKeyUp={(e) => {
          onKeyUp?.(e);
          mentions.sincronizar();
        }}
        onClick={(e) => {
          onClick?.(e);
          mentions.sincronizar();
        }}
        onBlur={(e) => {
          onBlur?.(e);
          mentions.fechar();
        }}
      />
      {mentions.menu}
    </>
  );
});

// ----------------------------------------------------------------------

export type MemoriaInputProps = InputHTMLAttributes<HTMLInputElement>;

export const MemoriaInput = forwardRef<HTMLInputElement, MemoriaInputProps>(
  function MemoriaInput(
    { onChange, onKeyDown, onKeyUp, onClick, onBlur, disabled, ...rest },
    refExterna,
  ) {
    const { ref, mentions } = useCampoMemoria<HTMLInputElement>(!!disabled);
    const refs = useMergedRef(ref, refExterna);

    return (
      <>
        <input
          {...rest}
          disabled={disabled}
          ref={refs}
          onChange={(e) => {
            onChange?.(e);
            mentions.sincronizar();
          }}
          onKeyDown={(e) => {
            if (mentions.aoTeclar(e)) return;
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            onKeyUp?.(e);
            mentions.sincronizar();
          }}
          onClick={(e) => {
            onClick?.(e);
            mentions.sincronizar();
          }}
          onBlur={(e) => {
            onBlur?.(e);
            mentions.fechar();
          }}
        />
        {mentions.menu}
      </>
    );
  },
);

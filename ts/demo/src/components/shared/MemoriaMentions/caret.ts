// ----------------------------------------------------------------------
// Posição do cursor dentro de um <textarea>/<input>, em coordenadas da tela.
//
// O navegador não expõe isso: a técnica é o "espelho" — um <div> escondido
// recebe os mesmos estilos do campo e o texto até o cursor; a posição do <span>
// que fecha esse texto é, então, a posição do cursor. É o que permite abrir o
// menu de "[[" colado ao que a pessoa está digitando, e não no canto do campo.
// ----------------------------------------------------------------------

// Estilos que mudam onde o texto quebra e onde cada caractere cai. Precisam ser
// copiados para o espelho, senão a medida sai errada.
const ESTILOS_ESPELHADOS = [
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
] as const;

export interface CaretPos {
  /** Coordenadas na viewport (para posicionar um elemento `fixed`). */
  left: number;
  top: number;
  /** Altura de uma linha — quanto descer para o menu não cobrir o texto. */
  alturaLinha: number;
}

export function caretCoords(
  el: HTMLTextAreaElement | HTMLInputElement,
  pos: number,
): CaretPos {
  const doc = el.ownerDocument;
  const computed = window.getComputedStyle(el);
  const ehInput = el.nodeName === "INPUT";

  const espelho = doc.createElement("div");
  const s = espelho.style as unknown as Record<string, string>;
  s.position = "absolute";
  s.visibility = "hidden";
  s.top = "0";
  s.left = "-9999px";
  s.whiteSpace = ehInput ? "pre" : "pre-wrap";
  s.wordWrap = ehInput ? "normal" : "break-word";
  s.overflowWrap = ehInput ? "normal" : "break-word";
  for (const prop of ESTILOS_ESPELHADOS) {
    s[prop] = computed.getPropertyValue(
      prop.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()),
    );
  }
  // O campo rola; o espelho cresce. Sem isso, um textarea longo mede errado.
  s.height = "auto";

  espelho.textContent = el.value.slice(0, pos);
  if (ehInput) espelho.textContent = espelho.textContent.replace(/\s/g, " ");

  const marca = doc.createElement("span");
  // Precisa de algum conteúdo para ter caixa própria quando o cursor está no fim.
  marca.textContent = el.value.slice(pos) || ".";
  espelho.appendChild(marca);

  doc.body.appendChild(espelho);
  const rect = el.getBoundingClientRect();
  const alturaLinha =
    parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.4;
  // offsetLeft/offsetTop são medidos a partir da borda INTERNA do espelho, e o
  // rect do campo a partir da externa — daí somar as bordas.
  const left =
    rect.left +
    marca.offsetLeft +
    (parseFloat(computed.borderLeftWidth) || 0) -
    el.scrollLeft;
  const top =
    rect.top +
    marca.offsetTop +
    (parseFloat(computed.borderTopWidth) || 0) -
    el.scrollTop;
  doc.body.removeChild(espelho);

  return { left, top, alturaLinha };
}

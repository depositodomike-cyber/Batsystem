// Renderizadores HTML autônomos do roteiro. Portado, em espírito, do
// beculture/Confi (lib/slides-html.js, lib/book-html.js).
// - slides-html: passador de página (setas/clique), 16:9.
// - book-html: documento de leitura com menu lateral de capítulos.
//
// As cores, fontes e o raio saem do design system da marca escolhida no AI
// Studio; sem design system, cai no tema beculture (âmbar sobre grafite).
import type { Roteiro } from './prompts';
import { designTheme, type DesignSystemDto } from '../design/design';

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Variáveis CSS derivadas do design system — mesmas para os dois formatos.
function cssVars(design?: DesignSystemDto | null): string {
  const t = designTheme(design);
  return (
    `--bg:${t.html.fundo};--card:${t.html.superficie};--pane:${t.html.superficie};` +
    `--destaque:${t.html.destaque};--titulo:${t.html.titulo};--texto:${t.html.texto};` +
    `--suave:${t.html.suave};--raio:${t.raioPx}px;` +
    `--ft:'${t.fonteTitulo}',system-ui,Arial,sans-serif;--fc:'${t.fonteCorpo}',system-ui,Arial,sans-serif`
  );
}

// ---------------------------------------------------------------- slides-html
export function buildSlidesHtml(roteiro: Roteiro, design?: DesignSystemDto | null): string {
  const slides = roteiro.slides ?? [];
  const capa =
    `<section class="slide capa">` +
    `<h1>${esc(roteiro.titulo)}</h1>` +
    (roteiro.subtitulo ? `<p class="sub">${esc(roteiro.subtitulo)}</p>` : '') +
    `</section>`;
  const corpo = slides
    .map(
      (s, i) =>
        `<section class="slide">` +
        `<div class="bar"></div>` +
        `<h2>${esc(s.titulo || `Slide ${i + 1}`)}</h2>` +
        `<ul>${(s.bullets ?? []).filter(Boolean).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` +
        `<span class="num">${i + 1} / ${slides.length}</span>` +
        `</section>`,
    )
    .join('');

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(roteiro.titulo)}</title>
<style>
  :root{${cssVars(design)}}
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;background:var(--bg);color:var(--texto);font-family:var(--fc)}
  .stage{position:fixed;inset:0;display:grid;place-items:center;padding:24px}
  .slide{display:none;position:relative;width:min(92vw,1120px);aspect-ratio:16/9;background:var(--bg);
    border:1px solid rgba(255,255,255,.08);border-radius:var(--raio);padding:56px 64px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.5)}
  .slide.active{display:block}
  .slide.capa{background:var(--card);display:grid;align-content:center}
  .slide.capa::after{content:"";position:absolute;left:0;right:0;bottom:0;height:10px;background:var(--destaque)}
  .slide .bar{position:absolute;left:0;top:0;bottom:0;width:8px;background:var(--destaque)}
  h1{font-size:clamp(28px,5vw,52px);margin:0 0 12px;color:var(--titulo);font-family:var(--ft);font-weight:800}
  h2{font-size:clamp(22px,3.4vw,36px);margin:0 0 24px;color:var(--titulo);font-family:var(--ft);font-weight:700}
  .sub{font-size:clamp(16px,2.2vw,24px);color:var(--destaque);margin:0}
  ul{margin:0;padding-left:26px;display:grid;gap:14px}
  li{font-size:clamp(15px,2vw,22px);line-height:1.45}
  .num{position:absolute;right:28px;bottom:20px;color:var(--suave);font-size:13px}
  .nav{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:8px;align-items:center;
    background:var(--card);border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:6px 10px;z-index:5}
  .nav button{background:transparent;border:0;color:var(--texto);font-size:18px;cursor:pointer;padding:4px 10px;border-radius:999px}
  .nav button:hover{background:rgba(255,255,255,.08)}
  .nav .count{color:var(--suave);font-size:13px;min-width:56px;text-align:center}
  .hint{position:fixed;top:14px;right:16px;color:var(--suave);font-size:12px}
</style></head><body>
<div class="stage" id="stage">${capa}${corpo}</div>
<div class="nav"><button id="prev" aria-label="Anterior">‹</button><span class="count" id="count"></span><button id="next" aria-label="Próximo">›</button><button id="full" aria-label="Tela cheia">⛶</button></div>
<div class="hint">← → para navegar</div>
<script>
  var slides=[].slice.call(document.querySelectorAll('.slide'));var i=0;
  var count=document.getElementById('count');
  function show(n){i=Math.max(0,Math.min(slides.length-1,n));slides.forEach(function(s,k){s.classList.toggle('active',k===i)});count.textContent=(i+1)+' / '+slides.length;}
  document.getElementById('next').onclick=function(){show(i+1)};
  document.getElementById('prev').onclick=function(){show(i-1)};
  document.getElementById('full').onclick=function(){if(!document.fullscreenElement)document.documentElement.requestFullscreen();else document.exitFullscreen();};
  document.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' ')show(i+1);if(e.key==='ArrowLeft'||e.key==='PageUp')show(i-1);if(e.key==='Home')show(0);if(e.key==='End')show(slides.length-1);});
  document.getElementById('stage').addEventListener('click',function(e){if(e.target.closest('.nav'))return;var r=this.getBoundingClientRect();if(e.clientX>r.left+r.width/2)show(i+1);else show(i-1);});
  show(0);
</script>
</body></html>`;
}

// ------------------------------------------------------------------ book-html
export function buildBookHtml(roteiro: Roteiro, design?: DesignSystemDto | null): string {
  const caps = roteiro.capitulos ?? [];
  const menu = caps
    .map((c, i) => `<a href="#cap-${i}">${i + 1}. ${esc(c.titulo)}</a>`)
    .join('');
  const corpo = caps
    .map(
      (c, i) =>
        `<section id="cap-${i}" class="cap">` +
        `<h2><span class="n">${i + 1}</span> ${esc(c.titulo)}</h2>` +
        (c.paragrafos ?? []).map((p) => `<p>${esc(p)}</p>`).join('') +
        `</section>`,
    )
    .join('');

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(roteiro.titulo)}</title>
<style>
  :root{${cssVars(design)}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--texto);font-family:var(--fc);line-height:1.7}
  .wrap{display:grid;grid-template-columns:280px 1fr;min-height:100vh}
  aside{position:sticky;top:0;align-self:start;height:100vh;overflow:auto;background:var(--pane);border-right:1px solid rgba(255,255,255,.08);padding:24px 18px}
  aside .book-title{color:var(--titulo);font-family:var(--ft);font-weight:800;font-size:18px;margin:0 0 4px}
  aside .book-sub{color:var(--destaque);font-size:13px;margin:0 0 18px}
  aside a{display:block;color:var(--suave);text-decoration:none;font-size:14px;padding:6px 8px;border-radius:8px;margin-bottom:2px}
  aside a:hover{background:rgba(255,255,255,.08);color:var(--texto)}
  main{padding:56px clamp(24px,6vw,96px);max-width:880px}
  main>h1{color:var(--titulo);font-family:var(--ft);font-weight:800;font-size:clamp(28px,4vw,40px);margin:0 0 8px}
  main>.sub{color:var(--destaque);font-size:18px;margin:0 0 40px}
  .cap{margin:0 0 40px;scroll-margin-top:24px}
  .cap h2{color:var(--titulo);font-family:var(--ft);font-weight:700;font-size:24px;border-top:1px solid rgba(255,255,255,.08);padding-top:26px;margin:26px 0 14px;display:flex;gap:12px;align-items:center}
  .cap h2 .n{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:var(--destaque);color:var(--bg);font-size:15px;font-weight:800}
  .cap p{margin:0 0 14px;font-size:16px}
  @media(max-width:820px){.wrap{grid-template-columns:1fr}aside{position:static;height:auto}}
</style></head><body>
<div class="wrap">
  <aside>
    <p class="book-title">${esc(roteiro.titulo)}</p>
    ${roteiro.subtitulo ? `<p class="book-sub">${esc(roteiro.subtitulo)}</p>` : ''}
    <nav>${menu}</nav>
  </aside>
  <main>
    <h1>${esc(roteiro.titulo)}</h1>
    ${roteiro.subtitulo ? `<p class="sub">${esc(roteiro.subtitulo)}</p>` : ''}
    ${corpo}
  </main>
</div>
</body></html>`;
}

import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

/**
 * O código referencia assets estáticos com caminho absoluto a partir da raiz
 * (ex.: "/images/avatar/avatar-1.jpg"). Quando o app é servido numa subpasta
 * (base="/behuman/"), esses caminhos quebram (apontam para a raiz do domínio).
 * Este plugin reescreve "/images/", "/videos/" e "/md/" para incluir o `base`
 * APENAS no build (em dev base="/", então é no-op). Mantém o código-fonte
 * intacto e o dev funcionando.
 */
function baseAwareAbsoluteAssets(): Plugin {
  let base = "/";
  const dirs = ["images", "videos", "md"];
  return {
    name: "base-aware-absolute-assets",
    enforce: "post",
    configResolved(cfg) {
      base = cfg.base || "/";
    },
    transform(code, id) {
      if (base === "/" || id.includes("node_modules")) return null;
      if (!/\.(t|j)sx?$|\.css$/.test(id)) return null;
      let out = code;
      for (const d of dirs) {
        out = out
          .split('"/' + d + "/").join('"' + base + d + "/")
          .split("'/" + d + "/").join("'" + base + d + "/")
          .split("`/" + d + "/").join("`" + base + d + "/")
          .split("(/" + d + "/").join("(" + base + d + "/");
      }
      return out === code ? null : { code: out, map: null };
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {},
    }),
    svgr(),
    tailwindcss(),
    baseAwareAbsoluteAssets(),
  ],
  resolve: {
    alias: {
      "@": path.join(__dirname, "src"),
    },
  },
  // ffmpeg.wasm (editor de cortes): não deve ser pré-empacotado pelo Vite, senão
  // o worker interno quebra. O core é carregado via toBlobURL em runtime.
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  build: {
    chunkSizeWarningLimit: 10000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // if (id.includes("node_modules")) {
          // if (id.includes("react")) return "react";
          // if (id.includes("lodash")) return "lodash";
          // return "vendor";
          // }
          if (id.includes("/Accordion/")) {
            return "accordion";
          }
        },
      },
    },
  },
});

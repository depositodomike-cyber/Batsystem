// ----------------------------------------------------------------------
// Migração única dos dados locais do navegador para o Oracle Desktop.
//
// Notas, chats, kanban, preferências (localStorage) e a biblioteca de
// Documentos (IndexedDB "Oracle") ficam no perfil do navegador, preso à origem
// `localhost:5173`. O app desktop tem perfil próprio e não os enxerga. A versão
// web exporta um arquivo JSON; o desktop o importa uma vez.
//
// Fica de fora:
// - `authToken`: a sessão é refeita pelo login no desktop (e lá fica cifrada);
// - os handles das pastas do Repositório: não são transferíveis entre
//   programas. Os arquivos continuam no disco; basta escolher a mesma pasta.
// ----------------------------------------------------------------------

export const FORMATO = "oracle-dados-locais";
export const VERSAO = 1;

/** Bancos IndexedDB exportados (nome → stores). */
const BANCOS: Record<string, string[]> = {
  Oracle: ["kv"],
  "ceo-memoria": ["kv"],
};

const CHAVES_LOCAIS_FORA = new Set(["authToken"]);

/** Handles de pasta (File System Access) e marcadores de "pasta configurada". */
function chaveIdbFora(chave: string): boolean {
  return chave.startsWith("dir-handle");
}

type ValorBlob = { $oracleBlob: string };

export interface ArquivoDadosLocais {
  formato: typeof FORMATO;
  versao: number;
  origem: string;
  exportadoEm: string;
  localStorage: Record<string, string>;
  indexedDB: Record<string, Record<string, [string, unknown][]>>;
}

export interface ResumoImportacao {
  chavesLocais: number;
  registrosIdb: number;
  ignoradosExistentes: number;
}

// ------------------------------------------------------------ IndexedDB

function abrir(nome: string, stores: string[]): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(nome, 1);
    req.onupgradeneeded = () => {
      for (const s of stores) {
        if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error(`idb ${nome}`));
  });
}

function lerStore(db: IDBDatabase, store: string): Promise<[string, unknown][]> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(store)) return resolve([]);
    const os = db.transaction(store, "readonly").objectStore(store);
    const chaves = os.getAllKeys();
    const valores = os.getAll();
    valores.onsuccess = () =>
      resolve(
        (chaves.result as IDBValidKey[]).map((k, i) => [String(k), valores.result[i]]),
      );
    valores.onerror = () => reject(valores.error ?? new Error("idb getAll"));
  });
}

function ehHandle(v: unknown): boolean {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { queryPermission?: unknown }).queryPermission === "function"
  );
}

function blobParaDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("blob"));
    r.readAsDataURL(b);
  });
}

async function serializar(v: unknown): Promise<unknown> {
  if (v instanceof Blob) return { $oracleBlob: await blobParaDataUrl(v) } satisfies ValorBlob;
  return v;
}

async function desserializar(v: unknown): Promise<unknown> {
  if (typeof v === "object" && v !== null && typeof (v as ValorBlob).$oracleBlob === "string") {
    // Só data: — nunca uma URL que o arquivo importado mande buscar (GD-16).
    const dataUrl = (v as ValorBlob).$oracleBlob;
    if (!dataUrl.startsWith("data:")) return null;
    return await (await fetch(dataUrl)).blob();
  }
  return v;
}

// ------------------------------------------------------------ exportar

export async function exportarDadosLocais(): Promise<ArquivoDadosLocais> {
  const local: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || CHAVES_LOCAIS_FORA.has(k)) continue;
    const v = localStorage.getItem(k);
    if (v !== null) local[k] = v;
  }

  const idb: ArquivoDadosLocais["indexedDB"] = {};
  for (const [nome, stores] of Object.entries(BANCOS)) {
    let db: IDBDatabase;
    try {
      db = await abrir(nome, stores);
    } catch {
      continue;
    }
    try {
      for (const store of stores) {
        const linhas: [string, unknown][] = [];
        for (const [k, v] of await lerStore(db, store)) {
          if (chaveIdbFora(k) || ehHandle(v)) continue;
          linhas.push([k, await serializar(v)]);
        }
        (idb[nome] ??= {})[store] = linhas;
      }
    } finally {
      db.close();
    }
  }

  return {
    formato: FORMATO,
    versao: VERSAO,
    origem: window.location.origin,
    exportadoEm: new Date().toISOString(),
    localStorage: local,
    indexedDB: idb,
  };
}

export function baixarArquivo(dados: ArquivoDadosLocais): void {
  const blob = new Blob([JSON.stringify(dados)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `oracle-dados-locais-${dados.exportadoEm.slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// ------------------------------------------------------------ importar

export function lerArquivo(texto: string): ArquivoDadosLocais {
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }
  const d = dados as Partial<ArquivoDadosLocais>;
  if (d?.formato !== FORMATO || typeof d.versao !== "number") {
    throw new Error("Este arquivo não é uma exportação de dados do Oracle.");
  }
  if (d.versao > VERSAO) {
    throw new Error("A exportação é de uma versão mais nova do Oracle. Atualize o app.");
  }
  if (typeof d.localStorage !== "object" || typeof d.indexedDB !== "object") {
    throw new Error("Exportação incompleta.");
  }
  return d as ArquivoDadosLocais;
}

/** Quantas chaves do arquivo já existem aqui (para perguntar antes de sobrescrever). */
export function contarConflitos(dados: ArquivoDadosLocais): number {
  return Object.keys(dados.localStorage).filter(
    (k) => !CHAVES_LOCAIS_FORA.has(k) && localStorage.getItem(k) !== null,
  ).length;
}

export async function importarDadosLocais(
  dados: ArquivoDadosLocais,
  opcoes: { sobrescrever: boolean },
): Promise<ResumoImportacao> {
  const resumo: ResumoImportacao = { chavesLocais: 0, registrosIdb: 0, ignoradosExistentes: 0 };

  for (const [k, v] of Object.entries(dados.localStorage)) {
    if (CHAVES_LOCAIS_FORA.has(k) || typeof v !== "string") continue;
    if (!opcoes.sobrescrever && localStorage.getItem(k) !== null) {
      resumo.ignoradosExistentes++;
      continue;
    }
    localStorage.setItem(k, v);
    resumo.chavesLocais++;
  }

  for (const [nome, stores] of Object.entries(dados.indexedDB)) {
    if (!(nome in BANCOS)) continue;
    const db = await abrir(nome, BANCOS[nome]);
    try {
      for (const [store, linhas] of Object.entries(stores)) {
        if (!BANCOS[nome].includes(store) || !Array.isArray(linhas)) continue;
        const existentes = new Set((await lerStore(db, store)).map(([k]) => k));
        const prontos: [string, unknown][] = [];
        for (const linha of linhas) {
          if (!Array.isArray(linha) || typeof linha[0] !== "string") continue;
          const [k, v] = linha;
          if (chaveIdbFora(k)) continue;
          if (!opcoes.sobrescrever && existentes.has(k)) {
            resumo.ignoradosExistentes++;
            continue;
          }
          prontos.push([k, await desserializar(v)]);
        }
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(store, "readwrite");
          const os = tx.objectStore(store);
          for (const [k, v] of prontos) os.put(v, k);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error("idb put"));
          tx.onabort = () => reject(tx.error ?? new Error("idb abort"));
        });
        resumo.registrosIdb += prontos.length;
      }
    } finally {
      db.close();
    }
  }

  return resumo;
}

// Helpers de apresentação de arquivos, compartilhados pelas listagens de
// arquivos (Documentos e o Repositório da organização). Movidos de
// Documentos.tsx sem mudança de comportamento.

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

/** Cor/tint do badge por extensão de documento. */
export function tintForExt(ext: string): string {
  switch (ext) {
    case "pdf":
      return "bg-rose-500";
    case "doc":
    case "docx":
      return "bg-blue-500";
    case "xls":
    case "xlsx":
    case "csv":
      return "bg-emerald-500";
    case "ppt":
    case "pptx":
      return "bg-orange-500";
    case "zip":
    case "rar":
      return "bg-amber-500";
    default:
      return "bg-gray-500";
  }
}

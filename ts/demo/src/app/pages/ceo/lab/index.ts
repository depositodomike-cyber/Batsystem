// Peças compartilhadas das telas do Lab — o padrão visual que nasceu em
// Apresentação e Planilha, agora usado por todas as ferramentas.
export {
  ApresentacaoEtapa as LabEtapa,
  type EtapaStatus,
} from "../ApresentacaoEtapa";
export { LabPagina } from "./LabPagina";
export { LabCarregando } from "./LabCarregando";
export { LabResultado } from "./LabResultado";
export { PerguntaEtapa } from "./PerguntaEtapa";
export { AcoesEtapa } from "./AcoesEtapa";
export { useEtapasLab, type EtapaLab } from "./useEtapasLab";
export * from "./estilos";
export { useCriacaoLab, type PassoLab } from "./useCriacaoLab";
export { LabAjuste } from "./LabAjuste";
export { LabArquivo } from "./LabArquivo";

<!-- Parecer emitido pelo Security Engineer Agent (revisor independente). Registrado sem alterar o veredito. -->
# Parecer: Gate A (arquitetura), Fases 1–3, rodada 2
Veredito: **APROVADO**, com condições para o gate B. Não resta achado CRITICA ou ALTA em aberto.
Data: 2026-11-12

## Escopo revisado
Versões atualizadas de `requisitos.md` (SR-06, 06a, 06b, 07, 09, 11a, 12a, 26–29, 35–37), `threat-model.md` (T23–T27, §5) e `achados.md` (GA-01 a GA-13). Para conferir os pontos de entrada do contexto, li de novo `orquestrador.service.ts:116-140`. Continua sem código, então não rodei testes.

## Evidências
- `mensagensIniciais` coloca no contexto do executor o histórico da conversa e `referencia` (o conteúdo de notas e to-dos enviado pelo cliente) sem gerar nenhuma etapa (orquestrador.service.ts:122-138, 276). É o que motiva o GA-14.
- O SR-06a torna alta qualquer `abrir_url` fora da allowlist. Isso fecha a exfiltração que fazia do GA-01 um achado ALTA.

## Revalidação
| GA | Status | Observação |
|---|---|---|
| GA-01 | VALIDADO | A lacuna que sobra está no GA-14 |
| GA-02 | VALIDADO | Ressalva no GA-17 |
| GA-03 | VALIDADO | Gate B: `AprovacaoAcao.risco` tem de gravar o risco desktop (baixo/moderado/alto), não `escrita_externa` (executor.service.ts:695) |
| GA-04 | VALIDADO | Gate B: `EtapaExecucao.saida` também sai redigida (executor.service.ts:741) |
| GA-05 | VALIDADO | Gate B: o parser de `/desktop/agente/*` é registrado antes do `json` global |
| GA-06 | VALIDADO | — |
| GA-07 | VALIDADO | Impressão digital de 64 bits é adequada |
| GA-08 | VALIDADO | `emitidoEm` dentro dos bytes assinados |
| GA-09 | VALIDADO | — |
| GA-10 | VALIDADO | Gate B: `voz_ativacao` também no modo de conversa contínua |
| GA-11 | NÃO VALIDADO (MEDIA, não bloqueia) | Ver GA-15 |
| GA-12 | VALIDADO | Ver GA-16 |
| GA-13 | VALIDADO | — |

## Achados novos
| ID | Sev. | Título | Local | Correção |
|---|---|---|---|---|
| GA-14 | MEDIA | A contaminação ignora o histórico da conversa e `referencia` | orquestrador.service.ts:122-138 | `Execucao.contextoExterno`, calculado pelo servidor; testes `contaminacao_referencia` e `contaminacao_historico` |
| GA-15 | MEDIA | O SR-35 não trata domínios, "pedir confirmação" e apps observáveis como ampliação | SR-35 | Ampliação = qualquer mudança que reduza o risco ou aumente o alcance ou a observação, incluindo a política inicial; a bandeja mostra o diff |
| GA-16 | BAIXA | Correspondência de host não especificada (IDN, ponto final, maiúsculas, porta) | SR-06a | Comparar `IdnHost` em minúsculas, sem ponto final, por rótulos; testar `evil-exemplo.com` e `exemplo.com.evil.com` |
| GA-17 | BAIXA | `.doc .xls .ppt` (macros sem MOTW) e `.svg` (script via file://) | SR-12a | Tirar da allowlist ou classificar como alto |

## Condições
1. Especificar o GA-14 e o GA-15 em `requisitos.md`.
2. Registrar GA-14 a GA-17 como `ABERTO`.
3. GA-01 a GA-10, GA-12 e GA-13 passam a `VALIDADO`; o GA-11 fica `CORRIGIDO` até o SR-35 ser ajustado.

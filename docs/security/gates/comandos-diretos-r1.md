<!-- Parecer emitido pelo Security Engineer Agent (revisor independente). Registrado sem alterar o veredito. -->
# Parecer: Gate B (código), comandos de computador / comando direto (SR-06d)
Veredito: **APROVADO, com ressalvas**. Nenhum achado CRITICA ou ALTA; o GC-01 deve ser corrigido antes do próximo gate.
Data: 2026-11-12

## Evidências
- jest (desktop, orquestrador, acesso): 360/360.
- tsc api e demo: exit 0.
- `npm run test:unit`: 2/2.
- Bloqueados:
  - **Modelo forjando comando direto (T28):** a marcação só vem do executor (turno 1, índice 0), e o gateway confere a etapa ordem 1 no banco e reaplica o parser sobre `Execucao.pedido`, comparando com o hash.
  - **Conteúdo externo:** o caminho rápido roda sem histórico nem referência.
  - **Risco que desce:** só nas 3 operações e depois das checagens de `bloqueado` e de `confirmar`.
  - **Fuzzy:** só resolve para apps do inventário que estão autorizados.
  - **Apelidos:** não ampliam o alcance.

## Achados
| ID | Sev. | Título | Correção |
|---|---|---|---|
| GC-01 | MEDIA | Uma alternativa de voz transforma um pedido que não é comando em comando direto, ou troca a operação (`melhorComando` pula o principal quando ele é null) | Usar alternativas só por voz, e só quando o principal já for um comando do mesmo tipo e operação (a alternativa só corrige o alvo); testes |
| GC-02 | BAIXA | O texto principal se perde quando uma alternativa é usada | Gravar o principal e a alternativa na auditoria |
| GC-03 | BAIXA | O Desfazer fecha todas as instâncias, inclusive as que já estavam abertas | Só oferecer quando o abrir iniciou um processo novo; avisar |
| GC-04 | BAIXA | O Desfazer não aplica o limite SR-33 nem a categoria no servidor | Aplicar os dois |
| GC-05 | BAIXA | Nome do app em qualquer ponto do texto dá nota 0,9: "executa claude e apaga tudo" abre o app e descarta o resto | No caminho direto, exigir alvo curto; se sobrar texto, fluxo normal |
| GC-06 | INFO | Faltam testes: etapa ordem≠1, turno 2 com a mesma ferramenta, retomada | Adicionar |
| GC-07 | INFO | "liga pra Maria" e "roda X" podem cair no "Você quis dizer…?" | Tirar "liga" e "usar" ou exigir alvo reconhecido |

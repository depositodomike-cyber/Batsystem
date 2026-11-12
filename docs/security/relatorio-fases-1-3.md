# Relatório de segurança: controle do computador pelo Oracle, Fases 1–3

Data: 2026-11-12. Revisor independente: Security Engineer Agent (`.claude/agents/security-engineer.md`, somente leitura).

## Resultado

**Liberação técnica aprovada** (Gate B, rodada 2). Não há achado crítico ou alto pendente, e o teste SR-51 passa contra o registro real.

| Gate | Rodada | Veredito | Parecer |
|---|---|---|---|
| A: arquitetura | 1 | REPROVADO (3 altas) | [gates/fase-1-arquitetura-r1.md](gates/fase-1-arquitetura-r1.md) |
| A: arquitetura | 2 | APROVADO | [gates/fase-1-arquitetura-r2.md](gates/fase-1-arquitetura-r2.md) |
| B: código | 1 | REPROVADO (1 alta) | [gates/fase-1-3-codigo-r1.md](gates/fase-1-3-codigo-r1.md) |
| B: código | 2 | APROVADO | [gates/fase-1-3-codigo-r2.md](gates/fase-1-3-codigo-r2.md) |

Foram 29 achados no total (GA-01–17, GB-01–12): 4 altos, todos corrigidos e revalidados. Registro completo em [achados.md](achados.md).

## Achados que mudaram o desenho

- **GA-01:** dados do próprio Repositório também contam como conteúdo não confiável. A regra de "execução limpa" passou a ser calculada no banco, e URLs fora da allowlist de domínios exigem aprovação. Isso fecha a exfiltração pela query string.
- **GA-02:** `abrir_documento` passou de lista de bloqueio para allowlist de extensões.
- **GA-03:** prova de aprovação no gateway. A aprovação fica vinculada a execução, etapa, ferramenta, hash e risco, vale 10 min e só é consumida uma vez (`aprovacaoId @unique`).
- **GB-01:** pastas proibidas (AppData, Startup, ocultas, nomes 8.3) passaram a ser checadas em todo o caminho-alvo, nos dois lados. `mover` só aceita documentos.

## Evidências de teste (rodada final)

| Suíte | Resultado |
|---|---|
| `ts/api`: `npx jest src/desktop src/orquestrador src/acesso` | 261/261 |
| `desktop-agent`: `dotnet test` | 72/72 |
| `ts/demo`: `npm run test:unit` | 2/2 |
| `dotnet list package --vulnerable` | nenhum pacote (o agente não tem dependência NuGet) |
| `npm audit` | sem achado novo; os já existentes ficam em GB-09 |

Os testes cobrem, entre outros:

- Risco que nunca desce (propriedade testada para todas as operações).
- Assinatura, replay, timestamp e corpo cru.
- Aprovação ausente, adulterada, de risco menor ou reutilizada.
- Falha fechada.
- Contaminação por memória, referência e histórico.
- Junction real e caminho final por handle.
- Chave CNG não exportável.
- Corrida na confirmação local.
- "Pare tudo" durante uma execução.

## Riscos residuais aceitos

- **T25:** com o JWT do dono, um atacante age dentro do que o computador já confirmou localmente. A reautenticação para aprovar risco alto fica para a Fase 4.
- **GB-05:** `Execucao.estado` e `AprovacaoAcao` guardam os parâmetros completos. Isso é necessário para executar exatamente o que foi aprovado.
- **GB-06:** sobra uma janela de microssegundos entre conferir o caminho final e agir. Só pode ser explorada por quem já tem escrita local.
- **T16:** malware rodando como o mesmo usuário do Windows está fora de escopo.

## Pendências (não bloqueiam)

- **GB-09:** atualizar dependências com vulnerabilidades já existentes (`zod`, `body-parser`/`@nestjs/platform-express`, `proxy-addr`). Fazer antes de expor a API fora do localhost.
- **GB-12:** devolver 413 em vez de 500 para corpo grande.
- **GB-10:** trocar o vínculo por substring por campo estruturado.
- A revalidação de GB-10 e GB-11 pelo revisor fica para o próximo gate.

## Liberação

A funcionalidade só liga com `DESKTOP_ATIVO=true` em `ts/api/.env`. Mesmo assim, ela continua bloqueada automaticamente sempre que `achados.md` tiver crítico ou alto pendente (SR-51) e em deploy Vercel (SR-36).

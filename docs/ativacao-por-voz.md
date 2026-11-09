# Ativação por voz ("Oracle")

Diga só **"Oracle"**, espere o bipe e faça a pergunta: o Oracle abre o ditado,
escreve o que você falou na barra de pesquisa e envia sozinho quando você para
de falar. Em seguida o microfone do ditado fecha, e só reabre quando você disser
"Oracle" de novo.

- **A palavra precisa ser dita sozinha**, com uma pausa curta depois. "Oracle,
  qual é…" numa frase só não aciona — é isso que evita disparos durante uma
  conversa comum. Também é exigida confiança alta no reconhecimento
  (`VITE_WAKE_CONFIDENCE`).

- A **detecção da palavra** roda no seu computador, com o
  [Vosk](https://alphacephei.com/vosk/) (código aberto, WebAssembly). Sem conta,
  sem chave, e o áudio não sai da máquina enquanto o Oracle espera a palavra.
- Depois da palavra, o **ditado** usa o reconhecimento de fala do navegador
  (Chrome/Edge), que envia o áudio da pergunta ao serviço do navegador.
- Só funciona com o Oracle aberto numa aba do navegador.

## Configuração (uma vez)

1. **Baixe o modelo** em <https://alphacephei.com/vosk/models>:
   `vosk-model-small-en-us-0.15.zip` (~40 MB). O modelo em inglês é o padrão
   porque "oracle" existe no vocabulário dele.

2. **Reempacote como `.tar.gz`** (o Vosk no navegador só lê esse formato) e
   coloque em `ts/demo/public/wake/`. No PowerShell, dentro da pasta onde
   baixou:

   ```
   Expand-Archive vosk-model-small-en-us-0.15.zip -DestinationPath .
   tar -czf vosk-model-small-en-us-0.15.tar.gz vosk-model-small-en-us-0.15
   Move-Item vosk-model-small-en-us-0.15.tar.gz C:\Users\Mike\Documents\GitHub\Batsystem\ts\demo\public\wake\
   ```

3. **Ligue** em **Configurações › Voz › Ativação por voz** e permita o
   microfone quando o navegador pedir. Na primeira vez o modelo leva alguns
   segundos para carregar (ponto âmbar).

## Como saber se está funcionando

O botão de microfone da barra de pesquisa ganha um ponto:

| Ponto | Significado |
|---|---|
| verde, pulsando | esperando a palavra |
| âmbar | carregando o modelo |
| cinza | pausado (durante o ditado ou a busca) |
| vermelho | erro — passe o mouse no microfone para ver o motivo |

## Ajustes opcionais (`ts/demo/.env.local`)

Depois de mudar, reinicie o servidor web (o Vite só lê o `.env.local` ao iniciar).

| Variável | Padrão | Para quê |
|---|---|---|
| `VITE_WAKE_WORD_LABEL` | `Oracle` | Como a palavra aparece na interface |
| `VITE_WAKE_WORDS` | `oracle` | Palavras que acionam, separadas por vírgula; precisam existir no vocabulário do modelo |
| `VITE_WAKE_MODEL_PATH` | `/wake/vosk-model-small-en-us-0.15.tar.gz` | Outro modelo |
| `VITE_WAKE_CONFIDENCE` | `0.85` | 0–1: confiança mínima para acionar. Baixe (ex.: `0.7`) se ele não reconhecer sua voz; suba para ficar ainda mais rigoroso |

Exemplo com o modelo em português (`vosk-model-small-pt-0.3`), em que "oracle"
não existe no vocabulário:

```
VITE_WAKE_MODEL_PATH=/wake/vosk-model-small-pt-0.3.tar.gz
VITE_WAKE_WORDS=oráculo
VITE_WAKE_WORD_LABEL=Oráculo
```

## Observações

- O reconhecedor só conhece as palavras de ativação; o resto da fala cai em
  "desconhecido" e descarta a frase inteira.
- Para ouvir "Oracle", a escuta da palavra mantém o microfone aberto (ponto
  verde), mas nada é gravado nem enviado. Durante o ditado e a busca ela fica
  desligada.
- O código está em `ts/demo/src/configs/wakeWord.ts` (configuração),
  `ts/demo/src/components/template/PromptBar/useWakeWord.ts` (motor) e na
  própria `PromptBar` (ditado e envio).

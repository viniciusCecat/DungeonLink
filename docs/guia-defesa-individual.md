# Guia Rápido para Apresentação e Defesa — DungeonLink

Na sala, os slides são no formato **Pitch** (sem código, explicando o problema, a ideia e mostrando funcionando). Depois, o professor faz **perguntas individuais** para cada integrante. Abaixo estão as respostas diretas para estudar.

---

## 1. Como falar no Pitch (até 10 minutos)

1. **Problema:** muita gente faz projeto de sensor só para ver número subindo na tela do PC. Fica sem graça e distante de quem usa.
2. **Ideia:** o DungeonLink pega a luz da sala e um botão físico e joga direto dentro de uma miniaventura 2D no celular.
3. **Como funciona:** apertou o botão na placa → abre uma nova fase. Tampou o sensor de luz → o jogo fica escuro com tocha e o LED da placa acende sozinho. Ganhou a fase → o LED da placa pisca comemorando.
4. **Diferenciais:** funciona mesmo sem internet ou celular (regra local na placa), usa Bluetooth de baixo consumo sem depender de Wi-Fi da sala, tem gráfico de leituras no app e bloqueia comandos falsos com assinatura de segurança.

---

## 2. Perguntas que o professor pode fazer (e como responder simples)

### Sobre as ligações e peças
- **Por que o sensor de luz (LDR) está no pino D34 e não em qualquer pino?**
  - *Resposta:* Porque o D34 usa o conversor analógico **ADC1**. Os pinos do **ADC2** dão conflito quando o Bluetooth/Wi-Fi do ESP32 está ligado. Além disso, o D34 é só de entrada, então é perfeito para ler o sensor.
- **Como funciona o LDR com o resistor de 10 kΩ?**
  - *Resposta:* Os dois formam um divisor de tensão entre `3.3V` e `GND`. Quando bate mais luz, a resistência do LDR cai e a tensão lida no `D34` sobe. No escuro, a tensão cai.
- **Por que colocaram resistor de 220 Ω no LED vermelho?**
  - *Resposta:* Para limitar a corrente e não queimar nem o LED nem o pino do ESP32. Com `3.3V` na saída e cerca de `1.9V` no LED, sobra cerca de `6,4 mA`, bem abaixo do máximo do pino.
- **Por que o botão não tem resistor externo?**
  - *Resposta:* Porque ligamos o resistor interno do próprio ESP32 (`INPUT_PULLUP`). Solto ele lê alto (`HIGH`); apertado contra o `GND` ele lê baixo (`LOW`). Também colocamos um filtro de tempo de 50 ms (debounce) para um aperto não contar duas vezes.

### Sobre os requisitos obrigatórios (R1 a R5)
- **Qual é a regra local (R2) que funciona sem internet?**
  - *Resposta:* Mesmo sem Wi-Fi e sem celular conectado, o ESP32 lê o LDR a cada 100 ms. No modo padrão (`auto`), se ficar escuro (`< 1500`), ele acende o LED vermelho sozinho; se clarear (`> 1800`), ele apaga.
- **Por que usaram dois valores (1500 e 1800) em vez de um número só?**
  - *Resposta:* Se usasse um valor só, qualquer sombrinha ou ruído na luz faria o LED e o tema do jogo ficarem piscando sem parar. Essa folga de 300 pontos entre 1500 e 1800 se chama **histerese** e deixa a troca estável.
- **Onde o sistema mostra o estado sem usar Monitor Serial (R5)?**
  - *Resposta:* Nos **LEDs da placa** (azul mostra se o Bluetooth está conectado; vermelho mostra escuro/claro e pisca nas confirmações) e na **tela do aplicativo** (barra no topo com conexão, % de luz, estado do LED, jogo 2D, gráfico e tabela).

### Sobre Bluetooth e mensagens (R3 e R4)
- **Por que escolheram BLE (Bluetooth Low Energy) e não Wi-Fi ou MQTT?**
  - *Resposta:* Porque a placa fica perto do celular do jogador (alcance de 10 a 30 m), o BLE gasta bem menos bateria que Wi-Fi, tem velocidade de sobra para mensagens curtas e não depende de senha de Wi-Fi da faculdade nem de servidor externo (custo zero).
- **Como são as mensagens trocadas (R4)?**
  - *Resposta:* Enviamos textos curtos em formato **JSON** terminados com quebra de linha (`\n`). Do ESP32 para o celular vai o tipo do evento (`dungeon_req` ou `telemetry`), a fase, o valor da luz, se o LED está aceso e a assinatura `mac`. Do celular para o ESP32 vai confirmação (`ack`) ou comando (`cmd`) com assinatura.
- **Como evitaram que mensagens grandes quebrem no Bluetooth?**
  - *Resposta:* O Bluetooth padrão manda pacotes curtos (a partir de 20 bytes úteis). Nós pedimos um tamanho maior (MTU 256) e, por garantia, quebramos e remontamos a mensagem até chegar o `\n` no final.

### Sobre segurança (+10% de nota)
- **Onde fica a chave secreta? Ela vai para o GitHub?**
  - *Resposta:* Não vai. A chave fica só nos arquivos locais `secrets.h` (ESP32) e `.env` (app), que estão bloqueados no `.gitignore`. No GitHub sobem apenas arquivos `.example` com texto de exemplo.
- **Como vocês impedem que alguém mande comandos falsos para o ESP32?**
  - *Resposta:* Cada mensagem leva uma assinatura **HMAC-SHA256** (16 caracteres no campo `mac`) feita com a chave secreta, além de um número de sequência (`seq`) que só sobe (evita repetir mensagem antiga) e limite de tamanho/tempo. Se a assinatura não bater, o ESP32 ignora o comando e devolve erro `AUTH_FAILED`.

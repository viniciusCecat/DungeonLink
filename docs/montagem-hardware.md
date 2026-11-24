# Guia de Montagem e Gravação — DungeonLink

Faça toda a montagem na protoboard **com o cabo USB desconectado**.

---

## Lista de peças

- 1 ESP32 DevKit V1 (30 ou 38 pinos)
- 1 sensor de luz **LDR** (GL5528)
- 1 resistor de **10 kΩ** (faixas: **marrom, preto, laranja** ou **marrom, preto, preto, vermelho**)
- 1 **LED vermelho** de 5 mm
- 1 resistor de **220 Ω** (faixas: **vermelho, vermelho, marrom** ou **vermelho, vermelho, preto, preto**)
- Protoboard, jumpers e cabo USB de dados

---

## Passo a passo na protoboard

### Passo 1 — Energia na protoboard
1. Encaixe o ESP32 na protoboard (atravessando o vão do meio).
2. Ligue o pino **`3V3`** do ESP32 no trilho **`+` (vermelho)**. *(Nunca ligue no `VIN` ou `5V`.)*
3. Ligue o pino **`GND`** do ESP32 no trilho **`-` (azul)**.

### Passo 2 — Sensor de luz (LDR + resistor de 10 kΩ)
1. Ligue uma perna do **LDR** no trilho **`+` (3.3V)** e a outra numa fileira livre (*Fileira A*). *(LDR não tem lado.)*
2. Ligue o **resistor de 10 kΩ** saindo dessa **mesma Fileira A** até o trilho **`-` (GND)**.
3. Puxe um jumper dessa **mesma Fileira A** até o pino **`D34`** (ou `34`) do ESP32.

### Passo 3 — LED vermelho (+ resistor de 220 Ω)
1. Puxe um jumper do pino **`D26`** (ou `26`) até uma fileira livre (*Fileira B*).
2. Ligue o **resistor de 220 Ω** da *Fileira B* para outra fileira livre (*Fileira C*).
3. Encaixe a **perna longa (`+`)** do LED vermelho na *Fileira C*.
4. Encaixe a **perna curta / lado reto (`-`)** do LED no trilho **`-` (GND)**.

### Resumo dos 4 pinos no ESP32
- `3V3` → trilho `+`
- `GND` → trilho `-`
- `D34` → ponto entre o LDR e o resistor 10 kΩ
- `D26` → resistor 220 Ω → perna longa do LED → perna curta no `GND`

*(O botão externo foi removido para simplificar a protoboard — o botão nativo **`BOOT`** da placa ou o botão de mapa do app já trocam de fase. O LED azul da placa no pino `D2` pisca esperando Bluetooth e fica aceso fixo quando o celular conecta.)*

---

## Como gravar o código no ESP32

A chave secreta já está configurada em `firmware/dungeonlink_esp32/secrets.h` (arquivo ignorado pelo Git), igual à de `app/.env`.

1. Plugue o ESP32 na USB do PC e veja qual porta apareceu:
   ```bash
   ls /dev/ttyUSB* /dev/ttyACM*
   ```
   *(Se der erro de permissão na porta: `sudo usermod -aG dialout $USER` e reinicie a sessão.)*
2. Compile e grave:
   ```bash
   arduino-cli compile --fqbn esp32:esp32:esp32 firmware/dungeonlink_esp32
   arduino-cli upload -p /dev/ttyUSB0 --fqbn esp32:esp32:esp32 firmware/dungeonlink_esp32
   ```
   *(Se ficar travado em `Connecting...`, segure o botão **BOOT** do ESP32 por 2 segundos.)*
3. **Teste rápido sem celular:**
   - Tampe o LDR com o dedo → o **LED vermelho acende sozinho**.
   - Tire o dedo → o **LED vermelho apaga**.
   - Aperte o botão físico → o LED vermelho dá uma piscada longa.

*(Se preferir usar a Arduino IDE: instale a placa **esp32 versão 4.0.0**, a biblioteca **ArduinoJson 7.x**, abra `dungeonlink_esp32.ino` em **ESP32 Dev Module** e clique em Carregar.)*

---

## Como instalar o app no celular Android

1. Passe o arquivo `dist-entrega/DungeonLink-debug.apk` para o celular e instale.
2. Ligue o **Bluetooth** do celular (no Android 11 ou menor, ligue também a Localização).
3. Abra o **DungeonLink**, toque em **Conectar ESP32** e escolha **DungeonLink-ESP32**.

---

## Como colocar as fotos da placa no relatório PDF

1. Tire 2 fotos da montagem funcionando e salve na pasta `docs/fotos/`:
   - `foto-montagem-1.jpg` (visão geral da protoboard)
   - `foto-montagem-2.jpg` (close nos fios ou LED aceso no escuro)
2. Rode o comando abaixo para atualizar `dist-entrega/relatorio-dungeonlink.pdf`:
   ```bash
   node docs/relatorio/generate-report.mjs
   ```

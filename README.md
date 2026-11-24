# DungeonLink — Jogo 2D de IoT com ESP32 e Bluetooth

**Integrantes:** Vinicius Cecatto e Leonardo Scheffer Nunes  
**Disciplina:** Internet das Coisas (IoT) — Prof. Marcos Augusto Campagnaro Mucelini (2º Semestre / 2026)

O **DungeonLink** liga uma montagem física no **ESP32** a um **jogo 2D em pixel art no Android** usando **Bluetooth Low Energy (BLE)**.  
Quando a luz da sala muda, o jogo muda de tema na hora e o LED físico responde sozinho — mesmo sem internet.

---

## Como o projeto funciona (4 camadas de IoT)

1. **Percepção:** sensor de luz **LDR** (`D34`), **LED vermelho** (`D26`), botão nativo **`BOOT`** da placa (`GPIO 0`) e **LED azul da placa** (`D2`).
2. **Rede:** conexão **Bluetooth Low Energy (BLE)** direto entre ESP32 e celular, trocando mensagens JSON assinadas, mais relay WebSocket opcional para partidas online.
3. **Processamento:**
   - **No ESP32:** lê a luz a cada 100 ms, faz média de 8 leituras, usa histerese (`< 620` escuro / `> 780` claro) para o LED não ficar piscando e acende o LED vermelho no escuro **sem precisar de internet ou celular**. Também confere a assinatura de segurança de cada comando recebido.
   - **No celular:** confere a assinatura dos dados recebidos, roda o jogo 2D em tela cheia horizontal e guarda o histórico.
4. **Aplicação:** app Android com 3 masmorras (3 salas cada, inimigos intermediários, chefe e portal), mochila com 7 armas / 5 armaduras / 3 relíquias, modo online **CO-OP e X1**, mudança ao vivo entre claro/escuro e menu **Opções** com gráfico de telemetria e painel de segurança.

---

## Pastas do projeto

```text
DungeonLink/
├── firmware/dungeonlink_esp32/   # Código do ESP32 (secrets.h não vai pro Git)
├── app/                          # App Android em React + Capacitor 6
├── docs/
│   ├── fotos/                    # Prints do app e fotos da montagem física
│   ├── relatorio/                # Script que gera o relatório PDF (8–15 págs)
│   ├── slides/                   # Script que gera os slides Pitch (.pptx e .pdf)
│   ├── montagem-hardware.md      # Passo a passo simples da protoboard
│   ├── roteiro-video.md          # Roteiro de 4 min para o vídeo
│   └── guia-defesa-individual.md # Perguntas e respostas da apresentação
└── .gitignore                    # Bloqueia senhas/chaves e builds pesados
```

---

## Como rodar em outro computador

### 1. Configurar a chave de segurança (obrigatório)

As chaves reais não ficam no GitHub. Antes de compilar, copie os arquivos de exemplo:

```bash
cp firmware/dungeonlink_esp32/secrets.example.h firmware/dungeonlink_esp32/secrets.h
cp app/.env.example app/.env
```

Abra `firmware/dungeonlink_esp32/secrets.h` e `app/.env` e coloque **exatamente a mesma senha/chave** nos dois (`BLE_AUTH_SECRET` e `VITE_BLE_AUTH_SECRET`).

### 2. Gravar o código no ESP32

Requer plataforma **ESP32 versão 4.0.0** (`<BLE.h>`) e biblioteca **ArduinoJson (v7)**.

```bash
arduino-cli core update-index
arduino-cli core install esp32:esp32@4.0.0
arduino-cli lib install "ArduinoJson"

arduino-cli compile --fqbn esp32:esp32:esp32 firmware/dungeonlink_esp32
arduino-cli upload -p /dev/ttyUSB0 --fqbn esp32:esp32:esp32 firmware/dungeonlink_esp32
```

### 3. Testar protocolo e gerar o APK Android

```bash
cd app
npm install
node scripts/verify-protocol.mjs
npm run cap:sync
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android && ./gradlew assembleDebug
```

O instalador sai em `app/android/app/build/outputs/apk/debug/app-debug.apk`.

### 4. Gerar relatório PDF e slides de novo (se alterar fotos/textos)

```bash
cd docs/tools && npm install && npx playwright install chromium && cd ../..
node docs/relatorio/generate-report.mjs
node docs/slides/generate-slides.mjs
```

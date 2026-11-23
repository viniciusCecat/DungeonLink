#include <Arduino.h>
#include <BLE.h>
#include <ArduinoJson.h>

#include "config.h"
#include "security.h"

// ============================================================
// Estado Global BLE e Buffer RX Thread-Safe
// ============================================================
BLEServer bleServer;
BLECharacteristic txChr;
BLECharacteristic rxChr;

volatile bool bleConnected = false;
volatile bool shouldRestartAdvertising = false;
volatile unsigned long disconnectTimestamp = 0;
volatile uint16_t negotiatedMtu = 23;

portMUX_TYPE rxMux = portMUX_INITIALIZER_UNLOCKED;
String rxStreamBuffer = "";
String pendingRxCommand = "";
volatile bool hasPendingRxCommand = false;

// ============================================================
// Estado do Sistema IoT (R1, R2, Telemetria, Seguranca)
// ============================================================
int ldrSamples[LDR_AVG_WINDOW];
int ldrSampleIndex = 0;
int ldrRawAvg = 2400;
int ldrPct = 59;
bool isDark = false;

String ledMode = "auto";      // "auto" | "manual"
bool manualLedState = false;
bool targetLedState = false;

int currentDungeonId = 1;
uint32_t txSeq = 0;
uint32_t lastCmdSeq = 0;
unsigned long lastRxHandledMs = 0;

unsigned long lastLdrSampleMs = 0;
unsigned long lastTelemetryMs = 0;
unsigned long lastBleBlinkMs = 0;
bool bleOnboardLedState = false;

// Debounce do botao fisico
int lastButtonReading = HIGH;
int stableButtonState = HIGH;
unsigned long lastButtonDebounceMs = 0;

// Maquina de estados nao-bloqueante para animacao de LED vermelho
struct LedBlinkPattern {
  bool active = false;
  int pulsesRemaining = 0;
  bool phaseOn = false;
  unsigned long phaseDurationMs = 90;
  unsigned long lastTransitionMs = 0;
};
LedBlinkPattern ledPattern;

// ============================================================
// Utilitarios de Hardware (Sensor, Botao e LEDs)
// ============================================================
int readSingleLdr() {
  int raw = analogRead(PIN_LDR);
  if (LDR_INVERTED) {
    raw = 4095 - raw;
  }
  return constrain(raw, 0, 4095);
}

void initLdrFilter() {
  long sum = 0;
  for (int i = 0; i < LDR_AVG_WINDOW; i++) {
    int val = readSingleLdr();
    ldrSamples[i] = val;
    sum += val;
    delay(5);
  }
  ldrRawAvg = static_cast<int>(sum / LDR_AVG_WINDOW);
  ldrPct = map(ldrRawAvg, 0, 4095, 0, 100);
  isDark = (ldrRawAvg < LDR_DARK_ENTER);
}

void sampleLdrAndApplyLocalRule(bool& stateChanged) {
  stateChanged = false;
  int fresh = readSingleLdr();
  ldrSamples[ldrSampleIndex] = fresh;
  ldrSampleIndex = (ldrSampleIndex + 1) % LDR_AVG_WINDOW;

  long sum = 0;
  for (int i = 0; i < LDR_AVG_WINDOW; i++) {
    sum += ldrSamples[i];
  }
  ldrRawAvg = static_cast<int>(sum / LDR_AVG_WINDOW);
  ldrPct = constrain(map(ldrRawAvg, 0, 4095, 0, 100), 0, 100);

  bool prevDark = isDark;
  if (!isDark && ldrRawAvg < LDR_DARK_ENTER) {
    isDark = true;
  } else if (isDark && ldrRawAvg > LDR_DARK_EXIT) {
    isDark = false;
  }

  bool prevTargetLed = targetLedState;
  if (ledMode == "auto") {
    targetLedState = isDark;
  } else {
    targetLedState = manualLedState;
  }

  if (prevDark != isDark || prevTargetLed != targetLedState) {
    stateChanged = true;
  }
}

void startLedBlinkPattern(int pulses, unsigned long phaseMs) {
  ledPattern.active = true;
  ledPattern.pulsesRemaining = pulses;
  ledPattern.phaseOn = true;
  ledPattern.phaseDurationMs = phaseMs;
  ledPattern.lastTransitionMs = millis();
  digitalWrite(PIN_LED_RED, HIGH);
}

void updateRedLedOutput() {
  if (!ledPattern.active) {
    digitalWrite(PIN_LED_RED, targetLedState ? HIGH : LOW);
    return;
  }

  unsigned long now = millis();
  if (now - ledPattern.lastTransitionMs < ledPattern.phaseDurationMs) {
    return;
  }
  ledPattern.lastTransitionMs = now;

  if (ledPattern.phaseOn) {
    ledPattern.phaseOn = false;
    digitalWrite(PIN_LED_RED, LOW);
    ledPattern.pulsesRemaining--;
    if (ledPattern.pulsesRemaining <= 0) {
      ledPattern.active = false;
      digitalWrite(PIN_LED_RED, targetLedState ? HIGH : LOW);
    }
  } else {
    ledPattern.phaseOn = true;
    digitalWrite(PIN_LED_RED, HIGH);
  }
}

void updateBleStatusLed() {
  if (bleConnected) {
    digitalWrite(PIN_LED_BLE, HIGH);
    return;
  }
  unsigned long now = millis();
  if (now - lastBleBlinkMs >= 500UL) {
    lastBleBlinkMs = now;
    bleOnboardLedState = !bleOnboardLedState;
    digitalWrite(PIN_LED_BLE, bleOnboardLedState ? HIGH : LOW);
  }
}

// ============================================================
// Comunicacao BLE TX com Framing '\n' e Assinatura HMAC
// ============================================================
void sendNotifyJson(const String& json) {
  if (!bleConnected || !txChr || txChr.getSubscribedCount() == 0) {
    return;
  }

  txChr.setValue(json);

  String framed = json + "\n";
  const uint8_t* ptr = reinterpret_cast<const uint8_t*>(framed.c_str());
  size_t totalLen = framed.length();
  int maxChunk = min(static_cast<int>(negotiatedMtu) - 3, 180);
  if (maxChunk < 20) {
    maxChunk = 20;
  }

  size_t offset = 0;
  while (offset < totalLen) {
    size_t chunkLen = min(static_cast<size_t>(maxChunk), totalLen - offset);
    txChr.notify(ptr + offset, chunkLen);
    offset += chunkLen;
    if (offset < totalLen) {
      delay(6);
    }
  }
}

void sendErrorPacket(const char* code, const char* msg) {
  JsonDocument doc;
  doc["v"] = 1;
  doc["type"] = "err";
  doc["code"] = code;
  doc["msg"] = msg;

  String out;
  serializeJson(doc, out);
  DL_LOG("[BLE ERR] ");
  DL_LOGLN(out);
  sendNotifyJson(out);
}

void sendSignedStatePacket(const char* type) {
  txSeq++;
  const char* lightStr = isDark ? "dark" : "bright";
  int ledInt = targetLedState ? 1 : 0;

  String canonical = DungeonSecurity::buildTxCanonical(
    type,
    txSeq,
    currentDungeonId,
    lightStr,
    ldrRawAvg,
    ledInt,
    ledMode.c_str()
  );
  String mac = DungeonSecurity::computeHmacHex16(canonical);

  JsonDocument doc;
  doc["v"] = 1;
  doc["type"] = type;
  doc["seq"] = txSeq;
  doc["dungeon_id"] = currentDungeonId;
  doc["light"] = lightStr;
  doc["ldr_raw"] = ldrRawAvg;
  doc["ldr_pct"] = ldrPct;
  doc["led"] = ledInt;
  doc["mode"] = ledMode;
  doc["ts"] = millis();
  doc["mac"] = mac;

  String out;
  serializeJson(doc, out);
  DL_LOG("[BLE TX] ");
  DL_LOGLN(out);
  sendNotifyJson(out);
}

void triggerNewDungeonSelection() {
  int step = 1 + (ldrRawAvg & 1);
  currentDungeonId = ((currentDungeonId - 1 + step) % 3) + 1;
  startLedBlinkPattern(1, 250);
  DL_LOGF("[LOCAL] Nova dungeon selecionada: ID=%d | Luz=%s (%d)\n",
          currentDungeonId, isDark ? "dark" : "bright", ldrRawAvg);
  sendSignedStatePacket("dungeon_req");
}

// ============================================================
// Processamento Seguro de Payloads RX no Loop Principal
// ============================================================
void processIncomingCommand(const String& rawJson) {
  unsigned long now = millis();
  if (now - lastRxHandledMs < RX_MIN_INTERVAL_MS) {
    sendErrorPacket("RATE_LIMIT", "Muitos comandos em intervalo curto");
    return;
  }
  lastRxHandledMs = now;

  if (rawJson.length() == 0 || rawJson.length() > RX_MAX_PAYLOAD_BYTES) {
    sendErrorPacket("PAYLOAD_TOO_LARGE", "Tamanho de payload fora do limite");
    return;
  }

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, rawJson);
  if (err) {
    sendErrorPacket("INVALID_JSON", "Falha ao interpretar JSON");
    return;
  }

  int version = doc["v"] | 0;
  const char* type = doc["type"] | "";
  uint32_t seq = doc["seq"] | 0U;
  const char* action = doc["action"] | "";
  const char* arg = doc["arg"] | "";
  const char* mac = doc["mac"] | "";

  if (version != 1 || seq == 0 || strlen(type) == 0 || strlen(action) == 0) {
    sendErrorPacket("INVALID_SCHEMA", "Campos obrigatorios ausentes ou invalidos");
    return;
  }

  bool isAck = (strcmp(type, "ack") == 0);
  bool isCmd = (strcmp(type, "cmd") == 0);
  if (!isAck && !isCmd) {
    sendErrorPacket("INVALID_TYPE", "Tipo de mensagem nao permitido");
    return;
  }

  if (!DungeonSecurity::verifyRxSignature(type, seq, action, arg, String(mac))) {
    sendErrorPacket("AUTH_FAILED", "Assinatura HMAC invalida");
    return;
  }

  if (isCmd) {
    if (seq <= lastCmdSeq) {
      sendErrorPacket("REPLAY_DETECTED", "Sequencia de comando repetida ou expirada");
      return;
    }
    lastCmdSeq = seq;
  }

  DL_LOG("[BLE RX OK] ");
  DL_LOGLN(rawJson);

  if (isAck) {
    if (strcmp(action, "loaded") == 0) {
      startLedBlinkPattern(3, 90);
    } else if (strcmp(action, "victory") == 0) {
      startLedBlinkPattern(5, 90);
    } else if (strcmp(action, "damage") == 0) {
      startLedBlinkPattern(2, 110);
    } else {
      sendErrorPacket("UNKNOWN_ACTION", "Acao ACK desconhecida");
    }
    return;
  }

  // Comandos autenticados ("cmd")
  if (strcmp(action, "new_dungeon") == 0) {
    triggerNewDungeonSelection();
    return;
  }

  if (strcmp(action, "set_mode") == 0) {
    if (strcmp(arg, "auto") == 0 || strcmp(arg, "manual") == 0) {
      ledMode = String(arg);
      if (ledMode == "auto") {
        targetLedState = isDark;
      } else {
        targetLedState = manualLedState;
      }
      sendSignedStatePacket("telemetry");
    } else {
      sendErrorPacket("INVALID_ARG", "Modo permitido: auto ou manual");
    }
    return;
  }

  if (strcmp(action, "set_led") == 0) {
    if (ledMode != "manual") {
      sendErrorPacket("INVALID_MODE", "Alteracao manual permitida apenas no modo MANUAL");
      return;
    }
    if (strcmp(arg, "0") == 0 || strcmp(arg, "1") == 0) {
      manualLedState = (strcmp(arg, "1") == 0);
      targetLedState = manualLedState;
      sendSignedStatePacket("telemetry");
    } else {
      sendErrorPacket("INVALID_ARG", "Argumento de LED permitido: 0 ou 1");
    }
    return;
  }

  sendErrorPacket("UNKNOWN_ACTION", "Comando desconhecido");
}

// ============================================================
// Inicializacao BLE Server (ESP32 Arduino Core 4.0.0 <BLE.h>)
// ============================================================
void setupBleServer() {
  BTStatus st = BLE.begin(BLE_DEVICE_NAME);
  if (!st) {
    DL_LOGF("[BLE] Falha ao iniciar pilha BLE: %s\n", st.toString());
    return;
  }

  BLE.setMTU(BLE_PREFERRED_MTU);
  bleServer = BLE.createServer();
  if (!bleServer) {
    DL_LOGLN("[BLE] Falha ao criar BLEServer");
    return;
  }

  bleServer.advertiseOnDisconnect(false);

  bleServer.onConnect([](BLEServer &s, const BLEConnInfo &conn) {
    (void)s;
    bleConnected = true;
    negotiatedMtu = conn.getMTU();
    lastCmdSeq = 0;
    DL_LOGF("[BLE] Central conectada (MTU=%u)\n", negotiatedMtu);
  });

  bleServer.onDisconnect([](BLEServer &s, const BLEConnInfo &conn, uint8_t reason) {
    (void)s;
    (void)conn;
    (void)reason;
    bleConnected = false;
    negotiatedMtu = 23;
    lastCmdSeq = 0;
    shouldRestartAdvertising = true;
    disconnectTimestamp = millis();
    DL_LOGLN("[BLE] Central desconectada");
  });

  bleServer.onMtuChanged([](BLEServer &s, const BLEConnInfo &conn, uint16_t mtu) {
    (void)s;
    (void)conn;
    negotiatedMtu = mtu;
    DL_LOGF("[BLE] MTU negociado: %u\n", negotiatedMtu);
  });

  BLEService svc = bleServer.createService(BLEUUID(SERVICE_UUID));
  txChr = svc.createCharacteristic(
    BLEUUID(CHAR_TX_UUID),
    BLEProperty::Read | BLEProperty::Notify,
    BLEPermission::ReadOpen
  );
  rxChr = svc.createCharacteristic(
    BLEUUID(CHAR_RX_UUID),
    BLEProperty::Write | BLEProperty::WriteNR,
    BLEPermission::WriteOpen
  );

  rxChr.onWrite([](BLECharacteristic &c, const BLEConnInfo &conn) {
    (void)conn;
    size_t len = 0;
    const uint8_t* data = c.getValue(&len);
    if (!data || len == 0) {
      return;
    }

    portENTER_CRITICAL(&rxMux);
    for (size_t i = 0; i < len; i++) {
      char ch = static_cast<char>(data[i]);
      if (ch == '\n' || ch == '\r') {
        if (rxStreamBuffer.length() > 0 && !hasPendingRxCommand) {
          pendingRxCommand = rxStreamBuffer;
          hasPendingRxCommand = true;
        }
        rxStreamBuffer = "";
      } else {
        if (rxStreamBuffer.length() < RX_MAX_PAYLOAD_BYTES) {
          rxStreamBuffer += ch;
        }
      }
    }

    // Fallback se cliente enviar JSON completo em um unico Write sem '\n'
    if (!hasPendingRxCommand && rxStreamBuffer.startsWith("{") && rxStreamBuffer.endsWith("}")) {
      pendingRxCommand = rxStreamBuffer;
      hasPendingRxCommand = true;
      rxStreamBuffer = "";
    }
    portEXIT_CRITICAL(&rxMux);
  });

  bleServer.start();

  BLEAdvertising adv = BLE.getAdvertising();
  adv.addServiceUUID(BLEUUID(SERVICE_UUID));
  adv.start();

  DL_LOGLN("[BLE] Servidor GATT ativo e anunciando como " BLE_DEVICE_NAME);
}

// ============================================================
// Setup e Loop Principal
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(PIN_BUTTON, INPUT_PULLUP);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_BLE, OUTPUT);
  digitalWrite(PIN_LED_BLE, LOW);

  // Auto-teste visual do LED vermelho no boot (500 ms)
  digitalWrite(PIN_LED_RED, HIGH);
  delay(500);
  digitalWrite(PIN_LED_RED, LOW);

  analogReadResolution(12);
  analogSetPinAttenuation(PIN_LDR, ADC_11db);

  initLdrFilter();
  targetLedState = isDark;
  digitalWrite(PIN_LED_RED, targetLedState ? HIGH : LOW);

  setupBleServer();
  DL_LOGLN("[BOOT] DungeonLink pronto (modo AUTO local ativo mesmo offline).");
}

void loop() {
  unsigned long now = millis();

  // 1. Reinicio seguro do advertising apos desconexao
  if (shouldRestartAdvertising && (now - disconnectTimestamp >= BLE_ADV_RESTART_DELAY_MS)) {
    shouldRestartAdvertising = false;
    BLEAdvertising adv = BLE.getAdvertising();
    adv.start();
    DL_LOGLN("[BLE] Advertising reiniciado");
  }

  // 2. Amostragem do LDR e regra local autonoma (R1/R2)
  bool localStateChanged = false;
  if (now - lastLdrSampleMs >= LDR_SAMPLE_INTERVAL_MS) {
    lastLdrSampleMs = now;
    sampleLdrAndApplyLocalRule(localStateChanged);
  }

  // 3. Leitura do botao fisico com debounce e borda de descida
  int btnReading = digitalRead(PIN_BUTTON);
  if (btnReading != lastButtonReading) {
    lastButtonDebounceMs = now;
    lastButtonReading = btnReading;
  }
  if ((now - lastButtonDebounceMs) >= BUTTON_DEBOUNCE_MS) {
    if (btnReading != stableButtonState) {
      stableButtonState = btnReading;
      if (stableButtonState == LOW) {
        triggerNewDungeonSelection();
      }
    }
  }

  // 4. Processa comandos BLE recebidos fora do callback
  String cmdToRun = "";
  bool shouldRunCmd = false;
  portENTER_CRITICAL(&rxMux);
  if (hasPendingRxCommand) {
    cmdToRun = pendingRxCommand;
    pendingRxCommand = "";
    hasPendingRxCommand = false;
    shouldRunCmd = true;
  }
  portEXIT_CRITICAL(&rxMux);

  if (shouldRunCmd) {
    processIncomingCommand(cmdToRun);
  }

  // 5. Envia telemetria periodica ou imediata por mudanca de estado
  if (bleConnected && (localStateChanged || (now - lastTelemetryMs >= TELEMETRY_INTERVAL_MS))) {
    lastTelemetryMs = now;
    sendSignedStatePacket("telemetry");
  }

  // 6. Atualiza LEDs fisicos sem bloqueio
  updateRedLedOutput();
  updateBleStatusLed();

  // 7. Log periodico de diagnostico de bancada (nao imprime segredos)
  static unsigned long lastDiagMs = 0;
  if (now - lastDiagMs >= 1500UL) {
    lastDiagMs = now;
    DL_LOGF("[DIAG] LDR_raw=%d (%d%%) | dark=%d | LED_D26=%d | BTN_D27=%s\n",
            ldrRawAvg, ldrPct, isDark ? 1 : 0, targetLedState ? 1 : 0,
            stableButtonState == LOW ? "PRESSED" : "RELEASED");
  }

  delay(10);
}

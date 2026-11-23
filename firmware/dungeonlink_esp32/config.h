#ifndef DUNGEONLINK_CONFIG_H
#define DUNGEONLINK_CONFIG_H

// Habilita logs de diagnostico na Serial (nunca imprime segredos)
#define DEBUG_SERIAL 1

#if DEBUG_SERIAL
  #define DL_LOG(x) Serial.print(x)
  #define DL_LOGLN(x) Serial.println(x)
  #define DL_LOGF(...) Serial.printf(__VA_ARGS__)
#else
  #define DL_LOG(x) do {} while (0)
  #define DL_LOGLN(x) do {} while (0)
  #define DL_LOGF(...) do {} while (0)
#endif

// ============================================================
// Mapeamento de Pinos - ESP32 DevKit V1 (ESP32-WROOM-32)
// ============================================================
// GPIO 34 pertence ao ADC1 (CH6). Evita conflito com ADC2 quando o BLE/Wi-Fi esta ativo.
#define PIN_LDR      34   // Entrada analogica (divisor 3.3V -> LDR -> GPIO34 -> 10k -> GND)
#define PIN_BUTTON   27   // Botao tatil para GND (INPUT_PULLUP, ativo em LOW)
#define PIN_LED_RED  26   // LED vermelho externo + resistor 220 ohm para GND
#define PIN_LED_BLE   2   // LED azul onboard do ESP32 (indicador de conexao BLE)

// Caso monte o divisor invertido (3.3V -> 10k -> GPIO34 -> LDR -> GND), altere para true
#define LDR_INVERTED false

// ============================================================
// Parametros de Leitura Local e Histerese (R1 e R2)
// ============================================================
#define LDR_SAMPLE_INTERVAL_MS   100UL   // Amostragem do sensor a cada 100 ms
#define LDR_AVG_WINDOW           8       // Janela da media movel
#define LDR_DARK_ENTER           950     // Entra em estado escuro abaixo de ~23% (ADC 12-bit)
#define LDR_DARK_EXIT            1250    // Volta ao estado claro acima de ~31% (histerese 300)

#define BUTTON_DEBOUNCE_MS       50UL    // Debounce do botao tatil
#define TELEMETRY_INTERVAL_MS    1500UL  // Envio periodico de telemetria BLE

// ============================================================
// Parametros Bluetooth Low Energy (GATT)
// ============================================================
#define BLE_DEVICE_NAME          "DungeonLink-ESP32"
#define SERVICE_UUID             "d0a6e001-7c3b-4a2e-9b1f-5e8c4d2a1000"
#define CHAR_TX_UUID             "d0a6e002-7c3b-4a2e-9b1f-5e8c4d2a1000"
#define CHAR_RX_UUID             "d0a6e003-7c3b-4a2e-9b1f-5e8c4d2a1000"
#define BLE_PREFERRED_MTU        256

// ============================================================
// Seguranca e Controle de Trafego
// ============================================================
#define RX_MAX_PAYLOAD_BYTES     256
#define RX_MIN_INTERVAL_MS       150UL   // Rate limiting minimo entre pacotes RX
#define BLE_ADV_RESTART_DELAY_MS 300UL

#endif

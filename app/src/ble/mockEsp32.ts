import {
  buildTxCanonical,
  computeHmacHex16,
  constantTimeHexEquals16,
  buildRxCanonical,
  getAuthSecret,
  LDR_DARK_ENTER,
  LDR_DARK_EXIT,
  type Esp32DataPayload,
  type Esp32ErrPayload,
  type LedMode,
  type LightState,
} from './protocol';

export type MockTxListener = (jsonLine: string) => void;

/**
 * Gemeo de software do firmware ESP32 para testes locais, demonstracao
 * e captura de evidencias sem depender da placa conectada por USB/BLE.
 * Implementa exatamente a mesma histerese, maquina auto/manual e HMAC-SHA256.
 */
export class MockEsp32Device {
  private ldrRaw = 2450;
  private isDark = false;
  private mode: LedMode = 'auto';
  private manualLed: 0 | 1 = 0;
  private targetLed: 0 | 1 = 0;
  private currentDungeonId = 1;
  private txSeq = 0;
  private lastCmdSeq = 0;
  private bootTs = Date.now();
  private timerId: ReturnType<typeof setInterval> | null = null;
  private listener: MockTxListener | null = null;
  private lastAckLabel = '';

  constructor(private readonly secret: string = getAuthSecret()) {}

  start(listener: MockTxListener): void {
    this.listener = listener;
    this.lastCmdSeq = 0;
    this.recomputeLocalRule();
    this.emitPacket('telemetry');

    if (this.timerId !== null) {
      clearInterval(this.timerId);
    }
    this.timerId = setInterval(() => {
      this.emitPacket('telemetry');
    }, 1500);
  }

  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.listener = null;
  }

  getSnapshot(): {
    ldrRaw: number;
    ldrPct: number;
    light: LightState;
    led: 0 | 1;
    mode: LedMode;
    dungeonId: number;
    lastAckLabel: string;
  } {
    return {
      ldrRaw: this.ldrRaw,
      ldrPct: Math.round((this.ldrRaw * 100) / 4095),
      light: this.isDark ? 'dark' : 'bright',
      led: this.targetLed,
      mode: this.mode,
      dungeonId: this.currentDungeonId,
      lastAckLabel: this.lastAckLabel,
    };
  }

  setSimulatedLdr(raw: number): void {
    const clamped = Math.max(0, Math.min(4095, Math.round(raw)));
    const prevDark = this.isDark;
    const prevLed = this.targetLed;
    this.ldrRaw = clamped;
    this.recomputeLocalRule();
    if (prevDark !== this.isDark || prevLed !== this.targetLed) {
      this.emitPacket('telemetry');
    }
  }

  pressPhysicalButton(): void {
    const step = 1 + (this.ldrRaw & 1);
    this.currentDungeonId = ((this.currentDungeonId - 1 + step) % 3) + 1;
    this.emitPacket('dungeon_req');
  }

  receiveFromApp(rawJson: string): void {
    if (rawJson.length > 256) {
      this.emitError('PAYLOAD_TOO_LARGE', 'Payload acima de 256 bytes');
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawJson) as Record<string, unknown>;
    } catch {
      this.emitError('INVALID_JSON', 'JSON malformado');
      return;
    }

    const v = parsed.v;
    const type = parsed.type;
    const seq = Number(parsed.seq);
    const action = typeof parsed.action === 'string' ? parsed.action : '';
    const arg = typeof parsed.arg === 'string' ? parsed.arg : '';
    const mac = typeof parsed.mac === 'string' ? parsed.mac : '';

    if (v !== 1 || (type !== 'ack' && type !== 'cmd') || !Number.isInteger(seq) || seq <= 0) {
      this.emitError('INVALID_SCHEMA', 'Campos obrigatorios invalidos');
      return;
    }

    if (!this.secret) {
      this.emitError('AUTH_CONFIG', 'Chave HMAC ausente no simulador');
      return;
    }

    const canonical = buildRxCanonical(type, seq, action, arg);
    const expected = computeHmacHex16(this.secret, canonical);
    if (!constantTimeHexEquals16(mac, expected)) {
      this.emitError('AUTH_FAILED', 'Assinatura HMAC invalida');
      return;
    }

    if (type === 'cmd') {
      if (seq <= this.lastCmdSeq) {
        this.emitError('REPLAY_DETECTED', 'Numero de sequencia repetido ou antigo');
        return;
      }
      this.lastCmdSeq = seq;
    }

    if (type === 'ack') {
      if (action === 'loaded' || action === 'victory' || action === 'damage') {
        this.lastAckLabel = `LED piscou (${action})`;
      } else {
        this.emitError('UNKNOWN_ACTION', 'Acao ACK nao reconhecida');
      }
      return;
    }

    // type === 'cmd'
    if (action === 'new_dungeon') {
      this.pressPhysicalButton();
      return;
    }

    if (action === 'set_mode') {
      if (arg !== 'auto' && arg !== 'manual') {
        this.emitError('INVALID_ARG', 'Modo deve ser auto ou manual');
        return;
      }
      this.mode = arg;
      this.recomputeLocalRule();
      this.emitPacket('telemetry');
      return;
    }

    if (action === 'set_led') {
      if (this.mode !== 'manual') {
        this.emitError('INVALID_MODE', 'Alteracao manual bloqueada em modo AUTO');
        return;
      }
      if (arg !== '0' && arg !== '1') {
        this.emitError('INVALID_ARG', 'LED deve ser 0 ou 1');
        return;
      }
      this.manualLed = arg === '1' ? 1 : 0;
      this.recomputeLocalRule();
      this.emitPacket('telemetry');
      return;
    }

    this.emitError('UNKNOWN_ACTION', 'Comando nao reconhecido');
  }

  private recomputeLocalRule(): void {
    if (!this.isDark && this.ldrRaw < LDR_DARK_ENTER) {
      this.isDark = true;
    } else if (this.isDark && this.ldrRaw > LDR_DARK_EXIT) {
      this.isDark = false;
    }

    this.targetLed = this.mode === 'auto' ? (this.isDark ? 1 : 0) : this.manualLed;
  }

  private emitPacket(type: 'dungeon_req' | 'telemetry'): void {
    if (!this.listener) return;
    this.txSeq += 1;
    const light: LightState = this.isDark ? 'dark' : 'bright';
    const ldrPct = Math.round((this.ldrRaw * 100) / 4095);
    const canonical = buildTxCanonical(
      type,
      this.txSeq,
      this.currentDungeonId,
      light,
      this.ldrRaw,
      this.targetLed,
      this.mode,
    );
    const mac = this.secret ? computeHmacHex16(this.secret, canonical) : '0000000000000000';

    const payload: Esp32DataPayload = {
      v: 1,
      type,
      seq: this.txSeq,
      dungeon_id: this.currentDungeonId,
      light,
      ldr_raw: this.ldrRaw,
      ldr_pct: ldrPct,
      led: this.targetLed,
      mode: this.mode,
      ts: Date.now() - this.bootTs,
      mac,
    };

    this.listener(`${JSON.stringify(payload)}\n`);
  }

  private emitError(code: string, msg: string): void {
    if (!this.listener) return;
    const payload: Esp32ErrPayload = {
      v: 1,
      type: 'err',
      code,
      msg,
    };
    this.listener(`${JSON.stringify(payload)}\n`);
  }
}

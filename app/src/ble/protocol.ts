export const BLE_DEVICE_NAME = 'DungeonLink-ESP32';
export const SERVICE_UUID = 'd0a6e001-7c3b-4a2e-9b1f-5e8c4d2a1000';
export const CHAR_TX_UUID = 'd0a6e002-7c3b-4a2e-9b1f-5e8c4d2a1000';
export const CHAR_RX_UUID = 'd0a6e003-7c3b-4a2e-9b1f-5e8c4d2a1000';

export const LDR_DARK_ENTER = 620;
export const LDR_DARK_EXIT = 780;

export type LightState = 'bright' | 'dark';
export type LedMode = 'auto' | 'manual';
export type TxPacketType = 'dungeon_req' | 'telemetry' | 'err';
export type RxPacketType = 'ack' | 'cmd';

export interface Esp32DataPayload {
  v: 1;
  type: 'dungeon_req' | 'telemetry';
  seq: number;
  dungeon_id: number;
  light: LightState;
  ldr_raw: number;
  ldr_pct: number;
  led: 0 | 1;
  mode: LedMode;
  ts: number;
  mac: string;
}

export interface Esp32ErrPayload {
  v: 1;
  type: 'err';
  code: string;
  msg: string;
}

export type IncomingEsp32Payload = Esp32DataPayload | Esp32ErrPayload;

export interface OutgoingAppPayload {
  v: 1;
  type: RxPacketType;
  seq: number;
  action: string;
  arg: string;
  mac: string;
}

export interface VerifiedIncomingResult {
  ok: boolean;
  hmacValid: boolean;
  payload?: IncomingEsp32Payload;
  rawJson: string;
  error?: string;
}

export function getAuthSecret(): string {
  const envObj = (typeof import.meta !== 'undefined'
    ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    : undefined);
  const val = envObj?.VITE_BLE_AUTH_SECRET;
  if (val && val !== 'SUBSTITUA_PELA_CHAVE_SECRETA') {
    return val;
  }
  return '';
}

// ============================================================
// Implementacao pura de SHA-256 + HMAC-SHA256 (RFC 2104)
// Compativel com Android WebView, navegador e Node.js
// ============================================================
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

export function sha256Bytes(data: Uint8Array): Uint8Array {
  const bitLen = data.length * 8;
  const paddedLen = Math.ceil((data.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(data);
  padded[data.length] = 0x80;

  const view = new DataView(padded.buffer);
  const highBits = Math.floor(bitLen / 0x100000000);
  const lowBits = bitLen >>> 0;
  view.setUint32(paddedLen - 8, highBits, false);
  view.setUint32(paddedLen - 4, lowBits, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

const utf8Encoder = new TextEncoder();

export function hmacSha256Bytes(secretBytes: Uint8Array, messageBytes: Uint8Array): Uint8Array {
  const blockSize = 64;
  let keyBlock = new Uint8Array(blockSize);
  if (secretBytes.length > blockSize) {
    keyBlock.set(sha256Bytes(secretBytes));
  } else {
    keyBlock.set(secretBytes);
  }

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = keyBlock[i] ^ 0x5c;
    iKeyPad[i] = keyBlock[i] ^ 0x36;
  }

  const innerInput = new Uint8Array(blockSize + messageBytes.length);
  innerInput.set(iKeyPad, 0);
  innerInput.set(messageBytes, blockSize);
  const innerHash = sha256Bytes(innerInput);

  const outerInput = new Uint8Array(blockSize + innerHash.length);
  outerInput.set(oKeyPad, 0);
  outerInput.set(innerHash, blockSize);
  return sha256Bytes(outerInput);
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function computeHmacHex16(secret: string, message: string): string {
  const full = hmacSha256Bytes(utf8Encoder.encode(secret), utf8Encoder.encode(message));
  return bytesToHex(full).slice(0, 16);
}

export function constantTimeHexEquals16(a: string, b: string): boolean {
  if (a.length !== 16 || b.length !== 16) return false;
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  let diff = 0;
  for (let i = 0; i < 16; i++) {
    diff |= la.charCodeAt(i) ^ lb.charCodeAt(i);
  }
  return diff === 0;
}

export function buildTxCanonical(
  type: 'dungeon_req' | 'telemetry',
  seq: number,
  dungeonId: number,
  light: LightState,
  ldrRaw: number,
  led: 0 | 1,
  mode: LedMode,
): string {
  return `${type}|${seq}|${dungeonId}|${light}|${ldrRaw}|${led}|${mode}`;
}

export function buildRxCanonical(
  type: RxPacketType,
  seq: number,
  action: string,
  arg: string,
): string {
  return `${type}|${seq}|${action}|${arg}`;
}

export function buildSignedCommand(
  type: RxPacketType,
  seq: number,
  action: string,
  arg: string,
  secret: string = getAuthSecret(),
): OutgoingAppPayload {
  const canonical = buildRxCanonical(type, seq, action, arg);
  const mac = computeHmacHex16(secret, canonical);
  return {
    v: 1,
    type,
    seq,
    action,
    arg,
    mac,
  };
}

export function buildForgedCommand(
  seq: number,
  action = 'set_led',
  arg = '1',
): OutgoingAppPayload {
  return {
    v: 1,
    type: 'cmd',
    seq,
    action,
    arg,
    mac: 'deadbeefcafebabe',
  };
}

export function verifyIncomingPayload(
  rawJson: string,
  secret: string = getAuthSecret(),
): VerifiedIncomingResult {
  const trimmed = rawJson.trim();
  if (!trimmed) {
    return { ok: false, hmacValid: false, rawJson, error: 'Payload vazio' };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return { ok: false, hmacValid: false, rawJson: trimmed, error: 'JSON invalido' };
  }

  if (parsed.v !== 1 || typeof parsed.type !== 'string') {
    return { ok: false, hmacValid: false, rawJson: trimmed, error: 'Versao ou tipo invalido' };
  }

  if (parsed.type === 'err') {
    const code = typeof parsed.code === 'string' ? parsed.code : 'UNKNOWN';
    const msg = typeof parsed.msg === 'string' ? parsed.msg : 'Erro no dispositivo';
    return {
      ok: true,
      hmacValid: true,
      rawJson: trimmed,
      payload: { v: 1, type: 'err', code, msg },
    };
  }

  if (parsed.type !== 'dungeon_req' && parsed.type !== 'telemetry') {
    return { ok: false, hmacValid: false, rawJson: trimmed, error: 'Tipo TX desconhecido' };
  }

  const seq = Number(parsed.seq);
  const dungeonId = Number(parsed.dungeon_id);
  const ldrRaw = Number(parsed.ldr_raw);
  const ldrPct = Number(parsed.ldr_pct);
  const ledNum = Number(parsed.led);
  const ts = Number(parsed.ts);
  const light = parsed.light;
  const mode = parsed.mode;
  const mac = typeof parsed.mac === 'string' ? parsed.mac : '';

  if (
    !Number.isInteger(seq) ||
    !Number.isInteger(dungeonId) ||
    !Number.isInteger(ldrRaw) ||
    !Number.isInteger(ldrPct) ||
    (ledNum !== 0 && ledNum !== 1) ||
    (light !== 'bright' && light !== 'dark') ||
    (mode !== 'auto' && mode !== 'manual')
  ) {
    return { ok: false, hmacValid: false, rawJson: trimmed, error: 'Campos numericos/enum invalidos' };
  }

  const payload: Esp32DataPayload = {
    v: 1,
    type: parsed.type,
    seq,
    dungeon_id: dungeonId,
    light,
    ldr_raw: ldrRaw,
    ldr_pct: ldrPct,
    led: ledNum as 0 | 1,
    mode,
    ts: Number.isFinite(ts) ? ts : 0,
    mac,
  };

  if (!secret) {
    return {
      ok: false,
      hmacValid: false,
      rawJson: trimmed,
      payload,
      error: 'Chave VITE_BLE_AUTH_SECRET nao configurada',
    };
  }

  const canonical = buildTxCanonical(
    payload.type,
    payload.seq,
    payload.dungeon_id,
    payload.light,
    payload.ldr_raw,
    payload.led,
    payload.mode,
  );
  const expectedMac = computeHmacHex16(secret, canonical);
  const hmacValid = constantTimeHexEquals16(mac, expectedMac);

  if (!hmacValid) {
    return {
      ok: false,
      hmacValid: false,
      rawJson: trimmed,
      payload,
      error: 'Falha na verificacao HMAC-SHA256',
    };
  }

  return {
    ok: true,
    hmacValid: true,
    rawJson: trimmed,
    payload,
  };
}

export class LineFrameAssembler {
  private buffer = '';

  pushChunk(chunkText: string): string[] {
    this.buffer += chunkText;
    const lines: string[] = [];

    let nlIndex = this.buffer.indexOf('\n');
    while (nlIndex !== -1) {
      const line = this.buffer.slice(0, nlIndex).trim();
      this.buffer = this.buffer.slice(nlIndex + 1);
      if (line.length > 0) {
        lines.push(line);
      }
      nlIndex = this.buffer.indexOf('\n');
    }

    // Fallback se o dispositivo enviar JSON completo sem newline final
    const trimmed = this.buffer.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        JSON.parse(trimmed);
        lines.push(trimmed);
        this.buffer = '';
      } catch {
        // Aguarda mais fragmentos
      }
    }

    if (this.buffer.length > 1024) {
      this.buffer = '';
    }

    return lines;
  }

  reset(): void {
    this.buffer = '';
  }
}

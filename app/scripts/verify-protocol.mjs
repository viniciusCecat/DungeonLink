import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const appRoot = path.resolve(import.meta.dirname, '..');
const tmpBundle = path.join('/tmp', 'dungeonlink-protocol-test.mjs');

await esbuild.build({
  entryPoints: [
    path.join(appRoot, 'src/ble/protocol.ts'),
    path.join(appRoot, 'src/ble/mockEsp32.ts'),
  ],
  outdir: '/tmp/dungeonlink-test-out',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
});

const protocolMod = await import(pathToFileURL('/tmp/dungeonlink-test-out/protocol.js').href);
const mockMod = await import(pathToFileURL('/tmp/dungeonlink-test-out/mockEsp32.js').href);

const {
  hmacSha256Bytes,
  bytesToHex,
  computeHmacHex16,
  buildSignedCommand,
  buildForgedCommand,
  verifyIncomingPayload,
  LineFrameAssembler,
} = protocolMod;
const { MockEsp32Device } = mockMod;

// 1. Vetor RFC 4231 Caso 1 (chave = 0x0b * 20, msg = "Hi There")
{
  const key = new Uint8Array(20).fill(0x0b);
  const msg = new TextEncoder().encode('Hi There');
  const got = bytesToHex(hmacSha256Bytes(key, msg));
  const expected = 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7';
  assert.equal(got, expected, 'RFC 4231 vector #1 mismatch');
  console.log('[OK] RFC 4231 Test Case 1 passou:', got.slice(0, 16));
}

// 2. Vetor RFC 4231 Caso 2 (chave = "Jefe", msg = "what do ya want for nothing?")
{
  const enc = new TextEncoder();
  const got = bytesToHex(
    hmacSha256Bytes(enc.encode('Jefe'), enc.encode('what do ya want for nothing?')),
  );
  const expected = '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843';
  assert.equal(got, expected, 'RFC 4231 vector #2 mismatch');
  console.log('[OK] RFC 4231 Test Case 2 passou:', got.slice(0, 16));
}

// 3. Consistencia com node:crypto usando chave ficticia exclusiva de teste
const DEV_SECRET = 'TEST-VECTOR-SECRET-ONLY';
{
  const sampleMsg = 'dungeon_req|4|2|dark|842|1|auto';
  const tsHmac = computeHmacHex16(DEV_SECRET, sampleMsg);
  const nodeHmac = crypto
    .createHmac('sha256', DEV_SECRET)
    .update(sampleMsg)
    .digest('hex')
    .slice(0, 16);
  assert.equal(tsHmac, nodeHmac, 'HMAC TS vs Node crypto mismatch');
  console.log('[OK] HMAC TS == Node crypto:', tsHmac);
}

// 4. Teste de fragmentacao MTU (chunks de 20 bytes) + verificacao HMAC
{
  const assembler = new LineFrameAssembler();
  const device = new MockEsp32Device(DEV_SECRET);
  const received = [];
  device.start((line) => received.push(line));
  device.stop();

  const sampleLine = received[0];
  assert.ok(sampleLine.endsWith('\n'));
  const assembled = [];
  for (let i = 0; i < sampleLine.length; i += 20) {
    assembled.push(...assembler.pushChunk(sampleLine.slice(i, i + 20)));
  }
  assert.equal(assembled.length, 1);
  const verified = verifyIncomingPayload(assembled[0], DEV_SECRET);
  assert.equal(verified.ok, true);
  assert.equal(verified.hmacValid, true);
  console.log('[OK] Reassembly MTU 20B + HMAC verificado:', verified.payload.type);
}

// 5. Teste da regra local (histerese), modo auto/manual, anti-replay e AUTH_FAILED
{
  const device = new MockEsp32Device(DEV_SECRET);
  const packets = [];
  device.start((line) => packets.push(JSON.parse(line.trim())));

  // Inicia claro (2450)
  assert.equal(device.getSnapshot().light, 'bright');
  assert.equal(device.getSnapshot().led, 0);

  // Entra na faixa de histerese (1650) -> mantem claro
  device.setSimulatedLdr(1650);
  assert.equal(device.getSnapshot().light, 'bright');

  // Cai abaixo de 1500 (1200) -> entra em dark e acende LED localmente
  device.setSimulatedLdr(1200);
  assert.equal(device.getSnapshot().light, 'dark');
  assert.equal(device.getSnapshot().led, 1);

  // Sobe para 1650 (dentro da histerese) -> mantem dark e LED aceso
  device.setSimulatedLdr(1650);
  assert.equal(device.getSnapshot().light, 'dark');
  assert.equal(device.getSnapshot().led, 1);

  // Sobe acima de 1800 (2100) -> volta para claro e apaga LED
  device.setSimulatedLdr(2100);
  assert.equal(device.getSnapshot().light, 'bright');
  assert.equal(device.getSnapshot().led, 0);

  // Botao fisico alterna dungeon
  const dBefore = device.getSnapshot().dungeonId;
  device.pressPhysicalButton();
  assert.notEqual(device.getSnapshot().dungeonId, dBefore);

  // Ataque forjado -> AUTH_FAILED
  const forged = buildForgedCommand(1, 'set_led', '1');
  device.receiveFromApp(JSON.stringify(forged));
  assert.equal(packets.at(-1).type, 'err');
  assert.equal(packets.at(-1).code, 'AUTH_FAILED');

  // set_led em modo AUTO -> INVALID_MODE
  const badModeCmd = buildSignedCommand('cmd', 1, 'set_led', '1', DEV_SECRET);
  device.receiveFromApp(JSON.stringify(badModeCmd));
  assert.equal(packets.at(-1).type, 'err');
  assert.equal(packets.at(-1).code, 'INVALID_MODE');

  // Anti-replay: seq 1 repetido -> REPLAY_DETECTED
  device.receiveFromApp(JSON.stringify(badModeCmd));
  assert.equal(packets.at(-1).type, 'err');
  assert.equal(packets.at(-1).code, 'REPLAY_DETECTED');

  // set_mode manual (seq 2) e set_led 1 (seq 3)
  device.receiveFromApp(JSON.stringify(buildSignedCommand('cmd', 2, 'set_mode', 'manual', DEV_SECRET)));
  assert.equal(device.getSnapshot().mode, 'manual');
  device.receiveFromApp(JSON.stringify(buildSignedCommand('cmd', 3, 'set_led', '1', DEV_SECRET)));
  assert.equal(device.getSnapshot().led, 1);
  device.stop();

  console.log('[OK] Histerese, botao fisico, AUTH_FAILED, INVALID_MODE, REPLAY_DETECTED e modo MANUAL validados!');
}

fs.rmSync('/tmp/dungeonlink-test-out', { recursive: true, force: true });
fs.rmSync(tmpBundle, { force: true });

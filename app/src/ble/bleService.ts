import { Capacitor } from '@capacitor/core';
import {
  BleClient,
  dataViewToText,
  textToDataView,
} from '@capacitor-community/bluetooth-le';
import { MockEsp32Device } from './mockEsp32';
import {
  BLE_DEVICE_NAME,
  CHAR_RX_UUID,
  CHAR_TX_UUID,
  LineFrameAssembler,
  SERVICE_UUID,
  buildForgedCommand,
  buildSignedCommand,
  getAuthSecret,
  verifyIncomingPayload,
  type IncomingEsp32Payload,
  type LedMode,
  type OutgoingAppPayload,
} from './protocol';

export type ConnectionMode = 'disconnected' | 'connecting' | 'ble' | 'simulator';

export interface PacketLogEntry {
  id: number;
  timestamp: string;
  direction: 'RX' | 'TX';
  rawJson: string;
  hmacValid: boolean;
  summary: string;
}

export interface BleServiceCallbacks {
  onStatusChange: (mode: ConnectionMode, deviceLabel: string, errorMsg?: string) => void;
  onPayload: (payload: IncomingEsp32Payload, rawJson: string, hmacValid: boolean) => void;
  onLog: (entry: PacketLogEntry) => void;
}

function nowTimeStr(): string {
  const d = new Date();
  return d.toLocaleTimeString('pt-BR', { hour12: false });
}

export class DungeonBleService {
  public mode: ConnectionMode = 'disconnected';
  public deviceLabel = 'Nenhum dispositivo';
  public mtu = 23;
  public mockDevice: MockEsp32Device;

  private connectedDeviceId: string | null = null;
  private assembler = new LineFrameAssembler();
  private rxSeq = 0;
  private logCounter = 0;

  constructor(private readonly callbacks: BleServiceCallbacks) {
    this.mockDevice = new MockEsp32Device(getAuthSecret());
  }

  async connectRealBle(): Promise<void> {
    if (this.mode === 'simulator') {
      await this.disconnect();
    }

    if (!Capacitor.isNativePlatform() && typeof navigator !== 'undefined' && !('bluetooth' in navigator)) {
      this.callbacks.onStatusChange(
        'disconnected',
        'Web Bluetooth indisponivel',
        'Este navegador nao suporta Web Bluetooth. Instale o APK no Android ou ative o Simulador Local.',
      );
      return;
    }

    this.mode = 'connecting';
    this.callbacks.onStatusChange('connecting', 'Buscando ESP32...');

    try {
      await BleClient.initialize({ androidNeverForLocation: true });

      if (Capacitor.isNativePlatform()) {
        const enabled = await BleClient.isEnabled();
        if (!enabled) {
          await BleClient.requestEnable();
        }
      }

      const device = await BleClient.requestDevice({
        services: [SERVICE_UUID],
        optionalServices: [SERVICE_UUID],
      });

      this.connectedDeviceId = device.deviceId;
      this.deviceLabel = device.name || BLE_DEVICE_NAME;
      this.assembler.reset();
      this.rxSeq = 0;

      await BleClient.connect(
        device.deviceId,
        () => {
          this.handleUnexpectedDisconnect();
        },
        { timeout: 12000 },
      );

      if (Capacitor.isNativePlatform()) {
        try {
          this.mtu = await BleClient.getMtu(device.deviceId);
        } catch {
          this.mtu = 23;
        }
      }

      await BleClient.startNotifications(
        device.deviceId,
        SERVICE_UUID,
        CHAR_TX_UUID,
        (value: DataView) => {
          const text = dataViewToText(value);
          this.handleIncomingText(text);
        },
      );

      this.mode = 'ble';
      this.callbacks.onStatusChange('ble', `${this.deviceLabel} (MTU ${this.mtu})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.connectedDeviceId = null;
      this.mode = 'disconnected';
      this.deviceLabel = 'Desconectado';
      this.callbacks.onStatusChange('disconnected', this.deviceLabel, msg);
    }
  }

  connectSimulator(initialLdrRaw = 2450): void {
    if (this.mode === 'ble' && this.connectedDeviceId) {
      BleClient.disconnect(this.connectedDeviceId).catch(() => {});
      this.connectedDeviceId = null;
    }

    this.assembler.reset();
    this.rxSeq = 0;
    this.mode = 'simulator';
    this.deviceLabel = 'Simulador ESP32 Local';
    this.callbacks.onStatusChange('simulator', this.deviceLabel);
    this.mockDevice.setSimulatedLdr(initialLdrRaw);
    this.mockDevice.start((line) => {
      this.handleIncomingText(line);
    });
  }

  async disconnect(): Promise<void> {
    if (this.mode === 'simulator') {
      this.mockDevice.stop();
    } else if (this.mode === 'ble' && this.connectedDeviceId) {
      try {
        await BleClient.stopNotifications(this.connectedDeviceId, SERVICE_UUID, CHAR_TX_UUID);
      } catch {
        // Ignora erro se link ja caiu
      }
      try {
        await BleClient.disconnect(this.connectedDeviceId);
      } catch {
        // Ignora erro
      }
    }
    this.connectedDeviceId = null;
    this.assembler.reset();
    this.mode = 'disconnected';
    this.deviceLabel = 'Desconectado';
    this.callbacks.onStatusChange('disconnected', this.deviceLabel);
  }

  async sendAck(action: 'loaded' | 'victory' | 'damage', arg: string): Promise<void> {
    this.rxSeq += 1;
    const payload = buildSignedCommand('ack', this.rxSeq, action, arg);
    await this.transmitPayload(payload, `ACK ${action}(${arg})`);
  }

  async sendNewDungeonCommand(): Promise<void> {
    this.rxSeq += 1;
    const payload = buildSignedCommand('cmd', this.rxSeq, 'new_dungeon', '');
    await this.transmitPayload(payload, 'CMD new_dungeon');
  }

  async sendSetModeCommand(mode: LedMode): Promise<void> {
    this.rxSeq += 1;
    const payload = buildSignedCommand('cmd', this.rxSeq, 'set_mode', mode);
    await this.transmitPayload(payload, `CMD set_mode(${mode})`);
  }

  async sendSetLedCommand(state: 0 | 1): Promise<void> {
    this.rxSeq += 1;
    const payload = buildSignedCommand('cmd', this.rxSeq, 'set_led', String(state));
    await this.transmitPayload(payload, `CMD set_led(${state})`);
  }

  async sendForgedSecurityTest(): Promise<void> {
    this.rxSeq += 1;
    const payload = buildForgedCommand(this.rxSeq, 'set_led', '1');
    await this.transmitPayload(payload, 'TESTE ATAQUE (HMAC forjado)', false);
  }

  private async transmitPayload(
    payload: OutgoingAppPayload,
    summary: string,
    hmacValid = true,
  ): Promise<void> {
    if (this.mode !== 'ble' && this.mode !== 'simulator') {
      return;
    }

    const jsonLine = `${JSON.stringify(payload)}\n`;
    this.pushLog('TX', JSON.stringify(payload), hmacValid, summary);

    if (this.mode === 'simulator') {
      this.mockDevice.receiveFromApp(JSON.stringify(payload));
      return;
    }

    if (this.mode === 'ble' && this.connectedDeviceId) {
      const maxChunk = Math.max(20, Math.min(this.mtu - 3, 180));
      for (let i = 0; i < jsonLine.length; i += maxChunk) {
        const chunk = jsonLine.slice(i, i + maxChunk);
        await BleClient.write(
          this.connectedDeviceId,
          SERVICE_UUID,
          CHAR_RX_UUID,
          textToDataView(chunk),
        );
      }
    }
  }

  private handleIncomingText(text: string): void {
    const lines = this.assembler.pushChunk(text);
    for (const line of lines) {
      const verified = verifyIncomingPayload(line);
      if (verified.payload) {
        let summary = '';
        if (verified.payload.type === 'err') {
          summary = `ERR ${verified.payload.code}: ${verified.payload.msg}`;
        } else {
          summary = `${verified.payload.type} #${verified.payload.seq} | D${verified.payload.dungeon_id} | ${verified.payload.light.toUpperCase()} (${verified.payload.ldr_pct}%)`;
        }
        this.pushLog('RX', verified.rawJson, verified.hmacValid, summary);
        if (verified.ok || verified.payload.type === 'err') {
          this.callbacks.onPayload(verified.payload, verified.rawJson, verified.hmacValid);
        }
      } else {
        this.pushLog('RX', verified.rawJson, false, verified.error || 'Pacote rejeitado');
      }
    }
  }

  private handleUnexpectedDisconnect(): void {
    this.connectedDeviceId = null;
    this.assembler.reset();
    this.mode = 'disconnected';
    this.deviceLabel = 'Conexao perdida';
    this.callbacks.onStatusChange(
      'disconnected',
      this.deviceLabel,
      'ESP32 desconectado. Regra local autonoma (R2) continua ativa na placa.',
    );
  }

  private pushLog(
    direction: 'RX' | 'TX',
    rawJson: string,
    hmacValid: boolean,
    summary: string,
  ): void {
    this.logCounter += 1;
    this.callbacks.onLog({
      id: this.logCounter,
      timestamp: nowTimeStr(),
      direction,
      rawJson,
      hmacValid,
      summary,
    });
  }
}

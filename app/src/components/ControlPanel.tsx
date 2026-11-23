import React from 'react';
import type { ConnectionMode, PacketLogEntry } from '../ble/bleService';
import type { LedMode } from '../ble/protocol';

interface ControlPanelProps {
  connectionMode: ConnectionMode;
  deviceLabel: string;
  errorMsg: string;
  ledMode: LedMode;
  ledState: 0 | 1;
  simLdrRaw: number;
  packetLogs: PacketLogEntry[];
  onConnectBle: () => void;
  onStartSimulator: () => void;
  onDisconnect: () => void;
  onSimLdrChange: (raw: number) => void;
  onSimButtonPress: () => void;
  onSetMode: (mode: LedMode) => void;
  onSetManualLed: (state: 0 | 1) => void;
  onSendForgedSecurityTest: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  connectionMode,
  deviceLabel,
  errorMsg,
  ledMode,
  ledState,
  simLdrRaw,
  packetLogs,
  onConnectBle,
  onStartSimulator,
  onDisconnect,
  onSimLdrChange,
  onSimButtonPress,
  onSetMode,
  onSetManualLed,
  onSendForgedSecurityTest,
}) => {
  const isConnected = connectionMode === 'ble' || connectionMode === 'simulator';

  return (
    <section className="panel-stack">
      {/* Bloco 1: Conexao BLE / Simulador */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Conexao Bluetooth Low Energy (ESP32)</h3>
            <p className="muted">
              Estado atual: <strong>{deviceLabel}</strong>
            </p>
          </div>
          <span className={`badge ${connectionMode}`}>
            {connectionMode === 'ble'
              ? 'BLE REAL'
              : connectionMode === 'simulator'
                ? 'SIMULADOR LOCAL'
                : connectionMode === 'connecting'
                  ? 'CONECTANDO...'
                  : 'DESCONECTADO'}
          </span>
        </div>

        {errorMsg && <div className="alert-box">{errorMsg}</div>}

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConnectBle}
            disabled={connectionMode === 'connecting'}
          >
            Conectar ESP32 (BLE)
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onStartSimulator}
            disabled={connectionMode === 'simulator'}
          >
            Ativar Simulador Local
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onDisconnect}
            disabled={!isConnected}
          >
            Desconectar
          </button>
        </div>
      </div>

      {/* Controles do Simulador Local quando ativo */}
      {connectionMode === 'simulator' && (
        <div className="card sim-card">
          <h3>Bancada Virtual do ESP32 (Simulador Local)</h3>
          <p className="muted">
            Simula o divisor LDR (GPIO 34) com histerese 1500/1800 e o botao fisico (GPIO 27).
          </p>
          <div className="sim-controls">
            <label className="slider-label">
              <span>
                Luminosidade Simulada: <strong>{simLdrRaw}</strong> ADC (
                {Math.round((simLdrRaw * 100) / 4095)}%) —{' '}
                {simLdrRaw < 1500 ? 'Escuro' : simLdrRaw > 1800 ? 'Claro' : 'Faixa de histerese'}
              </span>
              <input
                type="range"
                min={0}
                max={4095}
                value={simLdrRaw}
                onChange={(e) => onSimLdrChange(Number(e.target.value))}
              />
            </label>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onSimLdrChange(780)}
              >
                Simular Escuro (780)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onSimLdrChange(2850)}
              >
                Simular Claro (2850)
              </button>
              <button type="button" className="btn btn-primary" onClick={onSimButtonPress}>
                Pressionar Botao Fisico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bloco 2: Modos Auto/Manual e Seguranca HMAC */}
      <div className="card">
        <h3>Controle de Atuador (Auto / Manual) &amp; Seguranca HMAC-SHA256</h3>
        <p className="muted">
          No modo <strong>AUTO</strong>, o ESP32 controla o LED localmente pelo LDR mesmo sem celular.
          No modo <strong>MANUAL</strong>, comandos autenticados por HMAC-SHA256 controlam o LED.
        </p>

        <div className="control-grid">
          <div className="control-box">
            <span className="hud-label">MODO DE OPERACAO</span>
            <div className="btn-row">
              <button
                type="button"
                className={`btn ${ledMode === 'auto' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onSetMode('auto')}
                disabled={!isConnected}
              >
                Modo AUTO (Local LDR)
              </button>
              <button
                type="button"
                className={`btn ${ledMode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onSetMode('manual')}
                disabled={!isConnected}
              >
                Modo MANUAL (BLE)
              </button>
            </div>
          </div>

          <div className="control-box">
            <span className="hud-label">LED VERMELHO (GPIO 26)</span>
            <div className="btn-row">
              <button
                type="button"
                className={`btn ${ledState === 1 ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onSetManualLed(1)}
                disabled={!isConnected || ledMode !== 'manual'}
              >
                Ligar LED
              </button>
              <button
                type="button"
                className={`btn ${ledState === 0 ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => onSetManualLed(0)}
                disabled={!isConnected || ledMode !== 'manual'}
              >
                Apagar LED
              </button>
            </div>
          </div>
        </div>

        <div className="security-test-row">
          <div>
            <strong>Demonstracao de Defesa Ativa (OWASP IoT)</strong>
            <p className="muted">
              Envia um comando com assinatura HMAC forjada para comprovar rejeicao pelo ESP32.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onSendForgedSecurityTest}
            disabled={!isConnected}
          >
            Testar Seguranca (HMAC Invalido)
          </button>
        </div>
      </div>

      {/* Bloco 3: Inspetor JSON ao vivo */}
      <div className="card">
        <h3>Inspetor de Payloads JSON &amp; Assinaturas HMAC</h3>
        <div className="log-list">
          {packetLogs.length === 0 ? (
            <p className="muted">Nenhum pacote trocado ainda.</p>
          ) : (
            packetLogs.slice(0, 20).map((item) => (
              <div key={item.id} className={`log-item ${item.hmacValid ? '' : 'log-invalid'}`}>
                <div className="log-meta">
                  <span className={`pill ${item.direction === 'RX' ? 'pill-rx' : 'pill-tx'}`}>
                    {item.direction}
                  </span>
                  <span className="log-time">{item.timestamp}</span>
                  <span className="log-summary">{item.summary}</span>
                  <span className={`pill ${item.hmacValid ? 'pill-ok' : 'pill-err'}`}>
                    {item.hmacValid ? 'HMAC OK' : 'REJEITADO'}
                  </span>
                </div>
                <code className="log-json">{item.rawJson}</code>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

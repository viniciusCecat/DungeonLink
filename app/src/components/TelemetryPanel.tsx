import React from 'react';
import { LDR_DARK_ENTER, LDR_DARK_EXIT, type LedMode, type LightState } from '../ble/protocol';

export interface TelemetryRecord {
  id: number;
  time: string;
  seq: number;
  type: 'dungeon_req' | 'telemetry';
  dungeonId: number;
  ldrRaw: number;
  ldrPct: number;
  light: LightState;
  led: 0 | 1;
  mode: LedMode;
}

interface TelemetryPanelProps {
  history: TelemetryRecord[];
  latest: TelemetryRecord | null;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({ history, latest }) => {
  const chartItems = history.slice(-40);
  const width = 620;
  const height = 180;
  const padLeft = 40;
  const padRight = 14;
  const padTop = 14;
  const padBottom = 22;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const yFromRaw = (raw: number) =>
    padTop + plotH - (Math.max(0, Math.min(4095, raw)) / 4095) * plotH;

  const points = chartItems
    .map((item, idx) => {
      const x =
        chartItems.length <= 1
          ? padLeft + plotW / 2
          : padLeft + (idx / (chartItems.length - 1)) * plotW;
      const y = yFromRaw(item.ldrRaw);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const enterY = yFromRaw(LDR_DARK_ENTER);
  const exitY = yFromRaw(LDR_DARK_EXIT);

  const exportCsv = () => {
    const header = 'id,hora,seq,tipo,dungeon_id,ldr_raw,ldr_pct,luz,led,modo\n';
    const rows = history
      .map(
        (r) =>
          `${r.id},${r.time},${r.seq},${r.type},${r.dungeonId},${r.ldrRaw},${r.ldrPct},${r.light},${r.led},${r.mode}`,
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dungeonlink-telemetria.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="panel-stack">
      <div className="metric-grid">
        <div className="metric-card">
          <span className="metric-label">Luminosidade LDR</span>
          <strong className="metric-value">
            {latest ? `${latest.ldrPct}%` : '--'}
          </strong>
          <small className="metric-sub">
            ADC bruto: {latest ? `${latest.ldrRaw} / 4095` : 'aguardando'}
          </small>
        </div>
        <div className="metric-card">
          <span className="metric-label">Classificacao Local</span>
          <strong className="metric-value">
            {latest ? (latest.light === 'dark' ? 'ESCURO' : 'CLARO') : '--'}
          </strong>
          <small className="metric-sub">
            Histerese: entra &lt; {LDR_DARK_ENTER} / sai &gt; {LDR_DARK_EXIT}
          </small>
        </div>
        <div className="metric-card">
          <span className="metric-label">Atuador (LED GPIO 26)</span>
          <strong className="metric-value">
            {latest ? (latest.led === 1 ? 'ACESO' : 'APAGADO') : '--'}
          </strong>
          <small className="metric-sub">
            Modo atual: {latest ? latest.mode.toUpperCase() : '--'}
          </small>
        </div>
        <div className="metric-card">
          <span className="metric-label">Dungeon Ativa</span>
          <strong className="metric-value">
            {latest ? `#${latest.dungeonId}` : '--'}
          </strong>
          <small className="metric-sub">
            Amostras registradas: {history.length}
          </small>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3>Historico em Tempo Real do Sensor LDR</h3>
            <p className="muted">
              Ultimas {chartItems.length} leituras recebidas via BLE com banda de histerese (R1/R2)
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportCsv}
            disabled={history.length === 0}
          >
            Exportar CSV
          </button>
        </div>

        <div className="chart-box">
          <svg viewBox={`0 0 ${width} ${height}`} className="telemetry-svg">
            {/* Banda de histerese */}
            <rect
              x={padLeft}
              y={exitY}
              width={plotW}
              height={Math.max(1, enterY - exitY)}
              fill="rgba(250, 176, 5, 0.14)"
            />
            <line
              x1={padLeft}
              y1={exitY}
              x2={padLeft + plotW}
              y2={exitY}
              stroke="#fab005"
              strokeDasharray="4 4"
              strokeWidth="1.2"
            />
            <line
              x1={padLeft}
              y1={enterY}
              x2={padLeft + plotW}
              y2={enterY}
              stroke="#ff6b6b"
              strokeDasharray="4 4"
              strokeWidth="1.2"
            />

            {/* Eixos */}
            <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} stroke="#3b4258" />
            <line
              x1={padLeft}
              y1={padTop + plotH}
              x2={padLeft + plotW}
              y2={padTop + plotH}
              stroke="#3b4258"
            />

            <text x="6" y={padTop + 9} fill="#8b94ad" fontSize="10">4095</text>
            <text x="6" y={exitY + 3} fill="#fab005" fontSize="9">780</text>
            <text x="6" y={enterY + 3} fill="#ff8787" fontSize="9">620</text>
            <text x="20" y={padTop + plotH} fill="#8b94ad" fontSize="10">0</text>

            {chartItems.length >= 2 && (
              <polyline
                fill="none"
                stroke="#38d9a9"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={points}
              />
            )}

            {chartItems.map((item, idx) => {
              const x =
                chartItems.length <= 1
                  ? padLeft + plotW / 2
                  : padLeft + (idx / (chartItems.length - 1)) * plotW;
              const y = yFromRaw(item.ldrRaw);
              return (
                <circle
                  key={item.id}
                  cx={x}
                  cy={y}
                  r={item.type === 'dungeon_req' ? 4.5 : 3}
                  fill={item.light === 'dark' ? '#ff922b' : '#38d9a9'}
                  stroke="#0f121b"
                  strokeWidth="1"
                />
              );
            })}
          </svg>
        </div>
      </div>

      <div className="card">
        <h3>Tabela de Registros Recebidos</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Seq</th>
                <th>Evento</th>
                <th>Dungeon</th>
                <th>LDR</th>
                <th>Ambiente</th>
                <th>LED</th>
                <th>Modo</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-cell">
                    Conecte o ESP32 ou ative o Simulador Local para registrar leituras.
                  </td>
                </tr>
              ) : (
                [...history]
                  .reverse()
                  .slice(0, 15)
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{r.time}</td>
                      <td>#{r.seq}</td>
                      <td>
                        <span className={`pill ${r.type === 'dungeon_req' ? 'pill-accent' : ''}`}>
                          {r.type}
                        </span>
                      </td>
                      <td>D{r.dungeonId}</td>
                      <td>
                        {r.ldrRaw} ({r.ldrPct}%)
                      </td>
                      <td>{r.light === 'dark' ? 'Escuro' : 'Claro'}</td>
                      <td>{r.led === 1 ? 'Aceso' : 'Apagado'}</td>
                      <td>{r.mode.toUpperCase()}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

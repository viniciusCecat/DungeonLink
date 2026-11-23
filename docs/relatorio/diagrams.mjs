export function diagramFourLayersSvg() {
  return `
<svg viewBox="0 0 780 315" width="100%" xmlns="http://www.w3.org/2000/svg" style="font-family: 'Segoe UI', Arial, sans-serif;">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#334155"/>
    </marker>
  </defs>

  <rect x="0" y="0" width="780" height="315" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2"/>

  <!-- Camada 1: Percepção -->
  <rect x="18" y="24" width="168" height="196" rx="8" fill="#ecfeff" stroke="#0891b2" stroke-width="1.6"/>
  <rect x="18" y="24" width="168" height="30" rx="8" fill="#0891b2"/>
  <text x="102" y="44" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="700">1. PERCEPÇÃO</text>
  <text x="30" y="74" fill="#0f172a" font-size="11" font-weight="700">Entradas Físicas:</text>
  <text x="30" y="92" fill="#334155" font-size="10.5">• LDR GL5528 + 10 kΩ</text>
  <text x="38" y="106" fill="#475569" font-size="9.5">(Pino D34 / ADC1 12 bits)</text>
  <text x="30" y="126" fill="#334155" font-size="10.5">• Botão Tátil 6x6 mm</text>
  <text x="38" y="140" fill="#475569" font-size="9.5">(Pino D27 / INPUT_PULLUP)</text>
  <text x="30" y="164" fill="#0f172a" font-size="11" font-weight="700">Saídas (LEDs):</text>
  <text x="30" y="182" fill="#334155" font-size="10.5">• LED Vermelho + 220 Ω</text>
  <text x="38" y="196" fill="#475569" font-size="9.5">(Pino D26 — Tocha e ACK)</text>
  <text x="30" y="212" fill="#334155" font-size="10.5">• LED Azul da placa (D2)</text>

  <!-- Camada 2: Processamento -->
  <rect x="210" y="24" width="174" height="196" rx="8" fill="#eef2ff" stroke="#4f46e5" stroke-width="1.6"/>
  <rect x="210" y="24" width="174" height="30" rx="8" fill="#4f46e5"/>
  <text x="297" y="44" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="700">2. PROCESSAMENTO</text>
  <text x="222" y="74" fill="#0f172a" font-size="11" font-weight="700">No ESP32 (local):</text>
  <text x="222" y="92" fill="#334155" font-size="10.5">• Média de 8 leituras</text>
  <text x="222" y="108" fill="#334155" font-size="10.5">• Histerese 950 / 1250</text>
  <text x="222" y="124" fill="#334155" font-size="10.5">• Regra offline R1/R2 (Auto)</text>
  <text x="222" y="140" fill="#334155" font-size="10.5">• Sorteio da fase (1 a 3)</text>
  <text x="222" y="156" fill="#334155" font-size="10.5">• Anti-replay e limite RX</text>
  <text x="222" y="176" fill="#0f172a" font-size="11" font-weight="700">No Celular:</text>
  <text x="222" y="194" fill="#334155" font-size="10.5">• Confere HMAC-SHA256</text>
  <text x="222" y="210" fill="#334155" font-size="10.5">• Atualiza tema e eventos</text>

  <!-- Camada 3: Rede -->
  <rect x="408" y="24" width="166" height="196" rx="8" fill="#fffbeb" stroke="#d97706" stroke-width="1.6"/>
  <rect x="408" y="24" width="166" height="30" rx="8" fill="#d97706"/>
  <text x="491" y="44" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="700">3. REDE (BLE)</text>
  <text x="420" y="74" fill="#0f172a" font-size="11" font-weight="700">Conexão Sem Fio:</text>
  <text x="420" y="92" fill="#334155" font-size="10.5">• Bluetooth Low Energy</text>
  <text x="420" y="108" fill="#334155" font-size="10.5">• ESP32 = Periférico</text>
  <text x="420" y="124" fill="#334155" font-size="10.5">• Android = Central</text>
  <text x="420" y="144" fill="#0f172a" font-size="11" font-weight="700">Mensagens:</text>
  <text x="420" y="162" fill="#334155" font-size="10.5">• TX Notify (CHAR_TX)</text>
  <text x="420" y="178" fill="#334155" font-size="10.5">• RX Write (CHAR_RX)</text>
  <text x="420" y="194" fill="#334155" font-size="10.5">• JSON + '\\n' + MAC</text>
  <text x="420" y="210" fill="#475569" font-size="9.5">(MTU até 256 bytes)</text>

  <!-- Camada 4: Aplicação -->
  <rect x="598" y="24" width="164" height="196" rx="8" fill="#ecfdf5" stroke="#059669" stroke-width="1.6"/>
  <rect x="598" y="24" width="164" height="30" rx="8" fill="#059669"/>
  <text x="680" y="44" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="700">4. APLICAÇÃO</text>
  <text x="610" y="74" fill="#0f172a" font-size="11" font-weight="700">App Android DungeonLink:</text>
  <text x="610" y="92" fill="#334155" font-size="10.5">• Jogo 2D (2 salas/fase)</text>
  <text x="610" y="108" fill="#334155" font-size="10.5">• Tema Claro / Sombrio</text>
  <text x="610" y="124" fill="#334155" font-size="10.5">• Combate e Portal Final</text>
  <text x="610" y="144" fill="#0f172a" font-size="11" font-weight="700">Painel na Tela (R5):</text>
  <text x="610" y="162" fill="#334155" font-size="10.5">• Status ao vivo no topo</text>
  <text x="610" y="178" fill="#334155" font-size="10.5">• Gráfico + Tabela + CSV</text>
  <text x="610" y="194" fill="#334155" font-size="10.5">• Modos Auto / Manual</text>
  <text x="610" y="210" fill="#334155" font-size="10.5">• Log JSON e teste HMAC</text>

  <!-- Setas -->
  <line x1="186" y1="106" x2="208" y2="106" stroke="#334155" stroke-width="1.8" marker-end="url(#arrow)"/>
  <line x1="208" y1="132" x2="186" y2="132" stroke="#334155" stroke-width="1.8" marker-end="url(#arrow)"/>
  <line x1="384" y1="106" x2="406" y2="106" stroke="#334155" stroke-width="1.8" marker-end="url(#arrow)"/>
  <line x1="406" y1="132" x2="384" y2="132" stroke="#334155" stroke-width="1.8" marker-end="url(#arrow)"/>
  <line x1="574" y1="106" x2="596" y2="106" stroke="#334155" stroke-width="1.8" marker-end="url(#arrow)"/>
  <line x1="596" y1="132" x2="574" y2="132" stroke="#334155" stroke-width="1.8" marker-end="url(#arrow)"/>

  <!-- Destaque Offline R2 -->
  <rect x="18" y="238" width="366" height="58" rx="8" fill="#f0fdfa" stroke="#0f766e" stroke-width="1.5" stroke-dasharray="5 3"/>
  <text x="32" y="259" fill="#0f766e" font-size="11" font-weight="700">DECISÃO LOCAL OFFLINE (R1 e R2 — Sem Internet e Sem Celular)</text>
  <text x="32" y="278" fill="#134e4a" font-size="10.2">LDR &lt; 950 (escuro) → ESP32 acende o LED vermelho (D26); apaga acima de 1250.</text>

  <!-- Legenda -->
  <rect x="408" y="238" width="354" height="58" rx="8" fill="#f1f5f9" stroke="#64748b" stroke-width="1.2"/>
  <text x="422" y="259" fill="#1e293b" font-size="11" font-weight="700">TROCA NOS DOIS SENTIDOS</text>
  <text x="422" y="278" fill="#334155" font-size="10.2">ESP32 → App: dungeon_req / telemetry | App → ESP32: ack / cmd</text>
</svg>
`;
}

export function diagramSchematicSvg() {
  return `
<svg viewBox="0 0 780 370" width="100%" xmlns="http://www.w3.org/2000/svg" style="font-family: 'Segoe UI', Arial, sans-serif;">
  <rect x="0" y="0" width="780" height="370" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2"/>

  <!-- Barramentos -->
  <line x1="40" y1="34" x2="740" y2="34" stroke="#dc2626" stroke-width="2.6"/>
  <text x="42" y="25" fill="#dc2626" font-size="11" font-weight="700">+3.3V (Pino 3V3 do ESP32)</text>

  <line x1="40" y1="336" x2="740" y2="336" stroke="#0f172a" stroke-width="2.6"/>
  <text x="42" y="355" fill="#0f172a" font-size="11" font-weight="700">GND (Terra comum 0V)</text>

  <!-- ESP32 -->
  <rect x="280" y="78" width="220" height="214" rx="10" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
  <rect x="335" y="64" width="110" height="26" rx="4" fill="#94a3b8" stroke="#475569"/>
  <text x="390" y="81" text-anchor="middle" fill="#0f172a" font-size="10" font-weight="700">ANTENA BLE</text>
  <text x="390" y="114" text-anchor="middle" fill="#f8fafc" font-size="13.5" font-weight="700">ESP32 DevKit V1</text>
  <text x="390" y="131" text-anchor="middle" fill="#94a3b8" font-size="10">ESP32-WROOM-32</text>

  <!-- Pinos esquerda -->
  <rect x="268" y="148" width="24" height="16" rx="2" fill="#f59f00"/>
  <text x="298" y="160" fill="#e2e8f0" font-size="10.5" font-weight="600">3V3</text>

  <rect x="268" y="182" width="24" height="16" rx="2" fill="#38bdf8"/>
  <text x="298" y="194" fill="#e2e8f0" font-size="10.5" font-weight="600">GPIO 34 (D34 / ADC1)</text>

  <rect x="268" y="236" width="24" height="16" rx="2" fill="#64748b"/>
  <text x="298" y="248" fill="#e2e8f0" font-size="10.5" font-weight="600">GND</text>

  <!-- Pinos direita -->
  <rect x="488" y="148" width="24" height="16" rx="2" fill="#34d399"/>
  <text x="482" y="160" text-anchor="end" fill="#e2e8f0" font-size="10.5" font-weight="600">GPIO 27 (D27 / Botão)</text>

  <rect x="488" y="200" width="24" height="16" rx="2" fill="#f87171"/>
  <text x="482" y="212" text-anchor="end" fill="#e2e8f0" font-size="10.5" font-weight="600">GPIO 26 (D26 / LED)</text>

  <rect x="488" y="248" width="24" height="16" rx="2" fill="#60a5fa"/>
  <text x="482" y="260" text-anchor="end" fill="#e2e8f0" font-size="10.5" font-weight="600">GPIO 2 (LED Azul BLE)</text>

  <!-- USB -->
  <rect x="355" y="276" width="70" height="22" rx="3" fill="#cbd5e1" stroke="#475569"/>
  <text x="390" y="291" text-anchor="middle" fill="#0f172a" font-size="10" font-weight="700">USB 5V</text>

  <polyline points="268,156 232,156 232,34" fill="none" stroke="#dc2626" stroke-width="2"/>
  <circle cx="232" cy="34" r="3.5" fill="#dc2626"/>
  <polyline points="268,244 232,244 232,336" fill="none" stroke="#0f172a" stroke-width="2"/>
  <circle cx="232" cy="336" r="3.5" fill="#0f172a"/>

  <!-- Circuito 1: LDR + 10k -->
  <rect x="36" y="72" width="166" height="220" rx="8" fill="#ecfeff" stroke="#0891b2" stroke-width="1.3"/>
  <text x="119" y="92" text-anchor="middle" fill="#0e7490" font-size="11" font-weight="700">SENSOR DE LUZ (R1)</text>
  <line x1="119" y1="34" x2="119" y2="112" stroke="#dc2626" stroke-width="2"/>
  <circle cx="119" cy="34" r="3.5" fill="#dc2626"/>
  <rect x="97" y="112" width="44" height="36" rx="4" fill="#fef3c7" stroke="#b45309" stroke-width="1.6"/>
  <text x="119" y="129" text-anchor="middle" fill="#78350f" font-size="10" font-weight="700">LDR</text>
  <text x="119" y="142" text-anchor="middle" fill="#78350f" font-size="9">GL5528</text>
  <line x1="65" y1="116" x2="90" y2="124" stroke="#f59e0b" stroke-width="1.5"/>
  <line x1="65" y1="130" x2="90" y2="138" stroke="#f59e0b" stroke-width="1.5"/>

  <line x1="119" y1="148" x2="119" y2="210" stroke="#0284c7" stroke-width="2.2"/>
  <circle cx="119" cy="190" r="4" fill="#0284c7"/>
  <line x1="119" y1="190" x2="268" y2="190" stroke="#0284c7" stroke-width="2.2"/>
  <text x="192" y="182" text-anchor="middle" fill="#0369a1" font-size="9.5" font-weight="700">Sinal D34</text>

  <rect x="103" y="210" width="32" height="50" rx="3" fill="#e2e8f0" stroke="#475569" stroke-width="1.5"/>
  <text x="119" y="233" text-anchor="middle" fill="#1e293b" font-size="10" font-weight="700">R1</text>
  <text x="119" y="247" text-anchor="middle" fill="#1e293b" font-size="9.5">10 kΩ</text>
  <line x1="119" y1="260" x2="119" y2="336" stroke="#0f172a" stroke-width="2"/>
  <circle cx="119" cy="336" r="3.5" fill="#0f172a"/>

  <!-- Circuito 2: Botão -->
  <rect x="556" y="74" width="194" height="106" rx="8" fill="#ecfdf5" stroke="#059669" stroke-width="1.3"/>
  <text x="653" y="94" text-anchor="middle" fill="#065f46" font-size="11" font-weight="700">BOTÃO NOVA FASE</text>
  <polyline points="512,156 592,156 592,126" fill="none" stroke="#059669" stroke-width="2.2"/>
  <circle cx="592" cy="126" r="3.5" fill="#059669"/>
  <line x1="592" y1="126" x2="646" y2="112" stroke="#0f172a" stroke-width="2.2"/>
  <circle cx="652" cy="126" r="3.5" fill="#0f172a"/>
  <text x="622" y="146" text-anchor="middle" fill="#065f46" font-size="10" font-weight="700">Botão 6x6 mm</text>
  <text x="622" y="160" text-anchor="middle" fill="#475569" font-size="9">(Pull-up interno do ESP32)</text>
  <polyline points="652,126 720,126 720,336" fill="none" stroke="#0f172a" stroke-width="2"/>
  <circle cx="720" cy="336" r="3.5" fill="#0f172a"/>

  <!-- Circuito 3: LED + 220 -->
  <rect x="556" y="190" width="194" height="122" rx="8" fill="#fef2f2" stroke="#dc2626" stroke-width="1.3"/>
  <text x="653" y="210" text-anchor="middle" fill="#991b1b" font-size="11" font-weight="700">LED VERMELHO (R1/R2/ACK)</text>
  <line x1="512" y1="208" x2="572" y2="236" stroke="#dc2626" stroke-width="2.2"/>
  <rect x="572" y="224" width="48" height="24" rx="3" fill="#e2e8f0" stroke="#475569" stroke-width="1.5"/>
  <text x="596" y="240" text-anchor="middle" fill="#1e293b" font-size="9.5" font-weight="700">220 Ω</text>
  <line x1="620" y1="236" x2="644" y2="236" stroke="#dc2626" stroke-width="2"/>
  <polygon points="644,224 644,248 666,236" fill="#ef4444" stroke="#991b1b" stroke-width="1.5"/>
  <line x1="666" y1="224" x2="666" y2="248" stroke="#991b1b" stroke-width="2"/>
  <text x="655" y="264" text-anchor="middle" fill="#991b1b" font-size="10" font-weight="700">LED 5 mm (+ / -)</text>
  <text x="655" y="278" text-anchor="middle" fill="#475569" font-size="9">Corrente ≈ 6,4 mA</text>
  <polyline points="666,236 696,236 696,336" fill="none" stroke="#0f172a" stroke-width="2"/>
  <circle cx="696" cy="336" r="3.5" fill="#0f172a"/>
</svg>
`;
}

export function diagramSequenceSvg() {
  return `
<svg viewBox="0 0 780 320" width="100%" xmlns="http://www.w3.org/2000/svg" style="font-family: 'Segoe UI', Arial, sans-serif;">
  <defs>
    <marker id="seqArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#1e293b"/>
    </marker>
    <marker id="seqErr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#dc2626"/>
    </marker>
  </defs>

  <rect x="0" y="0" width="780" height="320" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2"/>

  <rect x="36" y="16" width="144" height="32" rx="6" fill="#0891b2"/>
  <text x="108" y="36" text-anchor="middle" fill="#ffffff" font-size="11.5" font-weight="700">Sensores e LED</text>
  <line x1="108" y1="48" x2="108" y2="302" stroke="#94a3b8" stroke-dasharray="4 4"/>

  <rect x="318" y="16" width="144" height="32" rx="6" fill="#4f46e5"/>
  <text x="390" y="36" text-anchor="middle" fill="#ffffff" font-size="11.5" font-weight="700">ESP32 (Periférico)</text>
  <line x1="390" y1="48" x2="390" y2="302" stroke="#94a3b8" stroke-dasharray="4 4"/>

  <rect x="600" y="16" width="144" height="32" rx="6" fill="#059669"/>
  <text x="672" y="36" text-anchor="middle" fill="#ffffff" font-size="11.5" font-weight="700">App Android (Central)</text>
  <line x1="672" y1="48" x2="672" y2="302" stroke="#94a3b8" stroke-dasharray="4 4"/>

  <rect x="30" y="58" width="420" height="32" rx="5" fill="#f0fdfa" stroke="#0f766e" stroke-dasharray="4 2"/>
  <text x="240" y="78" text-anchor="middle" fill="#0f766e" font-size="10.5" font-weight="700">1. Offline (R1/R2): LDR &lt; 950 → ESP32 acende o LED (D26) sozinho</text>

  <line x1="672" y1="108" x2="394" y2="108" stroke="#1e293b" stroke-width="1.6" marker-end="url(#seqArrow)"/>
  <text x="532" y="102" text-anchor="middle" fill="#1e293b" font-size="10">2. Conecta por BLE e assina notificações</text>

  <line x1="108" y1="138" x2="386" y2="138" stroke="#1e293b" stroke-width="1.6" marker-end="url(#seqArrow)"/>
  <text x="249" y="132" text-anchor="middle" fill="#1e293b" font-size="10">3. Aperto no botão (D27)</text>

  <line x1="390" y1="164" x2="668" y2="164" stroke="#1e293b" stroke-width="1.6" marker-end="url(#seqArrow)"/>
  <text x="530" y="158" text-anchor="middle" fill="#1e293b" font-size="10" font-weight="700">4. TX Notify: dungeon_req (JSON + HMAC)</text>

  <line x1="672" y1="194" x2="394" y2="194" stroke="#1e293b" stroke-width="1.6" marker-end="url(#seqArrow)"/>
  <text x="532" y="188" text-anchor="middle" fill="#1e293b" font-size="10">5. RX Write: ack "loaded" + HMAC válido</text>

  <line x1="390" y1="216" x2="112" y2="216" stroke="#1e293b" stroke-width="1.6" marker-end="url(#seqArrow)"/>
  <text x="249" y="210" text-anchor="middle" fill="#1e293b" font-size="10">6. Pisca LED vermelho 3x</text>

  <line x1="672" y1="246" x2="394" y2="246" stroke="#1e293b" stroke-width="1.6" marker-end="url(#seqArrow)"/>
  <text x="532" y="240" text-anchor="middle" fill="#1e293b" font-size="10">7. Ganhou no portal → ack "victory" + LED pisca 5x</text>

  <line x1="672" y1="274" x2="394" y2="274" stroke="#dc2626" stroke-width="1.6" stroke-dasharray="4 2" marker-end="url(#seqErr)"/>
  <text x="532" y="268" text-anchor="middle" fill="#dc2626" font-size="10" font-weight="700">8. Teste de ataque: comando com MAC falso</text>

  <line x1="390" y1="296" x2="668" y2="296" stroke="#dc2626" stroke-width="1.6" marker-end="url(#seqErr)"/>
  <text x="532" y="290" text-anchor="middle" fill="#dc2626" font-size="10" font-weight="700">TX ERR: AUTH_FAILED (LED não muda)</text>
</svg>
`;
}

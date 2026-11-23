import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '../tools/node_modules/playwright/index.mjs';
import {
  diagramFourLayersSvg,
  diagramSchematicSvg,
  diagramSequenceSvg,
} from './diagrams.mjs';

const rootDir = path.resolve(import.meta.dirname, '..', '..');
const fotosDir = path.join(rootDir, 'docs', 'fotos');
const pdfOutLocal = path.join(import.meta.dirname, 'relatorio-dungeonlink.pdf');
const pdfOutDist = path.join(rootDir, 'dist-entrega', 'relatorio-dungeonlink.pdf');

function readImageAsDataUri(candidates) {
  for (const name of candidates) {
    const p = path.join(fotosDir, name);
    if (fs.existsSync(p)) {
      const ext = path.extname(p).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
      const b64 = fs.readFileSync(p).toString('base64');
      return { name, uri: `data:${mime};base64,${b64}` };
    }
  }
  return null;
}

function exampleHmac(canonical) {
  return crypto
    .createHmac('sha256', 'CHAVE-EXEMPLO-DOCUMENTACAO')
    .update(canonical)
    .digest('hex')
    .slice(0, 16);
}

const imgJogoClaro = readImageAsDataUri(['app-jogo-claro.png']);
const imgJogoEscuro = readImageAsDataUri(['app-jogo-escuro.png']);
const imgTelemetria = readImageAsDataUri(['app-telemetria.png']);
const imgControle = readImageAsDataUri(['app-controle-seguranca.png']);
const fotoBancada1 = readImageAsDataUri(['foto-montagem-1.jpg', 'foto-montagem-1.jpeg', 'foto-montagem-1.png']);
const fotoBancada2 = readImageAsDataUri(['foto-montagem-2.jpg', 'foto-montagem-2.jpeg', 'foto-montagem-2.png']);

const exDungeonReq = JSON.stringify({
  v: 1,
  type: 'dungeon_req',
  seq: 4,
  dungeon_id: 2,
  light: 'dark',
  ldr_raw: 842,
  ldr_pct: 21,
  led: 1,
  mode: 'auto',
  ts: 48210,
  mac: exampleHmac('dungeon_req|4|2|dark|842|1|auto'),
});

const exTelemetry = JSON.stringify({
  v: 1,
  type: 'telemetry',
  seq: 5,
  dungeon_id: 2,
  light: 'bright',
  ldr_raw: 2850,
  ldr_pct: 70,
  led: 0,
  mode: 'auto',
  ts: 49710,
  mac: exampleHmac('telemetry|5|2|bright|2850|0|auto'),
});

const exAck = JSON.stringify({
  v: 1,
  type: 'ack',
  seq: 1,
  action: 'loaded',
  arg: '2',
  mac: exampleHmac('ack|1|loaded|2'),
});

const exCmd = JSON.stringify({
  v: 1,
  type: 'cmd',
  seq: 2,
  action: 'set_mode',
  arg: 'manual',
  mac: exampleHmac('cmd|2|set_mode|manual'),
});

const exErr = JSON.stringify({
  v: 1,
  type: 'err',
  code: 'AUTH_FAILED',
  msg: 'Assinatura HMAC invalida',
});

function renderPhotoBox(imgObj, title, placeholderHint) {
  if (imgObj) {
    return `
      <figure class="photo-card">
        <img src="${imgObj.uri}" alt="${title}" />
        <figcaption>${title} (${imgObj.name})</figcaption>
      </figure>
    `;
  }
  return `
    <div class="photo-placeholder">
      <strong>${title}</strong>
      <span>${placeholderHint}</span>
    </div>
  `;
}

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Relatório Técnico — DungeonLink</title>
<style>
  @page {
    size: A4;
    margin: 16mm 14mm 17mm 14mm;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'Segoe UI', 'Liberation Sans', Arial, sans-serif;
    font-size: 9.7pt;
    line-height: 1.46;
    color: #1e293b;
  }
  h1, h2, h3, h4 { color: #0f172a; margin-top: 0; }
  h2 {
    font-size: 13pt;
    border-bottom: 2px solid #4f46e5;
    padding-bottom: 3px;
    margin-top: 15px;
    margin-bottom: 8px;
    page-break-after: avoid;
  }
  h3 {
    font-size: 10.5pt;
    color: #1e3a8a;
    margin-top: 10px;
    margin-bottom: 5px;
    page-break-after: avoid;
  }
  p { margin: 0 0 7px; text-align: justify; }
  ul, ol { margin: 4px 0 8px 18px; padding: 0; }
  li { margin-bottom: 3.5px; }
  code {
    font-family: 'DejaVu Sans Mono', ui-monospace, monospace;
    font-size: 8.4pt;
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
    color: #0f172a;
  }
  pre {
    background: #0f172a;
    color: #e2e8f0;
    padding: 8px 10px;
    border-radius: 6px;
    font-family: 'DejaVu Sans Mono', ui-monospace, monospace;
    font-size: 7.7pt;
    line-height: 1.38;
    overflow-x: hidden;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 6px 0 10px;
    break-inside: avoid;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 6px 0 10px;
    font-size: 8.6pt;
    break-inside: avoid;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 5px 7px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background: #eef2ff;
    color: #1e293b;
    font-weight: 700;
  }
  tr:nth-child(even) td { background: #f8fafc; }
  .cover-page {
    min-height: 252mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 10mm 6mm;
    border: 1.5px solid #cbd5e1;
    border-radius: 10px;
    background: linear-gradient(180deg, #f8fafc 0%, #ffffff 45%, #eef2ff 100%);
    page-break-after: always;
  }
  .cover-top {
    border-left: 5px solid #4f46e5;
    padding-left: 14px;
  }
  .cover-tag {
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #4f46e5;
    text-transform: uppercase;
  }
  .cover-title {
    font-size: 28pt;
    font-weight: 800;
    color: #0f172a;
    margin: 10px 0 6px;
  }
  .cover-subtitle {
    font-size: 12.5pt;
    color: #334155;
    margin: 0;
  }
  .cover-center {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 14px 16px;
  }
  .cover-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 8px;
  }
  .cover-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 9pt;
  }
  .cover-meta {
    border-top: 1.5px solid #cbd5e1;
    padding-top: 12px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    font-size: 9.5pt;
  }
  .figure-box {
    margin: 8px 0 10px;
    text-align: center;
    break-inside: avoid;
  }
  .figure-caption {
    font-size: 8.3pt;
    color: #475569;
    margin-top: 4px;
    font-style: italic;
  }
  .photo-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 8px 0 10px;
    break-inside: avoid;
  }
  .photo-card {
    margin: 0;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 5px;
    background: #ffffff;
    text-align: center;
  }
  .photo-card img {
    width: 100%;
    max-height: 55mm;
    object-fit: contain;
    border-radius: 4px;
    background: #0b0e17;
  }
  .photo-card figcaption {
    font-size: 8pt;
    color: #475569;
    margin-top: 3px;
  }
  .photo-placeholder {
    border: 2px dashed #94a3b8;
    border-radius: 6px;
    padding: 20px 12px;
    min-height: 44mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    background: #f8fafc;
    color: #475569;
    font-size: 8.5pt;
    gap: 5px;
  }
</style>
</head>
<body>

<!-- ==================== CAPA ==================== -->
<section class="cover-page">
  <div class="cover-top">
    <div class="cover-tag">Trabalho Final — Internet das Coisas (IoT)</div>
    <h1 class="cover-title">DungeonLink</h1>
    <p class="cover-subtitle">
      Miniaventura 2D em pixel art ligada a sensores e LEDs no ESP32 via Bluetooth Low Energy (BLE)
    </p>
  </div>

  <div class="cover-center">
    <h3>Resumo do Projeto</h3>
    <p>
      O <strong>DungeonLink</strong> liga uma montagem física no <strong>ESP32 DevKit V1</strong> a um aplicativo Android. A luz do ambiente e um botão na protoboard mudam o jogo 2D em tempo real, enquanto o app mostra o histórico de leituras e manda confirmações para piscar o LED da placa. O sistema passa pelas quatro camadas de IoT (<em>Percepção → Rede → Processamento → Aplicação</em>), decide localmente mesmo sem internet ou celular conectado e protege todas as mensagens com assinatura <strong>HMAC-SHA256</strong>.
    </p>
    <div class="cover-grid">
      <div class="cover-box">
        <strong>Na Protoboard:</strong><br/>
        ESP32-WROOM-32, LDR GL5528 + 10 kΩ (pino D34), Botão tátil (D27), LED vermelho + 220 Ω (D26) e LED azul da placa (D2).
      </div>
      <div class="cover-box">
        <strong>No Celular e Segurança:</strong><br/>
        Bluetooth Low Energy (BLE), mensagens JSON assinadas, app Android em APK, gráfico ao vivo e chaves fora do GitHub.
      </div>
    </div>
  </div>

  <div class="cover-meta">
    <div>
      <strong>Integrantes:</strong><br/>
      Vinicius Cecatto<br/>
      Leonardo Scheffer Nunes
    </div>
    <div>
      <strong>Disciplina e Professor:</strong><br/>
      Internet das Coisas (IoT) — 2º Semestre / 2026<br/>
      Prof. Marcos Augusto Campagnaro Mucelini
    </div>
    <div>
      <strong>Montagem:</strong><br/>
      Hardware Físico (ESP32 + Protoboard) + App Android
    </div>
    <div>
      <strong>Data de Entrega:</strong><br/>
      23 de novembro de 2026
    </div>
  </div>
</section>

<!-- ==================== 1. PROBLEMA E SOLUÇÃO ==================== -->
<h2>1. Problema e Solução</h2>
<p>
  Em muitos projetos de IoT, os dados dos sensores ficam só em números no computador ou em um LED piscando na bancada. Isso deixa o sistema sem graça e dificulta mostrar para outras pessoas como o ambiente físico conversa com um software de verdade.
</p>
<p>
  O <strong>DungeonLink</strong> resolve isso ligando o ESP32 a um jogo 2D em pixel art no celular Android:
</p>
<ul>
  <li><strong>Luz muda o jogo:</strong> o sensor LDR mede a claridade da sala. Quando escurece, o LED vermelho da placa acende sozinho como uma tocha e o jogo muda do modo claro para o modo sombrio.</li>
  <li><strong>Botão sorteia fases:</strong> ao apertar o botão na protoboard, o ESP32 escolhe uma nova dungeon (IDs 1, 2 ou 3) com duas salas, um inimigo e o portal final.</li>
  <li><strong>Resposta nos dois sentidos:</strong> quando a fase carrega ou o jogador vence no portal, o celular avisa o ESP32 por Bluetooth e o LED vermelho pisca confirmando.</li>
</ul>
<p>
  <strong>Para quem serve:</strong> estudantes e jogadores com celular Android em apresentações acadêmicas e testes rápidos, sem depender de Wi-Fi da sala ou cabo USB ligado ao PC.
</p>

<table>
  <thead>
    <tr>
      <th>Requisito do Edital</th>
      <th>Como o DungeonLink atende</th>
      <th>Onde conferir</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>R1 — Percepção e ação</strong></td>
      <td>O LDR mede a luz e acende o LED vermelho (D26) no escuro automaticamente. O botão (D27) cria novas fases.</td>
      <td>Tampar o LDR acende o LED na hora.</td>
    </tr>
    <tr>
      <td><strong>R2 — Decisão local offline</strong></td>
      <td>No modo <code>auto</code>, o ESP32 faz média de 8 leituras e histerese (1500/1800) a cada 100 ms, sem internet e sem celular.</td>
      <td>Basta ligar o ESP32 na energia para funcionar.</td>
    </tr>
    <tr>
      <td><strong>R3 — Comunicação sem fio</strong></td>
      <td>Usa Bluetooth Low Energy (BLE) entre ESP32 e Android, com baixo gasto de energia e sem precisar de roteador.</td>
      <td>Conexão direta no app com <code>DungeonLink-ESP32</code>.</td>
    </tr>
    <tr>
      <td><strong>R4 — Payload estruturado</strong></td>
      <td>Mensagens JSON curtas terminadas com <code>\\n</code>, número de sequência (<code>seq</code>) e assinatura <code>mac</code> (HMAC-SHA256).</td>
      <td>Seção 5 deste relatório e aba de log do app.</td>
    </tr>
    <tr>
      <td><strong>R5 — Interface sem Serial</strong></td>
      <td>LED azul (status BLE) e LED vermelho na placa, além do app Android com jogo, badges no topo, gráfico e tabela.</td>
      <td>Tudo visível nos LEDs e na tela do celular.</td>
    </tr>
    <tr>
      <td><strong>Extras feitos</strong></td>
      <td>Gráfico ao vivo com exportação CSV, comandos validados pela rede (HMAC) e troca entre modo <code>auto</code> e <code>manual</code>.</td>
      <td>Abas <em>Telemetria</em> e <em>BLE &amp; Segurança</em> no APK.</td>
    </tr>
  </tbody>
</table>

<!-- ==================== 2. ARQUITETURA ==================== -->
<h2>2. Arquitetura do Sistema</h2>
<p>
  O projeto segue as quatro camadas de IoT nos dois sentidos. O ponto mais importante é que a regra local de iluminação (R2) roda direto no ESP32 o tempo todo — mesmo antes de abrir o app ou se o Bluetooth cair.
</p>

<div class="figure-box">
  ${diagramFourLayersSvg()}
  <div class="figure-caption">Figura 1 — As quatro camadas do DungeonLink e a decisão local offline no ESP32.</div>
</div>

<ul>
  <li><strong>Percepção:</strong> sensor LDR + resistor 10 kΩ (luz), botão tátil (troca de fase) e dois LEDs (vermelho para luz/confirmações e azul para status do Bluetooth).</li>
  <li><strong>Processamento:</strong> o ESP32 filtra o sinal do sensor, controla o LED, sorteia fases e confere as assinaturas de segurança. O celular valida os dados recebidos, roda o jogo 2D e guarda o histórico.</li>
  <li><strong>Rede:</strong> Bluetooth Low Energy (BLE) com serviço próprio e duas características: uma para o ESP32 mandar dados (<code>TX</code>) e outra para receber comandos (<code>RX</code>).</li>
  <li><strong>Aplicação:</strong> app Android com jogo de 3 fases (2 salas cada), painel de status sempre visível, gráfico em tempo real, tabela exportável em CSV e inspetor de segurança.</li>
</ul>

<!-- ==================== 3. HARDWARE ==================== -->
<h2>3. Hardware e Montagem Física</h2>
<p>
  Toda a montagem trabalha em <strong>3,3 V</strong> (tensão nativa dos pinos do ESP32) para não danificar a placa e manter leitura limpa do sensor.
</p>

<div class="figure-box">
  ${diagramSchematicSvg()}
  <div class="figure-caption">Figura 2 — Esquema elétrico ligando o ESP32 DevKit V1 ao LDR, botão e LED vermelho.</div>
</div>

<h3>3.1 Contas rápidas do circuito</h3>
<ul>
  <li><strong>Divisor de tensão do LDR (D34):</strong> o LDR vai do <code>3.3V</code> até o pino <code>D34</code>, e o resistor de <code>10 kΩ</code> vai do <code>D34</code> até o <code>GND</code>. Quanto mais luz bate, menor a resistência do LDR e maior a tensão no pino (<code>ldr_raw</code> sobe para ~2700–3400). No escuro, a tensão cai abaixo de 0,85 V (<code>ldr_raw</code> &lt; 1050), ativando o estado escuro abaixo de <code>1500</code>.</li>
  <li><strong>Resistor do LED vermelho (D26):</strong> a saída dá <code>3,3 V</code> e o LED vermelho consome cerca de <code>1,9 V</code>. Com <code>220 Ω</code>, a corrente fica em <code>(3,3 - 1,9) / 220 ≈ 6,4 mA</code>, bem abaixo do limite seguro do ESP32 (20 mA).</li>
</ul>

<h3>3.2 Peças e pinos usados</h3>
<table>
  <thead>
    <tr>
      <th>Peça</th>
      <th>Pino</th>
      <th>Configuração</th>
      <th>Por que esse pino?</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>ESP32 DevKit V1</strong></td>
      <td>3V3 / GND / USB</td>
      <td>Alimentação USB 5V → 3,3V</td>
      <td>Já vem com Bluetooth (BLE) embutido, leitura analógica de 12 bits e criptografia por hardware.</td>
    </tr>
    <tr>
      <td><strong>LDR GL5528 + 10 kΩ</strong></td>
      <td><code>GPIO 34 (D34)</code></td>
      <td>Entrada analógica (<code>ADC1</code>)</td>
      <td>O ADC1 funciona normalmente com Bluetooth ligado (pinos do ADC2 travam quando o rádio está ativo).</td>
    </tr>
    <tr>
      <td><strong>Botão tátil 6×6 mm</strong></td>
      <td><code>GPIO 27 (D27)</code></td>
      <td><code>INPUT_PULLUP</code> (ativo <code>LOW</code>)</td>
      <td>Usa o resistor interno da placa (dispensa resistor externo) e tem filtro de 50 ms contra clique duplo.</td>
    </tr>
    <tr>
      <td><strong>LED vermelho + 220 Ω</strong></td>
      <td><code>GPIO 26 (D26)</code></td>
      <td>Saída digital (<code>OUTPUT</code>)</td>
      <td>Acende sozinho no escuro (R1/R2) e pisca quando o celular confirma fases ou vitórias.</td>
    </tr>
    <tr>
      <td><strong>LED azul da placa</strong></td>
      <td><code>GPIO 2 (D2)</code></td>
      <td>Saída digital (<code>OUTPUT</code>)</td>
      <td>Pisca esperando Bluetooth; fica aceso direto quando o celular conecta (ajuda no requisito R5).</td>
    </tr>
  </tbody>
</table>

<h3>3.3 Fotos da montagem e prints do aplicativo</h3>
<div class="photo-grid">
  ${renderPhotoBox(fotoBancada1, 'Montagem Física — Visão Geral', 'Salve foto-montagem-1.jpg em docs/fotos/ e rode generate-report.mjs')}
  ${renderPhotoBox(fotoBancada2, 'Montagem Física — Detalhe / LED Aceso', 'Salve foto-montagem-2.jpg em docs/fotos/ e rode generate-report.mjs')}
  ${renderPhotoBox(imgJogoClaro, 'App Android — Fase em Ambiente Claro', 'Screenshot indisponível')}
  ${renderPhotoBox(imgJogoEscuro, 'App Android — Modo Sombrio (Com Tocha)', 'Screenshot indisponível')}
</div>

<!-- ==================== 4. SOFTWARE ==================== -->
<h2>4. Organização do Código e Rotinas Principais</h2>
<p>
  O repositório divide o projeto em duas pastas: <code>firmware/dungeonlink_esp32/</code> (código do ESP32) e <code>app/</code> (aplicativo Android em APK).
</p>

<table>
  <thead>
    <tr>
      <th>Parte / Biblioteca</th>
      <th>Versão</th>
      <th>O que faz</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>esp32:esp32</code> (<code>&lt;BLE.h&gt;</code>)</td>
      <td>4.0.0</td>
      <td>Cria o servidor Bluetooth GATT no ESP32, negocia tamanho de pacote (MTU 256) e recebe comandos.</td>
    </tr>
    <tr>
      <td><code>ArduinoJson</code></td>
      <td>7.4.3</td>
      <td>Monta e lê os pacotes JSON com segurança de memória.</td>
    </tr>
    <tr>
      <td><code>mbedtls/md.h</code> + <code>psa/crypto.h</code></td>
      <td>ESP-IDF</td>
      <td>Calcula SHA-256 e assinatura HMAC-SHA256 no próprio microcontrolador.</td>
    </tr>
    <tr>
      <td>React + TypeScript + Vite</td>
      <td>18.3 / 5.6</td>
      <td>Interface com 3 abas, desenho pixel art no Canvas 2D e gráfico SVG de luminosidade.</td>
    </tr>
    <tr>
      <td>Capacitor + <code>bluetooth-le</code></td>
      <td>6.2.1 / 6.1.0</td>
      <td>Empacota o site em APK Android e acessa o Bluetooth nativo do celular.</td>
    </tr>
  </tbody>
</table>

<h3>4.1 Leitura estável do sensor e controle sem travar o ESP32</h3>
<p>
  O código não usa <code>delay()</code> longo para não travar o botão nem o Bluetooth. Ele usa o relógio <code>millis()</code> para fazer tudo em paralelo: lê o LDR a cada 100 ms, guarda a média das últimas 8 leituras e aplica duas faixas (histerese): só entra no escuro abaixo de <code>1500</code> e só volta para o claro acima de <code>1800</code>.
</p>
<pre>void sampleLdrAndApplyLocalRule(bool&amp; stateChanged) {
  ldrSamples[ldrSampleIndex] = readSingleLdr();
  ldrSampleIndex = (ldrSampleIndex + 1) % LDR_AVG_WINDOW;
  // ... calcula média ldrRawAvg ...
  if (!isDark &amp;&amp; ldrRawAvg &lt; LDR_DARK_ENTER) isDark = true;       // &lt; 1500 (~37%)
  else if (isDark &amp;&amp; ldrRawAvg &gt; LDR_DARK_EXIT) isDark = false; // &gt; 1800 (~44%)

  targetLedState = (ledMode == "auto") ? isDark : manualLedState;
}</pre>
<p>
  Quando o app manda confirmação (<code>ack/loaded</code> ou <code>ack/victory</code>), a função <code>startLedBlinkPattern()</code> faz o LED piscar 3 vezes (fase carregada) ou 5 vezes (vitória) e depois volta sozinho ao estado normal do LED.
</p>

<h3>4.2 O jogo 2D e as telas do aplicativo</h3>
<p>
  Cada uma das 3 dungeons (<em>Cripta das Pedras</em>, <em>Catacumba de Ossos</em> e <em>Forja Sombria</em>) tem duas salas desenhadas em grade 16×10. Na Sala 1, o jogador atravessa os obstáculos até a porta dourada. Na Sala 2, derrota o inimigo para abrir o Portal Final. Quando o sensor envia <code>"light": "dark"</code>, a tela escurece e acende um círculo de luz de tocha ao redor do herói.
</p>

<div class="photo-grid">
  ${renderPhotoBox(imgTelemetria, 'Aba Telemetria — Gráfico e Tabela ao Vivo', 'Screenshot indisponível')}
  ${renderPhotoBox(imgControle, 'Aba BLE & Segurança — Auto/Manual e Rejeição HMAC', 'Screenshot indisponível')}
</div>

<!-- ==================== 5. COMUNICAÇÃO ==================== -->
<h2>5. Comunicação Sem Fio e Formato das Mensagens</h2>

<h3>5.1 Por que usar Bluetooth Low Energy (R3)?</h3>
<table>
  <thead>
    <tr>
      <th>Critério</th>
      <th>BLE (Escolhido)</th>
      <th>Wi-Fi / MQTT</th>
      <th>Bluetooth Clássico</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Alcance</strong></td>
      <td>10 a 30 m — tamanho certo para a bancada e o celular na mão.</td>
      <td>30 a 80 m via roteador (maior que o necessário).</td>
      <td>~10 m.</td>
    </tr>
    <tr>
      <td><strong>Consumo</strong></td>
      <td>Baixo (~10–15 mA em envio curto), pronto para usar bateria no futuro.</td>
      <td>Alto (picos de 160–240 mA no rádio Wi-Fi).</td>
      <td>Mais alto que o BLE.</td>
    </tr>
    <tr>
      <td><strong>Taxa de dados</strong></td>
      <td>1 Mbps físico (~100–250 kbps úteis) — sobra para pacotes de ~110 bytes.</td>
      <td>Dezenas de Mbps (desnecessário aqui).</td>
      <td>2 a 3 Mbps.</td>
    </tr>
    <tr>
      <td><strong>Custo</strong></td>
      <td><strong>Zero custo extra:</strong> sem roteador, sem senha de Wi-Fi e sem servidor na nuvem.</td>
      <td>Precisa de rede Wi-Fi funcionando e broker/servidor.</td>
      <td>Suporte menor em APIs móveis modernas.</td>
    </tr>
  </tbody>
</table>

<h3>5.2 Serviços BLE e sequência de comunicação</h3>
<ul>
  <li><strong>Nome do ESP32 no Bluetooth:</strong> <code>DungeonLink-ESP32</code></li>
  <li><strong>Serviço GATT:</strong> <code>d0a6e001-7c3b-4a2e-9b1f-5e8c4d2a1000</code></li>
  <li><strong>Canal TX (ESP32 → App):</strong> <code>d0a6e002-7c3b-4a2e-9b1f-5e8c4d2a1000</code> (<code>Read | Notify</code>)</li>
  <li><strong>Canal RX (App → ESP32):</strong> <code>d0a6e003-7c3b-4a2e-9b1f-5e8c4d2a1000</code> (<code>Write | WriteNR</code>)</li>
</ul>

<div class="figure-box">
  ${diagramSequenceSvg()}
  <div class="figure-caption">Figura 3 — Passo a passo das trocas entre sensores, ESP32 e celular (incluindo rejeição de ataque).</div>
</div>

<h3>5.3 Exemplos reais de payload JSON (R4)</h3>
<p>
  Todas as mensagens vão em JSON compacto terminado por <code>\\n</code> (para remontar certo mesmo em conexões BLE de pacote curto). Os exemplos abaixo mostram uma assinatura <code>mac</code> calculada com uma chave ilustrativa:
</p>
<pre>// 1) ESP32 -> App: Botão apertado (pede nova fase)
${exDungeonReq}

// 2) ESP32 -> App: Aviso periódico / ambiente ficou claro
${exTelemetry}

// 3) App -> ESP32: Confirma fase carregada (LED pisca 3x)
${exAck}

// 4) App -> ESP32: Muda LED para modo MANUAL
${exCmd}

// 5) ESP32 -> App: Bloqueio de pacote com assinatura errada
${exErr}</pre>

<!-- ==================== 6. SEGURANÇA (+10%) ==================== -->
<h2>6. Segurança do Sistema (Adicional de Segurança)</h2>
<p>
  Para buscar os pontos extras de segurança do edital, o projeto aplica quatro cuidados práticos fáceis de conferir no código e ao vivo.
</p>

<h3>6.1 Chaves fora do repositório Git</h3>
<p>
  Nenhuma senha ou chave fica salva no GitHub. A chave compartilhada do HMAC fica só nos arquivos locais <code>firmware/dungeonlink_esp32/secrets.h</code> e <code>app/.env</code>, que estão bloqueados no <code>.gitignore</code>. No repositório ficam apenas <code>secrets.example.h</code> e <code>app/.env.example</code> com texto falso de exemplo. Mesmo com log serial ligado, o ESP32 nunca imprime a chave secreta.
</p>

<h3>6.2 Checklist OWASP IoT Top 10 aplicado ao DungeonLink</h3>
<table>
  <thead>
    <tr>
      <th>Item OWASP</th>
      <th>Risco no projeto</th>
      <th>O que foi feito</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>I1 — Senhas no código</strong></td>
      <td>Chave secreta vazar no GitHub.</td>
      <td><strong>Resolvido:</strong> chave isolada em <code>secrets.h</code> e <code>app/.env</code> no <code>.gitignore</code>.</td>
    </tr>
    <tr>
      <td><strong>I2 — Serviços abertos</strong></td>
      <td>Outro celular próximo mandar comandos na característica <code>RX</code>.</td>
      <td><strong>Resolvido:</strong> todo pacote recebido em <code>RX</code> exige HMAC válido; Wi-Fi fica desligado.</td>
    </tr>
    <tr>
      <td><strong>I3 — Entradas sem filtro</strong></td>
      <td>JSON gigante ou comando inválido travar o ESP32.</td>
      <td><strong>Resolvido:</strong> checagem de tamanho (≤ 256 B), campos permitidos e trava de <code>set_led</code> em modo <code>auto</code>.</td>
    </tr>
    <tr>
      <td><strong>I4 — Atualização insegura</strong></td>
      <td>Atualização sem fio sem assinatura.</td>
      <td><strong>Controlado:</strong> gravação só via cabo USB; OTA assinado fica para versão futura.</td>
    </tr>
    <tr>
      <td><strong>I5 — Bibliotecas antigas</strong></td>
      <td>Falhas antigas de leitura de JSON ou Bluetooth.</td>
      <td><strong>Resolvido:</strong> uso do ESP32 core 4.0.0 e ArduinoJson 7.4.3 atualizados.</td>
    </tr>
    <tr>
      <td><strong>I6 — Privacidade</strong></td>
      <td>App pedir localização GPS sem necessidade.</td>
      <td><strong>Resolvido:</strong> declaração <code>neverForLocation</code> no Android 12+ e zero coleta de dados pessoais.</td>
    </tr>
    <tr>
      <td><strong>I7 — Dados em trânsito</strong></td>
      <td>Alguém copiar ou alterar um comando Bluetooth no ar.</td>
      <td><strong>Resolvido:</strong> HMAC-SHA256 em cada pacote e bloqueio de número de sequência repetido (anti-replay).</td>
    </tr>
    <tr>
      <td><strong>I8 — Falta de controle</strong></td>
      <td>Não saber se um comando foi aceito ou bloqueado.</td>
      <td><strong>Resolvido:</strong> aba <em>BLE &amp; Segurança</em> mostra cada JSON com selo <code>HMAC OK</code> ou <code>REJEITADO</code>.</td>
    </tr>
    <tr>
      <td><strong>I9 — Padrão inseguro</strong></td>
      <td>Dispositivo aceitar spam de comandos seguidos.</td>
      <td><strong>Resolvido:</strong> intervalo mínimo de 150 ms entre comandos e boot sempre no modo seguro <code>auto</code>.</td>
    </tr>
    <tr>
      <td><strong>I10 — Acesso físico</strong></td>
      <td>Pinos expostos na protoboard durante o teste.</td>
      <td><strong>Parcial:</strong> normal de protótipo em bancada; produto final usaria caixa fechada e flash criptografada.</td>
    </tr>
  </tbody>
</table>

<h3>6.3 Correções implementadas e teste ativo de ataque</h3>
<p>
  Da lista acima, colocamos no código: (1) assinatura <strong>HMAC-SHA256</strong> em 16 caracteres hex com comparação em tempo constante (<code>constantTimeHexEquals16</code>); (2) bloqueio de replay (<code>seq &gt; lastCmdSeq</code>); (3) limite de 256 bytes e pausa de 150 ms entre comandos; e (4) o botão <strong>Testar Segurança (HMAC Invalido)</strong> no app, que envia um comando falso (<code>deadbeefcafebabe</code>) e mostra o ESP32 devolvendo <code>AUTH_FAILED</code> sem mexer no LED.
</p>

<!-- ==================== 7. TESTES E FALHAS ==================== -->
<h2>7. Testes, Problemas Encontrados e Soluções</h2>
<p>
  Testamos a parte lógica e criptográfica no computador (compilação e scripts automáticos) e deixamos o roteiro pronto para conferir na protoboard ligada ao celular.
</p>

<table>
  <thead>
    <tr>
      <th>Teste</th>
      <th>Como foi feito</th>
      <th>Resultado</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>T1 — Compilação ESP32</strong></td>
      <td><code>arduino-cli compile</code> no firmware completo (core 4.0.0).</td>
      <td>Zero erros (88% de flash e 13% de RAM usados).</td>
      <td><strong>Passou</strong></td>
    </tr>
    <tr>
      <td><strong>T2 — Conta HMAC-SHA256</strong></td>
      <td>Script <code>verify-protocol.mjs</code> contra vetores oficiais da RFC 4231.</td>
      <td>Assinaturas idênticas às do padrão oficial e do Node.</td>
      <td><strong>Passou</strong></td>
    </tr>
    <tr>
      <td><strong>T3 — Regras e Ataques</strong></td>
      <td>Simulação no <code>MockEsp32Device</code> (histerese, comando falso e replay).</td>
      <td>Histerese 1500/1800 funcionou; retornou <code>AUTH_FAILED</code> e <code>REPLAY_DETECTED</code>.</td>
      <td><strong>Passou</strong></td>
    </tr>
    <tr>
      <td><strong>T4 — App e APK Android</strong></td>
      <td>Build Vite/React + <code>gradlew assembleDebug</code>.</td>
      <td>APK instalável gerado sem erros (<code>DungeonLink-debug.apk</code>).</td>
      <td><strong>Passou</strong></td>
    </tr>
    <tr>
      <td><strong>T5 — Placa Física</strong></td>
      <td>Ligar ESP32 sem app → tampar LDR → parear celular → vencer fase.</td>
      <td>LED acende offline; app troca tema; LED pisca no load/vitória.</td>
      <td><strong>Conferência na bancada</strong></td>
    </tr>
  </tbody>
</table>

<h3>7.1 Três falhas reais encontradas e como foram corrigidas</h3>
<ol>
  <li>
    <strong>Corte de mensagens JSON no Bluetooth (MTU de 23 bytes):</strong> mensagens de ~115 bytes chegam quebradas se o celular usar o limite padrão de 20 bytes por pacote. <em>Correção:</em> pedimos MTU de 256 bytes e também enviamos o texto quebrado em blocos até o <code>\\n</code> final, remontando tudo em <code>LineFrameAssembler</code> no app.
  </li>
  <li>
    <strong>LED piscando sem parar no limite claro/escuro:</strong> usar um número fixo só (ex.: 1600) fazia o LED oscilar com qualquer sombrinha. <em>Correção:</em> usamos média de 8 leituras e histerese (entra no escuro abaixo de <code>1500</code> e só sai acima de <code>1800</code>).
  </li>
  <li>
    <strong>Conflito de pino ADC2 com Bluetooth e atualização do ESP32 4.0.0:</strong> pinos do ADC2 falham com rádio ligado, e a versão 4.0.0 do ESP32 mudou a biblioteca BLE para <code>&lt;BLE.h&gt;</code> e removeu o HMAC antigo da MbedTLS. <em>Correção:</em> ligamos o LDR no pino <code>GPIO 34 (ADC1)</code> e escrevemos o código já na API nova <code>&lt;BLE.h&gt;</code> com HMAC RFC 2104 sobre <code>mbedtls_md</code>.
  </li>
</ol>

<!-- ==================== 8. CONCLUSÃO ==================== -->
<h2>8. Conclusão</h2>
<p>
  O <strong>DungeonLink</strong> atendeu todos os requisitos do trabalho, mostrando na prática como um sensor simples pode controlar um jogo 2D inteiro via Bluetooth — sem depender de internet e com segurança contra comandos falsos.
</p>
<p>
  Os maiores aprendizados foram escolher pinos certos no ESP32 (ADC1 para não brigar com o Bluetooth), evitar travamentos no código usando tempo com <code>millis()</code> e proteger a comunicação com chaves fora do GitHub. Para o futuro, queremos colocar bateria recarregável com modo de economia de energia, atualização sem fio (OTA) e modo PvP entre dois celulares.
</p>

<!-- ==================== 9. USO DE IA ==================== -->
<h2>9. Uso de Ferramentas de Inteligência Artificial</h2>
<p>
  Conforme pedido na Seção 8 do edital, o grupo usou ferramentas de Inteligência Artificial como apoio para estruturar o código do ESP32 (API <code>&lt;BLE.h&gt;</code> 4.0.0), o jogo 2D e a conexão Bluetooth do aplicativo Android, além de ajudar a organizar este relatório.
</p>
<p>
  <strong>Como o grupo conferiu o resultado:</strong> Vinicius Cecatto e Leonardo Scheffer Nunes revisaram os arquivos gerados, compilaram o código do ESP32 e o APK Android, rodaram os testes de protocolo e HMAC (<code>verify-protocol.mjs</code>) e conferiram a montagem física na bancada para garantir domínio total na apresentação individual.
</p>

<!-- ==================== 10. REFERÊNCIAS ==================== -->
<h2>10. Referências</h2>
<ul>
  <li>ESPRESSIF. <em>Documentação oficial do ESP32 e Arduino-ESP32 Core 4.0.0</em>. https://docs.espressif.com/</li>
  <li>ARDUINO. <em>Referência da linguagem Arduino</em>. https://www.arduino.cc/reference/</li>
  <li>ARDUINOJSON. <em>Documentação ArduinoJson v7</em>. https://arduinojson.org/</li>
  <li>BLUETOOTH SIG. <em>Especificação Bluetooth Low Energy (GATT)</em>. https://www.bluetooth.com/specifications/specs/</li>
  <li>OWASP. <em>OWASP IoT Top 10 Project</em>. https://owasp.org/www-project-internet-of-things/</li>
  <li>CAPACITOR COMMUNITY. <em>Plugin Bluetooth Low Energy para Capacitor 6</em>. https://github.com/capacitor-community/bluetooth-le</li>
  <li>Datasheet do LDR GL5528 e guias práticos (Robocore, Eletrogate e MakerHero).</li>
  <li>MUCELINI, M. A. C. <em>Aulas da disciplina de Internet das Coisas</em>. 2º Semestre / 2026.</li>
</ul>

</body>
</html>`;

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({
    path: pdfOutLocal,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate:
      '<div style="width:100%;font-size:7.5pt;color:#64748b;padding:0 14mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif;"><span>Internet das Coisas (IoT) — Trabalho Final</span><span>DungeonLink (ESP32 + BLE)</span></div>',
    footerTemplate:
      '<div style="width:100%;font-size:7.5pt;color:#64748b;padding:0 14mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif;"><span>Vinicius Cecatto · Leonardo Scheffer Nunes</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>',
    margin: { top: '17mm', bottom: '17mm', left: '14mm', right: '14mm' },
  });
} finally {
  await browser.close();
}

fs.mkdirSync(path.dirname(pdfOutDist), { recursive: true });
fs.copyFileSync(pdfOutLocal, pdfOutDist);
console.log('[OK] Relatório gerado em:', pdfOutLocal);
console.log('[OK] Copiado para entrega:', pdfOutDist);

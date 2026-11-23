import fs from 'node:fs';
import path from 'node:path';
import PptxGenJS from '../tools/node_modules/pptxgenjs/dist/pptxgen.cjs.js';
import { chromium } from '../tools/node_modules/playwright/index.mjs';

const rootDir = path.resolve(import.meta.dirname, '..', '..');
const fotosDir = path.join(rootDir, 'docs', 'fotos');
const pptxLocal = path.join(import.meta.dirname, 'pitch-dungeonlink.pptx');
const pdfLocal = path.join(import.meta.dirname, 'pitch-dungeonlink.pdf');
const pptxDist = path.join(rootDir, 'dist-entrega', 'pitch-dungeonlink.pptx');
const pdfDist = path.join(rootDir, 'dist-entrega', 'pitch-dungeonlink.pdf');

function imgPath(name) {
  const p = path.join(fotosDir, name);
  return fs.existsSync(p) ? p : null;
}

function imgUri(name) {
  const p = imgPath(name);
  if (!p) return null;
  return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
}

const pClaro = imgPath('app-jogo-claro.png');
const pEscuro = imgPath('app-jogo-escuro.png');
const pTele = imgPath('app-telemetria.png');
const pCtrl = imgPath('app-controle-seguranca.png');

// ============================================================
// 1. PPTX (16:9 widescreen, formato Pitch direto, zero código)
// ============================================================
const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Vinicius Cecatto & Leonardo Scheffer Nunes';
pptx.title = 'DungeonLink — Pitch Projeto Final IoT';

const C = {
  bg: '0B0E17',
  card: '141927',
  border: '2E3856',
  accent: '38D9A9',
  gold: 'F59F00',
  blue: '4C6EF5',
  red: 'FF6B6B',
  text: 'EDF2FF',
  muted: 'A5B1D2',
};

function addSlideShell(slide, tag, title, pageNum) {
  slide.background = { color: C.bg };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: C.accent } });
  slide.addText(tag.toUpperCase(), {
    x: 0.65, y: 0.35, w: 9.0, h: 0.3,
    fontSize: 10.5, bold: true, color: C.accent, charSpacing: 2,
  });
  slide.addText(title, {
    x: 0.65, y: 0.64, w: 12.0, h: 0.58,
    fontSize: 24, bold: true, color: C.text,
  });
  slide.addText(`DungeonLink  |  Vinicius Cecatto & Leonardo Scheffer Nunes  |  ${pageNum}/10`, {
    x: 0.65, y: 7.05, w: 12.0, h: 0.28,
    fontSize: 9.5, color: C.muted, align: 'right',
  });
}

function addCard(slide, x, y, w, h, title, body, accentColor = C.accent) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: C.card },
    line: { color: C.border, width: 1.2 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w: 0.09, h, fill: { color: accentColor },
  });
  slide.addText(title, {
    x: x + 0.24, y: y + 0.16, w: w - 0.38, h: 0.36,
    fontSize: 14, bold: true, color: C.text,
  });
  slide.addText(body, {
    x: x + 0.24, y: y + 0.56, w: w - 0.38, h: h - 0.7,
    fontSize: 12.5, color: C.muted, valign: 'top', lineSpacingMultiple: 1.25,
  });
}

// Slide 1: Capa
{
  const s = pptx.addSlide();
  s.background = { color: C.bg };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: C.accent } });
  s.addShape(pptx.ShapeType.roundRect, {
    x: 0.75, y: 1.05, w: 11.83, h: 5.3, rectRadius: 0.14,
    fill: { color: C.card }, line: { color: C.border, width: 1.5 },
  });
  s.addText('INTERNET DAS COISAS  ·  PROJETO FINAL 2026', {
    x: 1.2, y: 1.5, w: 10.8, h: 0.35,
    fontSize: 12, bold: true, color: C.accent, charSpacing: 2.5,
  });
  s.addText('DungeonLink', {
    x: 1.2, y: 2.0, w: 10.8, h: 1.0,
    fontSize: 48, bold: true, color: C.text,
  });
  s.addText('Quando a luz da sala e um botão físico controlam um jogo 2D no celular', {
    x: 1.2, y: 3.05, w: 10.6, h: 0.75,
    fontSize: 20, color: C.gold,
  });
  s.addText(
    'Sensor real, Bluetooth de baixo consumo, decisão automática sem internet e proteção contra comandos falsos.',
    { x: 1.2, y: 3.95, w: 10.4, h: 0.8, fontSize: 14.5, color: C.muted },
  );
  s.addText('Vinicius Cecatto  ·  Leonardo Scheffer Nunes\nProf. Marcos Augusto Campagnaro Mucelini  |  23/11/2026', {
    x: 1.2, y: 5.2, w: 10.4, h: 0.75, fontSize: 13, color: C.text,
  });
}

// Slide 2: O Problema
{
  const s = pptx.addSlide();
  addSlideShell(s, '01 · O Problema', 'Por que projetos de sensores costumam parecer sem graça?', 2);
  addCard(
    s, 0.65, 1.5, 5.8, 2.45,
    'Só números na tela do PC',
    'Na maioria das práticas, o sensor só mostra valores soltos no computador ou pisca um LED isolado, sem interação de verdade.',
    C.red,
  );
  addCard(
    s, 6.85, 1.5, 5.8, 2.45,
    'Longe de quem usa',
    'Fica difícil enxergar como o mundo físico pode mudar um aplicativo real na mão do usuário.',
    C.gold,
  );
  addCard(
    s, 0.65, 4.25, 12.0, 2.35,
    'Nossa Ideia',
    'E se apagar a luz da sala e apertar um botão na mesa mudassem uma aventura 2D no celular na mesma hora — funcionando até sem internet?',
    C.accent,
  );
}

// Slide 3: A Solução
{
  const s = pptx.addSlide();
  addSlideShell(s, '02 · A Solução', 'DungeonLink: da bancada direto para o celular', 3);
  addCard(
    s, 0.65, 1.5, 3.8, 5.0,
    '1. Na Mão do Jogador',
    'Um sensor lê a luz da sala o tempo todo. Um botão físico sorteia novas fases. Um LED acende no escuro e pisca nas vitórias.',
    C.accent,
  );
  addCard(
    s, 4.75, 1.5, 3.8, 5.0,
    '2. Sem Fio e Sem Roteador',
    'A placa conversa direto com o celular por Bluetooth de baixo consumo, sem precisar de Wi-Fi da sala nem servidor fora.',
    C.blue,
  );
  addCard(
    s, 8.85, 1.5, 3.8, 5.0,
    '3. Jogo e Painel Vivo',
    'O celular muda o visual da fase conforme a luz, tem combate com inimigo e portal, e mostra gráficos de leitura ao vivo.',
    C.gold,
  );
}

// Slide 4: Experiência na Pratica
{
  const s = pptx.addSlide();
  addSlideShell(s, '03 · Na Prática', 'A luz da bancada muda o visual do jogo ao vivo', 4);
  if (pClaro) s.addImage({ path: pClaro, x: 0.65, y: 1.45, w: 5.85, h: 4.9 });
  if (pEscuro) s.addImage({ path: pEscuro, x: 6.83, y: 1.45, w: 5.85, h: 4.9 });
  s.addText('Sala clara: fase toda iluminada e LED apagado', {
    x: 0.65, y: 6.45, w: 5.85, h: 0.35, fontSize: 12, bold: true, color: C.gold, align: 'center',
  });
  s.addText('Sensor tampado: modo sombrio com tocha + LED da placa aceso', {
    x: 6.83, y: 6.45, w: 5.85, h: 0.35, fontSize: 12, bold: true, color: C.accent, align: 'center',
  });
}

// Slide 5: As 4 Camadas
{
  const s = pptx.addSlide();
  addSlideShell(s, '04 · Como Funciona', 'As quatro camadas conversando nos dois sentidos', 5);
  addCard(s, 0.65, 1.55, 2.8, 4.9, 'Percepção', 'Sensor mede a luz; botão pede nova fase; LEDs mostram o estado na placa.', C.accent);
  addCard(s, 3.7, 1.55, 2.8, 4.9, 'Processamento', 'A placa decide o LED sozinha e confere a segurança. O celular roda o jogo e os gráficos.', C.blue);
  addCard(s, 6.75, 1.55, 2.8, 4.9, 'Rede Sem Fio', 'Bluetooth direto entre a placa e o celular mandando e recebendo eventos.', C.gold);
  addCard(s, 9.8, 1.55, 2.85, 4.9, 'Aplicação', 'Aventura 2D com 2 salas por fase, inimigo, portal, gráfico e controles na tela.', C.accent);
}

// Slide 6: Autonomia Offline
{
  const s = pptx.addSlide();
  addSlideShell(s, '05 · Funciona Sem Internet', 'A placa decide sozinha mesmo sem celular conectado', 6);
  addCard(
    s, 0.65, 1.55, 5.85, 2.45,
    'Regra Local Automática',
    'Ligou na tomada ou power bank, ela já funciona: se escurecer na sala, o LED vermelho acende sozinho na hora.',
    C.accent,
  );
  addCard(
    s, 6.83, 1.55, 5.85, 2.45,
    'Sem Ficar Piscando',
    'O sistema tira média das leituras e usa uma margem dupla entre claro e escuro para sombras rápidas não confundirem o LED.',
    C.gold,
  );
  addCard(
    s, 0.65, 4.3, 12.03, 2.3,
    'Resposta Física para Cada Vitória',
    'Com o celular conectado, carregar uma fase faz o LED piscar 3 vezes e passar pelo portal final faz o LED comemorar piscando 5 vezes.',
    C.blue,
  );
}

// Slide 7: Por que Bluetooth Low Energy?
{
  const s = pptx.addSlide();
  addSlideShell(s, '06 · Escolha Sem Fio', 'Por que usamos Bluetooth de baixo consumo?', 7);
  addCard(s, 0.65, 1.55, 5.85, 2.35, 'Sem Depender de Wi-Fi', 'Não precisa de senha da rede da faculdade, roteador nem servidor na nuvem. É ligar e apresentar.', C.accent);
  addCard(s, 6.83, 1.55, 5.85, 2.35, 'Gasta Bem Menos Energia', 'Consome muito menos que Wi-Fi ligado direto, facilitando usar bateria no futuro.', C.gold);
  addCard(s, 0.65, 4.2, 5.85, 2.35, 'Alcance Certo (10 a 30 m)', 'Feito sob medida para o jogador segurar a placa e o celular na mesma mesa ou sala.', C.blue);
  addCard(s, 6.83, 4.2, 5.85, 2.35, 'Rápido e Leve', 'Velocidade de sobra para mensagens curtas em tempo real, sem atrasos no jogo.', C.accent);
}

// Slide 8: Painel e Telemetria
{
  const s = pptx.addSlide();
  addSlideShell(s, '07 · Tudo Visível na Tela', 'Status completo sem precisar de cabo no computador', 8);
  if (pTele) s.addImage({ path: pTele, x: 0.65, y: 1.45, w: 6.2, h: 5.3 });
  addCard(s, 7.15, 1.5, 5.5, 1.6, 'Barra Sempre Visível', 'Mostra conexão Bluetooth, porcentagem de luz e se o LED físico está aceso.', C.accent);
  addCard(s, 7.15, 3.3, 5.5, 1.6, 'Gráfico e Histórico', 'Desenha a curva de luz ao vivo e deixa baixar a tabela para conferir depois.', C.gold);
  addCard(s, 7.15, 5.1, 5.5, 1.6, 'Modo Automático ou Manual', 'Você escolhe se a luz do ambiente manda no LED ou se liga e apaga pelo botão do app.', C.blue);
}

// Slide 9: Segurança
{
  const s = pptx.addSlide();
  addSlideShell(s, '08 · Segurança Ativa', 'Protegido contra chaves vazadas e comandos falsos', 9);
  if (pCtrl) s.addImage({ path: pCtrl, x: 0.65, y: 1.45, w: 6.1, h: 5.3 });
  addCard(s, 7.05, 1.5, 5.6, 1.6, 'Senhas Fora do GitHub', 'As chaves secretas ficam só no equipamento de quem monta; no repositório sobem só exemplos vazios.', C.accent);
  addCard(s, 7.05, 3.3, 5.6, 1.6, 'Mensagens Assinadas', 'Cada comando leva assinatura digital e contagem de ordem para bloquear cópias ou invasões.', C.blue);
  addCard(s, 7.05, 5.1, 5.6, 1.6, 'Bloqueio Provado ao Vivo', 'Um botão de teste manda um comando falso e mostra a placa recusando na hora.', C.red);
}

// Slide 10: Demo e Futuro
{
  const s = pptx.addSlide();
  addSlideShell(s, '09 · Demonstração e Futuro', 'Funcionando ao vivo agora — e pronto para crescer', 10);
  addCard(
    s, 0.65, 1.55, 5.85, 4.95,
    'O que vamos mostrar ao vivo',
    '1. LED acendendo sozinho no escuro sem celular ligado.\n\n2. Conexão Bluetooth direta com o Android.\n\n3. Botão criando fase e luz mudando o cenário.\n\n4. Vitória piscando o LED e bloqueio de comando falso.',
    C.accent,
  );
  addCard(
    s, 6.83, 1.55, 5.85, 4.95,
    'Próximos passos',
    '• Usar bateria recarregável para jogar sem cabo.\n\n• Atualizar o dispositivo sem fio.\n\n• Modo duelo (PvP) entre dois celulares.\n\n• Novos sensores físicos criando armadilhas nas fases.',
    C.gold,
  );
}

await pptx.writeFile({ fileName: pptxLocal });
fs.mkdirSync(path.dirname(pptxDist), { recursive: true });
fs.copyFileSync(pptxLocal, pptxDist);
console.log('[OK] PPTX gerado:', pptxLocal);

// ============================================================
// 2. PDF dos Slides (10 páginas 16:9)
// ============================================================
const uClaro = imgUri('app-jogo-claro.png');
const uEscuro = imgUri('app-jogo-escuro.png');
const uTele = imgUri('app-telemetria.png');
const uCtrl = imgUri('app-controle-seguranca.png');

const slidesHtml = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<style>
  @page { size: 13.333in 7.5in; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Segoe UI', Arial, sans-serif; background: #0b0e17; color: #edf2ff; }
  .slide {
    width: 13.333in;
    height: 7.5in;
    padding: 0.45in 0.65in 0.4in;
    position: relative;
    page-break-after: always;
    background: #0b0e17;
    border-top: 7px solid #38d9a9;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .slide:last-child { page-break-after: auto; }
  .tag { font-size: 11pt; font-weight: 700; letter-spacing: 2px; color: #38d9a9; text-transform: uppercase; }
  h1 { margin: 6px 0 0; font-size: 26pt; color: #edf2ff; }
  .footer { text-align: right; font-size: 10pt; color: #a5b1d2; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; flex: 1; margin: 18px 0 10px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; flex: 1; margin: 20px 0 10px; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; flex: 1; margin: 20px 0 10px; }
  .card {
    background: #141927;
    border: 1.5px solid #2e3856;
    border-left: 7px solid #38d9a9;
    border-radius: 10px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .card.gold { border-left-color: #f59f00; }
  .card.blue { border-left-color: #4c6ef5; }
  .card.red { border-left-color: #ff6b6b; }
  .card h3 { margin: 0; font-size: 15.5pt; color: #edf2ff; }
  .card p { margin: 0; font-size: 13pt; line-height: 1.48; color: #b7c2e0; }
  .cover-box {
    background: #141927;
    border: 1.5px solid #2e3856;
    border-radius: 14px;
    padding: 46px 52px;
    margin: auto 0;
  }
  .cover-title { font-size: 48pt; margin: 12px 0 8px; }
  .cover-sub { font-size: 20pt; color: #f59f00; margin: 0 0 16px; }
  .img-col { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
  .img-col img { max-width: 100%; max-height: 4.9in; border-radius: 10px; border: 1.5px solid #2e3856; }
  .stack-col { display: flex; flex-direction: column; gap: 14px; justify-content: center; }
</style>
</head>
<body>

<div class="slide">
  <div class="cover-box">
    <div class="tag">Internet das Coisas  ·  Projeto Final 2026</div>
    <h1 class="cover-title">DungeonLink</h1>
    <p class="cover-sub">Quando a luz da sala e um botão físico controlam um jogo 2D no celular</p>
    <p style="font-size:14.5pt;color:#b7c2e0;line-height:1.5;margin:0 0 28px;">
      Sensor real, Bluetooth de baixo consumo, decisão automática sem internet e proteção contra comandos falsos.
    </p>
    <div style="font-size:13pt;color:#edf2ff;border-top:1px solid #2e3856;padding-top:14px;">
      <strong>Vinicius Cecatto &amp; Leonardo Scheffer Nunes</strong><br/>
      Prof. Marcos Augusto Campagnaro Mucelini  |  23/11/2026
    </div>
  </div>
</div>

<div class="slide">
  <div><div class="tag">01 · O Problema</div><h1>Por que projetos de sensores costumam parecer sem graça?</h1></div>
  <div style="display:flex;flex-direction:column;gap:18px;flex:1;margin:18px 0 10px;">
    <div class="grid-2" style="margin:0;">
      <div class="card red"><h3>Só números na tela do PC</h3><p>Na maioria das práticas, o sensor só mostra valores soltos no computador ou pisca um LED isolado, sem interação de verdade.</p></div>
      <div class="card gold"><h3>Longe de quem usa</h3><p>Fica difícil enxergar como o mundo físico pode mudar um aplicativo real na mão do usuário.</p></div>
    </div>
    <div class="card"><h3>Nossa Ideia</h3><p>E se apagar a luz da sala e apertar um botão na mesa mudassem uma aventura 2D no celular na mesma hora — funcionando até sem internet?</p></div>
  </div>
  <div class="footer">DungeonLink | Vinicius Cecatto &amp; Leonardo Scheffer Nunes | 2/10</div>
</div>

<div class="slide">
  <div><div class="tag">02 · A Solução</div><h1>DungeonLink: da bancada direto para o celular</h1></div>
  <div class="grid-3">
    <div class="card"><h3>1. Na Mão do Jogador</h3><p>Um sensor lê a luz da sala o tempo todo. Um botão físico sorteia novas fases. Um LED acende no escuro e pisca nas vitórias.</p></div>
    <div class="card blue"><h3>2. Sem Fio e Sem Roteador</h3><p>A placa conversa direto com o celular por Bluetooth de baixo consumo, sem precisar de Wi-Fi da sala nem servidor fora.</p></div>
    <div class="card gold"><h3>3. Jogo e Painel Vivo</h3><p>O celular muda o visual da fase conforme a luz, tem combate com inimigo e portal, e mostra gráficos de leitura ao vivo.</p></div>
  </div>
  <div class="footer">DungeonLink | Vinicius Cecatto &amp; Leonardo Scheffer Nunes | 3/10</div>
</div>

<div class="slide">
  <div><div class="tag">03 · Na Prática</div><h1>A luz da bancada muda o visual do jogo ao vivo</h1></div>
  <div class="grid-2">
    <div class="img-col">${uClaro ? `<img src="${uClaro}" />` : ''}<strong style="color:#f59f00;">Sala clara: fase toda iluminada e LED apagado</strong></div>
    <div class="img-col">${uEscuro ? `<img src="${uEscuro}" />` : ''}<strong style="color:#38d9a9;">Sensor tampado: modo sombrio com tocha + LED da placa aceso</strong></div>
  </div>
  <div class="footer">DungeonLink | Vinicius Cecatto &amp; Leonardo Scheffer Nunes | 4/10</div>
</div>

<div class="slide">
  <div><div class="tag">04 · Como Funciona</div><h1>As quatro camadas conversando nos dois sentidos</h1></div>
  <div class="grid-4">
    <div class="card"><h3>Percepção</h3><p>Sensor mede a luz; botão pede nova fase; LEDs mostram o estado na placa.</p></div>
    <div class="card blue"><h3>Processamento</h3><p>A placa decide o LED sozinha e confere a segurança. O celular roda o jogo e os gráficos.</p></div>
    <div class="card gold"><h3>Rede Sem Fio</h3><p>Bluetooth direto entre a placa e o celular mandando e recebendo eventos.</p></div>
    <div class="card"><h3>Aplicação</h3><p>Aventura 2D com 2 salas por fase, inimigo, portal, gráfico e controles na tela.</p></div>
  </div>
  <div class="footer">DungeonLink | Vinicius Cecatto &amp; Leonardo Scheffer Nunes | 5/10</div>
</div>

<div class="slide">
  <div><div class="tag">05 · Funciona Sem Internet</div><h1>A placa decide sozinha mesmo sem celular conectado</h1></div>
  <div style="display:flex;flex-direction:column;gap:18px;flex:1;margin:18px 0 10px;">
    <div class="grid-2" style="margin:0;">
      <div class="card"><h3>Regra Local Automática</h3><p>Ligou na tomada ou power bank, ela já funciona: se escurecer na sala, o LED vermelho acende sozinho na hora.</p></div>
      <div class="card gold"><h3>Sem Ficar Piscando</h3><p>O sistema tira média das leituras e usa uma margem dupla entre claro e escuro para sombras rápidas não confundirem o LED.</p></div>
    </div>
    <div class="card blue"><h3>Resposta Física para Cada Vitória</h3><p>Com o celular conectado, carregar uma fase faz o LED piscar 3 vezes e passar pelo portal final faz o LED comemorar piscando 5 vezes.</p></div>
  </div>
  <div class="footer">DungeonLink | Vinicius Cecatto &amp; Leonardo Scheffer Nunes | 6/10</div>
</div>

<div class="slide">
  <div><div class="tag">06 · Escolha Sem Fio</div><h1>Por que usamos Bluetooth de baixo consumo?</h1></div>
  <div class="grid-2">
    <div class="card"><h3>Sem Depender de Wi-Fi</h3><p>Não precisa de senha da rede da faculdade, roteador nem servidor na nuvem. É ligar e apresentar.</p></div>
    <div class="card gold"><h3>Gasta Bem Menos Energia</h3><p>Consome muito menos que Wi-Fi ligado direto, facilitando usar bateria no futuro.</p></div>
    <div class="card blue"><h3>Alcance Certo (10 a 30 m)</h3><p>Feito sob medida para o jogador segurar a placa e o celular na mesma mesa ou sala.</p></div>
    <div class="card"><h3>Rápido e Leve</h3><p>Velocidade de sobra para mensagens curtas em tempo real, sem atrasos no jogo.</p></div>
  </div>
  <div class="footer">DungeonLink | Vinicius Cecatto &amp; Leonardo Scheffer Nunes | 7/10</div>
</div>

<div class="slide">
  <div><div class="tag">07 · Tudo Visível na Tela</div><h1>Status completo sem precisar de cabo no computador</h1></div>
  <div class="grid-2">
    <div class="img-col">${uTele ? `<img src="${uTele}" />` : ''}</div>
    <div class="stack-col">
      <div class="card"><h3>Barra Sempre Visível</h3><p>Mostra conexão Bluetooth, porcentagem de luz e se o LED físico está aceso.</p></div>
      <div class="card gold"><h3>Gráfico e Histórico</h3><p>Desenha a curva de luz ao vivo e deixa baixar a tabela para conferir depois.</p></div>
      <div class="card blue"><h3>Modo Automático ou Manual</h3><p>Você escolhe se a luz do ambiente manda no LED ou se liga e apaga pelo botão do app.</p></div>
    </div>
  </div>
  <div class="footer">DungeonLink | Vinicius Cecatto &amp; Leonardo Scheffer Nunes | 8/10</div>
</div>

<div class="slide">
  <div><div class="tag">08 · Segurança Ativa</div><h1>Protegido contra chaves vazadas e comandos falsos</h1></div>
  <div class="grid-2">
    <div class="img-col">${uCtrl ? `<img src="${uCtrl}" />` : ''}</div>
    <div class="stack-col">
      <div class="card"><h3>Senhas Fora do GitHub</h3><p>As chaves secretas ficam só no equipamento de quem monta; no repositório sobem só exemplos vazios.</p></div>
      <div class="card blue"><h3>Mensagens Assinadas</h3><p>Cada comando leva assinatura digital e contagem de ordem para bloquear cópias ou invasões.</p></div>
      <div class="card red"><h3>Bloqueio Provado ao Vivo</h3><p>Um botão de teste manda um comando falso e mostra a placa recusando na hora.</p></div>
    </div>
  </div>
  <div class="footer">DungeonLink | Vinicius Cecatto &amp; Leonardo Scheffer Nunes | 9/10</div>
</div>

<div class="slide">
  <div><div class="tag">09 · Demonstração e Futuro</div><h1>Funcionando ao vivo agora — e pronto para crescer</h1></div>
  <div class="grid-2">
    <div class="card">
      <h3>O que vamos mostrar ao vivo</h3>
      <p>1. LED acendendo sozinho no escuro sem celular ligado.<br/><br/>2. Conexão Bluetooth direta com o Android.<br/><br/>3. Botão criando fase e luz mudando o cenário.<br/><br/>4. Vitória piscando o LED e bloqueio de comando falso.</p>
    </div>
    <div class="card gold">
      <h3>Próximos passos</h3>
      <p>• Usar bateria recarregável para jogar sem cabo.<br/><br/>• Atualizar o dispositivo sem fio.<br/><br/>• Modo duelo (PvP) entre dois celulares.<br/><br/>• Novos sensores físicos criando armadilhas nas fases.</p>
    </div>
  </div>
  <div class="footer">DungeonLink | Vinicius Cecatto &amp; Leonardo Scheffer Nunes | 10/10</div>
</div>

</body>
</html>`;

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setContent(slidesHtml, { waitUntil: 'load' });
  await page.pdf({
    path: pdfLocal,
    width: '13.333in',
    height: '7.5in',
    printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });
} finally {
  await browser.close();
}

fs.copyFileSync(pdfLocal, pdfDist);
console.log('[OK] PDF dos slides gerado:', pdfLocal);

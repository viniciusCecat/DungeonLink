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
  const ext = path.extname(p).toLowerCase() === '.jpg' ? 'jpeg' : 'png';
  return `data:image/${ext};base64,${fs.readFileSync(p).toString('base64')}`;
}

const pClaro = imgPath('app-jogo-claro.png');
const pEscuro = imgPath('app-jogo-escuro.png');
const pTele = imgPath('app-telemetria.png');
const pCtrl = imgPath('app-controle-seguranca.png');
const pFoto1 = imgPath('foto-montagem-1.jpg');
const pFoto2 = imgPath('foto-montagem-2.jpg');

// ============================================================
// 1. PPTX (10 slides diretos, linguagem natural, zero código)
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
  muted: 'B7C2E0',
};

function addSlideShell(slide, tag, title, pageNum) {
  slide.background = { color: C.bg };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: C.accent } });
  slide.addText(tag.toUpperCase(), {
    x: 0.65, y: 0.34, w: 9.0, h: 0.3,
    fontSize: 10.5, bold: true, color: C.accent, charSpacing: 2,
  });
  slide.addText(title, {
    x: 0.65, y: 0.62, w: 12.0, h: 0.56,
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
    fontSize: 14.5, bold: true, color: C.text,
  });
  slide.addText(body, {
    x: x + 0.24, y: y + 0.56, w: w - 0.38, h: h - 0.7,
    fontSize: 12.8, color: C.muted, valign: 'top', lineSpacingMultiple: 1.25,
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
  s.addText('Um jogo 2D no celular que reage ao vivo à luz da sala', {
    x: 1.2, y: 3.08, w: 10.6, h: 0.7,
    fontSize: 21, color: C.gold,
  });
  s.addText(
    'Sensor físico na bancada, conexão Bluetooth direta, LED que responde sozinho no escuro e modo online CO-OP e X1.',
    { x: 1.2, y: 3.92, w: 10.4, h: 0.8, fontSize: 14.5, color: C.muted },
  );
  s.addText('Vinicius Cecatto  ·  Leonardo Scheffer Nunes\nProf. Marcos Augusto Campagnaro Mucelini  |  23/11/2026', {
    x: 1.2, y: 5.2, w: 10.4, h: 0.75, fontSize: 13, color: C.text,
  });
}

// Slide 2: A Ideia
{
  const s = pptx.addSlide();
  addSlideShell(s, '01 · A Ideia', 'Sair do sensor parado só mostrando número na tela', 2);
  addCard(
    s, 0.65, 1.5, 5.8, 2.45,
    'O problema de sempre',
    'Quase todo projeto de bancada só imprime leitura no computador ou acende uma luz isolada. Funciona, mas não chama atenção.',
    C.red,
  );
  addCard(
    s, 6.85, 1.5, 5.8, 2.45,
    'O que a gente quis fazer',
    'Ligar um circuito simples de verdade a um jogo completo no celular, onde o ambiente muda o jogo na hora.',
    C.gold,
  );
  addCard(
    s, 0.65, 4.25, 12.0, 2.35,
    'Como funciona na prática',
    'Você tampou o sensor de luz na mesa: o LED vermelho acende sozinho na placa e a masmorra no celular escurece na hora, deixando só a luz da tocha.',
    C.accent,
  );
}

// Slide 3: Na Bancada (Fotos Reais!)
{
  const s = pptx.addSlide();
  addSlideShell(s, '02 · Montagem Física', 'Circuito enxuto e funcionando sozinho na bancada', 3);
  if (pFoto1) s.addImage({ path: pFoto1, x: 0.65, y: 1.45, w: 5.85, h: 4.35 });
  if (pFoto2) s.addImage({ path: pFoto2, x: 6.83, y: 1.45, w: 5.85, h: 4.35 });
  s.addText('Ambiente claro: sensor livre e LED vermelho apagado', {
    x: 0.65, y: 5.95, w: 5.85, h: 0.35, fontSize: 12.5, bold: true, color: C.gold, align: 'center',
  });
  s.addText('Sensor tampado: LED acende sozinho, mesmo sem celular', {
    x: 6.83, y: 5.95, w: 5.85, h: 0.35, fontSize: 12.5, bold: true, color: C.accent, align: 'center',
  });
  s.addText('Montagem limpa só com sensor de luz e LED vermelho — tiramos o botão extra da protoboard para simplificar o circuito.', {
    x: 0.65, y: 6.45, w: 12.0, h: 0.4, fontSize: 11.5, color: C.muted, align: 'center',
  });
}

// Slide 4: O Jogo na Tela
{
  const s = pptx.addSlide();
  addSlideShell(s, '03 · O Jogo', 'Tela cheia horizontal reagindo ao sensor em tempo real', 4);
  if (pClaro) s.addImage({ path: pClaro, x: 0.65, y: 1.55, w: 5.85, h: 3.3 });
  if (pEscuro) s.addImage({ path: pEscuro, x: 6.83, y: 1.55, w: 5.85, h: 3.3 });
  s.addText('Claro: mapa visível, guardas e baú dourado', {
    x: 0.65, y: 4.95, w: 5.85, h: 0.35, fontSize: 12, bold: true, color: C.gold, align: 'center',
  });
  s.addText('Escuro: visão de tocha acompanhando o herói', {
    x: 6.83, y: 4.95, w: 5.85, h: 0.35, fontSize: 12, bold: true, color: C.accent, align: 'center',
  });
  addCard(
    s, 0.65, 5.45, 12.03, 1.35,
    'Conteúdo completo para jogar de verdade',
    '3 masmorras com 3 salas cada (inimigos intermediários + chefe final), baús de tesouro, 7 armas, 5 armaduras, 3 relíquias, escudo recarregável e poções.',
    C.blue,
  );
}

// Slide 5: Multiplayer CO-OP e X1
{
  const s = pptx.addSlide();
  addSlideShell(s, '04 · Multiplayer Online', 'Dá para jogar junto ou X1 até em casas diferentes', 5);
  addCard(
    s, 0.65, 1.55, 5.85, 2.45,
    'Modo CO-OP',
    'Dois jogadores entram na mesma masmorra, limpam as 3 salas juntos e enfrentam o chefe em equipe.',
    C.accent,
  );
  addCard(
    s, 6.83, 1.55, 5.85, 2.45,
    'Modo X1 (Duelo)',
    'Arena simétrica 1 contra 1 com placar ao vivo, escudo, esquiva e troca livre de armas na mochila.',
    C.red,
  );
  addCard(
    s, 0.65, 4.3, 12.03, 2.25,
    'Simples de entrar: código de 4 letras',
    'Um cria a sala e recebe um código curto. O amigo abre pelo celular ou navegador — mesmo em outra rede e sem instalar nada extra — digita o código e já entra na partida.',
    C.gold,
  );
}

// Slide 6: Como o Sistema Conversa
{
  const s = pptx.addSlide();
  addSlideShell(s, '05 · Arquitetura', 'Quatro camadas trabalhando juntas sem complicação', 6);
  addCard(s, 0.65, 1.55, 2.8, 4.9, '1. Sensor e LED', 'Lê a luz da sala o tempo todo e aciona o LED vermelho na protoboard.', C.accent);
  addCard(s, 3.7, 1.55, 2.8, 4.9, '2. Placa Local', 'Filtra ruído da luz, decide o LED sozinha no escuro e checa a segurança.', C.blue);
  addCard(s, 6.75, 1.55, 2.8, 4.9, '3. Bluetooth', 'Liga a placa direto no celular sem precisar de roteador nem senha de Wi-Fi.', C.gold);
  addCard(s, 9.8, 1.55, 2.85, 4.9, '4. App no Celular', 'Roda o jogo em tela cheia, o multiplayer, os gráficos de luz e o controle manual.', C.accent);
}

// Slide 7: Autonomia e Bluetooth
{
  const s = pptx.addSlide();
  addSlideShell(s, '06 · Por que Bluetooth e Regra Local?', 'Funciona na hora, gasta pouco e não trava sem internet', 7);
  addCard(s, 0.65, 1.55, 5.85, 2.35, 'Decisão sozinha na placa', 'Mesmo desligando o celular, cobrir o sensor continua acendendo o LED na hora. Média de leituras e margem dupla evitam o LED ficar piscando.', C.accent);
  addCard(s, 6.83, 1.55, 5.85, 2.35, 'Bluetooth de baixo consumo', 'Não depende da rede Wi-Fi da faculdade, consome bem menos energia e tem alcance sob medida (10 a 30 m) para a bancada.', C.gold);
  addCard(s, 0.65, 4.2, 12.03, 2.35, 'Resposta física para o que acontece no jogo', 'Carregou nova masmorra? O LED pisca 3 vezes. Passou pelo portal da vitória? Pisca 5 vezes comemorando na bancada.', C.blue);
}

// Slide 8: Painel e Telemetria
{
  const s = pptx.addSlide();
  addSlideShell(s, '07 · Painel no Celular', 'Tudo visível no menu Opções sem precisar do computador', 8);
  if (pTele) s.addImage({ path: pTele, x: 0.65, y: 1.5, w: 6.2, h: 5.1 });
  addCard(s, 7.15, 1.5, 5.5, 1.55, 'Status no topo do jogo', 'Enquanto joga, já dá para ver conexão Bluetooth, luz em porcentagem e estado do LED.', C.accent);
  addCard(s, 7.15, 3.28, 5.5, 1.55, 'Gráfico ao vivo', 'Dentro de Opções, a curva de luz atualiza em tempo real e guarda o histórico.', C.gold);
  addCard(s, 7.15, 5.06, 5.5, 1.55, 'Automático ou Manual', 'Você escolhe se a luz manda no LED ou se liga e apaga direto pelo botão na tela.', C.blue);
}

// Slide 9: Segurança
{
  const s = pptx.addSlide();
  addSlideShell(s, '08 · Segurança na Prática', 'Nada de senha vazada nem comando falso aceito', 9);
  if (pCtrl) s.addImage({ path: pCtrl, x: 0.65, y: 1.5, w: 6.1, h: 5.1 });
  addCard(s, 7.05, 1.5, 5.6, 1.55, 'Chaves fora do repositório', 'As senhas ficam só na placa e no app local; no repositório público sobem só arquivos modelo.', C.accent);
  addCard(s, 7.05, 3.28, 5.6, 1.55, 'Assinatura e ordem', 'Cada comando leva assinatura digital e número de sequência para barrar cópias repetidas.', C.blue);
  addCard(s, 7.05, 5.06, 5.6, 1.55, 'Teste de invasão ao vivo', 'No painel existe um botão que envia um comando forjado e mostra a placa rejeitando na hora.', C.red);
}

// Slide 10: Demonstração e Fechamento
{
  const s = pptx.addSlide();
  addSlideShell(s, '09 · Demonstração', 'O que entregamos rodando de verdade hoje', 10);
  addCard(
    s, 0.65, 1.55, 5.85, 4.95,
    'Roteiro da demonstração',
    '1. Cobrir o sensor sem o celular: LED acende sozinho.\n\n2. Conectar por Bluetooth no Android.\n\n3. Mostrar a luz da mesa mudando o mapa do jogo ao vivo.\n\n4. Testar modo manual do LED e bloqueio de comando falso.\n\n5. Mostrar combate nas salas, mochila e sala online CO-OP / X1.',
    C.accent,
  );
  addCard(
    s, 6.83, 1.55, 5.85, 4.95,
    'O que pode vir depois',
    '• Colocar bateria recarregável na placa para dispensar o cabo USB.\n\n• Adicionar novos sensores físicos (temperatura ou movimento) criando armadilhas nas fases.\n\n• Expandir para mais fases e chefes.\n\nObrigado! Aberto para perguntas.',
    C.gold,
  );
}

await pptx.writeFile({ fileName: pptxLocal });
fs.mkdirSync(path.dirname(pptxDist), { recursive: true });
fs.copyFileSync(pptxLocal, pptxDist);
console.log('[OK] PPTX gerado:', pptxLocal);

// ============================================================
// 2. PDF dos Slides (10 páginas 16:9 espelhando o PPTX)
// ============================================================
const uClaro = imgUri('app-jogo-claro.png');
const uEscuro = imgUri('app-jogo-escuro.png');
const uTele = imgUri('app-telemetria.png');
const uCtrl = imgUri('app-controle-seguranca.png');
const uFoto1 = imgUri('foto-montagem-1.jpg');
const uFoto2 = imgUri('foto-montagem-2.jpg');

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
  h1 { margin: 6px 0 0; font-size: 25pt; color: #edf2ff; }
  .footer { text-align: right; font-size: 10pt; color: #a5b1d2; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; flex: 1; margin: 16px 0 10px; }
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
  .cover-sub { font-size: 21pt; color: #f59f00; margin: 0 0 16px; }
  .img-col { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
  .img-col img { max-width: 100%; max-height: 4.5in; border-radius: 10px; border: 1.5px solid #2e3856; }
  .img-col.game img { max-height: 3.3in; }
  .stack-col { display: flex; flex-direction: column; gap: 14px; justify-content: center; }
</style>
</head>
<body>

<div class="slide">
  <div class="cover-box">
    <div class="tag">Internet das Coisas · Projeto Final 2026</div>
    <h1 class="cover-title">DungeonLink</h1>
    <p class="cover-sub">Um jogo 2D no celular que reage ao vivo à luz da sala</p>
    <p style="font-size:14.5pt;color:#b7c2e0;line-height:1.5;margin:0 0 28px;">
      Sensor físico na bancada, conexão Bluetooth direta, LED que responde sozinho no escuro e modo online CO-OP e X1.
    </p>
    <div style="font-size:13pt;color:#edf2ff;border-top:1px solid #2e3856;padding-top:14px;">
      <strong>Vinicius Cecatto &amp; Leonardo Scheffer Nunes</strong><br/>
      Prof. Marcos Augusto Campagnaro Mucelini | 23/11/2026
    </div>
  </div>
</div>

<div class="slide">
  <div><div class="tag">01 · A Ideia</div><h1>Sair do sensor parado só mostrando número na tela</h1></div>
  <div style="display:flex;flex-direction:column;gap:18px;flex:1;margin:18px 0 10px;">
    <div class="grid-2" style="margin:0;">
      <div class="card red"><h3>O problema de sempre</h3><p>Quase todo projeto de bancada só imprime leitura no computador ou acende uma luz isolada. Funciona, mas não chama atenção.</p></div>
      <div class="card gold"><h3>O que a gente quis fazer</h3><p>Ligar um circuito simples de verdade a um jogo completo no celular, onde o ambiente muda o jogo na hora.</p></div>
    </div>
    <div class="card"><h3>Como funciona na prática</h3><p>Você tampou o sensor de luz na mesa: o LED vermelho acende sozinho na placa e a masmorra no celular escurece na hora, deixando só a luz da tocha.</p></div>
  </div>
  <div class="footer">DungeonLink | Vinicius Cecatto &amp; Leonardo Scheffer Nunes | 2/10</div>
</div>

<div class="slide">
  <div><div class="tag">02 · Montagem Física</div><h1>Circuito enxuto e funcionando sozinho na bancada</h1></div>
  <div class="grid-2" style="flex:0 1 auto;margin:14px 0 6px;">
    <div class="img-col">${uFoto1 ? `<img src="${uFoto1}" />` : ''}<strong style="color:#f59f00;">Ambiente claro: sensor livre e LED vermelho apagado</strong></div>
    <div class="img-col">${uFoto2 ? `<img src="${uFoto2}" />` : ''}<strong style="color:#38d9a9;">Sensor tampado: LED acende sozinho, mesmo sem celular</strong></div>
  </div>
  <p style="text-align:center;color:#b7c2e0;font-size:11.5pt;margin:0;">Montagem limpa só com sensor de luz e LED vermelho — tiramos o botão extra da protoboard para simplificar o circuito.</p>
  <div class="footer">DungeonLink | Vinicius Cecatto &amp; Leonardo Scheffer Nunes | 3/10</div>
</div>

<div class="slide">
  <div><div class="tag">03 · O Jogo</div><h1>Tela cheia horizontal reagindo ao sensor em tempo real</h1></div>
  <div class="grid-2" style="flex:0 1 auto;margin:12px 0 8px;">
    <div class="img-col game">${uClaro ? `<img src="${uClaro}" />` : ''}<strong style="color:#f59f00;">Claro: mapa visível, guardas e baú dourado</strong></div>
    <div class="img-col game">${uEscuro ? `<img src="${uEscuro}" />` : ''}<strong style="color:#38d9a9;">Escuro: visão de tocha acompanhando o herói</strong></div>
  </div>
  <div class="card blue" style="padding:14px 18px;">
    <h3>Conteúdo completo para jogar de verdade</h3>
    <p>3 masmorras com 3 salas cada (inimigos intermediários + chefe final), baús de tesouro, 7 armas, 5 armaduras, 3 relíquias, escudo recarregável e poções.</p>
  </div>
  <div class="footer">DungeonLink | Vinicius Cecatto &amp; Leonardo Scheffer Nunes | 4/10</div>
</div>

<div class="slide">
  <div><div class="tag">04 · Multiplayer Online</div><h1>Dá para jogar junto ou X1 até em casas diferentes</h1></div>
  <div style="display:flex;flex-direction:column;gap:18px;flex:1;margin:18px 0 10px;">
    <div class="grid-2" style="margin:0;">
      <div class="card"><h3>Modo CO-OP</h3><p>Dois jogadores entram na mesma masmorra, limpam as 3 salas juntos e enfrentam o chefe em equipe.</p></div>
      <div class="card red"><h3>Modo X1 (Duelo)</h3><p>Arena simétrica 1 contra 1 com placar ao vivo, escudo, esquiva e troca livre de armas na mochila.</p></div>
    </div>
    <div class="card gold"><h3>Simples de entrar: código de 4 letras</h3><p>Um cria a sala e recebe um código curto. O amigo abre pelo celular ou navegador — mesmo em outra rede e sem instalar nada extra — digita o código e já entra na partida.</p></div>
  </div>
  <div class="footer">DungeonLink | Vinicius Cecatto &amp; Leonardo Scheffer Nunes | 5/10</div>
</div>

<div class="slide">
  <div><div class="tag">05 · Arquitetura</div><h1>Quatro camadas trabalhando juntas sem complicação</h1></div>
  <div class="grid-4">
    <div class="card"><h3>1. Sensor e LED</h3><p>Lê a luz da sala o tempo todo e aciona o LED vermelho na protoboard.</p></div>
    <div class="card blue"><h3>2. Placa Local</h3><p>Filtra ruído da luz, decide o LED sozinha no escuro e checa a segurança.</p></div>
    <div class="card gold"><h3>3. Bluetooth</h3><p>Liga a placa direto no celular sem precisar de roteador nem senha de Wi-Fi.</p></div>
    <div class="card"><h3>4. App no Celular</h3><p>Roda o jogo em tela cheia, o multiplayer, os gráficos de luz e o controle manual.</p></div>
  </div>
  <div class="footer">DungeonLink | Vinicius Cecatto &amp; Leonardo Scheffer Nunes | 6/10</div>
</div>

<div class="slide">
  <div><div class="tag">06 · Por que Bluetooth e Regra Local?</div><h1>Funciona na hora, gasta pouco e não trava sem internet</h1></div>
  <div style="display:flex;flex-direction:column;gap:18px;flex:1;margin:18px 0 10px;">
    <div class="grid-2" style="margin:0;">
      <div class="card"><h3>Decisão sozinha na placa</h3><p>Mesmo desligando o celular, cobrir o sensor continua acendendo o LED na hora. Média de leituras e margem dupla evitam o LED ficar piscando.</p></div>
      <div class="card gold"><h3>Bluetooth de baixo consumo</h3><p>Não depende da rede Wi-Fi da faculdade, consome bem menos energia e tem alcance sob medida (10 a 30 m) para a bancada.</p></div>
    </div>
    <div class="card blue"><h3>Resposta física para o que acontece no jogo</h3><p>Carregou nova masmorra? O LED pisca 3 vezes. Passou pelo portal da vitória? Pisca 5 vezes comemorando na bancada.</p></div>
  </div>
  <div class="footer">DungeonLink | Vinicius Cecatto &amp; Leonardo Scheffer Nunes | 7/10</div>
</div>

<div class="slide">
  <div><div class="tag">07 · Painel no Celular</div><h1>Tudo visível no menu Opções sem precisar do computador</h1></div>
  <div class="grid-2">
    <div class="img-col">${uTele ? `<img src="${uTele}" />` : ''}</div>
    <div class="stack-col">
      <div class="card"><h3>Status no topo do jogo</h3><p>Enquanto joga, já dá para ver conexão Bluetooth, luz em porcentagem e estado do LED.</p></div>
      <div class="card gold"><h3>Gráfico ao vivo</h3><p>Dentro de Opções, a curva de luz atualiza em tempo real e guarda o histórico.</p></div>
      <div class="card blue"><h3>Automático ou Manual</h3><p>Você escolhe se a luz manda no LED ou se liga e apaga direto pelo botão na tela.</p></div>
    </div>
  </div>
  <div class="footer">DungeonLink | Vinicius Cecatto &amp; Leonardo Scheffer Nunes | 8/10</div>
</div>

<div class="slide">
  <div><div class="tag">08 · Segurança na Prática</div><h1>Nada de senha vazada nem comando falso aceito</h1></div>
  <div class="grid-2">
    <div class="img-col">${uCtrl ? `<img src="${uCtrl}" />` : ''}</div>
    <div class="stack-col">
      <div class="card"><h3>Chaves fora do repositório</h3><p>As senhas ficam só na placa e no app local; no repositório público sobem só arquivos modelo.</p></div>
      <div class="card blue"><h3>Assinatura e ordem</h3><p>Cada comando leva assinatura digital e número de sequência para barrar cópias repetidas.</p></div>
      <div class="card red"><h3>Teste de invasão ao vivo</h3><p>No painel existe um botão que envia um comando forjado e mostra a placa rejeitando na hora.</p></div>
    </div>
  </div>
  <div class="footer">DungeonLink | Vinicius Cecatto &amp; Leonardo Scheffer Nunes | 9/10</div>
</div>

<div class="slide">
  <div><div class="tag">09 · Demonstração</div><h1>O que entregamos rodando de verdade hoje</h1></div>
  <div class="grid-2">
    <div class="card">
      <h3>Roteiro da demonstração</h3>
      <p>1. Cobrir o sensor sem o celular: LED acende sozinho.<br/><br/>2. Conectar por Bluetooth no Android.<br/><br/>3. Mostrar a luz da mesa mudando o mapa do jogo ao vivo.<br/><br/>4. Testar modo manual do LED e bloqueio de comando falso.<br/><br/>5. Mostrar combate nas salas, mochila e sala online CO-OP / X1.</p>
    </div>
    <div class="card gold">
      <h3>O que pode vir depois</h3>
      <p>• Colocar bateria recarregável na placa para dispensar o cabo USB.<br/><br/>• Adicionar novos sensores físicos (temperatura ou movimento) criando armadilhas nas fases.<br/><br/>• Expandir para mais fases e chefes.<br/><br/><strong>Obrigado! Aberto para perguntas.</strong></p>
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

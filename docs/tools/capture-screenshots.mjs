import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const rootDir = path.resolve(import.meta.dirname, '..', '..');
const distDir = path.join(rootDir, 'app', 'dist');
const outDir = path.join(rootDir, 'docs', 'fotos');

fs.mkdirSync(outDir, { recursive: true });

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.join(distDir, rel);
  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  res.setHeader('Content-Type', mimeTypes[path.extname(filePath)] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(4173, '127.0.0.1', resolve));

const shots = [
  { demo: 'bright', file: 'app-jogo-claro.png', width: 860, height: 780, waitMs: 350 },
  { demo: 'dark', file: 'app-jogo-escuro.png', width: 860, height: 780, waitMs: 350 },
  { demo: 'telemetry', file: 'app-telemetria.png', width: 860, height: 900, waitMs: 350 },
  { demo: 'control', file: 'app-controle-seguranca.png', width: 860, height: 960, waitMs: 500 },
];

let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  for (const shot of shots) {
    const page = await browser.newPage({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: 1.5,
    });
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(`http://127.0.0.1:4173/?demo=${shot.demo}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(shot.waitMs);
    if (errors.length > 0) {
      throw new Error(`Erros de runtime em ?demo=${shot.demo}: ${errors.join(' | ')}`);
    }
    const outPath = path.join(outDir, shot.file);
    await page.screenshot({ path: outPath, fullPage: false });
    await page.close();
    console.log(`[OK] Screenshot salvo: ${outPath} (${fs.statSync(outPath).size} bytes)`);
  }
} finally {
  if (browser) await browser.close();
  server.close();
}

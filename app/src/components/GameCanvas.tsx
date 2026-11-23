import React, { useEffect, useRef } from 'react';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../game/dungeons';
import type { DungeonGameEngine, GameSnapshot, InputState } from '../game/engine';
import type { LightState } from '../ble/protocol';

interface GameCanvasProps {
  engine: DungeonGameEngine;
  snapshot: GameSnapshot;
  light: LightState;
  connected: boolean;
  onRequestNewDungeon: () => void;
  onRetryDungeon: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  engine,
  snapshot,
  light,
  connected,
  onRequestNewDungeon,
  onRetryDungeon,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<InputState>({
    up: false,
    down: false,
    left: false,
    right: false,
    attackPressed: false,
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') inputRef.current.up = true;
      if (k === 's' || e.key === 'ArrowDown') inputRef.current.down = true;
      if (k === 'a' || e.key === 'ArrowLeft') inputRef.current.left = true;
      if (k === 'd' || e.key === 'ArrowRight') inputRef.current.right = true;
      if (k === ' ' || k === 'enter' || k === 'j') {
        e.preventDefault();
        inputRef.current.attackPressed = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') inputRef.current.up = false;
      if (k === 's' || e.key === 'ArrowDown') inputRef.current.down = false;
      if (k === 'a' || e.key === 'ArrowLeft') inputRef.current.left = false;
      if (k === 'd' || e.key === 'ArrowRight') inputRef.current.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const frame = (ts: number) => {
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;

      engine.update(dt, inputRef.current);
      inputRef.current.attackPressed = false;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          engine.render(ctx);
        }
      }
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [engine]);

  const setDir = (dir: keyof Omit<InputState, 'attackPressed'>, pressed: boolean) => {
    inputRef.current[dir] = pressed;
  };

  const triggerAttack = () => {
    inputRef.current.attackPressed = true;
  };

  return (
    <section className="game-layout">
      {/* Barra de status da aventura */}
      <div className="dungeon-hud">
        <div className="hud-block">
          <span className="hud-label">DUNGEON #{snapshot.dungeonId}</span>
          <strong className="hud-title">{snapshot.dungeonName}</strong>
        </div>
        <div className="hud-block">
          <span className="hud-label">SALA / CENARIO</span>
          <strong>
            Sala {snapshot.room}/2 · {light === 'dark' ? 'Modo Sombrio' : 'Modo Claro'}
          </strong>
        </div>
        <div className="hud-block">
          <span className="hud-label">VIDA HEROI</span>
          <span className="hearts" aria-label={`Vida ${snapshot.playerHp} de ${snapshot.playerMaxHp}`}>
            {Array.from({ length: snapshot.playerMaxHp }, (_, idx) => (
              <span key={idx} className={idx < snapshot.playerHp ? 'heart-on' : 'heart-off'}>
                ♥
              </span>
            ))}
          </span>
        </div>
        {snapshot.room === 2 && (
          <div className="hud-block">
            <span className="hud-label">{snapshot.enemyName.toUpperCase()}</span>
            <strong>
              {snapshot.enemyHp > 0 ? `HP ${snapshot.enemyHp}/${snapshot.enemyMaxHp}` : 'Derrotado!'}
            </strong>
          </div>
        )}
      </div>

      {/* Canvas Pixel Art */}
      <div className="canvas-frame">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="pixel-canvas"
        />

        {snapshot.status === 'victory' && (
          <div className="canvas-overlay victory">
            <h3>PORTAL ALCANÇADO!</h3>
            <p>
              {snapshot.dungeonName} concluida em {snapshot.elapsedSec}s.
              {connected
                ? ' Confirmacao enviada ao ESP32 (LED piscando).'
                : ' Conecte o ESP32 para sincronizar o LED fisico.'}
            </p>
            <div className="overlay-actions">
              <button type="button" className="btn btn-primary" onClick={onRequestNewDungeon}>
                Proxima Dungeon
              </button>
              <button type="button" className="btn btn-secondary" onClick={onRetryDungeon}>
                Jogar Novamente
              </button>
            </div>
          </div>
        )}

        {snapshot.status === 'defeat' && (
          <div className="canvas-overlay defeat">
            <h3>HEROI DERROTADO</h3>
            <p>O inimigo guardiao venceu esta tentativa.</p>
            <div className="overlay-actions">
              <button type="button" className="btn btn-primary" onClick={onRetryDungeon}>
                Tentar Novamente
              </button>
              <button type="button" className="btn btn-secondary" onClick={onRequestNewDungeon}>
                Trocar Dungeon
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="hint-strip">{snapshot.hintText}</div>

      {/* Controles Touch + Acoes Rapidas */}
      <div className="controls-deck">
        <div className="dpad" aria-label="Direcional">
          <div />
          <button
            type="button"
            className="dpad-btn"
            onPointerDown={() => setDir('up', true)}
            onPointerUp={() => setDir('up', false)}
            onPointerLeave={() => setDir('up', false)}
            onPointerCancel={() => setDir('up', false)}
          >
            ▲
          </button>
          <div />
          <button
            type="button"
            className="dpad-btn"
            onPointerDown={() => setDir('left', true)}
            onPointerUp={() => setDir('left', false)}
            onPointerLeave={() => setDir('left', false)}
            onPointerCancel={() => setDir('left', false)}
          >
            ◀
          </button>
          <div className="dpad-center" />
          <button
            type="button"
            className="dpad-btn"
            onPointerDown={() => setDir('right', true)}
            onPointerUp={() => setDir('right', false)}
            onPointerLeave={() => setDir('right', false)}
            onPointerCancel={() => setDir('right', false)}
          >
            ▶
          </button>
          <div />
          <button
            type="button"
            className="dpad-btn"
            onPointerDown={() => setDir('down', true)}
            onPointerUp={() => setDir('down', false)}
            onPointerLeave={() => setDir('down', false)}
            onPointerCancel={() => setDir('down', false)}
          >
            ▼
          </button>
          <div />
        </div>

        <div className="action-cluster">
          <button
            type="button"
            className="attack-btn"
            onPointerDown={(e) => {
              e.preventDefault();
              triggerAttack();
            }}
          >
            ⚔ ATACAR
          </button>
          <button type="button" className="btn btn-secondary" onClick={onRequestNewDungeon}>
            Nova Dungeon
          </button>
          <span className="kbd-tip">Teclado: WASD / Setas + Espaco</span>
        </div>
      </div>
    </section>
  );
};

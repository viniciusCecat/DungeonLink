import React, { useEffect, useRef, useState } from 'react';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../game/dungeons';
import type { DungeonGameEngine, GameSnapshot } from '../game/engine';
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
  const stickZoneRef = useRef<HTMLDivElement | null>(null);
  const stickPointerId = useRef<number | null>(null);

  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const joyRef = useRef({ x: 0, y: 0 });
  const pendingActionRef = useRef({ attack: false, dash: false });
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') keysRef.current.up = true;
      if (k === 's' || e.key === 'ArrowDown') keysRef.current.down = true;
      if (k === 'a' || e.key === 'ArrowLeft') keysRef.current.left = true;
      if (k === 'd' || e.key === 'ArrowRight') keysRef.current.right = true;
      if (k === ' ' || k === 'enter' || k === 'j') {
        e.preventDefault();
        pendingActionRef.current.attack = true;
      }
      if (k === 'shift' || k === 'k') {
        e.preventDefault();
        pendingActionRef.current.dash = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') keysRef.current.up = false;
      if (k === 's' || e.key === 'ArrowDown') keysRef.current.down = false;
      if (k === 'a' || e.key === 'ArrowLeft') keysRef.current.left = false;
      if (k === 'd' || e.key === 'ArrowRight') keysRef.current.right = false;
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

      const kx = (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0);
      const ky = (keysRef.current.down ? 1 : 0) - (keysRef.current.up ? 1 : 0);
      const moveX = Math.abs(joyRef.current.x) > 0.05 ? joyRef.current.x : kx;
      const moveY = Math.abs(joyRef.current.y) > 0.05 ? joyRef.current.y : ky;

      engine.update(dt, {
        moveX,
        moveY,
        attackPressed: pendingActionRef.current.attack,
        dashPressed: pendingActionRef.current.dash,
      });
      pendingActionRef.current.attack = false;
      pendingActionRef.current.dash = false;

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

  const updateJoystick = (clientX: number, clientY: number) => {
    const zone = stickZoneRef.current;
    if (!zone) return;
    const rect = zone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.36;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR && dist > 0) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    joyRef.current.x = dx / maxR;
    joyRef.current.y = dy / maxR;
    setKnobOffset({ x: dx, y: dy });
  };

  const resetJoystick = () => {
    stickPointerId.current = null;
    joyRef.current.x = 0;
    joyRef.current.y = 0;
    setKnobOffset({ x: 0, y: 0 });
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
          <span className="hud-label">SALA / CENÁRIO</span>
          <strong>
            Sala {snapshot.room}/2 · {light === 'dark' ? 'Modo Sombrio' : 'Modo Claro'}
          </strong>
        </div>
        <div className="hud-block">
          <span className="hud-label">VIDA HERÓI</span>
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

      {/* Canvas Pixel Art 60fps */}
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
              {snapshot.dungeonName} concluída em {snapshot.elapsedSec}s.
              {connected
                ? ' Confirmação enviada ao ESP32 (LED piscando).'
                : ' Conecte o ESP32 para sincronizar o LED físico.'}
            </p>
            <div className="overlay-actions">
              <button type="button" className="btn btn-primary" onClick={onRequestNewDungeon}>
                Próxima Dungeon
              </button>
              <button type="button" className="btn btn-secondary" onClick={onRetryDungeon}>
                Jogar Novamente
              </button>
            </div>
          </div>
        )}

        {snapshot.status === 'defeat' && (
          <div className="canvas-overlay defeat">
            <h3>HERÓI DERROTADO</h3>
            <p>O guardião da masmorra venceu esta tentativa.</p>
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

      {/* Controles fluidos estilo Soul Knight: Analogico 360° + Atacar + Dash */}
      <div className="controls-deck">
        <div
          ref={stickZoneRef}
          className="joystick-base"
          aria-label="Analógico virtual 360 graus"
          onPointerDown={(e) => {
            e.preventDefault();
            stickPointerId.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            updateJoystick(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (stickPointerId.current !== e.pointerId) return;
            e.preventDefault();
            updateJoystick(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (stickPointerId.current === e.pointerId) resetJoystick();
          }}
          onPointerCancel={resetJoystick}
        >
          <div className="joystick-ring" />
          <div
            className="joystick-knob"
            style={{ transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)` }}
          />
        </div>

        <div className="action-cluster">
          <div className="combat-btns">
            <button
              type="button"
              className="dash-btn"
              onPointerDown={(e) => {
                e.preventDefault();
                pendingActionRef.current.dash = true;
              }}
            >
              ⚡ DASH
            </button>
            <button
              type="button"
              className="attack-btn"
              onPointerDown={(e) => {
                e.preventDefault();
                pendingActionRef.current.attack = true;
              }}
            >
              ⚔ ATACAR
            </button>
          </div>
          <div className="sub-actions">
            <button type="button" className="btn btn-secondary" onClick={onRequestNewDungeon}>
              Nova Dungeon
            </button>
            <span className="kbd-tip">WASD + Espaço (Atacar) + Shift (Dash)</span>
          </div>
        </div>
      </div>
    </section>
  );
};

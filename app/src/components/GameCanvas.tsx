import React, { useEffect, useRef, useState } from 'react';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../game/dungeons';
import type { DungeonGameEngine, GameSnapshot } from '../game/engine';
import { ARMORS, ARMOR_LIST, WEAPONS, WEAPON_LIST } from '../game/items';
import type { ConnectionMode } from '../ble/bleService';
import type { LightState } from '../ble/protocol';

interface GameCanvasProps {
  engine: DungeonGameEngine;
  snapshot: GameSnapshot;
  light: LightState;
  ldrPct: number;
  ledState: 0 | 1;
  connectionMode: ConnectionMode;
  connected: boolean;
  errorMsg: string;
  toastMsg: string;
  optionsOpen: boolean;
  onConnectBle: () => void;
  onOpenOptions: () => void;
  onRequestNewDungeon: () => void;
  onRetryDungeon: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  engine,
  snapshot,
  light,
  ldrPct,
  ledState,
  connectionMode,
  connected,
  errorMsg,
  toastMsg,
  optionsOpen,
  onConnectBle,
  onOpenOptions,
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
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [invFeedback, setInvFeedback] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'i') {
        setInventoryOpen((v) => !v);
        return;
      }
      if (k === 'e') {
        engine.usePotion();
        return;
      }
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
  }, [engine]);

  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const frame = (ts: number) => {
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;

      if (!inventoryOpen && !optionsOpen) {
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
      }
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
  }, [engine, inventoryOpen, optionsOpen]);

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

  const inv = snapshot.inventory;
  const activeWeapon = WEAPONS[inv.equippedWeapon];
  const activeArmor = ARMORS[inv.equippedArmor];

  return (
    <section className="fs-stage">
      {/* Canvas Pixel Art 60fps em Tela Cheia Horizontal */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="fs-canvas"
      />

      {/* HUD Flutuante Superior (estilo Soul Knight) */}
      <div className="fs-hud-top">
        {/* Topo Esquerdo: Vida, Escudo, Arma e Ouro */}
        <div className="hud-pill hud-vitals">
          <div className="vitals-row">
            <span className="hearts" aria-label={`Vida ${snapshot.playerHp} de ${snapshot.playerMaxHp}`}>
              {Array.from({ length: snapshot.playerMaxHp }, (_, idx) => (
                <span key={idx} className={idx < snapshot.playerHp ? 'heart-on' : 'heart-off'}>
                  ♥
                </span>
              ))}
            </span>
            <span className="shields" aria-label={`Escudo ${snapshot.playerShield} de ${snapshot.playerMaxShield}`}>
              {Array.from({ length: snapshot.playerMaxShield }, (_, idx) => (
                <span key={idx} className={idx < snapshot.playerShield ? 'shield-on' : 'shield-off'}>
                  ◆
                </span>
              ))}
            </span>
          </div>
          <div className="hud-subline">
            <span style={{ color: activeWeapon.color, fontWeight: 700 }}>{activeWeapon.name}</span>
            <span>· 🪙 {inv.gold}</span>
          </div>
        </div>

        {/* Topo Centro: Nome da Dungeon + Sala */}
        <div className="hud-pill hud-center-info">
          <strong className="hud-title">
            #{snapshot.dungeonId} {snapshot.dungeonName}
          </strong>
          <span className="hud-room-tag">
            Sala {snapshot.room}/2 · {light === 'dark' ? 'Sombrio' : 'Claro'}
          </span>
        </div>

        {/* Topo Direito: Status IoT compacto + Conectar + Opcoes */}
        <div className="hud-right-group">
          <span className={`badge ${connectionMode}`}>
            {connectionMode === 'ble'
              ? '● BLE'
              : connectionMode === 'simulator'
                ? '● SIM'
                : connectionMode === 'connecting'
                  ? '◌ BLE...'
                  : '○ Off'}
          </span>
          <span className={`badge ${light === 'dark' ? 'dark-pill' : 'bright-pill'}`}>
            {light === 'dark' ? `🌙 ${ldrPct}%` : `☀ ${ldrPct}%`}
          </span>
          <span className={`badge ${ledState === 1 ? 'led-on' : 'led-off'}`}>
            {ledState === 1 ? '🔴' : '⚫'}
          </span>
          {connectionMode === 'disconnected' && (
            <button type="button" className="btn btn-connect-mini" onClick={onConnectBle}>
              🔌 Conectar
            </button>
          )}
          <button
            type="button"
            className="btn options-trigger"
            onClick={onOpenOptions}
            aria-label="Abrir opções"
          >
            ⚙ Opções
          </button>
        </div>
      </div>

      {/* Avisos flutuantes (Erro BLE / Toast / Dica discreta) */}
      <div className="fs-banners">
        {errorMsg && !optionsOpen && (
          <div className="fs-alert">
            <strong>BLE:</strong> {errorMsg}
          </div>
        )}
        {toastMsg && <div className="fs-toast">{toastMsg}</div>}
        {!toastMsg && !errorMsg && <div className="fs-hint">{snapshot.hintText}</div>}
      </div>

      {/* Controle Flutuante Inferior Esquerdo: Analogico 360° */}
      <div className="fs-ctrl-left">
        <div
          ref={stickZoneRef}
          className="joystick-base fs-joystick"
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
      </div>

      {/* Controle Flutuante Inferior Direito: Atacar, Dash, Pocao, Mochila, Nova Dungeon */}
      <div className="fs-ctrl-right">
        <div className="fs-mini-row">
          <button
            type="button"
            className="btn fs-mini-btn potion-btn"
            disabled={inv.potions <= 0 || snapshot.playerHp >= snapshot.playerMaxHp}
            onClick={() => engine.usePotion()}
          >
            🧪 {inv.potions}
          </button>
          <button
            type="button"
            className="btn fs-mini-btn bag-btn"
            onClick={() => {
              setInvFeedback('');
              setInventoryOpen(true);
            }}
          >
            🎒 Mochila
          </button>
          <button type="button" className="btn fs-mini-btn btn-secondary" onClick={onRequestNewDungeon}>
            🎲 Mapa
          </button>
        </div>

        <div className="fs-combat-row">
          <button
            type="button"
            className="dash-btn fs-dash"
            onPointerDown={(e) => {
              e.preventDefault();
              pendingActionRef.current.dash = true;
            }}
          >
            ⚡ DASH
          </button>
          <button
            type="button"
            className="attack-btn fs-attack"
            onPointerDown={(e) => {
              e.preventDefault();
              pendingActionRef.current.attack = true;
            }}
          >
            ⚔
          </button>
        </div>
      </div>

      {/* Overlay de Vitoria */}
      {snapshot.status === 'victory' && (
        <div className="canvas-overlay victory">
          <h3>PORTAL ALCANÇADO!</h3>
          <p>
            {snapshot.dungeonName} concluída em {snapshot.elapsedSec}s.
            {connected
              ? ' Confirmação enviada ao ESP32 (LED piscando).'
              : ' Conecte o ESP32 em ⚙ Opções para sincronizar o LED físico.'}
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

      {/* Overlay de Derrota */}
      {snapshot.status === 'defeat' && (
        <div className="canvas-overlay defeat">
          <h3>HERÓI DERROTADO</h3>
          <p>O guardião da masmorra venceu esta tentativa.</p>
          <div className="overlay-actions">
            <button type="button" className="btn btn-primary" onClick={onRetryDungeon}>
              Tentar Novamente
            </button>
            <button type="button" className="btn bag-btn" onClick={() => setInventoryOpen(true)}>
              🎒 Abrir Mochila
            </button>
          </div>
        </div>
      )}

      {/* Modal de Inventario, Equipamentos e Forja */}
      {inventoryOpen && (
        <div className="inv-backdrop" onClick={() => setInventoryOpen(false)}>
          <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
            <div className="inv-header">
              <div>
                <h3>🎒 Mochila &amp; Forja do Herói</h3>
                <span className="inv-sub">
                  Equipada: <strong style={{ color: activeWeapon.color }}>{activeWeapon.name}</strong> +{' '}
                  <strong>{activeArmor.name}</strong>
                </span>
              </div>
              <div className="inv-resources">
                <span className="badge bright-pill">🪙 {inv.gold} Ouro</span>
                <button
                  type="button"
                  className="btn potion-btn"
                  onClick={() => {
                    const res = engine.buyPotion();
                    setInvFeedback(res.msg);
                  }}
                >
                  +1 🧪 (12 🪙)
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setInventoryOpen(false)}>
                  Fechar ✕
                </button>
              </div>
            </div>

            {invFeedback && <div className="inv-feedback">{invFeedback}</div>}

            <div className="inv-section-title">⚔ ARMAS (mudam ataque, sprite e projétil)</div>
            <div className="inv-grid">
              {WEAPON_LIST.map((w) => {
                const unlocked = inv.unlockedWeapons.includes(w.id);
                const equipped = inv.equippedWeapon === w.id;
                return (
                  <div key={w.id} className={`inv-card ${equipped ? 'equipped' : ''}`}>
                    <div className="inv-card-top">
                      <strong style={{ color: w.color }}>{w.name}</strong>
                      <span className="pill">{w.tag}</span>
                    </div>
                    <p className="inv-desc">{w.description}</p>
                    <div className="inv-stats">
                      Corpo: {w.meleeDamage} · Tiro: {w.projDamage}×{w.projCount}
                    </div>
                    <button
                      type="button"
                      className={`btn ${equipped ? 'btn-secondary' : unlocked ? 'btn-primary' : 'bag-btn'}`}
                      disabled={equipped}
                      onClick={() => {
                        const res = engine.buyOrEquipWeapon(w.id);
                        setInvFeedback(res.msg);
                      }}
                    >
                      {equipped ? 'Equipada ✓' : unlocked ? 'Equipar' : `Forjar (${w.cost} 🪙)`}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="inv-section-title">🛡 ARMADURAS (mudam escudo, velocidade e bônus)</div>
            <div className="inv-grid">
              {ARMOR_LIST.map((a) => {
                const unlocked = inv.unlockedArmors.includes(a.id);
                const equipped = inv.equippedArmor === a.id;
                return (
                  <div key={a.id} className={`inv-card ${equipped ? 'equipped' : ''}`}>
                    <div className="inv-card-top">
                      <strong>{a.name}</strong>
                      <span className="armor-dot" style={{ background: a.tint }} />
                    </div>
                    <p className="inv-desc">{a.description}</p>
                    <div className="inv-stats">
                      Escudo: {a.maxShield} · Vel: {Math.round(a.speedMult * 100)}%
                      {a.bonusDamage > 0 ? ` · +${a.bonusDamage} Dano` : ''}
                    </div>
                    <button
                      type="button"
                      className={`btn ${equipped ? 'btn-secondary' : unlocked ? 'btn-primary' : 'bag-btn'}`}
                      disabled={equipped}
                      onClick={() => {
                        const res = engine.buyOrEquipArmor(a.id);
                        setInvFeedback(res.msg);
                      }}
                    >
                      {equipped ? 'Equipada ✓' : unlocked ? 'Equipar' : `Forjar (${a.cost} 🪙)`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

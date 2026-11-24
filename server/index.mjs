import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.PORT || 4175);
const HOST = process.env.HOST || '0.0.0.0';
const DIST_DIR = path.resolve(import.meta.dirname, '..', 'app', 'dist');
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

// ============================================================
// Mini-implementacao RFC 6455 WebSocket (zero dependencias npm)
// ============================================================
function encodeWsFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function attachWsClient(socket, onMessage, onClose) {
  let buffer = Buffer.alloc(0);
  let closed = false;

  const client = {
    send(obj) {
      if (closed || socket.destroyed) return;
      try {
        socket.write(encodeWsFrame(JSON.stringify(obj)));
      } catch {
        // Ignora erro em socket encerrado
      }
    },
    close() {
      if (closed) return;
      closed = true;
      try {
        socket.end(Buffer.from([0x88, 0x00]));
      } catch {
        socket.destroy();
      }
    },
  };

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const b0 = buffer[0];
      const b1 = buffer[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let payloadLen = b1 & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (buffer.length < 4) return;
        payloadLen = buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (buffer.length < 10) return;
        payloadLen = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }

      const maskLen = masked ? 4 : 0;
      if (buffer.length < offset + maskLen + payloadLen) return;

      const maskKey = masked ? buffer.subarray(offset, offset + 4) : null;
      offset += maskLen;
      const payload = Buffer.from(buffer.subarray(offset, offset + payloadLen));
      buffer = buffer.subarray(offset + payloadLen);

      if (masked && maskKey) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= maskKey[i % 4];
        }
      }

      if (opcode === 0x8) {
        // Close
        closed = true;
        socket.end();
        onClose();
        return;
      }
      if (opcode === 0x9) {
        // Ping -> Pong
        socket.write(Buffer.from([0x8a, 0x00]));
        continue;
      }
      if (opcode === 0x1) {
        try {
          const parsed = JSON.parse(payload.toString('utf8'));
          onMessage(parsed);
        } catch {
          // Ignora JSON malformado
        }
      }
    }
  });

  socket.on('close', () => {
    if (!closed) {
      closed = true;
      onClose();
    }
  });
  socket.on('error', () => {
    if (!closed) {
      closed = true;
      onClose();
    }
  });

  return client;
}

// ============================================================
// Gerenciador de Salas estilo Ruina Divina (Codigo + CO-OP / X1)
// ============================================================
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function broadcastRoom(room, payload, excludeId = null) {
  for (const [pid, member] of room.members.entries()) {
    if (pid === excludeId) continue;
    member.client.send(payload);
  }
}

function serializeRoomInfo(room) {
  return {
    code: room.code,
    mode: room.mode,
    dungeonId: room.dungeonId,
    scores: room.scores,
    players: Array.from(room.members.values()).map((m) => ({
      id: m.id,
      slot: m.slot,
      name: m.name,
      isHost: m.id === room.hostId,
    })),
  };
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const urlPath = (req.url || '/').split('?')[0];
  if (urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, port: PORT }));
    return;
  }

  // Serve o jogo web compilado (app/dist) para o amigo jogar direto pelo navegador sem VPN/APK!
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const safePath = path.normalize(path.join(DIST_DIR, rel));
  if (safePath.startsWith(DIST_DIR) && fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
    const ext = path.extname(safePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(safePath).pipe(res);
    return;
  }

  const indexHtml = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(indexHtml).pipe(res);
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('DungeonLink Multiplayer Relay (CO-OP & X1) ativo.\n');
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }
  const accept = crypto
    .createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );

  const playerId = crypto.randomBytes(4).toString('hex');
  let activeRoom = null;

  const leaveCurrentRoom = () => {
    if (!activeRoom) return;
    const room = activeRoom;
    activeRoom = null;
    room.members.delete(playerId);
    if (room.members.size === 0) {
      rooms.delete(room.code);
      return;
    }
    if (room.hostId === playerId) {
      const next = room.members.values().next().value;
      room.hostId = next.id;
    }
    broadcastRoom(room, { type: 'room_update', room: serializeRoomInfo(room) });
    broadcastRoom(room, { type: 'peer_left', id: playerId });
  };

  const client = attachWsClient(
    socket,
    (msg) => {
      if (!msg || typeof msg.type !== 'string') return;

      if (msg.type === 'create_room') {
        leaveCurrentRoom();
        const code = generateRoomCode();
        const mode = msg.mode === 'pvp' ? 'pvp' : 'coop';
        const dungeonId = [1, 2, 3].includes(Number(msg.dungeonId)) ? Number(msg.dungeonId) : 1;
        const name = String(msg.name || 'Herói 1').slice(0, 16);
        const room = {
          code,
          mode,
          dungeonId,
          hostId: playerId,
          scores: { p1: 0, p2: 0 },
          members: new Map(),
        };
        room.members.set(playerId, { id: playerId, slot: 1, name, client });
        rooms.set(code, room);
        activeRoom = room;
        client.send({
          type: 'room_joined',
          playerId,
          slot: 1,
          room: serializeRoomInfo(room),
        });
        console.log(`[MP] Sala ${code} criada (${mode.toUpperCase()}) por ${name}`);
        return;
      }

      if (msg.type === 'join_room') {
        leaveCurrentRoom();
        const code = String(msg.code || '').trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          client.send({ type: 'mp_error', msg: `Sala "${code}" não encontrada.` });
          return;
        }
        if (room.members.size >= 2) {
          client.send({ type: 'mp_error', msg: `Sala "${code}" já está cheia (2/2).` });
          return;
        }
        const usedSlots = new Set(Array.from(room.members.values()).map((m) => m.slot));
        const slot = usedSlots.has(1) ? 2 : 1;
        const name = String(msg.name || `Herói ${slot}`).slice(0, 16);
        room.members.set(playerId, { id: playerId, slot, name, client });
        activeRoom = room;

        client.send({
          type: 'room_joined',
          playerId,
          slot,
          room: serializeRoomInfo(room),
        });
        broadcastRoom(room, { type: 'room_update', room: serializeRoomInfo(room) });
        console.log(`[MP] ${name} entrou na sala ${code} (slot ${slot})`);
        return;
      }

      if (msg.type === 'leave_room') {
        leaveCurrentRoom();
        return;
      }

      if (!activeRoom) return;

      if (msg.type === 'set_mode' && activeRoom.hostId === playerId) {
        activeRoom.mode = msg.mode === 'pvp' ? 'pvp' : 'coop';
        if ([1, 2, 3].includes(Number(msg.dungeonId))) {
          activeRoom.dungeonId = Number(msg.dungeonId);
        }
        activeRoom.scores = { p1: 0, p2: 0 };
        broadcastRoom(activeRoom, {
          type: 'match_reset',
          room: serializeRoomInfo(activeRoom),
        });
        return;
      }

      if (msg.type === 'pvp_ko') {
        const winnerSlot = Number(msg.winnerSlot) === 2 ? 2 : 1;
        if (winnerSlot === 1) activeRoom.scores.p1 += 1;
        else activeRoom.scores.p2 += 1;
        broadcastRoom(activeRoom, {
          type: 'pvp_score',
          winnerSlot,
          scores: activeRoom.scores,
        });
        return;
      }

      // Repasse ultra-rapido de estado do jogador, ataques, dano em inimigo (CO-OP) e dano PvP (X1)
      if (
        msg.type === 'state' ||
        msg.type === 'attack' ||
        msg.type === 'enemy_hit' ||
        msg.type === 'pvp_hit' ||
        msg.type === 'room_sync'
      ) {
        broadcastRoom(
          activeRoom,
          { ...msg, from: playerId },
          playerId,
        );
      }
    },
    () => {
      leaveCurrentRoom();
    },
  );
});

server.listen(PORT, HOST, () => {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const [iface, list] of Object.entries(nets)) {
    for (const info of list || []) {
      if (info.family === 'IPv4' && !info.internal) {
        ips.push({ iface, addr: info.address });
      }
    }
  }
  console.log(`[DungeonLink MP] Relay ativo em ws://localhost:${PORT}`);
  for (const ip of ips) {
    const label = ip.iface.includes('tailscale') || ip.addr.startsWith('100.') ? 'Tailscale VPN' : ip.iface;
    console.log(`[DungeonLink MP] ${label}: ws://${ip.addr}:${PORT}`);
  }
});

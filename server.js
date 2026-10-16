/* ============================================================
   Wrong Way — LAN Multiplayer Server
   Express static file server + WebSocket game room manager
   ============================================================ */

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const os = require('os');

const PORT = 3000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files from the project root
app.use(express.static(path.join(__dirname)));

// ==================== ROOM MANAGEMENT ====================
const rooms = new Map(); // roomCode -> { players: [ws1, ws2], config: {} }

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal/non-IPv4
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function broadcastToRoom(roomCode, message, excludeWs = null) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const data = JSON.stringify(message);
  for (const player of room.players) {
    if (player !== excludeWs && player.readyState === 1) {
      player.send(data);
    }
  }
}

function removePlayerFromRoom(ws) {
  if (!ws._roomCode) return;
  const roomCode = ws._roomCode;
  const room = rooms.get(roomCode);
  if (!room) return;

  room.players = room.players.filter(p => p !== ws);

  if (room.players.length === 0) {
    // Room empty — destroy it
    rooms.delete(roomCode);
    console.log(`🗑️  Room ${roomCode} destroyed (empty)`);
  } else {
    // Notify remaining player
    broadcastToRoom(roomCode, {
      type: 'OPPONENT_DISCONNECTED'
    });
    console.log(`👤 Player left room ${roomCode} (1 remaining)`);
  }

  ws._roomCode = null;
  ws._playerColor = null;
}

// ==================== WEBSOCKET HANDLERS ====================
wss.on('connection', (ws) => {
  console.log('🔌 New connection');

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {

      // ---------- CREATE ROOM ----------
      case 'CREATE_ROOM': {
        // Clean up any existing room for this socket
        removePlayerFromRoom(ws);

        const code = generateRoomCode();
        const config = msg.config || {};
        // Default to 2 players if not specified
        if (!config.playerCount) config.playerCount = 2;

        const room = {
          players: [ws],
          config: config,
          started: false
        };
        rooms.set(code, room);

        ws._roomCode = code;
        ws._playerColor = 'blue'; // Creator is always blue (Player 1)

        ws.send(JSON.stringify({
          type: 'ROOM_CREATED',
          roomCode: code,
          playerColor: 'blue'
        }));

        console.log(`🏠 Room ${code} created (Capacity: ${config.playerCount})`);
        break;
      }

      // ---------- JOIN ROOM ----------
      case 'JOIN_ROOM': {
        const code = (msg.roomCode || '').toUpperCase().trim();
        const room = rooms.get(code);

        if (!room) {
          ws.send(JSON.stringify({ type: 'JOIN_ERROR', error: 'Room not found' }));
          return;
        }

        if (room.players.length >= room.config.playerCount) {
          ws.send(JSON.stringify({ type: 'JOIN_ERROR', error: 'Room is full' }));
          return;
        }

        // Clean up any existing room for this socket
        removePlayerFromRoom(ws);

        room.players.push(ws);
        ws._roomCode = code;
        
        // Assign color based on join order
        const COLORS = ['blue', 'red', 'green', 'yellow'];
        const assignedColor = COLORS[room.players.length - 1];
        ws._playerColor = assignedColor;

        // Tell the joiner they're in
        ws.send(JSON.stringify({
          type: 'ROOM_JOINED',
          roomCode: code,
          playerColor: assignedColor,
          config: room.config
        }));

        // Broadcast to existing players that someone joined
        broadcastToRoom(code, {
          type: 'PLAYER_JOINED',
          playerColor: assignedColor,
          currentPlayers: room.players.length,
          maxPlayers: room.config.playerCount
        }, ws);

        // Tell everyone the game is starting if full
        if (room.players.length === room.config.playerCount) {
          room.started = true;
          broadcastToRoom(code, {
            type: 'GAME_START',
            config: room.config
          });
          console.log(`🎮 Room ${code} — game starting with ${room.config.playerCount} players!`);
        } else {
          console.log(`👤 Player joined room ${code} (${room.players.length}/${room.config.playerCount})`);
        }
        break;
      }

      // ---------- GAME MOVE ----------
      case 'GAME_MOVE': {
        if (!ws._roomCode) return;
        // Relay the move to the opponent(s)
        broadcastToRoom(ws._roomCode, {
          type: 'OPPONENT_MOVE',
          player: ws._playerColor,
          move: msg.move
        }, ws);
        break;
      }

      // ---------- GAME GIVE UP ----------
      case 'GIVE_UP': {
        if (!ws._roomCode) return;
        broadcastToRoom(ws._roomCode, {
          type: 'OPPONENT_GAVE_UP',
          player: ws._playerColor
        }, ws);
        break;
      }

      // ---------- REMATCH REQUEST ----------
      case 'REMATCH_REQUEST': {
        if (!ws._roomCode) return;
        const room2 = rooms.get(ws._roomCode);
        if (!room2) return;

        if (!room2.rematchVotes) room2.rematchVotes = new Set();
        room2.rematchVotes.add(ws._playerColor);

        if (room2.rematchVotes.size >= room2.config.playerCount) {
          // All players want a rematch
          room2.rematchVotes.clear();
          broadcastToRoom(ws._roomCode, { type: 'REMATCH_ACCEPTED' });
        } else {
          // Tell others about the request
          broadcastToRoom(ws._roomCode, { type: 'REMATCH_REQUESTED', player: ws._playerColor }, ws);
        }
        break;
      }

      // ---------- CHAT / PING ----------
      case 'PING': {
        ws.send(JSON.stringify({ type: 'PONG' }));
        break;
      }
    }
  });

  ws.on('close', () => {
    console.log('🔌 Connection closed');
    removePlayerFromRoom(ws);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    removePlayerFromRoom(ws);
  });
});

// ==================== STARTUP ====================
server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║       🎮 Wrong Way — LAN Server 🎮          ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Local:   http://localhost:${PORT}              ║`);
  console.log(`║  Network: http://${localIP}:${PORT}`.padEnd(47) + '║');
  console.log('║                                              ║');
  console.log('║  Share the Network URL with your friend!     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});

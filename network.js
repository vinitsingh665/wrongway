/* ============================================================
   Wrong Way — Network Module (Client-Side)
   Handles WebSocket connection, room management, and 
   game state synchronization for LAN multiplayer
   ============================================================ */

const Network = (() => {
  let ws = null;
  let roomCode = null;
  let playerColor = null; // 'blue' or 'red'
  let isConnected = false;
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 3;
  let pingInterval = null;

  // Callbacks
  let onRoomCreated = null;
  let onRoomJoined = null;
  let onJoinError = null;
  let onGameStart = null;
  let onOpponentMove = null;
  let onOpponentDisconnected = null;
  let onOpponentGaveUp = null;
  let onRematchRequested = null;
  let onRematchAccepted = null;
  let onConnectionChange = null;
  let onPlayerJoined = null;

  // ==================== CONNECTION ====================
  function connect() {
    return new Promise((resolve, reject) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      // Determine WebSocket URL from current page location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const url = `${protocol}//${host}`;

      try {
        ws = new WebSocket(url);
      } catch (err) {
        reject(err);
        return;
      }

      ws.onopen = () => {
        isConnected = true;
        reconnectAttempts = 0;
        if (onConnectionChange) onConnectionChange(true);
        startPing();
        resolve();
      };

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        handleMessage(msg);
      };

      ws.onclose = () => {
        isConnected = false;
        stopPing();
        if (onConnectionChange) onConnectionChange(false);
      };

      ws.onerror = (err) => {
        isConnected = false;
        stopPing();
        if (onConnectionChange) onConnectionChange(false);
        reject(err);
      };
    });
  }

  function disconnect() {
    stopPing();
    if (ws) {
      ws.close();
      ws = null;
    }
    isConnected = false;
    roomCode = null;
    playerColor = null;
    if (onConnectionChange) onConnectionChange(false);
  }

  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  // ==================== PING / KEEP-ALIVE ====================
  function startPing() {
    stopPing();
    pingInterval = setInterval(() => {
      send({ type: 'PING' });
    }, 25000);
  }

  function stopPing() {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  }

  // ==================== MESSAGE HANDLER ====================
  function handleMessage(msg) {
    switch (msg.type) {
      case 'ROOM_CREATED':
        roomCode = msg.roomCode;
        playerColor = msg.playerColor;
        if (onRoomCreated) onRoomCreated(msg.roomCode, msg.playerColor);
        break;

      case 'ROOM_JOINED':
        roomCode = msg.roomCode;
        playerColor = msg.playerColor;
        if (onRoomJoined) onRoomJoined(msg.roomCode, msg.playerColor);
        break;

      case 'JOIN_ERROR':
        if (onJoinError) onJoinError(msg.error);
        break;

      case 'PLAYER_JOINED':
        if (onPlayerJoined) onPlayerJoined(msg);
        break;

      case 'GAME_START':
        if (onGameStart) onGameStart(msg.config);
        break;

      case 'OPPONENT_MOVE':
        if (onOpponentMove) onOpponentMove(msg.move, msg.player);
        break;

      case 'OPPONENT_DISCONNECTED':
        if (onOpponentDisconnected) onOpponentDisconnected();
        break;

      case 'OPPONENT_GAVE_UP':
        if (onOpponentGaveUp) onOpponentGaveUp(msg.player);
        break;

      case 'REMATCH_REQUESTED':
        if (onRematchRequested) onRematchRequested();
        break;

      case 'REMATCH_ACCEPTED':
        if (onRematchAccepted) onRematchAccepted();
        break;

      case 'PONG':
        // Keep-alive acknowledged
        break;
    }
  }

  // ==================== ROOM ACTIONS ====================
  async function createRoom(config = {}) {
    await connect();
    send({ type: 'CREATE_ROOM', config });
  }

  async function joinRoom(code) {
    await connect();
    send({ type: 'JOIN_ROOM', roomCode: code });
  }

  // ==================== GAME ACTIONS ====================
  function sendMove(move) {
    send({ type: 'GAME_MOVE', move });
  }

  function sendGiveUp() {
    send({ type: 'GIVE_UP' });
  }

  function sendRematchRequest() {
    send({ type: 'REMATCH_REQUEST' });
  }

  // ==================== GETTERS ====================
  function getRoomCode() { return roomCode; }
  function getPlayerColor() { return playerColor; }
  function getIsConnected() { return isConnected; }
  function isOnline() { return isConnected && roomCode !== null; }
  function isMyTurn(currentPlayer) {
    if (!playerColor) return true; // Not in online mode
    return currentPlayer === playerColor;
  }

  function getShareableLink() {
    if (!roomCode) return '';
    return `${window.location.origin}?room=${roomCode}`;
  }

  // ==================== PUBLIC API ====================
  return {
    connect,
    disconnect,
    createRoom,
    joinRoom,
    sendMove,
    sendGiveUp,
    sendRematchRequest,
    getRoomCode,
    getPlayerColor,
    getIsConnected,
    isOnline,
    isMyTurn,
    getShareableLink,

    // Callback setters
    set onRoomCreated(fn) { onRoomCreated = fn; },
    set onRoomJoined(fn) { onRoomJoined = fn; },
    set onJoinError(fn) { onJoinError = fn; },
    set onPlayerJoined(fn) { onPlayerJoined = fn; },
    set onGameStart(fn) { onGameStart = fn; },
    set onOpponentMove(fn) { onOpponentMove = fn; },
    set onOpponentDisconnected(fn) { onOpponentDisconnected = fn; },
    set onOpponentGaveUp(fn) { onOpponentGaveUp = fn; },
    set onRematchRequested(fn) { onRematchRequested = fn; },
    set onRematchAccepted(fn) { onRematchAccepted = fn; },
    set onConnectionChange(fn) { onConnectionChange = fn; }
  };
})();

/* ============================================================
   Wrong Way — Advanced AI Worker Engine
   Tournament-grade Quoridor AI (3000 Elo Target)
   ============================================================ */

const GRID = 9;
const PLAYERS = { BLUE: 'blue', RED: 'red' };

const AI_DIFFICULTIES = [
  { name: 'Beginner', depth: 1, timeMs: 200, wallPrune: 2 },
  { name: 'Easy',     depth: 2, timeMs: 300, wallPrune: 4 },
  { name: 'Medium',   depth: 3, timeMs: 400, wallPrune: 6 },
  { name: 'Hard',     depth: 4, timeMs: 800, wallPrune: 8 },
  { name: 'Expert',   depth: 5, timeMs: 1500, wallPrune: 12 },
  { name: 'Legendary',depth: 6, timeMs: 2000, wallPrune: 16 }
];

// ==================== ZOBRIST HASHING ====================
const zobristTable = { pieces: { blue: [], red: [] }, walls: [], side: 0 };
let zobristInitialized = false;

function randomU32() { return (Math.random() * 0xFFFFFFFF) >>> 0; }

function initZobrist() {
  if (zobristInitialized) return;
  for (let r = 0; r < 21; r++) {
    zobristTable.pieces.blue[r] = [];
    zobristTable.pieces.red[r] = [];
    for (let c = 0; c < 21; c++) {
      zobristTable.pieces.blue[r][c] = randomU32() ^ (randomU32() << 16);
      zobristTable.pieces.red[r][c] = randomU32() ^ (randomU32() << 16);
    }
  }
  for (let r = 0; r < 20; r++) {
    zobristTable.walls[r] = [];
    for (let c = 0; c < 20; c++) {
      zobristTable.walls[r][c] = {
        h: randomU32() ^ (randomU32() << 16),
        v: randomU32() ^ (randomU32() << 16)
      };
    }
  }
  zobristTable.side = randomU32() ^ (randomU32() << 16);
  zobristInitialized = true;
}

// ==================== ENGINE STATE ====================
let edges = new Uint8Array(GRID * GRID * 2);

const engineState = {
  pieces: { blue: {row: 8, col: 4}, red: {row: 0, col: 4} },
  wallCounts: { blue: 10, red: 10 },
  walls: [],
  currentPlayer: PLAYERS.BLUE,
  hash: 0,
  blueDist: 8,
  redDist: 8
};

function isBlockedFast(r1, c1, r2, c2) {
  if (r2 === r1 + 1) return edges[(r1 * GRID + c1) * 2 + 1];
  if (r2 === r1 - 1) return edges[(r2 * GRID + c1) * 2 + 1];
  if (c2 === c1 + 1) return edges[(r1 * GRID + c1) * 2 + 0];
  if (c2 === c1 - 1) return edges[(r1 * GRID + c2) * 2 + 0];
  return 0;
}

function setWallEdges(r, c, orientation, val) {
  const v = val ? 1 : 0;
  if (orientation === 'h') {
    edges[(r * GRID + c) * 2 + 1] = v;
    edges[(r * GRID + (c + 1)) * 2 + 1] = v;
  } else {
    edges[(r * GRID + c) * 2 + 0] = v;
    edges[((r + 1) * GRID + c) * 2 + 0] = v;
  }
}

// ==================== MAKE / UNDO MOVE ====================
function makeMove(move) {
  const undoData = {
    prevHash: engineState.hash,
    prevBlueDist: engineState.blueDist,
    prevRedDist: engineState.redDist,
    move: move,
    player: engineState.currentPlayer,
    prevRow: 0, prevCol: 0
  };

  const p = engineState.currentPlayer;
  
  if (move.type === 'move') {
    undoData.prevRow = engineState.pieces[p].row;
    undoData.prevCol = engineState.pieces[p].col;
    engineState.hash ^= zobristTable.pieces[p][undoData.prevRow][undoData.prevCol];
    engineState.pieces[p].row = move.row;
    engineState.pieces[p].col = move.col;
    engineState.hash ^= zobristTable.pieces[p][move.row][move.col];
    
    if (p === PLAYERS.BLUE) {
        engineState.blueDist = bfsShortestPath(move.row, move.col, 0);
    } else {
        engineState.redDist = bfsShortestPath(move.row, move.col, GRID - 1);
    }
  } else if (move.type === 'wall') {
    engineState.walls.push(move);
    engineState.wallCounts[p]--;
    setWallEdges(move.row, move.col, move.orientation, true);
    engineState.hash ^= zobristTable.walls[move.row][move.col][move.orientation];
    
    engineState.blueDist = bfsShortestPath(engineState.pieces.blue.row, engineState.pieces.blue.col, 0);
    engineState.redDist = bfsShortestPath(engineState.pieces.red.row, engineState.pieces.red.col, GRID - 1);
  }

  engineState.currentPlayer = p === PLAYERS.BLUE ? PLAYERS.RED : PLAYERS.BLUE;
  engineState.hash ^= zobristTable.side;

  return undoData;
}

function undoMove(undoData) {
  const p = undoData.player;
  const move = undoData.move;

  engineState.blueDist = undoData.prevBlueDist;
  engineState.redDist = undoData.prevRedDist;
  engineState.hash = undoData.prevHash;
  engineState.currentPlayer = p;

  if (move.type === 'move') {
    engineState.pieces[p].row = undoData.prevRow;
    engineState.pieces[p].col = undoData.prevCol;
  } else if (move.type === 'wall') {
    engineState.walls.pop();
    engineState.wallCounts[p]++;
    setWallEdges(move.row, move.col, move.orientation, false);
  }
}

// ==================== BFS SHORTEST PATH ====================
const bfsVisited = new Uint16Array(GRID * GRID);
let bfsEpoch = 0;
const bfsQueue = new Int8Array(GRID * GRID * 3);
const bfsParent = new Int16Array(GRID * GRID);

function bfsShortestPath(startRow, startCol, goalRow) {
  bfsEpoch++;
  if (bfsEpoch > 65000) { bfsVisited.fill(0); bfsEpoch = 1; }
  let head = 0, tail = 0;
  bfsQueue[tail++] = startRow; bfsQueue[tail++] = startCol; bfsQueue[tail++] = 0;
  bfsVisited[startRow * GRID + startCol] = bfsEpoch;

  while (head < tail) {
    const r = bfsQueue[head++];
    const c = bfsQueue[head++];
    const d = bfsQueue[head++];
    if (r === goalRow) return d;
    
    if (r > 0 && bfsVisited[(r - 1) * GRID + c] !== bfsEpoch && !isBlockedFast(r, c, r - 1, c)) {
      bfsVisited[(r - 1) * GRID + c] = bfsEpoch;
      bfsQueue[tail++] = r - 1; bfsQueue[tail++] = c; bfsQueue[tail++] = d + 1;
    }
    if (r < GRID - 1 && bfsVisited[(r + 1) * GRID + c] !== bfsEpoch && !isBlockedFast(r, c, r + 1, c)) {
      bfsVisited[(r + 1) * GRID + c] = bfsEpoch;
      bfsQueue[tail++] = r + 1; bfsQueue[tail++] = c; bfsQueue[tail++] = d + 1;
    }
    if (c > 0 && bfsVisited[r * GRID + c - 1] !== bfsEpoch && !isBlockedFast(r, c, r, c - 1)) {
      bfsVisited[r * GRID + c - 1] = bfsEpoch;
      bfsQueue[tail++] = r; bfsQueue[tail++] = c - 1; bfsQueue[tail++] = d + 1;
    }
    if (c < GRID - 1 && bfsVisited[r * GRID + c + 1] !== bfsEpoch && !isBlockedFast(r, c, r, c + 1)) {
      bfsVisited[r * GRID + c + 1] = bfsEpoch;
      bfsQueue[tail++] = r; bfsQueue[tail++] = c + 1; bfsQueue[tail++] = d + 1;
    }
  }
  return 999;
}

function bfsTracePath(startRow, startCol, goalRow) {
  bfsEpoch++;
  if (bfsEpoch > 65000) { bfsVisited.fill(0); bfsEpoch = 1; }
  let head = 0, tail = 0;
  
  bfsQueue[tail++] = startRow; bfsQueue[tail++] = startCol;
  const startIdx = startRow * GRID + startCol;
  bfsVisited[startIdx] = bfsEpoch;
  bfsParent[startIdx] = -1;
  let goalIdx = -1;

  while (head < tail) {
    const r = bfsQueue[head++];
    const c = bfsQueue[head++];
    const idx = r * GRID + c;
    if (r === goalRow) { goalIdx = idx; break; }
    
    if (r > 0 && bfsVisited[(r - 1) * GRID + c] !== bfsEpoch && !isBlockedFast(r, c, r - 1, c)) {
      const nIdx = (r - 1) * GRID + c;
      bfsVisited[nIdx] = bfsEpoch; bfsParent[nIdx] = idx;
      bfsQueue[tail++] = r - 1; bfsQueue[tail++] = c;
    }
    if (r < GRID - 1 && bfsVisited[(r + 1) * GRID + c] !== bfsEpoch && !isBlockedFast(r, c, r + 1, c)) {
      const nIdx = (r + 1) * GRID + c;
      bfsVisited[nIdx] = bfsEpoch; bfsParent[nIdx] = idx;
      bfsQueue[tail++] = r + 1; bfsQueue[tail++] = c;
    }
    if (c > 0 && bfsVisited[r * GRID + c - 1] !== bfsEpoch && !isBlockedFast(r, c, r, c - 1)) {
      const nIdx = r * GRID + c - 1;
      bfsVisited[nIdx] = bfsEpoch; bfsParent[nIdx] = idx;
      bfsQueue[tail++] = r; bfsQueue[tail++] = c - 1;
    }
    if (c < GRID - 1 && bfsVisited[r * GRID + c + 1] !== bfsEpoch && !isBlockedFast(r, c, r, c + 1)) {
      const nIdx = r * GRID + c + 1;
      bfsVisited[nIdx] = bfsEpoch; bfsParent[nIdx] = idx;
      bfsQueue[tail++] = r; bfsQueue[tail++] = c + 1;
    }
  }

  const path = [];
  if (goalIdx === -1) return path;
  let cur = goalIdx;
  while (cur !== -1) {
    path.unshift({ row: Math.floor(cur / GRID), col: cur % GRID });
    cur = bfsParent[cur];
  }
  return path;
}

// ==================== FAST WALL VALIDATION ====================
function canPlaceWallFast(row, col, orientation) {
  if (row < 0 || row >= GRID - 1 || col < 0 || col >= GRID - 1) return false;
  // Overlap check
  for (const w of engineState.walls) {
    if (w.row === row && w.col === col) return false;
    if (orientation === 'h' && w.orientation === 'h' && w.row === row && Math.abs(w.col - col) < 2) return false;
    if (orientation === 'v' && w.orientation === 'v' && w.col === col && Math.abs(w.row - row) < 2) return false;
  }
  
  setWallEdges(row, col, orientation, true);
  const bluePath = bfsShortestPath(engineState.pieces.blue.row, engineState.pieces.blue.col, 0);
  const redPath = bfsShortestPath(engineState.pieces.red.row, engineState.pieces.red.col, GRID - 1);
  setWallEdges(row, col, orientation, false);
  
  return bluePath < 999 && redPath < 999;
}

// ==================== GENERATE MOVES ====================
function generateMoves(forPlayer, isRoot, config) {
  const moves = [];
  const p = forPlayer;
  const opp = p === PLAYERS.BLUE ? PLAYERS.RED : PLAYERS.BLUE;
  const pos = engineState.pieces[p];
  const opPos = engineState.pieces[opp];

  // 1. Move piece
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of dirs) {
    const nr = pos.row + dr;
    const nc = pos.col + dc;
    if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
    if (isBlockedFast(pos.row, pos.col, nr, nc)) continue;

    if (nr === opPos.row && nc === opPos.col) {
      const jr = nr + dr, jc = nc + dc;
      if (jr >= 0 && jr < GRID && jc >= 0 && jc < GRID && !isBlockedFast(nr, nc, jr, jc)) {
        moves.push({ type: 'move', row: jr, col: jc });
      } else {
        const sideDirs = dr !== 0 ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
        for (const [sdr, sdc] of sideDirs) {
          const sr = nr + sdr, sc = nc + sdc;
          if (sr >= 0 && sr < GRID && sc >= 0 && sc < GRID && !isBlockedFast(nr, nc, sr, sc)) {
            moves.push({ type: 'move', row: sr, col: sc });
          }
        }
      }
    } else {
      moves.push({ type: 'move', row: nr, col: nc });
    }
  }

  // 2. Wall placements (pruned heavily)
  if (engineState.wallCounts[p] > 0 && isRoot && config && config.wallPrune) {
    const goalOpp = opp === PLAYERS.BLUE ? 0 : GRID - 1;
    const oppPath = bfsTracePath(opPos.row, opPos.col, goalOpp);
    const candidates = [];
    const seen = new Set();
    
    for (let i = 0; i < oppPath.length - 1; i++) {
      const cr = oppPath[i].row, cc = oppPath[i].col;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const ir = cr + dr, ic = cc + dc;
          if (ir >= 0 && ir < GRID - 1 && ic >= 0 && ic < GRID - 1) {
            for (const ori of ['h', 'v']) {
              const key = `${ir},${ic},${ori}`;
              if (!seen.has(key)) {
                seen.add(key);
                if (canPlaceWallFast(ir, ic, ori)) {
                  setWallEdges(ir, ic, ori, true);
                  const newOppPath = bfsShortestPath(opPos.row, opPos.col, goalOpp);
                  setWallEdges(ir, ic, ori, false);
                  
                  const increase = newOppPath - (opp === PLAYERS.BLUE ? engineState.blueDist : engineState.redDist);
                  if (increase > 0) {
                    candidates.push({ row: ir, col: ic, orientation: ori, score: increase, type: 'wall' });
                  }
                }
              }
            }
          }
        }
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    for (const cw of candidates.slice(0, config.wallPrune)) {
      moves.push(cw);
    }
  }
  return moves;
}

// ==================== EVALUATION ====================
function evaluate() {
  if (engineState.pieces.red.row === GRID - 1) return 10000;
  if (engineState.pieces.blue.row === 0) return -10000;

  const redPath = engineState.redDist;
  const bluePath = engineState.blueDist;

  let score = 0;
  // Primary: path difference
  score += (bluePath - redPath) * 100;
  // Secondary: wall count advantage
  score += (engineState.wallCounts.red - engineState.wallCounts.blue) * 15;
  
  // Tie breakers
  const redProgress = (GRID - 1 - Math.abs(engineState.pieces.red.row - (GRID - 1))) / (GRID - 1);
  const blueProgress = (GRID - 1 - Math.abs(engineState.pieces.blue.row - 0)) / (GRID - 1);
  score += (redProgress - blueProgress) * 30;

  if (redPath <= 2) score += (3 - redPath) * 150;
  if (bluePath <= 2) score -= (3 - bluePath) * 150;

  if (engineState.wallCounts.blue === 0) score += 50;
  if (engineState.wallCounts.red === 0) score -= 40;

  return score;
}

// ==================== TRANSPOSITION TABLE ====================
const TT_SIZE = 1 << 18; // ~256k
const TT_EXACT = 0, TT_ALPHA = 1, TT_BETA = 2;
let ttable = new Array(TT_SIZE);

function ttLookup(hash, depth, alpha, beta) {
  const entry = ttable[hash % TT_SIZE];
  if (!entry || entry.hash !== hash) return null;
  if (entry.depth < depth) return null;
  if (entry.flag === TT_EXACT) return entry;
  if (entry.flag === TT_BETA && entry.score >= beta) return entry;
  if (entry.flag === TT_ALPHA && entry.score <= alpha) return entry;
  return null;
}

function ttStore(hash, depth, score, flag, bestMove) {
  const idx = hash % TT_SIZE;
  const existing = ttable[idx];
  if (!existing || existing.depth <= depth || existing.hash === hash) {
    ttable[idx] = { hash, depth, score, flag, bestMove };
  }
}

// ==================== MOVE ORDERING ====================
const killerMoves = [];
for (let i = 0; i < 64; i++) killerMoves.push([null, null]);
let historyTable = {};

function getMoveHash(m) {
  return m.type === 'move' ? `m${m.row},${m.col}` : `w${m.row},${m.col},${m.orientation}`;
}

function orderMoves(moves, ttEntry, ply) {
  for (const m of moves) {
    m._score = 0;
    if (ttEntry && ttEntry.bestMove && ttEntry.bestMove.type === m.type && ttEntry.bestMove.row === m.row && ttEntry.bestMove.col === m.col) {
      m._score += 100000;
    } else if (m.type === 'move' && m.row === (engineState.currentPlayer === PLAYERS.RED ? GRID - 1 : 0)) {
      m._score += 50000; // winning move
    } else if (killerMoves[ply] && killerMoves[ply][0] && killerMoves[ply][0].type === m.type && killerMoves[ply][0].row === m.row && killerMoves[ply][0].col === m.col) {
      m._score += 10000;
    } else if (killerMoves[ply] && killerMoves[ply][1] && killerMoves[ply][1].type === m.type && killerMoves[ply][1].row === m.row && killerMoves[ply][1].col === m.col) {
      m._score += 9000;
    } else {
      const hHash = getMoveHash(m);
      m._score += (historyTable[hHash] || 0);
      if (m.type === 'wall' && m.score) m._score += m.score * 500;
    }
  }
  moves.sort((a, b) => b._score - a._score);
}

// ==================== SEARCH (PVS) ====================
let searchNodes = 0;
let searchStart = 0;
let searchTimeLimit = 0;
let searchAborted = false;

function pvs(depth, alpha, beta, ply) {
  searchNodes++;
  if ((searchNodes & 2047) === 0) {
    if (Date.now() - searchStart > searchTimeLimit) { searchAborted = true; return 0; }
  }
  if (searchAborted) return 0;

  if (engineState.pieces.red.row === GRID - 1) return 10000 + depth;
  if (engineState.pieces.blue.row === 0) return -10000 - depth;

  const ttEntry = ttLookup(engineState.hash, depth, alpha, beta);
  if (ttEntry && ttEntry.flag === TT_EXACT) return ttEntry.score;
  if (ttEntry && ttEntry.flag === TT_BETA && ttEntry.score >= beta) return ttEntry.score;
  if (ttEntry && ttEntry.flag === TT_ALPHA && ttEntry.score <= alpha) return ttEntry.score;

  if (depth <= 0) return evaluate();

  const moves = generateMoves(engineState.currentPlayer, false, null);
  if (moves.length === 0) return evaluate();
  orderMoves(moves, ttEntry, ply);

  const maximizing = engineState.currentPlayer === PLAYERS.RED;
  let bestScore = maximizing ? -Infinity : Infinity;
  let bestMove = moves[0];
  let flag = maximizing ? TT_ALPHA : TT_BETA;
  let bSearchPv = true;

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    
    // LMR
    let R = 0;
    if (depth > 2 && i > 3 && move.type === 'move' && !bSearchPv) {
      R = 1;
    }

    const undoData = makeMove(move);
    let score;

    if (bSearchPv) {
      score = pvs(depth - 1 - R, alpha, beta, ply + 1);
    } else {
      // Zero-window search
      if (maximizing) {
        score = pvs(depth - 1 - R, alpha, alpha + 1, ply + 1);
        if (score > alpha && score < beta) {
           score = pvs(depth - 1, alpha, beta, ply + 1); // Re-search
        }
      } else {
        score = pvs(depth - 1 - R, beta - 1, beta, ply + 1);
        if (score > alpha && score < beta) {
           score = pvs(depth - 1, alpha, beta, ply + 1); // Re-search
        }
      }
    }
    
    undoMove(undoData);
    if (searchAborted) return 0;

    if (maximizing) {
      if (score > bestScore) {
        bestScore = score; bestMove = move;
        if (score > alpha) { alpha = score; flag = TT_EXACT; bSearchPv = false; }
      }
      if (alpha >= beta) {
        if (move.type === 'move') {
          killerMoves[ply][1] = killerMoves[ply][0]; killerMoves[ply][0] = move;
          const hHash = getMoveHash(move); historyTable[hHash] = (historyTable[hHash] || 0) + depth * depth;
        }
        break;
      }
    } else {
      if (score < bestScore) {
        bestScore = score; bestMove = move;
        if (score < beta) { beta = score; flag = TT_EXACT; bSearchPv = false; }
      }
      if (alpha >= beta) {
        if (move.type === 'move') {
          killerMoves[ply][1] = killerMoves[ply][0]; killerMoves[ply][0] = move;
          const hHash = getMoveHash(move); historyTable[hHash] = (historyTable[hHash] || 0) + depth * depth;
        }
        break;
      }
    }
  }

  ttStore(engineState.hash, depth, bestScore, flag, bestMove);
  return bestScore;
}

// ==================== ENDGAME SOLVER ====================
function endgameSolver() {
  const redGoal = GRID - 1;
  const oppPath = bfsTracePath(engineState.pieces.red.row, engineState.pieces.red.col, redGoal);
  if (oppPath.length > 1) {
    return { type: 'move', row: oppPath[1].row, col: oppPath[1].col };
  }
  return null;
}

// ==================== ITERATIVE DEEPENING ROOT ====================
function iterativeDeepening(diffConfig) {
  initZobrist();
  historyTable = {};
  for(let i=0; i<64; i++) killerMoves[i] = [null, null];
  
  searchNodes = 0;
  searchStart = Date.now();
  searchTimeLimit = diffConfig.timeMs;
  searchAborted = false;

  if (engineState.wallCounts.blue === 0 && engineState.wallCounts.red === 0) {
    const egMove = endgameSolver();
    if (egMove) return egMove;
  }

  let bestMove = null;
  let alpha = -Infinity, beta = Infinity;
  let prevScore = 0;
  const maxDepth = diffConfig.depth;

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (searchAborted) break;

    // Aspiration Windows
    if (depth > 2) {
      alpha = prevScore - 50;
      beta = prevScore + 50;
    }

    let bSearchPv = true;
    let depthBestScore = -Infinity;
    let depthBestMove = null;
    let moves = generateMoves(PLAYERS.RED, true, diffConfig);
    if (moves.length === 0) break;
    orderMoves(moves, ttLookup(engineState.hash, 0, -Infinity, Infinity), 0);

    for (let i = 0; i < moves.length; i++) {
      if (searchAborted) break;
      const move = moves[i];
      const undoData = makeMove(move);
      let score;

      while (true) {
        if (bSearchPv) {
          score = pvs(depth - 1, alpha, beta, 1);
        } else {
          score = pvs(depth - 1, alpha, alpha + 1, 1);
          if (score > alpha && score < beta) {
            score = pvs(depth - 1, alpha, beta, 1);
          }
        }
        
        // Handle aspiration window fail high/low
        if (score <= alpha && depth > 2 && alpha > -9000) { alpha = -Infinity; bSearchPv = true; continue; }
        if (score >= beta && depth > 2 && beta < 9000) { beta = Infinity; bSearchPv = true; continue; }
        break;
      }

      undoMove(undoData);
      if (searchAborted) break;

      if (score > depthBestScore) {
        depthBestScore = score;
        depthBestMove = move;
        if (score > alpha) { alpha = score; bSearchPv = false; }
      }
    }

    if (!searchAborted && depthBestMove) {
      bestMove = depthBestMove;
      prevScore = depthBestScore;
      ttStore(engineState.hash, depth, depthBestScore, TT_EXACT, depthBestMove);
      if (depthBestScore >= 9000) break;
    }
  }

  return bestMove || generateMoves(PLAYERS.RED, true, diffConfig)[0];
}

// ==================== WORKER API ====================
self.onmessage = function(e) {
  const msg = e.data;
  if (msg.type === 'START_SEARCH') {
    const st = msg.state;
    // Load state into engine
    edges.fill(0);
    engineState.pieces.blue = { ...st.pieces.blue };
    engineState.pieces.red = { ...st.pieces.red };
    engineState.wallCounts.blue = st.wallCounts.blue;
    engineState.wallCounts.red = st.wallCounts.red;
    engineState.walls = [...st.walls];
    engineState.currentPlayer = PLAYERS.RED;
    
    // Reconstruct edges
    for (const w of engineState.walls) {
      setWallEdges(w.row, w.col, w.orientation, true);
    }
    
    // Compute initial hash
    initZobrist();
    engineState.hash = 0;
    engineState.hash ^= zobristTable.pieces.blue[engineState.pieces.blue.row][engineState.pieces.blue.col];
    engineState.hash ^= zobristTable.pieces.red[engineState.pieces.red.row][engineState.pieces.red.col];
    for (const w of engineState.walls) {
      engineState.hash ^= zobristTable.walls[w.row][w.col][w.orientation];
    }
    engineState.hash ^= zobristTable.side;
    
    // Compute initial dists
    engineState.blueDist = bfsShortestPath(engineState.pieces.blue.row, engineState.pieces.blue.col, 0);
    engineState.redDist = bfsShortestPath(engineState.pieces.red.row, engineState.pieces.red.col, GRID - 1);

    const diff = AI_DIFFICULTIES[msg.difficulty || 2];
    
    // Run search
    const move = iterativeDeepening(diff);
    
    // Send back result
    self.postMessage({
      type: 'SEARCH_RESULT',
      move: move,
      nodes: searchNodes,
      time: Date.now() - searchStart
    });
  }
};

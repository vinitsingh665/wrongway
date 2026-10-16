/* ============================================================
   Wrong Way — Advanced AI Engine
   Tournament-grade Quoridor AI using:
   • Minimax with Alpha-Beta Pruning
   • Iterative Deepening
   • Move Ordering (killer moves, history heuristic)
   • Transposition Table (Zobrist Hashing)
   • Quiescence Search (win-threat extension)
   • Advanced Evaluation Function
   • Smart Wall Pruning (path-critical walls only)
   ============================================================ */

const AI_DIFFICULTIES = [
  { name: 'Beginner', icon: '🌱', desc: 'Learning the ropes', depth: 0, noise: 40, wallPrune: 3, timeMs: 200 },
  { name: 'Easy',     icon: '🌿', desc: 'Casual challenge',  depth: 1, noise: 20, wallPrune: 4, timeMs: 300 },
  { name: 'Medium',   icon: '⚡', desc: 'Balanced match',     depth: 2, noise: 8,  wallPrune: 6, timeMs: 400 },
  { name: 'Hard',     icon: '🔥', desc: 'Serious competition',depth: 3, noise: 3,  wallPrune: 8, timeMs: 800 },
  { name: 'Expert',   icon: '💎', desc: 'Near-perfect play',  depth: 4, noise: 0,  wallPrune: 12, timeMs: 1500 },
  { name: 'Legendary',icon: '💀', desc: 'Almost impossible',  depth: 5, noise: 0,  wallPrune: 16, timeMs: 2000 }
];

// ==================== ZOBRIST HASHING ====================
const zobristTable = {};
let zobristInitialized = false;

function initZobrist() {
  if (zobristInitialized) return;
  zobristInitialized = false; // Will re-init on grid change

  // Piece positions: 2 players × GRID × GRID
  zobristTable.pieces = {};
  for (const p of ['blue', 'red']) {
    zobristTable.pieces[p] = [];
    for (let r = 0; r < 21; r++) {
      zobristTable.pieces[p][r] = [];
      for (let c = 0; c < 21; c++) {
        zobristTable.pieces[p][r][c] = randomU32() ^ (randomU32() << 16);
      }
    }
  }

  // Wall positions: row × col × 2 orientations
  zobristTable.walls = [];
  for (let r = 0; r < 20; r++) {
    zobristTable.walls[r] = [];
    for (let c = 0; c < 20; c++) {
      zobristTable.walls[r][c] = {
        h: randomU32() ^ (randomU32() << 16),
        v: randomU32() ^ (randomU32() << 16)
      };
    }
  }

  // Side to move
  zobristTable.side = randomU32() ^ (randomU32() << 16);
  zobristInitialized = true;
}

function randomU32() {
  return (Math.random() * 0xFFFFFFFF) >>> 0;
}

function computeHash(state) {
  let h = 0;
  h ^= zobristTable.pieces.blue[state.pieces.blue.row][state.pieces.blue.col];
  h ^= zobristTable.pieces.red[state.pieces.red.row][state.pieces.red.col];
  for (const w of state.walls) {
    if (w.row < 20 && w.col < 20) {
      h ^= zobristTable.walls[w.row][w.col][w.orientation];
    }
  }
  if (state.currentPlayer === PLAYERS.RED) h ^= zobristTable.side;
  return h >>> 0;
}

// ==================== TRANSPOSITION TABLE ====================
const TT_SIZE = 1 << 18; // 262144 entries
const TT_EXACT = 0;
const TT_ALPHA = 1; // Upper bound
const TT_BETA = 2;  // Lower bound
let ttable = new Array(TT_SIZE);

function ttLookup(hash, depth, alpha, beta) {
  const idx = hash % TT_SIZE;
  const entry = ttable[idx];
  if (!entry || entry.hash !== hash) return null;
  if (entry.depth < depth) return null;

  if (entry.flag === TT_EXACT) return entry;
  if (entry.flag === TT_BETA && entry.score >= beta) return entry;
  if (entry.flag === TT_ALPHA && entry.score <= alpha) return entry;
  return null; // Return entry for move ordering even if score not usable
}

function ttStore(hash, depth, score, flag, bestMove) {
  const idx = hash % TT_SIZE;
  const existing = ttable[idx];
  // Replace if empty or deeper search or same hash
  if (!existing || existing.depth <= depth || existing.hash === hash) {
    ttable[idx] = { hash, depth, score, flag, bestMove };
  }
}

// ==================== BFS SHORTEST PATH (Optimized) ====================
function bfsShortestPath(startRow, startCol, goalRow, wallSet) {
  // Use typed array for visited (faster than Set)
  const visited = new Uint8Array(GRID * GRID);
  const queue = [];
  let head = 0;

  const startIdx = startRow * GRID + startCol;
  visited[startIdx] = 1;
  queue.push(startRow, startCol, 0); // row, col, dist stored flat

  while (head < queue.length) {
    const r = queue[head++];
    const c = queue[head++];
    const d = queue[head++];

    if (r === goalRow) return d;

    // Up
    if (r > 0 && !visited[(r - 1) * GRID + c] && !isBlockedFast(r, c, r - 1, c, wallSet)) {
      visited[(r - 1) * GRID + c] = 1;
      queue.push(r - 1, c, d + 1);
    }
    // Down
    if (r < GRID - 1 && !visited[(r + 1) * GRID + c] && !isBlockedFast(r, c, r + 1, c, wallSet)) {
      visited[(r + 1) * GRID + c] = 1;
      queue.push(r + 1, c, d + 1);
    }
    // Left
    if (c > 0 && !visited[r * GRID + c - 1] && !isBlockedFast(r, c, r, c - 1, wallSet)) {
      visited[r * GRID + c - 1] = 1;
      queue.push(r, c - 1, d + 1);
    }
    // Right
    if (c < GRID - 1 && !visited[r * GRID + c + 1] && !isBlockedFast(r, c, r, c + 1, wallSet)) {
      visited[r * GRID + c + 1] = 1;
      queue.push(r, c + 1, d + 1);
    }
  }
  return 999;
}

// ==================== FAST WALL BLOCKING ====================
// Pre-built wall lookup for O(1) blocking checks
let wallBlockSet = null;

function buildWallBlockSet(walls) {
  const set = new Set();
  for (const w of walls) {
    if (w.orientation === 'h') {
      // Horizontal wall at intersection (r,c) blocks vertical movement
      // between row r and r+1 at columns c and c+1
      set.add(encodeBlock(w.row, w.col, w.row + 1, w.col));
      set.add(encodeBlock(w.row + 1, w.col, w.row, w.col));
      set.add(encodeBlock(w.row, w.col + 1, w.row + 1, w.col + 1));
      set.add(encodeBlock(w.row + 1, w.col + 1, w.row, w.col + 1));
    } else {
      // Vertical wall blocks horizontal movement
      set.add(encodeBlock(w.row, w.col, w.row, w.col + 1));
      set.add(encodeBlock(w.row, w.col + 1, w.row, w.col));
      set.add(encodeBlock(w.row + 1, w.col, w.row + 1, w.col + 1));
      set.add(encodeBlock(w.row + 1, w.col + 1, w.row + 1, w.col));
    }
  }
  return set;
}

function encodeBlock(fr, fc, tr, tc) {
  return (fr << 24) | (fc << 16) | (tr << 8) | tc;
}

function isBlockedFast(fr, fc, tr, tc, wallSet) {
  return wallSet.has(encodeBlock(fr, fc, tr, tc));
}

// ==================== PATH-CRITICAL WALL PRUNING ====================
// Only consider walls that intersect the opponent's shortest path
function getPathCriticalWalls(player, walls, pieces, maxWalls) {
  const opponent = player === PLAYERS.BLUE ? PLAYERS.RED : PLAYERS.BLUE;
  const oppPos = pieces[opponent];
  const goalRow = getGoalRow(opponent);
  const wallSet = buildWallBlockSet(walls);

  // Trace opponent's shortest path
  const pathCells = bfsTracePath(oppPos.row, oppPos.col, goalRow, wallSet);

  // Also trace our path for defensive walls
  const myPos = pieces[player];
  const myGoalRow = getGoalRow(player);
  const myPathCells = bfsTracePath(myPos.row, myPos.col, myGoalRow, wallSet);

  // Generate walls near the opponent's path
  const candidates = [];
  const seen = new Set();

  // Walls that cross opponent's path edges
  for (let i = 0; i < pathCells.length - 1; i++) {
    const cr = pathCells[i].row;
    const cc = pathCells[i].col;
    const nr = pathCells[i + 1].row;
    const nc = pathCells[i + 1].col;

    // Try walls at intersections near this path edge
    const nearIntersections = getNearIntersections(cr, cc, nr, nc);
    for (const ni of nearIntersections) {
      for (const ori of ['h', 'v']) {
        const key = `${ni.row},${ni.col},${ori}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (canPlaceWallFast(ni.row, ni.col, ori, walls, wallSet, pieces)) {
          // Check if this wall actually increases opponent's path
          const newWalls = [...walls, { row: ni.row, col: ni.col, orientation: ori, player }];
          const newWallSet = buildWallBlockSet(newWalls);
          const newOppPath = bfsShortestPath(oppPos.row, oppPos.col, goalRow, newWallSet);
          const oldOppPath = bfsShortestPath(oppPos.row, oppPos.col, goalRow, wallSet);
          const pathIncrease = newOppPath - oldOppPath;
          if (pathIncrease > 0) {
            candidates.push({
              row: ni.row, col: ni.col, orientation: ori,
              score: pathIncrease
            });
          }
        }
      }
    }
  }

  // Sort by effectiveness and return top N
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, maxWalls);
}

function getNearIntersections(r1, c1, r2, c2) {
  const intersections = [];
  // Intersections are at grid points between cells
  const minR = Math.min(r1, r2);
  const minC = Math.min(c1, c2);

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const ir = minR + dr;
      const ic = minC + dc;
      if (ir >= 0 && ir < GRID - 1 && ic >= 0 && ic < GRID - 1) {
        intersections.push({ row: ir, col: ic });
      }
    }
  }
  return intersections;
}

function bfsTracePath(startRow, startCol, goalRow, wallSet) {
  const visited = new Uint8Array(GRID * GRID);
  const parent = new Int16Array(GRID * GRID).fill(-1);
  const queue = [];
  let head = 0;

  const startIdx = startRow * GRID + startCol;
  visited[startIdx] = 1;
  queue.push(startRow, startCol);

  let goalIdx = -1;

  while (head < queue.length) {
    const r = queue[head++];
    const c = queue[head++];
    const idx = r * GRID + c;

    if (r === goalRow) {
      goalIdx = idx;
      break;
    }

    const neighbors = [
      [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]
    ];

    for (const [nr, nc] of neighbors) {
      if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
      const nIdx = nr * GRID + nc;
      if (visited[nIdx]) continue;
      if (isBlockedFast(r, c, nr, nc, wallSet)) continue;
      visited[nIdx] = 1;
      parent[nIdx] = idx;
      queue.push(nr, nc);
    }
  }

  // Reconstruct path
  const path = [];
  if (goalIdx === -1) return path;

  let cur = goalIdx;
  while (cur !== -1) {
    path.unshift({ row: Math.floor(cur / GRID), col: cur % GRID });
    cur = parent[cur];
  }
  return path;
}

// ==================== FAST WALL VALIDATION ====================
function canPlaceWallFast(row, col, orientation, walls, wallSet, pieces) {
  if (row < 0 || row >= GRID - 1 || col < 0 || col >= GRID - 1) return false;

  // Check overlap with existing walls
  for (const w of walls) {
    if (w.row === row && w.col === col) return false; // Same intersection
    if (orientation === 'h' && w.orientation === 'h' && w.row === row && Math.abs(w.col - col) < 2) return false;
    if (orientation === 'v' && w.orientation === 'v' && w.col === col && Math.abs(w.row - row) < 2) return false;
  }

  // Check path still exists for both players
  const testWalls = [...walls, { row, col, orientation, player: PLAYERS.RED }];
  const testWallSet = buildWallBlockSet(testWalls);

  const blueGoal = getGoalRow(PLAYERS.BLUE);
  const redGoal = getGoalRow(PLAYERS.RED);

  if (bfsShortestPath(pieces.blue.row, pieces.blue.col, blueGoal, testWallSet) >= 999) return false;
  if (bfsShortestPath(pieces.red.row, pieces.red.col, redGoal, testWallSet) >= 999) return false;

  return true;
}

// ==================== MOVE GENERATION ====================
// isRoot: only generate wall moves at the root of the search tree
function generateMoves(state, forPlayer, diffConfig, isRoot) {
  const moves = [];
  const pos = state.pieces[forPlayer];
  const opp = forPlayer === PLAYERS.BLUE ? PLAYERS.RED : PLAYERS.BLUE;
  const opPos = state.pieces[opp];
  const wallSet = buildWallBlockSet(state.walls);

  // 1. Movement moves
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of dirs) {
    const nr = pos.row + dr;
    const nc = pos.col + dc;
    if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;
    if (isBlockedFast(pos.row, pos.col, nr, nc, wallSet)) continue;

    if (nr === opPos.row && nc === opPos.col) {
      // Jump over opponent
      const jr = nr + dr;
      const jc = nc + dc;
      if (jr >= 0 && jr < GRID && jc >= 0 && jc < GRID &&
          !isBlockedFast(nr, nc, jr, jc, wallSet)) {
        moves.push({ type: 'move', row: jr, col: jc });
      } else {
        // Side jumps
        const sideDirs = dr !== 0 ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
        for (const [sdr, sdc] of sideDirs) {
          const sr = nr + sdr;
          const sc = nc + sdc;
          if (sr >= 0 && sr < GRID && sc >= 0 && sc < GRID &&
              !isBlockedFast(nr, nc, sr, sc, wallSet)) {
            moves.push({ type: 'move', row: sr, col: sc });
          }
        }
      }
    } else {
      moves.push({ type: 'move', row: nr, col: nc });
    }
  }

  // 2. Wall placement moves — ONLY at root to avoid exponential BFS blowup
  const wallCount = state.wallCounts[forPlayer];
  if (wallCount > 0 && diffConfig && isRoot) {
    const criticalWalls = getPathCriticalWalls(forPlayer, state.walls, state.pieces, diffConfig.wallPrune);
    for (const cw of criticalWalls) {
      moves.push({ type: 'wall', row: cw.row, col: cw.col, orientation: cw.orientation });
    }
  }

  return moves;
}

// ==================== EVALUATION FUNCTION ====================
function evaluate(state) {
  const wallSet = buildWallBlockSet(state.walls);

  const redGoal = getGoalRow(PLAYERS.RED);
  const blueGoal = getGoalRow(PLAYERS.BLUE);

  const redPath = bfsShortestPath(state.pieces.red.row, state.pieces.red.col, redGoal, wallSet);
  const bluePath = bfsShortestPath(state.pieces.blue.row, state.pieces.blue.col, blueGoal, wallSet);

  // Terminal states
  if (state.pieces.red.row === redGoal) return 10000;
  if (state.pieces.blue.row === blueGoal) return -10000;

  let score = 0;

  // PRIMARY: Path length advantage (most important)
  // Positive = good for RED (AI), negative = good for BLUE (human)
  score += (bluePath - redPath) * 100;

  // SECONDARY: Wall count advantage
  score += (state.wallCounts.red - state.wallCounts.blue) * 15;

  // TERTIARY: Progress toward goal (tie-breaker)
  const redProgress = (GRID - 1 - Math.abs(state.pieces.red.row - redGoal)) / (GRID - 1);
  const blueProgress = (GRID - 1 - Math.abs(state.pieces.blue.row - blueGoal)) / (GRID - 1);
  score += (redProgress - blueProgress) * 30;

  // URGENCY: When either player is close to winning, amplify
  if (redPath <= 2) score += (3 - redPath) * 150; // AI about to win
  if (bluePath <= 2) score -= (3 - bluePath) * 150; // Human about to win

  // WALL PRESSURE: Bonus if opponent has no walls left (can't block)
  if (state.wallCounts.blue === 0) score += 50;
  if (state.wallCounts.red === 0) score -= 40;

  // CENTER CONTROL: Slight bonus for center column positions
  const center = Math.floor(GRID / 2);
  const redCenterDist = Math.abs(state.pieces.red.col - center);
  const blueCenterDist = Math.abs(state.pieces.blue.col - center);
  score += (blueCenterDist - redCenterDist) * 5;

  return score;
}

// ==================== MINIMAX WITH ALPHA-BETA ====================
let searchNodes = 0;
let searchStartTime = 0;
let searchTimeLimit = 0;
let searchAborted = false;

// History heuristic table for move ordering
let historyTable = {};

function getHistoryKey(move) {
  if (move.type === 'move') return `m${move.row},${move.col}`;
  return `w${move.row},${move.col},${move.orientation}`;
}

function alphaBeta(state, depth, alpha, beta, maximizing, hash) {
  searchNodes++;

  // Time check every 1024 nodes
  if ((searchNodes & 1023) === 0) {
    if (Date.now() - searchStartTime > searchTimeLimit) {
      searchAborted = true;
      return 0;
    }
  }

  if (searchAborted) return 0;

  // Terminal check
  const redGoal = getGoalRow(PLAYERS.RED);
  const blueGoal = getGoalRow(PLAYERS.BLUE);
  if (state.pieces.red.row === redGoal) return 10000 + depth; // Prefer faster wins
  if (state.pieces.blue.row === blueGoal) return -10000 - depth;

  // Transposition table lookup
  const ttEntry = ttLookup(hash, depth, alpha, beta);
  if (ttEntry && ttEntry.flag === TT_EXACT) return ttEntry.score;
  if (ttEntry && ttEntry.flag === TT_BETA && ttEntry.score >= beta) return ttEntry.score;
  if (ttEntry && ttEntry.flag === TT_ALPHA && ttEntry.score <= alpha) return ttEntry.score;

  // Leaf node or depth 0
  if (depth <= 0) {
    // Quiescence: extend search if either player is 1 step from winning
    const wallSet = buildWallBlockSet(state.walls);
    const redDist = bfsShortestPath(state.pieces.red.row, state.pieces.red.col, redGoal, wallSet);
    const blueDist = bfsShortestPath(state.pieces.blue.row, state.pieces.blue.col, blueGoal, wallSet);

    if (depth >= -2 && (redDist <= 1 || blueDist <= 1)) {
      // Extend search for critical positions
      return alphaBeta(state, -1, alpha, beta, maximizing, hash);
    }

    return evaluate(state);
  }

  const forPlayer = maximizing ? PLAYERS.RED : PLAYERS.BLUE;
  const currentDiffConfig = AI_DIFFICULTIES[gameConfig.aiDifficulty || 2];
  let moves = generateMoves(state, forPlayer, currentDiffConfig, false); // not root

  if (moves.length === 0) return evaluate(state);

  // Move ordering
  orderMoves(moves, ttEntry, forPlayer, state);

  let bestScore = maximizing ? -Infinity : Infinity;
  let bestMove = moves[0];
  let flag = maximizing ? TT_ALPHA : TT_BETA;

  for (const move of moves) {
    if (searchAborted) break;

    // Make move
    const newState = applyMove(state, move, forPlayer);
    const newHash = computeHash(newState);

    const score = alphaBeta(newState, depth - 1, alpha, beta, !maximizing, newHash);

    if (maximizing) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (score > alpha) {
        alpha = score;
        flag = TT_EXACT;
      }
      if (alpha >= beta) {
        // Beta cutoff — update history heuristic
        const key = getHistoryKey(move);
        historyTable[key] = (historyTable[key] || 0) + depth * depth;
        break;
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (score < beta) {
        beta = score;
        flag = TT_EXACT;
      }
      if (alpha >= beta) {
        const key = getHistoryKey(move);
        historyTable[key] = (historyTable[key] || 0) + depth * depth;
        break;
      }
    }
  }

  // Store in transposition table
  if (!searchAborted) {
    ttStore(hash, depth, bestScore, flag, bestMove);
  }

  return bestScore;
}

// ==================== MOVE ORDERING ====================
function orderMoves(moves, ttEntry, forPlayer, state) {
  // Score each move for ordering
  for (const m of moves) {
    m._orderScore = 0;

    // TT best move goes first
    if (ttEntry && ttEntry.bestMove &&
        ttEntry.bestMove.type === m.type &&
        ttEntry.bestMove.row === m.row &&
        ttEntry.bestMove.col === m.col) {
      m._orderScore += 100000;
    }

    // Winning moves
    if (m.type === 'move') {
      const goalRow = getGoalRow(forPlayer);
      if (m.row === goalRow) m._orderScore += 50000;

      // Moves toward goal
      const pos = state.pieces[forPlayer];
      const currentDist = Math.abs(pos.row - goalRow);
      const newDist = Math.abs(m.row - goalRow);
      m._orderScore += (currentDist - newDist) * 1000;
    }

    // History heuristic
    const key = getHistoryKey(m);
    m._orderScore += (historyTable[key] || 0);

    // Walls: higher pre-computed score = better
    if (m.type === 'wall' && m.score) {
      m._orderScore += m.score * 500;
    }
  }

  moves.sort((a, b) => b._orderScore - a._orderScore);
}

// ==================== APPLY/UNDO MOVE ====================
function applyMove(state, move, player) {
  const opponent = player === PLAYERS.BLUE ? PLAYERS.RED : PLAYERS.BLUE;

  if (move.type === 'move') {
    return {
      pieces: {
        [player]: { row: move.row, col: move.col },
        [opponent]: { ...state.pieces[opponent] }
      },
      walls: state.walls,
      wallCounts: { ...state.wallCounts },
      currentPlayer: opponent
    };
  } else {
    const newWalls = [...state.walls, { row: move.row, col: move.col, orientation: move.orientation, player }];
    const newCounts = { ...state.wallCounts };
    newCounts[player]--;
    return {
      pieces: {
        blue: { ...state.pieces.blue },
        red: { ...state.pieces.red }
      },
      walls: newWalls,
      wallCounts: newCounts,
      currentPlayer: opponent
    };
  }
}

// ==================== ITERATIVE DEEPENING ====================
function iterativeDeepening(state, maxDepth, timeLimitMs) {
  initZobrist();
  ttable = new Array(TT_SIZE); // Clear TT for new search
  historyTable = {};
  searchNodes = 0;
  searchStartTime = Date.now();
  searchTimeLimit = timeLimitMs;
  searchAborted = false;

  let bestAction = null;
  let bestScore = -Infinity;
  const hash = computeHash(state);
  const diffConfig = AI_DIFFICULTIES[gameConfig.aiDifficulty || 2];

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (searchAborted) break;

    const moves = generateMoves(state, PLAYERS.RED, diffConfig, true); // root level
    if (moves.length === 0) break;

    // Order moves using previous iteration's TT data
    const ttEntry = ttLookup(hash, 0, -Infinity, Infinity);
    orderMoves(moves, ttEntry, PLAYERS.RED, state);

    let depthBestScore = -Infinity;
    let depthBestAction = moves[0];
    let alpha = -Infinity;
    const beta = Infinity;

    for (const move of moves) {
      if (searchAborted) break;

      const newState = applyMove(state, move, PLAYERS.RED);
      const newHash = computeHash(newState);

      const score = alphaBeta(newState, depth - 1, alpha, beta, false, newHash);

      if (score > depthBestScore && !searchAborted) {
        depthBestScore = score;
        depthBestAction = move;
      }
      if (score > alpha) alpha = score;
    }

    if (!searchAborted) {
      bestScore = depthBestScore;
      bestAction = depthBestAction;

      // Store this depth's best in TT
      ttStore(hash, depth, bestScore, TT_EXACT, bestAction);

      // If found a winning move, stop searching
      if (bestScore >= 9000) break;
    }
  }

  return bestAction;
}

// ==================== FAST PATH (skip search when clearly winning) ====================
function tryFastPath() {
  const wallSet = buildWallBlockSet(gameState.walls);
  const redGoal = getGoalRow(PLAYERS.RED);
  const blueGoal = getGoalRow(PLAYERS.BLUE);

  const myPath = bfsShortestPath(gameState.pieces.red.row, gameState.pieces.red.col, redGoal, wallSet);
  const oppPath = bfsShortestPath(gameState.pieces.blue.row, gameState.pieces.blue.col, blueGoal, wallSet);

  // Fast path conditions:
  // 1. AI has shorter or equal path AND opponent has no walls (can't block)
  // 2. AI is 1 step from winning (instant win)
  // 3. AI path is 2+ steps shorter than opponent (safe lead, just move)
  const oppWalls = gameState.wallCounts.blue;
  const shouldFastPath = (myPath <= oppPath && oppWalls === 0) ||
                          myPath <= 1 ||
                          (myPath < oppPath - 1 && oppWalls <= 1);

  if (!shouldFastPath) return null;

  // Find the movement that reduces our path the most
  const moves = generateMoves({
    pieces: { blue: { ...gameState.pieces.blue }, red: { ...gameState.pieces.red } },
    walls: gameState.walls,
    wallCounts: { ...gameState.wallCounts },
    currentPlayer: PLAYERS.RED
  }, PLAYERS.RED, null, false);

  const moveMoves = moves.filter(m => m.type === 'move');
  if (moveMoves.length === 0) return null;

  let bestMove = moveMoves[0];
  let bestDist = Infinity;

  for (const m of moveMoves) {
    // Instant win
    if (m.row === redGoal) return m;

    const newPath = bfsShortestPath(m.row, m.col, redGoal, wallSet);
    if (newPath < bestDist) {
      bestDist = newPath;
      bestMove = m;
    }
  }

  return bestMove;
}

// ==================== DIFFICULTY-SCALED AI ====================
function aiBeginner() {
  const wallSet = buildWallBlockSet(gameState.walls);
  const moves = generateMoves({
    pieces: { blue: { ...gameState.pieces.blue }, red: { ...gameState.pieces.red } },
    walls: gameState.walls,
    wallCounts: { ...gameState.wallCounts },
    currentPlayer: PLAYERS.RED
  }, PLAYERS.RED, null);

  // Only movement moves for beginner
  const moveMoves = moves.filter(m => m.type === 'move');
  if (moveMoves.length === 0) return moves[0] || null;

  // Add random noise
  for (const m of moveMoves) {
    const goalRow = getGoalRow(PLAYERS.RED);
    m._score = -(Math.abs(m.row - goalRow)) + (Math.random() * 5 - 2.5);
  }
  moveMoves.sort((a, b) => b._score - a._score);

  // 60% best move, 40% random
  return Math.random() < 0.6 ? moveMoves[0] : moveMoves[Math.floor(Math.random() * moveMoves.length)];
}

function aiWithSearch(diffLevel) {
  const config = AI_DIFFICULTIES[diffLevel];
  const state = {
    pieces: { blue: { ...gameState.pieces.blue }, red: { ...gameState.pieces.red } },
    walls: [...gameState.walls],
    wallCounts: { ...gameState.wallCounts },
    currentPlayer: PLAYERS.RED
  };

  let action = iterativeDeepening(state, config.depth, config.timeMs);

  // Add noise for lower difficulties
  if (config.noise > 0 && Math.random() * 100 < config.noise) {
    const moves = generateMoves(state, PLAYERS.RED, config);
    const moveMoves = moves.filter(m => m.type === 'move');
    if (moveMoves.length > 0) {
      action = moveMoves[Math.floor(Math.random() * moveMoves.length)];
    }
  }

  return action;
}

// ==================== AI TURN CONTROLLER ====================
function performAITurn() {
  if (gameState.gameOver) return;
  if (!gameConfig.vsAI) return;
  if (gameState.currentPlayer !== PLAYERS.RED) return;

  const difficulty = gameConfig.aiDifficulty || 2;

  // FAST PATH: If AI is clearly winning, just move instantly
  const fastAction = tryFastPath();
  if (fastAction) {
    setTimeout(() => {
      movePiece(PLAYERS.RED, fastAction.row, fastAction.col);
    }, 150);
    return;
  }

  // Show thinking indicator
  showAIThinking();

  // Use setTimeout to not block UI
  setTimeout(() => {
    let action;

    if (difficulty === 0) {
      action = aiBeginner();
    } else {
      action = aiWithSearch(difficulty);
    }

    hideAIThinking();

    if (!action) return;

    if (action.type === 'move') {
      movePiece(PLAYERS.RED, action.row, action.col);
    } else if (action.type === 'wall') {
      gameState.walls.push({
        row: action.row,
        col: action.col,
        orientation: action.orientation,
        player: PLAYERS.RED
      });
      gameState.wallCounts.red--;
      gameState.selectedWallTool = null;
      gameState.selectedPiece = null;
      gameState.validMoves = [];
      renderWalls();
      showTurnFlash(PLAYERS.RED);
      switchTurn();
    }
  }, 100); // Small delay for UI to show thinking indicator
}

function showAIThinking() {
  hideAIThinking();
  const el = document.createElement('div');
  el.className = 'ai-thinking';
  el.id = 'ai-thinking';
  const diffName = AI_DIFFICULTIES[gameConfig.aiDifficulty || 2].name;
  el.innerHTML = `🤖 ${diffName} AI thinking <div class="ai-thinking-dots"><span></span><span></span><span></span></div>`;
  boardEl.appendChild(el);
}

function hideAIThinking() {
  const el = document.getElementById('ai-thinking');
  if (el) el.remove();
}

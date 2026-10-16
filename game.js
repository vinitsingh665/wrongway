/* ============================================================
   Wrong Way — Game Engine
   Core game logic: board, movement, walls, path validation,
   win detection, and all UI interactions
   ============================================================ */

// ==================== GAME CONFIG ====================
let GRID = 9;
let TOTAL_WALLS = 10;
const PLAYERS = {
  BLUE: 'blue',   // Player 1 (Bottom)
  RED: 'red',     // Player 2 (Top)
  GREEN: 'green', // Player 3 (Right)
  YELLOW: 'yellow'// Player 4 (Left)
};

let gameConfig = {
  mode: 'duel',
  playerCount: 2,
  gridSize: 9,
  wallCount: 10,
  vsAI: false,
  aiDifficulty: 2,  // 0=Beginner, 5=Legendary
  firstMove: 'player',
  flipBoard: false,
  swapColors: false,  // If true, player plays as red visually
  networkMode: false  // True when playing LAN multiplayer
};

// Setup screen state
let setupState = {
  mode: 'duel',
  playerCount: 2,
  gridSize: 9,
  wallCount: 10,
  opponent: 'human',
  aiDifficulty: 2,
  firstMove: 'player',
  playerColor: 'blue'
};

// ==================== GAME STATE ====================
let gameState = {
  activePlayers: [],
  currentPlayer: PLAYERS.BLUE,
  pieces: {
    blue: { row: 8, col: 4 },
    red: { row: 0, col: 4 },
    green: { row: 4, col: 8 },
    yellow: { row: 4, col: 0 }
  },
  walls: [],
  wallCounts: {
    blue: TOTAL_WALLS,
    red: TOTAL_WALLS,
    green: TOTAL_WALLS,
    yellow: TOTAL_WALLS
  },
  selectedPiece: null,
  selectedWallTool: null,
  validMoves: [],
  gameOver: false,
  giveUpConfirm: false
};

// Move history for undo
let moveHistory = [];

// ==================== DOM REFERENCES ====================
const boardEl = document.getElementById('board');
const wallsBlueEl = document.getElementById('walls-blue');
const wallsRedEl = document.getElementById('walls-red');
const wallsGreenEl = document.getElementById('walls-green');
const wallsYellowEl = document.getElementById('walls-yellow');
const wallsCurrentEl = document.getElementById('walls-current');
const cardBlueEl = document.getElementById('card-blue');
const cardRedEl = document.getElementById('card-red');
const cardGreenEl = document.getElementById('card-green');
const cardYellowEl = document.getElementById('card-yellow');

// ==================== SCREEN MANAGEMENT ====================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showMenu() {
  showScreen('menu-screen');
}

function showHowToPlay() {
  showScreen('how-to-play-screen');
}

function showSetup() {
  setupState = { mode: 'duel', gridSize: 9, wallCount: 10, opponent: 'human', aiDifficulty: 2, firstMove: 'player', playerColor: 'blue' };
  updateSetupUI();
  updateDifficulty();
  showScreen('setup-screen');
}

// ==================== SETUP SCREEN LOGIC ====================
function selectOpponent(opp) {
  setupState.opponent = opp;
  if (opp === 'human4') {
    setupState.playerCount = 4;
    setupState.wallCount = 5; // Default to 5 walls for 4 players
  } else {
    setupState.playerCount = 2;
  }
  const diffSection = document.getElementById('difficulty-section');
  diffSection.style.display = opp === 'ai' ? '' : 'none';
  updateSetupUI();
}

function updateDifficulty() {
  const slider = document.getElementById('difficulty-slider');
  const level = parseInt(slider.value);
  setupState.aiDifficulty = level;

  const data = [
    { icon: '🌱', name: 'Beginner', desc: 'Learning the ropes' },
    { icon: '🌿', name: 'Easy', desc: 'Casual challenge' },
    { icon: '⚡', name: 'Medium', desc: 'Balanced match' },
    { icon: '🔥', name: 'Hard', desc: 'Serious competition' },
    { icon: '💎', name: 'Expert', desc: 'Near-perfect play' },
    { icon: '💀', name: 'Legendary', desc: 'Almost impossible' }
  ];

  document.getElementById('diff-icon').textContent = data[level].icon;
  document.getElementById('diff-name').textContent = data[level].name;
  document.getElementById('diff-desc').textContent = data[level].desc;
}

function selectMode(mode) {
  setupState.mode = mode;
  updateSetupUI();
}

function selectFirstMove(who) {
  setupState.firstMove = who;
  updateSetupUI();
}

function selectPlayerColor(color) {
  setupState.playerColor = color;
  updateSetupUI();
}

function selectGridSize(size) {
  setupState.gridSize = size;
  // Auto-adjust wall count based on grid size
  const ratio = Math.round((size * size) / 8);
  setupState.wallCount = Math.max(3, Math.min(30, ratio));
  updateSetupUI();
  // Bump animation
  const numEl = document.getElementById('grid-size-num');
  numEl.classList.add('bump');
  setTimeout(() => numEl.classList.remove('bump'), 150);
}

function adjustGridSize(delta) {
  setupState.gridSize = Math.max(3, Math.min(21, setupState.gridSize + delta));
  // Auto-adjust wall count
  const size = setupState.gridSize;
  const ratio = Math.round((size * size) / 8);
  setupState.wallCount = Math.max(3, Math.min(30, ratio));
  updateSetupUI();
  // Bump animation
  const numEl = document.getElementById('grid-size-num');
  numEl.classList.add('bump');
  setTimeout(() => numEl.classList.remove('bump'), 150);
}

function adjustWalls(delta) {
  setupState.wallCount = Math.max(1, Math.min(30, setupState.wallCount + delta));
  updateSetupUI();
  // Bump animation
  const numEl = document.getElementById('wall-count-num');
  numEl.classList.add('bump');
  setTimeout(() => numEl.classList.remove('bump'), 150);
}

function updateSetupUI() {
  // Mode cards
  document.getElementById('mode-duel').classList.toggle('selected', setupState.mode === 'duel');
  document.getElementById('mode-race').classList.toggle('selected', setupState.mode === 'race');

  // Opponent cards
  document.getElementById('opp-human').classList.toggle('selected', setupState.opponent === 'human');
  document.getElementById('opp-human-4')?.classList.toggle('selected', setupState.opponent === 'human4');
  document.getElementById('opp-ai').classList.toggle('selected', setupState.opponent === 'ai');
  
  // Show/hide first move and AI difficulty
  document.getElementById('first-move-section').style.display = setupState.opponent === 'ai' ? 'block' : 'none';
  document.getElementById('difficulty-section').style.display = setupState.opponent === 'ai' ? 'block' : 'none';

  // First Move toggle
  if (setupState.opponent === 'ai') {
    document.getElementById('fm-player').classList.toggle('selected', setupState.firstMove === 'player');
    document.getElementById('fm-computer').classList.toggle('selected', setupState.firstMove === 'computer');
  }

  // Player Color toggle
  document.getElementById('color-blue').classList.toggle('selected', setupState.playerColor === 'blue');
  document.getElementById('color-red').classList.toggle('selected', setupState.playerColor === 'red');

  // Grid size stepper
  document.getElementById('grid-size-num').textContent = setupState.gridSize;
  document.getElementById('grid-size-num2').textContent = setupState.gridSize;

  // Size preset chips
  document.querySelectorAll('.size-chip').forEach(chip => {
    const chipSize = parseInt(chip.textContent);
    chip.classList.toggle('selected', chipSize === setupState.gridSize);
  });

  // Size hint
  let hint = '';
  if (setupState.gridSize <= 4) hint = 'Tiny board';
  else if (setupState.gridSize <= 6) hint = 'Quick game';
  else if (setupState.gridSize <= 8) hint = 'Small board';
  else if (setupState.gridSize === 9) hint = 'Standard board';
  else if (setupState.gridSize <= 12) hint = 'Large board';
  else if (setupState.gridSize <= 16) hint = 'Epic board';
  else hint = 'Massive board';
  if (setupState.gridSize % 2 === 0) hint += ' (even)';
  document.getElementById('size-hint').textContent = hint;

  // Wall count
  document.getElementById('wall-count-num').textContent = setupState.wallCount;
}

// ==================== START GAME ====================
function quickPlay() {
  gameConfig = { mode: 'duel', gridSize: 9, wallCount: 10, vsAI: false, aiDifficulty: 2, firstMove: 'player', flipBoard: false, swapColors: false };
  launchGame();
}

function quickPlayAI() {
  gameConfig = { mode: 'duel', gridSize: 9, wallCount: 10, vsAI: true, aiDifficulty: 2, firstMove: 'player', flipBoard: false, swapColors: false };
  launchGame();
}

function startCustomGame() {
  gameConfig = {
    mode: setupState.mode,
    playerCount: setupState.playerCount,
    gridSize: setupState.gridSize,
    wallCount: setupState.wallCount,
    vsAI: setupState.opponent === 'ai',
    aiDifficulty: setupState.aiDifficulty,
    firstMove: setupState.opponent === 'ai' ? setupState.firstMove : 'player',
    flipBoard: false,
    swapColors: setupState.playerColor === 'red'
  };
  launchGame();
}

// Legacy compatibility
function startGame() {
  quickPlay();
}

function getStartPositions() {
  const center = Math.floor(GRID / 2);
  const flip = gameConfig.flipBoard;

  if (gameConfig.mode === 'race') {
    // Race: both start at same side, side by side
    const leftCol = Math.max(0, center - 1);
    const rightCol = Math.min(GRID - 1, center + 1);
    const row = flip ? 0 : GRID - 1;
    return {
      blue: { row: row, col: leftCol },
      red: { row: row, col: rightCol }
    };
  } else {
    // Duel / 4-Player: opposite sides
    let pos = {
      blue: { row: flip ? 0 : GRID - 1, col: center },
      red: { row: flip ? GRID - 1 : 0, col: center }
    };
    if (gameConfig.playerCount === 4) {
      pos.green = { row: center, col: flip ? GRID - 1 : 0 };
      pos.yellow = { row: center, col: flip ? 0 : GRID - 1 };
    }
    return pos;
  }
}

function getGoalRow(player) {
  const flip = gameConfig.flipBoard;
  if (gameConfig.mode === 'race') {
    return flip ? GRID - 1 : 0;
  } else {
    if (player === PLAYERS.BLUE) return flip ? GRID - 1 : 0;
    if (player === PLAYERS.RED) return flip ? 0 : GRID - 1;
    return -1; // Green/Yellow use getGoalCol
  }
}

function getGoalCol(player) {
  const flip = gameConfig.flipBoard;
  if (player === PLAYERS.GREEN) return flip ? 0 : GRID - 1;
  if (player === PLAYERS.YELLOW) return flip ? GRID - 1 : 0;
  return -1; // Blue/Red use getGoalRow
}

function swapPlayerCardsColor() {
  const blueSlot = document.querySelector('#card-blue .piece');
  const redSlot = document.querySelector('#card-red .piece');
  if (!blueSlot || !redSlot) return;
  
  if (gameConfig.swapColors) {
    blueSlot.className = 'piece piece-red small';
    redSlot.className = 'piece piece-blue small';
  } else {
    blueSlot.className = 'piece piece-blue small';
    redSlot.className = 'piece piece-red small';
  }
}

function launchGame() {
  GRID = gameConfig.gridSize;
  TOTAL_WALLS = gameConfig.wallCount;

  initAIWorker();

  // Update CSS variable
  document.documentElement.style.setProperty('--board-size', `min(90vw, ${Math.min(480, GRID * 52)}px)`);

  const positions = getStartPositions();
  
  let activePlayers = [PLAYERS.BLUE, PLAYERS.RED];
  if (gameConfig.playerCount === 4) {
    activePlayers = [PLAYERS.BLUE, PLAYERS.GREEN, PLAYERS.RED, PLAYERS.YELLOW];
  }

  let startingPlayer = PLAYERS.BLUE;
  if (gameConfig.vsAI && gameConfig.firstMove === 'computer') {
    startingPlayer = PLAYERS.RED;
  }

  let wallCounts = { blue: TOTAL_WALLS, red: TOTAL_WALLS };
  if (gameConfig.playerCount === 4) {
    wallCounts.green = TOTAL_WALLS;
    wallCounts.yellow = TOTAL_WALLS;
  }

  gameState = {
    activePlayers,
    currentPlayer: startingPlayer,
    pieces: { ...positions },
    walls: [],
    wallCounts,
    selectedPiece: null,
    selectedWallTool: null,
    validMoves: [],
    gameOver: false,
    giveUpConfirm: false
  };

  // Show/Hide player cards based on mode
  if (gameConfig.playerCount === 4) {
    cardGreenEl.style.display = '';
    cardYellowEl.style.display = '';
    document.getElementById('goal-left').style.display = '';
    document.getElementById('goal-right').style.display = '';
  } else {
    cardGreenEl.style.display = 'none';
    cardYellowEl.style.display = 'none';
    document.getElementById('goal-left').style.display = 'none';
    document.getElementById('goal-right').style.display = 'none';
  }

  // Reset move history
  moveHistory = [];

  showScreen('game-screen');
  swapPlayerCardsColor();
  updateGoalIndicators();
  updateBoardEdges();
  renderBoard();
  updateUI();

  // Update player labels for AI
  const p2Name = document.querySelector('#card-red .player-name');
  if (gameConfig.vsAI && p2Name) {
    const diffData = [
      { icon: '🌱' }, { icon: '🌿' }, { icon: '⚡' },
      { icon: '🔥' }, { icon: '💎' }, { icon: '💀' }
    ];
    const icon = diffData[gameConfig.aiDifficulty]?.icon || '🤖';
    p2Name.textContent = `${icon} Computer`;
  } else if (p2Name) {
    p2Name.textContent = 'Player 2';
  }

  // Auto-show valid moves for first player, or trigger AI
  if (isAITurn()) {
    performAITurn();
  } else {
    autoShowMoves();
  }
}

function toggleBoardFlip() {
  gameConfig.flipBoard = !gameConfig.flipBoard;
  
  // Mathematically rotate all pieces and walls 180 degrees
  for (const p of ['blue', 'red']) {
    gameState.pieces[p].row = GRID - 1 - gameState.pieces[p].row;
    gameState.pieces[p].col = GRID - 1 - gameState.pieces[p].col;
  }
  
  for (const w of gameState.walls) {
    // Wall intersections range [0, GRID-2], so 180° flip is (GRID-2-r, GRID-2-c)
    const newRow = GRID - 2 - w.row;
    const newCol = GRID - 2 - w.col;
    w.row = newRow;
    w.col = newCol;
  }
  
  updateGoalIndicators();
  updateBoardEdges();
  
  // Clear selection state
  gameState.validMoves = [];
  gameState.selectedPiece = null;
  
  renderBoard();
  
  if (!isAITurn()) {
    autoShowMoves();
  }
}

function updateGoalIndicators() {
  const goalTop = document.getElementById('goal-top');
  const goalBottom = document.getElementById('goal-bottom');
  const flip = gameConfig.flipBoard;

  if (gameConfig.mode === 'race') {
    // Race: both go to top normally (or bottom if flipped)
    const finishHTML = `
      <span class="goal-line"></span>
      <span class="goal-arrow">🏁</span>
      <span class="goal-label">FINISH LINE</span>
      <span class="goal-arrow">🏁</span>
      <span class="goal-line"></span>`;
    const startHTML = `
      <span class="goal-line"></span>
      <span class="goal-arrow">●</span>
      <span class="goal-label">START</span>
      <span class="goal-arrow">●</span>
      <span class="goal-line"></span>`;

    goalTop.style.color = flip ? 'var(--text-subtle)' : 'var(--purple)';
    goalTop.innerHTML = flip ? startHTML : finishHTML;
    
    goalBottom.style.color = flip ? 'var(--purple)' : 'var(--text-subtle)';
    goalBottom.innerHTML = flip ? finishHTML : startHTML;
  } else {
    // Duel: standard opposite goals
    const p1Label = 'PLAYER 1';
    const p2Label = gameConfig.vsAI ? 'COMPUTER' : 'PLAYER 2';
    
    goalTop.style.color = flip ? 'var(--red-primary)' : 'var(--blue-primary)';
    goalTop.innerHTML = `
      <span class="goal-line"></span>
      <span class="goal-arrow">▲</span>
      <span class="goal-label">${flip ? p2Label : p1Label}</span>
      <span class="goal-arrow">▲</span>
      <span class="goal-line"></span>`;
      
    goalBottom.style.color = flip ? 'var(--blue-primary)' : 'var(--red-primary)';
    goalBottom.innerHTML = `
      <span class="goal-line"></span>
      <span class="goal-arrow">▼</span>
      <span class="goal-label">${flip ? p1Label : p2Label}</span>
      <span class="goal-arrow">▼</span>
      <span class="goal-line"></span>`;
  }
}

function updateBoardEdges() {
  const topEdge = document.querySelector('.board-edge.top-edge');
  const botEdge = document.querySelector('.board-edge.bottom-edge');
  const flip = gameConfig.flipBoard;

  if (gameConfig.mode === 'race') {
    const finishBg = 'linear-gradient(90deg, transparent, #fbbf24 25%, #fbbf24 75%, transparent)';
    const finishShadow = '0 0 10px #fbbf24, 0 0 20px rgba(251, 191, 36, 0.4)';
    const startBg = 'linear-gradient(90deg, transparent, var(--text-subtle) 25%, var(--text-subtle) 75%, transparent)';
    const startShadow = '0 0 6px rgba(148, 163, 184, 0.3)';

    topEdge.style.background = flip ? startBg : finishBg;
    topEdge.style.boxShadow = flip ? startShadow : finishShadow;
    botEdge.style.background = flip ? finishBg : startBg;
    botEdge.style.boxShadow = flip ? finishShadow : startShadow;
  } else {
    topEdge.style.background = '';
    topEdge.style.boxShadow = '';
    botEdge.style.background = '';
    botEdge.style.boxShadow = '';
  }
}

// ==================== BOARD RENDERING ====================
function renderBoard() {
  boardEl.innerHTML = '';

  const boardSize = boardEl.clientWidth || 400;
  const cellSize = boardSize / GRID;

  // Draw grid lines
  for (let i = 1; i < GRID; i++) {
    const hLine = document.createElement('div');
    hLine.className = 'grid-line h-line';
    hLine.style.top = `${(i / GRID) * 100}%`;
    boardEl.appendChild(hLine);

    const vLine = document.createElement('div');
    vLine.className = 'grid-line v-line';
    vLine.style.left = `${(i / GRID) * 100}%`;
    boardEl.appendChild(vLine);
  }

  // Draw cells
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;

      // Checkerboard pattern
      if ((r + c) % 2 === 0) {
        cell.style.background = 'var(--cell-a)';
      } else {
        cell.style.background = 'var(--cell-b)';
      }

      // Goal rows/cols
      if (gameConfig.mode === 'race') {
        // Race: only top row is the finish line
        if (r === 0) cell.classList.add('goal-row-blue'); // reuse blue class for finish
      } else {
        // Duel: top row = blue goal, bottom row = red goal
        if (r === 0) cell.classList.add('goal-row-blue');
        if (r === GRID - 1) cell.classList.add('goal-row-red');
        
        if (gameConfig.playerCount === 4) {
          if (c === GRID - 1) cell.classList.add('goal-col-green');
          if (c === 0) cell.classList.add('goal-col-yellow');
        }
      }

      // Position
      cell.style.left = `${(c / GRID) * 100}%`;
      cell.style.top = `${(r / GRID) * 100}%`;
      cell.style.width = `${100 / GRID}%`;
      cell.style.height = `${100 / GRID}%`;

      cell.addEventListener('click', () => handleCellClick(r, c));

      boardEl.appendChild(cell);
    }
  }

  // Draw wall slots (intersections between cells)
  // Horizontal wall slots: between rows, spanning 2 columns
  for (let r = 0; r < GRID - 1; r++) {
    for (let c = 0; c < GRID - 1; c++) {
      // Wall intersection point
      const slot = document.createElement('div');
      slot.className = 'wall-slot-point';
      slot.dataset.row = r;
      slot.dataset.col = c;
      slot.style.position = 'absolute';
      slot.style.left = `${((c + 1) / GRID) * 100}%`;
      slot.style.top = `${((r + 1) / GRID) * 100}%`;
      slot.style.width = `${(100 / GRID) * 0.6}%`;
      slot.style.height = `${(100 / GRID) * 0.6}%`;
      slot.style.transform = 'translate(-50%, -50%)';
      slot.style.zIndex = '7';
      slot.style.cursor = 'pointer';
      slot.style.pointerEvents = 'none'; // Only enabled when wall tool selected
      slot.style.borderRadius = '50%';
      slot.addEventListener('click', (e) => {
        e.stopPropagation();
        handleWallSlotClick(r, c);
      });
      boardEl.appendChild(slot);
    }
  }

  // Render pieces
  renderPieces();
}

function renderPieces() {
  // Remove existing pieces
  boardEl.querySelectorAll('.piece:not(.small)').forEach(p => p.remove());

  const size = 100 / GRID;
  const pieceSize = size * 0.55;
  const offset = (size - pieceSize) / 2;
  const swap = gameConfig.swapColors;

  gameState.activePlayers.forEach(player => {
    let pieceClass = `piece-${player}`;
    if (swap && player === PLAYERS.BLUE) pieceClass = 'piece-red';
    if (swap && player === PLAYERS.RED) pieceClass = 'piece-blue';

    const el = document.createElement('div');
    el.id = `piece-${player}`;
    el.className = `piece ${pieceClass} landing`;
    el.style.width = `${pieceSize}%`;
    el.style.height = `${pieceSize}%`;
    el.style.left = `${(gameState.pieces[player].col / GRID) * 100 + offset}%`;
    el.style.top = `${(gameState.pieces[player].row / GRID) * 100 + offset}%`;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      handlePieceClick(player);
    });
    boardEl.appendChild(el);

    // Remove landing animation class after it plays
    setTimeout(() => {
      el.classList.remove('landing');
    }, 600);
  });
}

function updatePiecePositions() {
  const size = 100 / GRID;
  const pieceSize = size * 0.55;
  const offset = (size - pieceSize) / 2;

  gameState.activePlayers.forEach(player => {
    const el = document.getElementById(`piece-${player}`);
    if (el) {
      el.style.left = `${(gameState.pieces[player].col / GRID) * 100 + offset}%`;
      el.style.top = `${(gameState.pieces[player].row / GRID) * 100 + offset}%`;
    }
  });
}

// ==================== WALL RENDERING ====================
function renderWalls() {
  // Remove existing wall elements
  boardEl.querySelectorAll('.wall').forEach(w => w.remove());

  const cellPct = 100 / GRID;
  const thickness = 1.4; // percentage

  gameState.walls.forEach(wall => {
    const el = document.createElement('div');
    el.className = `wall ${wall.orientation === 'h' ? 'h-wall' : 'v-wall'} ${wall.player}-wall`;

    if (wall.orientation === 'h') {
      // Horizontal wall: sits between row and row+1, spans col and col+1
      el.style.left = `${(wall.col / GRID) * 100 + 1}%`;
      el.style.top = `${((wall.row + 1) / GRID) * 100 - thickness / 2}%`;
      el.style.width = `${(2 / GRID) * 100 - 2}%`;
      el.style.height = `${thickness}%`;
    } else {
      // Vertical wall: sits between col and col+1, spans row and row+1
      el.style.left = `${((wall.col + 1) / GRID) * 100 - thickness / 2}%`;
      el.style.top = `${(wall.row / GRID) * 100 + 1}%`;
      el.style.width = `${thickness}%`;
      el.style.height = `${(2 / GRID) * 100 - 2}%`;
    }

    boardEl.appendChild(el);
  });
}

// ==================== UI UPDATES ====================
function updateUI() {
  const cp = gameState.currentPlayer;

  // Update wall counts
  wallsBlueEl.textContent = gameState.wallCounts.blue;
  wallsRedEl.textContent = gameState.wallCounts.red;
  if (gameConfig.playerCount === 4) {
    wallsGreenEl.textContent = gameState.wallCounts.green;
    wallsYellowEl.textContent = gameState.wallCounts.yellow;
  }
  wallsCurrentEl.textContent = gameState.wallCounts[cp];

  // Update player card states
  const p1Color = gameConfig.swapColors ? 'red' : 'blue';
  const p2Color = gameConfig.swapColors ? 'blue' : 'red';
  cardBlueEl.className = `player-card ${p1Color} ${cp === PLAYERS.BLUE ? 'live' : ''}`;
  cardRedEl.className = `player-card ${p2Color} ${cp === PLAYERS.RED ? 'live' : ''}`;
  
  if (gameConfig.playerCount === 4) {
    cardGreenEl.className = `player-card green ${cp === PLAYERS.GREEN ? 'live' : ''}`;
    cardYellowEl.className = `player-card yellow ${cp === PLAYERS.YELLOW ? 'live' : ''}`;
  }

  // Update piece states
  gameState.activePlayers.forEach(player => {
    const el = document.getElementById(`piece-${player}`);
    if (el) {
      el.classList.toggle('current-turn', cp === player && !gameState.selectedPiece);
      el.classList.toggle('active', gameState.selectedPiece === player);
    }
  });

  // Update wall tool states
  const toolH = document.getElementById('tool-h');
  const toolV = document.getElementById('tool-v');
  const noWalls = gameState.wallCounts[cp] <= 0;

  toolH.classList.toggle('disabled', noWalls);
  toolV.classList.toggle('disabled', noWalls);

  toolH.className = 'wall-tool';
  toolV.className = 'wall-tool';
  if (noWalls) {
    toolH.classList.add('disabled');
    toolV.classList.add('disabled');
  }

  const selectedClass = cp === PLAYERS.RED ? 'selected-red' : 
                        cp === PLAYERS.GREEN ? 'selected-green' : 
                        cp === PLAYERS.YELLOW ? 'selected-yellow' : 'selected';
  
  if (gameState.selectedWallTool === 'h') toolH.classList.add(selectedClass);
  if (gameState.selectedWallTool === 'v') toolV.classList.add(selectedClass);

  // Toggle wall slot pointer events based on whether a wall tool is selected
  const wallSlots = boardEl.querySelectorAll('.wall-slot-point');
  const wallToolActive = gameState.selectedWallTool !== null;
  wallSlots.forEach(slot => {
    slot.style.pointerEvents = wallToolActive ? 'auto' : 'none';
    slot.style.cursor = wallToolActive ? 'pointer' : 'default';
  });

  // Update valid move indicators
  updateValidMoveIndicators();

  // Update goal indicators to show whose turn it is
  const goalTop = document.getElementById('goal-top');
  const goalBottom = document.getElementById('goal-bottom');
  goalTop.style.color = 'var(--blue-primary)';
  goalBottom.style.color = 'var(--red-primary)';

  // Reset give up button
  const giveUpBtn = document.getElementById('btn-give-up');
  if (!gameState.giveUpConfirm) {
    giveUpBtn.classList.remove('confirm');
    giveUpBtn.innerHTML = '<span>🏳️</span> Give up';
  }
}

function updateValidMoveIndicators() {
  // Clear all valid move indicators
  boardEl.querySelectorAll('.cell').forEach(cell => {
    cell.classList.remove('valid-move', 'valid-move-red');
  });

  if (gameState.selectedPiece) {
    const isRed = gameState.selectedPiece === PLAYERS.RED;
    gameState.validMoves.forEach(move => {
      const cell = boardEl.querySelector(`.cell[data-row="${move.row}"][data-col="${move.col}"]`);
      if (cell) {
        cell.classList.add('valid-move');
        if (isRed) cell.classList.add('valid-move-red');
      }
    });
  }
}

// ==================== PLAYER INTERACTIONS ====================
function handlePieceClick(player) {
  if (gameState.gameOver) return;
  if (isAITurn()) return;
  if (isNetworkOpponentTurn()) return;

  // Can only select your own piece on your turn
  if (player !== gameState.currentPlayer) {
    showStatusMessage('Not your turn!');
    return;
  }

  // Deselect wall tool
  gameState.selectedWallTool = null;

  if (gameState.selectedPiece === player) {
    // Deselect
    gameState.selectedPiece = null;
    gameState.validMoves = [];
  } else {
    // Select piece and calculate valid moves
    gameState.selectedPiece = player;
    gameState.validMoves = getValidMoves(player);
  }

  updateUI();
}

function handleCellClick(row, col) {
  if (gameState.gameOver) return;
  if (isAITurn()) return;
  if (isNetworkOpponentTurn()) return;

  // If a piece is selected (auto or manual), try to move there
  if (gameState.selectedPiece) {
    const isValid = gameState.validMoves.some(m => m.row === row && m.col === col);
    if (isValid) {
      movePiece(gameState.selectedPiece, row, col);
    }
    // Don't deselect on invalid click — keep showing moves
    return;
  }

  // If wall tool is selected, try to place a wall (handled in wall slot click)
}

function handleWallSlotClick(row, col) {
  if (gameState.gameOver) return;
  if (!gameState.selectedWallTool) return;
  if (isNetworkOpponentTurn()) return;

  const cp = gameState.currentPlayer;
  if (gameState.wallCounts[cp] <= 0) {
    showStatusMessage('No walls left!');
    return;
  }

  const orientation = gameState.selectedWallTool;

  // Check if wall placement is valid
  if (!canPlaceWall(row, col, orientation)) {
    showStatusMessage('Can\'t place wall here!');
    return;
  }

  // Save state for undo
  pushHistory();

  // Place the wall
  gameState.walls.push({ row, col, orientation, player: cp });
  gameState.wallCounts[cp]--;

  // Send over network
  if (gameConfig.networkMode) {
    Network.sendMove({ type: 'wall', row, col, orientation });
  }

  // Deselect wall tool
  gameState.selectedWallTool = null;
  gameState.selectedPiece = null;
  gameState.validMoves = [];

  // Render the new wall
  renderWalls();

  // Show turn flash
  showTurnFlash(cp);

  // Switch turn
  switchTurn();
}

function selectWallTool(orientation) {
  // Legacy click handler — now handled by drag system
  // Kept for backwards compatibility
  if (gameState.gameOver) return;

  const cp = gameState.currentPlayer;
  if (gameState.wallCounts[cp] <= 0) {
    showStatusMessage('No walls left!');
    return;
  }

  gameState.selectedPiece = null;
  gameState.validMoves = [];

  if (gameState.selectedWallTool === orientation) {
    gameState.selectedWallTool = null;
  } else {
    gameState.selectedWallTool = orientation;
  }

  updateUI();
}

// ==================== GAME LOGIC ====================
// ==================== MOVE HISTORY & UNDO ====================
function pushHistory() {
  moveHistory.push({
    currentPlayer: gameState.currentPlayer,
    pieces: {
      blue: { ...gameState.pieces.blue },
      red: { ...gameState.pieces.red }
    },
    walls: gameState.walls.map(w => ({ ...w })),
    wallCounts: { ...gameState.wallCounts },
    gameOver: gameState.gameOver
  });
  updateUndoButton();
}

function undoMove() {
  if (moveHistory.length === 0 || gameState.gameOver) return;
  if (isAITurn()) return; // Don't undo during AI thinking
  
  if (gameConfig.vsAI && moveHistory.length >= 2) {
    // Undo both AI's move and player's move
    moveHistory.pop(); // AI's move
    const prev = moveHistory.pop(); // Player's move
    restoreState(prev);
  } else if (!gameConfig.vsAI && moveHistory.length >= 1) {
    // 2-player: undo one move
    const prev = moveHistory.pop();
    restoreState(prev);
  }
  
  updateUndoButton();
}

function restoreState(snapshot) {
  gameState.currentPlayer = snapshot.currentPlayer;
  gameState.pieces.blue = { ...snapshot.pieces.blue };
  gameState.pieces.red = { ...snapshot.pieces.red };
  gameState.walls = snapshot.walls.map(w => ({ ...w }));
  gameState.wallCounts = { ...snapshot.wallCounts };
  gameState.gameOver = snapshot.gameOver;
  gameState.selectedPiece = null;
  gameState.validMoves = [];
  gameState.selectedWallTool = null;
  gameState.giveUpConfirm = false;
  
  renderBoard();
  updateUI();
  autoShowMoves();
}

function updateUndoButton() {
  const btn = document.getElementById('btn-undo');
  if (btn) {
    const minMoves = gameConfig.vsAI ? 2 : 1;
    btn.disabled = moveHistory.length < minMoves;
    btn.style.opacity = moveHistory.length < minMoves ? '0.4' : '1';
  }
}

// ==================== PIECE MOVEMENT ====================
function movePiece(player, row, col, fromNetwork = false) {
  // Save state for undo
  pushHistory();

  gameState.pieces[player] = { row, col };
  gameState.selectedPiece = null;
  gameState.validMoves = [];

  // Send over network (only if this is a local move)
  if (gameConfig.networkMode && !fromNetwork) {
    Network.sendMove({ type: 'move', row, col });
  }

  updatePiecePositions();

  // Show turn flash
  showTurnFlash(player);

  // Check for win
  if (checkWin(player)) {
    gameState.gameOver = true;
    setTimeout(() => showVictory(player), 400);
    return;
  }

  // Switch turn
  switchTurn();
}

function switchTurn() {
  const currentIndex = gameState.activePlayers.indexOf(gameState.currentPlayer);
  const nextIndex = (currentIndex + 1) % gameState.activePlayers.length;
  gameState.currentPlayer = gameState.activePlayers[nextIndex];
  updateUI();

  // If it's AI's turn, trigger AI
  if (isAITurn()) {
    // Clear human's move indicators
    gameState.selectedPiece = null;
    gameState.validMoves = [];
    updateUI();
    performAITurn();
  } else {
    // Auto-show valid moves for human player
    autoShowMoves();
  }
}

function isAITurn() {
  return gameConfig.vsAI && gameState.currentPlayer === PLAYERS.RED;
}

function isNetworkOpponentTurn() {
  if (!gameConfig.networkMode) return false;
  return !Network.isMyTurn(gameState.currentPlayer);
}

function autoShowMoves() {
  if (isAITurn()) return; // Don't show moves for AI
  const cp = gameState.currentPlayer;
  gameState.selectedPiece = cp;
  gameState.validMoves = getValidMoves(cp);
  updateUI();
}

function getValidMoves(player) {
  const pos = gameState.pieces[player];
  const moves = [];

  // Directions: up, down, left, right
  const dirs = [
    { dr: -1, dc: 0 }, // up
    { dr: 1, dc: 0 },  // down
    { dr: 0, dc: -1 }, // left
    { dr: 0, dc: 1 }   // right
  ];

  for (const dir of dirs) {
    const nr = pos.row + dir.dr;
    const nc = pos.col + dir.dc;

    // Check bounds
    if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;

    // Check walls
    if (isWallBlocking(pos.row, pos.col, nr, nc)) continue;

    // Check if any opponent is on that cell
    const opponentOnCell = gameState.activePlayers.find(p => p !== player && gameState.pieces[p].row === nr && gameState.pieces[p].col === nc);

    if (opponentOnCell) {
      // Jump over opponent
      const jr = nr + dir.dr;
      const jc = nc + dir.dc;

      // Can jump straight over?
      if (jr >= 0 && jr < GRID && jc >= 0 && jc < GRID &&
          !isWallBlocking(nr, nc, jr, jc) &&
          !gameState.activePlayers.some(p => p !== player && gameState.pieces[p].row === jr && gameState.pieces[p].col === jc)) {
        moves.push({ row: jr, col: jc });
      } else {
        // Can't jump straight — try diagonal jumps (left/right of opponent)
        const sideDirs = dir.dr !== 0
          ? [{ dr: 0, dc: -1 }, { dr: 0, dc: 1 }]
          : [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }];

        for (const sd of sideDirs) {
          const sr = nr + sd.dr;
          const sc = nc + sd.dc;
          if (sr >= 0 && sr < GRID && sc >= 0 && sc < GRID &&
              !isWallBlocking(nr, nc, sr, sc) &&
              !gameState.activePlayers.some(p => p !== player && gameState.pieces[p].row === sr && gameState.pieces[p].col === sc)) {
            moves.push({ row: sr, col: sc });
          }
        }
      }
      continue;
    }

    moves.push({ row: nr, col: nc });
  }

  return moves;
}

function isWallBlocking(fromRow, fromCol, toRow, toCol) {
  for (const wall of gameState.walls) {
    if (wall.orientation === 'h') {
      // Horizontal wall: blocks vertical movement between wall.row and wall.row+1
      // Wall spans columns wall.col and wall.col+1
      const wallRow = wall.row; // Wall is between wallRow and wallRow+1

      if (fromRow === wallRow && toRow === wallRow + 1) {
        // Moving down across this wall
        if (fromCol >= wall.col && fromCol <= wall.col + 1) return true;
      }
      if (fromRow === wallRow + 1 && toRow === wallRow) {
        // Moving up across this wall
        if (fromCol >= wall.col && fromCol <= wall.col + 1) return true;
      }
    } else {
      // Vertical wall: blocks horizontal movement between wall.col and wall.col+1
      // Wall spans rows wall.row and wall.row+1
      const wallCol = wall.col; // Wall is between wallCol and wallCol+1

      if (fromCol === wallCol && toCol === wallCol + 1) {
        // Moving right across this wall
        if (fromRow >= wall.row && fromRow <= wall.row + 1) return true;
      }
      if (fromCol === wallCol + 1 && toCol === wallCol) {
        // Moving left across this wall
        if (fromRow >= wall.row && fromRow <= wall.row + 1) return true;
      }
    }
  }
  return false;
}

function canPlaceWall(row, col, orientation) {
  // Bounds check first
  if (row < 0 || row >= GRID - 1 || col < 0 || col >= GRID - 1) {
    return false;
  }

  // Check for overlap/crossing with existing walls
  for (const wall of gameState.walls) {
    // Same intersection, ANY orientation → illegal (crossing or duplicate)
    if (wall.row === row && wall.col === col) {
      return false;
    }

    // Same-orientation overlap: two H-walls in the same row can't overlap
    if (orientation === 'h' && wall.orientation === 'h') {
      if (wall.row === row && Math.abs(wall.col - col) < 2) return false;
    }

    // Same-orientation overlap: two V-walls in the same col can't overlap
    if (orientation === 'v' && wall.orientation === 'v') {
      if (wall.col === col && Math.abs(wall.row - row) < 2) return false;
    }
  }

  // Temporarily place the wall to check path validity
  const tempWall = { row, col, orientation, player: gameState.currentPlayer };
  gameState.walls.push(tempWall);

  let allPlayersHavePath = true;
  for (const player of gameState.activePlayers) {
    if (!hasPathToGoal(player)) {
      allPlayersHavePath = false;
      break;
    }
  }

  // Remove temp wall
  gameState.walls.pop();

  return allPlayersHavePath;
}

// ==================== PATH VALIDATION (BFS) ====================
function hasPathToGoal(player) {
  const start = gameState.pieces[player];
  const goalRow = getGoalRow(player);

  const visited = new Set();
  const queue = [{ row: start.row, col: start.col }];
  visited.add(`${start.row},${start.col}`);

  const dirs = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 }
  ];

  while (queue.length > 0) {
    const curr = queue.shift();

    if (goalRow !== -1 && curr.row === goalRow) return true;
    if (goalRow === -1 && curr.col === getGoalCol(player)) return true;

    for (const dir of dirs) {
      const nr = curr.row + dir.dr;
      const nc = curr.col + dir.dc;

      if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) continue;

      const key = `${nr},${nc}`;
      if (visited.has(key)) continue;

      if (isWallBlocking(curr.row, curr.col, nr, nc)) continue;

      visited.add(key);
      queue.push({ row: nr, col: nc });
    }
  }

  return false;
}

// ==================== WIN DETECTION ====================
function checkWin(player) {
  const pos = gameState.pieces[player];
  const goalRow = getGoalRow(player);
  if (goalRow !== -1) {
    return pos.row === goalRow;
  } else {
    const goalCol = getGoalCol(player);
    return pos.col === goalCol;
  }
}

// ==================== VICTORY ====================
function showVictory(player) {
  const titleEl = document.getElementById('victory-title');
  const subtitleEl = document.querySelector('.victory-subtitle');

  if (gameConfig.vsAI) {
    if (player === PLAYERS.BLUE) {
      titleEl.textContent = 'You Win! 🎉';
      subtitleEl.textContent = 'You defeated the computer!';
    } else {
      titleEl.textContent = 'Computer Wins!';
      subtitleEl.textContent = 'Better luck next time...';
    }
  } else {
    const name = player === PLAYERS.BLUE ? 'Player 1' : 'Player 2';
    titleEl.textContent = `${name} Wins!`;
    if (gameConfig.mode === 'race') {
      subtitleEl.textContent = 'Reached the finish line first! 🏁';
    } else {
      subtitleEl.textContent = 'Reached the other side first!';
    }
  }

  titleEl.className = `victory-title ${player}-winner`;

  // Spawn confetti
  spawnConfetti();

  showScreen('victory-screen');
}

function spawnConfetti() {
  const container = document.getElementById('confetti-container');
  container.innerHTML = '';

  const colors = [
    '#ef4444', '#3b82f6', '#fbbf24', '#22c55e',
    '#a855f7', '#ec4899', '#14b8a6', '#f97316'
  ];

  for (let i = 0; i < 50; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = `${2 + Math.random() * 3}s`;
    piece.style.animationDelay = `${Math.random() * 1.5}s`;
    piece.style.width = `${6 + Math.random() * 6}px`;
    piece.style.height = `${8 + Math.random() * 8}px`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    container.appendChild(piece);
  }
}

// ==================== GIVE UP ====================
function handleGiveUp() {
  if (gameState.gameOver) return;

  // In network mode, only allow give up on your turn
  if (gameConfig.networkMode && isNetworkOpponentTurn()) {
    showStatusMessage('Wait for your turn!');
    return;
  }

  const btn = document.getElementById('btn-give-up');

  if (!gameState.giveUpConfirm) {
    gameState.giveUpConfirm = true;
    btn.classList.add('confirm');
    btn.innerHTML = '<span>⚠️</span> Confirm?';

    // Auto-reset after 3 seconds
    setTimeout(() => {
      if (gameState.giveUpConfirm) {
        gameState.giveUpConfirm = false;
        updateUI();
      }
    }, 3000);
  } else {
    // Confirm give up — opponent wins
    gameState.gameOver = true;
    const winner = gameState.currentPlayer === PLAYERS.BLUE ? PLAYERS.RED : PLAYERS.BLUE;

    // Notify opponent over network
    if (gameConfig.networkMode) {
      Network.sendGiveUp();
    }

    showVictory(winner);
  }
}

// ==================== VISUAL FEEDBACK ====================
function showTurnFlash(player) {
  const existing = document.querySelector('.turn-flash');
  if (existing) existing.remove();

  const flash = document.createElement('div');
  flash.className = `turn-flash ${player}`;
  document.body.appendChild(flash);

  setTimeout(() => flash.remove(), 700);
}

function showStatusMessage(msg) {
  const existing = document.querySelector('.status-msg');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = 'status-msg';
  el.textContent = msg;
  document.body.appendChild(el);

  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 300);
  }, 1200);
}

// ==================== KEYBOARD SUPPORT ====================
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    gameState.selectedPiece = null;
    gameState.selectedWallTool = null;
    gameState.validMoves = [];
    updateUI();
  }
});

// ==================== WINDOW RESIZE ====================
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (document.getElementById('game-screen').classList.contains('active')) {
      renderBoard();
      renderWalls();
      updateUI();
    }
  }, 200);
});

// ==================== DRAG & DROP WALL SYSTEM ====================
let dragState = {
  active: false,
  orientation: null, // 'h' or 'v'
  previewEl: null,   // floating wall following cursor
  ghostEl: null,     // ghost wall on board
  currentSlot: null, // { row, col } of nearest intersection
  isValid: false,
  validSlotDots: []  // dot elements showing valid positions
};

function initDragSystem() {
  const toolH = document.getElementById('tool-h');
  const toolV = document.getElementById('tool-v');

  // Mouse events
  toolH.addEventListener('mousedown', (e) => startDrag('h', e));
  toolV.addEventListener('mousedown', (e) => startDrag('v', e));

  // Touch events
  toolH.addEventListener('touchstart', (e) => startDrag('h', e), { passive: false });
  toolV.addEventListener('touchstart', (e) => startDrag('v', e), { passive: false });

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('touchmove', onDragMove, { passive: false });

  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchend', onDragEnd);
  document.addEventListener('touchcancel', onDragCancel);
}

function startDrag(orientation, e) {
  if (gameState.gameOver) return;
  if (isAITurn()) return;
  if (isNetworkOpponentTurn()) return;
  const cp = gameState.currentPlayer;
  if (gameState.wallCounts[cp] <= 0) {
    showStatusMessage('No walls left!');
    return;
  }

  e.preventDefault();

  // Deselect any piece
  gameState.selectedPiece = null;
  gameState.selectedWallTool = null;
  gameState.validMoves = [];
  updateUI();

  const pos = getPointerPos(e);

  dragState.active = true;
  dragState.orientation = orientation;
  dragState.currentSlot = null;
  dragState.isValid = false;

  // Create floating wall preview
  const preview = document.createElement('div');
  const colorClass = cp === PLAYERS.BLUE ? 'blue-drag' : 'red-drag';
  const dirClass = orientation === 'h' ? 'h-drag' : 'v-drag';
  preview.className = `drag-wall-preview ${dirClass} ${colorClass}`;
  preview.style.left = `${pos.x}px`;
  preview.style.top = `${pos.y}px`;
  document.body.appendChild(preview);
  dragState.previewEl = preview;

  // Highlight the tool button
  const toolEl = document.getElementById(orientation === 'h' ? 'tool-h' : 'tool-v');
  toolEl.classList.add(cp === PLAYERS.BLUE ? 'selected' : 'selected-red');

  // Update hint
  const hint = document.getElementById('wall-hint');
  hint.textContent = 'Drop on a green dot to place';
  hint.classList.add('dragging');
  if (cp === PLAYERS.RED) hint.classList.add('dragging-red');

  // Set body dragging state
  document.body.classList.add('wall-dragging');
  boardEl.classList.add('drag-target');
}

function onDragMove(e) {
  if (!dragState.active) return;
  e.preventDefault();

  const pos = getPointerPos(e);

  // Move floating preview
  if (dragState.previewEl) {
    dragState.previewEl.style.left = `${pos.x}px`;
    dragState.previewEl.style.top = `${pos.y}px`;
  }

  // Check if pointer is over the board
  const boardRect = boardEl.getBoundingClientRect();
  const relX = pos.x - boardRect.left;
  const relY = pos.y - boardRect.top;

  if (relX >= 0 && relX <= boardRect.width && relY >= 0 && relY <= boardRect.height) {
    // Find nearest intersection
    const cellW = boardRect.width / GRID;
    const cellH = boardRect.height / GRID;

    // Intersections are at (col+1, row+1) grid positions
    // We want the intersection closest to the pointer
    const nearCol = Math.round(relX / cellW) - 1;
    const nearRow = Math.round(relY / cellH) - 1;

    // Clamp to valid range
    const col = Math.max(0, Math.min(nearCol, GRID - 2));
    const row = Math.max(0, Math.min(nearRow, GRID - 2));

    // Update ghost wall if position changed
    if (!dragState.currentSlot || dragState.currentSlot.row !== row || dragState.currentSlot.col !== col) {
      dragState.currentSlot = { row, col };
      dragState.isValid = canPlaceWall(row, col, dragState.orientation);
      showGhostWall(row, col, dragState.orientation, dragState.isValid);
    }
  } else {
    // Off the board — hide ghost
    hideGhostWall();
    dragState.currentSlot = null;
    dragState.isValid = false;
  }
}

function onDragEnd(e) {
  if (!dragState.active) return;
  e.preventDefault();

  // If over a valid slot, place the wall
  if (dragState.currentSlot && dragState.isValid) {
    const cp = gameState.currentPlayer;
    const { row, col } = dragState.currentSlot;

    // Save state for undo
    pushHistory();

    gameState.walls.push({ row, col, orientation: dragState.orientation, player: cp });
    gameState.wallCounts[cp]--;

    // Send over network
    if (gameConfig.networkMode) {
      Network.sendMove({ type: 'wall', row, col, orientation: dragState.orientation });
    }

    gameState.selectedWallTool = null;
    gameState.selectedPiece = null;
    gameState.validMoves = [];

    renderWalls();
    showTurnFlash(cp);
    switchTurn();
  } else if (dragState.currentSlot && !dragState.isValid) {
    showStatusMessage('Can\'t place wall here!');
  }

  cleanupDrag();
}

function onDragCancel() {
  if (!dragState.active) return;
  cleanupDrag();
}

function cleanupDrag() {
  // Remove floating preview
  if (dragState.previewEl) {
    dragState.previewEl.remove();
    dragState.previewEl = null;
  }

  // Remove ghost wall
  hideGhostWall();

  // Remove valid slot dots
  removeValidSlotDots();

  // Reset tool highlight
  document.getElementById('tool-h').classList.remove('selected', 'selected-red');
  document.getElementById('tool-v').classList.remove('selected', 'selected-red');

  // Reset hint
  const hint = document.getElementById('wall-hint');
  hint.textContent = 'Drag a wall onto the board';
  hint.classList.remove('dragging', 'dragging-red');

  // Reset body state
  document.body.classList.remove('wall-dragging');
  boardEl.classList.remove('drag-target');

  dragState.active = false;
  dragState.orientation = null;
  dragState.currentSlot = null;
  dragState.isValid = false;

  // Re-show valid moves if game is still going
  if (!gameState.gameOver) {
    autoShowMoves();
  }
}

// ==================== GHOST WALL PREVIEW ====================
function showGhostWall(row, col, orientation, isValid) {
  hideGhostWall();

  const thickness = 1.4;
  const el = document.createElement('div');
  const validClass = isValid ? 'valid' : 'invalid';
  const dirClass = orientation === 'h' ? 'h-ghost' : 'v-ghost';
  el.className = `ghost-wall ${dirClass} ${validClass}`;

  if (orientation === 'h') {
    el.style.left = `${(col / GRID) * 100 + 1}%`;
    el.style.top = `${((row + 1) / GRID) * 100 - thickness / 2}%`;
    el.style.width = `${(2 / GRID) * 100 - 2}%`;
    el.style.height = `${thickness}%`;
  } else {
    el.style.left = `${((col + 1) / GRID) * 100 - thickness / 2}%`;
    el.style.top = `${(row / GRID) * 100 + 1}%`;
    el.style.width = `${thickness}%`;
    el.style.height = `${(2 / GRID) * 100 - 2}%`;
  }

  boardEl.appendChild(el);
  dragState.ghostEl = el;
}

function hideGhostWall() {
  if (dragState.ghostEl) {
    dragState.ghostEl.remove();
    dragState.ghostEl = null;
  }
}

// ==================== VALID SLOT DOTS ====================
function showValidSlotDots(orientation) {
  removeValidSlotDots();

  const dotSize = Math.max(6, (100 / GRID) * 0.18);

  for (let r = 0; r < GRID - 1; r++) {
    for (let c = 0; c < GRID - 1; c++) {
      if (canPlaceWall(r, c, orientation)) {
        const dot = document.createElement('div');
        dot.className = 'valid-slot-dot';
        dot.style.left = `${((c + 1) / GRID) * 100}%`;
        dot.style.top = `${((r + 1) / GRID) * 100}%`;
        dot.style.width = `${dotSize}%`;
        dot.style.height = `${dotSize}%`;
        // Stagger animation
        dot.style.animationDelay = `${(r * (GRID - 1) + c) * 0.02}s`;
        boardEl.appendChild(dot);
        dragState.validSlotDots.push(dot);
      }
    }
  }
}

function removeValidSlotDots() {
  dragState.validSlotDots.forEach(dot => dot.remove());
  dragState.validSlotDots = [];
}

// ==================== POINTER UTILS ====================
function getPointerPos(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  if (e.changedTouches && e.changedTouches.length > 0) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

// ==================== INITIALIZATION ====================
showScreen('menu-screen');

// Initialize drag system after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDragSystem);
} else {
  initDragSystem();
}

// ==================== AI WORKER INTEGRATION ====================
let aiWorker = null;
const AI_NAMES = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert', 'Legendary'];

function initAIWorker() {
  if (aiWorker) return;
  aiWorker = new Worker('ai-worker.js');
  aiWorker.onmessage = function(e) {
    const msg = e.data;
    if (msg.type === 'SEARCH_RESULT') {
      hideAIThinking();
      const action = msg.move;
      if (!action) return;

      if (action.type === 'move') {
        movePiece(PLAYERS.RED, action.row, action.col);
      } else if (action.type === 'wall') {
        pushHistory();
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
    }
  };
}

function performAITurn() {
  if (gameState.gameOver) return;
  if (!gameConfig.vsAI) return;
  if (gameState.currentPlayer !== PLAYERS.RED) return;

  showAIThinking();

  // Send state to worker
  const stateSnapshot = {
    pieces: { blue: { ...gameState.pieces.blue }, red: { ...gameState.pieces.red } },
    walls: [...gameState.walls],
    wallCounts: { ...gameState.wallCounts }
  };

  aiWorker.postMessage({
    type: 'START_SEARCH',
    state: stateSnapshot,
    difficulty: gameConfig.aiDifficulty || 2
  });
}

function showAIThinking() {
  hideAIThinking();
  const el = document.createElement('div');
  el.className = 'ai-thinking';
  el.id = 'ai-thinking';
  const diffName = AI_NAMES[gameConfig.aiDifficulty || 2];
  el.innerHTML = `🤖 ${diffName} AI thinking <div class="ai-thinking-dots"><span></span><span></span><span></span></div>`;
  boardEl.appendChild(el);
}

function hideAIThinking() {
  const el = document.getElementById('ai-thinking');
  if (el) el.remove();
}

// ==================== LAN MULTIPLAYER ====================

// --- Lobby Screen Functions ---
let onlineSetupState = {
  mode: 'duel',
  playerCount: 2,
  gridSize: 9,
  wallCount: 10
};

function selectOnlinePlayers(num) {
  onlineSetupState.playerCount = num;
  if (num === 4) {
    onlineSetupState.wallCount = 5;
  } else {
    onlineSetupState.wallCount = 10;
  }
  updateOnlineSetupUI();
}

function selectOnlineMode(mode) {
  onlineSetupState.mode = mode;
  updateOnlineSetupUI();
}

function selectOnlineGridSize(size) {
  onlineSetupState.gridSize = size;
  const ratio = Math.round((size * size) / 8);
  onlineSetupState.wallCount = Math.max(3, Math.min(30, ratio));
  updateOnlineSetupUI();
  const numEl = document.getElementById('online-wall-count-num');
  if (numEl) {
    numEl.classList.add('bump');
    setTimeout(() => numEl.classList.remove('bump'), 150);
  }
}

function adjustOnlineWalls(delta) {
  onlineSetupState.wallCount = Math.max(1, Math.min(30, onlineSetupState.wallCount + delta));
  updateOnlineSetupUI();
  const numEl = document.getElementById('online-wall-count-num');
  if (numEl) {
    numEl.classList.add('bump');
    setTimeout(() => numEl.classList.remove('bump'), 150);
  }
}

function updateOnlineSetupUI() {
  const duelEl = document.getElementById('online-mode-duel');
  if(duelEl) duelEl.classList.toggle('selected', onlineSetupState.mode === 'duel');
  const raceEl = document.getElementById('online-mode-race');
  if(raceEl) raceEl.classList.toggle('selected', onlineSetupState.mode === 'race');

  const p2El = document.getElementById('online-players-2');
  if(p2El) p2El.classList.toggle('selected', onlineSetupState.playerCount === 2);
  const p4El = document.getElementById('online-players-4');
  if(p4El) p4El.classList.toggle('selected', onlineSetupState.playerCount === 4);
  
  [5, 7, 9, 11, 15].forEach(size => {
    const chip = document.getElementById('online-size-' + size);
    if(chip) chip.classList.toggle('selected', size === onlineSetupState.gridSize);
  });
  
  const wallEl = document.getElementById('online-wall-count-num');
  if(wallEl) wallEl.textContent = onlineSetupState.wallCount;
  
  let hint = '';
  if (onlineSetupState.gridSize <= 4) hint = 'Tiny board';
  else if (onlineSetupState.gridSize <= 6) hint = 'Quick game';
  else if (onlineSetupState.gridSize <= 8) hint = 'Small board';
  else if (onlineSetupState.gridSize === 9) hint = 'Standard board';
  else if (onlineSetupState.gridSize <= 12) hint = 'Large board';
  else if (onlineSetupState.gridSize <= 16) hint = 'Epic board';
  else hint = 'Massive board';
  if (onlineSetupState.gridSize % 2 === 0) hint += ' (even)';
  
  const hintEl = document.getElementById('online-size-hint');
  if(hintEl) hintEl.textContent = hint;
}

function showMultiplayerLobby() {
  // Reset lobby UI
  document.getElementById('room-info-card').style.display = 'none';
  document.getElementById('join-error').style.display = 'none';
  document.getElementById('join-room-input').value = '';
  document.getElementById('btn-create-room').disabled = false;
  document.getElementById('btn-create-room').style.opacity = '1';
  
  const settingsEl = document.getElementById('online-settings');
  if (settingsEl) settingsEl.style.display = 'block';

  // Reset online settings
  onlineSetupState = { mode: 'duel', playerCount: 2, gridSize: 9, wallCount: 10 };
  updateOnlineSetupUI();

  // Update status to connecting
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  statusDot.className = 'status-dot connecting';
  statusText.textContent = 'Connecting...';

  showScreen('multiplayer-screen');

  // Try to connect
  Network.connect().then(() => {
    statusDot.className = 'status-dot connected';
    statusText.textContent = 'Connected to server';
  }).catch(() => {
    statusDot.className = 'status-dot disconnected';
    statusText.textContent = 'Cannot connect — is the server running?';
  });
}

function leaveMultiplayer() {
  Network.disconnect();
  showMenu();
}

function handleCreateRoom() {
  const btn = document.getElementById('btn-create-room');
  btn.disabled = true;
  btn.style.opacity = '0.5';

  const settingsEl = document.getElementById('online-settings');
  if (settingsEl) settingsEl.style.display = 'none';

  Network.createRoom({
    mode: onlineSetupState.mode,
    playerCount: onlineSetupState.playerCount,
    gridSize: onlineSetupState.gridSize,
    wallCount: onlineSetupState.wallCount
  });
}

function handleJoinRoom() {
  const input = document.getElementById('join-room-input');
  const code = input.value.trim().toUpperCase();
  const errorEl = document.getElementById('join-error');

  if (code.length !== 4) {
    errorEl.textContent = 'Please enter a 4-character room code';
    errorEl.style.display = 'block';
    return;
  }

  errorEl.style.display = 'none';
  Network.joinRoom(code);
}

function copyShareLink() {
  const input = document.getElementById('share-link-input');
  const btn = document.getElementById('btn-copy-link');
  const icon = document.getElementById('copy-icon');

  navigator.clipboard.writeText(input.value).then(() => {
    btn.classList.add('copied');
    icon.textContent = '✅';
    setTimeout(() => {
      btn.classList.remove('copied');
      icon.textContent = '📋';
    }, 2000);
  }).catch(() => {
    // Fallback: select the input
    input.select();
    document.execCommand('copy');
    btn.classList.add('copied');
    icon.textContent = '✅';
    setTimeout(() => {
      btn.classList.remove('copied');
      icon.textContent = '📋';
    }, 2000);
  });
}

// --- Network Event Handlers ---
function setupNetworkCallbacks() {
  Network.onRoomCreated = (code, color) => {
    // Show room info card with code and link
    document.getElementById('room-info-card').style.display = 'block';
    document.getElementById('room-code-display').textContent = code;
    document.getElementById('share-link-input').value = Network.getShareableLink();
    document.getElementById('waiting-indicator').style.display = 'flex';
  };

  Network.onRoomJoined = (code, color) => {
    // We joined someone's room — waiting for game start
    showStatusMessage('Joined room ' + code + '! Waiting for players...');
    document.getElementById('room-info-card').style.display = 'block';
    document.getElementById('room-code-display').textContent = code;
    document.getElementById('waiting-indicator').style.display = 'flex';
  };

  Network.onPlayerJoined = (data) => {
    // Update waiting message with count
    const waitingEl = document.getElementById('waiting-indicator');
    if (waitingEl) {
      waitingEl.querySelector('span').textContent = `Waiting for players... (${data.currentPlayers}/${data.maxPlayers})`;
    }
  };

  Network.onJoinError = (error) => {
    const errorEl = document.getElementById('join-error');
    errorEl.textContent = error;
    errorEl.style.display = 'block';
  };

  Network.onGameStart = (config) => {
    // Both players are connected — start the game!
    const myColor = Network.getPlayerColor();

    gameConfig = {
      mode: config?.mode || 'duel',
      playerCount: config?.playerCount || 2,
      gridSize: config?.gridSize || 9,
      wallCount: config?.wallCount || 10,
      vsAI: false,
      aiDifficulty: 0,
      firstMove: 'player',
      flipBoard: myColor === 'red', // Only Red player sees board flipped for now
      swapColors: false,
      networkMode: true
    };

    launchGame();

    // Show online badge
    const badge = document.getElementById('online-badge');
    if (badge) badge.style.display = 'inline-flex';

    // Disable undo in network mode
    const undoBtn = document.getElementById('btn-undo');
    if (undoBtn) {
      undoBtn.style.display = 'none';
    }

    // Disable flip board in network mode
    const flipBtn = document.getElementById('btn-flip-board');
    if (flipBtn) {
      flipBtn.style.display = 'none';
    }

    // Update player labels
    const p1Name = document.querySelector('#card-blue .player-name');
    const p2Name = document.querySelector('#card-red .player-name');
    if (myColor === 'blue') {
      if (p1Name) p1Name.textContent = 'You';
      if (p2Name) p2Name.textContent = 'Opponent';
    } else {
      if (p1Name) p1Name.textContent = 'Opponent';
      if (p2Name) p2Name.textContent = 'You';
    }

    // Show turn banner
    showTurnBanner();
  };

  Network.onOpponentMove = (move, playerColor) => {
    if (!gameConfig.networkMode) return;

    // Use provided playerColor, fallback to standard opponent for 2-player
    const opponent = playerColor || (Network.getPlayerColor() === 'blue' ? PLAYERS.RED : PLAYERS.BLUE);

    if (move.type === 'move') {
      // Opponent moved their piece
      movePiece(opponent, move.row, move.col, true);
    } else if (move.type === 'wall') {
      // Opponent placed a wall
      pushHistory();
      gameState.walls.push({
        row: move.row,
        col: move.col,
        orientation: move.orientation,
        player: opponent
      });
      gameState.wallCounts[opponent]--;
      gameState.selectedWallTool = null;
      gameState.selectedPiece = null;
      gameState.validMoves = [];
      renderWalls();
      showTurnFlash(opponent);
      switchTurn();
    }
  };

  Network.onOpponentDisconnected = () => {
    if (!gameConfig.networkMode) return;
    // Show disconnect overlay
    const overlay = document.getElementById('disconnect-overlay');
    if (overlay) overlay.style.display = 'flex';
  };

  Network.onOpponentGaveUp = (player) => {
    if (!gameConfig.networkMode) return;
    gameState.gameOver = true;
    // The giving-up player's opponent wins (which is us)
    const myColor = Network.getPlayerColor();
    showVictory(myColor === 'blue' ? PLAYERS.BLUE : PLAYERS.RED);
  };

  Network.onRematchRequested = () => {
    showStatusMessage('Opponent wants a rematch!');
  };

  Network.onRematchAccepted = () => {
    // Restart the game with same config
    if (gameConfig.networkMode) {
      launchGame();
      // Re-apply online UI
      const badge = document.getElementById('online-badge');
      if (badge) badge.style.display = 'inline-flex';
      const undoBtn = document.getElementById('btn-undo');
      if (undoBtn) undoBtn.style.display = 'none';
      const flipBtn = document.getElementById('btn-flip-board');
      if (flipBtn) flipBtn.style.display = 'none';
      showTurnBanner();
    }
  };

  Network.onConnectionChange = (connected) => {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    if (statusDot && statusText) {
      if (connected) {
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Connected to server';
      } else {
        statusDot.className = 'status-dot disconnected';
        statusText.textContent = 'Disconnected';
      }
    }
  };
}

// --- Turn Banner ---
function showTurnBanner() {
  if (!gameConfig.networkMode) return;

  // Remove existing banner
  const existing = document.querySelector('.turn-banner');
  if (existing) existing.remove();

  const isMyTurn = Network.isMyTurn(gameState.currentPlayer);
  const banner = document.createElement('div');
  banner.className = `turn-banner ${isMyTurn ? 'your-turn' : 'opponent-turn'}`;
  banner.textContent = isMyTurn ? '🎯 YOUR TURN' : '⏳ OPPONENT\'S TURN';
  document.body.appendChild(banner);

  // Auto-remove after 2 seconds
  setTimeout(() => {
    banner.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    banner.style.transform = 'translateY(-100%)';
    banner.style.opacity = '0';
    setTimeout(() => banner.remove(), 300);
  }, 2000);
}

// Override switchTurn to show turn banner in network mode
const _originalSwitchTurn = switchTurn;
function switchTurnWithBanner() {
  _originalSwitchTurn();
  if (gameConfig.networkMode && !gameState.gameOver) {
    showTurnBanner();
  }
}
// Replace switchTurn
switchTurn = switchTurnWithBanner;

// --- Auto-Join from URL ---
function checkAutoJoin() {
  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  if (roomCode && roomCode.length === 4) {
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    // Show lobby and auto-join
    showMultiplayerLobby();
    setTimeout(() => {
      document.getElementById('join-room-input').value = roomCode.toUpperCase();
      handleJoinRoom();
    }, 500);
  }
}

// --- Cleanup on leaving game ---
const _originalShowMenu = showMenu;
function showMenuWithCleanup() {
  // Clean up network mode
  if (gameConfig.networkMode) {
    gameConfig.networkMode = false;
    Network.disconnect();
    const badge = document.getElementById('online-badge');
    if (badge) badge.style.display = 'none';
    const overlay = document.getElementById('disconnect-overlay');
    if (overlay) overlay.style.display = 'none';
    // Restore hidden buttons
    const undoBtn = document.getElementById('btn-undo');
    if (undoBtn) undoBtn.style.display = '';
    const flipBtn = document.getElementById('btn-flip-board');
    if (flipBtn) flipBtn.style.display = '';
  }
  // Remove any turn banners
  const banner = document.querySelector('.turn-banner');
  if (banner) banner.remove();

  _originalShowMenu();
}
showMenu = showMenuWithCleanup;

// --- Initialize Network ---
setupNetworkCallbacks();

// Check if we need to auto-join a room from URL
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAutoJoin);
} else {
  checkAutoJoin();
}

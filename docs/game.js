document.addEventListener('DOMContentLoaded', () => {
  // DOM references
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const overlayStart = document.getElementById('overlay-start');
  const overlayGameover = document.getElementById('overlay-gameover');
  const btnStart = document.getElementById('btn-start');
  const btnRestart = document.getElementById('btn-restart');
  const finalScore = document.getElementById('final-score');

  // --- Constants ---
  const CANVAS_W = 480, CANVAS_H = 640;
  const LANE_CENTERS = [80, 240, 400];
  const PLAYER_WIDTH = 40, PLAYER_HEIGHT = 60;
  const OBSTACLE_W = 40, OBSTACLE_H = 60;
  const OBSTACLE_INTERVAL_BASE = 90;
  const COIN_INTERVAL = 60;
  const SPEED_INITIAL = 4, SPEED_MAX = 12, SPEED_INCREMENT = 0.5, SPEED_INTERVAL = 300;
  // 障礙車 3 種速度倍率（相對於 gameState.speed）
  const OBS_SPEED_TYPES = [0.6, 1.0, 1.5];

  // --- Game state ---
  const gameState = { state: 'IDLE', score: 0, speed: SPEED_INITIAL, frame: 0, kmh: 60 };

  // --- Game objects ---
  let obstacles = [];
  let coins = [];

  const player = {
    lane: 1,
    x: LANE_CENTERS[1],
    targetX: LANE_CENTERS[1],
    y: CANVAS_H - 80 - PLAYER_HEIGHT,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    tilt: 0,        // 目前傾斜角（弧度）
    targetTilt: 0,  // 目標傾斜角
  };

  // --- Utility ---
  function pickRandom(arr, n) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  }

  // --- State management ---
  function startGame() {
    gameState.state = 'PLAYING';
    gameState.score = 0;
    gameState.speed = SPEED_INITIAL;
    gameState.frame = 0;
    gameState.kmh = 60;
    obstacles.length = 0;
    coins.length = 0;
    player.lane = 1;
    player.x = LANE_CENTERS[1];
    player.targetX = LANE_CENTERS[1];
    player.tilt = 0;
    player.targetTilt = 0;
    overlayStart.classList.add('hidden');
    overlayGameover.classList.add('hidden');
  }

  function endGame() {
    if (gameState.state !== 'PLAYING') return;
    gameState.state = 'GAME_OVER';
    finalScore.textContent = '最終分數：' + gameState.score;
    overlayGameover.classList.remove('hidden');
  }

  // --- Input ---
  function onKeyDown(e) {
    if (gameState.state !== 'PLAYING') return;
    if (e.key === 'ArrowRight') {
      player.lane = Math.min(2, player.lane + 1);
      player.targetTilt = 0.18;   // 向右傾
    } else if (e.key === 'ArrowLeft') {
      player.lane = Math.max(0, player.lane - 1);
      player.targetTilt = -0.18;  // 向左傾
    }
    player.targetX = LANE_CENTERS[player.lane];
  }

  document.addEventListener('keydown', onKeyDown);

  // --- Spawn logic ---
  function spawnObstacles() {
    const count = Math.random() < 0.5 ? 1 : 2;
    const blocked = pickRandom([0, 1, 2], count);
    blocked.forEach(lane => {
      // 隨機選一種速度類型
      const speedType = OBS_SPEED_TYPES[Math.floor(Math.random() * OBS_SPEED_TYPES.length)];
      obstacles.push({
        lane,
        x: LANE_CENTERS[lane],
        y: -OBSTACLE_H,
        width: OBSTACLE_W,
        height: OBSTACLE_H,
        speedType,
        // 依速度類型給不同顏色
        color: speedType < 0.8 ? '#ff9f1c' : speedType < 1.2 ? '#e94560' : '#9b2226',
      });
    });
  }

  function spawnCoin() {
    const lane = Math.floor(Math.random() * 3);
    const conflict = obstacles.some(o => o.lane === lane && o.y < 100);
    if (!conflict) {
      coins.push({ lane, x: LANE_CENTERS[lane], y: -20, radius: 15, collected: false });
    }
  }

  // --- Collision detection ---
  function isColliding(p, obs) {
    const px1 = p.x - p.width / 2 + 4;
    const px2 = p.x + p.width / 2 - 4;
    const py1 = p.y + 4;
    const py2 = p.y + p.height - 4;
    const ox1 = obs.x - obs.width / 2 + 4;
    const ox2 = obs.x + obs.width / 2 - 4;
    const oy1 = obs.y + 4;
    const oy2 = obs.y + obs.height - 4;
    return (px1 < ox2) && (px2 > ox1) && (py1 < oy2) && (py2 > oy1);
  }

  // --- Main loop ---
  function loop() {
    // 玩家橫移緩動
    player.x += (player.targetX - player.x) * 0.12;

    // 轉向傾斜緩動：靠近目標傾角；接近目標車道時回正
    const distToTarget = Math.abs(player.x - player.targetX);
    if (distToTarget < 5) player.targetTilt = 0;
    player.tilt += (player.targetTilt - player.tilt) * 0.15;

    if (gameState.state === 'PLAYING') {
      update();
    }
    render();
    requestAnimationFrame(loop);
  }

  function update() {
    gameState.frame++;

    // 加速
    if (gameState.frame % SPEED_INTERVAL === 0 && gameState.frame > 0) {
      gameState.speed = Math.min(gameState.speed + SPEED_INCREMENT, SPEED_MAX);
      gameState.kmh += Math.random() < 0.5 ? 2 : 3;
    }

    // 障礙車各自依 speedType 移動
    obstacles.forEach(o => { o.y += gameState.speed * o.speedType; });
    obstacles = obstacles.filter(o => o.y <= CANVAS_H);

    // Move coins
    coins.forEach(c => { c.y += gameState.speed; });
    coins = coins.filter(c => c.y - c.radius <= CANVAS_H && !c.collected);

    // Spawn
    const interval = Math.max(45, OBSTACLE_INTERVAL_BASE - Math.floor(gameState.speed) * 3);
    if (gameState.frame % interval === 0) spawnObstacles();
    if (gameState.frame % COIN_INTERVAL === 0) spawnCoin();

    // Coin collection
    coins.forEach(coin => {
      if (coin.collected) return;
      const dx = coin.x - player.x;
      const dy = (coin.y + coin.radius) - (player.y + player.height / 2);
      if (Math.sqrt(dx * dx + dy * dy) < coin.radius + 20) {
        coin.collected = true;
        gameState.score += 10;
      }
    });

    // Collision detection
    obstacles.forEach(obs => {
      if (isColliding(player, obs)) endGame();
    });
  }

  // --- Rendering ---
  function drawBackground() {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, 480, 640);

    ctx.fillStyle = '#424242';
    LANE_CENTERS.forEach(cx => {
      ctx.fillRect(cx - 75, 0, 150, 640);
    });

    ctx.strokeStyle = '#f5c518';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(5, 640); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(475, 0); ctx.lineTo(475, 640); ctx.stroke();

    const offset = (gameState.frame * gameState.speed) % 60;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.setLineDash([30, 30]);
    ctx.lineDashOffset = -offset;
    [160, 320].forEach(x => {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 640); ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  function drawCoins() {
    coins.filter(c => !c.collected).forEach(coin => {
      ctx.beginPath();
      ctx.arc(coin.x, coin.y + coin.radius, coin.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd60a';
      ctx.fill();
      ctx.strokeStyle = '#e9c46a';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  // 繪製俯視汽車，tilt 為車身傾斜角（弧度）
  function drawCar(x, y, w, h, bodyColor, tilt) {
    ctx.save();
    ctx.translate(x, y + h / 2);
    ctx.rotate(tilt || 0);
    ctx.translate(-x, -(y + h / 2));

    const r = 4;
    ctx.beginPath();
    ctx.roundRect(x - w/2, y, w, h, r);
    ctx.fillStyle = bodyColor;
    ctx.fill();

    ctx.fillStyle = 'rgba(180,230,255,0.7)';
    ctx.fillRect(x - w/2 + 5, y + 8, w - 10, h * 0.28);

    ctx.fillStyle = 'rgba(180,230,255,0.5)';
    ctx.fillRect(x - w/2 + 5, y + h - 8 - h * 0.18, w - 10, h * 0.18);

    ctx.fillStyle = '#111';
    const tyreW = 7, tyreH = 10;
    ctx.fillRect(x - w/2 - tyreW + 2, y + 6, tyreW, tyreH);
    ctx.fillRect(x + w/2 - 2, y + 6, tyreW, tyreH);
    ctx.fillRect(x - w/2 - tyreW + 2, y + h - 6 - tyreH, tyreW, tyreH);
    ctx.fillRect(x + w/2 - 2, y + h - 6 - tyreH, tyreW, tyreH);

    ctx.fillStyle = '#fffacd';
    ctx.fillRect(x - w/2 + 4, y + 2, 8, 4);
    ctx.fillRect(x + w/2 - 12, y + 2, 8, 4);

    ctx.restore();
  }

  function drawObstacles() {
    obstacles.forEach(obs => {
      drawCar(obs.x, obs.y, obs.width, obs.height, obs.color, 0);
    });
  }

  function drawPlayer() {
    drawCar(player.x, player.y, player.width, player.height, '#00b4d8', player.tilt);
  }

  function drawHUD() {
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = 'white';
    ctx.fillText('分數：' + gameState.score, 16, 32);
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#ffd60a';
    ctx.fillText(gameState.kmh + ' km/h', 16, 58);
  }

  function render() {
    drawBackground();
    drawCoins();
    drawObstacles();
    drawPlayer();
    drawHUD();
  }

  // --- Button bindings ---
  btnStart.addEventListener('click', startGame);
  btnRestart.addEventListener('click', startGame);

  requestAnimationFrame(loop);
});
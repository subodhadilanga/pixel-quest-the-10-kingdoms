(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const FLOOR = 470;
  const SAVE_KEY = "pixel-quest-save-v1";

  const kingdoms = [
    { name: "GREEN VALLEY", boss: "Mushroom King", sky: "#75d7ff", far: "#8fcf83", ground: "#49a84f", accent: "#f6d766", enemy: "#a5eb68" },
    { name: "DESERT OF DOOM", boss: "Sandworm King", sky: "#ffc87c", far: "#d99b55", ground: "#d7a348", accent: "#fff09a", enemy: "#b46b47" },
    { name: "FROZEN KINGDOM", boss: "Frost Dragon", sky: "#9ce5ff", far: "#8db9d7", ground: "#d5f3ff", accent: "#72dfff", enemy: "#a9f6ff" },
    { name: "DARK FOREST", boss: "Shadow Beast", sky: "#30375c", far: "#353b49", ground: "#52634b", accent: "#cb7cff", enemy: "#a56bda" },
    { name: "LAVA WORLD", boss: "Inferno Titan", sky: "#481d2b", far: "#8e382b", ground: "#54313a", accent: "#ff9b38", enemy: "#ff7046" },
    { name: "SKY KINGDOM", boss: "Storm Guardian", sky: "#75caff", far: "#a1d9e8", ground: "#d9efff", accent: "#fff27a", enemy: "#78bfff" },
    { name: "UNDERWATER CITY", boss: "Kraken", sky: "#126e9b", far: "#1d7891", ground: "#ab9d68", accent: "#79fff0", enemy: "#7ce6df" },
    { name: "HAUNTED CASTLE", boss: "Phantom King", sky: "#24213c", far: "#48425b", ground: "#625263", accent: "#97f7dc", enemy: "#d7d0f0" },
    { name: "CYBER WORLD", boss: "Mega Robot", sky: "#171c48", far: "#293d7c", ground: "#3d4c77", accent: "#5affef", enemy: "#fa63ff" },
    { name: "FINAL DARK KINGDOM", boss: "DARK OVERLORD", sky: "#1e102d", far: "#46223f", ground: "#46334c", accent: "#ff456b", enemy: "#d04772" }
  ];

  const saved = readSave();
  let unlocked = saved.unlocked;
  let bestScore = saved.score;
  let levelIndex = 0;
  let score = 0;
  let coins = 0;
  let lives = 3;
  let state = "menu";
  let soundOn = true;
  let audio = null;
  let tick = 0;
  let cameraX = 0;
  let shake = 0;
  let screenButtons = [];
  let keys = Object.create(null);
  let pressed = Object.create(null);
  let touchPointers = new Map();
  let platforms = [];
  let coinsOnMap = [];
  let powerups = [];
  let enemies = [];
  let shots = [];
  let particles = [];
  let boss = null;
  let checkpointX = 80;
  let levelMessage = 0;
  let bossIntro = 0;
  let worldWidth = 3000;
  let floatingMessage = "";

  const player = {
    x: 80, y: 0, w: 28, h: 40, vx: 0, vy: 0, facing: 1,
    hp: 5, maxHp: 5, jumps: 0, invuln: 0, attack: 0, attackCooldown: 0,
    fireTimer: 0, shield: 0, boost: 0, superMode: 0, anim: 0
  };

  function readSave() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
      return {
        unlocked: Math.max(1, Math.min(10, Number(data.unlocked) || 1)),
        score: Number(data.score) || 0
      };
    } catch {
      return { unlocked: 1, score: 0 };
    }
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        unlocked: Math.max(unlocked, levelIndex + 1),
        score: Math.max(bestScore, score)
      }));
    } catch {
      // localStorage may be unavailable
    }
  }

  function audioContext() {
    if (!soundOn) return null;
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      return audio;
    } catch {
      return null;
    }
  }

  function beep(freq = 440, duration = 0.08, type = "square", volume = 0.04) {
    const ac = audioContext();
    if (!ac) return;
    const oscillator = ac.createOscillator();
    const gain = ac.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, ac.currentTime);
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(ac.destination);
    oscillator.start();
    oscillator.stop(ac.currentTime + duration);
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
      a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function rand(seed) {
    let n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function pixelRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function stableDetail(seed) {
    const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function buildMission(index) {
    const layouts = [
      [[-65, 145, 0], [-10, 125, 0], [-105, 150, 0], [15, 175, 0]],
      [[-95, 190, 0], [-35, 115, 1], [-125, 170, 0], [5, 135, 1]],
      [[-130, 120, 0], [-85, 125, 0], [-40, 130, 0], [10, 150, 0]],
      [[-110, 110, 1], [-25, 115, 0], [-145, 105, 1], [-55, 125, 0]],
      [[-145, 115, 1], [-65, 105, 1], [5, 120, 1], [-120, 100, 1]],
      [[-155, 110, 0], [-95, 105, 0], [-35, 110, 0], [-125, 115, 0]],
      [[-40, 175, 0], [10, 150, 0], [-75, 160, 0], [20, 185, 0]],
      [[-120, 105, 1], [-50, 125, 1], [-140, 115, 1], [-30, 105, 0]],
      [[-105, 115, 0], [-35, 115, 0], [-105, 115, 0], [-35, 115, 0]],
      [[-155, 105, 1], [-95, 100, 1], [-30, 105, 1], [-130, 100, 1]]
    ];

    const pattern = layouts[index];
    const spacing = index === 5 ? 325 : index === 9 ? 300 : 315;

    for (let n = 0, x = 330; x < worldWidth - 360; n++, x += spacing) {
      const [offsetY, width, hazardous] = pattern[n % pattern.length];
      const y = Math.max(245, Math.min(390, 320 + offsetY));
      const platform = {
        x,
        y,
        w: width,
        h: 18,
        kind: "platform",
        moving: index === 5 && n % 3 === 1,
        phase: rand(index * 31 + n + 5) * 6
      };

      platforms.push(platform);

      if (n % 2 === 0) {
        coinsOnMap.push({ x: x + width / 2, y: y - 34, taken: false });
      }

      if (hazardous && width > 100) {
        const spikeWidth = Math.min(28, width - 58);
        platforms.push({
          x: x + width - spikeWidth - 8,
          y: y - 16,
          w: spikeWidth,
          h: 16,
          kind: "spike"
        });
      }

      if (n % 3 === 1) {
        enemies.push({
          x: x + 20,
          y: y - 30,
          w: 30,
          h: 30,
          vx: 40 + index * 3,
          min: x,
          max: x + width,
          hp: 1,
          alive: true,
          flying: index === 5 || index === 6 || index === 8
        });
      }
    }

    for (let x = 220, n = 0; x < worldWidth - 500; x += 690, n++) {
      coinsOnMap.push({ x: x + 80, y: FLOOR - 45, taken: false });

      if ([1, 3, 4, 7, 9].includes(index) && n % 2 === 1) {
        platforms.push({
          x: x + 260,
          y: FLOOR - 34,
          w: index === 4 || index === 9 ? 64 : 52,
          h: 34,
          kind: "spike"
        });
      }
    }
  }

  function setLevel(index) {
    levelIndex = index;
    const difficulty = index;
    worldWidth = 3000 + difficulty * 170;
    platforms = [{ x: 0, y: FLOOR, w: worldWidth, h: 100, kind: "ground" }];
    coinsOnMap = [];
    powerups = [];
    enemies = [];
    shots = [];
    particles = [];
    boss = null;
    checkpointX = 80;
    floatingMessage = "";
    cameraX = 0;
    shake = 0;
    bossIntro = 0;
    levelMessage = 2.2;

    buildMission(index);

    const powerTypes = ["speed", "double", "fire", "shield", "health", "super"];
    for (let i = 0; i < 6; i++) {
      const x = 520 + i * (worldWidth - 1000) / 5;
      powerups.push({ x, y: FLOOR - 38, type: powerTypes[(i + index) % powerTypes.length], taken: false });
    }

    player.x = 80;
    player.y = FLOOR - player.h;
    player.vx = 0;
    player.vy = 0;
    player.hp = player.maxHp;
    player.jumps = 0;
    player.invuln = 0;
    player.attack = 0;
    player.attackCooldown = 0;
    player.shield = 0;
    player.boost = 0;
    player.superMode = 0;
    player.fireTimer = 0;
    state = "playing";
    save();
  }

  function startGame(index = 0) {
    score = 0;
    coins = 0;
    lives = 3;
    setLevel(index);
  }

  function spawnParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 220,
        vy: (Math.random() - 0.8) * 220,
        life: 0.35 + Math.random() * 0.4,
        color,
        size: 3 + Math.random() * 4
      });
    }
  }

  function damagePlayer(amount = 1) {
    if (player.invuln > 0) return;

    if (player.shield > 0) {
      player.shield = 0;
      player.invuln = 0.65;
      spawnParticles(player.x + player.w / 2, player.y + 20, "#78f7ff", 14);
      beep(760, 0.12, "triangle");
      return;
    }

    player.hp -= amount;
    player.invuln = 1.15;
    player.vy = -260;
    player.vx = -player.facing * 150;
    shake = 7;
    beep(125, 0.18, "sawtooth");
    spawnParticles(player.x + player.w / 2, player.y + 20, "#ff6d82", 12);

    if (player.hp <= 0) {
      lives--;
      if (lives <= 0) {
        state = "gameover";
        bestScore = Math.max(bestScore, score);
        save();
      } else {
        player.hp = player.maxHp;
        player.x = checkpointX;
        player.y = FLOOR - player.h;
        player.vx = player.vy = 0;
        player.invuln = 1.8;
      }
    }
  }

  function jump() {
    if (player.jumps < 2) {
      player.vy = player.jumps === 0 ? -560 : -510;
      player.jumps++;
      beep(320 + player.jumps * 90, 0.09, "square");
      spawnParticles(player.x + player.w / 2, player.y + player.h, "#d7f4ff", 4);
    }
  }

  function attack() {
    if (player.attackCooldown > 0) return;
    player.attack = 0.18;
    player.attackCooldown = 0.34;
    beep(220, 0.07, "square", 0.025);

    const hit = {
      x: player.facing > 0 ? player.x + player.w : player.x - 34,
      y: player.y + 8, w: 34, h: 28
    };

    let damage = player.superMode > 0 ? 2 : 1;

    for (const enemy of enemies) {
      if (enemy.alive && rectsOverlap(hit, enemy)) {
        enemy.hp -= damage;
        spawnParticles(enemy.x + enemy.w / 2, enemy.y + 12, kingdoms[levelIndex].enemy, 8);
        if (enemy.hp <= 0) {
          enemy.alive = false;
          score += 100;
          beep(540, 0.1, "triangle");
        }
      }
    }

    if (boss && boss.hp > 0 && rectsOverlap(hit, boss) && boss.vulnerable > 0) {
      boss.hp -= damage;
      boss.hitFlash = 0.18;
      spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, "#fff09a", 12);
      shake = 4;
      beep(180, 0.12, "sawtooth");
      if (boss.hp <= 0) bossDefeated();
    }

    shots.push({
      x: player.facing > 0 ? player.x + player.w : player.x - 18,
      y: player.y + 11,
      w: 18,
      h: 18,
      vx: player.facing * 470,
      friendly: true,
      life: 1.5,
      damage: player.superMode > 0 || player.fireTimer > 0 ? 2 : 1,
      kind: "plasma"
    });
  }

  function spawnBoss() {
    if (boss) return;
    const final = levelIndex === 9;
    boss = {
      x: worldWidth - 240, y: FLOOR - (final ? 112 : 86),
      w: final ? 92 : 72, h: final ? 112 : 86,
      hp: final ? 30 : 10 + levelIndex * 2,
      maxHp: final ? 30 : 10 + levelIndex * 2,
      phase: 0, timer: 1.4, vulnerable: 0, hitFlash: 0,
      vx: 0, final
    };
    bossIntro = 2.6;
    beep(90, 0.6, "sawtooth", 0.08);
  }

  function bossDefeated() {
    score += 1000 + levelIndex * 200;
    spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, "#ffe88a", 35);
    shake = 0;
    boss = null;
    state = levelIndex === 9 ? "victory" : "levelclear";
    unlocked = Math.max(unlocked, levelIndex + 2);
    bestScore = Math.max(bestScore, score);
    save();
    beep(660, 0.25, "triangle", 0.06);
    setTimeout(() => beep(880, 0.35, "triangle", 0.06), 180);
  }

  function update(dt) {
    tick += dt;
    shake = Math.max(0, shake - dt * 20);

    if (state !== "playing") {
      updateParticles(dt);
      return;
    }

    const left = keys.ArrowLeft || keys.KeyA || touchPointers.has("left");
    const right = keys.ArrowRight || keys.KeyD || touchPointers.has("right");
    const running = keys.ShiftLeft || keys.ShiftRight || touchPointers.has("run");
    const speed = (running ? 300 : 220) * (player.boost > 0 ? 1.45 : 1);

    if (left) {
      player.vx = -speed;
      player.facing = -1;
    } else if (right) {
      player.vx = speed;
      player.facing = 1;
    } else {
      player.vx *= Math.pow(0.001, dt);
      if (Math.abs(player.vx) < 4) player.vx = 0;
    }

    if (pressed.Space || pressed.ArrowUp || pressed.KeyW || touchPointers.has("jump")) jump();
    if (pressed.KeyX || touchPointers.has("attack")) attack();

    player.vy += 1450 * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = Math.max(0, Math.min(worldWidth - player.w, player.x));

    for (const p of platforms) {
      if (p.moving) {
        p.x += Math.sin(tick * 1.4 + p.phase) * 18 * dt;
      }
    }

    let grounded = false;

    for (const p of platforms) {
      if (p.kind === "spike") {
        if (rectsOverlap(player, p)) damagePlayer(1);
        continue;
      }

      const wasAbove = player.y + player.h - player.vy * dt <= p.y + 8;
      if (player.vy >= 0 && wasAbove &&
          player.x + player.w > p.x && player.x < p.x + p.w &&
          player.y + player.h >= p.y && player.y + player.h < p.y + p.h + 22) {
        player.y = p.y - player.h;
        player.vy = 0;
        grounded = true;
      }
    }

    if (grounded) player.jumps = 0;

    if (player.y > H + 100) {
      damagePlayer(1);
      player.x = checkpointX;
      player.y = FLOOR - player.h;
      player.vy = 0;
    }

    player.anim += dt * (Math.abs(player.vx) > 20 ? 12 : 4);
    player.invuln = Math.max(0, player.invuln - dt);
    player.attack = Math.max(0, player.attack - dt);
    player.attackCooldown = Math.max(0, player.attackCooldown - dt);
    player.boost = Math.max(0, player.boost - dt);
    player.superMode = Math.max(0, player.superMode - dt);
    player.fireTimer = Math.max(0, player.fireTimer - dt);
    levelMessage = Math.max(0, levelMessage - dt);
    bossIntro = Math.max(0, bossIntro - dt);

    for (const c of coinsOnMap) {
      if (!c.taken && Math.abs(player.x + player.w / 2 - c.x) < 22 &&
          Math.abs(player.y + player.h / 2 - c.y) < 30) {
        c.taken = true;
        coins++;
        score += 25;
        beep(880, 0.06, "square", 0.035);
        spawnParticles(c.x, c.y, "#ffe46b", 6);
      }
    }

    for (const p of powerups) {
      if (!p.taken && rectsOverlap(player, { x: p.x, y: p.y, w: 25, h: 25 })) {
        p.taken = true;
        applyPowerup(p.type);
      }
    }

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      enemy.x += enemy.vx * dt;
      if (enemy.x < enemy.min || enemy.x + enemy.w > enemy.max + 36) enemy.vx *= -1;
      if (enemy.flying) enemy.y += Math.sin(tick * 3 + enemy.x) * 20 * dt;

      if (rectsOverlap(player, enemy)) {
        const stomping = player.vy > 80 && player.y + player.h - 12 < enemy.y + 14;
        if (stomping) {
          enemy.alive = false;
          player.vy = -330;
          score += 100;
          beep(500, 0.08, "triangle");
        } else {
          damagePlayer(1);
        }
      }
    }

    updateShots(dt);
    updateBoss(dt);

    checkpointX = Math.max(checkpointX, Math.floor(player.x / 900) * 900 + 50);
    cameraX = Math.max(0, Math.min(worldWidth - W, player.x - W * 0.38));
    updateParticles(dt);
    pressed = Object.create(null);
  }

  function applyPowerup(type) {
    const messages = {
      speed: "SPEED BOOST!",
      double: "DOUBLE JUMP!",
      fire: "FIREBALL!",
      shield: "SHIELD!",
      health: "HEALTH RESTORED!",
      super: "SUPER MODE!"
    };

    if (type === "speed") player.boost = 9;
    if (type === "double") player.jumps = Math.min(player.jumps, 1);
    if (type === "fire") player.fireTimer = 12;
    if (type === "shield") player.shield = 1;
    if (type === "health") player.hp = Math.min(player.maxHp, player.hp + 2);
    if (type === "super") player.superMode = 10;

    levelMessage = 1.5;
    floatingMessage = messages[type] || "POWER UP!";
    beep(700, 0.12, "triangle");
    spawnParticles(player.x + 14, player.y + 12, "#8fffe8", 14);
  }

  function updateShots(dt) {
    for (const shot of shots) {
      shot.x += shot.vx * dt;
      shot.life -= dt;

      if (!shot.friendly && rectsOverlap(player, shot)) {
        damagePlayer(1);
        shot.life = 0;
      }

      if (shot.friendly) {
        for (const enemy of enemies) {
          if (enemy.alive && rectsOverlap(shot, enemy)) {
            enemy.hp -= shot.damage;
            shot.life = 0;
            if (enemy.hp <= 0) {
              enemy.alive = false;
              score += 100;
              spawnParticles(enemy.x + 12, enemy.y + 12, "#ff9d59", 8);
            }
          }
        }

        if (boss && boss.hp > 0 && rectsOverlap(shot, boss) && boss.vulnerable > 0) {
          boss.hp -= shot.damage;
          boss.hitFlash = 0.18;
          shot.life = 0;
          spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, "#fff09a", 8);
          if (boss.hp <= 0) bossDefeated();
        }
      }
    }

    shots = shots.filter(s => s.life > 0 && s.x > cameraX - 100 && s.x < cameraX + W + 100);
  }

  function updateBoss(dt) {
    if (!boss) {
      if (player.x > worldWidth - 600) spawnBoss();
      return;
    }
    if (boss.hp <= 0) return;

    const aggression = 1 + (1 - boss.hp / boss.maxHp) * (boss.final ? 1.5 : 0.8);
    boss.timer -= dt;
    boss.hitFlash = Math.max(0, boss.hitFlash - dt);
    boss.vulnerable = Math.max(0, boss.vulnerable - dt);
    boss.x += Math.sin(tick * 1.2) * 16 * dt;

    if (boss.timer <= 0) {
      boss.phase = (boss.phase + 1) % (boss.final ? 4 : 3);

      if (boss.phase === 0) {
        boss.vulnerable = 1.25;
        boss.timer = Math.max(0.65, 1.4 / aggression);
      } else {
        boss.timer = Math.max(0.5, (1.3 + Math.random() * 0.5) / aggression);

        const count = boss.final ? 3 : (levelIndex > 5 ? 2 : 1);
        for (let i = 0; i < count; i++) {
          const direction = player.x < boss.x ? -1 : 1;
          shots.push({
            x: boss.x + (direction < 0 ? 0 : boss.w - 8),
            y: boss.y + 30 + i * 18, w: 18, h: 16,
            vx: direction * (190 + levelIndex * 12) + (i - 1) * 25,
            friendly: false, life: 3
          });
        }

        if (boss.phase === 2) {
          shake = 5;
          if (Math.abs(player.x - boss.x) < 190) damagePlayer(1);
        }
      }
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 280 * dt;
      p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function draw() {
    const theme = kingdoms[levelIndex] || kingdoms[0];
    ctx.save();

    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    drawBackground(theme);

    if (["playing", "paused", "levelclear", "victory", "gameover"].includes(state)) {
      ctx.save();
      ctx.translate(-cameraX, 0);
      drawPlatforms(theme);
      drawCoins();
      drawPowerups();
      drawEnemies(theme);
      drawShots();
      drawBoss(theme);
      drawPlayer();
      drawParticles();
      ctx.restore();
      drawHUD(theme);
    }

    if (state === "menu") drawMenu(theme);
    if (state === "select") drawLevelSelect();
    if (state === "help") drawHelp();
    if (state === "paused") drawOverlay("PAUSED", "Take a breather, hero.", [["RESUME", "resume"], ["MAIN MENU", "menu"]]);
    if (state === "levelclear") drawOverlay("KINGDOM CLEARED!", `${kingdoms[levelIndex].name} is safe!`, [["NEXT KINGDOM", "next"], ["MAIN MENU", "menu"]]);
    if (state === "gameover") drawOverlay("GAME OVER", `Final score: ${score}`, [["TRY AGAIN", "retry"], ["MAIN MENU", "menu"]]);
    if (state === "victory") drawOverlay("THE KINGDOMS ARE FREE!", `You defeated the Dark Overlord!  Score: ${score}`, [["PLAY AGAIN", "retry"], ["MAIN MENU", "menu"]]);

    ctx.restore();
  }

  function drawMissionScenery() {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const x = ((i * 190 - cameraX * 0.25) % (W + 240) + W + 240) % (W + 240) - 100;
      const baseY = 365 + (i % 3) * 14;

      switch (levelIndex) {
        case 0:
          pixelRect(x + 45, baseY - 45, 16, 95, "#684b3e");
          pixelRect(x + 20, baseY - 82, 65, 45, "#247a4a");
          pixelRect(x + 7, baseY - 62, 33, 34, "#35a958");
          pixelRect(x + 63, baseY - 64, 34, 34, "#35a958");
          pixelRect(x + 31, baseY - 76, 17, 7, "#78db68");
          break;

        case 1:
          pixelRect(x + 40, baseY - 60, 16, 60, "#31805d");
          pixelRect(x + 25, baseY - 43, 16, 9, "#31805d");
          pixelRect(x + 25, baseY - 54, 9, 20, "#31805d");
          pixelRect(x + 56, baseY - 32, 15, 8, "#31805d");
          pixelRect(x + 62, baseY - 48, 9, 23, "#31805d");
          pixelRect(x + 93, baseY - 28, 54, 28, "#9d704b");
          pixelRect(x + 104, baseY - 44, 31, 16, "#bd8851");
          break;

        case 2:
          pixelRect(x + 38, baseY - 70, 18, 70, "#8eeeff");
          pixelRect(x + 30, baseY - 44, 34, 44, "#52b7dc");
          pixelRect(x + 75, baseY - 47, 13, 47, "#c8f7ff");
          pixelRect(x + 69, baseY - 27, 24, 27, "#76d9ed");
          break;

        case 3:
          pixelRect(x + 46, baseY - 74, 15, 82, "#302d43");
          pixelRect(x + 37, baseY - 52, 33, 9, "#302d43");
          pixelRect(x + 23, baseY - 91, 63, 39, "#26364a");
          pixelRect(x + 15, baseY - 71, 35, 22, "#334650");
          pixelRect(x + 67, baseY - 77, 29, 24, "#334650");
          pixelRect(x + 42, baseY - 82, 8, 5, "#a15cbb");
          break;

        case 4:
          pixelRect(x + 20, baseY - 31, 68, 31, "#4b303a");
          pixelRect(x + 33, baseY - 49, 40, 18, "#61343a");
          pixelRect(x + 45, baseY - 22, 36, 5, "#ff6d33");
          pixelRect(x + 51, baseY - 17, 22, 4, "#ffd253");
          pixelRect(x + 101, baseY - 38, 12, 38, "#322638");
          pixelRect(x + 96, baseY - 47, 22, 12, "#45303a");
          break;

        case 5:
          pixelRect(x + 15, baseY - 68, 94, 12, "#dcefff");
          pixelRect(x + 28, baseY - 56, 68, 12, "#8da9c9");
          pixelRect(x + 45, baseY - 44, 35, 20, "#657da6");
          pixelRect(x + 117, baseY - 102, 52, 9, "#e9f8ff");
          pixelRect(x + 126, baseY - 93, 34, 13, "#8da9c9");
          break;

        case 6:
          pixelRect(x + 29, baseY - 35, 10, 35, "#ee759a");
          pixelRect(x + 18, baseY - 51, 9, 23, "#ee759a");
          pixelRect(x + 38, baseY - 58, 9, 30, "#ff9d79");
          pixelRect(x + 73, baseY - 45, 8, 45, "#55d4b0");
          pixelRect(x + 63, baseY - 66, 9, 28, "#55d4b0");
          pixelRect(x + 83, baseY - 70, 9, 32, "#55d4b0");
          break;

        case 7:
          pixelRect(x + 25, baseY - 85, 78, 85, "#343147");
          pixelRect(x + 14, baseY - 69, 24, 69, "#29263b");
          pixelRect(x + 88, baseY - 73, 28, 73, "#29263b");
          pixelRect(x + 47, baseY - 104, 35, 24, "#343147");
          pixelRect(x + 43, baseY - 50, 11, 22, "#c86de5");
          pixelRect(x + 72, baseY - 50, 11, 22, "#c86de5");
          break;

        case 8:
          pixelRect(x + 14, baseY - 95, 37, 95, "#253768");
          pixelRect(x + 56, baseY - 68, 48, 68, "#334578");
          pixelRect(x + 109, baseY - 112, 33, 112, "#253768");
          for (let row = 0; row < 4; row++) {
            pixelRect(x + 22, baseY - 82 + row * 17, 9, 5, "#5affef");
            pixelRect(x + 117, baseY - 98 + row * 18, 9, 5, "#fa63ff");
          }
          break;

        case 9:
          pixelRect(x + 18, baseY - 82, 31, 82, "#32243e");
          pixelRect(x + 13, baseY - 96, 17, 14, "#32243e");
          pixelRect(x + 67, baseY - 107, 41, 107, "#281c39");
          pixelRect(x + 77, baseY - 126, 20, 20, "#281c39");
          pixelRect(x + 111, baseY - 69, 42, 69, "#39243f");
          pixelRect(x + 28, baseY - 61, 8, 19, "#ff456b");
          pixelRect(x + 82, baseY - 72, 10, 23, "#ff456b");
          break;
      }
    }
  }

  function drawBackground(theme) {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, theme.sky);
    gradient.addColorStop(0.7, theme.far);
    gradient.addColorStop(1, theme.ground);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const darkWorld = [3, 7, 8, 9].includes(levelIndex);
    const underwater = levelIndex === 6;
    const castleWorld = [3, 7, 9].includes(levelIndex);

    if (darkWorld || underwater) {
      for (let i = 0; i < 70; i++) {
        const px = ((i * 149 - cameraX * 0.08) % (W + 20) + W + 20) % (W + 20);
        const py = 24 + (i * 67) % 310;
        const twinkle = Math.sin(tick * 2 + i) > 0;
        pixelRect(px, py, i % 5 === 0 ? 3 : 2, i % 5 === 0 ? 3 : 2,
          underwater ? "#9df7ff88" : (twinkle ? "#c9e6ffbb" : "#c9e6ff55"));
      }
    }

    if (!darkWorld && !underwater) {
      pixelRect(720, 74, 54, 54, "#fff3ad");
      pixelRect(712, 82, 70, 38, "#fff3ad");
      pixelRect(728, 66, 38, 70, "#fff3ad");
      pixelRect(730, 80, 35, 38, "#fffbd7");
    } else if (darkWorld) {
      pixelRect(744, 67, 45, 45, "#c8d8ff");
      pixelRect(735, 75, 58, 28, "#c8d8ff");
      pixelRect(758, 59, 26, 58, "#c8d8ff");
      pixelRect(762, 68, 34, 30, theme.sky);
    }

    const mountainOffset = cameraX * 0.12;
    for (let i = 0; i < 9; i++) {
      const x = ((i * 165 - mountainOffset) % (W + 190)) - 90;
      const baseY = 360 + (i % 3) * 15;
      const peak = 115 + (i % 4) * 18;
      ctx.fillStyle = i % 2 ? theme.far : `${theme.far}cc`;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + 35, baseY - peak * 0.55);
      ctx.lineTo(x + 58, baseY - peak);
      ctx.lineTo(x + 80, baseY - peak * 0.5);
      ctx.lineTo(x + 116, baseY);
      ctx.closePath();
      ctx.fill();

      if (levelIndex === 2 || levelIndex === 5) {
        pixelRect(x + 49, baseY - peak + 18, 18, 7, "#e7fbff");
        pixelRect(x + 42, baseY - peak + 26, 10, 5, "#e7fbff");
        pixelRect(x + 68, baseY - peak + 25, 11, 6, "#e7fbff");
      }
    }

    if (castleWorld) {
      const castleX = 380 - cameraX * 0.2;
      const castleColor = levelIndex === 9 ? "#281b3d" : "#202a4b";
      pixelRect(castleX, 215, 210, 170, castleColor);
      pixelRect(castleX - 28, 264, 52, 121, castleColor);
      pixelRect(castleX + 188, 254, 56, 131, castleColor);
      pixelRect(castleX + 15, 183, 35, 74, castleColor);
      pixelRect(castleX + 165, 170, 38, 85, castleColor);
      pixelRect(castleX + 82, 145, 44, 100, castleColor);
      pixelRect(castleX + 95, 125, 18, 28, castleColor);

      for (let i = 0; i < 10; i++) {
        pixelRect(castleX + i * 22, 204, 12, 12, castleColor);
      }

      const windowColor = levelIndex === 9 ? "#ff4f91" : "#bd5bea";
      for (let i = 0; i < 5; i++) {
        pixelRect(castleX + 34 + i * 38, 286, 12, 27, windowColor);
        pixelRect(castleX + 36 + i * 38, 281, 8, 7, "#ffc5ff");
      }

      pixelRect(castleX + 75, 294, 58, 91, "#401c56");
      pixelRect(castleX + 85, 276, 38, 18, "#783477");
      pixelRect(castleX + 94, 308, 20, 77, windowColor);
      pixelRect(castleX + 99, 314, 10, 71, "#f29bff");
    }

    drawMissionScenery();

    const hillOffset = cameraX * 0.32;
    for (let i = 0; i < 8; i++) {
      const x = ((i * 180 - hillOffset) % (W + 210)) - 105;
      const y = 347 + Math.sin(i * 2) * 22;

      pixelRect(x + 20, y, 132, 150, theme.far);
      pixelRect(x + 4, y + 24, 164, 125, theme.far);
      pixelRect(x + 35, y - 16, 100, 25, theme.far);

      if (levelIndex === 0 || levelIndex === 3) {
        const trunk = levelIndex === 3 ? "#312b43" : "#684b3e";
        const leaves = levelIndex === 3 ? "#26344b" : "#267a4a";
        pixelRect(x + 76, y + 55, 18, 100, trunk);
        pixelRect(x + 44, y + 4, 76, 48, leaves);
        pixelRect(x + 28, y + 18, 35, 36, leaves);
        pixelRect(x + 99, y + 15, 42, 34, leaves);
        pixelRect(x + 48, y + 9, 20, 9, levelIndex === 3 ? "#476052" : "#44b965");
        pixelRect(x + 103, y + 20, 18, 8, levelIndex === 3 ? "#476052" : "#44b965");
      }
    }

    for (let i = 0; i < 6; i++) {
      const x = ((i * 215 + tick * (8 + i) - cameraX * 0.06) % (W + 120)) - 60;
      const y = 55 + i * 31 + Math.sin(tick + i) * 5;
      const cloud = darkWorld ? "#a5b6dd55" : "#ffffff88";
      pixelRect(x + 12, y, 48, 13, cloud);
      pixelRect(x + 22, y - 9, 28, 11, cloud);
      pixelRect(x + 3, y + 6, 18, 8, cloud);
      pixelRect(x + 50, y + 5, 19, 8, cloud);
    }

    if (levelIndex === 3 || levelIndex === 7 || levelIndex === 9) {
      ctx.fillStyle = "#392a5550";
      ctx.fillRect(0, 350, W, 105);

      for (let i = 0; i < 5; i++) {
        const x = ((i * 245 + tick * 9 - cameraX * 0.15) % (W + 300)) - 150;
        pixelRect(x, 388 + Math.sin(tick + i) * 8, 170, 12, "#d5b6ff16");
      }
    }

    if (underwater) {
      ctx.fillStyle = "#03739b44";
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < 7; i++) {
        const x = i * 155 + Math.sin(tick * 0.5 + i) * 24;
        ctx.fillStyle = "#a9f7ff15";
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 45, 0);
        ctx.lineTo(x + 120, H);
        ctx.lineTo(x + 75, H);
        ctx.fill();
      }
    }
  }

  function drawPlatforms(theme) {
    for (const p of platforms) {
      if (p.x + p.w < cameraX - 24 || p.x > cameraX + W + 24) continue;

      if (p.kind === "spike") {
        pixelRect(p.x, p.y + p.h - 5, p.w, 5, "#512f42");
        for (let i = 0; i < p.w; i += 13) {
          ctx.fillStyle = "#d8dce8";
          ctx.beginPath();
          ctx.moveTo(p.x + i, p.y + p.h);
          ctx.lineTo(p.x + i + 7, p.y);
          ctx.lineTo(p.x + i + 14, p.y + p.h);
          ctx.closePath();
          ctx.fill();
          pixelRect(p.x + i + 5, p.y + 8, 3, 9, "#fff");
        }
        continue;
      }

      const platformPalettes = [
        ["#9a604e", "#603d50", "#16a957", "#42e176"],
        ["#a7663e", "#694236", "#d29a45", "#ffe08a"],
        ["#8caebe", "#506b86", "#d9f5ff", "#ffffff"],
        ["#454357", "#22263c", "#4c5c48", "#8f6caa"],
        ["#713b3a", "#301f36", "#f06435", "#ffb34a"],
        ["#7287a5", "#46536e", "#d9efff", "#fff27a"],
        ["#856e54", "#443d51", "#3eaa9f", "#79fff0"],
        ["#57465f", "#2e263c", "#71607c", "#97f7dc"],
        ["#394e80", "#1e2850", "#3f85bd", "#5affef"],
        ["#57344e", "#281c3a", "#8e3156", "#ff456b"]
      ];

      const [dirt, shadow, grass, topLight] = platformPalettes[levelIndex];

      pixelRect(p.x, p.y + 5, p.w, p.h - 5, dirt);
      pixelRect(p.x, p.y + 12, p.w, Math.max(0, p.h - 12), "#00000018");
      pixelRect(p.x, p.y + p.h - 5, p.w, 5, shadow);
      pixelRect(p.x, p.y, p.w, 8, grass);
      pixelRect(p.x, p.y, p.w, 3, topLight);

      const tileStart = Math.floor(p.x / 16);
      for (let i = 0; i < Math.ceil(p.w / 16); i++) {
        const seed = tileStart + i * 13 + levelIndex * 71;
        const xx = p.x + i * 16;
        const highlight = stableDetail(seed) > 0.42;
        pixelRect(xx + 2, p.y + 1, 7, 2, highlight ? "#8aff91" : "#0f804b");
        if (stableDetail(seed + 9) > 0.65) {
          pixelRect(xx + 4, p.y - 3, 3, 4, topLight);
        }
      }

      if (p.kind !== "ground") {
        for (let i = 0; i < Math.ceil(p.w / 22); i++) {
          const seed = Math.floor(p.x / 22) + i * 31 + levelIndex * 19;
          const xx = p.x + i * 22 + 4;
          const yy = p.y + 16 + stableDetail(seed) * Math.max(2, p.h - 22);
          pixelRect(xx, yy, 9, 3, shadow);
          pixelRect(xx + 2, yy - 4, 3, 5, "#d69575");
          if (stableDetail(seed + 1) > 0.55) {
            pixelRect(xx + 11, yy + 7, 5, 3, "#bb7b67");
          }
        }
      } else {
        const firstTile = Math.floor(p.x / 48) * 48;
        for (let xx = firstTile; xx < p.x + p.w; xx += 48) {
          pixelRect(xx, p.y + 13, 2, Math.max(0, p.h - 18), "#3c394f55");
          pixelRect(xx + 8, p.y + 24, 12, 3, "#c17c6655");
          pixelRect(xx + 28, p.y + 42, 8, 3, shadow);
        }
      }
    }
  }

  function drawCoins() {
    for (const c of coinsOnMap) {
      if (c.taken) continue;

      pixelRect(c.x - 7, c.y - 10, 14, 20, "#ffcf3f");
      pixelRect(c.x - 3, c.y - 7, 4, 14, "#fff19b");
      pixelRect(c.x + 4, c.y - 5, 2, 10, "#b66b2b");
    }
  }

  function drawPowerups() {
    const colors = {
      speed: "#ff8c56",
      double: "#b77aff",
      fire: "#ff553f",
      shield: "#59eaff",
      health: "#70ee84",
      super: "#ffe65c"
    };

    for (const p of powerups) {
      if (p.taken) continue;

      const color = colors[p.type];
      pixelRect(p.x, p.y, 25, 25, color);
      pixelRect(p.x + 6, p.y + 5, 5, 5, "#fff");
      pixelRect(p.x + 15, p.y + 5, 5, 5, "#fff");
      pixelRect(p.x + 8, p.y + 17, 10, 3, "#18213c");
    }
  }

  function drawEnemies(theme) {
    for (const e of enemies) {
      if (!e.alive) continue;

      pixelRect(e.x, e.y + 7, e.w, e.h - 7, theme.enemy);
      pixelRect(e.x + 4, e.y, e.w - 8, 10, "#00000022");
      pixelRect(e.x + 7, e.y + 12, 6, 6, "#fff");
      pixelRect(e.x + e.w - 13, e.y + 12, 6, 6, "#fff");
      pixelRect(e.x + 9, e.y + 14, 3, 4, "#18213c");
      pixelRect(e.x + e.w - 11, e.y + 14, 3, 4, "#18213c");
      pixelRect(e.x + 5, e.y + e.h - 3, 8, 5, "#282039");
      pixelRect(e.x + e.w - 13, e.y + e.h - 3, 8, 5, "#282039");
    }
  }

  function drawShots() {
    for (const shot of shots) {
      if (shot.kind === "plasma") {
        const cx = shot.x + shot.w / 2;
        const cy = shot.y + shot.h / 2;
        const pulse = Math.sin(tick * 20 + shot.x * 0.05) * 2;

        ctx.save();
        ctx.shadowColor = "#46eaff";
        ctx.shadowBlur = 18;

        const tailX = shot.vx > 0 ? shot.x - 13 : shot.x + shot.w + 3;
        pixelRect(tailX, cy - 3, 10, 6, "#268cff");
        pixelRect(tailX + (shot.vx > 0 ? 3 : -3), cy - 1, 7, 3, "#8bfaff");

        pixelRect(cx - 8 - pulse / 2, cy - 8 - pulse / 2, 16 + pulse, 16 + pulse, "#1375ff");
        pixelRect(cx - 6, cy - 6, 12, 12, "#45eaff");
        pixelRect(cx - 3, cy - 4, 7, 8, "#e7ffff");
        pixelRect(cx - 1, cy - 2, 3, 4, "#ffffff");

        ctx.restore();
      } else {
        pixelRect(shot.x, shot.y, shot.w, shot.h, kingdoms[levelIndex].accent);
        pixelRect(shot.x + 4, shot.y + 3, 5, 4, "#fff3bb");
      }
    }
  }

  function drawBoss(theme) {
    if (!boss) return;

    const x = Math.round(boss.x);
    const y = Math.round(boss.y);
    const w = boss.w;
    const h = boss.h;
    const color = boss.hitFlash > 0 ? "#fff" : theme.enemy;
    const isCastleBoss = [3, 7, 9].includes(levelIndex);

    ctx.globalAlpha = 0.35;
    pixelRect(x - 12, y + h - 4, w + 24, 12, "#111323");
    ctx.globalAlpha = 1;

    pixelRect(x + 13, y + h - 28, Math.floor(w * 0.28), 25, "#333149");
    pixelRect(x + Math.floor(w * 0.59), y + h - 28, Math.floor(w * 0.28), 25, "#333149");
    pixelRect(x + 7, y + h - 9, Math.floor(w * 0.36), 10, "#171b31");
    pixelRect(x + Math.floor(w * 0.56), y + h - 9, Math.floor(w * 0.38), 10, "#171b31");

    pixelRect(x + 8, y + 23, w - 16, h - 39, isCastleBoss ? "#51445d" : color);
    pixelRect(x + 12, y + 26, w - 24, 10, theme.accent);
    pixelRect(x + 17, y + 38, w - 34, Math.max(8, h - 76), "#777186");
    pixelRect(x + 20, y + 41, 5, h - 82, "#d6c6a1");
    pixelRect(x + w - 25, y + 41, 5, h - 82, "#d6c6a1");

    pixelRect(x - 1, y + 25, 21, 37, color);
    pixelRect(x + w - 20, y + 25, 21, 37, color);
    pixelRect(x + 2, y + 28, 17, 7, theme.accent);
    pixelRect(x + w - 19, y + 28, 17, 7, theme.accent);
    pixelRect(x + 4, y + 39, 12, 4, "#fff0bc");
    pixelRect(x + w - 16, y + 39, 12, 4, "#fff0bc");

    pixelRect(x + 15, y + 2, w - 30, 28, isCastleBoss ? "#34283f" : color);
    pixelRect(x + 19, y + 8, w - 38, 19, "#d3b792");
    pixelRect(x + 17, y + 1, w - 34, 8, isCastleBoss ? "#271c36" : theme.accent);
    pixelRect(x + 23, y + 13, 10, 7, "#fff");
    pixelRect(x + w - 33, y + 13, 10, 7, "#fff");
    pixelRect(x + 26, y + 15, 7, 5, "#ff416e");
    pixelRect(x + w - 30, y + 15, 7, 5, "#ff416e");

    if (boss.final || isCastleBoss) {
      pixelRect(x + 16, y - 6, 8, 12, "#d79b48");
      pixelRect(x + w - 24, y - 6, 8, 12, "#d79b48");
      pixelRect(x + Math.floor(w / 2) - 7, y - 13, 14, 19, "#f0bf62");
      pixelRect(x + Math.floor(w / 2) - 3, y - 9, 6, 13, "#fff0a0");

      const shieldX = x + w - 4;
      pixelRect(shieldX, y + 43, 26, Math.max(35, h - 55), "#9c652f");
      pixelRect(shieldX + 4, y + 48, 17, Math.max(25, h - 68), "#d79943");
      pixelRect(shieldX + 8, y + 58, 9, 8, "#ffe28a");
      pixelRect(shieldX + 10, y + 67, 5, Math.max(12, h - 91), "#74452e");
      pixelRect(shieldX + 4, y + h - 17, 18, 5, "#ffca62");

      pixelRect(x - 15, y + 34, 7, h - 42, "#d6d7dc");
      pixelRect(x - 20, y + 38, 17, 7, "#eac46d");
      pixelRect(x - 15, y + 22, 7, 15, "#9a6b45");
    } else {
      pixelRect(x + Math.floor(w / 2) - 5, y + 30, 10, 14, theme.accent);
      pixelRect(x + Math.floor(w / 2) - 2, y + 32, 4, 9, "#fff5c2");
    }

    if (boss.vulnerable > 0) {
      ctx.strokeStyle = "#fff6a8";
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 6, y - 6, w + 12, h + 12);
      pixelRect(x + 3, y - 10, 8, 3, "#fff6a8");
      pixelRect(x + w - 11, y - 10, 8, 3, "#fff6a8");
    }
  }

  function drawPlayer() {
    if (player.invuln > 0 && Math.floor(tick * 16) % 2) return;

    const x = Math.round(player.x);
    const y = Math.round(player.y);
    const step = Math.sin(player.anim) * (Math.abs(player.vx) > 20 ? 4 : 1);
    const facingRight = player.facing > 0;

    ctx.globalAlpha = 0.28;
    pixelRect(x - 3, y + player.h - 2, player.w + 7, 5, "#101326");
    ctx.globalAlpha = 1;

    if (player.shield > 0) {
      ctx.strokeStyle = "#8ff8ff";
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 6, y - 6, player.w + 12, player.h + 12);
      pixelRect(x - 8, y + 8, 3, 3, "#e8ffff");
      pixelRect(x + player.w + 5, y + 21, 3, 3, "#e8ffff");
    }

    pixelRect(x + 4, y + 31, 9, 8 + Math.max(0, step), "#23304d");
    pixelRect(x + 16, y + 31, 9, 8 + Math.max(0, -step), "#23304d");
    pixelRect(x + 2, y + 36, 12, 4, "#17223d");
    pixelRect(x + 15, y + 36, 12, 4, "#17223d");

    pixelRect(x + 3, y + 16, 22, 18, "#2368b6");
    pixelRect(x + 5, y + 18, 7, 13, "#398be0");
    pixelRect(x + 3, y + 30, 22, 4, "#163f79");
    pixelRect(x + 5, y + 27, 18, 3, "#edc66c");
    pixelRect(x + 12, y + 26, 5, 5, "#fff09a");

    pixelRect(x + 5, y + 5, 19, 16, "#edbd78");
    pixelRect(x + 5, y + 4, 19, 5, "#8c513e");
    pixelRect(x + 4, y + 1, 22, 6, "#e44755");
    pixelRect(x + 8, y - 3, 15, 5, "#ff6d66");
    pixelRect(x + 4, y + 8, 4, 8, "#d8935c");
    pixelRect(x + 20, y + 8, 5, 8, "#d8935c");

    const eyeX = facingRight ? x + 17 : x + 8;
    pixelRect(eyeX, y + 10, 5, 6, "#fff");
    pixelRect(eyeX + (facingRight ? 2 : 1), y + 12, 3, 4, "#18223c");
    pixelRect(x + (facingRight ? 13 : 7), y + 18, 8, 2, "#7b3b39");

    pixelRect(x + (facingRight ? 1 : 21), y + 18, 6, 5, "#f5d365");
    pixelRect(x + (facingRight ? 0 : 24), y + 21, 5, 9, "#e44755");

    if (player.attack > 0) {
      const slashX = facingRight ? x + 26 : x - 19;
      pixelRect(slashX, y + 13, 17, 4, "#fff8c5");
      pixelRect(slashX + (facingRight ? 5 : 2), y + 9, 9, 3, "#ffe778");
      pixelRect(slashX + (facingRight ? 9 : 0), y + 19, 9, 3, "#ff9d59");
    }

    if (player.fireTimer > 0) {
      ctx.globalAlpha = 0.55 + Math.sin(tick * 12) * 0.2;
      pixelRect(x - 4, y + 12, 3, 18, "#ff9a42");
      pixelRect(x + player.w + 1, y + 12, 3, 18, "#ffdc67");
      ctx.globalAlpha = 1;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      pixelRect(p.x, p.y, p.size, p.size, p.color);
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD(theme) {
    panel(14, 12, 270, 77);
    text(`KINGDOM ${levelIndex + 1}/10`, 28, 34, 16, "#fff");
    text(`${theme.name}`, 28, 55, 13, theme.accent);
    text(`♥ ${"■".repeat(Math.max(0, player.hp))}${"□".repeat(Math.max(0, player.maxHp - player.hp))}`, 28, 78, 16, "#ff7888");

    panel(W - 194, 12, 180, 77);
    text(`COINS ${coins}`, W - 178, 38, 15, "#ffe66e");
    text(`SCORE ${score}`, W - 178, 63, 15, "#fff");
    text(`LIVES ${lives}`, W - 178, 82, 13, "#a9d8ff");

    if (boss) {
      panel(W / 2 - 180, 12, 360, 43);
      text(boss.final ? "DARK OVERLORD" : kingdoms[levelIndex].boss.toUpperCase(), W / 2, 29, 13, "#fff", "center");
      ctx.fillStyle = "#412c45";
      ctx.fillRect(W / 2 - 158, 36, 316, 12);
      ctx.fillStyle = "#fa5169";
      ctx.fillRect(W / 2 - 158, 36, 316 * Math.max(0, boss.hp / boss.maxHp), 12);
    }

    if (levelMessage > 0 && floatingMessage) {
      text(floatingMessage, W / 2, 132, 22, "#fff09a", "center");
    } else if (levelMessage > 0) {
      text(theme.name, W / 2, 150, 25, "#fff", "center");
    }

    drawTouchControls();
  }

  function drawTouchControls() {
    if (!("ontouchstart" in window) && navigator.maxTouchPoints === 0) return;

    ctx.globalAlpha = 0.48;
    ctx.fillStyle = "#10172b";
    ctx.fillRect(20, H - 82, 58, 58);
    ctx.fillRect(86, H - 82, 58, 58);
    ctx.fillRect(W - 145, H - 82, 58, 58);
    ctx.fillRect(W - 78, H - 82, 58, 58);
    ctx.globalAlpha = 1;

    text("◀", 49, H - 45, 28, "#fff", "center");
    text("▶", 115, H - 45, 28, "#fff", "center");
    text("A", W - 116, H - 45, 22, "#fff", "center");
    text("J", W - 49, H - 45, 22, "#fff", "center");
  }

  function drawMenu(theme) {
    panel(150, 34, 660, 450, "#10172be8");
    text("PIXEL QUEST", W / 2, 103, 47, "#ffe66e", "center");
    text("THE 10 KINGDOMS", W / 2, 137, 20, "#9feaff", "center");
    text("✦  A RETRO PIXEL ADVENTURE  ✦", W / 2, 170, 13, "#d7e5ff", "center");

    screenButtons = [];
    addButton("START GAME", W / 2 - 130, 205, 260, 42, "start");
    addButton("CONTINUE GAME", W / 2 - 130, 254, 260, 42, "continue");
    addButton("LEVEL SELECT", W / 2 - 130, 303, 260, 42, "select");
    addButton("HOW TO PLAY", W / 2 - 130, 352, 260, 42, "help");
    addButton(`SOUND: ${soundOn ? "ON" : "OFF"}`, W / 2 - 130, 401, 260, 42, "sound");
    text(`Best score: ${bestScore}`, W / 2, 470, 13, "#cad8f1", "center");
  }

  function drawLevelSelect() {
    panel(90, 44, 780, 450, "#10172bee");
    text("CHOOSE A KINGDOM", W / 2, 88, 27, "#ffe66e", "center");
    screenButtons = [];

    for (let i = 0; i < 10; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 145 + col * 355;
      const y = 113 + row * 61;
      const locked = i >= unlocked;
      addButton(`${String(i + 1).padStart(2, "0")}  ${kingdoms[i].name}${locked ? "  🔒" : ""}`,
        x, y, 320, 48, locked ? "locked" : `level:${i}`);
    }

    addButton("BACK", W / 2 - 100, 430, 200, 42, "menu");
  }

  function drawHelp() {
    panel(105, 50, 750, 440, "#10172bee");
    text("HOW TO PLAY", W / 2, 95, 29, "#ffe66e", "center");

    const lines = [
      "Move: Arrow keys or A / D       Run: Shift",
      "Jump: Space (press again in air for a double jump)",
      "Attack: X       Pause: Esc",
      "",
      "Defeat enemies with attacks or by landing on them.",
      "Collect coins and power-ups. Reach the end of each kingdom",
      "to face its boss. Strike the boss when its guard is down!",
      "",
      "On touch screens: use the buttons at the bottom of the game.",
      "Your unlocked kingdoms and best score are saved locally."
    ];

    lines.forEach((line, i) => text(line, W / 2, 150 + i * 27, 15, "#deebff", "center"));

    screenButtons = [];
    addButton("BACK", W / 2 - 100, 435, 200, 42, "menu");
  }

  function drawOverlay(title, subtitle, buttons) {
    panel(205, 140, 550, 265, "#11172beF");
    text(title, W / 2, 205, title.length > 23 ? 25 : 32, "#ffe66e", "center");
    text(subtitle, W / 2, 242, 15, "#dce8ff", "center");
    screenButtons = [];

    buttons.forEach((entry, i) => {
      addButton(entry[0], W / 2 - 125, 278 + i * 51, 250, 42, entry[1]);
    });
  }

  function panel(x, y, w, h, color = "#13203bdc") {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#9bb8e8";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "#ffffff16";
    ctx.fillRect(x + 5, y + 5, w - 10, 3);
  }

  function text(value, x, y, size = 16, color = "#fff", align = "left") {
    ctx.font = `bold ${size}px "Courier New", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#12162a";
    ctx.fillText(value, x + 2, y + 2);
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  }

  function addButton(label, x, y, w, h, action) {
    screenButtons.push({ x, y, w, h, action });
    ctx.fillStyle = "#2b4773";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#5677a7";
    ctx.fillRect(x + 3, y + 3, w - 6, 4);
    ctx.strokeStyle = "#b5d3ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    text(label, x + w / 2, y + h / 2 + 1, 15, "#fff", "center");
  }

  function handleAction(action) {
    beep(420, 0.06);

    if (action === "start") {
      startGame(0);
    } else if (action === "continue") {
      startGame(Math.min(9, unlocked - 1));
    } else if (action === "select") {
      state = "select";
    } else if (action === "help") {
      state = "help";
    } else if (action === "sound") {
      soundOn = !soundOn;
    } else if (action === "menu") {
      state = "menu";
    } else if (action === "resume") {
      state = "playing";
    } else if (action === "next") {
      setLevel(Math.min(9, levelIndex + 1));
    } else if (action === "retry") {
      startGame(levelIndex);
    } else if (action === "locked") {
      beep(100, 0.12, "sawtooth");
    } else if (action.startsWith("level:")) {
      startGame(Number(action.split(":")[1]));
    }
  }

  function canvasPoint(event) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * W / bounds.width,
      y: (event.clientY - bounds.top) * H / bounds.height
    };
  }

  canvas.addEventListener("pointerdown", event => {
    event.preventDefault();
    const p = canvasPoint(event);

    if (state !== "playing") {
      const button = screenButtons.find(b =>
        p.x >= b.x && p.x <= b.x + b.w &&
        p.y >= b.y && p.y <= b.y + b.h
      );

      if (button) handleAction(button.action);
      return;
    }

    if (p.y > H - 105) {
      if (p.x < 78) touchPointers.set(event.pointerId, "left");
      else if (p.x < 150) touchPointers.set(event.pointerId, "right");
      else if (p.x > W - 88) touchPointers.set(event.pointerId, "jump");
      else if (p.x > W - 155) touchPointers.set(event.pointerId, "attack");
      else touchPointers.set(event.pointerId, "run");
    }
  });

  canvas.addEventListener("pointerup", event => {
    touchPointers.delete(event.pointerId);
  });

  canvas.addEventListener("pointercancel", event => {
    touchPointers.delete(event.pointerId);
  });

  window.addEventListener("keydown", event => {
    const code = event.code;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code)) {
      event.preventDefault();
    }

    if (!keys[code]) pressed[code] = true;
    keys[code] = true;

    if (code === "Escape") {
      if (state === "playing") state = "paused";
      else if (state === "paused") state = "playing";
    }

    if (state === "paused" && code === "Enter") {
      state = "playing";
    }

    audioContext();
  });

  window.addEventListener("keyup", event => {
    keys[event.code] = false;
  });

  function frame(timestamp) {
    const dt = Math.min(0.033, (timestamp - (frame.last || timestamp)) / 1000);
    frame.last = timestamp;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  setLevel(0);
  state = "menu";
  requestAnimationFrame(frame);
})();
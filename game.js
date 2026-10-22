
"use strict";

// ============================================
// AI RUNNER 2.0
// Game engine, menus, difficulty and results
// ============================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const $ = id => document.getElementById(id);

const scoreElement = $("score");
const bestElement = $("best");
const coinsElement = $("coins");
const shieldElement = $("shield-status");
const modeDisplay = $("mode-display");
const threatBar = $("threatBar");
const threatLabel = $("threatLabel");

const overlay = $("gameOverlay");
const overlaySymbol = $("overlay-symbol");
const overlayEyebrow = $("overlay-eyebrow");
const overlayTitle = $("overlay-title");
const overlayMessage = $("overlay-message");
const overlayHint = $("overlay-hint");
const menuContent = $("menu-content");
const startBtn = $("startBtn");
const menuBtn = $("menuBtn");
const jumpBtn = $("jumpBtn");
const instructionsBtn = $("instructionsBtn");
const homeLink = $("homeLink");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const GROUND = 390;

const GRAVITY = 1900;
const JUMP_FORCE = -690;

// Each mode has independent starting speed and progression.
const MODES = {
    easy: {
        label: "EASY",
        startSpeed: 260,
        maxSpeed: 440,
        acceleration: 4,
        minSpawn: 1.25,
        maxSpawn: 1.95,
        tallChance: 0.12,
        shieldChance: 0.10
    },
    medium: {
        label: "MEDIUM",
        startSpeed: 320,
        maxSpeed: 650,
        acceleration: 8,
        minSpawn: 0.85,
        maxSpawn: 1.55,
        tallChance: 0.20,
        shieldChance: 0.075
    },
    hard: {
        label: "HARD",
        startSpeed: 410,
        maxSpeed: 800,
        acceleration: 12,
        minSpawn: 0.60,
        maxSpawn: 1.15,
        tallChance: 0.35,
        shieldChance: 0.05
    }
};

let selectedMode = "medium";
let gameState = "menu";
let score = 0;
let coinsCollected = 0;
let highScore = loadHighScore();
let elapsedTime = 0;
let gameSpeed = MODES.medium.startSpeed;
let spawnTimer = 1.2;
let shieldActive = false;
let shieldTime = 0;
let screenShake = 0;
let animationTime = 0;
let lastFrame = 0;

let obstacles = [];
let coins = [];
let powerUps = [];
let particles = [];
let stars = [];

const player = {
    x: 125,
    y: GROUND - 48,
    width: 34,
    height: 48,
    velocityY: 0,
    onGround: true
};

// ============================================
// SAVE AND LOAD HIGH SCORE
// ============================================

function loadHighScore() {
    try {
        return Number(localStorage.getItem("aiRunnerHighScore")) || 0;
    } catch {
        return 0;
    }
}

function saveHighScore() {
    try {
        localStorage.setItem("aiRunnerHighScore", String(highScore));
    } catch {
        // Continue playing if storage is unavailable.
    }
}

// ============================================
// MENU AND DIFFICULTY SELECTION
// ============================================

function selectDifficulty(mode) {
    if (!MODES[mode]) return;

    selectedMode = mode;

    document.querySelectorAll(".difficulty-btn").forEach(button => {
        const selected = button.dataset.mode === mode;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
    });

    modeDisplay.textContent = MODES[mode].label;
}

function showMenu() {
    gameState = "menu";

    overlaySymbol.textContent = "✦";
    overlayEyebrow.textContent = "DIGITAL SURVIVAL PROTOCOL 02";
    overlayTitle.textContent = "ENTER THE GRID";

    overlayMessage.textContent =
        "Enter a neon digital world. Dodge hazards, collect coins, " +
        "and survive as long as possible.";

    overlayHint.textContent = "SPACE / ↑ / W TO JUMP";

    menuContent.classList.remove("hidden");
    startBtn.classList.remove("hidden");
    menuBtn.classList.add("hidden");

    startBtn.innerHTML = 'START RUN <span>→</span>';
    overlay.classList.remove("hidden");

    updateHUD();
}

document.querySelectorAll(".difficulty-btn").forEach(button => {
    button.addEventListener("click", () => {
        selectDifficulty(button.dataset.mode);
    });
});

instructionsBtn.addEventListener("click", showInstructions);

function showInstructions() {
    if (gameState === "playing") return;

    gameState = "instructions";

    overlaySymbol.textContent = "?";
    overlayEyebrow.textContent = "RUNNER TRAINING";
    overlayTitle.textContent = "HOW TO PLAY";

    overlayMessage.textContent =
        "Learn the controls before entering the digital world.";

    menuContent.classList.add("hidden");
    startBtn.classList.add("hidden");
    menuBtn.classList.remove("hidden");

    menuBtn.textContent = "← BACK TO MAIN MENU";
    overlayHint.textContent = "PRACTICE YOUR REFLEXES";

    // Render instruction details in the overlay.
    let instructions = document.getElementById("instructions-panel");

    if (!instructions) {
        instructions = document.createElement("div");
        instructions.id = "instructions-panel";
        instructions.className = "instructions-list";

        const rows = [
            ["↑", "Jump", "Press Space, Arrow Up, W, or the JUMP button."],
            ["◆", "Collect coins", "Each coin gives you 10 bonus points."],
            ["S", "Shield power-up", "Protects you from one obstacle collision."],
            ["!", "Avoid hazards", "Hitting an obstacle without a shield ends the run."],
            ["↗", "Survive longer", "Your score and running speed increase over time."]
        ];

        rows.forEach(([icon, title, description]) => {
            const row = document.createElement("div");
            row.className = "instruction-row";

            const symbol = document.createElement("span");
            symbol.className = "instruction-icon";
            symbol.textContent = icon;

            const copy = document.createElement("div");
            const heading = document.createElement("strong");
            heading.textContent = title;

            const detail = document.createElement("small");
            detail.textContent = description;

            copy.append(heading, detail);
            row.append(symbol, copy);
            instructions.appendChild(row);
        });
    }

    instructions.classList.remove("hidden");
    startBtn.before(instructions);
}

function hideInstructions() {
    const instructions = document.getElementById("instructions-panel");

    if (instructions) instructions.classList.add("hidden");

    showMenu();
}

menuBtn.addEventListener("click", hideInstructions);

homeLink.addEventListener("click", event => {
    event.preventDefault();

    if (gameState !== "playing") {
        hideInstructions();
    }
});

// ============================================
// START, RESTART AND GAME OVER
// ============================================

function startGame() {
    const settings = MODES[selectedMode];

    score = 0;
    coinsCollected = 0;
    elapsedTime = 0;
    gameSpeed = settings.startSpeed;
    spawnTimer = 1.0;
    shieldActive = false;
    shieldTime = 0;
    screenShake = 0;

    obstacles = [];
    coins = [];
    powerUps = [];
    particles = [];

    player.y = GROUND - player.height;
    player.velocityY = 0;
    player.onGround = true;

    gameState = "playing";

    overlay.classList.add("hidden");

    const instructions = document.getElementById("instructions-panel");
    if (instructions) instructions.classList.add("hidden");

    lastFrame = performance.now();
    updateHUD();
    canvas.focus();
}

function endGame() {
    if (gameState !== "playing") return;

    gameState = "gameover";
    screenShake = 7;

    const finalScore = Math.floor(score);
    const isNewRecord = finalScore > highScore;

    if (isNewRecord) {
        highScore = finalScore;
        saveHighScore();
    }

    updateHUD();

    overlaySymbol.textContent = isNewRecord ? "🏆" : "✦";
    overlayEyebrow.textContent = isNewRecord
        ? "NEW PERSONAL RECORD"
        : "RUN TERMINATED";

    overlayTitle.textContent = isNewRecord
        ? "RECORD BROKEN!"
        : "GAME OVER";

    overlayMessage.textContent =
        `You survived for ${Math.floor(elapsedTime)} seconds.`;

    menuContent.classList.add("hidden");
    startBtn.classList.remove("hidden");
    menuBtn.classList.remove("hidden");

    startBtn.innerHTML = 'RETRY RUN <span>↻</span>';
    menuBtn.textContent = "MAIN MENU";
    overlayHint.textContent = `${MODES[selectedMode].label} MODE`;

    // Build the run summary safely.
    let results = document.getElementById("result-stats");

    if (!results) {
        results = document.createElement("div");
        results.id = "result-stats";
        results.className = "result-stats";
        overlayMessage.after(results);
    }

    results.replaceChildren();

    const stats = [
        ["FINAL SCORE", finalScore, true],
        ["BEST SCORE", highScore, true],
        ["COINS", coinsCollected, false],
        ["SURVIVAL TIME", `${Math.floor(elapsedTime)}s`, false]
    ];

    stats.forEach(([label, value, highlight]) => {
        const card = document.createElement("div");
        card.className = `result-stat${highlight ? " highlight" : ""}`;

        const name = document.createElement("span");
        name.textContent = label;

        const number = document.createElement("strong");
        number.textContent = value;

        card.append(name, number);
        results.appendChild(card);
    });

    overlay.classList.remove("hidden");
}

startBtn.addEventListener("click", startGame);

// ============================================
// PLAYER INPUT
// ============================================

function jump() {
    if (gameState === "menu" ||
        gameState === "gameover" ||
        gameState === "instructions") {
        return;
    }

    if (gameState !== "playing") return;

    if (player.onGround) {
        player.velocityY = JUMP_FORCE;
        player.onGround = false;

        createParticles(
            player.x + player.width / 2,
            GROUND,
            "#40eaff",
            7
        );
    }
}

document.addEventListener("keydown", event => {
    const jumpKeys = ["Space", "ArrowUp", "KeyW"];

    if (jumpKeys.includes(event.code)) {
        event.preventDefault();

        if (event.repeat) return;

        if (gameState === "playing") {
            jump();
        } else if (gameState === "menu" ||
                   gameState === "gameover") {
            startGame();
        }
    }

    if (event.code === "Escape" && gameState !== "playing") {
        hideInstructions();
    }
});

jumpBtn.addEventListener("pointerdown", event => {
    event.preventDefault();

    if (gameState === "playing") {
        jump();
    } else if (gameState === "menu" ||
               gameState === "gameover") {
        startGame();
    }
});

// ============================================
// RULE-BASED ADAPTIVE DIFFICULTY
// ============================================

function updateDifficulty(dt) {
    elapsedTime += dt;

    const settings = MODES[selectedMode];

    gameSpeed = Math.min(
        settings.startSpeed + elapsedTime * settings.acceleration,
        settings.maxSpeed
    );

    const progression = Math.min(elapsedTime / 90, 1);

    const minDelay =
        settings.minSpawn - progression * 0.12;

    const maxDelay =
        settings.maxSpawn - progression * 0.20;

    spawnTimer -= dt;

    if (spawnTimer <= 0) {
        spawnObstacle();

        spawnTimer =
            minDelay + Math.random() * (maxDelay - minDelay);
    }

    if (Math.random() < dt * 0.9) {
        spawnCoinGroup();
    }

    if (
        Math.random() < dt * settings.shieldChance &&
        powerUps.length < 1
    ) {
        spawnShield();
    }

    const threat = Math.min(
        (gameSpeed - settings.startSpeed) /
        (settings.maxSpeed - settings.startSpeed),
        1
    );

    threatBar.style.width = `${Math.max(5, threat * 100)}%`;

    threatLabel.textContent =
        String(Math.floor(elapsedTime / 15) + 1).padStart(2, "0");
}

// ============================================
// SPAWN GAME OBJECTS
// ============================================

function spawnObstacle() {
    const settings = MODES[selectedMode];

    const tallChance = Math.min(
        settings.tallChance + elapsedTime / 250,
        0.65
    );

    const isTall = Math.random() < tallChance;

    const obstacle = {
        x: WIDTH + 20,
        y: 0,
        width: isTall ? 35 : 30,
        height: isTall ? 65 : 37,
        type: isTall ? "tall" : "low",
        passed: false
    };

    obstacle.y = GROUND - obstacle.height;
    obstacles.push(obstacle);
}

function spawnCoinGroup() {
    const startX = WIDTH + 20;
    const baseY = GROUND - 80 - Math.random() * 75;
    const count = 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < count; i++) {
        coins.push({
            x: startX + i * 34,
            y: baseY + Math.sin(i * 0.8) * 12,
            radius: 9,
            collected: false,
            phase: Math.random() * Math.PI * 2
        });
    }
}

function spawnShield() {
    powerUps.push({
        x: WIDTH + 20,
        y: GROUND - 100 - Math.random() * 55,
        radius: 15,
        collected: false,
        phase: 0
    });
}

// ============================================
// COLLISION DETECTION
// ============================================

function rectangleCollision(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function circleRectangleCollision(circle, rect) {
    const closestX = Math.max(
        rect.x,
        Math.min(circle.x, rect.x + rect.width)
    );

    const closestY = Math.max(
        rect.y,
        Math.min(circle.y, rect.y + rect.height)
    );

    const dx = circle.x - closestX;
    const dy = circle.y - closestY;

    return dx * dx + dy * dy < circle.radius * circle.radius;
}

// ============================================
// PARTICLES
// ============================================

function createParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 180;

        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.35 + Math.random() * 0.4,
            maxLife: 0.75,
            size: 2 + Math.random() * 3,
            color
        });
    }
}

function updateParticles(dt) {
    for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 220 * dt;
        p.life -= dt;
    }

    particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    ctx.globalAlpha = 1;
}

// ============================================
// GAME UPDATE
// ============================================

function update(dt) {
    animationTime += dt;

    if (gameState !== "playing") {
        updateParticles(dt);
        return;
    }

    updateDifficulty(dt);

    score += dt * 10;

    // Gravity and jumping.
    player.velocityY += GRAVITY * dt;
    player.y += player.velocityY * dt;

    if (player.y + player.height >= GROUND) {
        player.y = GROUND - player.height;
        player.velocityY = 0;
        player.onGround = true;
    }

    if (shieldActive) {
        shieldTime -= dt;

        if (shieldTime <= 0) {
            shieldActive = false;
            shieldTime = 0;
        }
    }

    const speed = gameSpeed * dt;

    // Obstacles.
    for (const obstacle of obstacles) {
        obstacle.x -= speed;

        if (rectangleCollision(player, obstacle)) {
            if (shieldActive) {
                shieldActive = false;
                shieldTime = 0;

                createParticles(
                    obstacle.x + obstacle.width / 2,
                    obstacle.y + obstacle.height / 2,
                    "#40eaff",
                    18
                );

                obstacle.x = -100;
                screenShake = 4;
            } else {
                endGame();
                break;
            }
        }
    }

    obstacles = obstacles.filter(
        obstacle => obstacle.x + obstacle.width > -30
    );

    // Coins.
    for (const coin of coins) {
        coin.x -= speed;
        coin.phase += dt * 5;

        const movingCoin = {
            ...coin,
            y: coin.y + Math.sin(coin.phase) * 3
        };

        if (
            !coin.collected &&
            circleRectangleCollision(movingCoin, player)
        ) {
            coin.collected = true;
            coinsCollected++;
            score += 10;

            createParticles(coin.x, coin.y, "#ffd45e", 8);
        }
    }

    coins = coins.filter(
        coin => !coin.collected && coin.x > -30
    );

    // Shields.
    for (const powerUp of powerUps) {
        powerUp.x -= speed;
        powerUp.phase += dt * 4;

        const movingPowerUp = {
            x: powerUp.x,
            y: powerUp.y + Math.sin(powerUp.phase) * 4,
            radius: powerUp.radius
        };

        if (
            !powerUp.collected &&
            circleRectangleCollision(movingPowerUp, player)
        ) {
            powerUp.collected = true;
            shieldActive = true;
            shieldTime = 8;

            createParticles(
                powerUp.x,
                powerUp.y,
                "#40eaff",
                16
            );
        }
    }

    powerUps = powerUps.filter(
        powerUp => !powerUp.collected && powerUp.x > -40
    );

    updateParticles(dt);

    screenShake = Math.max(0, screenShake - 25 * dt);

    updateHUD();
}

// ============================================
// HUD
// ============================================

function updateHUD() {
    scoreElement.textContent =
        String(Math.floor(score)).padStart(6, "0");

    bestElement.textContent =
        String(Math.max(highScore, Math.floor(score))).padStart(6, "0");

    coinsElement.textContent = coinsCollected;

    shieldElement.textContent = shieldActive
        ? `ON ${Math.ceil(shieldTime)}s`
        : "OFF";

    shieldElement.classList.toggle("active", shieldActive);

    modeDisplay.textContent = MODES[selectedMode].label;
}

// ============================================
// BACKGROUND
// ============================================

function createStars() {
    stars = [];

    for (let i = 0; i < 85; i++) {
        stars.push({
            x: Math.random() * WIDTH,
            y: Math.random() * 330,
            size: Math.random() * 2 + 0.4,
            phase: Math.random() * Math.PI * 2
        });
    }
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);

    gradient.addColorStop(0, "#09091d");
    gradient.addColorStop(0.65, "#10102b");
    gradient.addColorStop(1, "#191038");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const glow = ctx.createRadialGradient(
        620, 250, 10, 620, 250, 380
    );

    glow.addColorStop(0, "#4521a522");
    glow.addColorStop(1, "#09091d00");

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (const star of stars) {
        ctx.globalAlpha =
            0.35 + 0.65 * Math.abs(
                Math.sin(animationTime * 1.5 + star.phase)
            );

        ctx.fillStyle = "#b9c9ff";
        ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    ctx.globalAlpha = 1;

    // Digital skyline.
    for (let i = 0; i < 15; i++) {
        const x = i * 75;
        const height = 35 + ((i * 37) % 75);
        const y = GROUND - height;

        ctx.fillStyle = "#171534";
        ctx.fillRect(x, y, 45, height);

        ctx.fillStyle = "#5143a0";
        ctx.globalAlpha = 0.35;

        for (let wy = y + 10; wy < GROUND - 8; wy += 15) {
            ctx.fillRect(x + 8, wy, 4, 3);
            ctx.fillRect(x + 23, wy, 4, 3);
        }

        ctx.globalAlpha = 1;
    }

    // Floor.
    ctx.fillStyle = "#0b0b21";
    ctx.fillRect(0, GROUND, WIDTH, HEIGHT - GROUND);

    ctx.save();
    ctx.shadowColor = "#8c55ff";
    ctx.shadowBlur = 15;
    ctx.strokeStyle = "#9a68ff";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, GROUND);
    ctx.lineTo(WIDTH, GROUND);
    ctx.stroke();

    ctx.restore();

    const offset = (animationTime * gameSpeed * 0.55) % 55;

    ctx.strokeStyle = "#6747b840";
    ctx.lineWidth = 1;

    for (let x = -55; x < WIDTH + 55; x += 55) {
        ctx.beginPath();
        ctx.moveTo(x - offset, GROUND);
        ctx.lineTo(x - offset, HEIGHT);
        ctx.stroke();
    }

    for (let y = GROUND + 22; y < HEIGHT; y += 22) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
    }
}

// ============================================
// DRAW PLAYER
// ============================================

function drawPlayer() {
    const { x, y, width: w, height: h } = player;

    ctx.save();

    if (shieldActive) {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, 29, 35, 0, 0, Math.PI * 2);

        ctx.strokeStyle = "#40eaff";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#40eaff";
        ctx.shadowBlur = 18;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = Math.max(
        0.15,
        0.45 - (GROUND - (y + h)) / 130
    );

    ctx.fillStyle = "#40eaff";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, GROUND + 3, 20, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.shadowColor = "#40eaff";
    ctx.shadowBlur = 17;
    ctx.fillStyle = "#3be6ff";
    ctx.fillRect(x + 5, y + 13, w - 10, h - 15);

    ctx.fillStyle = "#c3f9ff";
    ctx.fillRect(x + 7, y, w - 14, 19);

    ctx.fillStyle = "#10102b";
    ctx.fillRect(x + 10, y + 6, w - 15, 6);

    ctx.fillStyle = "#ff55e5";
    ctx.fillRect(x + 21, y + 7, 5, 3);

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#7c39f7";
    ctx.fillRect(x + 9, y + 24, 5, 12);

    ctx.fillStyle = "#f4f3ff";
    ctx.fillRect(x + 16, y + 25, 8, 3);

    const swing = gameState === "playing" && player.onGround
        ? Math.sin(animationTime * 18) * 4
        : 0;

    ctx.fillStyle = "#9b56ff";
    ctx.fillRect(x + 6, y + h - 5, 8, 9 + swing);
    ctx.fillRect(x + 20, y + h - 5, 8, 9 - swing);

    ctx.restore();
}

// ============================================
// DRAW OBSTACLES
// ============================================

function drawObstacles() {
    for (const obstacle of obstacles) {
        ctx.save();
        ctx.shadowColor = "#ff3d80";
        ctx.shadowBlur = 13;

        const gradient = ctx.createLinearGradient(
            obstacle.x,
            obstacle.y,
            obstacle.x + obstacle.width,
            obstacle.y + obstacle.height
        );

        gradient.addColorStop(0, "#ff568f");
        gradient.addColorStop(1, "#8e245e");

        ctx.fillStyle = gradient;
        ctx.fillRect(
            obstacle.x,
            obstacle.y,
            obstacle.width,
            obstacle.height
        );

        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#ff9fca";
        ctx.lineWidth = 2;

        ctx.strokeRect(
            obstacle.x + 2,
            obstacle.y + 2,
            obstacle.width - 4,
            obstacle.height - 4
        );

        ctx.strokeStyle = "#ffd5e4";
        ctx.lineWidth = 2;

        for (
            let y = obstacle.y + 9;
            y < obstacle.y + obstacle.height - 4;
            y += 12
        ) {
            ctx.beginPath();
            ctx.moveTo(obstacle.x + 5, y + 5);
            ctx.lineTo(obstacle.x + obstacle.width - 5, y);
            ctx.stroke();
        }

        ctx.restore();
    }
}

// ============================================
// DRAW COINS
// ============================================

function drawCoins() {
    for (const coin of coins) {
        const y = coin.y + Math.sin(coin.phase) * 3;

        ctx.save();
        ctx.translate(coin.x, y);
        ctx.shadowColor = "#ffd45e";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "#ffd45e";

        ctx.beginPath();
        ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#9e6a18";

        ctx.beginPath();
        ctx.arc(0, 0, coin.radius - 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fff0a8";
        ctx.font = "bold 13px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("¢", 0, 1);

        ctx.restore();
    }
}

// ============================================
// DRAW SHIELD POWER-UPS
// ============================================

function drawPowerUps() {
    for (const powerUp of powerUps) {
        const y = powerUp.y + Math.sin(powerUp.phase) * 4;

        ctx.save();
        ctx.translate(powerUp.x, y);

        ctx.shadowColor = "#40eaff";
        ctx.shadowBlur = 20;
        ctx.strokeStyle = "#40eaff";
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.arc(0, 0, powerUp.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#174b79";

        ctx.beginPath();
        ctx.arc(0, 0, powerUp.radius - 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#c4fbff";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("S", 0, 1);

        ctx.restore();
    }
}

// ============================================
// DRAW WORLD
// ============================================

function draw() {
    ctx.save();

    if (screenShake > 0 && gameState === "playing") {
        ctx.translate(
            (Math.random() - 0.5) * screenShake,
            (Math.random() - 0.5) * screenShake
        );
    }

    drawBackground();
    drawCoins();
    drawPowerUps();
    drawObstacles();
    drawPlayer();
    drawParticles();

    ctx.restore();
}

// ============================================
// MAIN ANIMATION LOOP
// ============================================

function gameLoop(timestamp) {
    const dt = lastFrame
        ? Math.min((timestamp - lastFrame) / 1000, 0.033)
        : 0;

    lastFrame = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(gameLoop);
}

// ============================================
// INITIALIZE GAME
// ============================================

createStars();
selectDifficulty("medium");
showMenu();
requestAnimationFrame(gameLoop);

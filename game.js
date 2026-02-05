const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const playerHealthEl = document.getElementById('playerHealth');
const botHealthEl = document.getElementById('botHealth');
const roundEl = document.getElementById('round');
const ballTypeEl = document.getElementById('ballType');
const menu = document.getElementById('menu');
const gameOverEl = document.getElementById('gameOver');
const resultEl = document.getElementById('result');
const scoreDisplayEl = document.getElementById('scoreDisplay');
const roundsSelect = document.getElementById('roundsSelect');

let gameRunning = false;
let keys = {};
let player, bot, weapons = [], particles = [];
let round = 1;
let maxRounds = 5;
let difficulty = 1;
let gameOver = false;
let lastRoundTime = 0;

// Weapons (faster projectiles; renamed from balls per request)
const WEAPON_TYPES = [
    { name: 'Bullet', color: '#ffff00', speed: 12, damage: 8, size: 6 },
    { name: 'Fireball', color: '#ff8800', speed: 9, damage: 6, size: 8 },
    { name: 'Snowball', color: '#88ffff', speed: 10, damage: 5, size: 7 }
];

class Tank {
    constructor(x, y, color, isPlayer) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.color = color;
        this.isPlayer = isPlayer;
        this.health = 100;
        this.speed = 3;
        this.direction = 'right'; // up, down, left, right
        this.lastShot = 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        
        // Rotate based on direction
        let angle = 0;
        if (this.direction === 'up') angle = -Math.PI/2;
        else if (this.direction === 'down') angle = Math.PI/2;
        else if (this.direction === 'left') angle = Math.PI;
        ctx.rotate(angle);
        
        // Tank body
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // Tracks
        ctx.fillStyle = '#333';
        ctx.fillRect(-this.width/2 - 5, -this.height/2, 5, this.height);
        ctx.fillRect(this.width/2, -this.height/2, 5, this.height);
        
        // Barrel
        ctx.fillStyle = '#555';
        ctx.fillRect(0, -5, 25, 10);
        
        ctx.restore();
        
        // Health bar
        const healthWidth = (this.health / 100) * this.width;
        ctx.fillStyle = this.health > 30 ? '#0f0' : '#f00';
        ctx.fillRect(this.x, this.y - 10, healthWidth, 5);
    }

    move(dx, dy) {
        this.x += dx;
        this.y += dy;
        
        // Keep in bounds
        this.x = Math.max(50, Math.min(canvas.width - this.width - 50, this.x));
        this.y = Math.max(50, Math.min(canvas.height - this.height - 50, this.y));
        
        // Set direction based on movement
        if (dx > 0) this.direction = 'right';
        else if (dx < 0) this.direction = 'left';
        else if (dy > 0) this.direction = 'down';
        else if (dy < 0) this.direction = 'up';
    }

    shoot() {
        const now = Date.now();
        if (now - this.lastShot < 1500) return;
        this.lastShot = now;
        
        const weaponType = WEAPON_TYPES[(round - 1) % WEAPON_TYPES.length];
        const barrelLength = 25;
        let vx = 0, vy = 0;
        let startX = this.x + this.width/2;
        let startY = this.y + this.height/2;
        
        if (this.direction === 'right') {
            vx = weaponType.speed;
            startX += barrelLength;
        } else if (this.direction === 'left') {
            vx = -weaponType.speed;
            startX -= barrelLength;
        } else if (this.direction === 'up') {
            vy = -weaponType.speed;
            startY -= barrelLength;
        } else if (this.direction === 'down') {
            vy = weaponType.speed;
            startY += barrelLength;
        }
        
        weapons.push({
            x: startX,
            y: startY,
            vx: vx,
            vy: vy,
            type: weaponType,
            owner: this.isPlayer ? 'player' : 'bot',
            size: weaponType.size
        });
    }
}

function createBackground() {
    // Plain ground
    ctx.fillStyle = '#228B22';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Mountains
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.moveTo(100, 300);
    ctx.lineTo(250, 100);
    ctx.lineTo(400, 300);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(500, 350);
    ctx.lineTo(650, 120);
    ctx.lineTo(750, 350);
    ctx.fill();
    
    // Some hills
    ctx.fillStyle = '#196619';
    ctx.beginPath();
    ctx.ellipse(200, 500, 150, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(600, 480, 120, 60, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Grass details
    ctx.fillStyle = '#006400';
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        ctx.fillRect(x, y, 3, 8);
    }
}

function drawBackground() {
    createBackground();
}

function checkCollision(a, b) {
    return !(a.x + a.width < b.x || 
             b.x + b.width < a.x || 
             a.y + a.height < b.y || 
             b.y + b.height < a.y);
}

function update() {
    if (!gameRunning || gameOver || !player || !bot) return;
    
    // Player movement
    let dx = 0, dy = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) dx -= player.speed;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += player.speed;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) dy -= player.speed;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) dy += player.speed;
    
    if (dx !== 0 || dy !== 0) {
        player.move(dx, dy);
    }
    
    // Player shoot
    if (keys[' '] && Date.now() - player.lastShot > 1500) {
        player.shoot();
    }
    
    // Bot AI
    const dxBot = player.x - bot.x;
    const dyBot = player.y - bot.y;
    const dist = Math.sqrt(dxBot * dxBot + dyBot * dyBot);
    
    // Move towards player with some randomness based on difficulty
    let botDx = 0, botDy = 0;
    if (dist > 100) {
        botDx = (dxBot / dist) * bot.speed * (0.8 + difficulty * 0.1);
        botDy = (dyBot / dist) * bot.speed * (0.8 + difficulty * 0.1);
        
        // Add randomness for lower difficulty
        if (difficulty < 3) {
            botDx += (Math.random() - 0.5) * (3 - difficulty);
            botDy += (Math.random() - 0.5) * (3 - difficulty);
        }
    }
    bot.move(botDx, botDy);
    
    // Bot shoot
    const now = Date.now();
    if (now - bot.lastShot > (1500 - difficulty * 100) && dist < 250 + difficulty * 30) {
        bot.shoot();
    }
    
    // Update weapons (faster projectiles)
    for (let i = weapons.length - 1; i >= 0; i--) {
        const w = weapons[i];
        w.x += w.vx;
        w.y += w.vy;
        
        // Bounce off walls or remove
        if (w.x < 0 || w.x > canvas.width || w.y < 0 || w.y > canvas.height) {
            weapons.splice(i, 1);
            continue;
        }
        
        // Check hit player
        if (w.owner === 'bot') {
            const playerRect = {x: player.x, y: player.y, width: player.width, height: player.height};
            const weaponRect = {x: w.x - w.size/2, y: w.y - w.size/2, width: w.size, height: w.size};
            if (checkCollision(playerRect, weaponRect)) {
                player.health -= w.type.damage;
                createExplosion(w.x, w.y, w.type.color);
                weapons.splice(i, 1);
                if (player.health <= 0) {
                    // Respawn on death to continue to next round (no full end)
                    player.health = 100;
                    player.x = 150 + Math.random() * 50;
                    player.y = 200 + Math.random() * 200;
                }
                continue;
            }
        }
        
        // Check hit bot
        if (w.owner === 'player') {
            const botRect = {x: bot.x, y: bot.y, width: bot.width, height: bot.height};
            const weaponRect = {x: w.x - w.size/2, y: w.y - w.size/2, width: w.size, height: w.size};
            if (checkCollision(botRect, weaponRect)) {
                bot.health -= w.type.damage;
                createExplosion(w.x, w.y, w.type.color);
                weapons.splice(i, 1);
                if (bot.health <= 0) {
                    // Respawn on death to continue to next round (no full end)
                    bot.health = 100;
                    bot.x = 550 + Math.random() * 50;
                    bot.y = 200 + Math.random() * 200;
                }
                continue;
            }
        }
    }
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }
    
    // Update UI
    playerHealthEl.textContent = Math.max(0, Math.floor(player.health));
    botHealthEl.textContent = Math.max(0, Math.floor(bot.health));
    roundEl.textContent = `${round}/${maxRounds}`;
    ballTypeEl.textContent = WEAPON_TYPES[(round - 1) % WEAPON_TYPES.length].name;

    // Advance round every 30 seconds (or end if max reached)
    const currentTime = Date.now();
    if (currentTime - lastRoundTime > 30000 && gameRunning) {
        lastRoundTime = currentTime;
        round++;
        // Respawn at sides with full health for new round
        player.x = 150 + Math.random() * 50;
        player.y = 200 + Math.random() * 200;
        player.health = 100;
        bot.x = 550 + Math.random() * 50;
        bot.y = 200 + Math.random() * 200;
        bot.health = 100;
        weapons = [];
        
        // Check if game should end after max rounds (post-increment)
        if (round > maxRounds && maxRounds !== 999) {
            // End based on final health comparison
            const playerWon = player.health >= bot.health;
            endGame(playerWon);
            return;
        }
    }
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 1;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 20 + Math.random() * 20,
            color: color || '#ff8800',
            size: Math.random() * 4 + 2
        });
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    
    // Draw tanks (always on game over for final state)
    if (player) player.draw();
    if (bot) bot.draw();
    
    if (gameOver) {
        // Freeze on game over (skip dynamic elements)
        return;
    }
    
    // Draw weapons (faster projectiles)
    for (let w of weapons) {
        ctx.fillStyle = w.type.color;
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow for special weapons
        if (w.type.name !== 'Bullet') {
            ctx.fillStyle = w.type.color + '88';
            ctx.beginPath();
            ctx.arc(w.x, w.y, w.size * 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Draw particles
    for (let p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 40;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function startGame(diff) {
    difficulty = diff;
    round = 1;
    // Ensure maxRounds from select (fallback safe)
    maxRounds = parseInt(roundsSelect ? roundsSelect.value : '5') || 5;
    menu.style.display = 'none';
    gameOver = false;
    gameRunning = true;
    
    // Reset entities
    player = new Tank(150, 300, '#00ff00', true);
    bot = new Tank(600, 300, '#ff0000', false);
    weapons = [];
    particles = [];
    lastRoundTime = Date.now();
    
    // Initial round weapon type display
    ballTypeEl.textContent = WEAPON_TYPES[0].name;
    
    // Start loop if not running
    if (!gameRunning) gameLoop(); // but it's always called
}

function endGame(playerWon) {
    gameRunning = false;
    gameOver = true;
    weapons = [];
    particles = [];
    gameOverEl.style.display = 'block';
    resultEl.textContent = playerWon ? 'You Win!' : 'Game Over';
    resultEl.style.color = playerWon ? '#0f0' : '#f00';
    
    // Calculate and display score (rounds survived + health bonus)
    const finalScore = (round * 50) + (playerWon ? Math.floor(player.health) : Math.floor(bot.health));
    scoreDisplayEl.textContent = `Score: ${finalScore}`;
    scoreDisplayEl.style.color = playerWon ? '#0f0' : '#ff0';
}

function restartGame() {
    gameOverEl.style.display = 'none';
    menu.style.display = 'block';
    // Reset to menu
}

// Keyboard handlers
window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (e.key === ' ' && gameRunning && player) {
        e.preventDefault();
        player.shoot();
    }
});

window.addEventListener('keyup', e => {
    keys[e.key] = false;
});

// Start the game loop
gameLoop();

// Show menu initially
menu.style.display = 'block';

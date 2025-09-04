const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const playerCountEl = document.getElementById('playerCount');
const debugEl = document.getElementById('debug');

// Remove debug panel
debugEl.style.display = 'none';

let ws;
let myPlayerId;
let gameId;
let players = new Map();
let keys = {};
let reconnectAttempts = 0;
let pingInterval;
let gameState = 'connecting'; // connecting, waiting, playing
let gamePhase = 'waiting'; // Game phase from server
let gameObjects = {
    treasureChest: null,
    treasure: null,
    cashout: null,
    bullets: [],
    walls: []
};
let countdown = 0;
let gameResult = null; // Store win/lose result
let mousePos = { x: 400, y: 300 };

// Player class
class Player {
    constructor(id, x, y, size = 30) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.size = size;
        this.targetX = x;
        this.targetY = y;
        this.interpolationSpeed = 0.15;
        this.hasTreasure = false;
        this.isOpeningChest = false;
        this.isStealing = false;
        this.health = 100;
        this.maxHealth = 100;
        this.isDead = false;
    }
    
    setTarget(x, y) {
        this.targetX = x;
        this.targetY = y;
    }
    
    update() {
        // Smooth interpolation
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0.5) {
            this.x += dx * this.interpolationSpeed;
            this.y += dy * this.interpolationSpeed;
        } else {
            this.x = this.targetX;
            this.y = this.targetY;
        }
    }
    
    draw() {
        const isLocal = this.id === myPlayerId;
        
        if (this.isDead) {
            // Draw death marker
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = '#FF0000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.x - 15, this.y - 15);
            ctx.lineTo(this.x + 15, this.y + 15);
            ctx.moveTo(this.x + 15, this.y - 15);
            ctx.lineTo(this.x - 15, this.y + 15);
            ctx.stroke();
            ctx.globalAlpha = 1;
            
            ctx.fillStyle = '#FF0000';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('RESPAWNING...', this.x, this.y - 25);
            return;
        }
        
        // Draw shadow
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(this.x + 2, this.y + 2, this.size/2, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Draw player circle with glow effect for local player
        if (isLocal) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#4CAF50';
        }
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size/2, 0, Math.PI * 2);
        
        // Change color based on state
        if (this.isOpeningChest || this.isStealing) {
            ctx.fillStyle = '#FFA500'; // Orange when performing action
        } else if (this.hasTreasure) {
            ctx.fillStyle = '#FFD700'; // Gold when carrying treasure
        } else {
            ctx.fillStyle = isLocal ? '#4CAF50' : '#2196F3';
        }
        
        ctx.fill();
        ctx.strokeStyle = isLocal ? '#2E7D32' : '#1565C0';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        
        // Draw health bar
        const barWidth = 40;
        const barHeight = 6;
        const barY = this.y - this.size/2 - 20;
        
        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x - barWidth/2, barY, barWidth, barHeight);
        
        // Health
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = healthPercent > 0.5 ? '#4CAF50' : healthPercent > 0.25 ? '#FFA500' : '#FF0000';
        ctx.fillRect(this.x - barWidth/2, barY, barWidth * healthPercent, barHeight);
        
        // Border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - barWidth/2, barY, barWidth, barHeight);
        
        // Draw player ID
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`P${this.id}`, this.x, this.y);
        
        // Draw name tag and status
        ctx.fillStyle = isLocal ? '#4CAF50' : '#2196F3';
        ctx.font = '12px Arial';
        let statusText = isLocal ? 'You' : 'Opponent';
        
        if (this.hasTreasure) {
            statusText += ' 💰';
        }
        if (this.isOpeningChest) {
            statusText += ' [Opening...]';
        }
        if (this.isStealing) {
            statusText += ' [Stealing...]';
        }
        
        ctx.fillText(statusText, this.x, this.y + this.size/2 + 10);
    }
}

// Get WebSocket URL
function getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}`;
}

// Draw treasure chest
function drawTreasureChest(chest) {
    const x = chest.x;
    const y = chest.y;
    const size = chest.size;
    
    // Draw shadow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.fillRect(x - size/2 + 3, y - size/2 + 3, size, size);
    ctx.globalAlpha = 1;
    
    // Draw chest with glow when active
    if (chest.state === 'active') {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#FFD700';
    }
    
    // Draw chest
    if (chest.state === 'spawning') {
        ctx.fillStyle = '#888';
    } else if (chest.state === 'active') {
        ctx.fillStyle = '#8B4513';
    } else if (chest.state === 'opening') {
        ctx.fillStyle = '#CD853F';
    } else {
        ctx.fillStyle = '#654321';
    }
    
    ctx.fillRect(x - size/2, y - size/2, size, size);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - size/2, y - size/2, size, size);
    
    ctx.shadowBlur = 0;
    
    // Draw lock/status
    ctx.fillStyle = chest.state === 'active' ? '#FFD700' : '#333';
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Draw timer or progress
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (chest.state === 'spawning' && chest.timeUntilActive > 0) {
        // Draw activation timer
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('Activating in: ' + Math.ceil(chest.timeUntilActive) + 's', x, y - size/2 - 15);
    } else if (chest.state === 'opening') {
        // Draw progress bar
        const barWidth = size;
        const barHeight = 6;
        const barY = y + size/2 + 10;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(x - barWidth/2, barY, barWidth, barHeight);
        
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(x - barWidth/2, barY, barWidth * chest.openingProgress, barHeight);
        
        ctx.strokeStyle = '#000';
        ctx.strokeRect(x - barWidth/2, barY, barWidth, barHeight);
    } else if (chest.state === 'active') {
        ctx.fillStyle = '#FFD700';
        ctx.fillText('[E] Open', x, y - size/2 - 10);
    }
}

// Draw treasure
function drawTreasure(treasure) {
    if (treasure.holderId) return; // Don't draw if being held
    
    const x = treasure.x;
    const y = treasure.y;
    const size = treasure.size;
    
    // Add floating animation
    const floatY = y + Math.sin(Date.now() / 500) * 3;
    
    // Draw glow effect
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#FFD700';
    
    // Draw shadow
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(x + 2, y + 5, size/2, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.globalAlpha = 1;
    
    // Draw treasure (gold coin)
    ctx.beginPath();
    ctx.arc(x, floatY, size/2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.strokeStyle = '#B8860B';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    
    // Draw $ symbol
    ctx.fillStyle = '#B8860B';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', x, floatY);
    
    // Draw pickup hint
    ctx.fillStyle = '#FFD700';
    ctx.font = '12px Arial';
    ctx.fillText('[E] Pick up', x, floatY - size/2 - 10);
}

// Draw cashout
function drawCashout(cashout) {
    const x = cashout.x;
    const y = cashout.y;
    const size = cashout.size;
    
    // Draw glow effect when active
    if (cashout.state === 'active') {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#4ECDC4';
    }
    
    // Draw shadow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.fillRect(x - size/2 + 3, y - size/2 + 3, size, size);
    ctx.globalAlpha = 1;
    
    // Draw cashout box
    if (cashout.state === 'inactive') {
        ctx.fillStyle = '#444';
    } else if (cashout.state === 'stealing') {
        ctx.fillStyle = '#FF6B6B';
    } else {
        ctx.fillStyle = '#4ECDC4';
    }
    
    ctx.fillRect(x - size/2, y - size/2, size, size);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - size/2, y - size/2, size, size);
    
    ctx.shadowBlur = 0;
    
    // Draw progress circle
    if (cashout.state === 'active' || cashout.state === 'stealing') {
        ctx.strokeStyle = cashout.state === 'stealing' ? '#FF0000' : '#00FF00';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x, y, size/3, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * cashout.progress), false);
        ctx.stroke();
    }
    
    // Draw text
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (cashout.state === 'inactive') {
        ctx.fillText('DROP', x, y - 5);
        ctx.fillText('HERE', x, y + 10);
    } else if (cashout.state === 'active') {
        const timeLeft = cashout.timeRemaining || 0;
        ctx.fillText(Math.ceil(timeLeft) + 's', x, y);
        ctx.font = '10px Arial';
        ctx.fillText(`P${cashout.ownerId}`, x, y + 15);
    } else if (cashout.state === 'stealing') {
        ctx.fillText('STEAL', x, y);
        ctx.font = '10px Arial';
        ctx.fillText(`P${cashout.stealerId}`, x, y + 15);
    }
    
    // Draw interaction hint
    if (cashout.state === 'active' && cashout.ownerId !== myPlayerId) {
        ctx.fillStyle = '#FF6B6B';
        ctx.font = '12px Arial';
        ctx.fillText('[E] Steal', x, y - size/2 - 10);
    }
}

// Draw bullet
function drawBullet(bullet) {
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#FF0000';
    
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
    ctx.fillStyle = '#FF0000';
    ctx.fill();
    ctx.strokeStyle = '#800000';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.shadowBlur = 0;
}

// Draw crosshair
function drawCrosshair() {
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    
    // Draw crosshair lines
    ctx.beginPath();
    ctx.moveTo(mousePos.x - 10, mousePos.y);
    ctx.lineTo(mousePos.x + 10, mousePos.y);
    ctx.moveTo(mousePos.x, mousePos.y - 10);
    ctx.lineTo(mousePos.x, mousePos.y + 10);
    ctx.stroke();
    
    // Draw circle
    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, 5, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.globalAlpha = 1;
}

// Connect to WebSocket server
function connect() {
    const wsUrl = getWebSocketUrl();
    
    try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            statusEl.textContent = 'Connected to server...';
            reconnectAttempts = 0;
            gameResult = null;
            
            // Start ping interval
            pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'ping' }));
                }
            }, 25000);
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                switch(data.type) {
                    case 'connected':
                        myPlayerId = data.playerId;
                        gameState = 'waiting';
                        statusEl.textContent = `Connected as Player ${myPlayerId}`;
                        break;
                    
                    case 'waiting':
                        gameState = 'waiting';
                        statusEl.textContent = `Waiting for opponent... (Position ${data.position} of ${data.totalWaiting})`;
                        playerCountEl.textContent = `In queue: ${data.totalWaiting}`;
                        break;
                    
                    case 'gameStart':
                        gameState = 'playing';
                        gameId = data.gameId;
                        statusEl.textContent = `Game ${gameId} started! You (P${data.playerId}) vs Opponent (P${data.opponentId})`;
                        playerCountEl.textContent = 'Game in progress';
                        players.clear();
                        gameObjects = { treasureChest: null, treasure: null, cashout: null, bullets: [], walls: [] };
                        gameResult = null;
                        
                        // Reset keys state
                        keys = {};
                        break;
                    
                    case 'gameState':
                        if (gameState === 'playing' && data.players) {
                            gamePhase = data.phase || 'waiting';
                            countdown = data.countdown || 0;
                            
                            // Update players
                            const currentPlayerIds = new Set();
                            
                            data.players.forEach(playerData => {
                                currentPlayerIds.add(playerData.id);
                                
                                if (players.has(playerData.id)) {
                                    // Update existing player
                                    const player = players.get(playerData.id);
                                    player.setTarget(playerData.x, playerData.y);
                                    player.hasTreasure = playerData.hasTreasure;
                                    player.isOpeningChest = playerData.isOpeningChest;
                                    player.isStealing = playerData.isStealing;
                                    player.health = playerData.health;
                                    player.maxHealth = playerData.maxHealth;
                                    player.isDead = playerData.isDead;
                                    if (playerData.size) {
                                        player.size = playerData.size;
                                    }
                                } else {
                                    // Create new player
                                    const player = new Player(
                                        playerData.id,
                                        playerData.x,
                                        playerData.y,
                                        playerData.size || 30
                                    );
                                    player.hasTreasure = playerData.hasTreasure;
                                    player.isOpeningChest = playerData.isOpeningChest;
                                    player.isStealing = playerData.isStealing;
                                    player.health = playerData.health;
                                    player.maxHealth = playerData.maxHealth;
                                    player.isDead = playerData.isDead;
                                    players.set(playerData.id, player);
                                }
                            });
                            
                            // Remove players that are no longer in the game
                            for (const [id, player] of players) {
                                if (!currentPlayerIds.has(id)) {
                                    players.delete(id);
                                }
                            }
                            
                            // Update game objects
                            gameObjects.treasureChest = data.treasureChest || null;
                            gameObjects.treasure = data.treasure || null;
                            gameObjects.cashout = data.cashout || null;
                            gameObjects.bullets = data.bullets || [];
                            gameObjects.walls = data.walls || [];
                        }
                        break;
                    
                    case 'gameOver':
                        if (data.winner === myPlayerId) {
                            gameResult = 'win';
                        } else {
                            gameResult = 'lose';
                        }
                        
                        setTimeout(() => {
                            gameState = 'waiting';
                            players.clear();
                            gameObjects = { treasureChest: null, treasure: null, cashout: null, bullets: [], walls: [] };
                            gameResult = null;
                            keys = {};
                        }, 5000);
                        break;
                    
                    case 'opponentLeft':
                        statusEl.textContent = 'Opponent disconnected. Returning to lobby...';
                        playerCountEl.textContent = '';
                        gameState = 'waiting';
                        players.clear();
                        gameObjects = { treasureChest: null, treasure: null, cashout: null, bullets: [], walls: [] };
                        keys = {};
                        gameResult = null;
                        break;
                    
                    case 'gameEnd':
                        statusEl.textContent = 'Game ended. Waiting for new match...';
                        playerCountEl.textContent = '';
                        gameState = 'waiting';
                        players.clear();
                        gameObjects = { treasureChest: null, treasure: null, cashout: null, bullets: [], walls: [] };
                        keys = {};
                        gameResult = null;
                        break;
                    
                    case 'pong':
                        // Silent pong
                        break;
                    
                    default:
                        console.log('Unknown message type:', data.type);
                }
            } catch (err) {
                console.error('Error parsing message:', err);
            }
        };
        
        ws.onclose = (event) => {
            statusEl.textContent = 'Disconnected. Attempting to reconnect...';
            clearInterval(pingInterval);
            
            players.clear();
            gameState = 'connecting';
            keys = {};
            
            setTimeout(() => {
                if (reconnectAttempts < 5) {
                    reconnectAttempts++;
                    connect();
                } else {
                    statusEl.textContent = 'Failed to reconnect. Please refresh the page.';
                }
            }, 2000);
        };
        
        ws.onerror = (error) => {
            statusEl.textContent = 'Connection error. Check console.';
            console.error('WebSocket error:', error);
        };
        
    } catch (err) {
        statusEl.textContent = 'Failed to connect. Check console.';
        console.error('Connection failed:', err);
    }
}

// Input handling
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'e'].includes(key)) {
        e.preventDefault();
        
        if (!keys[key] && gameState === 'playing' && ws && ws.readyState === WebSocket.OPEN) {
            keys[key] = true;
            ws.send(JSON.stringify({
                type: 'keydown',
                key: key
            }));
        }
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'e'].includes(key)) {
        e.preventDefault();
        
        if (keys[key] && gameState === 'playing' && ws && ws.readyState === WebSocket.OPEN) {
            keys[key] = false;
            ws.send(JSON.stringify({
                type: 'keyup',
                key: key
            }));
        }
    }
});

// Mouse tracking
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left;
    mousePos.y = e.clientY - rect.top;
    
    if (gameState === 'playing' && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'mouse',
            x: mousePos.x,
            y: mousePos.y
        }));
    }
});

// Shooting
canvas.addEventListener('click', (e) => {
    if (gameState === 'playing' && gamePhase !== 'countdown' && ws && ws.readyState === WebSocket.OPEN) {
        const rect = canvas.getBoundingClientRect();
        const targetX = e.clientX - rect.left;
        const targetY = e.clientY - rect.top;
        
        ws.send(JSON.stringify({
            type: 'shoot',
            targetX: targetX,
            targetY: targetY
        }));
    }
});

// Handle window blur to release all keys
window.addEventListener('blur', () => {
    for (const key in keys) {
        if (keys[key] && gameState === 'playing' && ws && ws.readyState === WebSocket.OPEN) {
            keys[key] = false;
            ws.send(JSON.stringify({
                type: 'keyup',
                key: key
            }));
        }
    }
});

// Visibility change handling
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Release all keys when tab becomes hidden
        for (const key in keys) {
            if (keys[key] && gameState === 'playing' && ws && ws.readyState === WebSocket.OPEN) {
                keys[key] = false;
                ws.send(JSON.stringify({
                    type: 'keyup',
                    key: key
                }));
            }
        }
    } else if (ws && ws.readyState === WebSocket.CLOSED) {
        connect();
    }
});

// Game loop
let lastTime = performance.now();
let frameCount = 0;
let fpsTime = 0;
let currentFPS = 0;

function gameLoop(currentTime) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    // Calculate FPS
    frameCount++;
    fpsTime += deltaTime;
    if (fpsTime >= 1000) {
        currentFPS = frameCount;
        frameCount = 0;
        fpsTime = 0;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'waiting') {
        // Draw waiting screen
        ctx.fillStyle = '#0f3460';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Waiting for opponent...', canvas.width / 2, canvas.height / 2);
        
        ctx.font = '16px Arial';
        ctx.fillStyle = '#AAA';
        ctx.fillText('You will be matched automatically', canvas.width / 2, canvas.height / 2 + 40);
        
        // Draw animated loading dots
        const dots = '.'.repeat(Math.floor(currentTime / 500) % 4);
        ctx.fillText(dots, canvas.width / 2, canvas.height / 2 + 70);
        
    } else if (gameState === 'playing') {
        // Draw game background
        ctx.fillStyle = '#0f3460';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw map walls
        if (gameObjects.walls && gameObjects.walls.length > 0) {
            ctx.fillStyle = '#1a1a2e';
            ctx.strokeStyle = '#16213e';
            ctx.lineWidth = 2;
            
            gameObjects.walls.forEach(wall => {
                // Draw wall with gradient effect
                const gradient = ctx.createLinearGradient(wall.x, wall.y, wall.x, wall.y + wall.h);
                gradient.addColorStop(0, '#2c3e50');
                gradient.addColorStop(1, '#1a1a2e');
                ctx.fillStyle = gradient;
                
                ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
                ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
                
                // Add shadow effect
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.fillRect(wall.x + 2, wall.y + 2, wall.w, wall.h);
            });
        }
        
        // Draw game boundary
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
        
        // Draw countdown if active
        if (gamePhase === 'countdown' && countdown > 0) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 72px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(Math.ceil(countdown), canvas.width / 2, canvas.height / 2);
            
            ctx.font = 'bold 24px Arial';
            ctx.fillText('GET READY!', canvas.width / 2, canvas.height / 2 + 60);
        } else {
            // Draw game objects
            if (gameObjects.treasureChest) {
                drawTreasureChest(gameObjects.treasureChest);
            }
            
            if (gameObjects.cashout) {
                drawCashout(gameObjects.cashout);
            }
            
            if (gameObjects.treasure && !gameObjects.treasure.holderId) {
                drawTreasure(gameObjects.treasure);
            }
            
            // Draw bullets
            gameObjects.bullets.forEach(bullet => {
                drawBullet(bullet);
            });
            
            // Update and draw players
            players.forEach(player => {
                player.update();
                player.draw();
            });
            
            // Draw crosshair
            drawCrosshair();
        }
        
        // Draw game info
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        if (gameId !== undefined) {
            ctx.fillText(`Game #${gameId}`, 10, 10);
        }
        
        ctx.fillText(`FPS: ${currentFPS}`, 10, 30);
        
        // Draw cashout owner at top
        if (gameObjects.cashout && gameObjects.cashout.state === 'active') {
            ctx.fillStyle = '#FF6B6B';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            const ownerText = gameObjects.cashout.ownerId === myPlayerId ? 
                '🏆 YOU OWN THE CASHOUT!' : 
                `⚠️ Player ${gameObjects.cashout.ownerId} owns the cashout!`;
            ctx.fillText(ownerText, canvas.width / 2, 30);
            
            // Draw timer
            ctx.font = 'bold 16px Arial';
            ctx.fillStyle = '#FFF';
            ctx.fillText(`Time remaining: ${Math.ceil(gameObjects.cashout.timeRemaining || 0)}s`, canvas.width / 2, 55);
        }
        
        // Draw game phase
        let phaseText = '';
        if (gamePhase === 'chest_spawned' && gameObjects.treasureChest) {
            if (gameObjects.treasureChest.state === 'spawning') {
                phaseText = 'Treasure chest spawning...';
            } else if (gameObjects.treasureChest.state === 'active') {
                phaseText = 'Treasure chest is active!';
            }
        } else if (gamePhase === 'chest_opened') {
            phaseText = 'Grab the treasure!';
        }
        
        if (phaseText && !gameObjects.cashout?.state) {
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(phaseText, canvas.width / 2, 30);
        }
        
        // Draw controls
        ctx.textAlign = 'right';
        ctx.fillStyle = '#AAA';
        ctx.font = '12px Arial';
        ctx.fillText('WASD: Move | E: Interact | Click: Shoot', canvas.width - 10, 10);
        
        // Draw win/lose message
        if (gameResult) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            if (gameResult === 'win') {
                ctx.fillStyle = '#4CAF50';
                ctx.font = 'bold 48px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🎉 VICTORY! 🎉', canvas.width / 2, canvas.height / 2 - 30);
                
                ctx.fillStyle = '#FFF';
                ctx.font = 'bold 24px Arial';
                ctx.fillText('You secured the cashout!', canvas.width / 2, canvas.height / 2 + 30);
            } else {
                ctx.fillStyle = '#FF0000';
                ctx.font = 'bold 48px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('DEFEAT', canvas.width / 2, canvas.height / 2 - 30);
                
                ctx.fillStyle = '#FFF';
                ctx.font = 'bold 24px Arial';
                ctx.fillText('Your opponent secured the cashout', canvas.width / 2, canvas.height / 2 + 30);
            }
            
            ctx.fillStyle = '#CCC';
            ctx.font = '16px Arial';
            ctx.fillText('Returning to lobby...', canvas.width / 2, canvas.height / 2 + 80);
        }
        
    } else {
        // Connecting screen
        ctx.fillStyle = '#0f3460';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Connecting to server...', canvas.width / 2, canvas.height / 2);
        
        // Draw animated loading spinner
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        const angle = (currentTime / 1000) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2 + 60, 20, angle, angle + Math.PI * 1.5);
        ctx.stroke();
    }
    
    requestAnimationFrame(gameLoop);
}

// Start the game
console.log('Starting game client...');
connect();
requestAnimationFrame(gameLoop);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        // Release all keys
        for (const key in keys) {
            if (keys[key]) {
                ws.send(JSON.stringify({
                    type: 'keyup',
                    key: key
                }));
            }
        }
        ws.close();
    }
});
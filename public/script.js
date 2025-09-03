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
        
        // Draw shadow
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(this.x + 2, this.y + 2, this.size/2, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Draw player circle
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size/2, 0, Math.PI * 2);
        ctx.fillStyle = isLocal ? '#4CAF50' : '#2196F3';
        ctx.fill();
        ctx.strokeStyle = isLocal ? '#2E7D32' : '#1565C0';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw player ID
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`P${this.id}`, this.x, this.y);
        
        // Draw name tag above player
        ctx.fillStyle = isLocal ? '#4CAF50' : '#2196F3';
        ctx.font = '12px Arial';
        ctx.fillText(isLocal ? 'You' : 'Opponent', this.x, this.y - this.size/2 - 10);
    }
}

// Get WebSocket URL
function getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}`;
}

// Connect to WebSocket server
function connect() {
    const wsUrl = getWebSocketUrl();
    
    try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            statusEl.textContent = 'Connected to server...';
            reconnectAttempts = 0;
            
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
                        
                        // Reset keys state
                        keys = {};
                        break;
                    
                    case 'gameState':
                        if (gameState === 'playing' && data.players) {
                            // Update or create players based on game state
                            const currentPlayerIds = new Set();
                            
                            data.players.forEach(playerData => {
                                currentPlayerIds.add(playerData.id);
                                
                                if (players.has(playerData.id)) {
                                    // Update existing player position
                                    const player = players.get(playerData.id);
                                    player.setTarget(playerData.x, playerData.y);
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
                                    players.set(playerData.id, player);
                                    console.log(`Created player ${playerData.id} at (${playerData.x}, ${playerData.y})`);
                                }
                            });
                            
                            // Remove players that are no longer in the game
                            for (const [id, player] of players) {
                                if (!currentPlayerIds.has(id)) {
                                    players.delete(id);
                                    console.log(`Removed player ${id}`);
                                }
                            }
                        }
                        break;
                    
                    case 'opponentLeft':
                        statusEl.textContent = 'Opponent disconnected. Returning to lobby...';
                        playerCountEl.textContent = '';
                        gameState = 'waiting';
                        players.clear();
                        keys = {};
                        break;
                    
                    case 'gameEnd':
                        statusEl.textContent = 'Game ended. Waiting for new match...';
                        playerCountEl.textContent = '';
                        gameState = 'waiting';
                        players.clear();
                        keys = {};
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

// Input handling - track all keys continuously
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd'].includes(key)) {
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
    if (['w', 'a', 's', 'd'].includes(key)) {
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
        ctx.fillStyle = '#333';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Waiting for opponent...', canvas.width / 2, canvas.height / 2);
        
        ctx.font = '16px Arial';
        ctx.fillStyle = '#666';
        ctx.fillText('You will be matched automatically', canvas.width / 2, canvas.height / 2 + 40);
        
        // Draw animated loading dots
        const dots = '.'.repeat(Math.floor(currentTime / 500) % 4);
        ctx.fillText(dots, canvas.width / 2, canvas.height / 2 + 70);
        
    } else if (gameState === 'playing') {
        // Draw game background
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        
        for (let x = 0; x < canvas.width; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        ctx.setLineDash([]);
        
        // Draw game boundary
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
        
        // Update and draw players
        players.forEach(player => {
            player.update();
            player.draw();
        });
        
        // Draw game info
        ctx.fillStyle = '#333';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        if (gameId !== undefined) {
            ctx.fillText(`Game #${gameId}`, 10, 10);
        }
        
        ctx.fillText(`FPS: ${currentFPS}`, 10, 30);
        ctx.fillText(`Players: ${players.size}`, 10, 50);
        
        // Draw controls
        ctx.textAlign = 'right';
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.fillText('Use WASD to move', canvas.width - 10, 10);
        
        // Draw active keys indicator
        if (Object.values(keys).some(k => k)) {
            ctx.fillText(`Keys: ${Object.entries(keys).filter(([k,v]) => v).map(([k]) => k.toUpperCase()).join(' ')}`, canvas.width - 10, 30);
        }
        
    } else {
        // Connecting screen
        ctx.fillStyle = '#333';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Connecting to server...', canvas.width / 2, canvas.height / 2);
        
        // Draw animated loading spinner
        ctx.strokeStyle = '#333';
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
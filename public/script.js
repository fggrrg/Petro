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
        this.interpolationSpeed = 0.2;
    }
    
    setTarget(x, y) {
        this.targetX = x;
        this.targetY = y;
    }
    
    update(deltaTime) {
        // Smooth interpolation
        const t = Math.min(1, this.interpolationSpeed);
        this.x += (this.targetX - this.x) * t;
        this.y += (this.targetY - this.y) * t;
    }
    
    draw() {
        const isLocal = this.id === myPlayerId;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size/2, 0, Math.PI * 2);
        ctx.fillStyle = isLocal ? '#4CAF50' : '#2196F3';
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw player ID
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`P${this.id}`, this.x, this.y);
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
                        statusEl.textContent = `Game ${gameId} started! You vs Player ${data.opponentId}`;
                        playerCountEl.textContent = 'Game in progress';
                        players.clear();
                        break;
                    
                    case 'gameState':
                        if (gameState === 'playing') {
                            // Update or create players based on game state
                            const currentPlayerIds = new Set();
                            
                            data.players.forEach(playerData => {
                                currentPlayerIds.add(playerData.id);
                                
                                if (players.has(playerData.id)) {
                                    // Update existing player
                                    const player = players.get(playerData.id);
                                    player.setTarget(playerData.x, playerData.y);
                                } else {
                                    // Create new player
                                    const player = new Player(
                                        playerData.id,
                                        playerData.x,
                                        playerData.y,
                                        playerData.size
                                    );
                                    players.set(playerData.id, player);
                                }
                            });
                            
                            // Remove players that are no longer in the game
                            players.forEach((player, id) => {
                                if (!currentPlayerIds.has(id)) {
                                    players.delete(id);
                                }
                            });
                        }
                        break;
                    
                    case 'opponentLeft':
                        statusEl.textContent = 'Opponent disconnected. Returning to lobby...';
                        playerCountEl.textContent = '';
                        gameState = 'waiting';
                        players.clear();
                        break;
                    
                    case 'gameEnd':
                        statusEl.textContent = 'Game ended. Returning to lobby...';
                        playerCountEl.textContent = '';
                        gameState = 'waiting';
                        players.clear();
                        break;
                    
                    case 'pong':
                        // Silent pong
                        break;
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
        };
        
    } catch (err) {
        statusEl.textContent = 'Failed to connect. Check console.';
    }
}

// Input handling
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
    if (['w', 'a', 's', 'd'].includes(key) && keys[key]) {
        keys[key] = false;
        
        if (gameState === 'playing' && ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'keyup',
                key: key
            }));
        }
    }
});

// Visibility change handling
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ws && ws.readyState === WebSocket.CLOSED) {
        connect();
    }
});

// Game loop
let lastTime = performance.now();

function gameLoop(currentTime) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
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
    } else if (gameState === 'playing') {
        // Draw grid
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;
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
        
        // Update and draw players
        players.forEach(player => {
            player.update(deltaTime);
            player.draw();
        });
        
        // Draw game info
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.fillText('Use WASD to move', canvas.width - 10, 20);
        
        if (gameId !== undefined) {
            ctx.textAlign = 'left';
            ctx.fillText(`Game #${gameId}`, 10, 20);
        }
    } else {
        // Connecting screen
        ctx.fillStyle = '#333';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Connecting to server...', canvas.width / 2, canvas.height / 2);
    }
    
    requestAnimationFrame(gameLoop);
}

// Start the game
connect();
requestAnimationFrame(gameLoop);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
});
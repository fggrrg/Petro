const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { spawn } = require('child_process');

console.log('[SERVER] Starting server initialization...');

// Create HTTP server
const server = http.createServer((req, res) => {
    // Define static file mappings
    const routes = {
        '/': 'index.html',
        '/index.html': 'index.html',
        '/style.css': 'style.css',
        '/script.js': 'script.js'
    };
    
    const file = routes[req.url];
    
    if (file) {
        const filePath = path.join(__dirname, 'public', file);
        const ext = path.extname(file);
        const contentTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript'
        };
        
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
            res.end(data);
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });
console.log('[WEBSOCKET] WebSocket server created');

// Game management
const waitingPlayers = [];
const activeGames = new Map();
let playerIdCounter = 0;
let gameIdCounter = 0;
let isShuttingDown = false;

// Player class
class Player {
    constructor(ws, id) {
        this.ws = ws;
        this.id = id;
        this.gameId = null;
        this.isAlive = true;
    }
}

// Game class
class Game {
    constructor(id, player1, player2) {
        this.id = id;
        this.players = [player1, player2];
        this.pythonProcess = null;
        this.messageBuffer = '';
        this.isActive = true;
        this.startGame();
    }

    startGame() {
        console.log(`[GAME ${this.id}] Starting Python game process for players ${this.players[0].id} and ${this.players[1].id}`);
        
        // Start Python subprocess with unbuffered output
        this.pythonProcess = spawn('python', ['-u', 'game.py', this.id.toString()], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        // Handle stdout (game messages)
        this.pythonProcess.stdout.on('data', (data) => {
            this.messageBuffer += data.toString();
            const lines = this.messageBuffer.split('\n');
            this.messageBuffer = lines.pop(); // Keep incomplete line in buffer
            
            for (const line of lines) {
                if (line.trim()) {
                    this.handlePythonMessage(line.trim());
                }
            }
        });

        // Handle stderr (debug output)
        this.pythonProcess.stderr.on('data', (data) => {
            const message = data.toString().trim();
            if (message) {
                console.log(`[GAME ${this.id}] Python debug:`, message);
            }
        });

        this.pythonProcess.on('error', (error) => {
            console.error(`[GAME ${this.id}] Failed to start Python process:`, error.message);
            this.cleanup();
        });

        this.pythonProcess.on('close', (code) => {
            console.log(`[GAME ${this.id}] Python process exited with code ${code}`);
            this.cleanup();
        });

        // Send initial game state to Python
        setTimeout(() => {
            const initData = {
                type: 'init',
                players: this.players.map(p => ({ id: p.id }))
            };
            console.log(`[GAME ${this.id}] Sending init to Python:`, JSON.stringify(initData));
            this.sendToPython(initData);
        }, 100);

        // Notify players that game has started
        this.players.forEach((player, index) => {
            const gameStartData = {
                type: 'gameStart',
                gameId: this.id,
                playerId: player.id,
                opponentId: this.players[1 - index].id
            };
            console.log(`[GAME ${this.id}] Sending gameStart to player ${player.id}`);
            this.sendToPlayer(player, gameStartData);
        });
    }

    handlePythonMessage(message) {
        try {
            const data = JSON.parse(message);
            
            // Log what we receive from Python
            if (data.type === 'gameState') {
                console.log(`[GAME ${this.id}] Received gameState from Python with ${data.players?.length || 0} players`);
                
                // Broadcast game state to all players in this game
                this.players.forEach(player => {
                    if (player.ws.readyState === WebSocket.OPEN) {
                        player.ws.send(JSON.stringify(data));
                    }
                });
            } else {
                console.log(`[GAME ${this.id}] Received from Python:`, data.type);
            }
        } catch (err) {
            console.error(`[GAME ${this.id}] Error parsing Python message:`, err.message);
            console.error(`[GAME ${this.id}] Raw message:`, message);
        }
    }

    sendToPython(data) {
        if (this.pythonProcess && !this.pythonProcess.killed && this.isActive) {
            try {
                const message = JSON.stringify(data) + '\n';
                this.pythonProcess.stdin.write(message);
                console.log(`[GAME ${this.id}] Sent to Python:`, data.type, data.playerId || '');
            } catch (err) {
                console.error(`[GAME ${this.id}] Error sending to Python:`, err.message);
            }
        }
    }

    sendToPlayer(player, data) {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify(data));
        }
    }

    handlePlayerMessage(playerId, message) {
        // Forward player input to Python game process
        console.log(`[GAME ${this.id}] Player ${playerId} input:`, message.type);
        const data = {
            ...message,
            playerId: playerId,
            timestamp: Date.now()
        };
        this.sendToPython(data);
    }

    removePlayer(playerId) {
        console.log(`[GAME ${this.id}] Player ${playerId} left the game`);
        
        // Notify Python process
        this.sendToPython({
            type: 'playerLeft',
            playerId: playerId
        });

        // Notify remaining player
        this.players.forEach(player => {
            if (player.id !== playerId) {
                this.sendToPlayer(player, {
                    type: 'opponentLeft',
                    playerId: playerId
                });
            }
        });

        // End the game
        this.cleanup();
    }

    cleanup() {
        if (!this.isActive) return;
        this.isActive = false;
        
        console.log(`[GAME ${this.id}] Cleaning up game`);
        
        // Kill Python process if still running
        if (this.pythonProcess && !this.pythonProcess.killed) {
            this.pythonProcess.kill('SIGTERM');
        }

        // Move players back to waiting or disconnect them
        this.players.forEach(player => {
            player.gameId = null;
            if (player.ws.readyState === WebSocket.OPEN) {
                this.sendToPlayer(player, { type: 'gameEnd' });
            }
        });

        // Remove game from active games
        activeGames.delete(this.id);
        console.log(`[GAME ${this.id}] Game removed. Active games: ${activeGames.size}`);
    }
}

// Heartbeat to keep connections alive
const interval = setInterval(() => {
    if (isShuttingDown) return;
    
    wss.clients.forEach((ws) => {
        if (ws.player && ws.player.isAlive === false) {
            return ws.terminate();
        }
        if (ws.player) {
            ws.player.isAlive = false;
            ws.ping();
        }
    });
}, 30000);

// Match players when we have pairs
function matchPlayers() {
    while (waitingPlayers.length >= 2) {
        const player1 = waitingPlayers.shift();
        const player2 = waitingPlayers.shift();
        
        if (player1.ws.readyState !== WebSocket.OPEN) {
            waitingPlayers.unshift(player2);
            continue;
        }
        
        if (player2.ws.readyState !== WebSocket.OPEN) {
            waitingPlayers.unshift(player1);
            continue;
        }
        
        const gameId = gameIdCounter++;
        player1.gameId = gameId;
        player2.gameId = gameId;
        
        const game = new Game(gameId, player1, player2);
        activeGames.set(gameId, game);
        
        console.log(`[MATCHMAKING] Created game ${gameId} with players ${player1.id} and ${player2.id}`);
        console.log(`[MATCHMAKING] Waiting players: ${waitingPlayers.length}, Active games: ${activeGames.size}`);
    }
    
    // Update waiting players about their position
    waitingPlayers.forEach((player, index) => {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(JSON.stringify({
                type: 'waiting',
                position: index + 1,
                totalWaiting: waitingPlayers.length
            }));
        }
    });
}

wss.on('connection', (ws, req) => {
    const playerId = playerIdCounter++;
    const player = new Player(ws, playerId);
    ws.player = player;
    
    console.log(`[PLAYER] New player ${playerId} connected`);
    
    // Setup heartbeat
    ws.on('pong', () => {
        player.isAlive = true;
    });
    
    // Send player their ID
    ws.send(JSON.stringify({
        type: 'connected',
        playerId: playerId
    }));
    
    // Add to waiting queue
    waitingPlayers.push(player);
    console.log(`[MATCHMAKING] Player ${playerId} added to queue. Waiting players: ${waitingPlayers.length}`);
    
    // Try to match players
    matchPlayers();

    // Handle messages
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong' }));
                return;
            }
            
            // If player is in a game, forward to game handler
            if (player.gameId !== null) {
                const game = activeGames.get(player.gameId);
                if (game && game.isActive) {
                    game.handlePlayerMessage(playerId, data);
                }
            }
        } catch (err) {
            console.error(`[PLAYER ${playerId}] Error parsing message:`, err.message);
        }
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error(`[PLAYER ${playerId}] WebSocket error:`, error.message);
    });

    // Handle disconnection
    ws.on('close', (code, reason) => {
        console.log(`[PLAYER ${playerId}] Disconnected. Code: ${code}`);
        
        // Remove from waiting queue if present
        const waitingIndex = waitingPlayers.indexOf(player);
        if (waitingIndex !== -1) {
            waitingPlayers.splice(waitingIndex, 1);
            console.log(`[MATCHMAKING] Removed player ${playerId} from queue. Waiting players: ${waitingPlayers.length}`);
        }
        
        // Remove from game if in one
        if (player.gameId !== null) {
            const game = activeGames.get(player.gameId);
            if (game && game.isActive) {
                game.removePlayer(playerId);
            }
        }
        
        matchPlayers(); // Update waiting players
    });
});

wss.on('error', (error) => {
    console.error('[WEBSOCKET] Server error:', error);
});

// Graceful shutdown handler
function gracefulShutdown() {
    console.log('\n[SERVER] Initiating graceful shutdown...');
    isShuttingDown = true;
    
    clearInterval(interval);
    
    // Kill all Python processes
    activeGames.forEach(game => {
        game.cleanup();
    });
    
    wss.clients.forEach((ws) => {
        ws.close(1000, 'Server shutting down');
    });
    
    wss.close(() => {
        console.log('[WEBSOCKET] WebSocket server closed');
        
        server.close(() => {
            console.log('[HTTP] HTTP server closed');
            process.exit(0);
        });
    });
    
    setTimeout(() => {
        console.error('[SERVER] Forcing exit');
        process.exit(1);
    }, 5000);
}

// Handle shutdown signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

process.on('uncaughtException', (error) => {
    console.error('[SERVER] Uncaught exception:', error);
    gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[SERVER] Unhandled rejection:', reason);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Server running on http://0.0.0.0:${PORT}`);
    console.log('[SERVER] Ready to accept connections');
});
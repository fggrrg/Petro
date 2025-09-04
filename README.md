# How it works


The system has three main components:
1. **Browser Client** (`script.js`) - Game UI and player input
2. **Node.js Server** (`server.js`) - Connection management and matchmaking
3. **Python Game Engine** (`game.py`) - Game physics and state management

## Communication Flow with Examples

### 1. **Player Connection & Matchmaking**

```
Browser → Node.js (WebSocket)
```
When a player connects:
- Browser establishes WebSocket connection
- Node.js assigns a player ID and adds them to waiting queue
- Node.js sends: `{type: 'connected', playerId: 1}`
- Node.js sends periodic updates: `{type: 'waiting', position: 1, totalWaiting: 1}`

### 2. **Game Start (When 2 Players Match)**

```
Node.js → Python (stdin) → Node.js → Browser (WebSocket)
```
Example flow:
- Node.js spawns Python process: `python -u game.py 0`
- Node.js sends to Python stdin: `{type: 'init', players: [{id: 1}, {id: 2}]}`
- Node.js sends to both browsers: `{type: 'gameStart', gameId: 0, playerId: 1, opponentId: 2}`
- Python starts game loop at 30Hz

### 3. **Player Input Flow**

```
Browser → Node.js → Python → Node.js → All Browsers
```
When Player 1 presses 'W':
1. Browser sends: `{type: 'keydown', key: 'w'}`
2. Node.js forwards to Python: `{type: 'keydown', key: 'w', playerId: 1, timestamp: 1234567890}`
3. Python updates Player 1's internal state (`keys['w'] = True`)
4. Python calculates new positions and sends back via stdout:
```json
{
  "type": "gameState",
  "players": [
    {"id": 1, "x": 200.5, "y": 295.0, "size": 30},
    {"id": 2, "x": 600.0, "y": 300.0, "size": 30}
  ],
  "timestamp": 1234567900
}
```
5. Node.js broadcasts this to both players' browsers
6. Browsers update player positions with interpolation

### 4. **Game State Updates**

The Python game loop runs at 30Hz and continuously:
- Processes player input from its internal key states
- Updates physics (movement with WASD keys)
- Sends position updates to Node.js via stdout
- Node.js broadcasts to all connected players in that game

Example update cycle:
```python
# Python calculates movement
if player.keys['w']:
    dy -= 1  # Move up
# Apply speed and delta time
new_y = player.y + dy * player.speed * dt
# Send update
print(json.dumps({'type': 'gameState', 'players': [...]}))
```

### 5. **Disconnection Handling**

When a player disconnects:
1. Browser WebSocket closes
2. Node.js detects disconnection
3. Node.js sends to Python: `{type: 'playerLeft', playerId: 1}`
4. Node.js sends to remaining player: `{type: 'opponentLeft', playerId: 1}`
5. Python process is terminated
6. Game is cleaned up

### 6. **Keep-Alive Mechanism**

Two ping systems prevent connection timeouts:
- **Browser → Node.js**: Every 25 seconds sends `{type: 'ping'}`, expects `{type: 'pong'}`
- **Node.js → Browser**: Every 30 seconds sends WebSocket ping frames

## Key Communication Patterns

1. **Stdin/Stdout IPC**: Node.js communicates with Python using process pipes
   - Node.js writes JSON lines to Python's stdin
   - Python writes JSON lines to stdout
   - stderr is used for debug logging

2. **Message Buffering**: Python output is buffered and split by newlines to handle partial messages

3. **State Synchronization**: Python is the authoritative source for game state, broadcasting positions 30 times per second

4. **Input Validation**: The browser tracks key states locally to prevent duplicate messages

This architecture separates concerns nicely - Node.js handles connections and matchmaking, Python handles game logic, and the browser handles rendering and input capture.
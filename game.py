#!/usr/bin/env python3
import sys
import json
import time
import threading
import math
from dataclasses import dataclass, asdict
from typing import Dict, Optional

@dataclass
class Player:
    id: int
    x: float = 400.0
    y: float = 300.0
    vx: float = 0.0
    vy: float = 0.0
    speed: float = 300.0  # pixels per second
    size: float = 30.0
    keys: Dict[str, bool] = None
    
    def __post_init__(self):
        if self.keys is None:
            self.keys = {'w': False, 'a': False, 's': False, 'd': False}

class Game:
    def __init__(self, game_id: str):
        self.game_id = game_id
        self.players: Dict[int, Player] = {}
        self.running = True
        self.last_update = time.time()
        self.update_rate = 60  # Hz
        
        # Game area
        self.width = 800
        self.height = 600
        
        sys.stderr.write(f"[GAME {game_id}] Python game instance started\n")
        sys.stderr.flush()
    
    def add_player(self, player_id: int):
        # Position players on opposite sides
        if len(self.players) == 0:
            x = 200
        else:
            x = 600
            
        self.players[player_id] = Player(
            id=player_id,
            x=x,
            y=300
        )
        sys.stderr.write(f"[GAME {self.game_id}] Added player {player_id}\n")
        sys.stderr.flush()
    
    def remove_player(self, player_id: int):
        if player_id in self.players:
            del self.players[player_id]
            sys.stderr.write(f"[GAME {self.game_id}] Removed player {player_id}\n")
            sys.stderr.flush()
    
    def handle_input(self, player_id: int, data: dict):
        if player_id not in self.players:
            return
            
        player = self.players[player_id]
        
        if data['type'] == 'keydown':
            key = data.get('key', '').lower()
            if key in player.keys:
                player.keys[key] = True
                
        elif data['type'] == 'keyup':
            key = data.get('key', '').lower()
            if key in player.keys:
                player.keys[key] = False
    
    def update(self, dt: float):
        for player in self.players.values():
            # Calculate movement based on keys
            dx = 0
            dy = 0
            
            if player.keys['w']:
                dy -= 1
            if player.keys['s']:
                dy += 1
            if player.keys['a']:
                dx -= 1
            if player.keys['d']:
                dx += 1
            
            # Normalize diagonal movement
            if dx != 0 and dy != 0:
                length = math.sqrt(dx * dx + dy * dy)
                dx /= length
                dy /= length
            
            # Apply movement
            move_distance = player.speed * dt
            new_x = player.x + dx * move_distance
            new_y = player.y + dy * move_distance
            
            # Keep in bounds
            player.x = max(player.size/2, min(self.width - player.size/2, new_x))
            player.y = max(player.size/2, min(self.height - player.size/2, new_y))
    
    def get_state(self):
        return {
            'type': 'gameState',
            'players': [
                {
                    'id': p.id,
                    'x': p.x,
                    'y': p.y,
                    'size': p.size
                }
                for p in self.players.values()
            ],
            'timestamp': time.time() * 1000
        }
    
    def send_state(self):
        state = self.get_state()
        print(json.dumps(state), flush=True)
    
    def run(self):
        """Main game loop"""
        while self.running and len(self.players) > 0:
            current_time = time.time()
            dt = current_time - self.last_update
            self.last_update = current_time
            
            # Update game physics
            self.update(dt)
            
            # Send state to Node.js
            self.send_state()
            
            # Sleep to maintain update rate
            sleep_time = (1.0 / self.update_rate) - (time.time() - current_time)
            if sleep_time > 0:
                time.sleep(sleep_time)
        
        sys.stderr.write(f"[GAME {self.game_id}] Game loop ended\n")
        sys.stderr.flush()

def main():
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: game.py <game_id>\n")
        sys.exit(1)
    
    game_id = sys.argv[1]
    game = Game(game_id)
    
    # Start game loop in separate thread
    game_thread = threading.Thread(target=game.run)
    game_thread.daemon = True
    game_thread.start()
    
    # Read input from Node.js
    try:
        for line in sys.stdin:
            try:
                data = json.loads(line.strip())
                
                if data['type'] == 'init':
                    # Initialize players
                    for player_data in data.get('players', []):
                        game.add_player(player_data['id'])
                
                elif data['type'] == 'playerLeft':
                    game.remove_player(data['playerId'])
                    if len(game.players) == 0:
                        game.running = False
                        break
                
                elif data.get('playerId') is not None:
                    # Player input
                    game.handle_input(data['playerId'], data)
                    
            except json.JSONDecodeError as e:
                sys.stderr.write(f"[GAME {game_id}] JSON decode error: {e}\n")
                sys.stderr.flush()
            except Exception as e:
                sys.stderr.write(f"[GAME {game_id}] Error: {e}\n")
                sys.stderr.flush()
    
    except KeyboardInterrupt:
        pass
    finally:
        game.running = False
        sys.stderr.write(f"[GAME {game_id}] Shutting down\n")
        sys.stderr.flush()

if __name__ == "__main__":
    main()
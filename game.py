#!/usr/bin/env python3
import sys
import json
import time
import threading
import math

class Player:
    def __init__(self, player_id, x=400.0, y=300.0):
        self.id = player_id
        self.x = x
        self.y = y
        self.speed = 300.0  # pixels per second
        self.size = 30.0
        self.keys = {'w': False, 'a': False, 's': False, 'd': False}

class Game:
    def __init__(self, game_id):
        self.game_id = game_id
        self.players = {}
        self.running = True
        self.last_update = time.time()
        self.update_rate = 30  # Hz - reduced for better performance
        self.width = 800
        self.height = 600
        
        sys.stderr.write(f"Game {game_id} initialized\n")
        sys.stderr.flush()
    
    def add_player(self, player_id):
        # Position players on opposite sides
        if len(self.players) == 0:
            x = 200.0
        else:
            x = 600.0
            
        self.players[player_id] = Player(player_id, x, 300.0)
        sys.stderr.write(f"Added player {player_id} at position ({x}, 300)\n")
        sys.stderr.flush()
        
        # Send immediate state update
        self.send_state()
    
    def remove_player(self, player_id):
        if player_id in self.players:
            del self.players[player_id]
            sys.stderr.write(f"Removed player {player_id}\n")
            sys.stderr.flush()
    
    def handle_input(self, player_id, data):
        if player_id not in self.players:
            return
            
        player = self.players[player_id]
        
        if data['type'] == 'keydown':
            key = data.get('key', '').lower()
            if key in player.keys:
                player.keys[key] = True
                sys.stderr.write(f"Player {player_id} pressed {key}\n")
                sys.stderr.flush()
                
        elif data['type'] == 'keyup':
            key = data.get('key', '').lower()
            if key in player.keys:
                player.keys[key] = False
                sys.stderr.write(f"Player {player_id} released {key}\n")
                sys.stderr.flush()
    
    def update(self, dt):
        for player_id, player in self.players.items():
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
            if dx != 0 or dy != 0:
                move_distance = player.speed * dt
                new_x = player.x + dx * move_distance
                new_y = player.y + dy * move_distance
                
                # Keep in bounds
                player.x = max(player.size/2, min(self.width - player.size/2, new_x))
                player.y = max(player.size/2, min(self.height - player.size/2, new_y))
    
    def send_state(self):
        if not self.players:
            return
            
        state = {
            'type': 'gameState',
            'players': [
                {
                    'id': p.id,
                    'x': round(p.x, 2),
                    'y': round(p.y, 2),
                    'size': p.size
                }
                for p in self.players.values()
            ],
            'timestamp': int(time.time() * 1000)
        }
        
        print(json.dumps(state), flush=True)
    
    def run(self):
        """Main game loop"""
        sys.stderr.write(f"Game loop started\n")
        sys.stderr.flush()
        
        while self.running:
            current_time = time.time()
            dt = current_time - self.last_update
            self.last_update = current_time
            
            if self.players:  # Only update if we have players
                # Update game physics
                self.update(dt)
                
                # Send state to Node.js
                self.send_state()
            
            # Sleep to maintain update rate
            sleep_time = (1.0 / self.update_rate) - (time.time() - current_time)
            if sleep_time > 0:
                time.sleep(sleep_time)
        
        sys.stderr.write(f"Game loop ended\n")
        sys.stderr.flush()

def main():
    if len(sys.argv) < 2:
        sys.stderr.write("No game ID provided\n")
        sys.stderr.flush()
        sys.exit(1)
    
    game_id = sys.argv[1]
    game = Game(game_id)
    
    # Start game loop in separate thread
    game_thread = threading.Thread(target=game.run)
    game_thread.daemon = True
    game_thread.start()
    
    sys.stderr.write(f"Waiting for input...\n")
    sys.stderr.flush()
    
    # Read input from Node.js
    try:
        while True:
            line = sys.stdin.readline()
            if not line:
                break
                
            try:
                data = json.loads(line.strip())
                sys.stderr.write(f"Received: {data.get('type')} from player {data.get('playerId', 'N/A')}\n")
                sys.stderr.flush()
                
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
                sys.stderr.write(f"JSON decode error: {e}\n")
                sys.stderr.flush()
            except Exception as e:
                sys.stderr.write(f"Error: {e}\n")
                sys.stderr.flush()
    
    except (KeyboardInterrupt, EOFError):
        pass
    finally:
        game.running = False
        sys.stderr.write(f"Shutting down\n")
        sys.stderr.flush()

if __name__ == "__main__":
    main()
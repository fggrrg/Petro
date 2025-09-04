#!/usr/bin/env python3
import sys
import json
import time
import threading
import math
import random

class Bullet:
    def __init__(self, x, y, dx, dy, owner_id):
        self.x = x
        self.y = y
        self.dx = dx * 600  # bullet speed
        self.dy = dy * 600
        self.owner_id = owner_id
        self.size = 5
        self.damage = 20
        self.lifetime = 2.0
        self.age = 0

    def update(self, dt):
        self.x += self.dx * dt
        self.y += self.dy * dt
        self.age += dt
        return self.age < self.lifetime

class Player:
    def __init__(self, player_id, x=400.0, y=300.0):
        self.id = player_id
        self.x = x
        self.y = y
        self.speed = 300.0  # pixels per second
        self.size = 30.0
        self.keys = {'w': False, 'a': False, 's': False, 'd': False, 'e': False}
        self.has_treasure = False
        self.is_opening_chest = False
        self.is_stealing = False
        self.health = 100
        self.max_health = 100
        self.last_shot_time = 0
        self.fire_rate = 0.25  # seconds between shots
        self.respawn_time = 0
        self.is_dead = False
        self.mouse_x = 400
        self.mouse_y = 300

class TreasureChest:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.size = 40
        self.state = 'spawning'  # spawning, inactive, active, opening, opened
        self.spawn_time = time.time()
        self.activation_delay = 20.0  # seconds until activation
        self.opening_duration = 3.0  # reduced to 3 seconds
        self.opening_progress = 0.0
        self.opener_id = None
        self.open_start_time = None
        
    def update(self, dt):
        if self.state == 'spawning':
            if time.time() - self.spawn_time >= self.activation_delay:
                self.state = 'active'
                
        elif self.state == 'opening':
            if self.opener_id and self.open_start_time:
                self.opening_progress = min(1.0, (time.time() - self.open_start_time) / self.opening_duration)
                if self.opening_progress >= 1.0:
                    self.state = 'opened'
                    return True  # Chest fully opened
        return False

class Treasure:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.size = 25
        self.holder_id = None
        self.visible = True
        
    def pick_up(self, player_id):
        if self.holder_id is None and self.visible:  # Only if no one holds it
            self.holder_id = player_id
            return True
        return False
        
    def drop(self, x, y):
        self.x = x
        self.y = y
        self.holder_id = None
        self.visible = True

class Cashout:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.size = 50
        self.state = 'inactive'  # inactive, active, stealing, completed
        self.owner_id = None
        self.progress = 0.0
        self.duration = 60.0  # 1 minute cashout
        self.start_time = None
        self.steal_start_time = None
        self.steal_duration = 7.0  # 7 seconds to steal
        self.stealer_id = None
        
    def start_cashout(self, player_id):
        self.state = 'active'
        self.owner_id = player_id
        self.start_time = time.time()
        self.progress = 0.0
        
    def start_steal(self, player_id):
        if self.state == 'active' and player_id != self.owner_id:
            self.state = 'stealing'
            self.stealer_id = player_id
            self.steal_start_time = time.time()
            return True
        return False
        
    def update(self, dt):
        if self.state == 'active':
            if self.start_time:
                self.progress = min(1.0, (time.time() - self.start_time) / self.duration)
                if self.progress >= 1.0:
                    self.state = 'completed'
                    return True  # Cashout completed
                    
        elif self.state == 'stealing':
            if self.steal_start_time and self.stealer_id:
                steal_progress = (time.time() - self.steal_start_time) / self.steal_duration
                if steal_progress >= 1.0:
                    # Steal successful
                    self.owner_id = self.stealer_id
                    self.state = 'active'
                    self.stealer_id = None
                    self.steal_start_time = None
                    # Don't reset main progress, continue from where it was
        return False

class Game:
    def __init__(self, game_id):
        self.game_id = game_id
        self.players = {}
        self.running = True
        self.last_update = time.time()
        self.update_rate = 30  # Hz
        self.width = 800
        self.height = 600
        
        # Game objects
        self.treasure_chest = None
        self.treasure = None
        self.cashout = None
        self.bullets = []
        self.walls = []  # Add walls array
        self.game_phase = 'waiting'  # waiting, countdown, chest_spawned, chest_opened, cashout_active, game_over
        self.winner_id = None
        self.game_start_time = None
        self.countdown_duration = 3.0  # 3 second countdown
        
        # Generate map
        self.generate_map()
        
        sys.stderr.write(f"Game {game_id} initialized\n")
        sys.stderr.flush()
    
    def generate_map(self):
        """Generate Pac-Man style map with walls"""
        self.walls = []
        
        # Border walls
        wall_thickness = 20
        
        # Pac-Man inspired maze layout
        wall_configs = [
            # Outer walls with gaps
            {'x': 150, 'y': 100, 'w': 100, 'h': 20},
            {'x': 550, 'y': 100, 'w': 100, 'h': 20},
            {'x': 150, 'y': 480, 'w': 100, 'h': 20},
            {'x': 550, 'y': 480, 'w': 100, 'h': 20},
            
            # Center box
            {'x': 350, 'y': 250, 'w': 100, 'h': 100},
            
            # T-shapes
            {'x': 200, 'y': 200, 'w': 20, 'h': 200},
            {'x': 580, 'y': 200, 'w': 20, 'h': 200},
            {'x': 100, 'y': 290, 'w': 120, 'h': 20},
            {'x': 580, 'y': 290, 'w': 120, 'h': 20},
            
            # L-shapes
            {'x': 280, 'y': 150, 'w': 20, 'h': 80},
            {'x': 280, 'y': 150, 'w': 80, 'h': 20},
            {'x': 500, 'y': 150, 'w': 20, 'h': 80},
            {'x': 440, 'y': 150, 'w': 80, 'h': 20},
            
            {'x': 280, 'y': 370, 'w': 20, 'h': 80},
            {'x': 280, 'y': 430, 'w': 80, 'h': 20},
            {'x': 500, 'y': 370, 'w': 20, 'h': 80},
            {'x': 440, 'y': 430, 'w': 80, 'h': 20},
        ]
        
        for config in wall_configs:
            self.walls.append(config)
        
        sys.stderr.write(f"Generated map with {len(self.walls)} walls\n")
        sys.stderr.flush()
    
    def find_valid_spawn_position(self, min_distance_from_walls=50):
        """Find a valid spawn position not inside walls"""
        max_attempts = 100
        for _ in range(max_attempts):
            x = random.uniform(60, self.width - 60)
            y = random.uniform(60, self.height - 60)
            
            valid = True
            for wall in self.walls:
                # Check if position is too close to wall
                if (x + min_distance_from_walls > wall['x'] and 
                    x - min_distance_from_walls < wall['x'] + wall['w'] and
                    y + min_distance_from_walls > wall['y'] and 
                    y - min_distance_from_walls < wall['y'] + wall['h']):
                    valid = False
                    break
            
            if valid:
                return x, y
        
        # Fallback to center if no valid position found
        return self.width / 2, self.height / 2
    
    def add_player(self, player_id):
        # Position players on opposite sides but not in walls
        if len(self.players) == 0:
            x, y = 100.0, 300.0
        else:
            x, y = 700.0, 300.0
            
        self.players[player_id] = Player(player_id, x, y)
        sys.stderr.write(f"Added player {player_id} at position ({x}, {y})\n")
        sys.stderr.flush()
        
        # Start countdown when both players join
        if len(self.players) == 2 and self.game_phase == 'waiting':
            self.game_start_time = time.time()
            self.game_phase = 'countdown'
            sys.stderr.write(f"Starting countdown\n")
            sys.stderr.flush()
        
        # Send immediate state update
        self.send_state()
    
    def spawn_treasure_chest(self):
        # Spawn at random position not inside walls
        x, y = self.find_valid_spawn_position()
        self.treasure_chest = TreasureChest(x, y)
        self.game_phase = 'chest_spawned'
        sys.stderr.write(f"Treasure chest spawned at ({x}, {y})\n")
        sys.stderr.flush()
    
    def remove_player(self, player_id):
        if player_id in self.players:
            # If player was holding treasure, drop it
            if self.treasure and self.treasure.holder_id == player_id:
                player = self.players[player_id]
                self.treasure.drop(player.x, player.y)
                
            del self.players[player_id]
            sys.stderr.write(f"Removed player {player_id}\n")
            sys.stderr.flush()
    
    def handle_input(self, player_id, data):
        if player_id not in self.players:
            return
            
        player = self.players[player_id]
        
        # Don't process input during countdown or if player is dead
        if self.game_phase == 'countdown' or player.is_dead:
            return
        
        if data['type'] == 'keydown':
            key = data.get('key', '').lower()
            if key in player.keys:
                player.keys[key] = True
                
                # Handle E key for interactions
                if key == 'e':
                    self.handle_interaction(player_id)
                    
        elif data['type'] == 'keyup':
            key = data.get('key', '').lower()
            if key in player.keys:
                player.keys[key] = False
                
                # Cancel actions on E release
                if key == 'e':
                    self.cancel_interaction(player_id)
                    
        elif data['type'] == 'mouse':
            player.mouse_x = data.get('x', player.mouse_x)
            player.mouse_y = data.get('y', player.mouse_y)
            
        elif data['type'] == 'shoot':
            self.handle_shoot(player_id, data)
    
    def handle_shoot(self, player_id, data):
        player = self.players[player_id]
        
        # Check fire rate
        current_time = time.time()
        if current_time - player.last_shot_time < player.fire_rate:
            return
            
        player.last_shot_time = current_time
        
        # Calculate bullet direction
        target_x = data.get('targetX', player.x + 100)
        target_y = data.get('targetY', player.y)
        
        dx = target_x - player.x
        dy = target_y - player.y
        length = math.sqrt(dx * dx + dy * dy)
        
        if length > 0:
            dx /= length
            dy /= length
            
            # Create bullet slightly in front of player
            bullet_x = player.x + dx * (player.size/2 + 10)
            bullet_y = player.y + dy * (player.size/2 + 10)
            
            self.bullets.append(Bullet(bullet_x, bullet_y, dx, dy, player_id))
            sys.stderr.write(f"Player {player_id} shot bullet\n")
            sys.stderr.flush()
    
    def handle_interaction(self, player_id):
        player = self.players[player_id]
        
        # Check chest interaction
        if self.treasure_chest and self.treasure_chest.state == 'active':
            dist = self.get_distance(player.x, player.y, self.treasure_chest.x, self.treasure_chest.y)
            if dist < 60:  # Interaction range
                if self.treasure_chest.state == 'active':
                    self.treasure_chest.state = 'opening'
                    self.treasure_chest.opener_id = player_id
                    self.treasure_chest.open_start_time = time.time()
                    self.treasure_chest.opening_progress = 0.0
                    player.is_opening_chest = True
                    sys.stderr.write(f"Player {player_id} started opening chest\n")
                    sys.stderr.flush()
        
        # Check treasure pickup (only if visible and not held)
        elif self.treasure and self.treasure.visible and not self.treasure.holder_id and not player.has_treasure:
            dist = self.get_distance(player.x, player.y, self.treasure.x, self.treasure.y)
            if dist < 50:
                if self.treasure.pick_up(player_id):
                    player.has_treasure = True
                    sys.stderr.write(f"Player {player_id} picked up treasure\n")
                    sys.stderr.flush()
        
        # Check cashout interaction
        elif self.cashout and player.has_treasure:
            dist = self.get_distance(player.x, player.y, self.cashout.x, self.cashout.y)
            if dist < 70:
                if self.cashout.state == 'inactive':
                    # Start cashout and hide treasure
                    self.cashout.start_cashout(player_id)
                    self.treasure.holder_id = None
                    self.treasure.visible = False  # Hide treasure
                    player.has_treasure = False
                    self.game_phase = 'cashout_active'
                    sys.stderr.write(f"Player {player_id} started cashout\n")
                    sys.stderr.flush()
        
        # Check steal interaction
        elif self.cashout and self.cashout.state == 'active' and self.cashout.owner_id != player_id:
            dist = self.get_distance(player.x, player.y, self.cashout.x, self.cashout.y)
            if dist < 70:
                if self.cashout.start_steal(player_id):
                    player.is_stealing = True
                    sys.stderr.write(f"Player {player_id} started stealing cashout\n")
                    sys.stderr.flush()
    
    def cancel_interaction(self, player_id):
        if player_id not in self.players:
            return
            
        player = self.players[player_id]
        
        # Cancel chest opening
        if player.is_opening_chest and self.treasure_chest:
            if self.treasure_chest.opener_id == player_id and self.treasure_chest.state == 'opening':
                self.treasure_chest.state = 'active'
                self.treasure_chest.opener_id = None
                self.treasure_chest.opening_progress = 0.0
                player.is_opening_chest = False
                sys.stderr.write(f"Player {player_id} stopped opening chest\n")
                sys.stderr.flush()
        
        # Cancel stealing
        if player.is_stealing and self.cashout:
            if self.cashout.stealer_id == player_id and self.cashout.state == 'stealing':
                self.cashout.state = 'active'
                self.cashout.stealer_id = None
                self.cashout.steal_start_time = None
                player.is_stealing = False
                sys.stderr.write(f"Player {player_id} stopped stealing\n")
                sys.stderr.flush()
    
    def get_distance(self, x1, y1, x2, y2):
        return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    
    def handle_player_death(self, player):
        player.is_dead = True
        player.respawn_time = time.time() + 3.0  # 3 second respawn
        
        # Drop treasure if holding
        if self.treasure and self.treasure.holder_id == player.id:
            self.treasure.drop(player.x, player.y)
            self.treasure.holder_id = None
            self.treasure.visible = True  # Make sure it's visible when dropped
            player.has_treasure = False
            sys.stderr.write(f"Player {player.id} dropped treasure at death\n")
            sys.stderr.flush()
            
        sys.stderr.write(f"Player {player.id} died\n")
        sys.stderr.flush()
    
    def respawn_player(self, player):
        player.is_dead = False
        player.health = player.max_health
        player.is_opening_chest = False
        player.is_stealing = False
        
        # Respawn at original position
        if player.id == min(self.players.keys()):
            player.x = 100.0
        else:
            player.x = 700.0
        player.y = 300.0
        
        sys.stderr.write(f"Player {player.id} respawned\n")
        sys.stderr.flush()
    
    def update(self, dt):
        # Handle countdown phase
        if self.game_phase == 'countdown':
            if time.time() - self.game_start_time >= self.countdown_duration:
                self.spawn_treasure_chest()
        
        # Update players
        for player_id, player in self.players.items():
            # Handle respawn
            if player.is_dead:
                if time.time() >= player.respawn_time:
                    self.respawn_player(player)
                continue
            
            # Cancel interactions if player moved too far
            if player.is_opening_chest and self.treasure_chest:
                dist = self.get_distance(player.x, player.y, self.treasure_chest.x, self.treasure_chest.y)
                if dist > 65:
                    self.cancel_interaction(player_id)
            
            if player.is_stealing and self.cashout:
                dist = self.get_distance(player.x, player.y, self.cashout.x, self.cashout.y)
                if dist > 75:
                    self.cancel_interaction(player_id)
            
            # Calculate movement based on keys (but not while performing actions)
            if not player.is_opening_chest and not player.is_stealing:
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
                    # Reduce speed if carrying treasure
                    speed_modifier = 0.7 if player.has_treasure else 1.0
                    move_distance = player.speed * speed_modifier * dt
                    new_x = player.x + dx * move_distance
                    new_y = player.y + dy * move_distance
                    
                    # Check wall collisions
                    can_move = True
                    player_radius = player.size / 2
                    
                    for wall in self.walls:
                        # Check if new position would collide with wall
                        if (new_x + player_radius > wall['x'] and 
                            new_x - player_radius < wall['x'] + wall['w'] and
                            new_y + player_radius > wall['y'] and 
                            new_y - player_radius < wall['y'] + wall['h']):
                            can_move = False
                            break
                    
                    if can_move:
                        # Keep in bounds
                        player.x = max(player.size/2, min(self.width - player.size/2, new_x))
                        player.y = max(player.size/2, min(self.height - player.size/2, new_y))
            
            # Update treasure position if held
            if self.treasure and self.treasure.holder_id == player_id:
                self.treasure.x = player.x
                self.treasure.y = player.y
        
        # Update bullets
        remaining_bullets = []
        for bullet in self.bullets:
            if bullet.update(dt):
                # Check if bullet is in bounds
                if 0 <= bullet.x <= self.width and 0 <= bullet.y <= self.height:
                    # Check collision with walls
                    hit = False
                    for wall in self.walls:
                        if (bullet.x > wall['x'] and 
                            bullet.x < wall['x'] + wall['w'] and
                            bullet.y > wall['y'] and 
                            bullet.y < wall['y'] + wall['h']):
                            hit = True
                            break
                    
                    if not hit:
                        # Check collision with players
                        for player_id, player in self.players.items():
                            if player_id != bullet.owner_id and not player.is_dead:
                                dist = self.get_distance(bullet.x, bullet.y, player.x, player.y)
                                if dist < player.size/2 + bullet.size:
                                    # Hit!
                                    player.health -= bullet.damage
                                    if player.health <= 0:
                                        player.health = 0
                                        self.handle_player_death(player)
                                    hit = True
                                    break
                    
                    if not hit:
                        remaining_bullets.append(bullet)
        
        self.bullets = remaining_bullets
        
        # Update game objects
        if self.treasure_chest:
            if self.treasure_chest.update(dt):
                # Chest opened, spawn treasure and cashout at random positions
                treasure_x, treasure_y = self.find_valid_spawn_position(30)
                self.treasure = Treasure(treasure_x, treasure_y)
                
                # Spawn cashout at random position
                cashout_x, cashout_y = self.find_valid_spawn_position(50)
                self.cashout = Cashout(cashout_x, cashout_y)
                self.game_phase = 'chest_opened'
                
                # Reset player states
                for p in self.players.values():
                    p.is_opening_chest = False
                
                sys.stderr.write(f"Chest opened! Treasure at ({treasure_x}, {treasure_y}), Cashout at ({cashout_x}, {cashout_y})\n")
                sys.stderr.flush()
        
        if self.cashout:
            if self.cashout.update(dt):
                # Game won!
                self.winner_id = self.cashout.owner_id
                self.game_phase = 'game_over'
                sys.stderr.write(f"Game won by player {self.winner_id}!\n")
                sys.stderr.flush()
                
                # Send win message
                self.send_game_over()
    
    def send_game_over(self):
        message = {
            'type': 'gameOver',
            'winner': self.winner_id,
            'timestamp': int(time.time() * 1000)
        }
        print(json.dumps(message), flush=True)
    
    def send_state(self):
        if not self.players:
            return
            
        state = {
            'type': 'gameState',
            'phase': self.game_phase,
            'walls': self.walls,
            'players': [
                {
                    'id': p.id,
                    'x': round(p.x, 2),
                    'y': round(p.y, 2),
                    'size': p.size,
                    'health': p.health,
                    'maxHealth': p.max_health,
                    'hasTreasure': p.has_treasure,
                    'isOpeningChest': p.is_opening_chest,
                    'isStealing': p.is_stealing,
                    'isDead': p.is_dead
                }
                for p in self.players.values()
            ],
            'bullets': [
                {
                    'x': round(b.x, 2),
                    'y': round(b.y, 2),
                    'size': b.size
                }
                for b in self.bullets
            ],
            'timestamp': int(time.time() * 1000)
        }
        
        # Add countdown info
        if self.game_phase == 'countdown':
            time_left = max(0, self.countdown_duration - (time.time() - self.game_start_time))
            state['countdown'] = round(time_left, 1)
        
        # Add treasure chest info
        if self.treasure_chest:
            state['treasureChest'] = {
                'x': self.treasure_chest.x,
                'y': self.treasure_chest.y,
                'size': self.treasure_chest.size,
                'state': self.treasure_chest.state,
                'openingProgress': round(self.treasure_chest.opening_progress, 2),
                'timeUntilActive': max(0, self.treasure_chest.activation_delay - (time.time() - self.treasure_chest.spawn_time)) if self.treasure_chest.state == 'spawning' else 0
            }
        
        # Add treasure info (only if visible)
        if self.treasure and self.treasure.visible:
            state['treasure'] = {
                'x': round(self.treasure.x, 2),
                'y': round(self.treasure.y, 2),
                'size': self.treasure.size,
                'holderId': self.treasure.holder_id
            }
        
        # Add cashout info
        if self.cashout:
            state['cashout'] = {
                'x': self.cashout.x,
                'y': self.cashout.y,
                'size': self.cashout.size,
                'state': self.cashout.state,
                'ownerId': self.cashout.owner_id,
                'progress': round(self.cashout.progress, 2),
                'stealerId': self.cashout.stealer_id,
                'timeRemaining': round(self.cashout.duration * (1 - self.cashout.progress)) if self.cashout.state == 'active' else 0
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
                
                # End game if won
                if self.game_phase == 'game_over':
                    time.sleep(3)  # Give time for final message
                    self.running = False
                    break
            
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
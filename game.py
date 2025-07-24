import sys
import os
import requests
import json
import random
import time
from dotenv import load_dotenv

load_dotenv()

port = os.getenv("PORT", "3000")
API_URL = f"http://localhost:{port}/api"

# --- Global Game State ---
user_id = None
money = 0
stage = 1
Inventory = []
pet_levels = {}

# --- Static Data ---
common_pets = ["ant", "bee", "beetle", "caterpillar", "cockroach", "earwig", "fly", "grasshopper", "ladybug", "maggot", "mosquito", "moth", "pillbug", "slug", "snale", "spider", "springtail", "tick", "worm"]
rare_pets = ["badger", "cat", "cobra", "eagle", "falcon", "fox", "hamster", "lynx", "mouse", "otter", "owl", "peregrine_falcon", "rat", "raven", "shrew", "snake"]
legendary_pets = ["alpha_wolf", "anaconda", "bear", "crocodile", "elephant", "jackal", "komodo_dragon", "lion", "shark", "tiger", "wolf", "wolverine"]

# --- Communication with Server ---

def send_update(action, data):
    payload = {
        "userId": user_id,
        "action": action,
        "data": data
    }
    try:
        requests.post(f"{API_URL}/game/update", json=payload, timeout=3)
    except requests.exceptions.RequestException as e:
        print(f"Error communicating with server: {e}", file=sys.stderr, flush=True)
        sys.exit(1)

def save_game_state():
    """Saves the current game state to the database via the server API."""
    payload = {
        "userId": user_id,
        "money": money,
        "stage": stage,
        "inventory": Inventory
    }
    try:
        requests.post(f"{API_URL}/game/save", json=payload, timeout=3)
    except requests.exceptions.RequestException as e:
        print(f"Error saving game state: {e}", file=sys.stderr, flush=True)

# --- Game Logic ---

def get_shop_data():
    """Generates and returns the current state of the shop."""
    return {
        "items": [
            {"id": "pack_common", "name": "Common Pet Pack", "price": 100, "quantity": 5},
            {"id": "pack_rare", "name": "Rare Pet Pack", "price": 500, "quantity": 2},
            {"id": "pack_legendary", "name": "Legendary Pet Pack", "price": 2000, "quantity": 1}
        ]
    }

def buy_item(item_id):
    """Handles the logic for a user buying an item from the shop."""
    global money
    shop_data = get_shop_data()
    item = next((x for x in shop_data['items'] if x['id'] == item_id), None)

    if not item:
        send_update('shop_error', {"message": "Item not found!"})
        return

    if money >= item['price']:
        money -= item['price']
        # --- Lootbox Reveal Logic ---
        if item_id == 'pack_common':
            new_pet = random.choice(common_pets)
        elif item_id == 'pack_rare':
            new_pet = random.choice(rare_pets)
        else:
            new_pet = random.choice(legendary_pets)
        
        Inventory.append(new_pet)
        
        # Send updates to the client
        send_update('buy_success', {"item_name": item['name'], "cost": item['price']})
        send_update('loot_reveal', {"pet": new_pet, "pack_name": item['name']})
        send_update('inventory_update', {"inventory": Inventory})
        send_update('player_stats_update', {"money": money, "stage": stage})
        save_game_state()
    else:
        send_update('shop_error', {"message": "Not enough money!"})


def send_initial_game_state():
    """Sends all necessary initial data to the client when the game starts."""
    send_update('initial_state', {
        'player_stats': {'money': money, 'stage': stage},
        'inventory': Inventory,
        'shop': get_shop_data()
    })

# --- Main Game Loop ---

def main():
    """The main loop that listens for commands from the client."""
    send_initial_game_state()

    for line in sys.stdin:
        try:
            command = json.loads(line.strip())
            action = command.get('action')
            data = command.get('data', {})

            if action == 'buy_item':
                buy_item(data.get('itemId'))
            elif action == 'get_shop':
                send_update('shop_update', get_shop_data())

        except json.JSONDecodeError:
            print(f"Invalid command from client: {line.strip()}", file=sys.stderr, flush=True)
        except Exception as e:
            print(f"An error occurred processing command: {e}", file=sys.stderr, flush=True)

if __name__ == "__main__":
    if len(sys.argv) > 4:
        user_id = int(sys.argv[1])
        money = int(sys.argv[2])
        stage = int(sys.argv[3])
        Inventory = json.loads(sys.argv[4])
        main()
    else:
        print("FATAL: Not enough game state information provided to start.", file=sys.stderr, flush=True)
        sys.exit(1)
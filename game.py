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
print("Implement this")
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
    print("Implement this")


def buy_item(item_id):
    print("Implement this")


def send_initial_game_state():
    send_update('initial_state', {
        'player_stats': {'money': money, 'stage': stage},
        'inventory': Inventory,
        'shop': get_shop_data()
    })



# --- Main Game Loop ---

def main():
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
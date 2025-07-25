import sys
import os
import requests
import json
import random
import time
from dotenv import load_dotenv
from chars import *

load_dotenv()

port = os.getenv("PORT", "3000")
API_URL = f"http://localhost:{port}/api"

# --- Global Game State ---
user_id = None
money = 50
stage = 1
Inventory_raw = ["Worm"]
Inventory_finish = []
tss = 1.5                               # wartezeit zwischen nachricht und hauptmenu
reroll_shop = 5

# ---Upgrade Pack randomizer-----
def roll_packs(anzahl, chance):
    return sum(1 for _ in range(anzahl) if random.randint(0, chance) == 1)

upgrade_pack = roll_packs(10, 2)                 # durschnittlich 2.5 packs pro shop
legendary_upgrade_pack = roll_packs(5, 20)       # 0.25 also alle 4 shops
charakter_pack = roll_packs(3, 9)               # 0.3 alle 3 shops
buff_pack = roll_packs(10, 2)
# --- Static Data ---
                    
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
        "inventory": Inventory_finish
    }
    try:
        requests.post(f"{API_URL}/game/save", json=payload, timeout=3)
    except requests.exceptions.RequestException as e:
        print(f"Error saving game state: {e}", file=sys.stderr, flush=True)



# --- Game Logic ---
def Inventory_function():
    global Inventory_finish
    Inventory_finish = [f"{pet} (lv.{pet_levels[pet]})" for pet in Inventory_raw if pet in pet_levels]
    user_Request = json.loads(sys.stdin.readline().strip()).get('data', {}).get('petName', '')
    if user_Request in Inventory_raw:
        specifik_pet_stat = (all_pet_stats[user_Request])
        send_update('user_message', {
        'specifik_pet_stat_request': {'specifik_pet_stat': specifik_pet_stat}
        })
        Inventory_function()
    
        

def get_shop_data():
    global user_Request_Round_end, user_Request_Reroll_bought, reroll_shop
    user_Request_Round_end = json.loads(sys.stdin.readline().strip()).get('data', {}).get('endRound', '')       # placeholder
    user_Request_Reroll_bought = json.loads(sys.stdin.readline().strip()).get('data', {}).get('endRound', '')  # plaxceholder
    if user_Request_Round_end == 1:
        reroll_shop = 5
    elif user_Request_Reroll_bought == 1:
        reroll_shop += 1
    else:
        print("", file=sys.stderr, flush=True)         # kp ob das so richtig is
    packs = {
   'upgrade_pack': roll_packs(10, 2),
   'legendary_upgrade_pack': roll_packs(5, 20),
   'charakter_pack': roll_packs(3, 9),
   'buff_pack': roll_packs(10, 2)
    }
    prizes = {
   'upgrade_pack_prize': 3,
   'legendary_upgrade_pack_prize': 10,
   'charakter_pack_prize': 8,
   'buff_pack_prize': 4,
   'Reroll_shop': reroll_shop
    }
    


def buy_item(item_id):
    global money
    user_Request_Pack_bought = json.loads(sys.stdin.readline().strip()).get('data', {}).get('endRound', '')  # placeholder
    if user_Request_Pack_bought == "Upgrade_Pack":
        if upgrade_pack > 0:
            if money > 2:
                money -= 3
                upgrade_pack -= 1
                upgrade = random.choice(Inventory_raw)
                if upgrade in pet_levels:
                    pet_levels[upgrade] += 1
                    
            else:
                reason = "Not enough Money"
                send_update('user_message', {
                'not_buy_reason': reason
                })
        else:
            reason = "not on Stock"
            send_update('user_message', {
            'not_buy_reason': reason
            }) 

def send_initial_game_state():
    send_update('initial_state', {
        'player_stats': {'money': money, 'stage': stage},
        'inventory': Inventory_finish,
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
        pets_with_level = json.loads(sys.argv[4])
        main()
    else:
        print("FATAL: Not enough game state information provided to start.", file=sys.stderr, flush=True)
        sys.exit(1)






#Bugs die ich nicht fixen konnte:
#Z:69 : user_Request = json.loads(sys.stdin.readline().strip()).get('data', {}).get('petName', ''), kein plan von welcher Jason datei die request kommt.
#Z:80 : " 
#
#
#
#
#
#
#
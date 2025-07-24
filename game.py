import time
import random 
import sys
import os
import requests
import json
from dotenv import load_dotenv

load_dotenv() 

port = os.getenv("PORT", "3000")

# --- Global Game State ---
user_id = None
money = 50000
stage = 1
Inventory = ["Worm"]

# --- Pet Definitions (Should be in a separate file eventually) ---
pet_levels = {}
all_pet_stats = {}
common_pets = ["ant", "bee", "beetle", "caterpillar", "cockroach", "earwig", "fly", "grasshopper", "ladybug", "maggot", "mosquito", "moth", "pillbug", "slug", "snale", "spider", "springtail", "tick", "worm"]
rare_pets = ["badger", "cat", "cobra", "eagle", "falcon", "fox", "hamster", "lynx", "mouse", "otter", "owl", "peregrine_falcon", "rat", "raven", "shrew", "snake"]
legendary_pets = ["alpha_wolf", "anaconda", "bear", "crocodile", "elephant", "jackal", "komodo_dragon", "lion", "shark", "tiger", "wolf", "wolverine"]

shop_refresh_price = 5
tss = 1.5

def save_game_state():
    global user_id, money, stage, Inventory
    url = f"http://localhost:{port}/api/game/save"
    payload = {
        "userId": user_id,
        "money": money,
        "stage": stage,
        "inventory": Inventory
    }
    try:
        requests.post(url, json=payload, timeout=5)
        print("--- Game Saved ---", flush=True)
    except requests.exceptions.RequestException as e:
        print(f"--- Error saving game: {e} ---", flush=True)

def roll_packs(anzahl, chance):
    return sum(1 for _ in range(anzahl) if random.randint(0, chance) == 1)

upgrade_pack = roll_packs(10, 2)
legendary_upgrade_pack = roll_packs(5, 20)
charakter_pack = roll_packs(3, 9)
buff_pack = roll_packs(10, 2)
    
def Fight():
    dubble_check = input("You are fighting on stage "+ str(stage)+". Are you sure you want to fight? N/Y")
    if dubble_check.lower() == "y":
        print("yea", flush=True)
        # After a fight, you might want to save the game
        save_game_state()
    else:
        main_menu()

def Inventory_function():
    print("Your Inventory:", flush=True)
    print(", ".join([f"{pet} (Lv.{pet_levels.get(pet, 1)})" for pet in Inventory]), flush=True)
    user_Request = input()
    if user_Request in Inventory:
        # This will crash if all_pet_stats is empty. You need to populate it.
        print(all_pet_stats.get(user_Request, 'No stats available.'), flush=True)
        Inventory_function()
    else:
        main_menu()
    
def shop():
    global money, upgrade_pack, buff_pack, charakter_pack, legendary_upgrade_pack, shop_refresh_price
    # ... (Shop logic remains the same, but we need to call save_game_state after purchases)
    # Example for one purchase:
    if shop_packs == "up":
        if upgrade_pack > 0:
            if money > 2:
                money -= 3
                upgrade_pack -= 1
                # ... upgrade logic ...
                save_game_state() # Save after a successful purchase
                shop()
    # ... rest of the shop logic ...

def main_menu():
    global money
    
    lines = [
        "------------------------------",
        "Your Inventory:",
        ",".join(Inventory),
        "------------------------------",
        f"Money: {money}$",
        f"Stage: {stage}",
        "------------------------------",
        "Main Menu:",
        "I - Inventory",
        "F - Fight",
        "S - Shop",
        "E - Exit and Save"
    ]
    
    for line in lines:
        print(line, flush=True)
        time.sleep(0.02)  
    
    user_Request = input("").lower()
    
    print("------------------------------", flush=True)
    
    if user_Request == "i":
       Inventory_function()
    elif user_Request == "f":
        Fight()
    elif user_Request == "s":
        shop()
    elif user_Request == "e":
        save_game_state()
        exit()
    else:
        main_menu()

if __name__ == "__main__":
    if len(sys.argv) > 4:
        user_id = int(sys.argv[1])
        money = int(sys.argv[2])
        stage = int(sys.argv[3])
        # The inventory is passed as a JSON string, so we need to parse it
        Inventory = json.loads(sys.argv[4])
        
        print(f"--- Welcome back, User {user_id}! Game loaded. ---", flush=True)
        main_menu()
    else:
        print("Error: Not enough game state information provided.", flush=True)
        exit()
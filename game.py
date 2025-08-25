import sys
import os
import requests
import json
import random
import time
from dotenv import load_dotenv
from src.chars import *
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
legendary_pets = legendary_p
rare_pets = rare_p
common_pets = common_p
starter_pets = starter_p
pet_levels = p_levels
all_pet_stats = all_p_stats
# ---Upgrade Pack randomizer-----
def roll_packs(anzahl, chance):
    return sum(1 for _ in range(anzahl) if random.randint(0, chance) == 1)

upgrade_pack = roll_packs(10, 2)                 # durschnittlich 2.5 packs pro shop
legendary_upgrade_pack = roll_packs(5, 20)       # 0.25 also alle 4 shops
charakter_pack = roll_packs(3, 9)               # 0.3 alle 3 shops
buff_pack = roll_packs(10, 2)
          
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
        "inventory": Inventory_finish,
        "pet_stats": all_pet_stats,
    }
    try:
        requests.post(f"{API_URL}/game/save", json=payload, timeout=3)
    except requests.exceptions.RequestException as e:
        print(f"Error saving game state: {e}", file=sys.stderr, flush=True)



# --- Game Logic ---
def Inventory_function():
    global Inventory_finish
    Inventory_finish = [f"{pet} (lv.{pet_levels[pet]})" for pet in Inventory_raw if pet in pet_levels]
    user_Request = json.loads(sys.stdin.readline().strip()).get('data', {}).get('petName', '')            #placeholder
    if user_Request in Inventory_raw:
        specifik_pet_stat = (all_pet_stats[user_Request])
        send_update('user_message', {
        'specifik_pet_stat_request': {'specifik_pet_stat': specifik_pet_stat}
        })
    

def get_shop_data():
    global user_Request_Round_end, user_Request_Reroll_bought, reroll_shop
    user_Request_Round_end = json.loads(sys.stdin.readline().strip()).get('data', {}).get('endRound', '')       # placeholder
    user_Request_Reroll_bought = json.loads(sys.stdin.readline().strip()).get('data', {}).get('endRound', '')  # plaxceholder
    if user_Request_Round_end == 1:
        reroll_shop = 5
    elif user_Request_Reroll_bought == 1:
        reroll_shop += 1
    else:
        print("", file=sys.stderr, flush=True)         # kp ob das so richtig is # ne is es nicht :) # XD XD XD
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
    global money, upgrade_pack, Inventory_raw, pet_levels, Inventory_finish, legendary_upgrade_pack, upgrade, common_pets, rare_pets, legendary_pets, charakter_pack, buff_pack, all_pet_stats
    user_Request_Pack_bought = json.loads(sys.stdin.readline().strip()).get('data', {}).get('endRound', '')  # placeholder
    if user_Request_Pack_bought == "Upgrade_Pack":
        if upgrade_pack > 0:
            if money > 2:
                money -= 3
                upgrade_pack -= 1
                upgrade = random.choice(Inventory_raw)
                if upgrade in pet_levels and upgrade in all_pet_stats:
                    pet_levels[upgrade] += 1
                    all_pet_stats[upgrade]["attack"] += all_pet_stats[upgrade]["rarity"] 
                    all_pet_stats[upgrade]["hp"] += all_pet_stats[upgrade]["rarity"]
                    
            else:
                reason = "Not enough Money"
                send_update('user_message', {
                'not_buy_reason': reason
                })
        else:
            reason = "Not on Stock"
            send_update('user_message', {
            'not_buy_reason': reason
            }) 
    elif user_Request_Pack_bought == "Legendary_Upgrade_Pack":
        if legendary_upgrade_pack > 0:
            if money > 9:
                money -= 10
                legendary_upgrade_pack -= 1
                upgrade = random.choice(Inventory_raw)
                if upgrade in pet_levels and upgrade in all_pet_stats:
                    pet_levels[upgrade] += 5
                    all_pet_stats[upgrade]["attack"] += all_pet_stats[upgrade]["rarity"] * 5 
                    all_pet_stats[upgrade]["hp"] += all_pet_stats[upgrade]["rarity"] * 5
                    
            else:
                reason = "Not enough Money"
                send_update('user_message', {
                'not_buy_reason': reason
                })
        else:
            reason = "Not on Stock"
            send_update('user_message', {
            'not_buy_reason': reason
            }) 
    elif user_Request_Pack_bought == "Charakter_Pack":
        if charakter_pack > 0:
            if money > 7:
                money -= 8
                charakter_pack -= 1
                chance = random.randint(1, 100)

                if chance <= 5:  # 5% Legendary
                    if legendary_pets:
                        pet = random.choice(legendary_pets)
                        Inventory_raw.append(pet)
                        legendary_pets.remove(pet)
                        message = f"You have got a legendary {pet}."
                        send_update('user_message', {
                        'message': message
                        })  
                        print(f"You have got a legendary {pet}.")
                        
                elif chance <= 25:  # 20% Rare 
                    if rare_pets:
                        pet = random.choice(rare_pets)
                        Inventory_raw.append(pet)
                        rare_pets.remove(pet)
                        message = f"You have got a rare {pet}."
                        send_update('user_message', {
                        'message': message
                        })

                        
                        
                else:  # 75% Common 
                    if common_pets:
                        pet = random.choice(common_pets)
                        Inventory_raw.append(pet)
                        common_pets.remove(pet)
                        message = f"You have got a common {pet}."
                        send_update('user_message', {
                        'message': message
                        }) 
                    else:
                        reason = "No Common Pets available"
                        send_update('user_message', {
                        'not_buy_reason': reason
                        }) 
                
                
                    
            else:
                reason = "Not enough Money"
                send_update('user_message', {
                'not_buy_reason': reason
                })
        else:
            reason = "Not on Stock"
            send_update('user_message', {
            'not_buy_reason': reason
            }) 

    elif user_Request_Pack_bought == "buff_pack":
        if buff_pack > 0:
            if money > 3:
                money -= 4
                buff_pack -= 1
                available_buffs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
                selected_buffs = random.sample(available_buffs, 3)
                buff_descriptions = {
                1: "+1 Attack for all Pets in Inventory",
                2: "+1 HP for all Pets in Inventory", 
                3: "+2% Dodge Chance for all Pets in Inventory",
                4: "+2 Attack for all Common Pets in Inventory",
                5: "+2 HP for all Common Pets in Inventory",
                6: "+3 Attack for all rare Pets in Inventory",
                7: "+3 hp for all rare Pets in Inventory",
                8: "+5 Attack for all Legandary Pets in Inventory",
                9: "+5 hp for all Legandary Pets in Inventory",
                10: "1 money for every Pet in Inventory",
                11: "+2 Money for every common and -1 for each rare in Inventory",
                12: "dubble the money you have",
                13: "+1 Level for all Pets in Inventory",


            }
            

            send_update('Buff_Selection', {
                'Buff_1': buff_descriptions[selected_buffs[0]],
                'Buff_2': buff_descriptions[selected_buffs[1]],
                'Buff_3': buff_descriptions[selected_buffs[2]]

                })
            user_Request_selected_Buff = json.loads(sys.stdin.readline().strip()).get('data', {}).get('endRound', '')  # placeholder
            while True:
                choice = user_Request_selected_Buff
                if choice in ["1", "2", "3"]:
                    chosen_buff = selected_buffs[int(choice) - 1]
                    break
                
                    
            
            
            if chosen_buff == 1:
                #("You have chosen: +1 Attack for all Pets")
                for pet in Inventory_raw:
                    all_pet_stats[pet]["attack"] += 1
            elif chosen_buff == 2:
                #("You have chosen: +1 HP for all Pets")
                for pet in Inventory_raw:
                    all_pet_stats[pet]["hp"] += 1
            elif chosen_buff == 3:
                #("You have chosen: +2% Dodge Chance for all Pets")
                for pet in Inventory_raw:
                    all_pet_stats[pet]["dodge_chance"] += 2
            elif chosen_buff == 4:
                #("You have chosen: +2 Attack for all Common Pets")
                for pet in Inventory_raw:
                    if pet in common_pets:
                        all_pet_stats[pet]["attack"] += 2
            elif chosen_buff == 5:
                #("You have chosen: +2 HP for all Common Pets")
                for pet in Inventory_raw:
                    if pet in common_pets:
                        all_pet_stats[pet]["hp"] += 2
            elif chosen_buff == 6:
                #("You have chosen: +3 Attack for all Rare Pets")
                for pet in Inventory_raw:
                    if pet in rare_pets:
                        all_pet_stats[pet]["attack"] += 3
            elif chosen_buff == 7:
                #("You have chosen: +3 HP for all Rare Pets")
                for pet in Inventory_raw:
                    if pet in rare_pets:
                        all_pet_stats[pet]["hp"] += 3
            elif chosen_buff == 8:
                #("You have chosen: +5 Attack for all Legendary Pets")
                for pet in Inventory_raw:
                    if pet in legendary_pets:
                        all_pet_stats[pet]["attack"] += 5
            elif chosen_buff == 9:
                #("You have chosen: +5 HP for all Legendary Pets")
                for pet in Inventory_raw:
                    if pet in legendary_pets:
                        all_pet_stats[pet]["hp"] += 5
            elif chosen_buff == 10:
                #("You have chosen: +1 Money for every Pet in Inventory")
                money_1 = len(Inventory_raw)
        
                money += money_1
            elif chosen_buff == 11:
                #("You have chosen: +2 Money for every Common Pet and -1 for each Rare Pet in Inventory")
                for pet in Inventory_raw:
                    if all_pet_stats[pet]["rarity"] ==  1:  
                        money_2 += 2    
                    elif all_pet_stats[pet]["rarity"] == 2:  
                        money_2 -= 1 
                    else:
                        money_2 += 0
                 
                money += money_2
            elif chosen_buff == 12:
                #("You have chosen: Dubble the Money you have (Max. 25)")
                if money * 2 <= 25:
                    money *= 2
                    
                else:
                    
                    money += 25
            elif chosen_buff == 13:
                #("You have chosen: +1 Level for all Pets in Inventory")
                for pet in Inventory_raw:
                    if pet in pet_levels:
                        pet_levels[pet] += 1
                        all_pet_stats[pet]["attack"] += all_pet_stats[pet]["rarity"]
                        all_pet_stats[pet]["hp"] += all_pet_stats[pet]["rarity"]

                
                
                
                    
            else:
                reason = "Not enough Money"
                send_update('user_message', {
                'not_buy_reason': reason
                })
        else:
            reason = "Not on Stock"
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
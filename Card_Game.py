import time
import random 
import sys
import os
import math
from Charaters_Card_Game import *


shop_refresh_price = 5
tss = 1.5                               # wartezeit zwischen nachricht und hauptmenu
money = 50000
stage = 1
Inventory = ["Worm"]
s_rarity = 1
def roll_packs(anzahl, chance):
    return sum(1 for _ in range(anzahl) if random.randint(0, chance) == 1)

upgrade_pack = roll_packs(10, 2)                 # durschnittlich 2.5 packs pro shop
legendary_upgrade_pack = roll_packs(5, 20)       # 0.25 also alle 4 shops
charakter_pack = roll_packs(3, 9)               # 0.3 alle 3 shops
buff_pack = roll_packs(10, 2)                      # 2.5 packs pro shop
    

def Fight():
    dubble_check = input("You are fighting on stage "+ str(stage)+". Are you sure you want to fight? N/Y ").strip().lower()
    if dubble_check == "y":
        print("Fighting is not implemented yet.")
        time.sleep(tss)

def Inventory_function():
    global money
    print("Your Inventory:")
    print(", ".join([f"{pet} (Lv.{pet_levels.get(pet, 1)})" for pet in Inventory]))
    print("Do you want to sell any Pet? Type: 'sell Petname' or just 'Petname' to see stats")
    user_Request = input().strip()

    if user_Request.startswith("sell "):
        pet_to_sell = user_Request[5:].strip()
        if pet_to_sell not in Inventory:
            print(f"You don't own {pet_to_sell}.")
            time.sleep(tss)
            return
        sell_price = all_pet_stats[pet_to_sell]["rarity"] * 2
        sell_price += pet_levels.get(pet_to_sell, 1)
        confirm = input(f"Are you sure you want to sell {pet_to_sell} for {sell_price}$? (Y/N): ").lower()
        if confirm == 'y':
            Inventory.remove(pet_to_sell)
            s_rarity = all_pet_stats[pet_to_sell]["rarity"]
            money += sell_price
            if s_rarity == 3:
                legendary_pets.append(pet_to_sell)
            elif s_rarity == 2:
                rare_pets.append(pet_to_sell)
            elif s_rarity == 1:
                common_pets.append(pet_to_sell)
            if pet_to_sell in pet_levels:
                pet_levels[pet_to_sell] = 1
            print(f"You have sold {pet_to_sell} for {sell_price}$.")
        else:
            print("Sale cancelled.")
        time.sleep(tss)

    elif user_Request in Inventory:
        print(all_pet_stats[user_Request])
        input()

def upgrade_random_pet(levels):
    upgrade = random.choice(Inventory)
    pet_levels[upgrade] += levels
    all_pet_stats[upgrade]["attack"] += all_pet_stats[upgrade]["rarity"] * levels
    all_pet_stats[upgrade]["hp"] += all_pet_stats[upgrade]["rarity"] * levels
    print(f"you have upgraded {upgrade} to Level {pet_levels[upgrade]}")

def open_charakter_pack():
    c_r_l = random.randint(0,100)
    if c_r_l > 90 and rare_pets:
        pool, rarity_name = rare_pets, "rare"
    elif c_r_l < 5 and legendary_pets:
        pool, rarity_name = legendary_pets, "legendary"
    elif common_pets:
        pool, rarity_name = common_pets, "common"
    else:
        print("You already own all common Pets")
        return
    r_p = random.choice(pool)
    Inventory.append(r_p)
    pool.remove(r_p)
    print(f"You have got a {rarity_name} {r_p}.")

def open_buff_pack():
    global money
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
        12: "dubble the money you have (Max. +25)",
        13: "+1 Level for all Pets in Inventory",
    }

    print("-------------------------------")
    print("Choose one of these buffs:")
    print(f"1) {buff_descriptions[selected_buffs[0]]}")
    print(f"2) {buff_descriptions[selected_buffs[1]]}")
    print(f"3) {buff_descriptions[selected_buffs[2]]}")

    while True:
        choice = input("Enter 1, 2, or 3: ")
        if choice in ["1", "2", "3"]:
            chosen_buff = selected_buffs[int(choice) - 1]
            break
        else:
            print("Invalid choice! Enter 1, 2, or 3.")

    def rarity(pet):
        return all_pet_stats[pet]["rarity"]

    print(f"You have chosen: {buff_descriptions[chosen_buff]}")
    if chosen_buff == 1:
        for pet in Inventory:
            all_pet_stats[pet]["attack"] += 1
    elif chosen_buff == 2:
        for pet in Inventory:
            all_pet_stats[pet]["hp"] += 1
    elif chosen_buff == 3:
        for pet in Inventory:
            all_pet_stats[pet]["dodge_chance"] += 2
    elif chosen_buff == 4:
        for pet in Inventory:
            if rarity(pet) == 1:
                all_pet_stats[pet]["attack"] += 2
    elif chosen_buff == 5:
        for pet in Inventory:
            if rarity(pet) == 1:
                all_pet_stats[pet]["hp"] += 2
    elif chosen_buff == 6:
        for pet in Inventory:
            if rarity(pet) == 2:
                all_pet_stats[pet]["attack"] += 3
    elif chosen_buff == 7:
        for pet in Inventory:
            if rarity(pet) == 2:
                all_pet_stats[pet]["hp"] += 3
    elif chosen_buff == 8:
        for pet in Inventory:
            if rarity(pet) == 3:
                all_pet_stats[pet]["attack"] += 5
    elif chosen_buff == 9:
        for pet in Inventory:
            if rarity(pet) == 3:
                all_pet_stats[pet]["hp"] += 5
    elif chosen_buff == 10:
        money_1 = len(Inventory)
        print(f"You have got {money_1} Money")
        money += money_1
    elif chosen_buff == 11:
        money_2 = 0
        for pet in Inventory:
            if rarity(pet) == 1:
                money_2 += 2
            elif rarity(pet) == 2:
                money_2 -= 1
        print(f"You have got {money_2} Money")
        money += money_2
    elif chosen_buff == 12:
        bonus = min(money, 25)
        money += bonus
        print(f"You have got {bonus} Money")
    elif chosen_buff == 13:
        for pet in Inventory:
            pet_levels[pet] += 1
            all_pet_stats[pet]["attack"] += rarity(pet)
            all_pet_stats[pet]["hp"] += rarity(pet)

def buy(stock, price):
    if stock <= 0:
        print("not on Stock")
    elif money < price:
        print("not enough Money")
    else:
        return True
    time.sleep(tss)
    return False

def shop():
    global money, upgrade_pack, buff_pack, charakter_pack, legendary_upgrade_pack, shop_refresh_price
    while True:
        liness = [
        "-------------Shop-------------",
        "Money:"+str(money)+"$",
        "",
        "  "+str(upgrade_pack)+" Upgrade Pack (UP) available                   3$",
        "  "+str(buff_pack)+" Buff Pack (BP) available                      4$",
        "  "+str(charakter_pack)+" Charakter Pack (CP) available                 8$",
        "  "+str(legendary_upgrade_pack)+" Legendary Upgrade Pack (LUP) available        10$",
        " ♾️  Reroll Shop(RS)                               "+str(shop_refresh_price)+"$                         ",
        ]
        for line in liness:
            print(line)
            time.sleep(0.03)
        user_request = input("UP, BP, CP, LUP, R or M (Main Menu)?: ").strip().lower()
        if user_request == "m":
            return
        elif user_request == "up":
            if not Inventory:
                print("You have no Pets to upgrade")
                time.sleep(tss)
            elif buy(upgrade_pack, 3):
                money -= 3
                upgrade_pack -= 1
                upgrade_random_pet(1)
                input()
        elif user_request == "cp":
            if buy(charakter_pack, 8):
                money -= 8
                charakter_pack -= 1
                open_charakter_pack()
                input()
        elif user_request == "lup":
            if not Inventory:
                print("You have no Pets to upgrade")
                time.sleep(tss)
            elif buy(legendary_upgrade_pack, 10):
                money -= 10
                legendary_upgrade_pack -= 1
                upgrade_random_pet(5)
                input()
        elif user_request == "bp":
            if buy(buff_pack, 4):
                money -= 4
                buff_pack -= 1
                open_buff_pack()
                time.sleep(1)
        elif user_request in ("r", "rs"):
            if money >= shop_refresh_price:
                money -= shop_refresh_price
                shop_refresh_price += 1
                upgrade_pack = roll_packs(5, 2)
                legendary_upgrade_pack = roll_packs(5, 20)
                charakter_pack = roll_packs(1, 3)
                buff_pack = roll_packs(5, 2)
            else:
                print("not enough money")
                time.sleep(tss)
        elif user_request == "e":
            exit()


def main_menu():
    while True:
        lines = [
            "------------------------------",
            "Your Inventory:",
            ",".join(Inventory),
            "------------------------------",
            "Money:"+str(money)+"$",
            "------------------------------",
            "Main Menu:",
            "I Inventory",
            "F Fight",
            "S Shop"
        ]

        for line in lines:
            print(line)
            time.sleep(0.02)

        user_Request = input("").strip().lower()

        print("------------------------------")

        if user_Request == "i":
            Inventory_function()
        elif user_Request == "f":
            Fight()
        elif user_Request == "s":
            shop()
        elif user_Request in ("esc", "e"):
            exit()
        else:
            time.sleep(tss)

main_menu()






# Pläne:
# Viele Stufen, die immer schwerer werden
# 3 Leben: Wenn man eine Stufe nicht schafft, kriegt man trotzdem das Geld und -1 Herz
# Wenn alle 3 Leben weg sind, dann Reset. Es soll low key Balatro sein, dass du mit deinen Pets und den Upgradern 0 Pack haushalten sollst
# Re-Roll-Button für Shop
# Super selten: Neuer Charakter direkt im Shop
# GUI bzw. schöneres/übersichtlicheres Design
# Tutorial
# Pets mergen. Heißt: Mehrere Common-Pets mergen zu einem Rare-Pet. Bissl wie bei Roblox, dass die Wahrscheinlichkeit höher wird, wenn mehr Pets gemerged werden.
# Upgrade-System: Legendäres Upgrade-Pack soll 5 Mal ein Pet upgraden. Upgrade-Pack soll nur ein Level leveln. Buff-Pack soll Buffkarten geben. Charakter-Pack soll ein random Common-Pet geben und mit 1/10 Chance Rare und mit 1/100 Chance Legendary.
# Buff-Pack/Fighting-System: Soll ein bisschen wie bei Pokémon sein heißt: Du machst Attacke, KI macht Attacke (Random)
#     !--> Wenn der Player Attacke macht, kann er wählen, welches Pet er für diese Attacke nutzt. Dann kann er zwischen Attacken auswählen. Starter (Wurm) 1 Attacke, Uncommon (Ant) 2 Attacken, Rare (Cat) 3 Attacken, Legendary (Tiger) 4 Attacken,
#           !--> (Attacken können z. B. auch Block sein.) Dann KI greift an (Random). Ab dann: Spieler kann zuerst Buffkarte auswählen (wenn er möchte), dann ob er das Pet wechseln möchte (wenn ja: KI ist direkt dran mit Angreifen). Wenn nicht = Attacke auswählen. Repeat
# Wenn Pet tot, dann für 3 Runden tot. Ab dann wieder einsetzbar.
# Pets übers Inventar verkaufen können.
# Money-Pack: Möglichkeit, Geld zu machen: z. B.: Verdoppelt Geld, gibt doppeltes Geld wie Anzahl der Pets, 2 Dollar für jedes verkaufte Pet, etc.
# Animation für Packs
# Pets passive Fähigkeiten: Z. B. 1 Dollar für Beenden eines Levels, 5 % mehr Schaden für alle Common-Pets etc.
# 30 Pets (vorerst) adden
#shop reset price nach jesder runde wieder auf 5






pet_1, pet_2 = random.sample(all_pets, 2)

print(pet_1, ": Attack:", all_pet_stats[pet_1]["attack"], "HP:", all_pet_stats[pet_1]["hp"], "Class:", all_pet_stats[pet_1]["class"], "Dodge Chance:", all_pet_stats[pet_1]["dodge_chance"], "%")
print(pet_2, ": Attack:", all_pet_stats[pet_2]["attack"], "HP:", all_pet_stats[pet_2]["hp"], "Class:", all_pet_stats[pet_2]["class"], "Dodge Chance:", all_pet_stats[pet_2]["dodge_chance"], "%")
CLASSES = {
    1: "Tank",
    2: "Poisoner",
    3: "Assassin",
    4: "Berserker",
    5: "Aerial",
    6: "Dodger",
    7: "Digger",
}



def modify_two_pets(pets: dict, pet_1, pet_2):
    """Wendet Klassenmodifikationen NUR zwischen pet_1 und pet_2 an."""
    mod_pets = {
        pet_1: pets[pet_1].copy(),
        pet_2: pets[pet_2].copy()
    }

    def apply_rules(attacker, defender):
        classes = mod_pets[attacker]["class"]
        other_classes = mod_pets[defender]["class"]

        def change_attack(pet, percent):
            mod_pets[pet]["attack"] = round(mod_pets[pet]["attack"] * (1 + percent / 100))

        def change_dodge(pet, percent):
            mod_pets[pet]["dodge_chance"] = max(0, min(100, round(mod_pets[pet].get("dodge_chance", 0) * (1 + percent / 100))))

        # Poisoner vs Tank -> Poisoner -30% Attack
        if 2 in classes and 1 in other_classes:
            change_attack(attacker, -30)

        # Berserker vs Tank -> +20% Attack
        if 4 in classes and 1 in other_classes:
            change_attack(attacker, 20)

        # Dodger vs Assassin -> -10% Dodge
        if 6 in classes and 3 in other_classes:
            change_dodge(attacker, -10)

        # Aerial vs Digger -> Aerial +15% Attack
        if 5 in classes and 7 in other_classes:
            change_attack(attacker, 15)

        # Digger vs Tank -> Digger +10% Attack
        if 7 in classes and 1 in other_classes:
            change_attack(attacker, 10)

        # Assassin vs Tank -> -10% Attack
        if 3 in classes and 1 in other_classes:
            change_attack(attacker, -10)

        # dodjer or aerials vs poisner -> -20% Dodje
        if (5 in classes or 6 in classes) and 2 in other_classes:
            change_dodge(attacker, -20)

    # Regeln für beide Richtungen anwenden
    apply_rules(pet_1, pet_2)
    apply_rules(pet_2, pet_1)

    return mod_pets

mod_pets = modify_two_pets(all_pet_stats, pet_1, pet_2)

print(pet_1, ": Attack:", mod_pets[pet_1]["attack"], "HP:", mod_pets[pet_1]["hp"], "Class:", mod_pets[pet_1]["class"], "Dodge Chance:", mod_pets[pet_1]["dodge_chance"], "%")
print(pet_2, ": Attack:", mod_pets[pet_2]["attack"], "HP:", mod_pets[pet_2]["hp"], "Class:", mod_pets[pet_2]["class"], "Dodge Chance:", mod_pets[pet_2]["dodge_chance"], "%")





#class Pet:
#1 = Tank
#2 = Poisoner
#3 = Assassin
#4 = Berserker
#5 = Aerial
#6 = Dodger
#7 = Digger



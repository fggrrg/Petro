document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selectors ---
    const authContainer = document.getElementById('authContainer');
    const gameContainer = document.getElementById('gameContainer');
    const pinInput = document.getElementById('pinInput');
    const authError = document.getElementById('authError');

    // --- Views & Navigation ---
    const views = {
        shop: document.getElementById('shopView'),
        inventory: document.getElementById('inventoryView'),
        fight: document.getElementById('fightView')
    };
    const navButtons = {
        shop: document.getElementById('navShop'),
        inventory: document.getElementById('navInventory'),
        fight: document.getElementById('navFight')
    };

    // --- Game State Display ---
    const moneyDisplay = document.getElementById('money');
    const stageDisplay = document.getElementById('stage');
    const shopItemsContainer = document.getElementById('shopItems');
    const inventoryItemsContainer = document.getElementById('inventoryItems');
    const shopError = document.getElementById('shopError');

    // --- Modal ---
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalText = document.getElementById('modalText');
    const modalClose = document.getElementById('modalClose');

    let ws;

    // --- Event Listeners ---
    document.getElementById('loginButton').addEventListener('click', login);
    document.getElementById('registerButton').addEventListener('click', register);
    document.getElementById('showRegister').addEventListener('click', () => toggleAuthForms(false));
    document.getElementById('showLogin').addEventListener('click', () => toggleAuthForms(true));
    modalClose.addEventListener('click', () => modal.classList.add('hidden'));

    Object.keys(navButtons).forEach(key => {
        navButtons[key].addEventListener('click', () => showView(key));
    });

    // --- Authentication ---
    function toggleAuthForms(showLogin) {
        document.getElementById('loginForm').classList.toggle('hidden', !showLogin);
        document.getElementById('registerForm').classList.toggle('hidden', showLogin);
        authError.textContent = '';
    }

    async function register() {
        try {
            const response = await fetch('/api/register', { method: 'POST' });
            const data = await response.json();
            if (response.ok) {
                document.getElementById('newPin').textContent = data.pin;
                document.getElementById('newPinSection').classList.remove('hidden');
            } else {
                authError.textContent = data.error || 'Registration failed.';
            }
        } catch (error) {
            authError.textContent = 'An error occurred during registration.';
        }
    }

    async function login() {
        const pin = pinInput.value.trim();
        if (!pin) {
            authError.textContent = 'Please enter your PIN.';
            return;
        }
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin })
            });
            if (response.ok) {
                console.log('Login successful. Preparing to connect WebSocket.');
                authContainer.classList.add('hidden');
                gameContainer.classList.remove('hidden');
                setTimeout(initializeWebSocket, 100);
            } else {
                const data = await response.json();
                authError.textContent = data.error || 'Login failed.';
            }
        } catch (error) {
            authError.textContent = 'An error occurred during login.';
        }
    }

    // --- WebSocket Communication ---
    function initializeWebSocket() {
        console.log('Initializing WebSocket connection...');
        ws = new WebSocket(`ws://${window.location.host}`);

        ws.onopen = (event) => {
            console.log('WebSocket connection opened:', event);
        };

        ws.onmessage = handleServerMessage;

        ws.onclose = (event) => {
            console.log('WebSocket connection closed:', event);
            showModal('Connection Lost', `Code: ${event.code}. Reason: ${event.reason || 'No reason given.'}`);
        };

        ws.onerror = (event) => {
            console.error('WebSocket error:', event);
            showModal('Connection Error', 'An error occurred. Check the console for details.');
        };
    }

    function sendCommand(action, data = {}) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action, data }));
        }
    }

    function handleServerMessage(event) {
        try {
            const { action, data } = JSON.parse(event.data);
            switch (action) {
                case 'initial_state':
                    updatePlayerStats(data.player_stats);
                    updateInventory(data.inventory);
                    updateShop(data.shop);
                    showView('inventory');
                    break;
                case 'player_stats_update':
                    updatePlayerStats(data);
                    break;
                case 'inventory_update':
                    updateInventory(data);
                    break;
                case 'shop_update':
                    updateShop(data);
                    break;
                case 'loot_reveal':
                    showModal(`You got a ${data.pet}!`, `From your ${data.pack_name}.`);
                    break;
                case 'shop_error':
                    shopError.textContent = data.message;
                    setTimeout(() => shopError.textContent = '', 3000);
                    break;
            }
        } catch (error) {
            console.error('Error processing message from server:', error);
        }
    }

    // --- UI Update Functions ---
    function showView(viewKey) {
        Object.keys(views).forEach(key => {
            views[key].classList.toggle('hidden', key !== viewKey);
        });
    }

    function updatePlayerStats(stats) {
        moneyDisplay.textContent = stats.money;
        stageDisplay.textContent = stats.stage;
    }

    function updateInventory(inventoryData) {
        inventoryItemsContainer.innerHTML = '';
        const inventory = Array.isArray(inventoryData) ? inventoryData : inventoryData.inventory;
        inventory.forEach(pet => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'item';
            itemDiv.textContent = pet;
            inventoryItemsContainer.appendChild(itemDiv);
        });
    }

    function updateShop(shopData) {
        shopItemsContainer.innerHTML = '';
        shopData.items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'item shop-item';
            itemDiv.innerHTML = `
                <h4>${item.name}</h4>
                <p>Price: ${item.price}</p>
                <p>Quantity: ${item.quantity}</p>
            `;
            itemDiv.addEventListener('click', () => {
                shopError.textContent = '';
                sendCommand('buy_item', { itemId: item.id });
            });
            shopItemsContainer.appendChild(itemDiv);
        });
    }

    function showModal(title, text) {
        console.log(`Showing modal with Title: "${title}", Text: "${text}"`);
        modalTitle.textContent = title;
        modalText.textContent = text;
        modal.classList.remove('hidden');
        modalClose.onclick = () => modal.classList.add('hidden');
    }

    // --- Initial Setup ---
    createStars();
});

function createStars() {
    const starsContainer = document.getElementById('stars');
    if (!starsContainer) return;
    const numStars = 50;
    for (let i = 0; i < numStars; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        starsContainer.appendChild(star);
    }
}
//WEBSOCKET

const ws = new WebSocket(`ws://${window.location.host}`);

ws.onopen = () => {
    console.log('Connected to websocket server');
};

ws.onmessage = (event) => {
    console.log(`Received from server: ${event.data}`);
};

ws.onclose = () => {
    console.log('Disconnected from websocket server');
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};

//Static



// Navigation zwischen den Seiten
function showMainMenu() {
    document.getElementById('mainMenu').classList.remove('hidden');
    document.getElementById('shop').classList.add('hidden');
    document.getElementById('inventory').classList.add('hidden');
}

function showShop() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('shop').classList.remove('hidden');
    document.getElementById('inventory').classList.add('hidden');
}

function showInventory() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('shop').classList.add('hidden');
    document.getElementById('inventory').classList.remove('hidden');
}

// Initialisierung
createStars();
showMainMenu();
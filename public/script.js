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

// Erstelle animierte Sterne im Hintergrund
function createStars() {
    const starsContainer = document.getElementById('stars');
    const numStars = 50;
    
    for (let i = 0; i < numStars; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        star.style.width = Math.random() * 3 + 1 + 'px';
        star.style.height = star.style.width;
        star.style.animationDelay = Math.random() * 3 + 's';
        starsContainer.appendChild(star);
    }
}

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
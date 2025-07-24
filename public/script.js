document.addEventListener('DOMContentLoaded', () => {
    const authContainer = document.getElementById('authContainer');
    const gameContainer = document.getElementById('gameContainer');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const loginButton = document.getElementById('loginButton');
    const registerButton = document.getElementById('registerButton');
    const pinInput = document.getElementById('pinInput');
    const newPinSection = document.getElementById('newPinSection');
    const newPin = document.getElementById('newPin');
    const authError = document.getElementById('authError');
    const gameOutput = document.getElementById('game-output');

    // --- Auth Flow ---

    showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        authError.textContent = '';
    });

    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        authError.textContent = '';
    });

    registerButton.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/register', { method: 'POST' });
            const data = await response.json();
            if (response.ok) {
                newPin.textContent = data.pin;
                newPinSection.classList.remove('hidden');
            } else {
                authError.textContent = data.error || 'Registration failed.';
            }
        } catch (error) {
            authError.textContent = 'An error occurred during registration.';
        }
    });

    loginButton.addEventListener('click', async () => {
        const pin = pinInput.value.trim().toUpperCase();
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
                authContainer.classList.add('hidden');
                gameContainer.classList.remove('hidden');
                initializeWebSocket();
            } else {
                const data = await response.json();
                authError.textContent = data.error || 'Login failed.';
            }
        } catch (error) {
            authError.textContent = 'An error occurred during login.';
        }
    });

    // --- WebSocket Communication ---
    let ws;

    function initializeWebSocket() {
        ws = new WebSocket(`ws://${window.location.host}`);

        ws.onopen = () => {
            console.log('Connected to websocket server');
        };

        ws.onmessage = (event) => {
            const message = event.data;
            console.log(`Received from server: ${message}`);
            // Display the game output from python
            const line = document.createElement('div');
            line.textContent = message;
            gameOutput.appendChild(line);
            gameOutput.scrollTop = gameOutput.scrollHeight; // Auto-scroll
        };

        ws.onclose = () => {
            console.log('Disconnected from websocket server');
            gameOutput.innerHTML += '<div class="error-message">Connection lost. Please refresh the page.</div>';
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            gameOutput.innerHTML += '<div class="error-message">A connection error occurred.</div>';
        };
    }

    // --- Game Interaction (Example) ---
    // You will need to add listeners to your game buttons to send commands to the python script
    // For example:
    // const shopButton = document.getElementById('shopButton');
    // shopButton.addEventListener('click', () => {
    //     if (ws && ws.readyState === WebSocket.OPEN) {
    //         ws.send('S'); // Send the 'Shop' command
    //     }
    // });

    // --- Static UI Functions ---
    createStars();
});

function createStars() {
    const starsContainer = document.getElementById('stars');
    if (!starsContainer) return;
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
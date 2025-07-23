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

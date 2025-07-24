//Dependencies
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { spawn } = require('child_process');
const webSocket = require('ws');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const db = require('./src/db');

//Config
dotenv.config();
db.initializeDatabase();




//Init
const app = express();
const port = process.env.PORT || 3000;
const clients = new Map();





//Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cookieParser());




//API

// User Registration
app.post('/api/register', (req, res) => {
    let pin;
    let userExists = true;
    while (userExists) {
        pin = Math.random().toString(36).substring(2, 8).toUpperCase();
        userExists = db.findUserByPin(pin);
    }
    db.createUser(pin);
    res.status(201).json({ pin });
});

// User Login
app.post('/api/login', (req, res) => {
    const { pin } = req.body;
    const user = db.findUserByPin(pin);
    if (!user) {
        return res.status(401).json({ error: 'Invalid PIN' });
    }
    const sessionToken = crypto.randomUUID();
    res.cookie('session_token', sessionToken, { httpOnly: true, secure: true, maxAge: 3600000 }); //1h
    app.set(sessionToken, user.id);
    res.status(200).json({ message: 'Login successful' });
});

// Save Game State
app.post('/api/game/save', (req, res) => {
    const { userId, money, stage, inventory } = req.body;
    if (!userId || money === undefined || stage === undefined || !inventory) {
        return res.status(400).json({ error: 'Missing required game state data.' });
    }
    try {
        db.saveGameState(userId, money, stage, inventory);
        res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error('Error saving game state:', error);
        res.status(500).json({ error: 'Failed to save game state.' });
    }
});







//Main Proccess
const server = app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

const wss = new webSocket.Server({ server });

wss.on('connection', (ws, req) => {
    // Extract session token from cookies
    const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
    }, {});
    const sessionToken = cookies.session_token;
    const userId = app.get(sessionToken);

    if (!userId) {
        console.log('Unauthorized WebSocket connection attempt.');
        ws.close(1008, 'Unauthorized');
        return;
    }

    console.log(`User ${userId} connected via WebSocket.`);

    // Load game state
    const gameState = db.getGameState(userId);

    // Spawn Python process with user ID and game state
    const pythonProcess = spawn('python', [
        './game.py',
        userId,
        gameState.money,
        gameState.stage,
        gameState.inventory
    ]);

    clients.set(userId, { ws, pythonProcess });

    pythonProcess.stdout.on('data', (data) => {
        const message = data.toString();
        console.log(`[User ${userId}] Python Output: ${message}`);
        ws.send(message);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`[User ${userId}] Python Error: ${data.toString()}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`[User ${userId}] Python process exited with code ${code}`);
        if (clients.has(userId)) {
            clients.get(userId).ws.close();
            clients.delete(userId);
        }
    });

    ws.on('message', (message) => {
        const messageString = message.toString();
        console.log(`Received message from user ${userId}: ${messageString}`);
        pythonProcess.stdin.write(messageString + '\n');
    });

    ws.on('close', () => {
        console.log(`User ${userId} disconnected, killing python process...`);
        if (clients.has(userId)) {
            clients.get(userId).pythonProcess.kill();
            clients.delete(userId);
        }
    });
});
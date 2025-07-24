const Database = require('better-sqlite3');
const path = require('path');

// Initialize the database connection.
// The { verbose: console.log } is useful for debugging.
const db = new Database(path.join(__dirname, '../database/main.db'), { verbose: console.log });

// --- Initialization ---
function initializeDatabase() {
    console.log('Initializing database schema...');
    db.exec(`
        PRAGMA foreign_keys = ON; -- Enforce foreign key constraints

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pin TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS game_state (
            user_id INTEGER PRIMARY KEY,
            money INTEGER DEFAULT 50000,
            stage INTEGER DEFAULT 1,
            inventory TEXT DEFAULT '["Worm"]',
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `);
    console.log('Database schema initialized.');
}

// --- User Management ---

function createUser(pin) {
    // Use a transaction to ensure that both the user and their initial game state are created successfully.
    const createUserTransaction = db.transaction((pin) => {
        const insertUser = db.prepare('INSERT INTO users (pin) VALUES (?)');
        const info = insertUser.run(pin);
        const userId = info.lastInsertRowid;

        const insertInitialGameState = db.prepare('INSERT INTO game_state (user_id) VALUES (?)');
        insertInitialGameState.run(userId);
    });

    try {
        createUserTransaction(pin);
    } catch (error) {
        console.error("Error creating user:", error);
        throw error; // Re-throw the error to be handled by the caller
    }
}

function findUserByPin(pin) {
    const stmt = db.prepare('SELECT * FROM users WHERE pin = ?');
    return stmt.get(pin);
}

// --- Game State Management ---
function getGameState(userId) {
    const stmt = db.prepare('SELECT * FROM game_state WHERE user_id = ?');
    return stmt.get(userId);
}

function createInitialGameState(userId) {
    const stmt = db.prepare('INSERT OR IGNORE INTO game_state (user_id) VALUES (?)');
    stmt.run(userId);
}

function saveGameState(userId, money, stage, inventory) {
    const stmt = db.prepare(`
        INSERT INTO game_state (user_id, money, stage, inventory)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            money = excluded.money,
            stage = excluded.stage,
            inventory = excluded.inventory;
    `);
    stmt.run(userId, money, stage, JSON.stringify(inventory));
}

module.exports = {
    initializeDatabase,
    createUser,
    findUserByPin,
    getGameState,
    createInitialGameState, // Export the missing function
    saveGameState
};
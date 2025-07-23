//Dependencies
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { spawn } = require('child_process');
const webSocket = require('ws');

//Config
dotenv.config();

//Init
const app = express();
const port = process.env.PORT || 3000;

//Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

//API
app.post('/api/python', (req, res) => {
  const { message } = req.body;  
  if (!message) {
        return res.status(400).send('Name is required.');
  }
    const pythonProcessData = req.body;
    res.status(200).json({ status: 'success', message: 'Data received'});
});

//Content Process


//Main Proccess
const server = app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

const wss = new webSocket.Server({ server });

wss.on('connection', ws => {
  console.log('user connected');
  const pythonProcess = spawn('python', ['./game.py']);
  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python stdout: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python stderr: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
  });

  ws.on('close', () => {
    console.log('Client disconnected, killing python process...');
    pythonProcess.kill();
  });
});
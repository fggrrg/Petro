//Dependencies
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { spawn } = require('child_process');

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
    if (!req.body.name) {
        return res.status(400).send('Name is required.');
    }
    const pythonProcess = req.body;

    res.status(200).json({ status: 'success', message: 'Data received'});
});

//Main Proccess
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);

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
});
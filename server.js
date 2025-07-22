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

app.get('/api/data', (req, res) => {
    res.json(data);
});

// POST
app.post('/api/data', (req, res) => {
    if (!req.body.name) {
        return res.status(400).send('Name is required.');
    }
    const newItem = {
        id: data.length > 0 ? Math.max(...data.map(d => d.id)) + 1 : 1,
        name: req.body.name
    };
    data.push(newItem);
    res.status(201).json(newItem);
});

// DELETEID
app.delete('/api/data/:id', (req, res) => {
    const index = data.findIndex(d => d.id === parseInt(req.params.id));
    if (index === -1) return res.status(404).send('Item not found.');

    const deletedItem = data.splice(index, 1);
    res.json(deletedItem[0]);
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
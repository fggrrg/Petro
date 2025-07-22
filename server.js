//Dependencies
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

//Config
dotenv.config();

//Init
const app = express();
const port = process.env.PORT || 3000;

//Middleware
app.use(express.static(path.join(__dirname, 'public')));

//Main Proccess
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
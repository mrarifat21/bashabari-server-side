// server.js
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.send('Bashabari backend is running');
});

// Start server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

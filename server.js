const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let lobbies = [];

// Neue Lobby registrieren
app.post('/register', (req, res) => {
  const lobby = req.body;
  console.log('Neue Lobby:', lobby);
  lobbies.push(lobby);
  res.status(200).send('Lobby registriert');
});

// Alle Lobbys abrufen
app.get('/lobbies', (req, res) => {
  res.json(lobbies);
});

app.listen(port, () => {
  console.log(`Lobbyserver läuft auf http://localhost:${port}`);
});
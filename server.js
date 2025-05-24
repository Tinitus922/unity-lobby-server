const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let lobbies = [];

function generateLobbyCode(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Neue Lobby registrieren
app.post('/register', (req, res) => {
    const { name, region, isPrivate } = req.body;

    if (!name || !region) {
        return res.status(400).send('Fehlende Angaben (Name oder Region).');
    }

    const lobbyCode = generateLobbyCode();
    const lobby = {
        name,
        region,
        isPrivate: !!isPrivate,
        code: lobbyCode,
        createdAt: Date.now(),
        lastHeartbeat: Date.now()  // NEU: Heartbeat-Zeit merken
    };

    lobbies.push(lobby);
    console.log('Neue Lobby:', lobby);
    res.status(200).json({ code: lobbyCode });
});

// Heartbeat aktualisieren
app.post('/heartbeat/:code', (req, res) => {
    const lobby = lobbies.find(l => l.code === req.params.code);
    if (!lobby) {
        return res.status(404).send('Lobby nicht gefunden');
    }
    lobby.lastHeartbeat = Date.now();
    res.status(200).send('Heartbeat aktualisiert');
});

// Aktive Lobbys abrufen
app.get('/lobbies', (req, res) => {
    const { region } = req.query;
    const now = Date.now();
    const activeLobbies = lobbies.filter(lobby => now - lobby.lastHeartbeat < 60000); // nur letzte 60 Sekunden aktiv

    if (region) {
        const filtered = activeLobbies.filter(lobby => lobby.region === region);
        return res.json(filtered);
    }

    res.json(activeLobbies);
});

// Einzelne Lobby abrufen
app.get('/lobby/:code', (req, res) => {
    const lobby = lobbies.find(l => l.code === req.params.code);
    if (!lobby) {
        return res.status(404).send('Lobby nicht gefunden');
    }
    res.json(lobby);
});

// Server starten
app.listen(port, () => {
    console.log(`Lobbyserver läuft auf http://localhost:${port}`);
});

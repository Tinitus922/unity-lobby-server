const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let lobbies = [];
let usedCodes = new Set();  // Speicher für alle jemals vergebenen Codes

function generateLobbyCode(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    do {
        code = '';
        for (let i = 0; i < length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (usedCodes.has(code));
    usedCodes.add(code);
    return code;
}

// Cleanup-Funktion: entfernt abgelaufene Lobbys
function cleanUpExpiredLobbies() {
    const now = Date.now();
    const beforeCount = lobbies.length;
    lobbies = lobbies.filter(lobby => now - lobby.lastHeartbeat < 60000);
    const afterCount = lobbies.length;
    if (beforeCount !== afterCount) {
        console.log(`Bereinigt: ${beforeCount - afterCount} abgelaufene Lobby(s) entfernt.`);
    }
}

// Neue Lobby registrieren
app.post('/register', (req, res) => {
    cleanUpExpiredLobbies();

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
        lastHeartbeat: Date.now()
    };

    lobbies.push(lobby);
    console.log('Neue Lobby:', lobby);
    res.status(200).json({ code: lobbyCode });
});

// Rehost einer alten Lobby
app.post('/rehost/:code', (req, res) => {
    cleanUpExpiredLobbies();

    const { name, region, isPrivate } = req.body;
    const code = req.params.code;

    if (!name || !region) {
        return res.status(400).send('Fehlende Angaben (Name oder Region).');
    }

    const existing = lobbies.find(l => l.code === code);
    if (existing) {
        return res.status(400).send('Dieser Code wird bereits von einer anderen aktiven Lobby verwendet.');
    }

    if (!usedCodes.has(code)) {
        return res.status(404).send('Unbekannter Lobby-Code.');
    }

    const lobby = {
        name,
        region,
        isPrivate: !!isPrivate,
        code: code,
        createdAt: Date.now(),
        lastHeartbeat: Date.now()
    };

    lobbies.push(lobby);
    console.log('Lobby rehosted:', lobby);
    res.status(200).json({ code: code });
});

// Heartbeat aktualisieren
app.post('/heartbeat/:code', (req, res) => {
    cleanUpExpiredLobbies();

    const lobby = lobbies.find(l => l.code === req.params.code);
    if (!lobby) {
        return res.status(404).send('Lobby nicht gefunden');
    }
    lobby.lastHeartbeat = Date.now();
    res.status(200).send('Heartbeat aktualisiert');
});

// Aktive Lobbys abrufen
app.get('/lobbies', (req, res) => {
    cleanUpExpiredLobbies();

    const { region } = req.query;
    const now = Date.now();
    const activeLobbies = lobbies.filter(lobby => now - lobby.lastHeartbeat < 60000);

    if (region) {
        const filtered = activeLobbies.filter(lobby => lobby.region === region);
        return res.json(filtered);
    }

    res.json(activeLobbies);
});

// Einzelne Lobby abrufen
app.get('/lobby/:code', (req, res) => {
    cleanUpExpiredLobbies();

    const lobby = lobbies.find(l => l.code === req.params.code);
    if (!lobby) {
        return res.status(404).send('Lobby nicht gefunden');
    }
    res.json(lobby);
});

// Einzelne Lobby löschen
app.delete('/lobby/:code', (req, res) => {
    cleanUpExpiredLobbies();

    const index = lobbies.findIndex(l => l.code === req.params.code);
    if (index !== -1) {
        lobbies.splice(index, 1);
        console.log(`Lobby mit Code ${req.params.code} wurde gelöscht.`);
        res.status(200).send('Lobby gelöscht');
    } else {
        res.status(404).send('Lobby nicht gefunden');
    }
});

// Alle Lobbys löschen (Admin-Reset)
app.delete('/lobbies', (req, res) => {
    const count = lobbies.length;
    lobbies = [];
    console.log(`Alle Lobbys (${count}) wurden gelöscht.`);
    res.status(200).send('Alle Lobbys gelöscht');
});

// Server starten
app.listen(port, () => {
    console.log(`Lobbyserver läuft auf http://localhost:${port}`);
});

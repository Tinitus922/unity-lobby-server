const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let lobbies = [];

function generateLobbyCode(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

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
        createdAt: Date.now()
    };

    lobbies.push(lobby);
    console.log('Neue Lobby:', lobby);
    res.status(200).json({ code: lobbyCode });
});

app.get('/lobbies', (req, res) => {
    const { region } = req.query;

    if (region) {
        const filtered = lobbies.filter(lobby => lobby.region === region);
        return res.json(filtered);
    }

    res.json(lobbies);
});

app.get('/lobby/:code', (req, res) => {
    const lobby = lobbies.find(l => l.code === req.params.code);
    if (!lobby) {
        return res.status(404).send('Lobby nicht gefunden');
    }
    res.json(lobby);
});

app.listen(port, () => {
    console.log(`Lobbyserver läuft auf http://localhost:${port}`);
});

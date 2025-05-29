const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let lobbies = [];
let usedCodes = new Set();

const SUPABASE_URL = 'https://gyctqcslrpsiqpjwvqxj.supabase.co';  // deine Project URL
const SUPABASE_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5Y3RxY3NscnBzaXFwand2cXhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MjU3MjksImV4cCI6MjA2NDEwMTcyOX0.hIuobCZj0FexHKLedMM7a4dS_OfoJ4b0BbLsxKBbBdM';

// 🔹 Codes aus Supabase laden
async function loadUsedCodesFromSupabase() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/usedcodes?select=code`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_API_KEY,
                'Authorization': `Bearer ${SUPABASE_API_KEY}`
            }
        });

        if (!response.ok) {
            console.error('Fehler beim Laden der Codes aus Supabase:', await response.text());
            return;
        }

        const data = await response.json();
        usedCodes = new Set(data.map(entry => entry.code));
        console.log(`Geladene Codes aus Supabase: ${usedCodes.size}`);
    } catch (err) {
        console.error('Fehler beim Laden der usedCodes:', err);
    }
}

// 🔹 Code in Supabase speichern
async function saveCodeToSupabase(code) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/usedcodes`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_API_KEY,
                'Authorization': `Bearer ${SUPABASE_API_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify([{ code }])
        });

        if (!response.ok) {
            console.error('Fehler beim Speichern in Supabase:', await response.text());
        } else {
            console.log('✅ Code erfolgreich in Supabase gespeichert:', code);
        }
    } catch (err) {
        console.error('Fehler beim Speichern des Codes:', err);
    }
}

// 🔹 10-stelligen Lobby-Code generieren
async function generateLobbyCode(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    do {
        code = '';
        for (let i = 0; i < length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (usedCodes.has(code));

    usedCodes.add(code);
    await saveCodeToSupabase(code);  // nur noch Supabase, keine lokale Datei
    return code;
}

// 🔹 Alte Lobbys bereinigen
function cleanUpExpiredLobbies() {
    const now = Date.now();
    const beforeCount = lobbies.length;
    lobbies = lobbies.filter(lobby => now - lobby.lastHeartbeat < 60000);
    const afterCount = lobbies.length;
    if (beforeCount !== afterCount) {
        console.log(`Bereinigt: ${beforeCount - afterCount} abgelaufene Lobby(s) entfernt.`);
    }
}

// 🔹 Neue Lobby registrieren
app.post('/register', async (req, res) => {
    cleanUpExpiredLobbies();

    const { name, region, isPrivate } = req.body;

    if (!name || !region) {
        return res.status(400).send('Fehlende Angaben (Name oder Region).');
    }

    const lobbyCode = await generateLobbyCode();
    const lobby = {
        name,
        region,
        isPrivate: !!isPrivate,
        code: lobbyCode,
        relayJoinCode: null,
        createdAt: Date.now(),
        lastHeartbeat: Date.now()
    };

    lobbies.push(lobby);
    console.log('Neue Lobby registriert:', lobby);
    res.status(200).json({ code: lobbyCode });
});

// 🔹 Relay-Code aktualisieren
app.post('/updateRelayCode/:code', (req, res) => {
    const code = req.params.code;
    const { relayJoinCode } = req.body;

    const lobby = lobbies.find(l => l.code === code);
    if (!lobby) {
        return res.status(404).send('Lobby nicht gefunden');
    }

    if (!relayJoinCode) {
        return res.status(400).send('Fehlender Relay JoinCode.');
    }

    lobby.relayJoinCode = relayJoinCode;
    console.log(`RelayJoinCode für Lobby ${code} aktualisiert: ${relayJoinCode}`);
    res.status(200).send('RelayJoinCode aktualisiert');
});

// 🔹 Rehost einer Lobby
app.post('/rehost/:code', (req, res) => {
    cleanUpExpiredLobbies();

    const { name, region, isPrivate, relayJoinCode } = req.body;
    const code = req.params.code;

    if (!name || !region) {
        return res.status(400).send('Fehlende Angaben (Name oder Region).');
    }

    if (!usedCodes.has(code)) {
        return res.status(404).send('Unbekannter Lobby-Code.');
    }

    const existing = lobbies.find(l => l.code === code);
    if (existing) {
        return res.status(400).send('Dieser Code wird bereits von einer anderen aktiven Lobby verwendet.');
    }

    const lobby = {
        name,
        region,
        isPrivate: !!isPrivate,
        code,
        relayJoinCode: relayJoinCode || null,
        createdAt: Date.now(),
        lastHeartbeat: Date.now()
    };

    lobbies.push(lobby);
    console.log('Lobby rehosted:', lobby);
    res.status(200).json({ code });
});

// 🔹 Heartbeat aktualisieren
app.post('/heartbeat/:code', (req, res) => {
    cleanUpExpiredLobbies();

    const lobby = lobbies.find(l => l.code === req.params.code);
    if (!lobby) {
        return res.status(404).send('Lobby nicht gefunden');
    }
    lobby.lastHeartbeat = Date.now();
    res.status(200).send('Heartbeat aktualisiert');
});

// 🔹 Aktive Lobbys abrufen
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

// 🔹 Einzelne Lobby abrufen
app.get('/lobby/:code', (req, res) => {
    cleanUpExpiredLobbies();

    const lobby = lobbies.find(l => l.code === req.params.code);
    if (!lobby) {
        return res.status(404).send('Lobby nicht gefunden');
    }
    res.json(lobby);
});

// 🔹 Einzelne Lobby löschen
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

// 🔹 Server starten
app.listen(port, async () => {
    await loadUsedCodesFromSupabase();
    console.log(`Lobbyserver läuft auf http://localhost:${port}`);
});

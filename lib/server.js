import express from 'express';
import os from 'os';
import fs from 'fs';
import { createServer } from 'http';
import config from '../config.js';
import {
    createPairingSession,
    getSessionStatus,
    getAllSessions,
    disconnectBotSession,
    reloadBotSession,
    addControlLog,
    getControlLogs,
    getControlMetrics
} from './webPair.js';
import commandHandler from './commandHandler.js';

const app = express();
const server = createServer(app);

// Hosting-aware HTTP configuration. Pterodactyl/Bot-Hosting commonly exposes
// the allocated port through SERVER_PORT, while platforms such as Render use PORT.
const PORT = Number(
    process.env.SERVER_PORT ||
    process.env.PTERODACTYL_SERVER_PORT ||
    process.env.ALLOCATED_PORT ||
    process.env.PORT ||
    config.port ||
    5000
);
const HOST = process.env.HOST || '0.0.0.0';

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for the separate Vercel control panel.
// Set CORS_ORIGINS to a comma-separated list for stricter production control.
const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

function isAllowedOrigin(origin) {
    if (!origin) return true;
    if (configuredOrigins.length > 0) {
        return configuredOrigins.includes(origin);
    }
    return /^https:\/\/([a-z0-9-]+\.)*vercel\.app$/i.test(origin) ||
        /^https?:\/\/localhost(?::\d+)?$/i.test(origin) ||
        /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin);
}

app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (isAllowedOrigin(origin)) {
        if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
        res.setHeader('Access-Control-Max-Age', '86400');
    }

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
});

const packageInfo = {
    name: config.botName || 'KØREXIA-MD',
    version: config.version || '3.0.0',
    description:
        config.description ||
        'High performance multi-device WhatsApp bot',
    author: config.author || 'Nsala'
};

function cleanNumber(value) {
    return String(value || '').replace(/\D/g, '');
}

function serializeError(error) {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    return error.message || error.data?.message || error.error || JSON.stringify(error);
}

function pickSession(number = '') {
    const sessions = getAllSessions();
    const requested = cleanNumber(number);
    if (requested && sessions.get(requested)) return sessions.get(requested);
    const values = [...sessions.values()];
    return values.find(s => s.status === 'connected') || values[0] || null;
}

function sessionSummary(session) {
    if (!session) return { exists: false, status: 'offline' };
    const socket = session.socket;
    return {
        exists: true,
        number: session.number,
        status: session.status,
        pairingCode: session.pairingCode || null,
        connectedAt: session.connectedAt || null,
        createdAt: session.createdAt || null,
        user: socket?.user ? {
            id: socket.user.id || null,
            name: socket.user.name || socket.user.notify || null
        } : null
    };
}

async function getLiveGroups(session) {
    if (!session?.socket || session.status !== 'connected') return [];
    const socket = session.socket;
    let raw = {};
    try {
        raw = await socket.groupFetchAllParticipating();
    } catch (error) {
        addControlLog('error', `Impossible de charger les groupes: ${serializeError(error)}`);
        return [];
    }
    const botUser = socket.user?.id ? String(socket.user.id).split(':')[0] : null;
    return Object.entries(raw || {}).map(([id, group]) => {
        const participants = Array.isArray(group.participants) ? group.participants : [];
        const me = participants.find(p => botUser && String(p.id || '').split(':')[0] === botUser);
        return {
            id,
            subject: group.subject || 'Sans nom',
            owner: group.owner || null,
            creation: group.creation || null,
            size: participants.length,
            announce: Boolean(group.announce),
            restrict: Boolean(group.restrict),
            isAdmin: Boolean(me?.admin === 'admin' || me?.admin === 'superadmin'),
            participants: participants.map(p => ({ id: p.id, admin: p.admin || null }))
        };
    }).sort((a, b) => a.subject.localeCompare(b.subject));
}

/* =========================
   WEB PAIRING PAGE
========================= */

app.get('/', (req, res) => {

    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport"
content="width=device-width,initial-scale=1.0">

<title>${packageInfo.name} • Web Pairing</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    min-height: 100vh;
    background:
        radial-gradient(circle at top, #123c2b, #06130e 45%, #020806);
    color: white;
    font-family: Arial, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.card {
    width: 100%;
    max-width: 430px;
    padding: 30px;
    border-radius: 28px;
    background: rgba(10, 25, 19, .86);
    border: 1px solid rgba(255,255,255,.1);
    box-shadow: 0 25px 80px rgba(0,0,0,.5);
    backdrop-filter: blur(20px);
}

.logo {
    width: 70px;
    height: 70px;
    border-radius: 22px;
    background: #25d366;
    color: #001b0d;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: auto;
    font-size: 32px;
    font-weight: 900;
}

h1 {
    text-align: center;
    margin: 18px 0 5px;
}

.subtitle {
    text-align: center;
    color: #8fa89b;
    font-size: 14px;
    margin-bottom: 28px;
}

label {
    display: block;
    margin-bottom: 8px;
    color: #b9c9c1;
    font-size: 13px;
}

.input {
    width: 100%;
    padding: 15px;
    border-radius: 14px;
    border: 1px solid #294438;
    background: #07150f;
    color: white;
    outline: none;
    font-size: 16px;
}

.input:focus {
    border-color: #25d366;
}

button {
    width: 100%;
    margin-top: 15px;
    padding: 15px;
    border: 0;
    border-radius: 14px;
    background: #25d366;
    color: #001b0d;
    font-weight: 900;
    font-size: 15px;
    cursor: pointer;
}

button:disabled {
    opacity: .5;
}

.code-box {
    display: none;
    margin-top: 25px;
    padding: 20px;
    text-align: center;
    border-radius: 18px;
    background: #061a11;
    border: 1px solid #1d5439;
}

.code {
    font-size: 28px;
    letter-spacing: 4px;
    font-weight: 900;
    color: #25d366;
    margin: 12px 0;
}

.status {
    margin-top: 15px;
    text-align: center;
    color: #91a99c;
    font-size: 13px;
}

.steps {
    margin-top: 25px;
    padding: 15px;
    border-radius: 15px;
    background: rgba(255,255,255,.03);
    color: #91a99c;
    font-size: 13px;
    line-height: 1.7;
}

.footer {
    text-align: center;
    color: #496357;
    font-size: 11px;
    margin-top: 25px;
}

</style>
</head>

<body>

<div class="card">

<div class="logo">K</div>

<h1>KØREXIA-MD</h1>

<div class="subtitle">
WhatsApp Web Pairing
</div>

<label>WhatsApp number</label>

<input
id="number"
class="input"
type="tel"
placeholder="243991234418"
autocomplete="off"
/>

<button id="pairBtn" onclick="startPairing()">
CONNECT WHATSAPP
</button>

<div id="codeBox" class="code-box">

<div>YOUR PAIRING CODE</div>

<div id="code" class="code">--------</div>

<div class="status">
Enter this code in WhatsApp
</div>

</div>

<div id="status" class="status"></div>

<div class="steps">

<b>How to connect</b><br>

1. Enter your WhatsApp number.<br>
2. Tap CONNECT WHATSAPP.<br>
3. Copy the pairing code.<br>
4. Open WhatsApp → Linked devices.<br>
5. Tap Link a device → Link with phone number.<br>
6. Enter the code displayed above.

</div>

<div class="footer">
${packageInfo.name} • v${packageInfo.version}
</div>

</div>

<script>

let currentNumber = '';

async function startPairing() {

    const input = document.getElementById('number');
    const button = document.getElementById('pairBtn');
    const status = document.getElementById('status');
    const codeBox = document.getElementById('codeBox');

    const number = input.value.replace(/\\D/g, '');

    if (!number || number.length < 8 || number.length > 15) {
        status.textContent = '❌ Enter a valid WhatsApp number.';
        return;
    }

    currentNumber = number;

    button.disabled = true;
    status.textContent = '⏳ Starting WhatsApp session...';

    try {

        const response = await fetch('/api/pair', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                number
            })
        });

        const data = await response.json();

        if (!response.ok) {
            const serverError = data?.error?.message || data?.error || data?.message;
            throw new Error(typeof serverError === 'string' ? serverError : 'Pairing failed');
        }

        codeBox.style.display = 'block';

        if (data.pairingCode) {
            document.getElementById('code').textContent =
                data.pairingCode;
        }

        status.textContent =
            '📱 Open WhatsApp and enter the code.';

        pollStatus();

    } catch (error) {

        status.textContent =
            '❌ ' + error.message;

        button.disabled = false;
    }
}

async function pollStatus() {

    if (!currentNumber) return;

    try {

        const response = await fetch(
            '/api/pair/status/' +
            encodeURIComponent(currentNumber)
        );

        const data = await response.json();

        if (data.status === 'connected') {

            document.getElementById('status').textContent =
                '✅ WhatsApp connected! Bot is now online.';

            document.getElementById('pairBtn').textContent =
                'CONNECTED';

            return;
        }

        if (data.pairingCode) {

            document.getElementById('code').textContent =
                data.pairingCode;

            document.getElementById('codeBox').style.display =
                'block';
        }

    } catch (_) {}

    setTimeout(pollStatus, 2000);
}

</script>

</body>
</html>`);

});

/* =========================
   CREATE PAIRING
========================= */

app.post('/api/pair', async (req, res) => {

    try {

        const number = cleanNumber(req.body.number);

        if (!number) {
            return res.status(400).json({
                error: 'WhatsApp number is required'
            });
        }

        if (number.length < 8 || number.length > 15) {
            return res.status(400).json({
                error: 'Invalid WhatsApp number'
            });
        }

        const session =
            await createPairingSession(number);

        res.json({
            success: true,
            number: session.number,
            status: session.status,
            pairingCode: session.pairingCode || null
        });

    } catch (error) {

        console.error(
            '[WEB PAIRING]',
            error
        );

        const message = error?.message || String(error);
        res.status(500).json({
            success: false,
            error: message
        });

    }

});

/* =========================
   LEGACY PAIRING COMPATIBILITY
========================= */

// Keeps older Vercel/front-end builds working while the new API uses
// POST /api/pair. Response shape matches the old client: { code }.
app.get('/pair', async (req, res) => {
    try {
        const number = cleanNumber(req.query.number);

        if (!number) {
            return res.status(400).json({
                error: 'WhatsApp number is required'
            });
        }

        if (number.length < 8 || number.length > 15) {
            return res.status(400).json({
                error: 'Invalid WhatsApp number'
            });
        }

        const session = await createPairingSession(number);

        return res.json({
            success: true,
            number: session.number,
            status: session.status,
            code: session.pairingCode || null,
            pairingCode: session.pairingCode || null
        });
    } catch (error) {
        console.error('[LEGACY WEB PAIRING]', error);
        return res.status(500).json({
            error: error.message || 'Pairing failed'
        });
    }
});

/* =========================
   PAIRING STATUS
========================= */

app.get('/api/pair/status/:number', (req, res) => {

    const number =
        cleanNumber(req.params.number);

    res.json(
        getSessionStatus(number)
    );

});

/* =========================
   ENTERPRISE CONTROL CENTER API
========================= */

app.get('/api/dashboard', async (req, res) => {
    try {
        const session = pickSession(req.query.number);
        const groups = await getLiveGroups(session);
        const metrics = getControlMetrics();
        const memory = process.memoryUsage();
        const cpuCount = Math.max(1, os.cpus().length);
        const load = os.loadavg ? os.loadavg()[0] : 0;
        const cpu = Math.min(100, Math.round((load / cpuCount) * 100));
        const users = new Set();
        for (const group of groups) for (const participant of group.participants || []) users.add(participant.id);
        return res.json({
            success: true,
            bot: packageInfo,
            uptime: Math.floor(process.uptime()),
            cpu,
            memory: { usedMb: Math.round(memory.rss / 1024 / 1024), heapMb: Math.round(memory.heapUsed / 1024 / 1024) },
            session: sessionSummary(session),
            sessions: [...getAllSessions().values()].map(sessionSummary),
            groups: groups.length,
            users: users.size,
            messagesToday: metrics.messagesToday,
            commands: commandHandler.commands.size,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: serializeError(error) });
    }
});

app.get('/api/sessions', (req, res) => {
    res.json({ success: true, sessions: [...getAllSessions().values()].map(sessionSummary) });
});

app.post('/api/session/disconnect', async (req, res) => {
    try {
        const number = cleanNumber(req.body.number);
        if (!number) return res.status(400).json({ success: false, error: 'Numéro WhatsApp requis.' });
        const result = await disconnectBotSession(number);
        addControlLog('success', `Session WhatsApp ${number} déconnectée depuis le Control Center.`);
        res.json({ success: true, ...result });
    } catch (error) {
        addControlLog('error', `Déconnexion échouée: ${serializeError(error)}`);
        res.status(500).json({ success: false, error: serializeError(error) });
    }
});

app.post('/api/session/reload', async (req, res) => {
    try {
        const number = cleanNumber(req.body.number);
        if (!number) return res.status(400).json({ success: false, error: 'Numéro WhatsApp requis.' });
        const result = await reloadBotSession(number);
        addControlLog('info', `Reconnexion demandée pour ${number}.`);
        res.json({ success: true, ...result });
    } catch (error) {
        addControlLog('error', `Rechargement échoué: ${serializeError(error)}`);
        res.status(500).json({ success: false, error: serializeError(error) });
    }
});

app.get('/api/groups', async (req, res) => {
    try {
        const session = pickSession(req.query.number);
        const groups = await getLiveGroups(session);
        res.json({ success: true, connected: Boolean(session?.socket), number: session?.number || null, groups });
    } catch (error) {
        res.status(500).json({ success: false, error: serializeError(error), groups: [] });
    }
});

app.get('/api/security', (req, res) => {
    const readJson = (name) => {
        try {
            const file = `${process.cwd()}/data/${name}`;
            return fs.readFileSync(file, 'utf8') ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
        } catch (_) { return {}; }
    };
    const antitagData = readJson('userGroupData.json');
    const countEnabled = (obj) => obj && typeof obj === 'object' ? Object.keys(obj).filter(k => {
        const v = obj[k];
        return v === true || v === 'on' || v?.enabled === true || v?.status === 'on' || v?.type === 'on';
    }).length : 0;
    res.json({
        success: true,
        protections: [
            { key: 'antilink', name: 'AntiLink', icon: '🔗', configured: countEnabled(readJson('antilink.json')) },
            { key: 'antispam', name: 'AntiSpam', icon: '🛡️', configured: countEnabled(readJson('antispam.json')) },
            { key: 'antibadword', name: 'AntiBadword', icon: '🚫', configured: countEnabled(readJson('antibadword.json')) },
            { key: 'antitag', name: 'AntiTag', icon: '🏷️', configured: countEnabled(antitagData.antitag || {}) }
        ]
    });
});

app.get('/api/commands', (req, res) => {
    const commands = [...commandHandler.commands.entries()].map(([name, cmd]) => ({
        name,
        aliases: cmd.aliases || [],
        category: cmd.category || 'misc',
        description: cmd.description || '',
        status: commandHandler.disabledCommands.has(name) ? 'OFF' : 'ON',
        usage: commandHandler.stats.get(name)?.calls || 0,
        errors: commandHandler.stats.get(name)?.errors || 0
    })).sort((a, b) => a.name.localeCompare(b.name));
    res.json({ success: true, count: commands.length, commands });
});

app.post('/api/commands/:name/toggle', (req, res) => {
    const name = String(req.params.name || '').toLowerCase();
    if (!commandHandler.commands.has(name)) return res.status(404).json({ success: false, error: `Commande inconnue: ${name}` });
    const status = commandHandler.toggleCommand(name);
    addControlLog('info', `Commande .${name} ${status === 'enabled' ? 'activée' : 'désactivée'}.`);
    res.json({ success: true, command: name, status: status === 'enabled' ? 'ON' : 'OFF' });
});

app.get('/api/logs', (req, res) => {
    const limit = Math.min(200, Math.max(10, Number(req.query.limit) || 80));
    res.json({ success: true, logs: getControlLogs(limit) });
});

app.get('/api/diagnostics', (req, res) => {
    res.json({ success: true, commands: commandHandler.getDiagnostics(), sessions: [...getAllSessions().values()].map(sessionSummary) });
});

/* =========================
   HEALTH
========================= */

app.get('/health', (req, res) => {

    const mem = process.memoryUsage();

    res.json({
        status: 'ok',
        uptime: Math.floor(process.uptime()),

        memory: {
            rss:
                `${Math.round(mem.rss / 1024 / 1024)}MB`,

            heapUsed:
                `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,

            heapTotal:
                `${Math.round(mem.heapTotal / 1024 / 1024)}MB`
        },

        version: packageInfo.version,
        bot: packageInfo.name,
        timestamp: new Date().toISOString()
    });

});

export {
    app,
    server,
    PORT,
    HOST
};

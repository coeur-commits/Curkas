import express from 'express';
import { createServer } from 'http';
import config from '../config.js';
import {
    createPairingSession,
    getSessionStatus
} from './webPair.js';

const app = express();
const server = createServer(app);

const PORT = config.port || 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
            throw new Error(data.error || 'Pairing failed');
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

        res.status(500).json({
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
    PORT
};

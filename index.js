import 'dotenv/config';

import fs, { existsSync, mkdirSync, rmSync } from 'fs';
import path, { dirname } from 'path';
import chalk from 'chalk';
import syntaxerror from 'syntax-error';
import { parsePhoneNumber as PhoneNumber } from 'awesome-phonenumber';
import readline from 'readline';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { smsg } from './lib/myfunc.js';
import { compileAll } from './lib/compile.js';
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    fetchLatestBaileysVersion,
    jidDecode,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} from '@whiskeysockets/baileys';
import NodeCache from 'node-cache';
import pino from 'pino';
import config from './config.js';
import store from './lib/lightweight_store.js';
import SaveCreds from './lib/session.js';
import { server, PORT, HOST } from './lib/server.js';
import {
    registerBotStarter,
    updateSession,
    getSessionPath
} from './lib/webPair.js';
import { printLog } from './lib/print.js';
import { writeErrorLog } from './lib/logger.js';
import { handleMessages, handleGroupParticipantUpdate, handleStatus, handleCall } from './lib/messageHandler.js';
import commandHandler from './lib/commandHandler.js';
store.readFromFile();
setInterval(() => store.writeToFile(), config.storeWriteInterval || 10000);
setInterval(() => {
    if (global.gc) {
        global.gc();
        console.log('🧹 Garbage collection completed');
    }
}, 60000);
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024;
    if (used > 400) {
        printLog('warning', 'RAM too high (>400MB), restarting bot...');
        process.exit(1);
    }
}, 30000);
const phoneNumber = config.pairingNumber || config.ownerNumber || "243906905464";
// Auto-create data directory and default files on startup
const DATA_DEFAULTS = {
    'owner.json': [],
    'banned.json': [],
    'premium.json': [],
    'warnings.json': {},
    'notes.json': {},
    'autoAi.json': {},
    'messageCount.json': { isPublic: true, messageCount: {} },
    'userGroupData.json': { users: [], groups: [], antilink: {}, antibadword: {}, warnings: {}, sudo: [], welcome: {}, goodbye: {}, chatbot: {}, autoReaction: false },
    'autoStatus.json': { enabled: false },
    'autoread.json': { enabled: false },
    'autotyping.json': { enabled: false },
    'pmblocker.json': { enabled: false },
    'anticall.json': { enabled: false },
    'stealthMode.json': { enabled: false },
    'autoBio.json': { enabled: false, customBio: null },
    'autoReaction.json': { enabled: false },
    'antidelete.json': { enabled: false },
    'antilink.json': {},
    'antibadword.json': {},
};
fs.mkdirSync('./data', { recursive: true });
for (const [file, def] of Object.entries(DATA_DEFAULTS)) {
    const fp = `./data/${file}`;
    if (!fs.existsSync(fp))
        fs.writeFileSync(fp, JSON.stringify(def, null, 2));
}
let owner = [];
try {
    owner = JSON.parse(fs.readFileSync('./data/owner.json', 'utf-8'));
}
catch {
    owner = [];
}
global.botname = config.botName || "KØREXIA-MD";
global.themeemoji = "•";
const useWebPairing = true;
const useMobile = process.argv.includes("--mobile");
let rl = null;
let rlClosed = false;
if (process.stdin.isTTY && !config.pairingNumber) {
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.on('close', () => { rlClosed = true; });
}
const question = (text) => {
    if (rl && !rlClosed) {
        return new Promise((resolve) => rl.question(text, resolve));
    }
    else {
        return Promise.resolve(config.ownerNumber || phoneNumber);
    }
};
process.on('exit', () => {
    if (rl && !rlClosed)
        rl.close();
});
process.on('SIGINT', () => {
    if (rl && !rlClosed)
        rl.close();
    process.exit(0);
});
server.listen(PORT, HOST, () => {
    printLog('success', `Server listening on ${HOST}:${PORT}`);
});
async function startQasimDev({
    number = null,
    sessionPath = null,
    webSession = null
} = {}) {
    try {

const { version } = await fetchLatestBaileysVersion();        const authPath = sessionPath || (
    number
        ? getSessionPath(number)
        : path.join(__dirname, 'session')
);

if (!fs.existsSync(authPath)) {
    fs.mkdirSync(authPath, { recursive: true });
}

const { state, saveCreds } =
    await useMultiFileAuthState(authPath);
        const _saveCreds = async () => {
                await saveCreds();
        };
        const msgRetryCounterCache = new NodeCache();
        const ghostMode = await store.getSetting('global', 'stealthMode');
        const isGhostActive = ghostMode && ghostMode.enabled;
        const QasimDev = makeWASocket({
            version,
browser: Browsers.windows('Chrome'),
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(
                    state.keys,
                    pino({ level: "fatal" }).child({ level: "fatal" })
                ),
            },
            markOnlineOnConnect: !isGhostActive,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                const jid = jidNormalizedUser(key.remoteJid);
                const msg = await store.loadMessage(jid, key.id);
                return msg?.message || "";
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        });
        QasimDev.store = store;
        const originalSendPresenceUpdate = QasimDev.sendPresenceUpdate;
        const originalReadMessages = QasimDev.readMessages;
        const originalSendReceipt = QasimDev.sendReceipt;
        QasimDev.sendPresenceUpdate = async function (...args) {
            const ghostMode = await store.getSetting('global', 'stealthMode');
            if (ghostMode && ghostMode.enabled) {
                printLog('info', '👻 Blocked presence update (stealth mode)');
                return;
            }
            return originalSendPresenceUpdate.apply(this, args);
        };
        QasimDev.readMessages = async function (...args) {
            const ghostMode = await store.getSetting('global', 'stealthMode');
            if (ghostMode && ghostMode.enabled)
                return;
            return originalReadMessages.apply(this, args);
        };
        if (originalSendReceipt) {
            QasimDev.sendReceipt = async function (...args) {
                const ghostMode = await store.getSetting('global', 'stealthMode');
                if (ghostMode && ghostMode.enabled)
                    return;
                return originalSendReceipt.apply(this, args);
            };
        }
        const originalQuery = QasimDev.query;
        QasimDev.query = async function (node, ...args) {
            const ghostMode = await store.getSetting('global', 'stealthMode');
            if (ghostMode && ghostMode.enabled) {
                if (node && node.tag === 'receipt')
                    return;
                if (node && node.attrs && (node.attrs.type === 'read' || node.attrs.type === 'read-self'))
                    return;
            }
            return originalQuery.apply(this, [node, ...args]);
        };
        QasimDev.isGhostMode = async () => {
            const ghostMode = await store.getSetting('global', 'stealthMode');
            return ghostMode && ghostMode.enabled;
        };
        QasimDev.ev.on('creds.update', _saveCreds);
        store.bind(QasimDev.ev);
        QasimDev.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                const mek = chatUpdate.messages[0];
                if (!mek.message)
                    return;
                mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage')
                    ? mek.message.ephemeralMessage.message
                    : mek.message;
                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    await handleStatus(QasimDev, chatUpdate);
                    return;
                }
                if (!QasimDev.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                    const isGroup = mek.key?.remoteJid?.endsWith('@g.us');
                    if (!isGroup)
                        return;
                }
                if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16)
                    return;
                if (QasimDev?.msgRetryCounterCache) {
                    QasimDev.msgRetryCounterCache.clear();
                }
                try {
                    await handleMessages(QasimDev, chatUpdate);
                }
                catch (err) {
                    printLog('error', `Error in handleMessages: ${err.message}`);
                    if (mek.key && mek.key.remoteJid) {
                        await QasimDev.sendMessage(mek.key.remoteJid, {
                            text: '❌ An error occurred while processing your message.',
                            contextInfo: {
                                forwardingScore: 1,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: '120363406589060879@newsletter',
                                    newsletterName: 'infokillua',
                                    serverMessageId: -1
                                }
                            }
                        }).catch(console.error);
                    }
                }
            }
            catch (err) {
                printLog('error', `Error in messages.upsert: ${err.message}`);
            }
        });
        QasimDev.decodeJid = (jid) => {
            if (!jid)
                return jid;
            if (/:\d+@/gi.test(jid)) {
                const decode = jidDecode(jid) || {};
                return decode.user && decode.server && `${decode.user }@${ decode.server}` || jid;
            }
            else
                return jid;
        };
        QasimDev.ev.on('contacts.update', (update) => {
            for (const contact of update) {
                const id = QasimDev.decodeJid(contact.id);
                if (store && store.contacts)
                    store.contacts[id] = { id, name: contact.notify };
            }
        });
        QasimDev.getName = (jid, withoutContact = false) => {
            const id = QasimDev.decodeJid(jid);
            withoutContact = QasimDev.withoutContact || withoutContact;
            let v;
            if (id.endsWith("@g.us"))
                return new Promise(async (resolve) => {
                    v = store.contacts[id] || {};
                    if (!(v.name || v.subject))
                        v = QasimDev.groupMetadata(id) || {};
                    resolve(v.name || v.subject || PhoneNumber(`+${ id.replace('@s.whatsapp.net', '')}`).number?.international);
                });
            else
                v = id === '0@s.whatsapp.net' ? {
                    id,
                    name: 'WhatsApp'
                } : id === QasimDev.decodeJid(QasimDev.user.id) ?
                    QasimDev.user :
                    (store.contacts[id] || {});
            return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber(`+${ jid.replace('@s.whatsapp.net', '')}`).number?.international;
        };
        QasimDev.public = true;
        QasimDev.serializeM = (m) => smsg(QasimDev, m, store);
        const isRegistered = state.creds?.registered === true;

        /*
         * ============================================================
         * WEB PAIRING
         * ============================================================
         *
         * Chaque utilisateur possède sa propre session :
         *
         * sessions/243991234418/
         * sessions/243812345678/
         *
         */

        if (webSession && !isRegistered) {

            if (!number) {
                throw new Error('WhatsApp number is required');
            }

            try {

                updateSession(number, {
                    status: 'generating_code',
                    pairingCode: null,
                    socket: QasimDev
                });

                printLog(
                    'info',
                    `Generating Web Pairing Code for ${number}`
                );

                await new Promise((resolve) => {
                        let resolved = false;

                        const onConnectionUpdate = ({ connection }) => {
                            if (!resolved && connection === 'connecting') {
                                resolved = true;
                                QasimDev.ev.off('connection.update', onConnectionUpdate);
                                resolve();
                            }
                        };

                        QasimDev.ev.on('connection.update', onConnectionUpdate);

                        setTimeout(() => {
                            if (!resolved) {
                                resolved = true;
                                QasimDev.ev.off('connection.update', onConnectionUpdate);
                                resolve();
                            }
                        }, 10000);
                    });

                    await delay(2000);

                    let code = await QasimDev.requestPairingCode(number);

                code =
                    code?.match(/.{1,4}/g)?.join('-') || code;

                webSession.pairingCode = code;
                webSession.status = 'waiting_pairing';
                webSession.socket = QasimDev;

                updateSession(number, {
                    status: 'waiting_pairing',
                    pairingCode: code,
                    socket: QasimDev
                });

                printLog(
                    'success',
                    `Web Pairing Code for ${number}: ${code}`
                );

            } catch (error) {

                updateSession(number, {
                    status: 'pairing_error',
                    pairingCode: null,
                    socket: null,
                    error: error.message
                });

                printLog(
                    'error',
                    `Web pairing failed for ${number}: ${error.message}`
                );

                throw error;
            }

        } else if (isRegistered) {

            if (webSession) {
                updateSession(number, {
                    status: 'connected',
                    socket: QasimDev,
                    pairingCode: null,
                    connectedAt: Date.now()
                });
            }

        }

        QasimDev.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect, qr } = s;
            if (qr) {
                // Web Pairing utilise requestPairingCode().
                // Aucun QR terminal n'est nécessaire ici.
                if (!webSession) {
                    try {
                        console.log(await QRCode.toString(qr, {
                            type: 'terminal',
                            small: true
                        }));
                    }
                    catch (_e) {
                        console.log('QR:', qr);
                    }
                }
            }
            if (connection === "open") {

                if (webSession) {
                    webSession.status = 'connected';
                    webSession.pairingCode = null;
                    webSession.socket = QasimDev;
                    webSession.connectedAt = Date.now();

                    updateSession(number, {
                        status: 'connected',
                        pairingCode: null,
                        socket: QasimDev,
                        connectedAt: webSession.connectedAt
                    });
                }

                printLog('success', 'Bot connected successfully!');
                try {
                    const setbioModule = await import('./plugins/setbio.js');
                    const startAutoBio = setbioModule.startAutoBio || setbioModule.default?.startAutoBio;
                    if (typeof startAutoBio === 'function')
                        startAutoBio(QasimDev);
                }
                catch (e) {
                    printLog('error', `Failed to start auto bio: ${e.message}`);
                }
                const ghostMode = await store.getSetting('global', 'stealthMode');
                if (ghostMode && ghostMode.enabled) {
                    printLog('info', '👻 STEALTH MODE ACTIVE');
                }
                printLog('success', `Connected to => ${ JSON.stringify(QasimDev.user, null, 2)}`);
                try {
                    const botNumber = `${QasimDev.user.id.split(':')[0] }@s.whatsapp.net`;
                    const ghostStatus = (ghostMode && ghostMode.enabled) ? '\n👻 Stealth Mode: ACTIVE' : '';
                    await QasimDev.sendMessage(botNumber, {
                        text: `🤖 Bot Connected Successfully!\n\n⏰ Time: ${new Date().toLocaleString()}\n✅ Status: Online and Ready!${ghostStatus}\n\n✅Make sure to join below channel`,
                        contextInfo: {
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363406589060879@newsletter',
                                newsletterName: 'Infoillua',
                                serverMessageId: -1
                            }
                        }
                    });
                }
                catch (error) {
                    printLog('error', `Failed to send connection message: ${error.message}`);
                }
                await delay(1999);
                try {
                    owner = JSON.parse(fs.readFileSync('./data/owner.json', 'utf-8'));
                }
                catch (_e) { }
                printLog('info', `[ ${config.botName || 'KØREXIA-MD'} ]`);
                printLog('info', `WA NUMBER  : ${owner[0] || config.ownerNumber || ''}`);
                printLog('success', `Bot Connected Successfully!`);
                printLog('info', `Plugins   : ${commandHandler.commands.size}`);
                printLog('info', `Prefixes   : ${config.prefixes.join(', ')}`);
                printLog('store', `Backend    : ${store.getStats().backend}`);
                console.log();
            }
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const disconnectError = lastDisconnect?.error;

                printLog(
                    'error',
                    `🔌 WhatsApp connection closed | code=${statusCode ?? 'unknown'} | error=${disconnectError?.message || disconnectError || 'unknown'}`
                );

                if (disconnectError?.stack) {
                    console.error(disconnectError.stack);
                }

                // 401 = authentification refusée.
                // Ne surtout pas relancer immédiatement le pairing :
                // cela créait une boucle de nouveaux codes.
                if (statusCode === 401 || statusCode === DisconnectReason.loggedOut) {
                    if (webSession) {
                        webSession.status = 'pairing_error';
                        webSession.pairingCode = null;
                        webSession.socket = null;
                        webSession.error = `WhatsApp authentication failed (${statusCode})`;
                    }

                    updateSession(number, {
                        status: 'pairing_error',
                        pairingCode: null,
                        socket: null,
                        error: `WhatsApp authentication failed (${statusCode})`
                    });

                    printLog(
                        'error',
                        `❌ Authentification WhatsApp refusée (${statusCode}). Nouveau pairing requis.`
                    );
                    return;
                }

                // Pour les autres déconnexions, reconnexion normale.
                printLog('connection', 'Reconnecting in 5 seconds...');
                await delay(5000);

                startQasimDev({
                    number,
                    sessionPath,
                    webSession
                });
            }
        });
        QasimDev.ev.on('call', async (calls) => {
            await handleCall(QasimDev, calls);
        });
        QasimDev.ev.on('group-participants.update', async (update) => {
            await handleGroupParticipantUpdate(QasimDev, update);
        });
        QasimDev.ev.on('status.update', async (status) => {
            await handleStatus(QasimDev, status);
        });
        QasimDev.ev.on('messages.reaction', async (reaction) => {
            await handleStatus(QasimDev, reaction);
        });
        return QasimDev;
    }
    catch (error) {
        printLog('error', `Error in startQasimDev: ${error.message}`);
        if (rl && !rlClosed) {
            rl.close();
            rl = null;
        }
        await delay(5000);
        startQasimDev({
                        number,
                        sessionPath,
                        webSession
                    });
    }
}
/*
 * ============================================================
 * WEB PAIRING BOT STARTER
 * ============================================================
 */

registerBotStarter(async ({
    number,
    sessionPath,
    webSession
}) => {

    return await startQasimDev({
        number,
        sessionPath,
        webSession
    });

});

async function main() {
    try {
        await compileAll();
        await commandHandler.loadCommands();

        printLog(
            'success',
            'KØREXIA-MD Web Pairing Server ready'
        );

        printLog(
            'info',
            `Web Pairing available on port ${PORT}`
        );

        printLog(
            'info',
            'Waiting for WhatsApp number from Web Pairing...'
        );
    } catch (error) {
        printLog(
            'error',
            `Fatal startup error: ${error.message}`
        );
        process.exit(1);
    }
}

main();

// Web Pairing sessions are persistent.
// Do NOT delete files from ./sessions automatically.

// Temp folder setup
const customTemp = path.join(process.cwd(), 'temp');
if (!fs.existsSync(customTemp))
    fs.mkdirSync(customTemp, { recursive: true });
process.env.TMPDIR = customTemp;
process.env.TEMP = customTemp;
process.env.TMP = customTemp;
// Temp folder cleanup
setInterval(() => {
    fs.readdir(customTemp, (err, files) => {
        if (err)
            return;
        for (const file of files) {
            const filePath = path.join(customTemp, file);
            fs.stat(filePath, (err, stats) => {
                if (!err && Date.now() - stats.mtimeMs > 3 * 60 * 60 * 1000) {
                    fs.unlink(filePath, () => { });
                }
            });
        }
    });
}, 1 * 60 * 60 * 1000);
// Syntax check dist files
const folders = [
    path.join(__dirname, './lib'),
    path.join(__dirname, './plugins')
];
folders.forEach(folder => {
    if (!fs.existsSync(folder))
        return;
    fs.readdirSync(folder)
        .filter(file => file.endsWith('.js'))
        .forEach(file => {
        const filePath = path.join(folder, file);
        try {
            const code = fs.readFileSync(filePath, 'utf-8');
            const err = syntaxerror(code, file, {
                sourceType: 'module',
                allowAwaitOutsideFunction: true
            });
            if (err) {
                console.error(chalk.red(`❌ Syntax error in ${filePath}:\n${err}`));
            }
        }
        catch (e) {
            console.error(chalk.yellow(`⚠️ Cannot read file ${filePath}:\n${e}`));
        }
    });
});
// Error handlers
process.on('uncaughtException', (err) => {
    printLog('error', `Uncaught Exception: ${err.message}`);
    console.error(err.stack);
    writeErrorLog({
        type: 'uncaughtException',
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
    });
});
process.on('unhandledRejection', (err) => {
    printLog('error', `Unhandled Rejection: ${err.message}`);
    console.error(err.stack);
    writeErrorLog({
        type: 'unhandledRejection',
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
    });
});
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        printLog('error', `Address localhost:${PORT} in use`);
        writeErrorLog({
            type: 'serverError',
            error: `Address localhost:${PORT} in use`,
            timestamp: new Date().toISOString()
        });
        server.close();
    }
    else {
        printLog('error', `Server error: ${error.message}`);
        writeErrorLog({
            type: 'serverError',
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
});

import fs from 'fs';
import path from 'path';

const sessionsDir = path.join(process.cwd(), 'sessions');

if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

const sessions = new Map();
let botStarter = null;

export function registerBotStarter(starter) {
    botStarter = starter;
}

export function getSessionPath(number) {
    const clean = String(number).replace(/\D/g, '');
    return path.join(sessionsDir, clean);
}

export function getSession(number) {
    const clean = String(number).replace(/\D/g, '');
    return sessions.get(clean);
}

export function getAllSessions() {
    return sessions;
}

export function removeSession(number) {
    const clean = String(number).replace(/\D/g, '');
    sessions.delete(clean);
}

export async function createPairingSession(number) {
    const clean = String(number).replace(/\D/g, '');

    if (!clean || clean.length < 8 || clean.length > 15) {
        throw new Error('Invalid WhatsApp number');
    }

    if (!botStarter) {
        throw new Error('Bot starter is not initialized');
    }

    const existing = sessions.get(clean);

    if (existing?.socket) {
        return existing;
    }

    const sessionPath = getSessionPath(clean);

    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }

    const session = {
        number: clean,
        socket: null,
        status: 'starting',
        pairingCode: null,
        createdAt: Date.now(),
        connectedAt: null,
        sessionPath
    };

    sessions.set(clean, session);

    try {
        const socket = await botStarter({
            number: clean,
            sessionPath,
            webSession: session
        });

        session.socket = socket;

        return session;
    } catch (error) {
        sessions.delete(clean);
        throw error;
    }
}

export function updateSession(number, data = {}) {
    const clean = String(number).replace(/\D/g, '');
    const session = sessions.get(clean);

    if (!session) return null;

    Object.assign(session, data);

    return session;
}

export function getSessionStatus(number) {
    const session = getSession(number);

    if (!session) {
        return {
            exists: false,
            status: 'not_found'
        };
    }

    return {
        exists: true,
        number: session.number,
        status: session.status,
        pairingCode: session.pairingCode,
        connectedAt: session.connectedAt,
        createdAt: session.createdAt
    };
}

export function isSessionConnected(number) {
    const session = getSession(number);

    return Boolean(
        session &&
        session.status === 'connected' &&
        session.socket
    );
}

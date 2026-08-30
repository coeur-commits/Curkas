const metadataCache = new Map();

const CACHE_TTL = 60 * 1000; // 60 secondes
const RETRY_AFTER_429 = 15 * 1000; // 15 secondes

function cleanRawId(id = '') {
    return String(id)
        .trim()
        .split(':')[0]
        .split('@')[0];
}

/**
 * Normalisation prudente.
 * IMPORTANT : on ne supprime pas aveuglément tous les caractères.
 */
function normalizeId(id = '') {
    const value = String(id).trim();

    if (!value) return '';

    return value
        .split(':')[0]
        .split('@')[0]
        .trim();
}

/**
 * Compare plusieurs formes d'identifiants WhatsApp.
 */
function sameId(a, b) {
    if (!a || !b) return false;

    const A = normalizeId(a);
    const B = normalizeId(b);

    if (!A || !B) return false;

    // Correspondance exacte
    if (A === B) return true;

    // Comparaison numérique uniquement lorsque les deux sont réellement numériques
    const AN = A.replace(/\D/g, '');
    const BN = B.replace(/\D/g, '');

    if (
        AN &&
        BN &&
        AN.length >= 8 &&
        BN.length >= 8 &&
        AN === BN
    ) {
        return true;
    }

    return false;
}

function isAdminParticipant(participant) {
    return (
        participant?.admin === 'admin' ||
        participant?.admin === 'superadmin'
    );
}

/**
 * Récupère les métadonnées du groupe avec cache.
 * Évite groupMetadata() à chaque message.
 */
async function getGroupMetadata(sock, chatId) {
    const now = Date.now();
    const cached = metadataCache.get(chatId);

    // Cache valide
    if (
        cached?.metadata &&
        now - cached.time < CACHE_TTL
    ) {
        return cached.metadata;
    }

    // WhatsApp vient de limiter cette requête
    if (
        cached?.rateLimitedUntil &&
        now < cached.rateLimitedUntil
    ) {
        if (cached.metadata) {
            return cached.metadata;
        }

        throw new Error('rate-overlimit-cache');
    }

    try {
        const metadata = await sock.groupMetadata(chatId);

        metadataCache.set(chatId, {
            metadata,
            time: Date.now(),
            rateLimitedUntil: 0
        });

        return metadata;

    } catch (err) {
        const message = err?.message || String(err);
        const is429 =
            err?.data === 429 ||
            message.includes('rate-overlimit') ||
            message.includes('429');

        if (is429) {
            console.warn(
                `⚠️ WhatsApp rate-limit sur ${chatId}. Cache conservé.`
            );

            metadataCache.set(chatId, {
                metadata: cached?.metadata || null,
                time: cached?.time || 0,
                rateLimitedUntil: Date.now() + RETRY_AFTER_429
            });

            if (cached?.metadata) {
                return cached.metadata;
            }
        }

        throw err;
    }
}

/**
 * Vérifie :
 * - si l'expéditeur est admin
 * - si le bot est admin
 */
async function isAdmin(sock, chatId, senderId) {

    if (
        !sock ||
        !chatId ||
        !chatId.endsWith('@g.us')
    ) {
        return {
            isSenderAdmin: false,
            isBotAdmin: false,
            senderParticipant: null,
            botParticipant: null,
            metadata: null
        };
    }

    try {
        const metadata = await getGroupMetadata(
            sock,
            chatId
        );

        const participants =
            metadata?.participants || [];

        const botId =
            sock.user?.id || '';

        const botLid =
            sock.user?.lid || '';

        /*
         * Trouver l'expéditeur.
         *
         * WhatsApp peut fournir :
         * id
         * lid
         * phoneNumber
         */
        const senderParticipant =
            participants.find(participant => {

                const ids = [
                    participant?.id,
                    participant?.lid,
                    participant?.phoneNumber
                ].filter(Boolean);

                return ids.some(id =>
                    sameId(id, senderId)
                );
            });

        /*
         * Trouver le bot.
         */
        const botParticipant =
            participants.find(participant => {

                const ids = [
                    participant?.id,
                    participant?.lid,
                    participant?.phoneNumber
                ].filter(Boolean);

                return ids.some(id =>
                    sameId(id, botId) ||
                    sameId(id, botLid)
                );
            });

        const isSenderAdmin =
            Boolean(senderParticipant) &&
            isAdminParticipant(senderParticipant);

        const isBotAdmin =
            Boolean(botParticipant) &&
            isAdminParticipant(botParticipant);

        return {
            isSenderAdmin,
            isBotAdmin,
            senderParticipant,
            botParticipant,
            metadata
        };

    } catch (err) {

        const message =
            err?.message || String(err);

        if (
            message.includes('rate-overlimit') ||
            message.includes('rate-limit') ||
            message.includes('429')
        ) {
            console.warn(
                `⚠️ isAdmin: WhatsApp rate-limit pour ${chatId}`
            );
        } else if (
            message !== 'rate-overlimit-cache'
        ) {
            console.error(
                '❌ Error in isAdmin:',
                err
            );
        }

        /*
         * IMPORTANT :
         * En cas d'erreur réseau, on ne prétend pas
         * que l'utilisateur est admin.
         *
         * Le messageHandler pourra décider quoi faire.
         */
        return {
            isSenderAdmin: false,
            isBotAdmin: false,
            senderParticipant: null,
            botParticipant: null,
            metadata: null,
            error: err
        };
    }
}

/**
 * Nettoyage manuel du cache.
 */
export function clearAdminCache(chatId = null) {

    if (chatId) {
        metadataCache.delete(chatId);
        return;
    }

    metadataCache.clear();
}

export {
    normalizeId,
    cleanRawId,
    sameId,
    getGroupMetadata
};

export default isAdmin;

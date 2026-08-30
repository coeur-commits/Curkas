import axios from 'axios';
import { writeExifImg } from '../lib/exif.js';

export default {
    command: 'quoted',
    aliases: ['q', 'fakereply'],
    category: 'stickers',
    description: 'Generate a quote sticker from text',
    usage: '.quoted <text> or reply to a message',

    async handler(sock, message, args, context) {
        const chatId =
            context.chatId ||
            message.key.remoteJid;

        const ctx =
            message.message?.extendedTextMessage?.contextInfo;

        let text = args.join(' ').trim();

        if (!text) {
            const q = ctx?.quotedMessage;

            if (!q) {
                return sock.sendMessage(
                    chatId,
                    {
                        text:
                            '📝 Please provide text or reply to a message.\n\n' +
                            'Usage: .quoted <text>'
                    },
                    { quoted: message }
                );
            }

            text =
                q.conversation ||
                q.extendedTextMessage?.text ||
                q.imageMessage?.caption ||
                q.videoMessage?.caption ||
                'Media message';
        }

        const who =
            ctx?.participant ||
            ctx?.mentionedJid?.[0] ||
            message.key.participant ||
            message.key.remoteJid;

        const [userPfp, contactInfo] =
            await Promise.allSettled([
                sock.profilePictureUrl(who, 'image'),
                sock.onWhatsApp(who)
            ]);

        const pfp =
            userPfp.status === 'fulfilled'
                ? userPfp.value
                : 'https://i.ibb.co/9HY4wjz/a4c0b1af253197d4837ff6760d5b81c0.jpg';

        const contactValue =
            contactInfo.status === 'fulfilled'
                ? contactInfo.value
                : null;

        const storeContact =
            sock.store?.contacts?.[who];

        const userName =
            storeContact?.name ||
            storeContact?.notify ||
            contactValue?.[0]?.notify ||
            (
                who?.includes('@s.whatsapp.net')
                    ? `+${who.replace('@s.whatsapp.net', '')}`
                    : 'User'
            );

        try {
            const res = await axios.post(
                'https://bot.lyo.su/quote/generate',
                {
                    type: 'quote',
                    format: 'png',
                    backgroundColor: '#FFFFFF',
                    width: 1800,
                    height: 200,
                    scale: 2,
                    messages: [
                        {
                            entities: [],
                            avatar: true,
                            from: {
                                id: 1,
                                name: userName,
                                photo: {
                                    url: pfp
                                }
                            },
                            text,
                            replyMessage: {}
                        }
                    ]
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            if (!res.data?.result?.image) {
                throw new Error('Invalid API response');
            }

            const bufferImage = Buffer.from(
                res.data.result.image,
                'base64'
            );

            try {
                const stickerPath = await writeExifImg(
                    bufferImage,
                    {
                        packname: 'MEGA-MD',
                        author: userName,
                        categories: ['🤩', '🎉']
                    }
                );

                const fs = await import('fs/promises');

                try {
                    const stickerBuffer =
                        await fs.readFile(stickerPath);

                    await sock.sendMessage(
                        chatId,
                        {
                            sticker: stickerBuffer
                        },
                        {
                            quoted: message
                        }
                    );
                } finally {
                    await fs
                        .unlink(stickerPath)
                        .catch(() => {});
                }

            } catch (stickerError) {
                console.error(
                    'Quote sticker conversion error:',
                    stickerError
                );

                await sock.sendMessage(
                    chatId,
                    {
                        image: bufferImage,
                        caption:
                            '📝 Quote image\n' +
                            '⚠️ Sticker conversion failed.'
                    },
                    {
                        quoted: message
                    }
                );
            }

        } catch (err) {
            console.error(
                'Quote plugin error:',
                err
            );

            const errorMessage =
                String(err?.message || '');

            const msg =
                errorMessage.toLowerCase().includes('timeout')
                    ? 'Request timed out.'
                    : errorMessage.includes('Invalid API')
                        ? 'API returned invalid data.'
                        : 'Please try again later.';

            await sock.sendMessage(
                chatId,
                {
                    text:
                        `❌ Failed to generate quote. ${msg}`
                },
                {
                    quoted: message
                }
            );
        }
    }
};

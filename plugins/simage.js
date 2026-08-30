import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { spawn } from 'child_process';

function ffmpeg(buffer) {
    return new Promise((resolve, reject) => {
        const process = spawn('ffmpeg', [
            '-hide_banner',
            '-loglevel', 'error',
            '-i', 'pipe:0',
            '-frames:v', '1',
            '-f', 'image2',
            '-c:v', 'png',
            'pipe:1'
        ]);

        const output = [];
        const errors = [];

        process.stdout.on('data', chunk => output.push(chunk));
        process.stderr.on('data', chunk => errors.push(chunk));

        process.on('error', reject);

        process.stdin.write(buffer);
        process.stdin.end();

        process.on('close', code => {
            if (code === 0) {
                resolve(Buffer.concat(output));
            } else {
                reject(new Error(
                    Buffer.concat(errors).toString() ||
                    `FFmpeg exited with code ${code}`
                ));
            }
        });
    });
}

export default {
    command: 's2img',
    aliases: ['simage', 'stoimg'],
    category: 'stickers',
    description: 'Convert a sticker to an image',
    usage: '.s2img (reply to a sticker)',

    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;

        try {
            const quotedMessage =
                message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            if (!quotedMessage?.stickerMessage) {
                await sock.sendMessage(
                    chatId,
                    {
                        text: '⚠️ Réponds à un sticker avec `.s2img`.'
                    },
                    { quoted: message }
                );
                return;
            }

            const stream = await downloadContentFromMessage(
                quotedMessage.stickerMessage,
                'sticker'
            );

            const chunks = [];

            for await (const chunk of stream) {
                chunks.push(chunk);
            }

            const stickerBuffer = Buffer.concat(chunks);
            const imageBuffer = await ffmpeg(stickerBuffer);

            await sock.sendMessage(
                chatId,
                {
                    image: imageBuffer,
                    caption: '✨ *Sticker converti en image !*'
                },
                { quoted: message }
            );

        } catch (error) {
            console.error('S2IMG Plugin Error:', error);

            await sock.sendMessage(
                chatId,
                {
                    text: '❌ Impossible de convertir ce sticker.'
                },
                { quoted: message }
            );
        }
    }
};

import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { spawn } from 'child_process';

function ffmpeg(buffer, args) {
    return new Promise((resolve, reject) => {
        const process = spawn('ffmpeg', [
            '-hide_banner',
            '-loglevel', 'error',
            '-i', 'pipe:0',
            ...args,
            '-f', 'image2',
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
    command: 'blur',
    aliases: ['blurimg', 'blurpic'],
    category: 'tools',
    description: 'Apply a blur effect to an image',
    usage: '.blur (reply to an image or send image with caption)',

    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;

        try {
            const quotedMessage =
                message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

            let imageBuffer;

            if (quotedMessage?.imageMessage) {
                const quoted = {
                    message: {
                        imageMessage: quotedMessage.imageMessage
                    }
                };

                imageBuffer = await downloadMediaMessage(
                    quoted,
                    'buffer',
                    {}
                );
            } else if (message.message?.imageMessage) {
                imageBuffer = await downloadMediaMessage(
                    message,
                    'buffer',
                    {},
                    {}
                );
            } else {
                await sock.sendMessage(
                    chatId,
                    {
                        text: '❌ Réponds à une image ou envoie une image avec `.blur`.'
                    },
                    { quoted: message }
                );
                return;
            }

            const blurredImage = await ffmpeg(imageBuffer, [
                '-vf',
                'scale=800:800:force_original_aspect_ratio=decrease,boxblur=10:2',
                '-frames:v',
                '1',
                '-c:v',
                'mjpeg',
                '-q:v',
                '5'
            ]);

            await sock.sendMessage(
                chatId,
                {
                    image: blurredImage,
                    caption: '✨ *Image floutée avec succès !*'
                },
                { quoted: message }
            );

        } catch (error) {
            console.error('Blur Plugin Error:', error);

            await sock.sendMessage(
                chatId,
                {
                    text: '❌ Impossible de flouter cette image.'
                },
                { quoted: message }
            );
        }
    }
};

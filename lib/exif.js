import path from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';
import fs from 'fs';
import { spawn } from 'child_process';
import webp from 'node-webpmux';

function randomFileName(ext = '.webp') {
    return path.join(
        tmpdir(),
        `${crypto.randomBytes(8).toString('hex')}${ext}`
    );
}

function runFFmpeg(args, inputBuffer = null) {
    return new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', args);

        const chunks = [];
        const errors = [];

        ff.stdout.on('data', chunk => chunks.push(chunk));
        ff.stderr.on('data', chunk => errors.push(chunk));

        ff.on('error', reject);

        if (inputBuffer) {
            ff.stdin.write(inputBuffer);
            ff.stdin.end();
        }

        ff.on('close', code => {
            if (code === 0) {
                resolve(Buffer.concat(chunks));
            } else {
                reject(
                    new Error(
                        Buffer.concat(errors).toString() ||
                        `FFmpeg exited with code ${code}`
                    )
                );
            }
        });
    });
}

async function toWebp(media) {
    return await runFFmpeg([
        '-hide_banner',
        '-loglevel', 'error',
        '-i', 'pipe:0',
        '-vf',
        'scale=512:512:force_original_aspect_ratio=decrease,' +
        'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0',
        '-c:v', 'libwebp',
        '-lossless', '0',
        '-q:v', '80',
        '-compression_level', '6',
        '-frames:v', '1',
        '-f', 'webp',
        'pipe:1'
    ], Buffer.from(media));
}

async function addExif(webpBuffer, metadata = {}) {
    const img = new webp.Image();

    const stickerPackId = crypto
        .randomBytes(32)
        .toString('hex');

    const json = {
        'sticker-pack-id': stickerPackId,
        'sticker-pack-name': metadata.packname || 'KØREXIA-MD',
        'sticker-pack-publisher': metadata.author || 'KØREXIA-MD',
        'emojis': metadata.categories || [''],
        ...(metadata.extra || {})
    };

    const exifAttr = Buffer.from([
        0x49, 0x49, 0x2A, 0x00,
        0x08, 0x00, 0x00, 0x00,
        0x01, 0x00,
        0x41, 0x57, 0x07, 0x00,
        0x00, 0x00,
        0x00, 0x00,
        0x16, 0x00,
        0x00, 0x00
    ]);

    const jsonBuffer = Buffer.from(
        JSON.stringify(json),
        'utf8'
    );

    const exif = Buffer.concat([
        exifAttr,
        jsonBuffer
    ]);

    exif.writeUIntLE(
        jsonBuffer.length,
        14,
        4
    );

    await img.load(webpBuffer);

    img.exif = exif;

    return await img.save(null);
}

export async function imageToWebp(media) {
    return await toWebp(media);
}

export async function videoToWebp(media) {
    return await runFFmpeg([
        '-hide_banner',
        '-loglevel', 'error',
        '-i', 'pipe:0',
        '-t', '6',
        '-vf',
        'scale=512:512:force_original_aspect_ratio=decrease,' +
        'pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0',
        '-c:v', 'libwebp_anim',
        '-loop', '0',
        '-lossless', '0',
        '-q:v', '70',
        '-compression_level', '6',
        '-f', 'webp',
        'pipe:1'
    ], Buffer.from(media));
}

export async function writeExifImg(media, metadata = {}) {
    const webpBuffer = await imageToWebp(media);
    const finalBuffer = await addExif(webpBuffer, metadata);

    const output = randomFileName();

    fs.writeFileSync(output, finalBuffer);

    return output;
}

export async function writeExifVid(media, metadata = {}) {
    const webpBuffer = await videoToWebp(media);
    const finalBuffer = await addExif(webpBuffer, metadata);

    const output = randomFileName();

    fs.writeFileSync(output, finalBuffer);

    return output;
}

export async function writeExif(media, metadata = {}) {
    if (!media) return null;

    const input = media?.data
        ? media.data
        : media;

    const webpBuffer = await imageToWebp(input);
    const finalBuffer = await addExif(webpBuffer, metadata);

    const output = randomFileName();

    fs.writeFileSync(output, finalBuffer);

    return output;
}

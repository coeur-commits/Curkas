import config from '../config.js';
import { imageToWebp, writeExifImg } from './exif.js';

const DEFAULT_PACK = 'MEGA-MD';
const DEFAULT_AUTHOR = 'KØREXIA-MD';

function getPack(packname) {
    return packname || config.packname || DEFAULT_PACK;
}

function getAuthor(author) {
    return author || config.author || DEFAULT_AUTHOR;
}

async function getInput(img, url) {
    if (url) {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return Buffer.from(await response.arrayBuffer());
    }

    if (Buffer.isBuffer(img)) {
        return img;
    }

    if (img instanceof Uint8Array) {
        return Buffer.from(img);
    }

    if (typeof img === 'string') {
        return img;
    }

    throw new Error('Invalid sticker input');
}

export async function sticker(isImage, url, packname, author) {
    try {
        const input = await getInput(null, url);

        return await imageToWebp(input);
    } catch (error) {
        console.error('Error in sticker creation:', error);
        return null;
    }
}

export async function sticker2(img, url) {
    const input = await getInput(img, url);
    return await imageToWebp(input);
}

export async function sticker3(img, url, packname, author) {
    const input = await getInput(img, url);

    return await imageToWebp(input);
}

export async function sticker4(img, url) {
    const input = await getInput(img, url);
    return await imageToWebp(input);
}

export async function sticker5(
    img,
    url,
    packname,
    author,
    categories = [''],
    extra = {}
) {
    const input = await getInput(img, url);
    const webpBuffer = await imageToWebp(input);

    const tempFile = await writeExifImg(webpBuffer, {
        packname: getPack(packname),
        author: getAuthor(author),
        categories,
        extra
    });

    const fs = await import('fs/promises');

    try {
        return await fs.readFile(tempFile);
    } finally {
        await fs.unlink(tempFile).catch(() => {});
    }
}

export async function sticker6(img, url) {
    const input = await getInput(img, url);
    return await imageToWebp(input);
}

export async function addExif(
    webpSticker,
    packname,
    author,
    categories = [''],
    extra = {}
) {
    const { default: webpmux } = await import('node-webpmux');

    const img = new webpmux.Image();

    const crypto = await import('crypto');

    const stickerPackId = crypto.randomBytes(32).toString('hex');

    const json = {
        'sticker-pack-id': stickerPackId,
        'sticker-pack-name': packname || DEFAULT_PACK,
        'sticker-pack-publisher': author || DEFAULT_AUTHOR,
        'emojis': categories,
        ...extra
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

    await img.load(webpSticker);

    img.exif = exif;

    return await img.save(null);
}

export const support = {
    ffmpeg: true,
    ffprobe: true,
    ffmpegWebp: true,
    convert: true,
    magick: false,
    gm: false,
    find: false
};

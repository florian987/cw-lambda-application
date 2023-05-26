'use strict'

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { createCommonJS } from 'mlly'
const { __dirname, __filename, require } = createCommonJS(import.meta.url)
import sharp from 'sharp'

const s3 = new S3Client({ region: process.env.REGION });
const path = require('path');

export const imageResizerHandler = async (event) => {

    let fit = { fit: sharp.fit.cover }
    const parsedRequest = path.parse(event.rawPath);

    console.info(JSON.stringify(process.env.ALLOWED_SIZES));

    try {
        if (!process.env.ALLOWED_EXTENSIONS.split(',').includes(parsedRequest.ext)) {
            throw new Error('Not a jpeg file')
        }

        const requestSize = parsedRequest.dir.replace(/^\/|\/$/g, '');
        if (!process.env.ALLOWED_SIZES.split(',').includes(requestSize)) {
            throw new Error('Size not valid')
        }

        const [width, height] = requestSize.split('x').map(Number);

        const response = await s3.send(new GetObjectCommand({
            Bucket: process.env.ORIGINAL_BUCKET,
            Key: parsedRequest.base
        }));

        if (width == 1440) {
            fit = { fit: sharp.fit.inside, withoutEnlargement: true }
        }

        const pipeline = sharp()
            //.composite([{ input: 'overlay.png', gravity: 'southeast' }])
            .resize(width, height, fit)
            .rotate()
            .jpeg({ mozjpeg: true });

        response.Body.pipe(pipeline);

        const resizedImage = await pipeline.toBuffer();

        await s3.send(new PutObjectCommand({
            Body: resizedImage,
            Bucket: process.env.DESTINATION_BUCKET,
            Key: requestSize + '/' + parsedRequest.base
        }));

        return {
            statusCode: 200,
            body: resizedImage.toString('base64'),
            isBase64Encoded: true,
            headers: {
                'Content-Type': 'image/jpeg'
            }
        };

    } catch (e) {
        console.error(e.message);

        return {
            statusCode: e.statusCode || 400
        };
    }
}

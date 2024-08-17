'use strict'

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp'
import path from 'path';

const s3 = new S3Client({ region: process.env.REGION });

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

        let sharpPipeline = sharp({failOn: 'truncated'})
            .rotate()
            .resize(width, height, fit)
            .jpeg({ mozjpeg: true });

        // watermark only large images and if user asked for it
        if (width == 1440 && response.Metadata.watermark == 'true') {
            sharpPipeline = sharpPipeline.composite([{input: './src/static/watermark.png', gravity: 'southeast'}])
        }

        const resizedImage = response.Body.pipe(sharpPipeline)

        console.info(requestSize + '/' + parsedRequest.base)

        await s3.send(new PutObjectCommand({
            Body: await resizedImage.toBuffer(),
            Bucket: process.env.DESTINATION_BUCKET,
            Key: requestSize + '/' + parsedRequest.base,
            ContentType: 'image/jpeg',
        }))

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

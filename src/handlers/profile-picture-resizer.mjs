'use strict'

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp'
import path from 'path';

const s3 = new S3Client({ region: process.env.REGION });

export const profilePictureResizerHandler = async (event) => {
    try {
        // Extract the filename from the S3 event
        const parsedRequest = path.parse(event.rawPath);
        const extension = parsedRequest.ext.toLowerCase();

        if (!process.env.ALLOWED_EXTENSIONS.split(',').includes(extension)) {
            throw new Error('Not an approved extension');
        }

        const key = `${process.env.PREFIX}/${parsedRequest.base}`;
        console.info(`Processing image: ${key}`);

        // Get the original image from S3
        const response = await s3.send(new GetObjectCommand({
            Bucket: process.env.ORIGINAL_BUCKET,
            Key: key
        }));

        const size = parseInt(process.env.SIZE);

        // Create sharp pipeline
        let imageProcessor = sharp(await response.Body.transformToByteArray())
            .rotate()
            .resize(size, size, {
                fit: sharp.fit.cover,
                position: sharp.strategy.entropy
            });

        // Format based on original extension
        if (extension === '.png') {
            imageProcessor = imageProcessor.png({
                quality: 80,
                compressionLevel: 9,
            });
        } else {
            imageProcessor = imageProcessor.jpeg({
                quality: 80,
                mozjpeg: true,
            });
        }

        const resizedImage = await imageProcessor.toBuffer();

        // Set appropriate content type based on extension
        const contentType = extension === '.png' ? 'image/png' : 'image/jpeg';

        await s3.send(new PutObjectCommand({
            Body: resizedImage,
            Bucket: process.env.DESTINATION_BUCKET,
            Key: key,
            ContentType: contentType,
        }));

        console.info(`Successfully processed ${key}`);

        return {
            statusCode: 200,
            body: resizedImage.toString('base64'),
            isBase64Encoded: true,
            headers: {
                'Content-Type': contentType
            }
        };

    } catch (e) {
        console.error(e.message);

        return {
            statusCode: e.statusCode || 400
        };
    }
}

'use strict'

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp'
import path from 'path';
import axios from 'axios';

const s3 = new S3Client({ region: process.env.REGION });

export const handler = async (event) => {

    const parsedRequest = path.parse(event.rawPath);
    const id = parseInt(parsedRequest.name);

    if (!parsedRequest.ext === '.png') {
        throw new Error('Not a png file')
    }

    if (!Number.isInteger(id)) {
        throw new Error('Not a valid file number')
    }
    try {
        const data = (await axios.get(`${process.env.BANNER_DATA_URI}/${id}`)).data;
        console.info(data);

        const svgText = `
        <svg width="468" height="60">
            <style>
                <![CDATA[
                    text {
                        font-size: 15;
                        font-family: OpenSans;
                        fill: white;
                    }
                ]]>
            </style>
            <text x="110" y="47" text-anchor="start">${data.count}</text>
            ${data.top[0] ? `<text x="240" y="17" text-anchor="start">${data.top[0]}</text>` : ''}
            ${data.top[1] ? `<text x="240" y="35" text-anchor="start">${data.top[1]}</text>` : ''}
            ${data.top[2] ? `<text x="240" y="54" text-anchor="start">${data.top[2]}</text>` : ''}
        </svg>`;

        const processedImage = await sharp('./src/static/background-banner.png')
            .composite([{input: Buffer.from(svgText), left: 0, top: 0}])
            .toBuffer();

        await s3.send(new PutObjectCommand({
            Body: processedImage,
            Bucket: process.env.DESTINATION_BUCKET,
            Key: 'banner/'+ id +'.png',
            ContentType: 'image/png',
        }));

        return {
            statusCode: 200,
            body: processedImage.toString('base64'),
            isBase64Encoded: true,
            headers: {
                'Content-Type': 'image/png'
            }
        };

    } catch (e) {
        console.error(e.message);

        return {
            statusCode: e.statusCode || 400
        };
    }
}

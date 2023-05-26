'use strict'

import queryString from 'query-string';
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const snsClient = new SNSClient({ region: process.env.REGION });

export const contactFormHandler = async (event) => {

    const { userEmail, userMessage, userName } = queryString.parse(Buffer.from(event.body, 'base64').toString('ascii'));

    const response = await snsClient.send(new PublishCommand({
        TopicArn: process.env.SNS_TOPIC,
        Message: userName + "\n" + userMessage + "\n" + userEmail,
    }));

    return {
        statusCode: 200,
        body: {
            type: 'success',
            text: 'Message sent successfully!',
        }
    };
}

'use strict'

import queryString from "query-string";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import axios from 'axios';

export const contactFormHandler = async (event) => {

    const { userEmail, userMessage, userName, token } = queryString.parse(Buffer.from(event.body, 'base64').toString('ascii'));

    const valid = await isRecaptchaValid(token);

    console.log(valid);

    if (valid) {
        const snsClient = new SNSClient({ region: process.env.REGION });

        await snsClient.send(new PublishCommand({
            TopicArn: process.env.SNS_TOPIC,
            Message: "Airtime Prod Contact Form\n" + userName + "\n" + userMessage + "\n" + userEmail,
        }));

        return {
            statusCode: 200,
            body: {
                type: 'success',
                text: 'Message sent successfully!',
            }
        };
    }

    return {
        statusCode: 200,
        body: {
            type: 'error',
            text: 'Error while sending message',
        }
    };
}

const isRecaptchaValid = async (token) => {
    return axios
        .post('https://www.google.com/recaptcha/api/siteverify', {
            secret: process.env.RECAPTCHA_SECRET,
            response: token
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
        )
        .then(function (response) {
            console.log(response.data);

            if (response.data.success) {
                return true;
            }

            return false;
        })
        .catch(function (error) {
            console.error(error);

            return false;
        });
}

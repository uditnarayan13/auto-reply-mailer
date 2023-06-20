const express = require('express');
const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

const clientID = process.env.CLIENT_ID;
const clientSecret = process.env.SECRET_KEY;
const redirectURI = process.env.REDIRECT_URI;
const refreshToken = process.env.REFRESH_TOKEN;

const oAuth2Client = new OAuth2Client(clientID, clientSecret, redirectURI);
oAuth2Client.setCredentials({
    refresh_token: process.env.REFRESH_TOKEN,
});

oAuth2Client.setCredentials({ refresh_token: refreshToken });

app.get('/', (req, res, next) => {
    checkEmails()
        .then(() => {
            console.log('Email check complete.');
        })
        .catch((error) => {
            console.error('An error occurred while checking emails:', error);
        });
})

async function checkEmails() {
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
    const res = await gmail.users.messages.list({
        userId: 'me',
        labelIds: ['INBOX'],
        q: `is:unread -subject:"do not reply"`,
    });

    const messages = res.data.messages;
    if (messages.length) {
        console.log('Unread emails:');
        messages.forEach(async (message) => {
            const email = await gmail.users.messages.get({
                userId: 'me',
                id: message.id,
                format: 'full'
            });

            console.log('- From:', email.data.payload.headers.find(header => header.name === 'From').value);
            console.log('- Subject:', email.data.payload.headers.find(header => header.name === 'Subject').value);
            console.log('- Body:', email.data.snippet);
            console.log('-----------------------');

            const from = email.data.payload.headers.find(header => header.name === 'From').value;
            const subject = email.data.payload.headers.find(header => header.name === 'Subject').value;
            const threadId = email.data.threadId;

            const replyCount = await countReplies(threadId);
            if (replyCount === 0) {
                sendMail(from, subject).then(result => console.log('Reply sent:', result)).catch(error => console.log('Error sending reply:', error));
            }
        });
    } else {
        console.log('No unread emails.');
    }
}

async function sendMail(email, subject) {
    try {
        const { token } = await oAuth2Client.getAccessToken();
        const transport = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                type: 'OAuth2',
                user: 'udit.97narayan@gmail.com',
                clientID: process.env.CLIENT_ID,
                clientSecret: process.env.SECRET_KEY,
                refreshToken: process.env.REFRESH_TOKEN,
                accessToken: token
            }
        })
        const mailOptions = {
            from: 'udit.97narayan@gmail.com',
            to: email,
            subject: `Re: ${subject}`,
            text: 'Please reach out to me after 10 days',
            html: 'Please reach out to me after <h1> 10 days</h1>',
        };
        
        const result = await transport.sendMail(mailOptions);

        return result;

    } catch (error) {
        return error
    }
}

async function countReplies(threadId) {
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const thread = await gmail.users.threads.get({ userId: 'me', id: threadId });
    return thread.data.messages.length - 1;
}

setInterval(checkEmails, 2 * 60 * 1000);

app.listen(8080, () => {
    console.log('server started successfully again')
});
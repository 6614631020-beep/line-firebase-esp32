require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); // ถ้าใช้ Node 18+ คุณอาจใช้ global fetch แทน
const crypto = require('crypto');

const app = express();
app.use(express.json());

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const FIREBASE_URL = (process.env.FIREBASE_URL || '').replace(/\/+$/, ''); // remove trailing slash
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

function verifySignature(req) {
    const signature = req.get('x-line-signature') || '';
    const body = JSON.stringify(req.body);
    const hash = crypto.createHmac('sha256', LINE_CHANNEL_SECRET).update(body).digest('base64');
    return hash === signature;
}

async function setLED(value) {
    const url = `${FIREBASE_URL}/led.json`;
    const res = await fetch(url, {
        method: 'PUT',
        body: JSON.stringify(value),
        headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`Firebase error ${res.status}: ${await res.text()}`);
    return res.json();
}

async function getLED() {
    const url = `${FIREBASE_URL}/led.json`;
    const res = await fetch(url);
    return res.ok ? res.json() : null;
}

app.post('/webhook', async (req, res) => {
    // production: enable verification (must set LINE_CHANNEL_SECRET correctly in env)
    if (!verifySignature(req)) return res.status(401).send('Invalid signature');

    const events = req.body.events || [];
    for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
            const msg = event.message.text.trim().toLowerCase();
            let replyText = 'Unknown command';

            if (msg === 'on') {
                await setLED(true);
                replyText = '💡 LED turned ON';
            } else if (msg === 'off') {
                await setLED(false);
                replyText = '💤 LED turned OFF';
            } else if (msg === 'status') {
                const cur = await getLED();
                replyText = cur ? '💡 LED is ON' : '💤 LED is OFF';
            }

            await fetch('https://api.line.me/v2/bot/message/reply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
                },
                body: JSON.stringify({
                    replyToken: event.replyToken,
                    messages: [{ type: 'text', text: replyText }]
                })
            });
        }
    }

    res.sendStatus(200);
});

app.get('/', (req, res) => res.send('OK'));
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

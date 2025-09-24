require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); // ถ้าใช้ Node 18+ คุณอาจใช้ global fetch ได้เลย
const crypto = require('crypto');

const app = express();
app.use(express.json());

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const FIREBASE_URL = (process.env.FIREBASE_URL || '').replace(/\/+$/, ''); // remove trailing slash
const PORT = process.env.PORT || 3000;

// ================================================
// 🔹 Verify LINE Signature
// ================================================
function verifySignature(req) {
    const signature = req.get('x-line-signature') || '';
    const body = JSON.stringify(req.body);
    const hash = crypto.createHmac('sha256', LINE_CHANNEL_SECRET).update(body).digest('base64');
    return hash === signature;
}

// ================================================
// 🔹 Save command to Firebase
// ================================================
async function setCommand(value) {
    const url = `${FIREBASE_URL}/command.json`;
    const res = await fetch(url, {
        method: 'PUT',
        body: JSON.stringify(value),
        headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`Firebase error ${res.status}: ${await res.text()}`);
    return res.json();
}

// ================================================
// 🔹 Webhook from LINE
// ================================================
app.post('/webhook', async (req, res) => {
    if (!verifySignature(req)) return res.status(401).send('Invalid signature');

    const events = req.body.events || [];
    for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
            const msg = event.message.text.trim();
            let replyText = '❓ กรุณาพิมพ์ว่า "เปิด" หรือ "ปิด" เท่านั้น';

            if (msg === 'เปิด') {
                await setCommand("เปิด");
                replyText = '✅ รับคำสั่ง: เปิดหลังคา';
            } else if (msg === 'ปิด') {
                await setCommand("ปิด");
                replyText = '✅ รับคำสั่ง: ปิดหลังคา';
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

// ================================================
// 🔹 Root Endpoint
// ================================================
app.get('/', (req, res) => res.send('OK'));

// ================================================
// 🔹 Start Server
// ================================================
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

// index.js (CommonJS, debug mode)
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(bodyParser.json({ type: '*/*' })); // LINE ส่ง json

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const FIREBASE_URL = process.env.FIREBASE_URL; // เช่น https://xxx.firebaseio.com/
const PORT = process.env.PORT || 3000;

// ตรวจสอบ signature (ปิดชั่วคราวเพื่อ debug)
function verifySignature(req) {
    const signature = req.get('x-line-signature') || '';
    const body = JSON.stringify(req.body);
    const hash = crypto.createHmac('sha256', LINE_CHANNEL_SECRET).update(body).digest('base64');
    return hash === signature;
}

async function setLED(value) {
    const url = `${FIREBASE_URL}/led.json`;
    console.log("👉 setLED Fetching:", url, "value:", value);

    try {
        const res = await fetch(url, {
            method: 'PUT',
            body: JSON.stringify(value),
            headers: { 'Content-Type': 'application/json' }
        });

        const text = await res.text();
        console.log("👉 Firebase status:", res.status);
        console.log("👉 Firebase response:", text);
        return text;
    } catch (err) {
        console.error("❌ Error in setLED:", err);
    }
}

async function getLED() {
    const url = `${FIREBASE_URL}/led.json`;
    console.log("👉 getLED Fetching:", url);

    try {
        const res = await fetch(url);
        const text = await res.text();
        console.log("👉 Firebase status:", res.status);
        console.log("👉 Firebase response:", text);
        return res.ok ? JSON.parse(text) : null;
    } catch (err) {
        console.error("❌ Error in getLED:", err);
        return null;
    }
}

app.post('/webhook', async (req, res) => {
    console.log("✅ Webhook called");
    console.log("Headers:", req.headers);
    console.log("Body:", JSON.stringify(req.body));

    // ปิดการตรวจ signature ชั่วคราว
    // if (!verifySignature(req)) {
    //     return res.status(401).send('Invalid signature');
    // }

    const events = req.body.events || [];
    for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
            const msg = event.message.text.trim().toLowerCase();
            console.log("📩 Received message:", msg);

            let replyText = '❓ Unknown command. Use "on", "off", or "status".';

            if (msg === 'on') {
                console.log("👉 calling setLED(true)");
                await setLED(true);
                replyText = '💡 LED turned ON';
            } else if (msg === 'off') {
                console.log("👉 calling setLED(false)");
                await setLED(false);
                replyText = '💤 LED turned OFF';
            } else if (msg === 'status') {
                console.log("👉 calling getLED()");
                const cur = await getLED();
                replyText = cur ? '💡 LED is ON' : '💤 LED is OFF';
            }

            try {
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
                console.log("👉 Sent reply to LINE:", replyText);
            } catch (err) {
                console.error("❌ Error sending reply to LINE:", err);
            }
        }
    }

    res.sendStatus(200);
});

app.listen(PORT, () => console.log(`🚀 Server listening on ${PORT}`));
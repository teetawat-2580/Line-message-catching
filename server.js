require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const app = express();
const client = new line.Client(config);

// Critical middleware ordering
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint (required for Render)
app.get('/', (req, res) => {
  res.status(200).json({ status: 'active', timestamp: new Date() });
});

// Webhook endpoint - must match LINE Console exactly
app.post('/webhook', line.middleware(config), (req, res) => {
  // Immediate 200 response is CRUCIAL
  res.status(200).end();
  
  // Process events asynchronously
  Promise.all(req.body.events.map(handleEvent))
    .catch(err => console.error('Processing error:', err));
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  if (event.message.text.toLowerCase().includes('urgent')) {
    try {
      const profile = await client.getProfile(event.source.userId);
      await client.pushMessage(process.env.YOUR_USER_ID, {
        type: 'text',
        text: `🚨 Urgent from ${profile.displayName}:\n"${event.message.text}"`
      });
      console.log('Notification sent successfully');
    } catch (err) {
      console.error('Failed to send notification:', err);
    }
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Webhook URL: https://your-render-service.onrender.com/webhook`);
});
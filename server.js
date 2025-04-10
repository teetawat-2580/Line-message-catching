const express = require('express');
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || 'YOUR_CHANNEL_ACCESS_TOKEN',
  channelSecret: process.env.CHANNEL_SECRET || 'YOUR_CHANNEL_SECRET'
};

const app = express();
const client = new line.Client(config);

// Middleware for JSON parsing
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.status(200).json({ status: 'healthy' });
  });

// Your personal LINE user ID (who will receive notifications)
const YOUR_USER_ID = process.env.YOUR_USER_ID || 'YOUR_PERSONAL_LINE_USER_ID';

// Keyword to detect
const KEYWORD = 'urgent';

// LINE Webhook - MUST MATCH your LINE Developer Console setting
app.post('/webhook', line.middleware(config), (req, res) => {
    // Immediate response to LINE
    res.status(200).end();
    
    // Process events asynchronously
    Promise.all(req.body.events.map(handleEvent))
      .catch(err => console.error('Event handling error:', err));
  });
  

// Root endpoint response
app.get('/', (req, res) => {
  res.send('LINE bot is running! Webhook is at POST /webhook');
});

async function handleEvent(event) {
    if (event.type !== 'message' || event.message.type !== 'text') return;
  
    const keyword = 'urgent';
    if (event.message.text.toLowerCase().includes(keyword)) {
      try {
        await client.pushMessage(process.env.YOUR_USER_ID, {
          type: 'text',
          text: `🚨 Urgent message detected from ${event.source.userId}:\n\n"${event.message.text}"`
        });
        console.log('Notification sent successfully');
      } catch (err) {
        console.error('Push message failed:', err);
      }
    }
  }

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get('/debug', (req, res) => {
    res.send('Send any message to your bot and check server logs for your user ID');
  });
const express = require('express');
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || 'YOUR_CHANNEL_ACCESS_TOKEN',
  channelSecret: process.env.CHANNEL_SECRET || 'YOUR_CHANNEL_SECRET'
};

const app = express();
const client = new line.Client(config);

// Your personal LINE user ID (who will receive notifications)
const YOUR_USER_ID = process.env.YOUR_USER_ID || 'YOUR_PERSONAL_LINE_USER_ID';

// Keyword to detect
const KEYWORD = 'urgent';

// Middleware to parse LINE messages
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(result => res.json(result))
    .catch(err => {
      console.error('Error:', err);
      res.status(500).end();
    });
});

// Root endpoint response
app.get('/', (req, res) => {
  res.send('LINE bot is running! Webhook is at POST /webhook');
});

async function handleEvent(event) {
  // Only process text messages
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  // Check if message contains keyword (case insensitive)
  if (event.message.text.toLowerCase().includes(KEYWORD)) {
    try {
      // Get sender's display name
      let senderName = 'Someone';
      if (event.source.userId) {
        const profile = await client.getProfile(event.source.userId);
        senderName = profile.displayName;
      }

      // Get group name if available
      let groupName = 'a group';
      if (event.source.type === 'group') {
        const group = await client.getGroupSummary(event.source.groupId);
        groupName = group.groupName || 'a group';
      }

      // Send notification to you
      await client.pushMessage(YOUR_USER_ID, {
        type: 'text',
        text: `⚠️ ${senderName} mentioned "${KEYWORD}" in ${groupName}:\n\n"${event.message.text}"`
      });

      console.log(`Sent notification about "${KEYWORD}" to admin`);
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  return null;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get('/debug', (req, res) => {
    res.send('Send any message to your bot and check server logs for your user ID');
  });
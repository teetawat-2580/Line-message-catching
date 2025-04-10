require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');

// LINE SDK Configuration
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const app = express();
const client = new line.Client(config);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'active',
    service: 'LINE Message Catcher',
    timestamp: new Date() 
  });
});

// Webhook Handler
app.post('/webhook', line.middleware(config), (req, res) => {
  // Immediate response to LINE server
  res.status(200).end();
  
  // Process all events
  Promise.all(req.body.events.map(handleEvent))
    .catch(err => console.error('Event processing error:', err));
});

// Event Handler
async function handleEvent(event) {
  try {
    // Only process text messages
    if (event.type !== 'message' || event.message.type !== 'text') {
      return null;
    }

    const keyword = 'urgent';
    const messageText = event.message.text.toLowerCase();

    // Check for keyword
    if (messageText.includes(keyword)) {
      let senderInfo = 'Someone';
      let locationInfo = 'a chat';

      // Get sender profile if available
      if (event.source.userId) {
        try {
          const profile = await client.getProfile(event.source.userId);
          senderInfo = profile.displayName;
        } catch (err) {
          console.log('Could not get user profile:', err.message);
          senderInfo = `User (${event.source.userId})`;
        }
      }

      // Get group info if in group
      if (event.source.type === 'group') {
        try {
          const group = await client.getGroupSummary(event.source.groupId);
          locationInfo = `group "${group.groupName}"`;
        } catch (err) {
          console.log('Could not get group info:', err.message);
          locationInfo = 'a group';
        }
      } else if (event.source.type === 'room') {
        locationInfo = 'a room';
      }

      // Send notification to admin
      await client.pushMessage(process.env.ADMIN_USER_ID, {
        type: 'text',
        text: `🚨 URGEENT ALERT!\n\nFrom: ${senderInfo}\nIn: ${locationInfo}\n\nMessage: "${event.message.text}"`
      });

      console.log(`Sent alert for keyword "${keyword}" to admin`);
    }
  } catch (err) {
    console.error('Error in handleEvent:', err);
  }
}

// Server Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Webhook URL: ${process.env.RENDER_EXTERNAL_URL || 'https://your-render-url.onrender.com'}/webhook`);
});
require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const crypto = require('crypto');

// Environment Verification
console.log('=== ENV VERIFICATION ===');
console.log('CHANNEL_ACCESS_TOKEN exists?', !!process.env.CHANNEL_ACCESS_TOKEN);
console.log('CHANNEL_SECRET length:', process.env.CHANNEL_SECRET?.length);
console.log('Webhook URL:', `${process.env.RENDER_EXTERNAL_URL || 'https://your-render-url.onrender.com'}/webhook`);

if (!process.env.CHANNEL_ACCESS_TOKEN || !process.env.CHANNEL_SECRET) {
  console.error('❌ Missing LINE configuration!');
  process.exit(1);
}

// LINE Configuration
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
  verify: true,
  channelAccessTokenExpirationMargin: 60000,
  channelSecretExpirationMargin: 60000
};

const app = express();
const client = new line.Client(config);

// Middleware Setup
app.set('trust proxy', true); // Important for Render/Cloudflare
app.use(express.raw({ type: 'application/json' })); // Must come first for webhook
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'active',
    service: 'LINE Message Catcher',
    timestamp: new Date() 
  });
});

// Debug Endpoints
app.get('/webhook-info', (req, res) => {
  res.json({
    expectedUrl: `${process.env.RENDER_EXTERNAL_URL}/webhook`,
    receivedUrl: `${req.headers['x-forwarded-proto']}://${req.headers.host}${req.url}`,
    timestamp: new Date()
  });
});

// Webhook Handler (Primary)
app.post('/webhook', 
  line.middleware(config),
  (req, res) => {
    console.log('✅ Received valid LINE webhook');
    res.status(200).end();
    
    // Process events asynchronously
    Promise.all(req.body.events.map(handleEvent))
      .catch(err => console.error('Event processing error:', err));
  },
  (err, req, res, next) => {
    if (err instanceof line.SignatureValidationFailed) {
      console.error('⚠️ Signature validation failed:', {
        receivedSignature: req.headers['x-line-signature'],
        computedSignature: crypto.createHmac('sha256', process.env.CHANNEL_SECRET)
          .update(JSON.stringify(req.body))
          .digest('base64'),
        body: req.body
      });
      return res.status(401).send('Invalid signature');
    }
    next(err);
  }
);

// Event Handler
async function handleEvent(event) {
  try {
    if (event.type !== 'message' || event.message.type !== 'text') return;

    if (event.message.text.toLowerCase().includes('urgent')) {
      let senderInfo = 'Someone';
      let locationInfo = 'a chat';

      // Get sender info
      if (event.source.userId) {
        try {
          const profile = await client.getProfile(event.source.userId);
          senderInfo = profile.displayName;
        } catch (err) {
          console.log('Could not get user profile:', err.message);
          senderInfo = `User (${event.source.userId})`;
        }
      }

      // Get location info
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

      await client.pushMessage(process.env.ADMIN_USER_ID, {
        type: 'text',
        text: `🚨 URGENT ALERT!\n\nFrom: ${senderInfo}\nIn: ${locationInfo}\n\nMessage: "${event.message.text}"`
      });

      console.log(`Sent alert for "urgent" to admin`);
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
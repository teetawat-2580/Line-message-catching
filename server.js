require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const crypto = require('crypto');

// ======================
// Environment Verification
// ======================
console.log('\n=== ENVIRONMENT VERIFICATION ===');
console.log('CHANNEL_ACCESS_TOKEN exists?', !!process.env.CHANNEL_ACCESS_TOKEN);
console.log('CHANNEL_SECRET length:', process.env.CHANNEL_SECRET?.length);
console.log('ADMIN_USER_ID exists?', !!process.env.ADMIN_USER_ID);
console.log('Webhook URL:', `${process.env.RENDER_EXTERNAL_URL}/webhook`);

if (!process.env.CHANNEL_ACCESS_TOKEN || !process.env.CHANNEL_SECRET) {
  console.error('\n❌ CRITICAL: Missing LINE configuration!');
  console.error('Please check your .env file or Render environment variables');
  process.exit(1);
}

// ======================
// LINE Configuration
// ======================
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
  verify: true
};

const app = express();
const client = new line.Client(config);

// ======================
// Middleware Setup
// ======================
app.set('trust proxy', 1); // Trust first proxy (Render/Cloudflare)
app.use('/webhook', express.raw({ type: 'application/json' })); // Critical for LINE webhook
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================
// Debug Endpoints
// ======================
app.get('/webhook-info', (req, res) => {
  res.json({
    status: 'debug',
    expectedWebhookUrl: `${process.env.RENDER_EXTERNAL_URL}/webhook`,
    channelSecretLength: process.env.CHANNEL_SECRET?.length,
    timestamp: new Date()
  });
});

// ======================
// Webhook Handler
// ======================
app.post('/webhook', 
  // Raw body parser MUST come first
  express.raw({ type: 'application/json' }), 
  
  // LINE middleware with error handling
  (req, res, next) => {
    try {
      // Convert buffer to string for verification
      req.bodyString = req.body.toString();
      return line.middleware(config)(req, res, next);
    } catch (err) {
      console.error('Middleware error:', err);
      return res.status(500).end();
    }
  },
  
  // Third: Main handler
  (req, res) => {
    try {
      const events = JSON.parse(req.bodyString).events;
      events.forEach(handleEvent);
      res.status(200).end();
    } catch (err) {
      console.error('Processing error:', err);
      res.status(400).end();
    }
  },
  
  // Fourth: Error handler
  (err, req, res, next) => {
    if (err instanceof line.SignatureValidationFailed) {
      const receivedBody = req.body.toString();
      const computedSig = crypto.createHmac('sha256', process.env.CHANNEL_SECRET)
        .update(receivedBody)
        .digest('base64');
      
      console.error('🔴 SIGNATURE VALIDATION FAILED', {
        receivedSignature: req.headers['x-line-signature'],
        computedSignature: computedSig,
        bodySample: receivedBody.substring(0, 100) + (receivedBody.length > 100 ? '...' : ''),
        timestamp: req.headers['x-line-request-timestamp']
      });
      return res.status(401).json({ error: 'Invalid signature' });
    }
    next(err);
  }
);

app.post('/verify-signature', express.raw({ type: 'application/json' }), (req, res) => {
  const crypto = require('crypto');
  const receivedSig = req.headers['x-line-signature'];
  const computedSig = crypto.createHmac('sha256', process.env.CHANNEL_SECRET)
    .update(req.body)
    .digest('base64');

  res.json({
    valid: receivedSig === computedSig,
    received: receivedSig,
    computed: computedSig,
    body: req.body.toString()
  });
});

// ======================
// Event Handler
// ======================
async function handleEvent(event) {
  try {
    if (event.type !== 'message' || event.message.type !== 'text') return;

    const keyword = 'urgent';
    if (event.message.text.toLowerCase().includes(keyword)) {
      const { userId, groupId, roomId } = event.source;
      
      // Get sender profile
      let sender = 'Unknown';
      try {
        const profile = await client.getProfile(userId);
        sender = profile.displayName;
      } catch (err) {
        console.log(`Couldn't get profile for ${userId}:`, err.message);
        sender = `User (${userId.substring(0, 6)}...)`;
      }

      // Get location context
      let location = 'private chat';
      if (groupId) {
        try {
          const group = await client.getGroupSummary(groupId);
          location = `group "${group.groupName}"`;
        } catch (err) {
          console.log(`Couldn't get group ${groupId}:`, err.message);
          location = 'a group';
        }
      } else if (roomId) {
        location = 'a room';
      }

      // Send notification
      await client.pushMessage(process.env.ADMIN_USER_ID, {
        type: 'text',
        text: `🚨 URGENT ALERT!\n\nFrom: ${sender}\nIn: ${location}\n\nMessage: "${event.message.text.substring(0, 100)}${event.message.text.length > 100 ? '...' : ''}"`
      });

      console.log(`⚠️ Sent urgent alert to admin`);
    }
  } catch (err) {
    console.error('Event handling failed:', err);
  }
}

// ======================
// Server Start
// ======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n=== SERVER STARTED ===');
  console.log(`Port: ${PORT}`);
  console.log(`Webhook: ${process.env.RENDER_EXTERNAL_URL}/webhook`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
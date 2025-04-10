require('dotenv').config();

// Add this right after dotenv config
console.log('Checking environment variables...');
console.log('CHANNEL_ACCESS_TOKEN exists?', !!process.env.CHANNEL_ACCESS_TOKEN);
console.log('CHANNEL_SECRET exists?', !!process.env.CHANNEL_SECRET);

// Add right after require('dotenv').config();
console.log('=== ENV VERIFICATION ===');
console.log('CHANNEL_SECRET length:', process.env.CHANNEL_SECRET?.length);
console.log('Webhook URL:', `${process.env.RENDER_EXTERNAL_URL}/webhook`);



// Crash immediately if missing credentials
if (!process.env.CHANNEL_ACCESS_TOKEN || !process.env.CHANNEL_SECRET) {
  console.error('❌ Missing LINE configuration!');
  console.error('   Create a .env file with:');
  console.error('   CHANNEL_ACCESS_TOKEN=your_token_here');
  console.error('   CHANNEL_SECRET=your_secret_here');
  process.exit(1);
}

// In your server.js, add this verification right after config:
console.log('Verifying LINE configuration...');
console.log('ChannelSecret length:', process.env.CHANNEL_SECRET?.length);
// Should show 32 for correct secret

const express = require('express');
const line = require('@line/bot-sdk');

// Replace your current config with:
const config = {
    channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.CHANNEL_SECRET,
    verify: true, // Ensure signature verification is enabled
    channelAccessTokenExpirationMargin: 60000, // 1 min buffer
    channelSecretExpirationMargin: 60000

  };

  

const app = express();
const client = new line.Client(config);

// Add this pre-middleware
app.use('/webhook', (req, res, next) => {
    console.log('Raw headers:', JSON.stringify(req.headers));
    console.log('Raw body:', JSON.stringify(req.body));
    next();
  });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add this right after your webhook handler
app.use((err, req, res, next) => {
    if (err instanceof line.SignatureValidationFailed) {
      console.error('⚠️ Signature validation failed:', err);
      res.status(401).send('Invalid signature');
      return;
    }
    next(err);
  });

// Health Check
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'active',
    service: 'LINE Message Catcher',
    timestamp: new Date() 
  });
});

// Add this route to verify exact webhook URL
app.get('/webhook-info', (req, res) => {
    res.json({
      expectedUrl: `${process.env.RENDER_EXTERNAL_URL}/webhook`,
      receivedUrl: req.headers['x-forwarded-proto'] + '://' + req.headers.host + req.url,
      timestamp: new Date()
    });
  });

// Add improved error handling
app.post('/webhook', 
    line.middleware(config),
    (req, res) => res.status(200).end(),
    (err, req, res, next) => {
      if (err instanceof line.SignatureValidationFailed) {
        console.error('Signature failed. Received:', {
          signature: req.headers['x-line-signature'],
          body: req.body,
          secret: process.env.CHANNEL_SECRET?.substring(0, 4) + '...'
        });
        return res.status(401).send('Invalid signature');
      }
      next(err);
    }
  );

  app.post('/webhook', 
    line.middleware(config),
    (req, res) => res.status(200).end(),
    (err, req, res, next) => {
      if (err instanceof line.SignatureValidationFailed) {
        const signature = crypto.createHmac('sha256', process.env.CHANNEL_SECRET)
          .update(JSON.stringify(req.body))
          .digest('base64');
        
        console.error('SIGNATURE MISMATCH', {
          expected: signature,
          received: req.headers['x-line-signature'],
          bodyHash: crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex'),
          timestamp: req.headers['x-line-request-timestamp']
        });
        return res.status(401).send('Invalid signature');
      }
      next(err);
    }
  );

// Webhook Handler
app.post('/webhook', line.middleware(config), (req, res) => {
  // Immediate response to LINE server
  res.status(200).end();
  
  // Process all events
  Promise.all(req.body.events.map(handleEvent))
    .catch(err => console.error('Event processing error:', err));
});

// Add this middleware before your webhook handler
app.use((req, res, next) => {
    console.log('Received headers:', {
      'x-line-signature': req.headers['x-line-signature'],
      'user-agent': req.headers['user-agent']
    });
    next();
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

// Add this right before app.listen()
app.post('/webhook-debug', line.middleware(config), (req, res) => {
    const userId = req.body.events[0]?.source?.userId;
    console.log('Your User ID is:', userId);
    res.status(200).json({ userId });
  });

  app.post('/webhook', (req, res) => {
    console.log('User ID:', req.body.events[0]?.source?.userId);
    res.status(200).end();
  });

app.post('/webhook', line.middleware(config), (req, res) => {
  console.log('✅ Received valid LINE webhook');
  res.status(200).end();
  
  req.body.events.forEach(event => {
    handleEvent(event).catch(err => {
      console.error('Event error:', err);
    });
  });
});

// Server Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Webhook URL: ${process.env.RENDER_EXTERNAL_URL || 'https://your-render-url.onrender.com'}/webhook`);
});


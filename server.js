const express = require('express');
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: 'mA0rWiMLedQTLc59iUQcWPhWP8IPXTuUdpxcvZ+jImmpEy8xCAvTgdZ8QA3UmeukFNRavYksehZTN4khL7bIKx96+JUSbl+3P2+OdxbkR2XlMClgpMZLEPZj43avUWGKJ2ZYpFoiIRMcWRk4BXLQIwdB04t89/1O/w1cDnyilFU=',
  channelSecret: 'd450ca69419c0a453639cc000c9ff7fc'
};

const app = express();
const client = new line.Client(config);

app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(result => res.json(result))
    .catch(err => {
      console.error(err);
      res.status(500).end();
    });
});

function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const keyword = 'urgent'; // 🔑 your keyword here
  if (event.message.text.toLowerCase().includes(keyword)) {
    return client.pushMessage('2007231180', {
      type: 'text',
      text: `⚠️ Keyword "${keyword}" detected in group message!`
    });
  }

  return Promise.resolve(null);
}

app.listen(3000, () => {
  console.log('Server is running...');
});

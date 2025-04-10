const express = require('express');
const app = express();

// Critical middleware
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.status(200).send('Server is running');
});

// Simplified webhook handler
app.post('/webhook', (req, res) => {
  console.log('Webhook received:', req.body);
  res.status(200).send('OK'); // Immediate response
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server ready at port ${PORT}`);
});
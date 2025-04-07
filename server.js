require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const webhook = require('./routes/webhook'); // arquivo de rota

const app = express();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

// 👇 URL que o Twilio já está usando
app.use('/whatsapp-webhook', webhook);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

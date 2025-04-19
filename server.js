require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const conectarMongo = require('./config/mongo'); // conexão com MongoDB
const webhook = require('./routes/webhook');     // rota do bot

const app = express();

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

// 👇 Rota usada pelo Twilio
app.use('/whatsapp-webhook', webhook);

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    //await conectarMongo();
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
})

();

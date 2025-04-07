require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const webhook = require('./routes/webhook');

const app = express();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/webhook', webhook);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

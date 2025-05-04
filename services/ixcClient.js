const axios = require('axios');
const https = require('https');
const { getConfig } = require('../config/config');
require('dotenv').config();

// Retrieve IXC configuration
const ixcConfig = getConfig().ixc;

if (!ixcConfig || !ixcConfig.baseURL || !ixcConfig.token) {
  console.error('ERRO: Configuração da API IXC (baseURL, token) não encontrada em config/config.js ou .env');
  // Throwing an error might be better to halt execution if config is missing
  // throw new Error('Configuração da API IXC ausente.');
}

// Configure HTTPS agent (allow self-signed certificates if needed for dev)
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ? false : true // More standard env var
});

// Create Axios instance for IXC API
const ixcApiClient = axios.create({
  baseURL: ixcConfig.baseURL,
  httpsAgent: httpsAgent,
  headers: {
    'Content-Type': 'application/json', // Default, can be overridden
    Authorization: `Basic ${Buffer.from(ixcConfig.token + ':').toString('base64')}`
  },
  timeout: ixcConfig.timeout || 30000 // 30 seconds default timeout
});

// Optional: Add interceptors for logging or specific error handling
ixcApiClient.interceptors.request.use(request => {
  // console.log('Starting IXC Request:', request.method.toUpperCase(), request.url);
  // console.log('Request Headers:', request.headers);
  // console.log('Request Data:', request.data);
  return request;
});

ixcApiClient.interceptors.response.use(response => {
  // console.log('IXC Response Status:', response.status);
  // console.log('Response Data:', response.data);
  return response;
}, error => {
  console.error('IXC API Request Error:', error.message);
  if (error.response) {
    console.error('Error Response Status:', error.response.status);
    console.error('Error Response Data:', error.response.data);
  } else if (error.request) {
    console.error('Error Request Data:', error.request);
  } else {
    console.error('Error Details:', error);
  }
  // It's important to reject the promise so the calling function knows there was an error
  return Promise.reject(error);
});

module.exports = ixcApiClient;

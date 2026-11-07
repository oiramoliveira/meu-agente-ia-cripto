// Lojinha x402 - VERSAO 1, igual do agente
const express = require('express');
const { paymentMiddleware } = require('x402-express');

const app = express();

// Carteira ANTIGA que vai RECEBER - a vendedora
const SELLER_ADDRESS = '0xA91cba0eB1750e4dec6C86c9dE977D522d267B56';

// Catraca v1: cobra 0.01 USDC na Base Sepolia
app.use(paymentMiddleware(
  SELLER_ADDRESS,
  {
    "GET /protected": {
      price: "$0.01",
      network: "base-sepolia"
    }
  },
  {
    url: "https://x402.org/facilitator"
  }
));

app.get('/protected', (req, res) => {
  res.json({
    mensagem: "Parabens! Voce pagou 0.01 USDC e ganhou esse dado!",
    dado: "O preco do Bitcoin hoje e 100000 (dado de teste)"
  });
});

app.listen(3000, () => {
  console.log('Lojinha x402 v1 rodando em http://localhost:3000/protected');
});
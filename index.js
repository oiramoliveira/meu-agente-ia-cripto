require('dotenv').config();
const { createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { baseSepolia } = require('viem/chains');
const { wrapFetchWithPayment } = require('x402-fetch');

async function main() {
  console.log('1. Ligando carteira de teste...');
  const account = privateKeyToAccount(process.env.PRIVATE_KEY);
  console.log('Carteira:', account.address);

  const client = createWalletClient({
    account: account,
    chain: baseSepolia,
    transport: http(process.env.RPC_URL)
  });

  const fetchQuePaga = wrapFetchWithPayment(fetch, client);

  console.log('2. Perguntando pro phi3:mini...');
  const respostaOllama = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      model: 'phi3:mini',
      prompt: 'Me de uma frase curta sobre por que agentes de IA devem pagar por dados.',
      stream: false
    })
  });
  const dadosOllama = await respostaOllama.json();
  console.log('phi3 disse:', dadosOllama.response);

  console.log('3. Tentando recurso pago com x402...');
 
  const urlPaga = 'http://localhost:3000/protected';
  try {
    const respostaPaga = await fetchQuePaga(urlPaga);
    console.log('Status:', respostaPaga.status);
    const texto = await respostaPaga.text();
    console.log('Resposta:', texto.slice(0, 500));
  } catch (e) {
    console.log('Erro no recurso pago, mas o agente rodou:', e.message);
  }
  console.log('FIM!');
}
main();
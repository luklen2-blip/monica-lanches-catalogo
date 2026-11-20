/**
 * Suíte de Testes Automatizados Locais - Mônica Lanches
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('../server');
const { gerarPixCopiaECola, calculateCRC16 } = require('../pix');

console.log('🧪 [TESTES LOCAIS] Iniciando validação do projeto Mônica Lanches...\n');

let passedTests = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    process.exit(1);
  }
}

// 1. Validação dos Dados do Cardápio
test('Validação de integridade do cardapio.json', () => {
  const filePath = path.join(__dirname, '..', 'data', 'cardapio.json');
  assert(fs.existsSync(filePath), 'cardapio.json deve existir');
  const cardapio = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.strictEqual(cardapio.loja.nome, 'Mônica Lanches');
  assert(cardapio.categorias.length >= 4, 'Deve conter pelo menos 4 categorias');
  
  // Validar se contém picolés, salgados e sacolé
  const catIds = cardapio.categorias.map(c => c.id);
  assert(catIds.includes('picoles'), 'Deve conter categoria picoles');
  assert(catIds.includes('sacole'), 'Deve conter categoria sacole');
  assert(catIds.includes('salgados'), 'Deve conter categoria salgados');
});

// 2. Validação do Módulo de PIX EMV e CRC16
test('Geração de PIX EMV oficial com CRC16 válido', () => {
  const pix = gerarPixCopiaECola({
    chave: '997119170',
    nome: 'MONICA LANCHES',
    cidade: 'SAO PAULO',
    valor: 25.50
  });

  assert(pix.payload.startsWith('000201'), 'Payload deve iniciar com 000201');
  assert(pix.payload.includes('br.gov.bcb.pix'), 'Payload deve conter GUI do Bacen');
  assert(pix.payload.includes('997119170'), 'Payload deve conter a chave PIX');
  assert.strictEqual(pix.valor, '25.50');

  // Teste de cálculo de CRC16
  const payloadSemCRC = pix.payload.substring(0, pix.payload.length - 4);
  const crcCalculado = calculateCRC16(payloadSemCRC);
  const crcOriginal = pix.payload.substring(pix.payload.length - 4);
  assert.strictEqual(crcCalculado, crcOriginal, 'CRC16 deve coincidir exatamente');
});

// 3. Validação dos Endpoints HTTP no Servidor Express
test('Inicialização do servidor HTTP e teste dos endpoints', (done) => {
  const server = app.listen(0, async () => {
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    function request(urlPath, method = 'GET', postData = null) {
      return new Promise((resolve, reject) => {
        const u = new URL(urlPath, baseUrl);
        const options = {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname,
          method: method,
          headers: {}
        };

        if (postData) {
          options.headers['Content-Type'] = 'application/json';
        }

        const req = http.request(options, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body }));
        });

        req.on('error', reject);
        if (postData) req.write(JSON.stringify(postData));
        req.end();
      });
    }

    try {
      // Teste /api/health
      const resHealth = await request('/api/health');
      assert.strictEqual(resHealth.status, 200);
      const healthData = JSON.parse(resHealth.body);
      assert.strictEqual(healthData.status, 'ok');
      assert(healthData.app.includes('Mônica Lanches'));
      assert.strictEqual(healthData.version, '2.0.0');
      assert(typeof healthData.uptime_seconds === 'number');

      // Teste /api/cardapio
      const resCardapio = await request('/api/cardapio');
      assert.strictEqual(resCardapio.status, 200);
      const cardapioData = JSON.parse(resCardapio.body);
      assert.strictEqual(cardapioData.loja.nome, 'Mônica Lanches');

      // Teste /api/pix
      const resPix = await request('/api/pix', 'POST', { valor: 15.00 });
      assert.strictEqual(resPix.status, 200);
      const pixData = JSON.parse(resPix.body);
      assert.strictEqual(pixData.ok, true);
      assert(pixData.payload.startsWith('000201'));

      // Teste página inicial (HTML)
      const resIndex = await request('/');
      assert.strictEqual(resIndex.status, 200);
      assert(resIndex.body.includes('MÔNICA LANCHES'));

      // Teste páginas legais
      const resTermos = await request('/termos');
      assert.strictEqual(resTermos.status, 200);
      const resPriv = await request('/privacidade');
      assert.strictEqual(resPriv.status, 200);

      server.close(() => {
        console.log(`\n🎉 Todos os ${passedTests + 1} testes passaram com 100% de sucesso!`);
      });
    } catch (err) {
      server.close();
      console.error(`Erro no teste HTTP: ${err.message}`);
      process.exit(1);
    }
  });
});

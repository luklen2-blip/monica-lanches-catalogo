const express = require('express');
const path = require('path');
const fs = require('fs');
const { gerarPixCopiaECola } = require('./pix');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Resolução universal de estáticos (public/ e raiz)
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}
app.use(express.static(__dirname));

// Carregar dados do cardápio
const cardapioPath = path.join(__dirname, 'data', 'cardapio.json');
function getCardapio() {
  try {
    const raw = fs.readFileSync(cardapioPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao ler cardapio.json:', err.message);
    return { loja: { nome: 'Mônica Lanches' }, categorias: [] };
  }
}

// 1. Endpoint Obrigatório de Monitoramento 24/7 (/api/health)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    app: 'Mônica Lanches - Catálogo Digital',
    version: '2.0.0',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// 2. Rota da API do Cardápio
app.get('/api/cardapio', (req, res) => {
  res.json(getCardapio());
});

// 3. Rota de Geração de PIX Nativo (EMV Banco Central)
app.post('/api/pix', (req, res) => {
  try {
    const { valor } = req.body;
    const cardapio = getCardapio();
    const pixData = gerarPixCopiaECola({
      chave: cardapio.loja.chave_pix,
      nome: cardapio.loja.titular_pix || 'Monica Lanches',
      cidade: cardapio.loja.cidade_pix || 'SAO PAULO',
      valor: valor || 0
    });
    res.json({ ok: true, ...pixData });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Rotas legais (LGPD & Termos)
app.get('/termos', (req, res) => {
  const file = path.join(publicDir, 'termos.html');
  if (fs.existsSync(file)) return res.sendFile(file);
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/privacidade', (req, res) => {
  const file = path.join(publicDir, 'privacidade.html');
  if (fs.existsSync(file)) return res.sendFile(file);
  res.sendFile(path.join(publicDir, 'index.html'));
});

// SPA Fallback Universal
app.get('*', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(404).send('Mônica Lanches - Catálogo em Inicialização');
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 [Mônica Lanches] Servidor 24/7 rodando na porta ${PORT}`);
    console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📱 Cardápio Digital: http://localhost:${PORT}`);
  });
}

module.exports = app;

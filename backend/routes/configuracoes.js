// Rotas de configurações do sistema
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { autenticar, apenasAdmin } = require('../middleware/auth');
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

const prisma = new PrismaClient();

router.use(autenticar);

// GET /api/configuracoes - Listar todas as configurações
router.get('/', async (req, res, next) => {
  try {
    const configs = await prisma.configuracao.findMany({ where: { contaId: req.usuario.contaId } });
    // Transformar em objeto chave-valor
    const resultado = {};
    configs.forEach((c) => { resultado[c.chave] = c.valor; });
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

// PUT /api/configuracoes - Atualizar configurações (recebe objeto chave-valor)
router.put('/', async (req, res, next) => {
  try {
    const configs = req.body;
    const contaId = req.usuario.contaId;

    for (const [chave, valor] of Object.entries(configs)) {
      const existente = await prisma.configuracao.findFirst({ where: { chave, contaId } });
      if (existente) {
        await prisma.configuracao.update({ where: { id: existente.id }, data: { valor: String(valor) } });
      } else {
        await prisma.configuracao.create({ data: { chave, contaId, valor: String(valor) } });
      }
    }

    res.json({ mensagem: 'Configurações atualizadas' });
  } catch (err) {
    next(err);
  }
});

// GET /api/configuracoes/proxy/test - Testa o proxy configurado
router.get('/proxy/test', async (req, res) => {
  try {
    const config = await prisma.configuracao.findFirst({
      where: { chave: 'proxy_url', contaId: req.usuario.contaId },
    });
    if (!config?.valor) return res.json({ ok: false, erro: 'Nenhum proxy configurado' });

    const proxyUrlStr = config.valor;
    const isSocks = proxyUrlStr.startsWith('socks');
    let resp;

    if (isSocks) {
      const agent = new SocksProxyAgent(proxyUrlStr);
      resp = await axios.get('http://ip-api.com/json', { httpAgent: agent, httpsAgent: agent, proxy: false, timeout: 10000 });
    } else {
      const proxyUrl = new URL(proxyUrlStr);
      const proxyConfig = {
        protocol: proxyUrl.protocol,
        host: proxyUrl.hostname,
        port: parseInt(proxyUrl.port) || 80,
      };
      if (proxyUrl.username) {
        proxyConfig.auth = { username: decodeURIComponent(proxyUrl.username), password: decodeURIComponent(proxyUrl.password) };
      }
      resp = await axios.get('http://ip-api.com/json', { proxy: proxyConfig, timeout: 10000 });
    }

    const d = resp.data;
    res.json({ ok: true, ip: d.query, country: d.country, city: d.city, org: d.isp });
  } catch (err) {
    res.json({ ok: false, erro: err.message });
  }
});

// POST /api/configuracoes/testar-tiktok - Envia evento de teste para TikTok Events API
router.post('/testar-tiktok', async (req, res) => {
  const { pixelId, token } = req.body;
  if (!pixelId || !token) return res.status(400).json({ erro: 'pixelId e token são obrigatórios' });
  try {
    const { dispararPurchaseTikTok } = require('../services/tiktokConversions');
    await dispararPurchaseTikTok({
      pixelId,
      accessToken: token,
      telefone: '5511999999999',
      valor: 1.00,
      eventId: `teste_${Date.now()}`,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /api/configuracoes/testar-meta - Envia evento de teste para Meta Conversions API
router.post('/testar-meta', async (req, res) => {
  const { pixelId, token } = req.body;
  if (!pixelId || !token) return res.status(400).json({ erro: 'pixelId e token são obrigatórios' });
  try {
    const { dispararPurchaseMeta } = require('../services/metaConversions');
    await dispararPurchaseMeta({
      pixelId,
      accessToken: token,
      telefone: '5511999999999', // número fictício para teste
      valor: 1.00,
      eventId: `teste_${Date.now()}`,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;

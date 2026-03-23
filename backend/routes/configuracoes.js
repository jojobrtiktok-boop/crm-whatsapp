// Rotas de configurações do sistema
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { autenticar, apenasAdmin } = require('../middleware/auth');
const axios = require('axios');

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

    const proxyUrl = new URL(config.valor);
    const proxyConfig = {
      protocol: proxyUrl.protocol,
      host: proxyUrl.hostname,
      port: parseInt(proxyUrl.port) || 80,
    };
    if (proxyUrl.username) {
      proxyConfig.auth = {
        username: decodeURIComponent(proxyUrl.username),
        password: decodeURIComponent(proxyUrl.password),
      };
    }

    // Testa com HTTP puro (mais compatível com proxies 4G)
    const resp = await axios.get('http://ip-api.com/json', { proxy: proxyConfig, timeout: 10000 });
    const d = resp.data;
    res.json({ ok: true, ip: d.query, country: d.country, city: d.city, org: d.isp });
  } catch (err) {
    res.json({ ok: false, erro: err.message });
  }
});

module.exports = router;

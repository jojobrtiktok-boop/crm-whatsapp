// Rotas de configurações do sistema
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { autenticar, apenasAdmin } = require('../middleware/auth');

const prisma = new PrismaClient();

router.use(autenticar);

// GET /api/configuracoes - Listar todas as configurações
router.get('/', async (req, res, next) => {
  try {
    const configs = await prisma.configuracao.findMany();
    // Transformar em objeto chave-valor
    const resultado = {};
    configs.forEach((c) => { resultado[c.chave] = c.valor; });
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

// PUT /api/configuracoes - Atualizar configurações (recebe objeto chave-valor)
router.put('/', apenasAdmin, async (req, res, next) => {
  try {
    const configs = req.body;

    for (const [chave, valor] of Object.entries(configs)) {
      await prisma.configuracao.upsert({
        where: { chave },
        update: { valor: String(valor) },
        create: { chave, valor: String(valor) },
      });
    }

    res.json({ mensagem: 'Configurações atualizadas' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

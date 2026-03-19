// Rotas de configurações do sistema
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { autenticar, apenasAdmin } = require('../middleware/auth');

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
      await prisma.configuracao.upsert({
        where: { chave_contaId: { chave, contaId } },
        update: { valor: String(valor) },
        create: { chave, contaId, valor: String(valor) },
      });
    }

    res.json({ mensagem: 'Configurações atualizadas' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

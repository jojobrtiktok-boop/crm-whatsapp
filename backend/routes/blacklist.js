// Rotas de blacklist (números bloqueados)
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { autenticar } = require('../middleware/auth');

const prisma = new PrismaClient();

router.use(autenticar);

// GET /api/blacklist - Listar números bloqueados
router.get('/', async (req, res, next) => {
  try {
    const lista = await prisma.blacklist.findMany({
      orderBy: { criadoEm: 'desc' },
    });
    res.json(lista);
  } catch (err) {
    next(err);
  }
});

// POST /api/blacklist - Adicionar número à blacklist
router.post('/', async (req, res, next) => {
  try {
    const { telefone, motivo } = req.body;

    if (!telefone) {
      return res.status(400).json({ erro: 'Telefone é obrigatório' });
    }

    const item = await prisma.blacklist.create({
      data: { telefone: telefone.replace(/\D/g, ''), motivo },
    });

    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/blacklist/:id - Remover da blacklist
router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.blacklist.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.json({ mensagem: 'Número removido da blacklist' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

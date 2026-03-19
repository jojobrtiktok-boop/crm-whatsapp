// Rotas de atendimento humano
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { autenticar } = require('../middleware/auth');

const prisma = new PrismaClient();

router.use(autenticar);

// GET /api/atendimento - Listar atendimentos
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const atendimentos = await prisma.atendimento.findMany({
      where,
      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
            telefone: true,
            status: true,
            chipOrigemId: true,
            chipOrigem: { select: { id: true, nome: true, numero: true } },
          },
        },
      },
      orderBy: { criadoEm: 'desc' },
    });

    res.json(atendimentos);
  } catch (err) {
    next(err);
  }
});

// POST /api/atendimento - Criar atendimento (transferência do bot)
router.post('/', async (req, res, next) => {
  try {
    const { clienteId } = req.body;

    if (!clienteId) {
      return res.status(400).json({ erro: 'ID do cliente é obrigatório' });
    }

    const atendimento = await prisma.atendimento.create({
      data: { clienteId: parseInt(clienteId) },
      include: {
        cliente: { select: { id: true, nome: true, telefone: true } },
      },
    });

    // Notificar operadores via WebSocket
    const io = req.app.get('io');
    if (io) io.emit('atendimento:novo', atendimento);

    res.status(201).json(atendimento);
  } catch (err) {
    next(err);
  }
});

// PUT /api/atendimento/:id/assumir - Operador assume atendimento
router.put('/:id/assumir', async (req, res, next) => {
  try {
    const atendimento = await prisma.atendimento.update({
      where: { id: parseInt(req.params.id) },
      data: {
        operadorId: req.usuario.id,
        status: 'em_atendimento',
      },
      include: {
        cliente: { select: { id: true, nome: true, telefone: true } },
      },
    });

    res.json(atendimento);
  } catch (err) {
    next(err);
  }
});

// PUT /api/atendimento/:id/finalizar - Finalizar atendimento
router.put('/:id/finalizar', async (req, res, next) => {
  try {
    const atendimento = await prisma.atendimento.update({
      where: { id: parseInt(req.params.id) },
      data: {
        status: 'finalizado',
        finalizadoEm: new Date(),
      },
    });

    res.json(atendimento);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

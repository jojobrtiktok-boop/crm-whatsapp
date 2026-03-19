// Rotas de atendimento humano
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { autenticar } = require('../middleware/auth');

const prisma = new PrismaClient();

router.use(autenticar);

// GET /api/atendimento - Inbox: todos os leads com conversas
router.get('/', async (req, res, next) => {
  try {
    const leads = await prisma.cliente.findMany({
      where: {
        contaId: req.usuario.contaId,
        conversas: { some: {} },
      },
      include: {
        chipOrigem: { select: { id: true, nome: true, numero: true } },
        conversas: {
          orderBy: { criadoEm: 'desc' },
          take: 1,
          select: { conteudo: true, criadoEm: true, tipo: true, tipoMidia: true },
        },
        atendimentos: {
          where: { status: { not: 'finalizado' } },
          take: 1,
          select: { id: true, status: true },
        },
        execucoes: {
          where: { status: 'ativo' },
          take: 1,
          select: { id: true },
        },
      },
      orderBy: { atualizadoEm: 'desc' },
    });

    const resultado = leads.map((l) => ({
      id: l.id,
      nome: l.nome,
      telefone: l.telefone,
      chipOrigem: l.chipOrigem,
      chipOrigemId: l.chipOrigemId,
      ultimaMensagem: l.conversas[0] || null,
      atendimento: l.atendimentos[0] || null,
      emFunil: l.execucoes.length > 0,
    }));

    // Ordenar por ultima mensagem mais recente
    resultado.sort((a, b) => {
      const ta = a.ultimaMensagem?.criadoEm ? new Date(a.ultimaMensagem.criadoEm) : new Date(0);
      const tb = b.ultimaMensagem?.criadoEm ? new Date(b.ultimaMensagem.criadoEm) : new Date(0);
      return tb - ta;
    });

    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

// GET /api/atendimento/pagos - Clientes com pagamento confirmado pela IA
router.get('/pagos', async (req, res, next) => {
  try {
    const clientes = await prisma.cliente.findMany({
      where: {
        contaId: req.usuario.contaId,
        comprovantes: { some: { status: 'confirmado' } },
      },
      include: {
        chipOrigem: { select: { id: true, nome: true, numero: true } },
        comprovantes: {
          where: { status: 'confirmado' },
          orderBy: { criadoEm: 'desc' },
          take: 1,
          select: { id: true, valorExtraido: true, criadoEm: true, banco: true, tipoTransferencia: true },
        },
        conversas: {
          orderBy: { criadoEm: 'desc' },
          take: 1,
          select: { conteudo: true, criadoEm: true, tipo: true, tipoMidia: true },
        },
        atendimentos: {
          where: { status: { not: 'finalizado' } },
          take: 1,
          select: { id: true, status: true },
        },
        execucoes: {
          where: { status: 'ativo' },
          take: 1,
          select: { id: true },
        },
      },
      orderBy: { atualizadoEm: 'desc' },
    });

    const resultado = clientes.map((l) => ({
      id: l.id,
      nome: l.nome,
      telefone: l.telefone,
      chipOrigem: l.chipOrigem,
      chipOrigemId: l.chipOrigemId,
      ultimaMensagem: l.conversas[0] || null,
      ultimoComprovante: l.comprovantes[0] || null,
      atendimento: l.atendimentos[0] || null,
      emFunil: l.execucoes.length > 0,
    }));

    res.json(resultado);
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

// Rotas de gestão de funis de automação
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { autenticar } = require('../middleware/auth');

const prisma = new PrismaClient();

router.use(autenticar);

// GET /api/funis - Listar todos os funis
router.get('/', async (req, res, next) => {
  try {
    const funis = await prisma.funil.findMany({
      where: { contaId: req.usuario.contaId },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        nome: true,
        descricao: true,
        ativo: true,
        criadoEm: true,
        atualizadoEm: true,
        _count: { select: { execucoes: true } },
      },
    });
    res.json(funis);
  } catch (err) {
    next(err);
  }
});

// GET /api/funis/:id - Detalhe do funil (com blocos e conexões)
router.get('/:id', async (req, res, next) => {
  try {
    const funil = await prisma.funil.findFirst({
      where: { id: parseInt(req.params.id), contaId: req.usuario.contaId },
    });

    if (!funil) {
      return res.status(404).json({ erro: 'Funil não encontrado' });
    }

    res.json(funil);
  } catch (err) {
    next(err);
  }
});

// POST /api/funis - Criar funil
router.post('/', async (req, res, next) => {
  try {
    const { nome, descricao, blocos, conexoes } = req.body;

    if (!nome) {
      return res.status(400).json({ erro: 'Nome é obrigatório' });
    }

    const funil = await prisma.funil.create({
      data: {
        nome,
        descricao,
        blocos: blocos || [],
        conexoes: conexoes || [],
        contaId: req.usuario.contaId,
      },
    });

    res.status(201).json(funil);
  } catch (err) {
    next(err);
  }
});

// PUT /api/funis/:id - Atualizar funil (blocos e conexões)
router.put('/:id', async (req, res, next) => {
  try {
    const { nome, descricao, blocos, conexoes } = req.body;
    const funilId = parseInt(req.params.id);
    const existe = await prisma.funil.findFirst({ where: { id: funilId, contaId: req.usuario.contaId } });
    if (!existe) {
      return res.status(404).json({ erro: 'Funil não encontrado' });
    }
    const funil = await prisma.funil.update({
      where: { id: funilId },
      data: { nome, descricao, blocos, conexoes },
    });
    res.json(funil);
  } catch (err) {
    next(err);
  }
});

// PUT /api/funis/:id/toggle - Ativar/desativar funil
router.put('/:id/toggle', async (req, res, next) => {
  try {
    const funil = await prisma.funil.findFirst({
      where: { id: parseInt(req.params.id), contaId: req.usuario.contaId },
    });

    if (!funil) {
      return res.status(404).json({ erro: 'Funil não encontrado' });
    }

    const atualizado = await prisma.funil.update({
      where: { id: funil.id },
      data: { ativo: !funil.ativo },
    });

    res.json(atualizado);
  } catch (err) {
    next(err);
  }
});

// POST /api/funis/:id/duplicar - Duplicar funil
router.post('/:id/duplicar', async (req, res, next) => {
  try {
    const original = await prisma.funil.findFirst({
      where: { id: parseInt(req.params.id), contaId: req.usuario.contaId },
    });

    if (!original) {
      return res.status(404).json({ erro: 'Funil não encontrado' });
    }

    const duplicado = await prisma.funil.create({
      data: {
        nome: `${original.nome} (cópia)`,
        descricao: original.descricao,
        blocos: original.blocos,
        conexoes: original.conexoes,
        ativo: false,
        contaId: req.usuario.contaId,
      },
    });

    res.status(201).json(duplicado);
  } catch (err) {
    next(err);
  }
});

// POST /api/funis/executar - Executar funil manualmente para um cliente
router.post('/executar', async (req, res, next) => {
  try {
    const { funilId, clienteId, chipId } = req.body;

    if (!funilId || !clienteId || !chipId) {
      return res.status(400).json({ erro: 'funilId, clienteId e chipId sao obrigatorios' });
    }

    const funil = await prisma.funil.findUnique({ where: { id: funilId } });
    if (!funil) {
      return res.status(404).json({ erro: 'Funil nao encontrado' });
    }

    const funilEngine = require('../services/funilEngine');
    const execucao = await funilEngine.iniciarFunil(clienteId, chipId, req.usuario.contaId, funilId);

    res.status(201).json({ mensagem: 'Funil ativado', execucao });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/funis/:id - Deletar funil
router.delete('/:id', async (req, res, next) => {
  try {
    const funilId = parseInt(req.params.id);
    const existe = await prisma.funil.findFirst({ where: { id: funilId, contaId: req.usuario.contaId } });
    if (!existe) {
      return res.status(404).json({ erro: 'Funil não encontrado' });
    }

    // Primeiro remove execuções associadas
    await prisma.funilExecucao.deleteMany({
      where: { funilId },
    });

    await prisma.funil.delete({
      where: { id: funilId },
    });

    res.json({ mensagem: 'Funil removido' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

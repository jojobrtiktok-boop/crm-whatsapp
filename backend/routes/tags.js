// Rotas de gestão de tags
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { autenticar } = require('../middleware/auth');

const prisma = new PrismaClient();

router.use(autenticar);

// GET /api/tags - Listar todas as tags
router.get('/', async (req, res, next) => {
  try {
    const tags = await prisma.tag.findMany({
      where: { contaId: req.usuario.contaId },
      include: { _count: { select: { clientes: true } } },
      orderBy: { nome: 'asc' },
    });
    res.json(tags);
  } catch (err) {
    next(err);
  }
});

// POST /api/tags - Criar tag
router.post('/', async (req, res, next) => {
  try {
    const { nome, cor } = req.body;
    if (!nome) {
      return res.status(400).json({ erro: 'Nome é obrigatório' });
    }

    const tag = await prisma.tag.create({ data: { nome, cor, contaId: req.usuario.contaId } });
    res.status(201).json(tag);
  } catch (err) {
    next(err);
  }
});

// PUT /api/tags/:id - Atualizar tag
router.put('/:id', async (req, res, next) => {
  try {
    const { nome, cor } = req.body;
    const tagId = parseInt(req.params.id);
    const existe = await prisma.tag.findFirst({ where: { id: tagId, contaId: req.usuario.contaId } });
    if (!existe) {
      return res.status(404).json({ erro: 'Tag não encontrada' });
    }
    const tag = await prisma.tag.update({
      where: { id: tagId },
      data: { nome, cor },
    });
    res.json(tag);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tags/:id - Deletar tag
router.delete('/:id', async (req, res, next) => {
  try {
    const tagId = parseInt(req.params.id);
    const existe = await prisma.tag.findFirst({ where: { id: tagId, contaId: req.usuario.contaId } });
    if (!existe) {
      return res.status(404).json({ erro: 'Tag não encontrada' });
    }
    await prisma.tag.delete({ where: { id: tagId } });
    res.json({ mensagem: 'Tag removida' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

// Rotas de gestão de usuários
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { autenticar, apenasAdmin } = require('../middleware/auth');

const prisma = new PrismaClient();

router.use(autenticar);
router.use(apenasAdmin);

// GET /api/usuarios - Listar usuários
router.get('/', async (req, res, next) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: { id: true, nome: true, email: true, role: true, ativo: true, criadoEm: true },
      orderBy: { criadoEm: 'desc' },
    });
    res.json(usuarios);
  } catch (err) {
    next(err);
  }
});

// POST /api/usuarios - Criar usuário
router.post('/', async (req, res, next) => {
  try {
    const { nome, email, senha, role } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = await prisma.usuario.create({
      data: { nome, email, senha: senhaHash, role: role || 'operador' },
      select: { id: true, nome: true, email: true, role: true, criadoEm: true },
    });

    res.status(201).json(usuario);
  } catch (err) {
    next(err);
  }
});

// PUT /api/usuarios/:id - Atualizar usuário
router.put('/:id', async (req, res, next) => {
  try {
    const { nome, email, senha, role, ativo } = req.body;
    const data = { nome, email, role, ativo };

    if (senha) {
      data.senha = await bcrypt.hash(senha, 10);
    }

    const usuario = await prisma.usuario.update({
      where: { id: parseInt(req.params.id) },
      data,
      select: { id: true, nome: true, email: true, role: true, ativo: true },
    });

    res.json(usuario);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/usuarios/:id - Desativar usuário
router.delete('/:id', async (req, res, next) => {
  try {
    if (parseInt(req.params.id) === req.usuario.id) {
      return res.status(400).json({ erro: 'Você não pode desativar a si mesmo' });
    }

    await prisma.usuario.update({
      where: { id: parseInt(req.params.id) },
      data: { ativo: false },
    });

    res.json({ mensagem: 'Usuário desativado' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

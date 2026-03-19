// Rotas de autenticação (login e registro)
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { autenticar } = require('../middleware/auth');

const prisma = new PrismaClient();

// POST /api/auth/login - Fazer login
router.post('/login', async (req, res, next) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    if (!usuario.ativo) {
      return res.status(403).json({ erro: 'Usuário desativado' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/registro - Registrar novo usuário (apenas admin)
router.post('/registro', autenticar, async (req, res, next) => {
  try {
    if (req.usuario.role !== 'admin') {
      return res.status(403).json({ erro: 'Apenas administradores podem criar usuários' });
    }

    const { nome, email, senha, role } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: senhaHash,
        role: role || 'operador',
      },
      select: { id: true, nome: true, email: true, role: true, criadoEm: true },
    });

    res.status(201).json(usuario);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me - Dados do usuário autenticado
router.get('/me', autenticar, async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: { id: true, nome: true, email: true, role: true, criadoEm: true },
    });

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    res.json(usuario);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

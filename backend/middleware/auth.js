// Middleware de autenticação JWT
const jwt = require('jsonwebtoken');
const config = require('../config');

// Verifica se o token JWT é válido
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ erro: 'Token não fornecido' });
  }

  const partes = authHeader.split(' ');
  if (partes.length !== 2 || partes[0] !== 'Bearer') {
    return res.status(401).json({ erro: 'Formato de token inválido' });
  }

  const token = partes[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.usuario = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

// Verifica se o usuário é admin
function apenasAdmin(req, res, next) {
  if (req.usuario.role !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores' });
  }
  next();
}

module.exports = { autenticar, apenasAdmin };

// Middleware de tratamento global de erros
function errorHandler(err, req, res, next) {
  console.error('Erro:', err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Erros do Prisma
  if (err.code === 'P2002') {
    return res.status(409).json({
      erro: 'Registro duplicado',
      campo: err.meta?.target,
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ erro: 'Registro não encontrado' });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    erro: err.message || 'Erro interno do servidor',
  });
}

module.exports = { errorHandler };

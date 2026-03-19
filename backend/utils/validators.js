// Funções de validação

// Valida se o telefone tem formato correto (apenas números, 10-15 dígitos)
function validarTelefone(telefone) {
  const limpo = telefone.replace(/\D/g, '');
  return limpo.length >= 10 && limpo.length <= 15;
}

// Valida email
function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Valida se valor é número positivo
function validarValor(valor) {
  return typeof valor === 'number' && valor > 0;
}

module.exports = { validarTelefone, validarEmail, validarValor };

// Funções de formatação

// Formata valor em reais (R$ 1.234,56)
function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

// Formata telefone (55 11 99999-0001)
function formatarTelefone(telefone) {
  const limpo = telefone.replace(/\D/g, '');
  if (limpo.length === 13) {
    return `+${limpo.slice(0, 2)} ${limpo.slice(2, 4)} ${limpo.slice(4, 9)}-${limpo.slice(9)}`;
  }
  return telefone;
}

// Remove caracteres não numéricos do telefone
function limparTelefone(telefone) {
  return telefone.replace(/\D/g, '');
}

module.exports = { formatarMoeda, formatarTelefone, limparTelefone };

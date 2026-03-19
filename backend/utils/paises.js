// Mapeamento de países, moedas e idiomas
const PAISES = {
  BR: { moeda: 'BRL', idioma: 'pt', locale: 'pt-BR', nome: 'Brasil', bandeira: '🇧🇷' },
  AR: { moeda: 'ARS', idioma: 'es', locale: 'es-AR', nome: 'Argentina', bandeira: '🇦🇷' },
  MX: { moeda: 'MXN', idioma: 'es', locale: 'es-MX', nome: 'México', bandeira: '🇲🇽' },
  CL: { moeda: 'CLP', idioma: 'es', locale: 'es-CL', nome: 'Chile', bandeira: '🇨🇱' },
  CO: { moeda: 'COP', idioma: 'es', locale: 'es-CO', nome: 'Colômbia', bandeira: '🇨🇴' },
  UY: { moeda: 'UYU', idioma: 'es', locale: 'es-UY', nome: 'Uruguai', bandeira: '🇺🇾' },
  PY: { moeda: 'PYG', idioma: 'es', locale: 'es-PY', nome: 'Paraguai', bandeira: '🇵🇾' },
  US: { moeda: 'USD', idioma: 'en', locale: 'en-US', nome: 'Estados Unidos', bandeira: '🇺🇸' },
  PT: { moeda: 'EUR', idioma: 'pt', locale: 'pt-PT', nome: 'Portugal', bandeira: '🇵🇹' },
};

// Prefixos de telefone por país (sem o +)
const PREFIXO_PAIS = {
  '55': 'BR',
  '54': 'AR',
  '52': 'MX',
  '56': 'CL',
  '57': 'CO',
  '598': 'UY',
  '595': 'PY',
  '1': 'US',
  '351': 'PT',
};

// Detectar país pelo número de telefone (formato: 5511999999999)
function detectarPaisDeTelefone(telefone) {
  if (!telefone) return 'BR';
  const tel = telefone.replace(/\D/g, '');

  // Prefixos mais específicos primeiro (3 dígitos antes de 2 dígitos)
  for (const prefixo of ['598', '595', '351']) {
    if (tel.startsWith(prefixo)) return PREFIXO_PAIS[prefixo];
  }
  for (const prefixo of ['55', '54', '52', '56', '57']) {
    if (tel.startsWith(prefixo)) return PREFIXO_PAIS[prefixo];
  }
  if (tel.startsWith('1')) return 'US';

  return 'BR';
}

// Mensagens de confirmação de pagamento por idioma
const MSGS_CONFIRMACAO = {
  pt: (valor) => `✅ Pagamento confirmado!\nValor: ${valor}\nObrigado pela compra! 🙏`,
  es: (valor) => `✅ ¡Pago confirmado!\nMonto: ${valor}\n¡Muchas gracias por tu compra! 🙏`,
  en: (valor) => `✅ Payment confirmed!\nAmount: ${valor}\nThank you for your purchase! 🙏`,
};

// Mensagens de divergência por idioma
const MSGS_DIVERGENCIA = {
  pt: (valor) => `⚠️ Comprovante recebido mas valor divergente.\nValor no comprovante: ${valor}\nPor favor, entre em contato conosco.`,
  es: (valor) => `⚠️ Comprobante recibido pero el monto no coincide.\nMonto en el comprobante: ${valor}\nPor favor, contáctenos.`,
  en: (valor) => `⚠️ Receipt received but amount doesn't match.\nAmount in receipt: ${valor}\nPlease contact us.`,
};

// Formatar valor em moeda local
function formatarMoedaLocal(valor, pais) {
  const info = PAISES[pais] || PAISES['BR'];
  return new Intl.NumberFormat(info.locale, { style: 'currency', currency: info.moeda }).format(valor || 0);
}

module.exports = { PAISES, PREFIXO_PAIS, detectarPaisDeTelefone, MSGS_CONFIRMACAO, MSGS_DIVERGENCIA, formatarMoedaLocal };

// Gerador de payload PIX BR Code (EMV/QRCPS-MPM)
// Gera o código "copia e cola" do PIX sem precisar de API externa

function campo(id, valor) {
  const v = String(valor);
  return `${id}${v.length.toString().padStart(2, '0')}${v}`;
}

function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function sanitizar(str, max) {
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .substring(0, max)
    .trim() || 'N';
}

/**
 * Gera payload PIX copia e cola (BR Code)
 * @param {string} chave    - Chave PIX (cpf, cnpj, telefone, email ou aleatória)
 * @param {string} nome     - Nome do recebedor (max 25 chars)
 * @param {string} cidade   - Cidade do recebedor (max 15 chars)
 * @param {number} valor    - Valor em reais (0 = sem valor definido)
 * @param {string} txid     - ID da transação (opcional)
 * @returns {string}        - Código PIX para copiar e colar
 */
function gerarPixCopiaCola(chave, nome, cidade, valor = 0, txid = '') {
  const nomeS = sanitizar(nome, 25);
  const cidadeS = sanitizar(cidade, 15) || 'Brasil';
  const txidS = (txid || '***').replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || '***';

  const gui = campo('00', 'BR.GOV.BCB.PIX');
  const pixKey = campo('01', chave);
  const mai = campo('26', gui + pixKey);

  const mcc = campo('52', '0000');
  const currency = campo('53', '986');
  const amount = valor > 0 ? campo('54', valor.toFixed(2)) : '';
  const country = campo('58', 'BR');
  const merchantName = campo('59', nomeS);
  const merchantCity = campo('60', cidadeS);
  const txidField = campo('05', txidS);
  const additionalData = campo('62', txidField);

  const payload = '000201' + mai + mcc + currency + amount + country + merchantName + merchantCity + additionalData + '6304';
  return payload + crc16(payload);
}

module.exports = { gerarPixCopiaCola };

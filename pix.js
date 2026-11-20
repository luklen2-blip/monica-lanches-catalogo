/**
 * Módulo Oficial de Geração de PIX Banco Central (BR Code EMV com CRC16)
 * Em conformidade com o padrão oficial do BACEN.
 */

function formatField(id, value) {
  const str = String(value);
  const len = String(str.length).padStart(2, '0');
  return `${id}${len}${str}`;
}

function calculateCRC16(payload) {
  let crc = 0xFFFF;
  const polynomial = 0x1021;

  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function sanitizeText(text, maxLen) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .toUpperCase()
    .substring(0, maxLen);
}

function gerarPixCopiaECola({ chave, nome, cidade = 'SAO PAULO', valor, txid = '***' }) {
  if (!chave) throw new Error('Chave PIX é obrigatória');

  const cleanChave = chave.trim();
  const cleanNome = sanitizeText(nome || 'RECEBEDOR', 25);
  const cleanCidade = sanitizeText(cidade || 'SAO PAULO', 15);
  const cleanTxid = (txid || '***').substring(0, 25);

  let merchantAccount = formatField('00', 'br.gov.bcb.pix');
  merchantAccount += formatField('01', cleanChave);

  let payload = '';
  payload += formatField('00', '01'); // Versão
  payload += formatField('26', merchantAccount); // Info da Conta
  payload += formatField('52', '0000'); // MCC
  payload += formatField('53', '986'); // BRL
  
  if (valor && Number(valor) > 0) {
    const valorStr = Number(valor).toFixed(2);
    payload += formatField('54', valorStr); // Valor
  }

  payload += formatField('58', 'BR'); // País
  payload += formatField('59', cleanNome); // Nome
  payload += formatField('60', cleanCidade); // Cidade

  const additionalData = formatField('05', cleanTxid);
  payload += formatField('62', additionalData);

  // Campo de CRC16
  const payloadToCRC = `${payload}6304`;
  const crc = calculateCRC16(payloadToCRC);

  const finalPayload = `${payloadToCRC}${crc}`;
  return {
    payload: finalPayload,
    valor: valor ? Number(valor).toFixed(2) : '0.00',
    chave: cleanChave,
    nome: cleanNome
  };
}

module.exports = {
  gerarPixCopiaECola,
  calculateCRC16
};

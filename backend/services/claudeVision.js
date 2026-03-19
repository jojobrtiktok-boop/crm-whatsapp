// Serviço de análise de imagens com Claude Vision
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const config = require('../config');

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

// Analisa qualquer imagem recebida e determina se é comprovante
async function analisarImagem(imagemPath) {
  const imagemBuffer = fs.readFileSync(imagemPath);
  const imagemBase64 = imagemBuffer.toString('base64');

  const extensao = imagemPath.split('.').pop().toLowerCase();
  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  const mediaType = mimeTypes[extensao] || 'image/jpeg';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imagemBase64,
            },
          },
          {
            type: 'text',
            text: `Analise esta imagem e determine se é um comprovante de pagamento ou transferência bancária (PIX, TED, DOC, boleto pago, etc).

Se NÃO for um comprovante de pagamento, retorne:
{"eh_comprovante": false, "descricao": "breve descrição do que é a imagem"}

Se FOR um comprovante de pagamento, extraia os dados e retorne:
{
  "eh_comprovante": true,
  "nome_pagador": "nome de quem fez o pagamento",
  "valor": 0.00,
  "data_pagamento": "DD/MM/AAAA",
  "banco": "nome do banco",
  "tipo_transferencia": "PIX, TED, DOC, etc",
  "valido": true
}

Se não conseguir identificar algum campo, coloque null.
Retorne APENAS o JSON, sem texto adicional.`,
          },
        ],
      },
    ],
  });

  const textoResposta = response.content[0].text.trim();
  try {
    return JSON.parse(textoResposta);
  } catch {
    const match = textoResposta.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Não foi possível analisar a imagem');
  }
}

// Analisa texto extraído de PDF para detectar comprovante
async function analisarTextoPDF(texto) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Analise o texto abaixo extraído de um PDF e determine se é um comprovante de pagamento ou transferência bancária.

Texto do PDF:
---
${texto.substring(0, 3000)}
---

Se NÃO for um comprovante de pagamento, retorne:
{"eh_comprovante": false, "descricao": "breve descrição do conteúdo"}

Se FOR um comprovante de pagamento, extraia os dados e retorne:
{
  "eh_comprovante": true,
  "nome_pagador": "nome de quem fez o pagamento",
  "valor": 0.00,
  "data_pagamento": "DD/MM/AAAA",
  "banco": "nome do banco",
  "tipo_transferencia": "PIX, TED, DOC, etc",
  "valido": true
}

Se não conseguir identificar algum campo, coloque null.
Retorne APENAS o JSON, sem texto adicional.`,
      },
    ],
  });

  const textoResposta = response.content[0].text.trim();
  try {
    return JSON.parse(textoResposta);
  } catch {
    const match = textoResposta.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Não foi possível analisar o texto do PDF');
  }
}

module.exports = { analisarImagem, analisarTextoPDF };

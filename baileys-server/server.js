// Baileys WhatsApp Server
// Compatível com o formato WPPConnect usado pelo CRM
// Suporta @lid nativamente + mídia completa

const express = require('express');
const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.default || baileys.makeWASocket || baileys;
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pino = require('pino');
const mime = require('mime-types');

const app = express();
app.use(express.json({ limit: '100mb' }));

const SECRET_KEY = process.env.SECRET_KEY || 'THISISMYSECURETOKEN';
const PORT = parseInt(process.env.PORT || '21465');
const AUTH_DIR = process.env.AUTH_DIR || path.join(__dirname, 'sessions');
// Salvar na pasta uploads do CRM para o webhook servir corretamente
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads', 'recebidos');

fs.mkdirSync(AUTH_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Estado das sessões em memória
// { sessionName: { socket, token, status, qrBase64, webhookUrl } }
const sessions = {};

const logger = pino({ level: 'silent' });

// ─── Auth Middleware ────────────────────────────────────────────────────────

function verifyToken(req, res, next) {
  const { session } = req.params;
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Check that the Session and Token are correct' });
  }
  const token = auth.slice(7);
  const sess = sessions[session];
  if (!sess || sess.token !== token) {
    return res.status(401).json({ error: 'Check that the Session and Token are correct' });
  }
  next();
}

// ─── Rotas ─────────────────────────────────────────────────────────────────

// Gerar token (compatível com WPPConnect: /api/:session/:secretkey/generate-token)
app.post('/api/:session/:secretkey/generate-token', (req, res) => {
  const { session, secretkey } = req.params;
  if (secretkey !== SECRET_KEY) {
    return res.json({ response: false, message: 'The SECRET_KEY is incorrect' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  if (!sessions[session]) {
    sessions[session] = { status: 'CLOSED', qrBase64: null, webhookUrl: null, socket: null };
  }
  sessions[session].token = token;
  console.log(`[${session}] Token gerado`);
  res.status(201).json({ status: 'success', session, token, full: `${session}:${token}` });
});

// Iniciar sessão
app.post('/api/:session/start-session', verifyToken, async (req, res) => {
  const { session } = req.params;
  const { webhook } = req.body || {};
  const sess = sessions[session];

  if (webhook?.url) {
    sess.webhookUrl = webhook.url;
    console.log(`[${session}] Webhook: ${webhook.url}`);
    // Persistir webhook URL em disco para sobreviver a restarts
    const webhookFile = path.join(AUTH_DIR, session, 'webhook.json');
    fs.mkdirSync(path.join(AUTH_DIR, session), { recursive: true });
    fs.writeFileSync(webhookFile, JSON.stringify({ url: webhook.url }));
  }

  if (sess.status === 'CONNECTED') {
    return res.json({ status: 'CONNECTED', session });
  }

  if (sess.status === 'INITIALIZING' || sess.status === 'QRCODE') {
    return res.json({ status: sess.status, session });
  }

  res.json({ status: 'INITIALIZING', session });

  // Iniciar em background
  startBaileysSession(session).catch((err) => {
    console.error(`[${session}] Erro ao iniciar:`, err.message);
    sess.status = 'CLOSED';
  });
});

// Status da sessão
app.get('/api/:session/status-session', verifyToken, (req, res) => {
  const { session } = req.params;
  const sess = sessions[session] || {};
  res.json({ status: sess.status || 'CLOSED', qrcode: null, version: '1.0.0' });
});

// QR Code
app.get('/api/:session/qrcode-session', verifyToken, (req, res) => {
  const { session } = req.params;
  const sess = sessions[session];
  if (!sess?.qrBase64) {
    return res.json({ status: sess?.status || 'CLOSED', message: 'QRCode is not available...' });
  }
  res.json({ status: 'QRCODE', base64: sess.qrBase64 });
});

// Pairing code (código de pareamento por número de telefone)
app.post('/api/:session/request-pairing-code', verifyToken, async (req, res) => {
  const { session } = req.params;
  const { phone } = req.body;
  const sess = sessions[session];

  if (!phone) {
    return res.status(400).json({ error: 'phone is required' });
  }

  // Iniciar sessão se necessário
  if (!sess?.socket || sess.status === 'CLOSED') {
    if (!sess) sessions[session] = { status: 'CLOSED', qrBase64: null, webhookUrl: null, socket: null, token: sessions[session]?.token };
    startBaileysSession(session).catch(() => {});
  }

  // Aguardar socket estar pronto (até 15s)
  for (let i = 0; i < 30; i++) {
    if (sessions[session]?.socket && sessions[session]?.status === 'QRCODE') break;
    if (sessions[session]?.status === 'CONNECTED') {
      return res.status(400).json({ error: 'Session already connected' });
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  const currentSess = sessions[session];
  if (!currentSess?.socket || currentSess.status !== 'QRCODE') {
    return res.status(503).json({ error: 'Session not ready for pairing. Try again in a few seconds.' });
  }

  try {
    const phoneClean = phone.replace(/\D/g, '');
    const code = await currentSess.socket.requestPairingCode(phoneClean);
    console.log(`[${session}] Pairing code gerado para ${phoneClean}`);
    res.json({ code });
  } catch (err) {
    console.error(`[${session}] Erro ao gerar pairing code:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Fechar sessão
app.post('/api/:session/close-session', verifyToken, async (req, res) => {
  const { session } = req.params;
  const sess = sessions[session];
  if (sess?.socket) {
    try { await sess.socket.logout(); } catch {}
    sess.socket = null;
  }
  if (sess) {
    sess.status = 'CLOSED';
    sess.qrBase64 = null;
  }
  res.json({ status: 'CLOSED' });
});

// Enviar texto
app.post('/api/:session/send-message', verifyToken, async (req, res) => {
  const { session } = req.params;
  const { phone, message } = req.body;
  try {
    const jid = formatJid(phone);
    const result = await sessions[session].socket.sendMessage(jid, { text: message });
    res.json({ key: result?.key, id: result?.key?.id, status: 'sent' });
  } catch (err) {
    console.error(`[${session}] Erro ao enviar texto:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Enviar imagem
app.post('/api/:session/send-image', verifyToken, async (req, res) => {
  const { session } = req.params;
  const { phone, base64, path: urlPath, caption, filename } = req.body;
  try {
    const jid = formatJid(phone);
    let imageBuffer;

    if (base64) {
      const b64 = base64.includes(',') ? base64.split(',')[1] : base64;
      imageBuffer = Buffer.from(b64, 'base64');
    } else if (urlPath) {
      if (urlPath.startsWith('http')) {
        const resp = await axios.get(urlPath, { responseType: 'arraybuffer' });
        imageBuffer = Buffer.from(resp.data);
      } else {
        imageBuffer = fs.readFileSync(urlPath);
      }
    }

    const result = await sessions[session].socket.sendMessage(jid, {
      image: imageBuffer,
      caption: caption || '',
    });
    res.json({ key: result?.key, id: result?.key?.id, status: 'sent' });
  } catch (err) {
    console.error(`[${session}] Erro ao enviar imagem:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Enviar áudio PTT
app.post('/api/:session/send-voice', verifyToken, async (req, res) => {
  const { session } = req.params;
  const { phone, base64 } = req.body;
  try {
    const jid = formatJid(phone);
    const b64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const audioBuffer = Buffer.from(b64, 'base64');
    const result = await sessions[session].socket.sendMessage(jid, {
      audio: audioBuffer,
      ptt: true,
      mimetype: 'audio/ogg; codecs=opus',
    });
    res.json({ key: result?.key, id: result?.key?.id, status: 'sent' });
  } catch (err) {
    console.error(`[${session}] Erro ao enviar áudio:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Enviar arquivo (vídeo/PDF/documento)
app.post('/api/:session/send-file-base64', verifyToken, async (req, res) => {
  const { session } = req.params;
  const { phone, base64, filename, caption } = req.body;
  try {
    const jid = formatJid(phone);
    const b64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const fileBuffer = Buffer.from(b64, 'base64');

    const ext = path.extname(filename || '').toLowerCase();
    const mimetype = mime.lookup(filename) || 'application/octet-stream';
    const isVideo = ['.mp4', '.avi', '.mov'].includes(ext);
    const isAudio = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.opus'].includes(ext);

    const msgContent = isVideo
      ? { video: fileBuffer, caption: caption || '', fileName: filename }
      : isAudio
      ? { audio: fileBuffer, mimetype, ptt: true }
      : { document: fileBuffer, mimetype, fileName: filename, caption: caption || '' };

    const result = await sessions[session].socket.sendMessage(jid, msgContent);
    res.json({ key: result?.key, id: result?.key?.id, status: 'sent' });
  } catch (err) {
    console.error(`[${session}] Erro ao enviar arquivo:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Listar etiquetas (WhatsApp Business)
app.get('/api/:session/list-labels', verifyToken, async (req, res) => {
  const { session } = req.params;
  const sess = sessions[session];
  if (!sess?.socket) return res.status(503).json({ error: 'Session not connected' });
  try {
    const labels = await sess.socket.getLabels();
    res.json({ labels: labels || [] });
  } catch (err) {
    console.error(`[${session}] Erro ao listar etiquetas:`, err.message);
    res.json({ labels: [] });
  }
});

// Aplicar etiqueta a um contato (WhatsApp Business)
app.post('/api/:session/label-chat', verifyToken, async (req, res) => {
  const { session } = req.params;
  const { phone, labelId } = req.body;
  const sess = sessions[session];
  if (!sess?.socket) return res.status(503).json({ error: 'Session not connected' });
  try {
    const jid = formatJid(phone);
    await sess.socket.addChatLabel(jid, labelId);
    console.log(`[${session}] Etiqueta ${labelId} aplicada a ${jid}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`[${session}] Erro ao aplicar etiqueta:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', sessions: Object.keys(sessions) }));

// ─── Baileys Session ────────────────────────────────────────────────────────

async function startBaileysSession(sessionName) {
  const sess = sessions[sessionName];
  sess.status = 'INITIALIZING';
  sess.qrBase64 = null;

  const authDir = path.join(AUTH_DIR, sessionName);
  fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  console.log(`[${sessionName}] Iniciando sessão Baileys v${version.join('.')}`);

  const socket = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger,
    browser: ['CRM WhatsApp', 'Chrome', '120.0.0'],
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 30000,
    retryRequestDelayMs: 2000,
  });

  sess.socket = socket;

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        sess.qrBase64 = await QRCode.toDataURL(qr);
        sess.status = 'QRCODE';
        console.log(`[${sessionName}] QR Code gerado - pronto para escanear`);
      } catch (err) {
        console.error(`[${sessionName}] Erro ao gerar QR:`, err.message);
      }
    }

    if (connection === 'open') {
      sess.status = 'CONNECTED';
      sess.qrBase64 = null;
      console.log(`[${sessionName}] ✅ Conectado ao WhatsApp!`);

      if (sess.webhookUrl) {
        await fireWebhook(sess.webhookUrl, sessionName, {
          event: 'onstatechange',
          data: 'CONNECTED',
        });
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      console.log(`[${sessionName}] Desconectado (${statusCode}). Reconectar: ${!loggedOut}`);
      sess.status = 'CLOSED';

      if (sess.webhookUrl) {
        await fireWebhook(sess.webhookUrl, sessionName, {
          event: 'onstatechange',
          data: 'CLOSED',
        });
      }

      if (!loggedOut) {
        console.log(`[${sessionName}] Reconectando em 5s...`);
        setTimeout(() => startBaileysSession(sessionName).catch(() => {}), 5000);
      }
    }
  });

  // Mensagens recebidas
  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    console.log(`[${sessionName}] messages.upsert type=${type} count=${messages.length}`);
    if (type !== 'notify') return;
    const webhookUrl = sess.webhookUrl;
    if (!webhookUrl) {
      console.log(`[${sessionName}] Sem webhookUrl configurado!`);
      return;
    }

    for (const msg of messages) {
      if (msg.key.fromMe) continue;

      const from = msg.key.remoteJid;
      const msgType = Object.keys(msg.message || {})[0] || 'text';

      // Texto da mensagem
      const body =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        '';

      const payload = {
        event: 'onmessage',
        data: {
          id: msg.key.id,
          from,
          body,
          type: msgType,
          fromMe: false,
          isGroup: from?.includes('@g.us') || false,
          timestamp: msg.messageTimestamp,
          message: msg.message,
        },
      };

      // Baixar mídia se for imagem/vídeo/documento/áudio
      const mediaTypes = ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage'];
      if (mediaTypes.includes(msgType)) {
        try {
          const mediaBuffer = await downloadMediaMessage(msg, 'buffer', {});
          const mimeType = msg.message[msgType]?.mimetype || 'application/octet-stream';
          const ext = mime.extension(mimeType) || 'bin';
          const filename = `${msg.key.id}.${ext}`;
          const savePath = path.join(UPLOAD_DIR, filename);
          fs.writeFileSync(savePath, mediaBuffer);
          payload.data.mimetype = mimeType;
          payload.data.filename = filename;
          payload.data.mediaUrl = `/uploads/recebidos/${filename}`;
        } catch (err) {
          console.error(`[${sessionName}] Erro ao baixar mídia:`, err.message);
        }
      }

      await fireWebhook(webhookUrl, sessionName, payload);
    }
  });

  // Recibos (ACK)
  socket.ev.on('messages.update', async (updates) => {
    const webhookUrl = sess.webhookUrl;
    if (!webhookUrl) return;

    for (const update of updates) {
      if (update.update?.status === undefined) continue;
      await fireWebhook(webhookUrl, sessionName, {
        event: 'onack',
        data: {
          id: update.key.id,
          from: update.key.remoteJid,
          ack: update.update.status, // 1=sent, 2=delivered, 3=read
        },
      });
    }
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatJid(phone) {
  if (!phone) return phone;
  // @lid, @g.us, @s.whatsapp.net → passam direto
  if (phone.includes('@')) return phone.replace('@c.us', '@s.whatsapp.net');
  return `${phone}@s.whatsapp.net`;
}

async function fireWebhook(url, session, payload) {
  try {
    await axios.post(url, { ...payload, session }, {
      timeout: 8000,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // Silencia erros de webhook para não quebrar o fluxo
  }
}

// ─── Start ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🟢 Baileys WhatsApp Server rodando na porta ${PORT}`);
  console.log(`   Swagger-like: http://localhost:${PORT}/health`);
  console.log(`   SECRET_KEY: ${SECRET_KEY}`);

  // Auto-reconectar sessões que têm credenciais salvas em disco
  autoReconectarSessoes();
});

async function autoReconectarSessoes() {
  if (!fs.existsSync(AUTH_DIR)) return;
  const dirs = fs.readdirSync(AUTH_DIR).filter(d =>
    fs.statSync(path.join(AUTH_DIR, d)).isDirectory()
  );
  for (const sessionName of dirs) {
    const credsFile = path.join(AUTH_DIR, sessionName, 'creds.json');
    if (!fs.existsSync(credsFile)) continue;
    console.log(`[${sessionName}] Auto-reconectando sessão salva...`);
    const token = crypto.randomBytes(32).toString('hex');
    // Carregar webhook URL salvo em disco
    let webhookUrl = null;
    const webhookFile = path.join(AUTH_DIR, sessionName, 'webhook.json');
    if (fs.existsSync(webhookFile)) {
      try { webhookUrl = JSON.parse(fs.readFileSync(webhookFile)).url; } catch {}
    }
    sessions[sessionName] = { status: 'CLOSED', qrBase64: null, webhookUrl, socket: null, token };
    startBaileysSession(sessionName).catch(err => {
      console.error(`[${sessionName}] Erro na auto-reconexão:`, err.message);
    });
  }
}

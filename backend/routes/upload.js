// Rota de upload de arquivos (imagem, audio, video)
const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { autenticar } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'funil');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 40 * 1024 * 1024 }, // 40MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpg|jpeg|png|webp|gif|mp3|ogg|wav|mp4|avi|mov|m4a|opus|pdf|doc|docx/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo nao permitido'));
    }
  },
});

router.use(autenticar);

// POST /api/upload - Upload de arquivo
router.post('/', (req, res, next) => {
  upload.single('arquivo')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ erro: 'Arquivo muito grande. Limite: 40MB' });
      }
      return res.status(400).json({ erro: err.message || 'Erro ao processar arquivo' });
    }
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
    }
    const url = `/uploads/funil/${req.file.filename}`;
    res.json({ url, filename: req.file.filename });
  });
});

module.exports = router;

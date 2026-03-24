const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');
const { autenticar } = require('../middleware/auth');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SUBS_FILE = path.join(DATA_DIR, 'push_subscriptions.json');
const KEYS_FILE = path.join(DATA_DIR, 'vapid_keys.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

function getKeys() {
  if (!fs.existsSync(KEYS_FILE)) {
    const keys = webpush.generateVAPIDKeys();
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys));
    return keys;
  }
  return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
}

function getSubscriptions() {
  if (!fs.existsSync(SUBS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); } catch { return []; }
}

function saveSubscriptions(subs) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs));
}

const keys = getKeys();
webpush.setVapidDetails('mailto:admin@nexoflow.com', keys.publicKey, keys.privateKey);

router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: keys.publicKey });
});

router.post('/subscribe', autenticar, (req, res) => {
  const subscription = req.body;
  const subs = getSubscriptions();
  if (!subs.find(s => s.endpoint === subscription.endpoint)) {
    subs.push(subscription);
    saveSubscriptions(subs);
  }
  res.json({ ok: true });
});

router.post('/unsubscribe', autenticar, (req, res) => {
  const { endpoint } = req.body;
  saveSubscriptions(getSubscriptions().filter(s => s.endpoint !== endpoint));
  res.json({ ok: true });
});

async function enviarPushParaTodos(payload) {
  const subs = getSubscriptions();
  if (!subs.length) return;
  const dead = [];
  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(sub, JSON.stringify(payload)).catch(err => {
        if (err.statusCode === 410 || err.statusCode === 404) dead.push(sub.endpoint);
      })
    )
  );
  if (dead.length) saveSubscriptions(subs.filter(s => !dead.includes(s.endpoint)));
}

module.exports = router;
module.exports.enviarPushParaTodos = enviarPushParaTodos;

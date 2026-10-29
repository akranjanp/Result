// server/captcha.js
// Stateless HMAC-signed Captcha Generator & Validator

const crypto = require('node:crypto');

const CAPTCHA_SECRET = process.env.CAPTCHA_SECRET || 'captcha-secret-key-2026-xyz';
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function generateRandomString(length = 5) {
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += CHARS[bytes[i] % CHARS.length];
  }
  return result;
}

function createCaptcha(length = 5, expiresInSeconds = 300) {
  const text = generateRandomString(length);
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = `${text}:${exp}`;
  const sig = crypto.createHmac('sha256', CAPTCHA_SECRET).update(payload).digest('hex');
  const token = Buffer.from(`${payload}:${sig}`).toString('base64url');

  return {
    captchaText: text,
    captchaToken: token
  };
}

function verifyCaptcha(token, userInput) {
  if (!token || !userInput) return false;
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const [text, expStr, sig] = raw.split(':');
    const exp = parseInt(expStr, 10);

    if (Date.now() / 1000 > exp) {
      return false; // Expired
    }

    const payload = `${text}:${expStr}`;
    const expectedSig = crypto.createHmac('sha256', CAPTCHA_SECRET).update(payload).digest('hex');
    if (sig !== expectedSig) {
      return false; // Tampered
    }

    // Compare case-insensitively for better mobile UX, or exact
    return text.trim().toLowerCase() === userInput.trim().toLowerCase();
  } catch (e) {
    return false;
  }
}

module.exports = {
  createCaptcha,
  verifyCaptcha
};

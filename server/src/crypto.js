import crypto from 'crypto';

const ENCODING = 'base64url';

function hkdf(secret, salt, info, length = 32) {
  return crypto.hkdfSync('sha256', secret, salt, info, length);
}

export function getUserKey(googleSub) {
  const serverSecret = process.env.SERVER_ENCRYPTION_SECRET || '';
  if (!serverSecret) throw new Error('SERVER_ENCRYPTION_SECRET not set');
  const salt = Buffer.from('noterverse-salt');
  const info = Buffer.from(`user:${googleSub}`);
  return hkdf(Buffer.from(serverSecret), salt, info, 32);
}

export function encryptNoteContent(plaintext, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString(ENCODING),
    authTag: authTag.toString(ENCODING),
    ciphertext: ciphertext.toString(ENCODING)
  };
}

export function decryptNoteContent({ iv, authTag, ciphertext }, key) {
  const ivBuf = Buffer.from(iv, ENCODING);
  const tagBuf = Buffer.from(authTag, ENCODING);
  const ctBuf = Buffer.from(ciphertext, ENCODING);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuf);
  decipher.setAuthTag(tagBuf);
  const pt = Buffer.concat([decipher.update(ctBuf), decipher.final()]);
  return pt.toString('utf8');
}



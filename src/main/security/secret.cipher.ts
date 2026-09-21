import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SECRET_PREFIX = 'enc:';

// Deterministic vault key for desktop offline-first storage
const MASTER_KEY = crypto.scryptSync(
  process.env.APP_SECRET || 'RS_INVENTORY_LOCAL_SECURE_VAULT_KEY_2026_SOLO',
  'rs_inventory_salt_solo_secure',
  32
);

export class SecretCipher {
  /**
   * Encrypts plaintext secret using AES-256-GCM.
   */
  static encrypt(plaintext?: string | null): string {
    if (!plaintext || plaintext.startsWith(SECRET_PREFIX)) {
      return plaintext || '';
    }

    try {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag().toString('hex');
      return `${SECRET_PREFIX}${iv.toString('hex')}:${tag}:${encrypted}`;
    } catch (err) {
      console.error('[SecretCipher] Encryption error:', err);
      return plaintext;
    }
  }

  /**
   * Decrypts AES-256-GCM ciphertext to plaintext secret.
   */
  static decrypt(ciphertext?: string | null): string {
    if (!ciphertext || !ciphertext.startsWith(SECRET_PREFIX)) {
      return ciphertext || '';
    }

    try {
      const parts = ciphertext.slice(SECRET_PREFIX.length).split(':');
      if (parts.length !== 3) return ciphertext;
      const [ivHex, tagHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      console.error('[SecretCipher] Decryption error:', err);
      return ciphertext;
    }
  }

  /**
   * Safe mask for UI presentation (e.g. ••••••••1234)
   */
  static mask(secret?: string | null, keepLast = 4): string {
    if (!secret) return '';
    const clean = secret.startsWith(SECRET_PREFIX) ? this.decrypt(secret) : secret;
    if (clean.length <= keepLast) return '••••••••';
    return '••••••••' + clean.slice(-keepLast);
  }
}

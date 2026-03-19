import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 16;
const TAG_BYTES = 16;
const ENC_PREFIX = 'enc:';

/**
 * AES-256-GCM encryption for sensitive credentials stored in the database.
 * Requires ENCRYPTION_KEY env var (≥32 chars).
 *
 * Encrypted values are prefixed with "enc:" so legacy plaintext records are
 * returned as-is until they are re-saved through the service layer.
 */
@Injectable()
export class CryptoService implements OnModuleInit {
  private readonly logger = new Logger(CryptoService.name);
  private key!: Buffer;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const raw = this.config.get<string>('ENCRYPTION_KEY');
    if (!raw || raw.length < 32) {
      throw new Error(
        'ENCRYPTION_KEY env var must be set and at least 32 characters long.',
      );
    }
    // Derive a fixed-length 32-byte key from the passphrase.
    this.key = crypto.scryptSync(raw, 'mini-zapier-salt', 32);
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return ENC_PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(value: string): string {
    if (!value.startsWith(ENC_PREFIX)) {
      // Legacy plaintext — log once and return as-is.
      this.logger.warn('Decrypting a value that is not encrypted (legacy plaintext).');
      return value;
    }
    const buf = Buffer.from(value.slice(ENC_PREFIX.length), 'base64');
    const iv = buf.subarray(0, IV_BYTES);
    const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const encrypted = buf.subarray(IV_BYTES + TAG_BYTES);
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
  }
}

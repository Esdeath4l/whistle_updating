import CryptoJS from 'crypto-js';

/**
 * Encryption Utility for Whistle App
 * Uses AES-256 encryption to protect sensitive data before storing in MongoDB
 */

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here!!';

interface EncryptedData {
  encrypted: string;
  iv: string;
  salt?: string;
}

export class DataEncryption {
  private static validateKey() {
    if (ENCRYPTION_KEY.length < 16) {
      throw new Error('ENCRYPTION_KEY must be at least 16 characters long for security');
    }
  }

  /**
   * Encrypt sensitive data using AES-256-CBC with CryptoJS
   * @param text - Plain text to encrypt
   * @returns EncryptedData object with encrypted text, IV, and salt
   */
  static encrypt(text: string): EncryptedData {
    if (!text || typeof text !== 'string') {
      throw new Error('Text to encrypt must be a non-empty string');
    }

    this.validateKey();
    
    const salt = CryptoJS.lib.WordArray.random(128/8);
    const key = CryptoJS.PBKDF2(ENCRYPTION_KEY, salt, {
      keySize: 256/32,
      iterations: 1000
    });
    
    const iv = CryptoJS.lib.WordArray.random(128/8);
    const encrypted = CryptoJS.AES.encrypt(text, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    return {
      encrypted: encrypted.toString(),
      iv: iv.toString(),
      salt: salt.toString()
    };
  }

  /**
   * Decrypt sensitive data using AES-256-CBC with CryptoJS
   * @param encryptedData - EncryptedData object to decrypt
   * @returns Decrypted plain text
   */
  static decrypt(encryptedData: EncryptedData): string {
    if (!encryptedData || !encryptedData.encrypted || !encryptedData.iv) {
      throw new Error('Invalid encrypted data structure');
    }

    this.validateKey();
    
    const salt = CryptoJS.enc.Hex.parse(encryptedData.salt || '');
    const key = CryptoJS.PBKDF2(ENCRYPTION_KEY, salt, {
      keySize: 256/32,
      iterations: 1000
    });
    
    const iv = CryptoJS.enc.Hex.parse(encryptedData.iv);
    const decrypted = CryptoJS.AES.decrypt(encryptedData.encrypted, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Encrypt object fields that contain sensitive data
   * @param data - Object containing fields to encrypt
   * @param fieldsToEncrypt - Array of field names to encrypt
   * @returns Object with encrypted fields
   */
  static encryptSensitiveFields(data: any, fieldsToEncrypt: string[]): any {
    const result = { ...data };
    
    fieldsToEncrypt.forEach(field => {
      if (result[field] && typeof result[field] === 'string') {
        const encrypted = this.encrypt(result[field]);
        result[`${field}_encrypted`] = encrypted.encrypted;
        result[`${field}_iv`] = encrypted.iv;
        result[`${field}_salt`] = encrypted.salt;
        delete result[field]; // Remove original field
      } else if (result[field] && typeof result[field] === 'object') {
        // Handle nested objects like location
        const encrypted = this.encrypt(JSON.stringify(result[field]));
        result[`${field}_encrypted`] = encrypted.encrypted;
        result[`${field}_iv`] = encrypted.iv;
        result[`${field}_salt`] = encrypted.salt;
        delete result[field];
      }
    });
    
    return result;
  }

  /**
   * Decrypt object fields that contain sensitive data
   * @param data - Object containing encrypted fields
   * @param fieldsToDecrypt - Array of field names to decrypt
   * @returns Object with decrypted fields
   */
  static decryptSensitiveFields(data: any, fieldsToDecrypt: string[]): any {
    const result = { ...data };
    
    fieldsToDecrypt.forEach(field => {
      const encryptedField = `${field}_encrypted`;
      const ivField = `${field}_iv`;
      const saltField = `${field}_salt`;
      
      if (result[encryptedField] && result[ivField]) {
        try {
          const decrypted = this.decrypt({
            encrypted: result[encryptedField],
            iv: result[ivField],
            salt: result[saltField]
          });
          
          // Try to parse as JSON for objects, otherwise use as string
          try {
            result[field] = JSON.parse(decrypted);
          } catch {
            result[field] = decrypted;
          }
          
          delete result[encryptedField];
          delete result[ivField];
          delete result[saltField];
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error);
          // Keep the field empty rather than exposing encrypted data
          result[field] = null;
        }
      }
    });
    
    return result;
  }

  /**
   * Encrypt a report's sensitive fields before saving to database
   * @param report - Report object with sensitive data
   * @returns Report object with encrypted sensitive fields
   */
  static encryptReportData(report: any): any {
    const sensitiveFields = ['message', 'location'];
    return this.encryptSensitiveFields(report, sensitiveFields);
  }

  /**
   * Decrypt a report's sensitive fields after fetching from database
   * @param report - Report object with encrypted data
   * @returns Report object with decrypted sensitive fields
   */
  static decryptReportData(report: any): any {
    const sensitiveFields = ['message', 'location'];
    return this.decryptSensitiveFields(report, sensitiveFields);
  }
}
import { hash, verify } from '@node-rs/argon2';

/**
 * Enterprise-grade Password Hashing using Argon2id
 * Meets OWASP recommendations for password storage.
 */
export class PasswordHasher {
  // 2 represents Algorithm.Argon2id in @node-rs/argon2
  private static readonly ARGON2_OPTIONS = {
    algorithm: 2 as const,
    memoryCost: 65536, // 64 MB
    timeCost: 3,       // 3 iterations
    parallelism: 4,    // 4 threads
  };

  /**
   * Hashes a plaintext password using Argon2id.
   * Throws error if password is shorter than 6 characters.
   */
  static async hash(password: string): Promise<string> {
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    return await hash(password, this.ARGON2_OPTIONS);
  }

  /**
   * Securely verifies a plaintext password against an Argon2id hash in constant time.
   */
  static async verify(password: string, hashValue: string): Promise<boolean> {
    if (!password || !hashValue) return false;
    try {
      return await verify(hashValue, password);
    } catch {
      return false;
    }
  }
}

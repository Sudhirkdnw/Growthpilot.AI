export interface LockoutStatus {
  isLocked: boolean;
  remainingMinutes?: number;
  attempts: number;
}

export class BruteForceProtector {
  private failedAttempts = new Map<string, { count: number; lockedUntil: number | null }>();
  private readonly maxAttempts = 5;
  private readonly lockoutDurationMs = 15 * 60 * 1000; // 15 minutes

  /**
   * Checks if an account is currently locked out due to excessive failed attempts.
   */
  checkStatus(username: string): LockoutStatus {
    const record = this.failedAttempts.get(username.toLowerCase());
    if (!record) {
      return { isLocked: false, attempts: 0 };
    }

    const now = Date.now();
    if (record.lockedUntil) {
      if (now < record.lockedUntil) {
        const remainingMinutes = Math.ceil((record.lockedUntil - now) / (60 * 1000));
        return {
          isLocked: true,
          remainingMinutes,
          attempts: record.count,
        };
      } else {
        // Lockout expired, reset
        this.failedAttempts.delete(username.toLowerCase());
        return { isLocked: false, attempts: 0 };
      }
    }

    return { isLocked: false, attempts: record.count };
  }

  /**
   * Records a failed login attempt. If attempts exceed max, locks the account.
   */
  recordFailedAttempt(username: string): LockoutStatus {
    const key = username.toLowerCase();
    const now = Date.now();
    const record = this.failedAttempts.get(key) || { count: 0, lockedUntil: null };

    record.count += 1;
    if (record.count >= this.maxAttempts) {
      record.lockedUntil = now + this.lockoutDurationMs;
      this.failedAttempts.set(key, record);
      return {
        isLocked: true,
        remainingMinutes: Math.ceil(this.lockoutDurationMs / (60 * 1000)),
        attempts: record.count,
      };
    }

    this.failedAttempts.set(key, record);
    return {
      isLocked: false,
      attempts: record.count,
    };
  }

  /**
   * Resets failed attempts after a successful login.
   */
  recordSuccess(username: string): void {
    this.failedAttempts.delete(username.toLowerCase());
  }
}

export const bruteForceProtector = new BruteForceProtector();

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface RateLimitWindow {
  startedAtMs: number;
  count: number;
}

export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, RateLimitWindow>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  check(key: string): RateLimitDecision {
    const nowMs = this.now();
    const current = this.windows.get(key);

    if (!current || nowMs - current.startedAtMs >= this.windowMs) {
      this.windows.set(key, { startedAtMs: nowMs, count: 1 });
      return {
        allowed: true,
        remaining: this.limit - 1,
        retryAfterSeconds: 0,
      };
    }

    if (current.count >= this.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((this.windowMs - (nowMs - current.startedAtMs)) / 1000)),
      };
    }

    current.count += 1;
    return {
      allowed: true,
      remaining: this.limit - current.count,
      retryAfterSeconds: 0,
    };
  }
}

export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const [first] = forwardedFor.split(',');
    const ip = first?.trim();
    if (ip) return ip;
  }

  return headers.get('x-real-ip')?.trim() || 'unknown';
}

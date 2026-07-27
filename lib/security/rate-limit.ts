type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Process-local guard; production should additionally enforce proxy/WAF limits. */
export function isRateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now(); const current = buckets.get(key);
  if (!current || current.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return false; }
  current.count += 1; return current.count > limit;
}

export function requestClientKey(request: Request, userId: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${userId}:${forwarded || request.headers.get("x-real-ip") || "unknown"}`;
}

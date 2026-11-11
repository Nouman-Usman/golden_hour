// App-level session revocation: a staff row's sessionsValidAfter refuses any sign-in that started earlier.
// The sign-in time comes from the verified token's `amr` claim, which survives token refreshes (unlike `iat`).

export function sessionAllowed(authTimeSec: number | null, validAfter: Date | null): boolean {
  if (!validAfter) return true;
  if (authTimeSec === null) return false; // can't prove the sign-in is new enough: fail closed
  return authTimeSec * 1000 >= validAfter.getTime();
}

export function authTimeFromClaims(claims: { amr?: unknown }): number | null {
  if (!Array.isArray(claims.amr)) return null;
  const times = claims.amr
    .map((e) => (e && typeof e === "object" && typeof (e as { timestamp?: unknown }).timestamp === "number" ? (e as { timestamp: number }).timestamp : null))
    .filter((t): t is number => t !== null);
  return times.length ? Math.max(...times) : null;
}

const STEAM64_BASE = 76561197960265728n;

export function toSteamId64(value: string) {
  const identity = value.trim();
  if (/^7656119\d{10}$/.test(identity)) return identity;

  const steam3 = identity.match(/^\[U:1:(\d+)\]$/i);
  if (steam3) return String(STEAM64_BASE + BigInt(steam3[1]));

  const steam2 = identity.match(/^STEAM_[0-5]:([01]):(\d+)$/i);
  if (steam2) {
    return String(STEAM64_BASE + BigInt(steam2[2]) * 2n + BigInt(steam2[1]));
  }
  return identity;
}

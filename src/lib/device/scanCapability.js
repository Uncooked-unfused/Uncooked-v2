/**
 * Tune door-scanner camera/decode for low-end vs high-end phones.
 * Pure helpers — safe to unit test without DOM.
 */

export function scoreDeviceCapability({
  hardwareConcurrency = 4,
  deviceMemory = 4,
  saveData = false,
  reducedMotion = false,
  effectiveType = "",
} = {}) {
  let score = 50;
  if (hardwareConcurrency <= 4) score -= 15;
  if (hardwareConcurrency <= 2) score -= 15;
  if (deviceMemory > 0 && deviceMemory <= 2) score -= 20;
  if (deviceMemory > 0 && deviceMemory <= 4) score -= 8;
  if (saveData) score -= 20;
  if (reducedMotion) score -= 5;
  if (/^(slow-2g|2g|3g)$/i.test(String(effectiveType))) score -= 15;
  if (hardwareConcurrency >= 8 && deviceMemory >= 6) score += 15;
  return Math.max(0, Math.min(100, score));
}

export function scanProfileFromScore(score) {
  if (score < 35) {
    return {
      tier: "low",
      // Modest preview — enough for QR, cheap on GPU/CPU
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 640, max: 800 },
        height: { ideal: 480, max: 600 },
        frameRate: { ideal: 15, max: 24 },
      },
      decodeMaxEdge: 420,
      // Skip frames so jsQR doesn't melt low-end SoCs
      frameSkip: 3,
      detectorIntervalMs: 220,
      cooldownMs: 3200,
    };
  }
  if (score < 65) {
    return {
      tier: "mid",
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 960, max: 1280 },
        height: { ideal: 720, max: 720 },
        frameRate: { ideal: 24, max: 30 },
      },
      decodeMaxEdge: 560,
      frameSkip: 2,
      detectorIntervalMs: 140,
      cooldownMs: 2500,
    };
  }
  return {
    tier: "high",
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 30 },
    },
    decodeMaxEdge: 720,
    frameSkip: 1,
    detectorIntervalMs: 90,
    cooldownMs: 2000,
  };
}

export function getScanProfile(env = typeof navigator !== "undefined" ? navigator : null) {
  if (!env) return scanProfileFromScore(50);
  const conn = env.connection || env.mozConnection || env.webkitConnection;
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const score = scoreDeviceCapability({
    hardwareConcurrency: env.hardwareConcurrency || 4,
    deviceMemory: env.deviceMemory || 0,
    saveData: Boolean(conn?.saveData),
    reducedMotion: Boolean(reducedMotion),
    effectiveType: conn?.effectiveType || "",
  });
  return { ...scanProfileFromScore(score), score };
}

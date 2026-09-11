import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  scoreDeviceCapability,
  scanProfileFromScore,
} from "../src/lib/device/scanCapability.js";

describe("scanCapability", () => {
  it("scores low-end phones lower", () => {
    const low = scoreDeviceCapability({
      hardwareConcurrency: 2,
      deviceMemory: 2,
      saveData: true,
      effectiveType: "3g",
    });
    const high = scoreDeviceCapability({
      hardwareConcurrency: 8,
      deviceMemory: 8,
      saveData: false,
      effectiveType: "4g",
    });
    assert.ok(low < 40);
    assert.ok(high > 55);
    assert.ok(high > low);
  });

  it("maps scores to decode budgets", () => {
    const low = scanProfileFromScore(20);
    const mid = scanProfileFromScore(50);
    const high = scanProfileFromScore(90);
    assert.equal(low.tier, "low");
    assert.equal(mid.tier, "mid");
    assert.equal(high.tier, "high");
    assert.ok(low.decodeMaxEdge < mid.decodeMaxEdge);
    assert.ok(mid.decodeMaxEdge <= high.decodeMaxEdge);
    assert.ok(low.frameSkip >= mid.frameSkip);
    assert.ok(low.video.width.ideal <= high.video.width.ideal);
  });
});

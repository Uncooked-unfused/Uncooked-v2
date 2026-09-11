import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePassPayload, passMatchesEvent } from "../src/lib/tickets/passPayload.js";

describe("parsePassPayload", () => {
  it("parses JSON pass from QR", () => {
    const pass = parsePassPayload(
      JSON.stringify({
        regId: "reg-1",
        eventId: "ev-1",
        userId: "u-1",
        sig: "abc",
      })
    );
    assert.deepEqual(pass, {
      registrationId: "reg-1",
      eventId: "ev-1",
      userId: "u-1",
      sig: "abc",
    });
  });

  it("parses pipe form", () => {
    const pass = parsePassPayload("reg-1|ev-1|u-1|sig");
    assert.equal(pass.registrationId, "reg-1");
    assert.equal(pass.sig, "sig");
  });

  it("rejects incomplete payloads", () => {
    assert.equal(parsePassPayload("{}"), null);
    assert.equal(parsePassPayload("not-json"), null);
  });

  it("matches event ids", () => {
    assert.equal(passMatchesEvent({ eventId: "ev-1" }, "ev-1"), true);
    assert.equal(passMatchesEvent({ eventId: "ev-2" }, "ev-1"), false);
    assert.equal(passMatchesEvent({ eventId: "" }, "ev-1"), true);
  });
});

import { describe, expect, it } from "vitest";

import { StripeSignatureVerifier } from "../../src/services/stripeSignatureVerifier.js";

describe("StripeSignatureVerifier", () => {
  it("accepts valid signatures and reconstructs the event", () => {
    const verifier = new StripeSignatureVerifier("whsec_unit_secret", "sk_test_123");
    const payload = JSON.stringify({
      id: "evt_unit_valid",
      object: "event",
      type: "payment_intent.succeeded"
    });
    const signature = verifier.generateTestSignatureHeader(payload);

    const event = verifier.verifyAndConstructEvent(Buffer.from(payload), signature);

    expect(event.id).toBe("evt_unit_valid");
    expect(event.type).toBe("payment_intent.succeeded");
  });

  it("rejects invalid signatures", () => {
    const verifier = new StripeSignatureVerifier("whsec_unit_secret", "sk_test_123");
    const otherSecretVerifier = new StripeSignatureVerifier("whsec_other_secret", "sk_test_123");
    const payload = JSON.stringify({
      id: "evt_unit_invalid",
      object: "event",
      type: "payment_intent.succeeded"
    });
    const invalidSignature = otherSecretVerifier.generateTestSignatureHeader(payload);

    expect(() => verifier.verifyAndConstructEvent(Buffer.from(payload), invalidSignature)).toThrow();
  });
});

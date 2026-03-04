import type Stripe from "stripe";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createTestContext } from "../helpers/createTestContext.js";

const buildStripePayload = (eventId: string): string => {
  const event: Stripe.Event = {
    id: eventId,
    object: "event",
    api_version: "2023-10-16",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: "ch_test",
        object: "charge"
      }
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null
    },
    type: "charge.succeeded"
  } as Stripe.Event;

  return JSON.stringify(event);
};

describe("Stripe webhook endpoint", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    for (const cleanup of cleanups.splice(0, cleanups.length)) {
      cleanup();
    }
  });

  it("persists and processes valid events once, then deduplicates retries", async () => {
    const context = createTestContext();
    cleanups.push(context.cleanup);

    const payload = buildStripePayload("evt_integration_duplicate");
    const signature = context.signatureVerifier.generateTestSignatureHeader(payload);

    const firstResponse = await request(context.app)
      .post("/webhooks/stripe")
      .set("content-type", "application/json")
      .set("stripe-signature", signature)
      .send(payload);

    const secondResponse = await request(context.app)
      .post("/webhooks/stripe")
      .set("content-type", "application/json")
      .set("stripe-signature", signature)
      .send(payload);

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.received).toBe(true);
    expect(firstResponse.body.duplicate).toBe(false);
    expect(firstResponse.body.outcome).toBe("processed");

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.received).toBe(true);
    expect(secondResponse.body.duplicate).toBe(true);

    expect(context.downstreamCalls).toEqual(["evt_integration_duplicate"]);
    expect(context.repository.getByEventId("evt_integration_duplicate")?.status).toBe("processed");
  });

  it("rejects invalid signatures and does not persist the payload", async () => {
    const context = createTestContext();
    cleanups.push(context.cleanup);

    const payload = buildStripePayload("evt_integration_invalid");
    const invalidSignature = "t=1700000000,v1=invalid";

    const response = await request(context.app)
      .post("/webhooks/stripe")
      .set("content-type", "application/json")
      .set("stripe-signature", invalidSignature)
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid Stripe signature");
    expect(context.repository.getByEventId("evt_integration_invalid")).toBeNull();
    expect(context.downstreamCalls).toEqual([]);
  });
});

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import type Stripe from "stripe";

import { createDatabase } from "../../src/db/database.js";
import { DownstreamError } from "../../src/lib/errors.js";
import { createLogger } from "../../src/lib/logger.js";
import { WebhookEventRepository } from "../../src/repositories/webhookEventRepository.js";
import { EventProcessor } from "../../src/services/eventProcessor.js";
import { createTestConfig } from "../helpers/createTestContext.js";

const buildStripeEvent = (eventId: string): Stripe.Event =>
  ({
    id: eventId,
    object: "event",
    api_version: "2023-10-16",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: "pi_test",
        object: "payment_intent"
      }
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null
    },
    type: "payment_intent.succeeded"
  }) as Stripe.Event;

interface LocalHarness {
  repository: WebhookEventRepository;
  databasePath: string;
  cleanup: () => void;
}

const createHarness = (): LocalHarness => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stripe-processor-unit-"));
  const databasePath = path.join(tempDir, "events.db");
  const database = createDatabase(databasePath);
  const repository = new WebhookEventRepository(database);

  return {
    repository,
    databasePath,
    cleanup: () => {
      repository.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
};

describe("EventProcessor", () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    for (const cleanup of cleanups.splice(0, cleanups.length)) {
      cleanup();
    }
  });

  it("processes a stored event exactly once", async () => {
    const harness = createHarness();
    cleanups.push(harness.cleanup);

    const config = createTestConfig(harness.databasePath);
    const logger = createLogger(config);
    const event = buildStripeEvent("evt_unit_process_once");

    harness.repository.insertIfMissing({
      event,
      payload: JSON.stringify(event),
      signature: "sig_1"
    });

    const calls: string[] = [];
    const processor = new EventProcessor({
      config,
      repository: harness.repository,
      logger,
      downstreamHandler: async (downstreamEvent) => {
        calls.push(downstreamEvent.id);
      }
    });

    const firstOutcome = await processor.processByEventId(event.id);
    const secondOutcome = await processor.processByEventId(event.id);

    expect(firstOutcome).toBe("processed");
    expect(secondOutcome).toBe("duplicate");
    expect(calls).toEqual([event.id]);
    expect(harness.repository.getByEventId(event.id)?.status).toBe("processed");
  });

  it("schedules a retry for transient downstream failures", async () => {
    const harness = createHarness();
    cleanups.push(harness.cleanup);

    const config = createTestConfig(harness.databasePath);
    const logger = createLogger(config);
    const event = buildStripeEvent("evt_unit_transient");

    harness.repository.insertIfMissing({
      event,
      payload: JSON.stringify(event),
      signature: "sig_2"
    });

    const processor = new EventProcessor({
      config,
      repository: harness.repository,
      logger,
      downstreamHandler: async () => {
        throw new DownstreamError("temporary outage", true);
      }
    });

    const outcome = await processor.processByEventId(event.id);
    const stored = harness.repository.getByEventId(event.id);

    expect(outcome).toBe("scheduled_retry");
    expect(stored?.status).toBe("retry_pending");
    expect(stored?.nextRetryAt).not.toBeNull();
    expect(stored?.processAttempts).toBe(1);
  });

  it("marks events as failed for non-transient errors", async () => {
    const harness = createHarness();
    cleanups.push(harness.cleanup);

    const config = createTestConfig(harness.databasePath);
    const logger = createLogger(config);
    const event = buildStripeEvent("evt_unit_permanent");

    harness.repository.insertIfMissing({
      event,
      payload: JSON.stringify(event),
      signature: "sig_3"
    });

    const processor = new EventProcessor({
      config,
      repository: harness.repository,
      logger,
      downstreamHandler: async () => {
        throw new DownstreamError("invalid payload for downstream", false);
      }
    });

    const outcome = await processor.processByEventId(event.id);
    const stored = harness.repository.getByEventId(event.id);

    expect(outcome).toBe("failed");
    expect(stored?.status).toBe("failed");
    expect(stored?.processAttempts).toBe(1);
    expect(stored?.lastError).toContain("invalid payload for downstream");
  });
});

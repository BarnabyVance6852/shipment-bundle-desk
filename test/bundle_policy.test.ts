import assert from "node:assert/strict";
import test from "node:test";
import { bundleRequestSchema, planBundle } from "../src/bundle_policy.js";

test("an exception routes the bundle to review and preserves chronological order", () => {
  const input = bundleRequestSchema.parse({
    shipmentId: "SHP-2048",
    documentPdf: "base64-shipment-document",
    events: [
      { kind: "delivery_exception", occurredAt: "2026-08-20T11:00:00.000Z", pageRange: "3" },
      { kind: "picked_up", occurredAt: "2026-08-20T09:00:00.000Z", pageRange: "1-2" },
    ],
    proofs: [
      { pdf: "second-proof", receivedAt: "2026-08-20T12:10:00.000Z" },
      { pdf: "first-proof", receivedAt: "2026-08-20T12:00:00.000Z" },
    ],
  });

  assert.deepEqual(planBundle(input), {
    disposition: "exception_review",
    ranges: ["1-2", "3"],
    mergeInputs: ["first-proof", "second-proof"],
  });
});

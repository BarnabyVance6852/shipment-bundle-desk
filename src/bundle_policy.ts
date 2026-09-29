import { z } from "zod";

const eventSchema = z.object({
  kind: z.enum(["picked_up", "in_transit", "delivered", "delivery_exception"]),
  occurredAt: z.string().datetime(),
  pageRange: z.union([
    z.string().regex(/^\d+(?:-\d+)?$/),
    z.number().int().positive(),
    z.tuple([z.number().int().positive(), z.number().int().positive()]),
  ]),
});

const proofSchema = z.object({
  pdf: z.string().min(1),
  receivedAt: z.string().datetime(),
});

export const bundleRequestSchema = z.object({
  shipmentId: z.string().min(1),
  documentPdf: z.string().min(1),
  events: z.array(eventSchema).min(1),
  proofs: z.array(proofSchema).min(1),
});

export type BundleRequest = z.infer<typeof bundleRequestSchema>;

export type BundlePlan = {
  disposition: "archive" | "exception_review";
  ranges: (string | number | [number, number])[];
  mergeInputs: string[];
};

export function planBundle(input: BundleRequest): BundlePlan {
  const orderedEvents = [...input.events].sort((a, b) =>
    a.occurredAt.localeCompare(b.occurredAt),
  );
  const hasException = orderedEvents.some((event) => event.kind === "delivery_exception");

  return {
    disposition: hasException ? "exception_review" : "archive",
    ranges: orderedEvents.map((event) => {
      const range = event.pageRange;
      return Array.isArray(range)
        ? ([range[0]!, range[1]!] as [number, number])
        : range;
    }),
    mergeInputs: [...input.proofs]
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
      .map((proof) => proof.pdf),
  };
}

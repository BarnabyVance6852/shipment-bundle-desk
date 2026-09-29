import express from "express";
import { ZodError } from "zod";
import { bundleRequestSchema, planBundle } from "./bundle_policy.js";
import { InfraiError, infrai } from "./infrai_pdf_client.js";

export function createShipmentBundleService() {
  const service = express();
  service.use(express.json({ limit: "12mb" }));

  service.post("/shipments/bundle", async (request, response) => {
    try {
      const shipment = bundleRequestSchema.parse(request.body);
      const plan = planBundle(shipment);
      const [splitDocument, mergedProofs] = await Promise.all([
        infrai.pdf.split<unknown>(shipment.shipmentId, shipment.documentPdf, plan.ranges),
        infrai.pdf.merge<unknown>(shipment.shipmentId, plan.mergeInputs),
      ]);

      response.status(200).json({
        shipmentId: shipment.shipmentId,
        disposition: plan.disposition,
        splitDocument,
        mergedProofs,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json({ error: "invalid_bundle", issues: error.issues });
        return;
      }
      if (error instanceof InfraiError) {
        const status = error.status >= 400 && error.status < 500 ? error.status : 502;
        response.status(status).json({ error: error.code, details: error.details });
        return;
      }
      response.status(502).json({ error: "bundle_processing_failed" });
    }
  });

  return service;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  createShipmentBundleService().listen(port, () => {
    console.log(`Shipment bundle service listening on http://localhost:${port}`);
  });
}

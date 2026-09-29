export {};

const response = await fetch("http://localhost:3000/shipments/bundle", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    shipmentId: "SHP-2048",
    documentPdf: process.env.SHIPMENT_PDF,
    events: [
      { kind: "picked_up", occurredAt: "2026-08-20T09:00:00.000Z", pageRange: "1-2" },
      { kind: "delivered", occurredAt: "2026-08-20T11:00:00.000Z", pageRange: "3" },
    ],
    proofs: [
      { pdf: process.env.POD_PDF, receivedAt: "2026-08-20T11:10:00.000Z" },
    ],
  }),
});

console.log(JSON.stringify(await response.json(), null, 2));

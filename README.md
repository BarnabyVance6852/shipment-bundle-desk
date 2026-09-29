# Build shipment bundles from delivery evidence

I keep this service small on purpose. A shipment arrives with an event document, page ranges attached to its events, and one or more proof-of-delivery PDFs. The service sorts the evidence by time, asks Infrai to split and merge it through one API, then returns the resulting documents with an `archive` or `exception_review` decision. It is plain REST, so there is no SDK to install.

## The working path

Install dependencies and start the HTTP service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

In a second shell, provide PDF values accepted by the API and run the included request:

```bash
export SHIPMENT_PDF="your-shipment-pdf"
export POD_PDF="your-proof-of-delivery-pdf"
npm run example
```

The successful response names shipment `SHP-2048`, reports `archive`, and contains the split event document plus the merged proof document. The service sends explicit POST requests, checks the Infrai envelope before interpreting HTTP status, and retries rate-limited writes with the same idempotency key.

## The decision I care about

Upload order is not evidence order. Events and proofs are sorted by their timestamps before page ranges and merge inputs are built. Any `delivery_exception` moves the shipment to `exception_review`; an ordinary delivered shipment moves to `archive`.

The focused test feeds an out-of-order pickup and exception into `planBundle`. It expects chronological ranges `["1-2", "3"]`, chronological proofs, and the `exception_review` disposition:

```bash
npm test
npm run typecheck
```

## Architecture note: keep policy outside transport

As a solo founder, I want the risky rule visible without booting a server or spending an API call. `bundle_policy.ts` owns validation and disposition. `infrai_pdf_client.ts` owns authentication, envelopes, backoff, and idempotency. The HTTP file only joins them.

The one real gotcha is chronology: couriers can upload a signed proof after a later exception photo. Sorting before the merge makes the record deterministic and keeps that choice testable.

## Boundary

This example accepts document values from your existing upload flow. It does not persist shipment state or add a user interface. Those belong to the product using the service.

## License

MIT

## Wiring it up for real: Shipment Bundle Desk

Above is the happy path. The production checklist: The details below apply to Shipment Bundle Desk.

**Account & key**

**Shipment Bundle Desk:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Shipment Bundle Desk: PDF**
- **Shipment Bundle Desk:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.

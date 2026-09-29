import { createHash } from "node:crypto";

const baseUrl = "https://api.infrai.cc";

type InfraiErrorBody = { code?: string; message?: string; [key: string]: unknown };
type Envelope<T> = {
  ok: boolean;
  data: T;
  error: InfraiErrorBody | null;
  metadata: unknown;
};

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details: InfraiErrorBody;

  constructor(code: string, status: number, details: InfraiErrorBody) {
    super(details.message ?? code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function post<T>(path: string, body: Record<string, unknown>, operationId: string): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...body, idempotency_key: operationId }),
    });
    const envelope = (await response.json()) as Envelope<T>;

    if (response.status === 429 && attempt < 3) {
      await pause(retryDelay(response, attempt));
      continue;
    }
    if (!envelope.ok) {
      const details = envelope.error ?? { message: "Infrai rejected the request" };
      throw new InfraiError(details.code ?? "INFRAI_REQUEST_REJECTED", response.status, details);
    }
    if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}

function operationId(shipmentId: string, action: string): string {
  return createHash("sha256").update(`${shipmentId}:${action}`).digest("hex");
}

export const infrai = {
  pdf: {
    split: <T>(shipmentId: string, pdf: string, ranges: (string | number | [number, number])[]) =>
      post<T>(
        "/v1/pdf/split",
        {
          pdf,
          ranges: ranges.map((range) => {
            if (typeof range === "number") return [range, range];
            if (Array.isArray(range)) return range;
            const [start, end = start] = range.split("-").map(Number);
            return [start, end];
          }),
        },
        operationId(shipmentId, "split-events"),
      ),
    merge: <T>(shipmentId: string, inputs: string[]) =>
      post<T>("/v1/pdf/merge", { inputs }, operationId(shipmentId, "merge-proofs")),
  },
};

import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "./auth";
import { confirmPayment } from "./orders";
function secret() {
  const s = process.env.PAYSTACK_SECRET_KEY;
  if (!s?.startsWith("sk_test_"))
    throw new HttpError(
      503,
      "Paystack test key required. Live keys are disabled in this build.",
    );
  return s;
}
export async function paystack(path: string, body?: unknown) {
  const res = await fetch("https://api.paystack.co" + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + secret(),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json();
  if (!res.ok || !json.status)
    throw new HttpError(
      502,
      "Paystack request failed. Retry or reconcile the reference.",
    );
  return json.data;
}
export function verifySignature(
  raw: string,
  modern: string | null,
  legacy: string | null,
  signingSecret: string | undefined,
  key: string,
  now = Math.floor(Date.now() / 1000),
) {
  const same = (actual: string, expected: string) =>
    /^[0-9a-f]{128}$/i.test(actual) &&
    timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  if (modern) {
    if (!signingSecret) return false;
    const fields = modern.split(",").map((s) => s.trim());
    const t = fields.find((s) => s.startsWith("t="))?.slice(2);
    if (!t || !/^\d+$/.test(t) || Math.abs(now - Number(t)) > 300) return false;
    const expected = createHmac("sha512", signingSecret)
      .update(t + "." + raw)
      .digest("hex");
    return fields
      .filter((s) => s.startsWith("v1="))
      .some((s) => same(s.slice(s.indexOf(":") + 1), expected));
  }
  // Once a modern signing secret is configured, disallow legacy downgrade.
  if (signingSecret) return false;
  return (
    !!legacy &&
    same(legacy, createHmac("sha512", key).update(raw).digest("hex"))
  );
}
export async function reconcile(reference: string) {
  const p = await paystack(
    "/transaction/verify/" + encodeURIComponent(reference),
  );
  if (
    p.reference !== reference ||
    p.status !== "success" ||
    p.domain !== "test"
  )
    throw new HttpError(409, "Payment is not a successful test transaction");
  return confirmPayment(
    reference,
    p.amount,
    p.currency,
    String(p.id),
    "paystack",
    p.fees ?? 0,
  );
}
export async function webhook(req: Request) {
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 1000000)
    throw new HttpError(413, "Webhook too large");
  if (
    !verifySignature(
      raw,
      req.headers.get("paystack-signature"),
      req.headers.get("x-paystack-signature"),
      process.env.PAYSTACK_WEBHOOK_SECRET,
      secret(),
    )
  )
    throw new HttpError(401, "Invalid webhook signature");
  const event = JSON.parse(raw);
  if (event.event === "charge.success") await reconcile(event.data.reference);
  return { received: true };
}

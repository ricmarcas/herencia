import crypto from "crypto";

type OfferPayload = {
  email: string;
  exp: number;
};

type VerifiedOffer =
  | { valid: true; email: string; exp: number }
  | { valid: false; reason: string };

function getSecret(): string {
  return (
    process.env.NPS_OFFER_SECRET ??
    process.env.CRON_SECRET ??
    process.env.STRIPE_WEBHOOK_SECRET ??
    "nps-offer-dev-secret"
  );
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signValue(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function createNpsOfferToken(emailRaw: string, validDays = 7): string {
  const email = String(emailRaw).trim().toLowerCase();
  const exp = Date.now() + validDays * 24 * 60 * 60 * 1000;
  const payload: OfferPayload = { email, exp };
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signature = signValue(payloadEncoded);
  return `${payloadEncoded}.${signature}`;
}

export function verifyNpsOfferToken(tokenRaw: string): VerifiedOffer {
  const token = String(tokenRaw ?? "").trim();
  if (!token.includes(".")) {
    return { valid: false, reason: "invalid_format" };
  }

  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) {
    return { valid: false, reason: "invalid_parts" };
  }

  const expectedSignature = signValue(payloadEncoded);
  if (expectedSignature !== signature) {
    return { valid: false, reason: "invalid_signature" };
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payloadEncoded)) as Partial<OfferPayload>;
    const email = String(parsed.email ?? "").trim().toLowerCase();
    const exp = Number(parsed.exp ?? 0);

    if (!email || !Number.isFinite(exp) || exp <= 0) {
      return { valid: false, reason: "invalid_payload" };
    }

    if (Date.now() > exp) {
      return { valid: false, reason: "expired" };
    }

    return { valid: true, email, exp };
  } catch {
    return { valid: false, reason: "invalid_json" };
  }
}

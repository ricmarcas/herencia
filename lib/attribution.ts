export type CheckoutAttribution = {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  gclid: string;
  landingPath: string;
  referrer: string;
  attributionModel: "last_touch";
};

const STORAGE_KEY = "herencia_checkout_attribution_v1";

function trimTo(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function emptyAttribution(pathname = "/"): CheckoutAttribution {
  return {
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    utmContent: "",
    utmTerm: "",
    gclid: "",
    landingPath: pathname,
    referrer: "",
    attributionModel: "last_touch",
  };
}

function hasCampaignParams(value: CheckoutAttribution): boolean {
  return Boolean(
    value.utmSource ||
      value.utmMedium ||
      value.utmCampaign ||
      value.utmContent ||
      value.utmTerm ||
      value.gclid
  );
}

function parseFromWindow(): CheckoutAttribution {
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: trimTo(params.get("utm_source") ?? "", 100),
    utmMedium: trimTo(params.get("utm_medium") ?? "", 100),
    utmCampaign: trimTo(params.get("utm_campaign") ?? "", 150),
    utmContent: trimTo(params.get("utm_content") ?? "", 150),
    utmTerm: trimTo(params.get("utm_term") ?? "", 150),
    gclid: trimTo(params.get("gclid") ?? "", 150),
    landingPath: trimTo(window.location.pathname || "/", 200),
    referrer: trimTo(document.referrer || "", 500),
    attributionModel: "last_touch",
  };
}

function readStoredAttribution(): CheckoutAttribution | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CheckoutAttribution>;
    return {
      utmSource: trimTo(String(parsed.utmSource ?? ""), 100),
      utmMedium: trimTo(String(parsed.utmMedium ?? ""), 100),
      utmCampaign: trimTo(String(parsed.utmCampaign ?? ""), 150),
      utmContent: trimTo(String(parsed.utmContent ?? ""), 150),
      utmTerm: trimTo(String(parsed.utmTerm ?? ""), 150),
      gclid: trimTo(String(parsed.gclid ?? ""), 150),
      landingPath: trimTo(String(parsed.landingPath ?? "/"), 200),
      referrer: trimTo(String(parsed.referrer ?? ""), 500),
      attributionModel: "last_touch",
    };
  } catch {
    return null;
  }
}

function writeStoredAttribution(value: CheckoutAttribution): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore storage errors (private mode, quota, etc.).
  }
}

export function persistAttributionFromWindow(): CheckoutAttribution {
  const current = parseFromWindow();
  const previous = readStoredAttribution();

  const merged = hasCampaignParams(current)
    ? current
    : previous ?? current;

  writeStoredAttribution(merged);
  return merged;
}

export function getCheckoutAttributionFromStorage(): CheckoutAttribution {
  if (typeof window === "undefined") {
    return emptyAttribution("/");
  }

  const stored = readStoredAttribution();
  if (stored) {
    return stored;
  }

  const current = parseFromWindow();
  return hasCampaignParams(current) ? current : emptyAttribution(window.location.pathname || "/");
}

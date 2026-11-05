// First-touch campaign tracking: the first time someone arrives with
// utm_* parameters (or from another site), remember it, so a registration
// made later in the visit — or on a return visit — can be traced back to
// the post or partner that brought them.

const STORAGE_KEY = "ify.attribution";

export interface Attribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
}

function clean(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 100) : undefined;
}

export function readAttribution(): Attribution {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : {};
  } catch {
    return {};
  }
}

export function captureAttribution() {
  try {
    if (window.localStorage.getItem(STORAGE_KEY)) return;

    const params = new URLSearchParams(window.location.search);
    const found: Attribution = {
      utmSource: clean(params.get("utm_source")),
      utmMedium: clean(params.get("utm_medium")),
      utmCampaign: clean(params.get("utm_campaign")),
    };

    // Only an outside site counts as a referrer, not our own navigation.
    if (document.referrer) {
      const referrer = new URL(document.referrer);
      if (referrer.hostname !== window.location.hostname) {
        found.referrer = referrer.hostname.slice(0, 200);
      }
    }

    if (Object.values(found).some(Boolean)) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(found));
    }
  } catch {
    // Storage blocked or a malformed referrer: tracking is best-effort.
  }
}

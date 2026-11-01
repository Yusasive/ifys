const STATION_ID_KEY = "ify-checkin-station-id";
const STATION_NAME_KEY = "ify-checkin-station-name";

function generatedId(): string {
  let id = window.localStorage.getItem(STATION_ID_KEY);
  if (!id) {
    id = `station-${crypto.randomUUID().slice(0, 8)}`;
    window.localStorage.setItem(STATION_ID_KEY, id);
  }
  return id;
}

export function getStationName(): string {
  return window.localStorage.getItem(STATION_NAME_KEY) ?? "";
}

export function setStationName(name: string) {
  const trimmed = name.trim().slice(0, 40);
  if (trimmed) window.localStorage.setItem(STATION_NAME_KEY, trimmed);
  else window.localStorage.removeItem(STATION_NAME_KEY);
}

// Per-device identity for the door station — not the door staff user (that's
// the JWT), the physical kiosk/phone doing the scanning. It is what the
// "first scanned at…" dispute info shows, so a name staff chose ("Main gate")
// wins over the generated id, which stays as the fallback.
export function getStationId(): string {
  return getStationName() || generatedId();
}

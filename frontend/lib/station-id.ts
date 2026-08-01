const STATION_ID_KEY = "ify-checkin-station-id";

// Persistent per-device identity for the door station — not the door
// staff user (that's the JWT), the physical kiosk/phone doing the
// scanning. Used for the "who/when it was first scanned" dispute info.
export function getStationId(): string {
  let id = window.localStorage.getItem(STATION_ID_KEY);
  if (!id) {
    id = `station-${crypto.randomUUID().slice(0, 8)}`;
    window.localStorage.setItem(STATION_ID_KEY, id);
  }
  return id;
}

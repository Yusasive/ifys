import { useEffect, useState } from "react";

function readNavigatorOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

// navigator.onLine only reflects link-layer connectivity (e.g. "joined a
// WiFi network"), not real internet reachability, so callers should
// still treat a failed fetch as an offline signal on top of this.
export function useOnlineStatus() {
  const [online, setOnline] = useState(readNavigatorOnline);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}

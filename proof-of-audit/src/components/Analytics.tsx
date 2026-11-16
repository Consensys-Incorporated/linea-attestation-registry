import { useEffect } from "react";

const GA_ID = import.meta.env.VITE_GA_ID;
const GOOGLE_ANALYTICS_SCRIPT_ID = "google-analytics-script";
const ANALYTICS_DELAY_MS = 5_000;

const scheduleIdleWork = (callback: () => void): (() => void) => {
  const requestIdleCallback =
    typeof window.requestIdleCallback === "function" ? window.requestIdleCallback.bind(window) : undefined;

  if (requestIdleCallback) {
    const handle = requestIdleCallback(callback, { timeout: 2_000 });
    return () => window.cancelIdleCallback(handle);
  }

  const timeoutId = window.setTimeout(callback, 1);
  return () => window.clearTimeout(timeoutId);
};

const schedulePostLoadIdleWork = (callback: () => void): (() => void) => {
  let cancelIdleWork: (() => void) | undefined;
  let delayHandle: number | undefined;

  const scheduleDelayedIdleWork = () => {
    delayHandle = window.setTimeout(() => {
      cancelIdleWork = scheduleIdleWork(callback);
    }, ANALYTICS_DELAY_MS);
  };

  if (document.readyState === "complete") {
    scheduleDelayedIdleWork();
  } else {
    window.addEventListener("load", scheduleDelayedIdleWork, { once: true });
  }

  return () => {
    window.removeEventListener("load", scheduleDelayedIdleWork);

    if (delayHandle) {
      window.clearTimeout(delayHandle);
    }

    cancelIdleWork?.();
  };
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const Analytics = () => {
  useEffect(() => {
    if (!GA_ID || document.getElementById(GOOGLE_ANALYTICS_SCRIPT_ID)) {
      return;
    }

    return schedulePostLoadIdleWork(() => {
      window.dataLayer = window.dataLayer ?? [];
      window.gtag = (...args: unknown[]) => {
        window.dataLayer?.push(args);
      };

      window.gtag("js", new Date());
      window.gtag("config", GA_ID);

      const script = document.createElement("script");
      script.id = GOOGLE_ANALYTICS_SCRIPT_ID;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
      script.async = true;
      document.head.append(script);
    });
  }, []);

  return null;
};

export default Analytics;

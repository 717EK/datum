/**
 * PWA plumbing: service-worker registration, update detection, and install
 * prompting that adapts to where the app is running.
 *
 *  - Installed (standalone window / home-screen icon): no install button; the
 *    update check still runs and offers "Update available".
 *  - Browser tab on Chromium (desktop Chrome/Edge, Android): native install
 *    prompt via `beforeinstallprompt`.
 *  - Browser tab on iOS Safari / other browsers without the prompt: an
 *    instruction sheet ("Share → Add to Home Screen").
 *  - file:// or plain http (not localhost): service workers are unavailable,
 *    so install + updates are hidden and the caller is told why.
 *
 * Update flow: the build stamps `sw.js` with a content hash, so any deploy
 * changes the SW bytes → the browser installs the new worker → we surface an
 * "Update available" popup. Accepting posts SKIP_WAITING; when the new worker
 * takes control we reload once, and the new precache (app, styles, manifest,
 * icons) is what the reloaded page gets.
 */

export type InstallMode =
  | "installed" // running as an installed app
  | "prompt" // browser exposes a native install prompt
  | "manual" // installable, but only through browser UI (iOS Safari etc.)
  | "unavailable"; // no SW context (file://, insecure origin)

export interface PwaCallbacks {
  /** Called whenever the install situation changes. */
  onInstallMode(mode: InstallMode, detail: { reason?: string; platform: "ios" | "android" | "desktop" }): void;
  /** A new version is waiting; call `apply()` to switch to it and reload. */
  onUpdateAvailable(apply: () => void, version: string | null): void;
  /** The app was just installed (from our prompt or browser UI). */
  onInstalled?(): void;
  /** Update check status, for a small "Checking…" affordance. */
  onCheckState?(state: "checking" | "up-to-date" | "error", version: string | null): void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    nav.standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

export function platformKind(): "ios" | "android" | "desktop" {
  const ua = navigator.userAgent;
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 0;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function swSupported(): { ok: boolean; reason?: string } {
  if (location.protocol === "file:") {
    return { ok: false, reason: "Opened from a local file — serve it over http(s) to install." };
  }
  if (!("serviceWorker" in navigator)) {
    return { ok: false, reason: "This browser has no service-worker support." };
  }
  if (!window.isSecureContext) {
    return { ok: false, reason: "Not a secure origin (needs https:// or localhost)." };
  }
  return { ok: true };
}

export interface PwaHandle {
  /** Trigger the install flow (native prompt, or resolves false when manual). */
  install(): Promise<boolean>;
  /** Ask the SW registration to check for a newer build now. */
  checkForUpdate(): Promise<void>;
  mode(): InstallMode;
  version: string;
}

export function initPwa(appVersion: string, cb: PwaCallbacks): PwaHandle {
  const platform = platformKind();
  let mode: InstallMode = "unavailable";
  let deferredPrompt: BeforeInstallPromptEvent | null = null;
  let registration: ServiceWorkerRegistration | null = null;
  let reloading = false;
  let updateRequested = false;
  let offeredWorker: ServiceWorker | null = null;

  const setMode = (m: InstallMode, reason?: string) => {
    mode = m;
    cb.onInstallMode(m, { reason, platform });
  };

  // --- Install ------------------------------------------------------------
  const support = swSupported();
  if (isStandalone()) {
    setMode("installed");
  } else if (!support.ok) {
    setMode("unavailable", support.reason);
  } else {
    // Until the browser fires beforeinstallprompt we can only offer manual steps.
    setMode("manual");
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    if (mode !== "installed") setMode("prompt");
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    setMode("installed");
    cb.onInstalled?.();
  });
  // Moving between a tab and the installed window flips display-mode.
  window.matchMedia("(display-mode: standalone)").addEventListener("change", (e) => {
    if (e.matches) setMode("installed");
  });

  async function install(): Promise<boolean> {
    if (!deferredPrompt) return false;
    const p = deferredPrompt;
    deferredPrompt = null;
    await p.prompt();
    const choice = await p.userChoice;
    if (choice.outcome !== "accepted") {
      // The browser only fires beforeinstallprompt once per page load; after a
      // dismissal, fall back to manual instructions.
      setMode("manual");
      return false;
    }
    return true;
  }

  // --- Service worker + updates -------------------------------------------
  function offerUpdate(worker: ServiceWorker): void {
    if (offeredWorker === worker) return;
    offeredWorker = worker;
    const apply = () => {
      if (worker.state === "activated") {
        // Already active (e.g. skipWaiting ran elsewhere): just reload.
        location.reload();
        return;
      }
      updateRequested = true;
      worker.postMessage({ type: "SKIP_WAITING" });
      // Safety net: if controllerchange never fires (Safari quirks), reload anyway.
      window.setTimeout(() => {
        if (!reloading) {
          reloading = true;
          location.reload();
        }
      }, 4000);
    };
    cb.onUpdateAvailable(apply, null);
  }

  function watchInstalling(reg: ServiceWorkerRegistration): void {
    const nw = reg.installing;
    if (!nw) return;
    nw.addEventListener("statechange", () => {
      if (nw.state === "installed") {
        if (navigator.serviceWorker.controller) {
          // An older worker controls the page → this is an update.
          offerUpdate(nw);
        } else {
          cb.onCheckState?.("up-to-date", appVersion);
        }
      }
    });
  }

  async function register(): Promise<void> {
    if (!support.ok) return;
    try {
      // On the very first install the new worker claims the page (clients.claim)
      // and fires controllerchange too — that is not an update, don't reload.
      const hadController = !!navigator.serviceWorker.controller;
      const reg = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
      registration = reg;
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      if (reg.installing) watchInstalling(reg);
      reg.addEventListener("updatefound", () => watchInstalling(reg));

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading || (!hadController && !updateRequested)) return;
        reloading = true;
        location.reload();
      });

      // Re-check periodically and whenever the app comes back into view.
      const HOUR = 60 * 60 * 1000;
      window.setInterval(() => void checkForUpdate(), HOUR);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void checkForUpdate();
      });
      window.addEventListener("online", () => void checkForUpdate());
      window.addEventListener("focus", () => void checkForUpdate());
    } catch (err) {
      console.warn("[STEP Viewer] service worker registration failed", err);
      cb.onCheckState?.("error", null);
    }
  }

  let lastCheck = 0;
  async function checkForUpdate(): Promise<void> {
    if (!registration) return;
    // Debounce: focus + visibilitychange often fire together.
    const now = Date.now();
    if (now - lastCheck < 10_000) return;
    lastCheck = now;
    cb.onCheckState?.("checking", appVersion);
    try {
      await registration.update();
      if (registration.waiting && navigator.serviceWorker.controller) {
        offerUpdate(registration.waiting);
      } else if (!registration.installing) {
        cb.onCheckState?.("up-to-date", appVersion);
      }
    } catch (err) {
      console.warn("[STEP Viewer] update check failed", err);
      cb.onCheckState?.("error", appVersion);
    }
  }

  if (document.readyState === "complete") void register();
  else window.addEventListener("load", () => void register());

  return {
    install,
    checkForUpdate: async () => {
      lastCheck = 0;
      await checkForUpdate();
    },
    mode: () => mode,
    version: appVersion,
  };
}

/**
 * @vitest-environment jsdom
 *
 * Offline support belongs in a browser and nowhere near the native shell.
 *
 * Inside the APK every asset is already on local disk, so a cache saves
 * nothing and only shadows the app's own files with an older copy. A freshly
 * installed APK was observed serving the previous build's bundle on a Moto G7.
 *
 * The case that matters most here is the second one: an app that already has a
 * worker registered from a previous version. Declining to register does
 * nothing for it, because the registration and its cache outlive the update.
 * Those are precisely the installs that would otherwise stay broken forever,
 * so the teardown is the behaviour under test, not the skipping.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { setUpServiceWorker } from "../src/register-sw.js";

interface Harness {
  register: ReturnType<typeof vi.fn>;
  unregister: ReturnType<typeof vi.fn>;
  deleted: string[];
}

function harness(opts: { native: boolean; registrations: number; caches: string[] }): Harness {
  const unregister = vi.fn(() => Promise.resolve(true));
  const register = vi.fn(() =>
    Promise.resolve({ addEventListener: vi.fn(), installing: null }),
  );
  const deleted: string[] = [];
  const registrations = Array.from({ length: opts.registrations }, () => ({ unregister }));

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register,
      controller: null,
      getRegistrations: () => Promise.resolve(registrations),
    },
  });

  Object.defineProperty(window, "caches", {
    configurable: true,
    value: {
      keys: () => Promise.resolve([...opts.caches]),
      delete: (name: string) => {
        deleted.push(name);
        return Promise.resolve(true);
      },
    },
  });

  const globals = window as unknown as Record<string, unknown>;
  if (opts.native) {
    globals["Capacitor"] = { isNativePlatform: () => true, getPlatform: () => "android" };
  } else {
    delete globals["Capacitor"];
  }

  return { register, unregister, deleted };
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>)["Capacitor"];
});

describe("in a browser", () => {
  it("registers the worker, because there the cache is the whole point", async () => {
    const h = harness({ native: false, registrations: 0, caches: [] });
    setUpServiceWorker();
    window.dispatchEvent(new Event("load"));
    await vi.waitFor(() => expect(h.register).toHaveBeenCalledWith("./sw.js", { scope: "./" }));
  });

  it("leaves existing caches alone", async () => {
    const h = harness({ native: false, registrations: 1, caches: ["shell-abc"] });
    setUpServiceWorker();
    window.dispatchEvent(new Event("load"));
    await vi.waitFor(() => expect(h.register).toHaveBeenCalled());
    expect(h.unregister).not.toHaveBeenCalled();
    expect(h.deleted).toEqual([]);
  });
});

describe("inside the native shell", () => {
  it("never registers a worker, and does not even wait for load to decide", async () => {
    const h = harness({ native: true, registrations: 0, caches: [] });
    // Asserted through addEventListener rather than by firing a load event.
    // Listeners added by the browser cases above outlive their tests on this
    // shared jsdom window, so a dispatched load would run those too and count
    // their registrations against this spy. Checking that nothing subscribes is
    // both immune to that and a stronger claim.
    const listen = vi.spyOn(window, "addEventListener");
    try {
      setUpServiceWorker();
      const loadListeners = listen.mock.calls.filter(([type]) => type === "load");
      expect(loadListeners).toEqual([]);
      expect(h.register).not.toHaveBeenCalled();
    } finally {
      listen.mockRestore();
    }
  });

  it("unregisters a worker left behind by an earlier version", async () => {
    const h = harness({ native: true, registrations: 2, caches: [] });
    setUpServiceWorker();
    await vi.waitFor(() => expect(h.unregister).toHaveBeenCalledTimes(2));
    expect(h.register).not.toHaveBeenCalled();
  });

  it("deletes every cache, since nothing here should be caching at all", async () => {
    const h = harness({
      native: true,
      registrations: 1,
      caches: ["shell-3443b2298659", "shell-older"],
    });
    setUpServiceWorker();
    await vi.waitFor(() => expect(h.deleted).toEqual(["shell-3443b2298659", "shell-older"]));
  });

  it("survives a WebView that refuses the cache API", async () => {
    harness({ native: true, registrations: 1, caches: [] });
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: {
        keys: () => Promise.reject(new Error("not supported")),
        delete: () => Promise.resolve(true),
      },
    });
    // The failure is swallowed on purpose: the app keeps working exactly as it
    // did, and there is nothing an artist could do about it.
    expect(() => setUpServiceWorker()).not.toThrow();
  });
});

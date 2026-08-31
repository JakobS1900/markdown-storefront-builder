/**
 * Getting a file out of the app.
 *
 * In a browser this is an anchor carrying a `download` attribute, which is the
 * whole story. Inside the Android shell that anchor is inert: the WebView
 * ignores a `blob:` link unless the native side registers a download handler,
 * and Capacitor does not. Both export buttons produced nothing on a real phone
 * while announcing that they had, which is worse than not offering them, since
 * one of them is the escape hatch for someone's only copy of their page.
 *
 * So the shell exposes a small bridge, and this decides which route to take and
 * reports back honestly. The caller says what happened; it never assumes.
 */

interface NativeFiles {
  /** Returns "ok", or a string beginning with "error:" explaining what failed. */
  save(name: string, mime: string, text: string): string;
}

function nativeFiles(): NativeFiles | undefined {
  const bridge = (window as unknown as { AndroidFiles?: NativeFiles }).AndroidFiles;
  return typeof bridge?.save === "function" ? bridge : undefined;
}

export interface HandOff {
  readonly ok: boolean;
  /** Written for the artist. Present whether it worked or not. */
  readonly message: string;
}

export function handOff(name: string, text: string, type: string): HandOff {
  const bridge = nativeFiles();

  if (bridge === undefined) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
    return { ok: true, message: `Saved ${name}` };
  }

  // A bridge call crosses into native code, so it can fail in ways JavaScript
  // cannot: a dead binder, a full disk, no app able to receive the file. None
  // of those may be reported as success.
  let reply: string;
  try {
    reply = bridge.save(name, type, text);
  } catch {
    return { ok: false, message: "The app could not hand the file to Android. Your page is still saved here." };
  }

  if (reply === "ok") return { ok: true, message: `Ready to save ${name}. Choose where to keep it.` };
  return {
    ok: false,
    message: `${name} could not be saved: ${reply.replace(/^error:\s*/, "")}. Your page is still saved here.`,
  };
}

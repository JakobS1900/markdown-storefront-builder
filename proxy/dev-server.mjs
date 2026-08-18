/**
 * Runs the upload proxy locally, with a stubbed image host.
 *
 * This exists so the client upload path can be verified end to end without an
 * account, a key, or a deployment. The handler under test is the real one; only
 * the final hop to the image host is replaced, and that hop is the one piece
 * that genuinely cannot be exercised here.
 *
 * Usage:
 *   node proxy/dev-server.mjs [port]
 *
 * Uploads are written to proxy/.dev-uploads and served back, so the app sees a
 * real address that a real <img> can load. That makes the whole round trip
 * observable, which is the point.
 */
import { createServer } from "node:http";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const { createUploadHandler } = await import("./dist/upload.js");

const PORT = Number(process.argv[2] ?? 8787);
const DIR = new URL("./.dev-uploads/", import.meta.url);
mkdirSync(DIR, { recursive: true });

const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

/** Stands in for the image host. Stores the bytes and returns a loadable address. */
const upstream = async (bytes, mime) => {
  const name = `${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.${EXT[mime] ?? "bin"}`;
  writeFileSync(new URL(name, DIR), bytes);
  return { ok: true, url: `http://localhost:${PORT}/files/${name}` };
};

const handle = createUploadHandler({ upstream });

const env = {
  UPLOAD_KEY: "local-development-only-not-a-real-key",
  ALLOWED_ORIGINS: `http://localhost:5311,http://localhost:5199,http://127.0.0.1:5311`,
};

createServer(async (req, res) => {
  // Serve back what was uploaded, so the app can actually display it.
  if (req.method === "GET" && req.url?.startsWith("/files/")) {
    const name = req.url.slice("/files/".length);
    const path = new URL(name, DIR);
    if (!/^[a-f0-9]{16}\.\w+$/.test(name) || !existsSync(path)) {
      res.writeHead(404).end("no");
      return;
    }
    res.writeHead(200, { "content-type": "image/png" }).end(readFileSync(path));
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const request = new Request(`http://localhost:${PORT}${req.url ?? "/"}`, {
    method: req.method,
    headers: { ...req.headers, "x-forwarded-for": "127.0.0.1" },
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });

  const response = await handle(request, env);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => {
  console.log(`upload proxy on http://localhost:${PORT} (stubbed image host, files in proxy/.dev-uploads)`);
});

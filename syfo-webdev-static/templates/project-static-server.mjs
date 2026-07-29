import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("./public/", import.meta.url)));
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || "9000");
const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL || "";
const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY || "";

const contentTypes = new Map([
  [".avif", "image/avif"], [".css", "text/css; charset=utf-8"],
  [".csv", "text/csv; charset=utf-8"], [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"], [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"], [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"],
  [".m4a", "audio/mp4"], [".mp3", "audio/mpeg"], [".mp4", "video/mp4"],
  [".ogg", "audio/ogg"], [".pdf", "application/pdf"],
  [".png", "image/png"], [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"], [".wav", "audio/wav"],
  [".webm", "video/webm"], [".webp", "image/webp"],
  [".woff", "font/woff"], [".woff2", "font/woff2"], [".xml", "application/xml; charset=utf-8"],
]);

function safePath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const candidate = resolve(root, `.${decoded}`);
  return candidate === root || candidate.startsWith(`${root}${sep}`) ? candidate : null;
}

async function fileInfo(path) {
  try {
    const info = await stat(path);
    return info.isFile() ? info : null;
  } catch {
    return null;
  }
}

async function resolveRequest(pathname) {
  const base = safePath(pathname);
  if (!base) return null;
  const candidates = pathname.endsWith("/")
    ? [resolve(base, "index.html")]
    : [base, `${base}.html`, resolve(base, "index.html")];
  for (const candidate of candidates) {
    const info = await fileInfo(candidate);
    if (info) return { path: candidate, info, status: 200 };
  }
  const notFound = resolve(root, "404.html");
  const info = await fileInfo(notFound);
  return info ? { path: notFound, info, status: 404 } : null;
}

function parseRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value || "");
  if (!match) return null;
  let start = match[1] ? Number(match[1]) : null;
  let end = match[2] ? Number(match[2]) : null;
  if (start === null && end === null) return null;
  if (start === null) {
    const suffix = end;
    if (!Number.isInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    if (!Number.isInteger(start) || start < 0 || start >= size) return null;
    end = end === null ? size - 1 : Math.min(end, size - 1);
    if (!Number.isInteger(end) || end < start) return null;
  }
  return { start, end };
}

function commonHeaders(path, size) {
  const extension = extname(path).toLowerCase();
  return {
    "Accept-Ranges": "bytes",
    "Cache-Control": path.includes(`${sep}_next${sep}static${sep}`)
      ? "public, max-age=31536000, immutable"
      : extension === ".html"
        ? "public, max-age=0, must-revalidate"
        : "public, max-age=3600",
    "Content-Length": String(size),
    "Content-Type": contentTypes.get(extension) || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  };
}

async function authorizeRequest(request) {
  if (!forgeApiUrl || !forgeApiKey) return { allowed: false, status: 503, headers: {} };
  try {
    const result = await fetch(`${forgeApiUrl}/api/v1/hosted-app-auth/basic/verify`, {
      method: "POST",
      headers: {
        "x-syfo-hosted-app-token": forgeApiKey,
        ...(request.headers.authorization
          ? { "x-syfo-basic-authorization": request.headers.authorization }
          : {}),
      },
      signal: AbortSignal.timeout(5000),
    });
    if (result.status === 204) return { allowed: true, status: 204, headers: {} };
    const challenge = result.headers.get("www-authenticate");
    const visitorChallenge = result.status === 401 && /^Basic(?:\s|$)/i.test(challenge || "");
    return {
      allowed: false,
      status: visitorChallenge ? 401 : 503,
      headers: visitorChallenge ? { "WWW-Authenticate": challenge } : {},
    };
  } catch {
    return { allowed: false, status: 503, headers: {} };
  }
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, { Allow: "GET, HEAD, OPTIONS" });
    response.end();
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD, OPTIONS" });
    response.end();
    return;
  }

  const url = new URL(request.url || "/", "http://localhost");
  if (url.pathname === "/healthz") {
    const body = Buffer.from('{"status":"ok"}\n');
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": String(body.length),
      "Content-Type": "application/json; charset=utf-8",
    });
    response.end(request.method === "HEAD" ? undefined : body);
    return;
  }

  const authorization = await authorizeRequest(request);
  if (!authorization.allowed) {
    const body = Buffer.from(authorization.status === 401 ? "Authentication required\n" : "Service unavailable\n");
    response.writeHead(authorization.status, {
      "Cache-Control": "no-store",
      "Content-Length": String(body.length),
      "Content-Type": "text/plain; charset=utf-8",
      ...authorization.headers,
    });
    response.end(request.method === "HEAD" ? undefined : body);
    return;
  }

  const resolved = await resolveRequest(url.pathname);
  if (!resolved) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(request.method === "HEAD" ? undefined : "Not Found\n");
    return;
  }

  const range = request.headers.range ? parseRange(request.headers.range, resolved.info.size) : null;
  if (request.headers.range && !range) {
    response.writeHead(416, { "Content-Range": `bytes */${resolved.info.size}` });
    response.end();
    return;
  }

  if (range) {
    const length = range.end - range.start + 1;
    response.writeHead(206, {
      ...commonHeaders(resolved.path, length),
      "Content-Range": `bytes ${range.start}-${range.end}/${resolved.info.size}`,
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(resolved.path, range).pipe(response);
    return;
  }

  response.writeHead(resolved.status, commonHeaders(resolved.path, resolved.info.size));
  if (request.method === "HEAD") response.end();
  else createReadStream(resolved.path).pipe(response);
});

server.on("clientError", (_error, socket) => socket.end("HTTP/1.1 400 Bad Request\r\n\r\n"));
server.listen(port, hostname, () => process.stdout.write(`static server listening on ${hostname}:${port}\n`));

function shutdown(signal) {
  process.stdout.write(`received ${signal}; shutting down\n`);
  server.close((error) => process.exit(error ? 1 : 0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

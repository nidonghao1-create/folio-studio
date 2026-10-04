import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve(process.argv.includes("--dist") ? "dist" : ".");
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const rel =
      decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const path = resolve(root, rel);
    if (
      !path.startsWith(root + sep) ||
      rel.split("/").some((p) => p.startsWith(".")) ||
      !/^(index\.html|src\/|public\/)/.test(rel)
    ) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    if (!(await stat(path)).isFile()) throw new Error("Not a file");
    res.writeHead(200, {
      "Content-Type": types[extname(path)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  process.stdout.write(`Folio Studio http://127.0.0.1:${port}\n`),
);

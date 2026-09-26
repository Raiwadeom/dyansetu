import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* Reads the .env files ourselves rather than going through Vite's loadEnv.
   loadEnv lets process.env win over the file whenever the prefix is "", so a
   key that was once blank in .env.local left an empty string behind in the
   Node process and every later restart kept reading that empty string back —
   filling the real secret in appeared to do nothing, because Vite restarts the
   dev server inside the same process. Parsing the file directly makes the file
   the source of truth, which is what a developer editing it expects. */
function readEnvFiles(mode, dir) {
  /* Same order Vite uses; later files win. */
  const files = [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];
  const values = {};

  for (const name of files) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;

    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;

      const [, key, rawValue] = match;
      let value = rawValue.trim();

      /* Quoted values keep their spaces and any trailing # verbatim; bare ones
         stop at an inline comment, the way dotenv treats them. */
      const quoted = /^(['"])([\s\S]*)\1$/.exec(value);
      if (quoted) value = quoted[2];
      else value = value.replace(/\s+#.*$/, "").trim();

      values[key] = value;
    }
  }

  return values;
}

/* Serves every file under api/ during `npm run dev`, so the endpoints work
   locally exactly as they do once deployed as Vercel functions. Each file's
   default export is called with a small Vercel-style req/res shim
   (req.body, req.query, res.status().json()). */
function apiRoutes(mode) {
  return {
    name: "dnyansetu-api-routes",
    configureServer(server) {
      /* The handlers read their secrets from process.env. The unprefixed values
         are the ones Vite deliberately keeps out of the client bundle. Re-read
         on every restart so editing .env.local takes effect without killing
         the process. */
      const env = readEnvFiles(mode, server.config.root);
      Object.entries(env).forEach(([key, value]) => {
        if (key.startsWith("VITE_")) return;
        process.env[key] = value;
      });

      server.middlewares.use("/api", async (req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        const route = url.pathname.replace(/^\/+|\/+$/g, "");
        /* No leading underscore (shared code) and no path tricks. */
        if (!route || route.split("/").some((part) => !/^[a-z0-9-]+$/i.test(part))) return next();

        const file = path.join(server.config.root, "api", `${route}.js`);
        if (!fs.existsSync(file)) return next();

        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString("utf8");
          let body = raw;
          if (raw && /json/i.test(req.headers["content-type"] || "")) {
            try { body = JSON.parse(raw); } catch { body = {}; }
          }
          req.body = body;
          req.query = Object.fromEntries(url.searchParams);

          res.status = (code) => { res.statusCode = code; return res; };
          res.json = (data) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(data));
            return res;
          };
          res.send = (data) => { res.end(typeof data === "string" ? data : JSON.stringify(data)); return res; };

          const mod = await server.ssrLoadModule(`/api/${route}.js`);
          await mod.default(req, res);
        } catch (error) {
          console.error(`[api/${route}]`, error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: error.message || "Server error." }));
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), apiRoutes(mode)],
    server: {
      host: true,
      watch: {
        ignored: ["**/media/**"],
      },
    },
  };
});

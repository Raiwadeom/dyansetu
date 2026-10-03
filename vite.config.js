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

/* Public pages that search engines should see as separate pages. The site is
   one React app, so without this every address returned the homepage's HTML,
   title and canonical link, and Google treated them all as copies of "/"
   (no sitelinks such as "Scholarships" or "RaktSetu" under the result).
   After the build, each gets its own copy of index.html with its own title,
   description and canonical; vercel.json rewrites the address to that file.
   The app itself still decides what to render. */
const SITE = "https://www.dnyansetu.online";
const SEO_PAGES = [
  { path: "/scholarships", file: "scholarships", title: "Scholarships — DnyanSetu",
    description: "Government and private scholarships for college students in Maharashtra: eligibility, documents and last dates, with help from DnyanSetu." },
  { path: "/raktsetu", file: "raktsetu", title: "RaktSetu — Find Blood Donors | DnyanSetu",
    description: "RaktSetu connects people who need blood with volunteer donors registered on DnyanSetu. Post a request and nearby donors get an instant alert. Never pay for blood." },
  { path: "/login", file: "login", title: "Student Login — DnyanSetu",
    description: "Sign in to DnyanSetu for notes, previous-year papers, practice quizzes and scholarships." },
  { path: "/signup", file: "signup", title: "Create Student Account — DnyanSetu",
    description: "Create your free DnyanSetu student account for notes, previous-year papers, quizzes and scholarships." },
  { path: "/staff", file: "staff", title: "Faculty & Staff Login — DnyanSetu",
    description: "Faculty and staff sign-in for DnyanSetu: upload notes and papers and manage student services." },
  { path: "/terms", file: "terms", title: "Terms of Service — DnyanSetu",
    description: "The terms for using DnyanSetu and RaktSetu." },
  { path: "/privacy", file: "privacy", title: "Privacy Policy — DnyanSetu",
    description: "What DnyanSetu and RaktSetu collect, why, and how your data is protected." },
];

function escapeAttr(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function seoPages() {
  let outDir = "dist";
  return {
    name: "dnyansetu-seo-pages",
    apply: "build",
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); },
    closeBundle() {
      const base = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
      const seoDir = path.join(outDir, "seo");
      fs.mkdirSync(seoDir, { recursive: true });

      for (const page of SEO_PAGES) {
        const url = `${SITE}${page.path}`;
        const title = escapeAttr(page.title);
        const description = escapeAttr(page.description);
        const html = base
          .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
          .replace(/(<link rel="canonical" href=")[^"]*"/, `$1${url}"`)
          .replace(/(<meta name="description" content=")[^"]*"/, `$1${description}"`)
          .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${url}"`)
          .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${title}"`)
          .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${description}"`)
          .replace(/(<meta name="twitter:title" content=")[^"]*"/, `$1${title}"`)
          .replace(/(<meta name="twitter:description" content=")[^"]*"/, `$1${description}"`);
        if (!html.includes(`<title>${title}</title>`) || !html.includes(`href="${url}"`)) {
          throw new Error(`[seo] could not rewrite the head for ${page.path}`);
        }
        fs.writeFileSync(path.join(seoDir, `${page.file}.html`), html);
      }

      const today = new Date().toISOString().slice(0, 10);
      const urls = [{ path: "/", priority: "1.0" }, ...SEO_PAGES.map((p) => ({
        path: p.path, priority: ["/terms", "/privacy"].includes(p.path) ? "0.3" : "0.8",
      }))];
      fs.writeFileSync(path.join(outDir, "sitemap.xml"), [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls.map((u) => `  <url><loc>${SITE}${u.path === "/" ? "/" : u.path}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`),
        "</urlset>",
        "",
      ].join("\n"));
    },
  };
}

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), apiRoutes(mode), seoPages()],
    server: {
      host: true,
      watch: {
        ignored: ["**/media/**"],
      },
    },
  };
});

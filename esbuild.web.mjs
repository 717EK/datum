// Web / PWA build: bundles src/web/app.ts (the same viewer core as the Obsidian
// plugin, with `obsidian` aliased to the browser shim) into dist/, copies the
// static shell, and generates a content-hashed service worker so every deploy
// is detected as an update by installed apps.
//
//   node esbuild.web.mjs            production build → dist/
//   node esbuild.web.mjs --watch    rebuild on change
//   node esbuild.web.mjs --serve    watch + serve dist/ on http://localhost:8787
import esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync, statSync, rmSync } from "fs";
import { gzipSync } from "zlib";
import { execFileSync } from "child_process";
import { builtinModules } from "module";

// The emscripten glue in occt-import-js has Node-only branches that
// require("fs")/("path"). They never run in a browser, but esbuild must be told
// not to try bundling them.
const external = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

const here = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const watch = args.has("--watch") || args.has("--serve");
const serve = args.has("--serve");
const prod = !watch;

const dist = path.join(here, "dist");
const pub = path.join(here, "public");
const pkg = JSON.parse(readFileSync(path.join(here, "package.json"), "utf8"));
const shim = path.join(here, "src/web/obsidian-shim.ts");

// --- Plugins (same as the plugin build) ------------------------------------
const wasmGzipPlugin = {
  name: "wasm-gzip",
  setup(build) {
    build.onLoad({ filter: /occt-import-js\.wasm$/ }, (a) => ({
      contents: `export default ${JSON.stringify(gzipSync(readFileSync(a.path), { level: 9 }).toString("base64"))};`,
      loader: "js",
    }));
  },
};

const inlineWorkerPlugin = {
  name: "inline-worker",
  setup(build) {
    build.onResolve({ filter: /\?worker$/ }, (a) => ({
      path: path.resolve(a.resolveDir, a.path.replace(/\?worker$/, "")),
      namespace: "inline-worker",
    }));
    build.onLoad({ filter: /.*/, namespace: "inline-worker" }, async (a) => {
      const r = await esbuild.build({
        entryPoints: [a.path],
        bundle: true,
        write: false,
        format: "iife",
        target: "es2020",
        platform: "browser",
        alias: { obsidian: shim },
        external,
        minify: prod,
        logLevel: "silent",
      });
      return { contents: `export default ${JSON.stringify(r.outputFiles[0].text)};`, loader: "js", watchFiles: [a.path] };
    });
  },
};

// mlightcad's prebuilt bundles import `three/examples/jsm/...` without the
// `.js` suffix (Vite tolerates that; three's exports map + esbuild don't).
const threeExamplesPlugin = {
  name: "three-examples-ext",
  setup(build) {
    build.onResolve({ filter: /^three\/examples\/jsm\// }, (a) => {
      if (a.path.endsWith(".js") || a.pluginData?.threeExt) return undefined;
      return build.resolve(`${a.path}.js`, { kind: a.kind, resolveDir: a.resolveDir, importer: a.importer, pluginData: { threeExt: true } });
    });
  },
};

// --- Static shell + service worker -----------------------------------------
function walk(dir, base = dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p, base));
    else out.push(path.relative(base, p).split(path.sep).join("/"));
  }
  return out;
}

function hashOf(...bufs) {
  const h = createHash("sha256");
  for (const b of bufs) h.update(b);
  return h.digest("hex").slice(0, 10);
}

// Web-worker assets for the 2D (DWG/DXF) viewer: the MTEXT layout worker from
// cad-simple-viewer and LibreDWG's parser worker + wasm. They are large (the
// wasm alone is ~10 MB), so the service worker fetches them lazily into a
// separate, content-keyed cache instead of the blocking app-shell precache.
const WORKER_ASSETS = [
  ["@mlightcad/cad-simple-viewer/dist/mtext-renderer-worker.js", "mtext-renderer-worker.js"],
  ["@mlightcad/libredwg-converter/dist/libredwg-parser-worker.js", "libredwg-parser-worker.js"],
  ["@mlightcad/libredwg-converter/dist/libredwg-web.wasm", "libredwg-web.wasm"],
];
function copyWorkerAssets() {
  const out = path.join(dist, "workers");
  mkdirSync(out, { recursive: true });
  for (const [from, to] of WORKER_ASSETS) {
    const src = path.join(here, "node_modules", from);
    if (!existsSync(src)) throw new Error(`missing worker asset: ${from}`);
    cpSync(src, path.join(out, to));
  }
}

function finalize() {
  copyWorkerAssets();
  // Icons (regenerate if missing).
  const iconDir = path.join(pub, "icons");
  if (!existsSync(path.join(iconDir, "icon-512.png"))) {
    execFileSync(process.execPath, [path.join(here, "scripts/make-icons.mjs"), iconDir], { stdio: "inherit" });
  }

  // styles.css = plugin styles + web shell styles.
  const css = readFileSync(path.join(here, "styles.css"), "utf8") + "\n\n" + readFileSync(path.join(here, "src/web/web.css"), "utf8");
  writeFileSync(path.join(dist, "styles.css"), css);

  // Copy the static shell (everything in public/ except the SW template).
  cpSync(pub, dist, { recursive: true, filter: (src) => !src.endsWith("sw.template.js") });

  // Content hash over everything that ships, so any change = a new SW.
  const appJs = readFileSync(path.join(dist, "app.js"));
  const all = walk(dist).filter((f) => f !== "sw.js" && f !== "index.html" && f !== "version.json");
  // The big 2D bundle + worker assets go on the lazy list, each keyed by its
  // own content hash so an unchanged wasm survives an app update in the cache.
  const isLazy = (f) => f === "cad2d.js" || f.startsWith("workers/");
  const files = all.filter((f) => !isLazy(f));
  const lazy = all.filter(isLazy).map((f) => `${f}?v=${hashOf(readFileSync(path.join(dist, f)))}`);
  const hash = hashOf(appJs, css, readFileSync(path.join(pub, "index.html")), ...files.map((f) => readFileSync(path.join(dist, f))), lazy.join("|"));
  const version = `${pkg.version}+${hash}`;

  // index.html with cache-busting query strings.
  const html = readFileSync(path.join(pub, "index.html"), "utf8").replace(/__HASH__/g, hash);
  writeFileSync(path.join(dist, "index.html"), html);

  // Service worker with the precache list.
  const precache = ["./", "index.html", ...files.map((f) => (f === "app.js" || f === "styles.css" ? `${f}?v=${hash}` : f))];
  const sw = readFileSync(path.join(pub, "sw.template.js"), "utf8")
    .replace("__VERSION__", version)
    .replace("__PRECACHE__", JSON.stringify(precache, null, 2))
    .replace("__LAZY__", JSON.stringify(lazy, null, 2));
  writeFileSync(path.join(dist, "sw.js"), sw);

  // version.json for external tooling / a quick sanity check on the server.
  writeFileSync(path.join(dist, "version.json"), JSON.stringify({ version: pkg.version, build: hash, builtAt: new Date().toISOString() }, null, 2));

  const cad2d = readFileSync(path.join(dist, "cad2d.js")).length;
  console.log(
    `[web] built v${version} → dist/ (app.js ${(appJs.length / 1024 / 1024).toFixed(2)} MB, cad2d.js ${(cad2d / 1024 / 1024).toFixed(2)} MB)`,
  );
}

// Git short SHA when available (stable across rebuilds of the same commit, so a
// no-change redeploy doesn't nag installed apps); otherwise a timestamp.
function buildStamp() {
  try {
    const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: here, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: here, stdio: ["ignore", "pipe", "ignore"] }).toString().trim().length > 0;
    if (sha) return dirty ? sha + "-dev" : sha;
  } catch {}
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

// --- Build -----------------------------------------------------------------
if (prod) rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const finalizePlugin = {
  name: "finalize",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length === 0) finalize();
    });
  },
};

const ctx = await esbuild.context({
  // app.js = the shell + 3D viewer; cad2d.js = the DWG/DXF viewer, loaded on
  // demand by app.ts the first time a drawing is opened.
  entryPoints: ["src/web/app.ts", "src/web/cad2d.ts"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020", "safari15"],
  outdir: "dist",
  entryNames: "[name]",
  alias: { obsidian: shim },
  external,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_HASH__: JSON.stringify(buildStamp()),
  },
  plugins: [threeExamplesPlugin, wasmGzipPlugin, inlineWorkerPlugin, finalizePlugin],
  minify: prod,
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  legalComments: "none",
  logLevel: "info",
});

if (serve) {
  await ctx.watch();
  const { host, port } = await ctx.serve({ servedir: dist, port: 8787 });
  console.log(`[web] serving dist/ at http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
} else if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}

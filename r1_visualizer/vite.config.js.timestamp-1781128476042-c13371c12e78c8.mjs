// vite.config.js
import { defineConfig } from "file:///mnt/d/Repositories/stb-r1-visualizer/r1_visualizer/node_modules/vite/dist/node/index.js";
import preact from "file:///mnt/d/Repositories/stb-r1-visualizer/r1_visualizer/node_modules/@preact/preset-vite/dist/esm/index.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
var __vite_injected_original_import_meta_url = "file:///mnt/d/Repositories/stb-r1-visualizer/r1_visualizer/vite.config.js";
var __dirname = path.dirname(fileURLToPath(__vite_injected_original_import_meta_url));
var JSON_DIR = path.resolve(__dirname, "..", "stb_r1_json");
function parseName(file) {
  const m = /^STB-R1-([A-Z]+)-(\d{4})_v(\d+)\.json$/i.exec(file);
  if (!m) return null;
  return { carrier: m[1].toUpperCase(), year: Number(m[2]), version: Number(m[3]), file };
}
function buildManifest() {
  let entries = [];
  try {
    entries = fs.readdirSync(JSON_DIR).map(parseName).filter(Boolean).sort((a, b) => a.carrier.localeCompare(b.carrier) || a.year - b.year || a.version - b.version);
  } catch (e) {
    console.warn(`[r1-data] could not read ${JSON_DIR}: ${e.message}`);
  }
  return { generated: "dev", count: entries.length, submissions: entries };
}
function r1DataServer() {
  return {
    name: "r1-data-server",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/data", (req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (url === "/manifest.json" || url === "/manifest") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(buildManifest()));
          return;
        }
        const safe = path.normalize(url).replace(/^(\.\.[/\\])+/, "");
        const filePath = path.join(JSON_DIR, safe);
        if (filePath.startsWith(JSON_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.setHeader("Content-Type", "application/json");
          fs.createReadStream(filePath).pipe(res);
          return;
        }
        next();
      });
    }
  };
}
var vite_config_default = defineConfig({
  plugins: [preact(), r1DataServer()],
  build: {
    outDir: "dist",
    // Build as a library-ish bundle plus the standalone page; WordPress enqueues
    // the emitted JS/CSS and calls window.mountR1Viewer().
    rollupOptions: {
      output: {
        entryFileNames: "r1-viewer.js",
        assetFileNames: "r1-viewer.[ext]"
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvbW50L2QvUmVwb3NpdG9yaWVzL3N0Yi1yMS12aXN1YWxpemVyL3IxX3Zpc3VhbGl6ZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9tbnQvZC9SZXBvc2l0b3JpZXMvc3RiLXIxLXZpc3VhbGl6ZXIvcjFfdmlzdWFsaXplci92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vbW50L2QvUmVwb3NpdG9yaWVzL3N0Yi1yMS12aXN1YWxpemVyL3IxX3Zpc3VhbGl6ZXIvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHByZWFjdCBmcm9tICdAcHJlYWN0L3ByZXNldC12aXRlJ1xuaW1wb3J0IGZzIGZyb20gJ25vZGU6ZnMnXG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoIH0gZnJvbSAnbm9kZTp1cmwnXG5cbmNvbnN0IF9fZGlybmFtZSA9IHBhdGguZGlybmFtZShmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCkpXG5cbi8vIFNpYmxpbmcgZm9sZGVyIGhvbGRpbmcgdGhlIGNhbm9uaWNhbCBTVEIgUi0xIEpTT04gZmlsZXMuXG5jb25zdCBKU09OX0RJUiA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuLicsICdzdGJfcjFfanNvbicpXG5cbi8vIFBhcnNlIFwiU1RCLVIxLUJOU0YtMjAyNV92MS5qc29uXCIgLT4ge2NhcnJpZXIsIHllYXIsIHZlcnNpb24sIGZpbGV9XG5mdW5jdGlvbiBwYXJzZU5hbWUoZmlsZSkge1xuICBjb25zdCBtID0gL15TVEItUjEtKFtBLVpdKyktKFxcZHs0fSlfdihcXGQrKVxcLmpzb24kL2kuZXhlYyhmaWxlKVxuICBpZiAoIW0pIHJldHVybiBudWxsXG4gIHJldHVybiB7IGNhcnJpZXI6IG1bMV0udG9VcHBlckNhc2UoKSwgeWVhcjogTnVtYmVyKG1bMl0pLCB2ZXJzaW9uOiBOdW1iZXIobVszXSksIGZpbGUgfVxufVxuXG5mdW5jdGlvbiBidWlsZE1hbmlmZXN0KCkge1xuICBsZXQgZW50cmllcyA9IFtdXG4gIHRyeSB7XG4gICAgZW50cmllcyA9IGZzLnJlYWRkaXJTeW5jKEpTT05fRElSKVxuICAgICAgLm1hcChwYXJzZU5hbWUpXG4gICAgICAuZmlsdGVyKEJvb2xlYW4pXG4gICAgICAuc29ydCgoYSwgYikgPT5cbiAgICAgICAgYS5jYXJyaWVyLmxvY2FsZUNvbXBhcmUoYi5jYXJyaWVyKSB8fCBhLnllYXIgLSBiLnllYXIgfHwgYS52ZXJzaW9uIC0gYi52ZXJzaW9uKVxuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc29sZS53YXJuKGBbcjEtZGF0YV0gY291bGQgbm90IHJlYWQgJHtKU09OX0RJUn06ICR7ZS5tZXNzYWdlfWApXG4gIH1cbiAgcmV0dXJuIHsgZ2VuZXJhdGVkOiAnZGV2JywgY291bnQ6IGVudHJpZXMubGVuZ3RoLCBzdWJtaXNzaW9uczogZW50cmllcyB9XG59XG5cbi8qKlxuICogRGV2LW9ubHkgcGx1Z2luOiBzZXJ2ZXMgdGhlIHNpYmxpbmcgc3RiX3IxX2pzb24vIGZvbGRlciBhdCAvZGF0YS8qIGFuZFxuICogc3ludGhlc2l6ZXMgL2RhdGEvbWFuaWZlc3QuanNvbi4gSW4gcHJvZHVjdGlvbiB0aGUgaG9zdCAoV29yZFByZXNzIC8gQ0ROKVxuICogc2VydmVzIHRoZXNlIGFzIHN0YXRpYyBhc3NldHMsIHNvIHRoaXMgcGx1Z2luIGlzIGEgbm8tb3AgZm9yIGB2aXRlIGJ1aWxkYC5cbiAqL1xuZnVuY3Rpb24gcjFEYXRhU2VydmVyKCkge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdyMS1kYXRhLXNlcnZlcicsXG4gICAgYXBwbHk6ICdzZXJ2ZScsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgnL2RhdGEnLCAocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICAgICAgY29uc3QgdXJsID0gKHJlcS51cmwgfHwgJycpLnNwbGl0KCc/JylbMF1cbiAgICAgICAgaWYgKHVybCA9PT0gJy9tYW5pZmVzdC5qc29uJyB8fCB1cmwgPT09ICcvbWFuaWZlc3QnKSB7XG4gICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKVxuICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoYnVpbGRNYW5pZmVzdCgpKSlcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzYWZlID0gcGF0aC5ub3JtYWxpemUodXJsKS5yZXBsYWNlKC9eKFxcLlxcLlsvXFxcXF0pKy8sICcnKVxuICAgICAgICBjb25zdCBmaWxlUGF0aCA9IHBhdGguam9pbihKU09OX0RJUiwgc2FmZSlcbiAgICAgICAgaWYgKGZpbGVQYXRoLnN0YXJ0c1dpdGgoSlNPTl9ESVIpICYmIGZzLmV4aXN0c1N5bmMoZmlsZVBhdGgpICYmIGZzLnN0YXRTeW5jKGZpbGVQYXRoKS5pc0ZpbGUoKSkge1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJylcbiAgICAgICAgICBmcy5jcmVhdGVSZWFkU3RyZWFtKGZpbGVQYXRoKS5waXBlKHJlcylcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuICAgICAgICBuZXh0KClcbiAgICAgIH0pXG4gICAgfSxcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcHJlYWN0KCksIHIxRGF0YVNlcnZlcigpXSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICAvLyBCdWlsZCBhcyBhIGxpYnJhcnktaXNoIGJ1bmRsZSBwbHVzIHRoZSBzdGFuZGFsb25lIHBhZ2U7IFdvcmRQcmVzcyBlbnF1ZXVlc1xuICAgIC8vIHRoZSBlbWl0dGVkIEpTL0NTUyBhbmQgY2FsbHMgd2luZG93Lm1vdW50UjFWaWV3ZXIoKS5cbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgZW50cnlGaWxlTmFtZXM6ICdyMS12aWV3ZXIuanMnLFxuICAgICAgICBhc3NldEZpbGVOYW1lczogJ3IxLXZpZXdlci5bZXh0XScsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUEyVSxTQUFTLG9CQUFvQjtBQUN4VyxPQUFPLFlBQVk7QUFDbkIsT0FBTyxRQUFRO0FBQ2YsT0FBTyxVQUFVO0FBQ2pCLFNBQVMscUJBQXFCO0FBSmdMLElBQU0sMkNBQTJDO0FBTS9QLElBQU0sWUFBWSxLQUFLLFFBQVEsY0FBYyx3Q0FBZSxDQUFDO0FBRzdELElBQU0sV0FBVyxLQUFLLFFBQVEsV0FBVyxNQUFNLGFBQWE7QUFHNUQsU0FBUyxVQUFVLE1BQU07QUFDdkIsUUFBTSxJQUFJLDBDQUEwQyxLQUFLLElBQUk7QUFDN0QsTUFBSSxDQUFDLEVBQUcsUUFBTztBQUNmLFNBQU8sRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFLFlBQVksR0FBRyxNQUFNLE9BQU8sRUFBRSxDQUFDLENBQUMsR0FBRyxTQUFTLE9BQU8sRUFBRSxDQUFDLENBQUMsR0FBRyxLQUFLO0FBQ3hGO0FBRUEsU0FBUyxnQkFBZ0I7QUFDdkIsTUFBSSxVQUFVLENBQUM7QUFDZixNQUFJO0FBQ0YsY0FBVSxHQUFHLFlBQVksUUFBUSxFQUM5QixJQUFJLFNBQVMsRUFDYixPQUFPLE9BQU8sRUFDZCxLQUFLLENBQUMsR0FBRyxNQUNSLEVBQUUsUUFBUSxjQUFjLEVBQUUsT0FBTyxLQUFLLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsT0FBTztBQUFBLEVBQ3BGLFNBQVMsR0FBRztBQUNWLFlBQVEsS0FBSyw0QkFBNEIsUUFBUSxLQUFLLEVBQUUsT0FBTyxFQUFFO0FBQUEsRUFDbkU7QUFDQSxTQUFPLEVBQUUsV0FBVyxPQUFPLE9BQU8sUUFBUSxRQUFRLGFBQWEsUUFBUTtBQUN6RTtBQU9BLFNBQVMsZUFBZTtBQUN0QixTQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxnQkFBZ0IsUUFBUTtBQUN0QixhQUFPLFlBQVksSUFBSSxTQUFTLENBQUMsS0FBSyxLQUFLLFNBQVM7QUFDbEQsY0FBTSxPQUFPLElBQUksT0FBTyxJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDeEMsWUFBSSxRQUFRLG9CQUFvQixRQUFRLGFBQWE7QUFDbkQsY0FBSSxVQUFVLGdCQUFnQixrQkFBa0I7QUFDaEQsY0FBSSxJQUFJLEtBQUssVUFBVSxjQUFjLENBQUMsQ0FBQztBQUN2QztBQUFBLFFBQ0Y7QUFDQSxjQUFNLE9BQU8sS0FBSyxVQUFVLEdBQUcsRUFBRSxRQUFRLGlCQUFpQixFQUFFO0FBQzVELGNBQU0sV0FBVyxLQUFLLEtBQUssVUFBVSxJQUFJO0FBQ3pDLFlBQUksU0FBUyxXQUFXLFFBQVEsS0FBSyxHQUFHLFdBQVcsUUFBUSxLQUFLLEdBQUcsU0FBUyxRQUFRLEVBQUUsT0FBTyxHQUFHO0FBQzlGLGNBQUksVUFBVSxnQkFBZ0Isa0JBQWtCO0FBQ2hELGFBQUcsaUJBQWlCLFFBQVEsRUFBRSxLQUFLLEdBQUc7QUFDdEM7QUFBQSxRQUNGO0FBQ0EsYUFBSztBQUFBLE1BQ1AsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGO0FBQ0Y7QUFFQSxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsT0FBTyxHQUFHLGFBQWEsQ0FBQztBQUFBLEVBQ2xDLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQTtBQUFBO0FBQUEsSUFHUixlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUEsUUFDTixnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0I7QUFBQSxNQUNsQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K

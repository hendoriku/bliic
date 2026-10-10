// Uji consume: node scripts/smoke.ts [path ...]
// Default memeriksa semua path katalog. Respons mentah /catalogue/ibp
// disimpan ke fixtures/ibp.json untuk dasar skema dan unit test.
import { mkdirSync, writeFileSync } from "node:fs";
import { ApiClient } from "../src/api/client.ts";
import { IBP_PATH } from "../src/api/ibp.ts";

const DEFAULT_PATHS = [
  "/catalogue",
  "/catalogue/products",
  "/catalogue/data-voucher",
  "/catalogue/electric-quota",
  "/catalogue/data-package",
  IBP_PATH,
  "/marketplace/listings",
  "/marketplace/vendors",
];

const client = new ApiClient({
  baseUrl: process.env.API_BASE_URL ?? "https://babelii.diofis.net",
  token: process.env.API_TOKEN,
  retries: 1,
});

const paths = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_PATHS;
let failed = 0;

for (const path of paths) {
  try {
    const r = await client.getRaw(path);
    const ok = r.status >= 200 && r.status < 300 && r.json !== null;
    if (!ok) failed++;
    const shape = Array.isArray(r.json)
      ? `array(${r.json.length})`
      : r.json && typeof r.json === "object"
        ? `object{${Object.keys(r.json).slice(0, 8).join(",")}}`
        : "non-json";
    const cors = r.headers["access-control-allow-origin"] ?? "-";
    console.log(`${ok ? "OK  " : "FAIL"} ${path}  ${r.status}  ${r.contentType ?? "-"}  ${shape}  CORS:${cors}`);
    if (path === IBP_PATH && r.json !== null) {
      mkdirSync("fixtures", { recursive: true });
      writeFileSync("fixtures/ibp.json", JSON.stringify(r.json, null, 2));
      console.log("     tersimpan: fixtures/ibp.json");
    }
  } catch (err) {
    failed++;
    console.log(`ERR  ${path}  ${String(err)}`);
  }
}
process.exit(failed ? 1 : 0);

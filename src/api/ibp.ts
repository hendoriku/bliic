import type { ApiClient } from "./client.ts";

export const IBP_PATH = "/catalogue/ibp";

// Skema sengaja belum dikunci: bentuk respons /catalogue/ibp belum dipastikan.
// Setelah smoke test menghasilkan fixtures/ibp.json, definisikan tipe dan
// validasinya di sini (mis. dengan zod) lalu ganti `unknown`.
export async function fetchIbp(client: ApiClient): Promise<unknown> {
  return client.getJson(IBP_PATH);
}

import test from "node:test";
import assert from "node:assert/strict";
import { ApiClient } from "./client.ts";
import { fetchAllPages, parseIbp } from "./ibp.ts";

const BASE = "https://api.test/public-api/v1";
const item = (n: number) => ({ code: `P${n}`, name: `Paket ${n}`, price: 1000 + n });

const clientFor = (handler: (url: URL) => unknown) => {
  const calls: string[] = [];
  const client = new ApiClient({
    baseUrl: BASE,
    retries: 0,
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      calls.push(url.pathname + url.search);
      return new Response(JSON.stringify(handler(url)), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  return { client, calls };
};

test("mengikuti links.next sampai habis", async () => {
  const { client, calls } = clientFor((u) => {
    const page = Number(u.searchParams.get("page") ?? 1);
    return {
      data: [item(page * 2), item(page * 2 + 1)],
      links: { next: page < 3 ? `${BASE}/catalogue/ibp?page=${page + 1}` : null },
    };
  });
  const r = parseIbp(await fetchAllPages(client));
  assert.equal(r.items.length, 6);
  assert.equal(calls.length, 3);
});

test("menelusuri ?page=n memakai meta.last_page", async () => {
  const { client, calls } = clientFor((u) => {
    const page = Number(u.searchParams.get("page") ?? 1);
    return { data: [item(page)], meta: { current_page: page, last_page: 4, total: 4 } };
  });
  const r = parseIbp(await fetchAllPages(client));
  assert.deepEqual(r.items.map((i) => i.code), ["P1", "P2", "P3", "P4"]);
  assert.equal(calls.length, 4);
});

test("tanpa pagination: satu request saja", async () => {
  const { client, calls } = clientFor(() => ({ data: [item(1), item(2)] }));
  assert.equal(parseIbp(await fetchAllPages(client)).items.length, 2);
  assert.equal(calls.length, 1);
});

test("duplikat antarhalaman dibuang", async () => {
  const { client } = clientFor((u) => {
    const page = Number(u.searchParams.get("page") ?? 1);
    return { data: [item(1), item(page)], meta: { current_page: page, last_page: 2 } };
  });
  assert.equal(parseIbp(await fetchAllPages(client)).items.length, 2);
});

test("tautan next ke host lain ditolak", async () => {
  const { client } = clientFor(() => ({ data: [item(1)], links: { next: "https://evil.example/x?page=2" } }));
  await assert.rejects(fetchAllPages(client), /di luar origin/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { ApiClient } from "./client.ts";
import { fetchAllPages, fetchIbpConditional, parseIbp } from "./ibp.ts";

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

// ---- penyegaran bersyarat (ETag) ----
const clientWith = (respond: (headers: Headers) => Response) => {
  const seen: Headers[] = [];
  const client = new ApiClient({
    baseUrl: BASE,
    retries: 0,
    fetchImpl: async (_input, init) => {
      const h = new Headers(init?.headers as HeadersInit);
      seen.push(h);
      return respond(h);
    },
  });
  return { client, seen };
};
const jsonRes = (body: unknown, etag?: string) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", ...(etag ? { etag } : {}) } });

test("bersyarat: mengirim If-None-Match dan 304 berarti tidak berubah (tanpa isi)", async () => {
  const { client, seen } = clientWith((h) => (h.get("if-none-match") === '"v1"' ? new Response(null, { status: 304 }) : jsonRes({ data: [] })));
  assert.deepEqual(await fetchIbpConditional(client, '"v1"'), { status: "not-modified" });
  assert.equal(seen[0].get("if-none-match"), '"v1"');
});

test("bersyarat: tanpa ETag tersimpan -> unduh penuh dan kembalikan ETag baru", async () => {
  const { client, seen } = clientWith(() => jsonRes({ data: [item(1), item(2)] }, '"v2"'));
  const r = await fetchIbpConditional(client, null);
  assert.equal(r.status, "ok");
  if (r.status === "ok") {
    assert.equal(r.items.length, 2);
    assert.equal(r.etag, '"v2"');
  }
  assert.equal(seen[0].get("if-none-match"), null);
});

test("bersyarat: respons berhalaman mengambil semua halaman dan membuang ETag", async () => {
  const { client } = clientWith((h) => jsonRes({ data: [item(1)], meta: { current_page: 1, last_page: 2 } }, '"p1"'));
  // halaman ke-2 dilayani handler yang sama (data tumpang tindih dibuang), cukup memastikan jalur berhalaman dipakai
  const r = await fetchIbpConditional(client, null);
  assert.equal(r.status, "ok");
  if (r.status === "ok") assert.equal(r.etag, null);
});

test("bersyarat: HTTP 500 melempar error", async () => {
  const { client } = clientWith(() => new Response("x", { status: 500 }));
  await assert.rejects(fetchIbpConditional(client, null), /HTTP 500/);
});

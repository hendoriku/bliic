// Klien HTTP tipis dan bebas framework: bisa dipakai di Node (smoke test, BFF),
// browser, maupun WebView Capacitor tanpa perubahan.

export interface ClientOptions {
  baseUrl: string;
  token?: string;
  timeoutMs?: number;
  retries?: number;
  /** Jeda dasar antar percobaan ulang (ms); berlipat dua tiap percobaan. Diperkecil di test. */
  backoffMs?: number;
  fetchImpl?: typeof fetch;
}

/** Jenis kegagalan, agar tampilan bisa menjelaskan sebabnya (bukan satu pesan generik). */
export type ApiErrorKind = "network" | "timeout" | "rate-limit" | "server" | "http" | "parse";

export class ApiError extends Error {
  readonly status?: number;
  readonly body?: string;
  readonly kind: ApiErrorKind;
  /** Dari header Retry-After (bila ada), dalam milidetik. */
  readonly retryAfterMs?: number;

  constructor(message: string, status?: number, body?: string, kind?: ApiErrorKind, retryAfterMs?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.retryAfterMs = retryAfterMs;
    this.kind = kind ?? (status === 429 ? "rate-limit" : status !== undefined && status >= 500 ? "server" : "http");
  }
}

export interface RawResponse {
  url: string;
  status: number;
  contentType: string | null;
  headers: Record<string, string>;
  text: string;
  json: unknown;
}

/** Retry-After berupa detik atau tanggal HTTP -> milidetik; null bila tidak ada/tidak terbaca. */
export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

/** Error yang sesuai untuk respons non-2xx. */
export function errorFromResponse(path: string, r: RawResponse): ApiError {
  return new ApiError(`HTTP ${r.status} untuk ${path}`, r.status, r.text.slice(0, 500), undefined, parseRetryAfter(r.headers["retry-after"]) ?? undefined);
}

const MAX_WAIT_MS = 8_000; // batas menunggu Retry-After di dalam satu permintaan

export class ApiClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly backoffMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.token = opts.token || undefined;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.retries = opts.retries ?? 2;
    this.backoffMs = opts.backoffMs ?? 500;
    this.fetchImpl = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  /** Path relatif terhadap baseUrl, atau URL absolut yang harus satu origin (mencegah mengikuti tautan ke host lain). */
  private resolve(path: string): URL {
    if (!/^https?:\/\//i.test(path)) return new URL(this.baseUrl + path);
    const url = new URL(path);
    if (url.origin !== new URL(this.baseUrl).origin) throw new ApiError(`URL di luar origin API ditolak: ${path}`);
    return url;
  }

  /**
   * GET tanpa interpretasi skema. Mencoba ulang untuk kegagalan jaringan, timeout, 5xx, dan 429
   * (menghormati Retry-After, maksimal 8 detik). Bila setelah semua percobaan masih 5xx/429, responsnya
   * dikembalikan apa adanya agar pemanggil bisa membuat error yang tepat.
   */
  async getRaw(
    path: string,
    query?: Record<string, string | number>,
    extraHeaders?: Record<string, string>,
  ): Promise<RawResponse> {
    const url = this.resolve(path);
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, String(v));

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const backoff = this.backoffMs * 2 ** attempt;
      try {
        const res = await this.fetchImpl(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
            ...extraHeaders,
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        const text = await res.text();
        if ((res.status >= 500 || res.status === 429) && attempt < this.retries) {
          const ra = res.status === 429 ? parseRetryAfter(res.headers.get("retry-after")) : null;
          await sleep(Math.min(ra ?? backoff, MAX_WAIT_MS));
          continue;
        }
        let json: unknown = null;
        try {
          json = JSON.parse(text);
        } catch {
          /* bukan JSON */
        }
        return {
          url: url.toString(),
          status: res.status,
          contentType: res.headers.get("content-type"),
          headers: headersToObject(res.headers),
          text,
          json,
        };
      } catch (err) {
        lastError = err;
        if (attempt < this.retries) await sleep(backoff);
      }
    }
    const timedOut = lastError instanceof Error && (lastError.name === "TimeoutError" || lastError.name === "AbortError");
    throw new ApiError(
      `${timedOut ? "Waktu habis" : "Gagal menghubungi"} ${url}: ${String(lastError)}`,
      undefined,
      undefined,
      timedOut ? "timeout" : "network",
    );
  }

  /** GET yang mewajibkan 2xx dan body JSON. */
  async getJson(path: string, query?: Record<string, string | number>): Promise<unknown> {
    const r = await this.getRaw(path, query);
    if (r.status < 200 || r.status >= 300) throw errorFromResponse(path, r);
    if (r.json === null) throw new ApiError(`Respons ${path} bukan JSON`, r.status, r.text.slice(0, 500), "parse");
    return r.json;
  }
}

function headersToObject(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

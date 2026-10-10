// Klien HTTP tipis dan bebas framework: bisa dipakai di Node (smoke test, BFF),
// browser, maupun WebView Capacitor tanpa perubahan.

export interface ClientOptions {
  baseUrl: string;
  token?: string;
  timeoutMs?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
}

export class ApiError extends Error {
  readonly status?: number;
  readonly body?: string;

  constructor(message: string, status?: number, body?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
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

export class ApiClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.token = opts.token || undefined;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.retries = opts.retries ?? 2;
    this.fetchImpl = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  /** Path relatif terhadap baseUrl, atau URL absolut yang harus satu origin (mencegah mengikuti tautan ke host lain). */
  private resolve(path: string): URL {
    if (!/^https?:\/\//i.test(path)) return new URL(this.baseUrl + path);
    const url = new URL(path);
    if (url.origin !== new URL(this.baseUrl).origin) throw new ApiError(`URL di luar origin API ditolak: ${path}`);
    return url;
  }

  /** GET tanpa interpretasi skema: berguna untuk menyelidiki respons asli. */
  async getRaw(path: string, query?: Record<string, string | number>): Promise<RawResponse> {
    const url = this.resolve(path);
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, String(v));

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const res = await this.fetchImpl(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        const text = await res.text();
        // 5xx dan 429 layak dicoba ulang; 4xx lain tidak.
        if ((res.status >= 500 || res.status === 429) && attempt < this.retries) {
          await sleep(300 * 2 ** attempt);
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
        if (attempt < this.retries) await sleep(300 * 2 ** attempt);
      }
    }
    throw new ApiError(`Gagal menghubungi ${url}: ${String(lastError)}`);
  }

  /** GET yang mewajibkan 2xx dan body JSON. */
  async getJson(path: string, query?: Record<string, string | number>): Promise<unknown> {
    const r = await this.getRaw(path, query);
    if (r.status < 200 || r.status >= 300) {
      throw new ApiError(`HTTP ${r.status} untuk ${path}`, r.status, r.text.slice(0, 500));
    }
    if (r.json === null) throw new ApiError(`Respons ${path} bukan JSON`, r.status, r.text.slice(0, 500));
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

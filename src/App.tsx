import { useEffect, useState } from "react";
import { ApiClient, type RawResponse } from "./api/client.ts";
import { IBP_PATH } from "./api/ibp.ts";

const client = new ApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "https://babelii.diofis.net/public-api/v1",
  retries: 1,
});

type State =
  | { kind: "loading" }
  | { kind: "ok"; res: RawResponse }
  | { kind: "error"; message: string };

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    client
      .getRaw(IBP_PATH)
      .then((res) => setState({ kind: "ok", res }))
      .catch((err) => setState({ kind: "error", message: String(err) }));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h1>IBP by Babelii</h1>
      <p>
        Uji consume <code>{IBP_PATH}</code>
      </p>
      {state.kind === "loading" && <p>Memuat…</p>}
      {state.kind === "error" && (
        <p role="alert">
          Gagal memuat data. Jika ini terjadi di browser, kemungkinan penyebabnya CORS: server API harus mengizinkan
          origin halaman ini. Detail: {state.message}
        </p>
      )}
      {state.kind === "ok" && (
        <>
          <p>
            HTTP {state.res.status} · {state.res.contentType ?? "-"}
          </p>
          <pre style={{ background: "#f4f4f4", padding: 12, overflow: "auto", maxHeight: "70vh" }}>
            {state.res.json !== null ? JSON.stringify(state.res.json, null, 2) : state.res.text}
          </pre>
        </>
      )}
    </main>
  );
}

import { getStore } from "@netlify/blobs";

const H = { "content-type": "application/json", "cache-control": "no-store" };
const out = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: H });
const rnd = () => crypto.randomUUID().replace(/-/g, "");

export default async (req) => {
  const store = getStore("dodo-shares");
  const url = new URL(req.url);

  if (req.method === "GET") {
    const id = url.searchParams.get("id") || "";
    if (!/^[a-z0-9]{6,40}$/.test(id)) return out({ error: "Mã chia sẻ không hợp lệ" }, 400);
    const rec = await store.get(id, { type: "json" });
    if (!rec) return out({ error: "Không tìm thấy bản chia sẻ" }, 404);
    return out({ state: rec.state, updated: rec.updated });
  }

  if (req.method === "POST") {
    const text = await req.text();
    if (text.length > 5 * 1024 * 1024) return out({ error: "Dữ liệu quá lớn" }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return out({ error: "JSON lỗi" }, 400); }
    const st = body.state;
    if (!st || st.version !== 1 || !Array.isArray(st.events)) return out({ error: "Dữ liệu không đúng định dạng" }, 400);

    let id = typeof body.id === "string" && /^[a-z0-9]{6,40}$/.test(body.id) ? body.id : "";
    let existing = id ? await store.get(id, { type: "json" }) : null;

    if (existing) {
      if (existing.key !== body.key) return out({ error: "Sai khóa chỉnh sửa" }, 403);
      await store.setJSON(id, { key: existing.key, state: st, updated: Date.now() });
      return out({ id });
    }

    id = rnd().slice(0, 12);
    const key = rnd() + rnd();
    await store.setJSON(id, { key, state: st, updated: Date.now() });
    return out({ id, key });
  }

  return out({ error: "Method not allowed" }, 405);
};

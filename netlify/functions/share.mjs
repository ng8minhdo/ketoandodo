import { getStore } from "@netlify/blobs";

const H = { "content-type": "application/json", "cache-control": "no-store" };
const out = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: H });
const sha = async (s) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("dodo:" + s)))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");

export default async (req) => {
  const store = getStore("dodo-main");
  const rec = await store.get("main", { type: "json" });

  // Ai cũng xem được
  if (req.method === "GET") {
    return out({ state: rec?.state || null, hasPw: !!rec?.pw, updated: rec?.updated || 0 });
  }

  if (req.method !== "POST") return out({ error: "Method not allowed" }, 405);

  const text = await req.text();
  if (text.length > 5 * 1024 * 1024) return out({ error: "Dữ liệu quá lớn" }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return out({ error: "JSON lỗi" }, 400); }

  const pw = typeof body.pw === "string" ? body.pw.trim() : "";
  if (pw.length < 4 || pw.length > 100) return out({ error: "Mật khẩu cần 4–100 ký tự" }, 400);

  // Chưa có mật khẩu: người đầu tiên đặt mật khẩu (khi lưu lần đầu)
  if (!rec?.pw) {
    if (body.action === "check") return out({ ok: true, fresh: true });
  } else if ((await sha(pw)) !== rec.pw) {
    return out({ error: "Sai mật khẩu" }, 403);
  }
  if (body.action === "check") return out({ ok: true });

  if (body.action === "save") {
    const st = body.state;
    if (!st || st.version !== 1 || !Array.isArray(st.events)) return out({ error: "Dữ liệu không đúng định dạng" }, 400);
    await store.setJSON("main", { pw: rec?.pw || (await sha(pw)), state: st, updated: Date.now() });
    return out({ ok: true });
  }
  return out({ error: "Yêu cầu không hợp lệ" }, 400);
};

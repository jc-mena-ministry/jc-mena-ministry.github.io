// JC — Jesus Can · shared site script (menu, forms → Firestore, live content)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, getDoc, getDocs, query, orderBy, limit, startAfter, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig, CONTACT_EMAIL, YOUTUBE_API_KEY } from "./config.js";
export const STARBOOKS_UPLOADS = "UUdzhbDbZrDT-7Mls7VhdVZQ"; // all channel uploads

const EN = document.documentElement.lang === "en";
const T = (ar, en) => (EN ? en : ar);

/* remember the chosen language (Arabic pages auto-open English next time) */
document.querySelectorAll("[data-lang]").forEach((a) =>
  a.addEventListener("click", () => { try { localStorage.setItem("jc-lang", a.dataset.lang); } catch (e) {} }));
try { if (new URLSearchParams(location.search).get("lang") === "ar") localStorage.setItem("jc-lang", "ar"); } catch (e) {}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------- mobile menu ---------- */
const burger = document.getElementById("burger");
const menu = document.getElementById("menu");
if (burger && menu) {
  burger.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    burger.setAttribute("aria-expanded", open);
  });
  menu.addEventListener("click", (e) => {
    if (e.target.tagName === "A") { menu.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); }
  });
}

/* ---------- copy email ---------- */
document.querySelectorAll("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const text = btn.getAttribute("data-copy");
    const done = () => { const t = btn.textContent; btn.textContent = T("تم النسخ", "Copied"); setTimeout(() => (btn.textContent = t), 1600); };
    try { navigator.clipboard.writeText(text).then(done, () => {}); } catch (e) {}
  });
});

/* ---------- forms → Firestore (collection: jc_submissions) ---------- */
document.querySelectorAll("form[data-type]").forEach((form) => {
  const status = form.querySelector(".status");
  const btn = form.querySelector("button[type=submit]");
  const show = (cls, msg) => { status.className = "status " + cls; status.textContent = msg; status.hidden = false; };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (form.querySelector(".hp input")?.value) return; // bot trap
    const missing = [...form.querySelectorAll("[required]")].find((el) => (el.type === "checkbox" ? !el.checked : !el.value.trim()));
    if (missing) { show("err", T("من فضلك املأ الخانات المطلوبة (عليها علامة *).", "Please fill in the required fields (marked *).")); missing.focus(); return; }

    const fields = {};
    form.querySelectorAll("input[name], select[name], textarea[name]").forEach((el) => {
      if (el.closest(".hp")) return;
      const label = (el.closest("label")?.querySelector(".lbl")?.textContent || el.name).replace("*", "").trim();
      const value = el.type === "checkbox" ? (el.checked ? T("موافق ✓", "Agreed ✓") : "") : String(el.value).trim().slice(0, 2000);
      fields[el.name] = { label: label.slice(0, 120), value };
    });

    btn.disabled = true; const old = btn.textContent; btn.textContent = T("جارٍ الإرسال…", "Sending…");
    try {
      await addDoc(collection(db, "jc_submissions"), {
        type: form.dataset.type,
        page: (EN ? "en/" : "") + (location.pathname.split("/").pop() || "index.html"),
        fields,
        status: "new",
        createdAt: serverTimestamp()
      });
      form.reset();
      show("ok", form.dataset.success || T("تم الاستلام! سنتواصل معك قريبًا.", "Received! We’ll be in touch soon."));
    } catch (err) {
      console.error(err);
      show("err", T("لم نتمكن من الإرسال الآن. جرّب مرة أخرى، أو راسلنا مباشرة على ", "We couldn’t send this right now. Please try again, or email us at ") + CONTACT_EMAIL);
    } finally {
      btn.disabled = false; btn.textContent = old;
    }
  });
});

/* ---------- live content (doc: jc_site/content), edited from admin.html ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function youtubeId(url) {
  const m = String(url || "").match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : (/^[\w-]{11}$/.test(url) ? url : null);
}
const PAGE = document.body.dataset.page; // home | starbooks | topteam | idrak
const L = (o, k) => (EN && o[k + "_en"]) ? o[k + "_en"] : o[k]; // pick English text when present

async function loadContent() {
  let c = {};
  try {
    const snap = await getDoc(doc(db, "jc_site", "content"));
    if (snap.exists()) c = snap.data();
  } catch (e) { console.warn("content not loaded", e); return; }

  // stats
  const stats = (c.stats || []).filter((s) => s.page === PAGE && s.value);
  const sBox = document.getElementById("stats");
  if (sBox && stats.length) {
    sBox.innerHTML = stats.map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(L(s, "label"))}</span></div>`).join("");
    sBox.closest("[data-when]")?.classList.remove("hide");
  }

  // gallery (photos added from the admin panel are appended after the built-in ones)
  const pics = (c.gallery || []).filter((g) => (g.page === PAGE || PAGE === "home") && g.src);
  const gBox = document.getElementById("gallery");
  if (gBox && pics.length) {
    const pre = EN && !/^https?:/.test(pics[0].src) ? "../" : "";
    gBox.insertAdjacentHTML("beforeend", pics.slice(0, PAGE === "home" ? 6 : 40).map((g) => {
      const src = (/^https?:/.test(g.src) ? "" : pre) + g.src, cap = L(g, "caption") || "";
      return `<figure><a class="gl" href="${esc(src)}" data-cap="${esc(cap)}"><img src="${esc(src)}" alt="${esc(cap)}" loading="lazy"></a>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ""}</figure>`;
    }).join(""));
    gBox.closest("[data-when]")?.classList.remove("hide");
  }

  // hall of fame (Top Team)
  const hof = c.hallOfFame || [];
  const hBox = document.getElementById("hof");
  if (hBox && hof.length) {
    hBox.innerHTML = hof.map((h) => `<tr><td>${esc(h.season)}</td><td>${esc(L(h, "place"))}</td><td>${esc(h.team)}</td><td>${esc(h.church)}</td></tr>`).join("");
    hBox.closest("[data-when]")?.classList.remove("hide");
  }

  // featured videos (Star Books) — pinned above the full library
  const vids = (c.videos || []).map((v) => ({ ...v, id: youtubeId(v.url) })).filter((v) => v.id);
  const vBox = document.getElementById("vgrid");
  if (vBox && vids.length) {
    vBox.innerHTML = vids.map((v) => videoCard(v.id, L(v, "title") || T("فيديو", "Video"), L(v, "book"))).join("");
    vBox.closest("[data-when]")?.classList.remove("hide");
  }
}

/* ---------- editable texts + contact info (doc: jc_site/texts), edited from admin.html ---------- */
const flat = (x) => String(x || "").replace(/\s+/g, " ").trim();
const md2html = (x) => esc(x).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/\n/g, "<br>");
const ORIG = new Map();
function applyTexts(tx) {
  if (!tx) return;
  document.querySelectorAll("[data-k]").forEach((el) => {
    if (!ORIG.has(el)) ORIG.set(el, { html: el.innerHTML, text: flat(el.textContent) });
    const o = tx[el.dataset.k], orig = ORIG.get(el);
    const val = o && (EN ? o.en : o.ar), src = o && (EN ? o.src_en : o.src_ar);
    if (!val || orig.text !== flat(src)) { if (el.dataset.edited) { el.innerHTML = orig.html; delete el.dataset.edited; } return; }
    let keep = "";
    for (const n of el.childNodes) { if (n.nodeType === 1) { if (n.tagName.toLowerCase() === "svg") keep = n.outerHTML; break; } if (n.textContent.trim()) break; }
    el.innerHTML = keep + md2html(val); el.dataset.edited = "1";
  });
  const c = tx._contact || {};
  if (c.email) {
    document.querySelectorAll("[data-email]").forEach((el) => (el.textContent = c.email));
    document.querySelectorAll("[data-copy]").forEach((el) => el.setAttribute("data-copy", c.email));
  }
  const list = document.querySelector(".contact-list"), old = document.getElementById("wa-row");
  const wa = String(c.whatsapp || "").replace(/[^\d]/g, "");
  if (old) old.remove();
  if (list && wa.length >= 8) {
    list.querySelector(".mail-row")?.insertAdjacentHTML("afterend",
      `<div id="wa-row"><dt>${T("واتساب", "WhatsApp")}</dt><dd class="lat" dir="ltr"><a href="https://wa.me/${wa}" target="_blank" rel="noopener">+${wa}</a></dd></div>`);
  }
}
(async () => {
  const CK = "jc-tx-v1";
  try { applyTexts(JSON.parse(localStorage.getItem(CK) || "null")); } catch (e) {}
  try {
    const snap = await getDoc(doc(db, "jc_site", "texts"));
    const tx = snap.exists() ? snap.data() : {};
    applyTexts(tx);
    try { localStorage.setItem(CK, JSON.stringify(tx)); } catch (e) {}
  } catch (e) { console.warn("texts not loaded", e); }
})();

/* ---------- Top Team photos uploaded from the admin panel (jc_photos + jc_photo_full) ---------- */
const FULL = new Map();
async function fullPhoto(id) {
  if (!FULL.has(id)) FULL.set(id, getDoc(doc(db, "jc_photo_full", id)).then((s) => (s.exists() ? s.data().data : null)).catch(() => null));
  return FULL.get(id);
}
(async () => {
  const g = document.getElementById("gallery");
  if (!g || PAGE !== "topteam") return;
  const STEP = 12; let last = null;
  const firstStatic = g.firstElementChild;
  const more = document.createElement("p");
  more.style.marginTop = "18px"; more.hidden = true;
  more.innerHTML = `<button class="btn btn-line" type="button">${T("صور أكتر", "More photos")}</button>`;
  g.after(more);
  const load = async () => {
    const col = collection(db, "jc_photos");
    const q = last ? query(col, orderBy("createdAt", "desc"), startAfter(last), limit(STEP)) : query(col, orderBy("createdAt", "desc"), limit(STEP));
    let snap; try { snap = await getDocs(q); } catch (e) { console.warn("photos not loaded", e); return; }
    const html = snap.docs.map((d) => {
      const p = d.data(), cap = L(p, "caption") || "";
      return `<figure><a class="gl" href="#photo" data-fid="${esc(d.id)}" data-cap="${esc(cap)}"><img src="${esc(p.thumb)}" alt="${esc(cap)}" loading="lazy" width="${+p.tw || 640}" height="${+p.th || 466}"></a>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ""}</figure>`;
    }).join("");
    if (firstStatic) firstStatic.insertAdjacentHTML("beforebegin", html); else g.insertAdjacentHTML("beforeend", html);
    if (snap.docs.length) { last = snap.docs[snap.docs.length - 1]; g.closest("[data-when]")?.classList.remove("hide"); }
    more.hidden = snap.docs.length < STEP;
  };
  more.querySelector("button").addEventListener("click", load);
  load();
})();

/* ---------- Star Books: every video on the channel ---------- */
function videoCard(id, title, sub) {
  return `<a class="vcard" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener">
    <div class="vthumb" style="background-image:url('https://i.ytimg.com/vi/${id}/mqdefault.jpg')"></div>
    <div class="vt">${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ""}</div></a>`;
}
const norm = (x) => String(x || "").toLowerCase()
  .replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");

async function fetchAllVideos() {
  const CK = "jc-yt-v1", MAX_AGE = 6 * 3600 * 1000;
  try { const c = JSON.parse(localStorage.getItem(CK) || "null"); if (c && Date.now() - c.t < MAX_AGE && c.items?.length) return c.items; } catch (e) {}
  const items = []; let page = "";
  for (let i = 0; i < 40; i++) {
    const u = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${STARBOOKS_UPLOADS}&key=${YOUTUBE_API_KEY}${page ? "&pageToken=" + page : ""}`;
    const r = await fetch(u); if (!r.ok) throw new Error("YouTube API " + r.status);
    const j = await r.json();
    for (const it of j.items || []) {
      const sn = it.snippet || {}, id = sn.resourceId?.videoId;
      if (!id || /^(Private|Deleted) video$/.test(sn.title)) continue;
      items.push({ id, title: sn.title, date: sn.publishedAt });
    }
    if (!j.nextPageToken) break; page = j.nextPageToken;
  }
  try { localStorage.setItem(CK, JSON.stringify({ t: Date.now(), items })); } catch (e) {}
  return items;
}

(async () => {
  const grid = document.getElementById("vall"); if (!grid) return;
  const more = document.getElementById("v-more"), count = document.getElementById("v-count"), search = document.getElementById("v-search");
  const fallback = () => {
    grid.remove(); document.querySelector(".lib-tools .v-search")?.remove(); more.hidden = true;
    const fb = document.getElementById("v-fallback"), fr = document.getElementById("player-frame");
    fr.src = fr.dataset.src; fb.hidden = false;
    count.textContent = T("شغّل أي فيديو من قائمة المشغّل، أو افتح القناة.", "Play any video from the player list, or open the channel.");
  };
  if (!YOUTUBE_API_KEY) return fallback();
  let all;
  try { all = await fetchAllVideos(); } catch (e) { console.warn(e); return fallback(); }
  if (!all.length) return fallback();
  const fmt = new Intl.DateTimeFormat(EN ? "en-GB" : "ar-EG", { year: "numeric", month: "long" });
  let list = all, shown = 0; const STEP = 24;
  const render = (reset) => {
    if (reset) { grid.innerHTML = ""; shown = 0; }
    const next = list.slice(shown, shown + STEP);
    grid.insertAdjacentHTML("beforeend", next.map((v) => videoCard(v.id, v.title, v.date ? fmt.format(new Date(v.date)) : "")).join(""));
    shown += next.length;
    more.hidden = shown >= list.length;
    count.textContent = list.length === all.length
      ? T(`${all.length} فيديو`, `${all.length} videos`)
      : T(`${list.length} من ${all.length} فيديو`, `${list.length} of ${all.length} videos`);
    if (!list.length) grid.innerHTML = `<p class="lib-empty">${T("مفيش فيديو بالاسم ده. جرّب كلمة تانية.", "No video matches that. Try another word.")}</p>`;
    grid.setAttribute("aria-busy", "false");
  };
  more.addEventListener("click", () => render(false));
  let tmr; search.addEventListener("input", () => { clearTimeout(tmr); tmr = setTimeout(() => {
    const q = norm(search.value.trim()); list = q ? all.filter((v) => norm(v.title).includes(q)) : all; render(true);
  }, 150); });
  render(true);
})();

/* ---------- moving photo backdrop (all pages) ---------- */
(() => {
  if (document.querySelector(".bg-photos")) return;
  const pb = new URL("./photos/", import.meta.url).href, cb = new URL("./covers/", import.meta.url).href;
  const photos = ["tt-2025-05-egypt","tt-2024-10-egypt-hall","tt-2023-05-lebanon-cup","tt-2024-08-egypt-group","tt-2022-11-lebanon",
    "tt-2025-02-egypt","tt-2024-04-lebanon","tt-2024-11-egypt","tt-2023-05-lebanon-crowd","tt-2024-10-egypt-group",
    "tt-2023-05-lebanon-hall","tt-2024-08-egypt-joy","tt-2022-11-lebanon-stage","tt-2024-11-egypt-smile","tt-2023-05-lebanon-cup2",
    "tt-2024-08-egypt-winner","tt-2024-08-egypt-winner2"].map((n) => pb + n + "-sm.webp");
  const covers = Array.from({ length: 53 }, (_, i) => cb + "c" + String(i).padStart(2, "0") + ".webp");
  // shuffle covers once per visit, then alternate photo / cover / cover
  for (let i = covers.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [covers[i], covers[j]] = [covers[j], covers[i]]; }
  const P = []; let pi = 0, ci = 0;
  while (ci < covers.length) { P.push(photos[pi++ % photos.length]); P.push(covers[ci++]); if (ci < covers.length) P.push(covers[ci++]); }
  const cols = innerWidth < 600 ? 3 : innerWidth < 1100 ? 4 : 6;
  const layer = document.createElement("div");
  layer.className = "bg-photos"; layer.setAttribute("aria-hidden", "true");
  let html = "";
  for (let c = 0; c < cols; c++) {
    const items = [];
    for (let i = 0; i < 6; i++) items.push(P[(c * 6 + i) % P.length]);
    const strip = items.map((src) => `<span style="background-image:url('${src}')"></span>`).join("");
    html += `<div class="bp-col ${c % 2 ? "down" : "up"}" style="--d:${150 + (c % 3) * 30}s"><div class="bp-track">${strip}${strip}</div></div>`;
  }
  layer.innerHTML = html;
  document.body.prepend(layer);
})();

loadContent();

/* ---------- photo viewer ---------- */
(() => {
  const links = () => [...document.querySelectorAll("a.gl")];
  let box, img, cap, idx = 0;
  const build = () => {
    box = document.createElement("div");
    box.className = "lb"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.hidden = true;
    box.innerHTML = `<button class="lb-x" type="button" aria-label="${T("إغلاق", "Close")}">×</button>
      <button class="lb-p" type="button" aria-label="${T("السابقة", "Previous")}">‹</button>
      <figure><img alt=""><figcaption></figcaption></figure>
      <button class="lb-n" type="button" aria-label="${T("التالية", "Next")}">›</button>`;
    document.body.appendChild(box);
    img = box.querySelector("img"); cap = box.querySelector("figcaption");
    box.addEventListener("click", (e) => {
      if (e.target === box || e.target.closest(".lb-x")) close();
      else if (e.target.closest(".lb-n")) show(idx + (EN ? 1 : -1));
      else if (e.target.closest(".lb-p")) show(idx + (EN ? -1 : 1));
    });
    document.addEventListener("keydown", (e) => {
      if (box.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") show(idx + (EN ? 1 : -1));
      if (e.key === "ArrowLeft") show(idx + (EN ? -1 : 1));
    });
  };
  const show = (i) => {
    const L = links(); if (!L.length) return;
    idx = (i + L.length) % L.length;
    const a = L[idx];
    img.alt = a.dataset.cap || ""; cap.textContent = a.dataset.cap || "";
    if (a.dataset.fid) {
      img.src = a.querySelector("img")?.src || "";
      fullPhoto(a.dataset.fid).then((u) => { if (u && links()[idx] === a) img.src = u; });
    } else img.src = a.href;
  };
  const close = () => { box.hidden = true; document.body.style.overflow = ""; };
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a.gl"); if (!a) return;
    e.preventDefault(); if (!box) build();
    show(links().indexOf(a)); box.hidden = false; document.body.style.overflow = "hidden";
    box.querySelector(".lb-x").focus();
  });
})();

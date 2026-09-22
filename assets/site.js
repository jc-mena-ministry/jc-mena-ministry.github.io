// JC — Jesus Can · shared site script (menu, forms → Firestore, live content)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig, CONTACT_EMAIL } from "./config.js";
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

  // featured videos (Star Books)
  const vids = (c.videos || []).map((v) => ({ ...v, id: youtubeId(v.url) })).filter((v) => v.id);
  const vBox = document.getElementById("vgrid");
  if (vBox && vids.length) {
    vBox.innerHTML = vids.map((v) =>
      `<button class="vcard" type="button" data-id="${v.id}"><div class="vthumb" style="background-image:url('https://i.ytimg.com/vi/${v.id}/hqdefault.jpg')"></div><div class="vt">${esc(L(v, "title") || T("فيديو", "Video"))}${L(v, "book") ? `<small>${esc(L(v, "book"))}</small>` : ""}</div></button>`).join("");
    document.getElementById("lib-empty")?.classList.add("hide");
    vBox.closest("[data-when]")?.classList.remove("hide");
  }
}

/* player: switch between channel playlist and a chosen video */
const frame = document.getElementById("player-frame");
if (frame) {
  document.addEventListener("click", (e) => {
    const card = e.target.closest(".vcard");
    if (card) {
      frame.src = `https://www.youtube-nocookie.com/embed/${card.dataset.id}?autoplay=1&rel=0&hl=${EN ? "en" : "ar"}`;
      document.querySelectorAll(".vcard.on").forEach((x) => x.classList.remove("on"));
      card.classList.add("on");
      frame.closest(".player").scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (e.target.closest("#play-all")) {
      frame.src = `https://www.youtube-nocookie.com/embed/videoseries?list=${STARBOOKS_UPLOADS}&rel=0`;
      document.querySelectorAll(".vcard.on").forEach((x) => x.classList.remove("on"));
    }
  });
}

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
    img.src = L[idx].href; img.alt = L[idx].dataset.cap || ""; cap.textContent = L[idx].dataset.cap || "";
  };
  const close = () => { box.hidden = true; document.body.style.overflow = ""; };
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a.gl"); if (!a) return;
    e.preventDefault(); if (!box) build();
    show(links().indexOf(a)); box.hidden = false; document.body.style.overflow = "hidden";
    box.querySelector(".lb-x").focus();
  });
})();

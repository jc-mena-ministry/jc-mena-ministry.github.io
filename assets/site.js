// JC — Jesus Can · shared site script (menu, forms → Firestore, live content)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig, CONTACT_EMAIL } from "./config.js";
export const STARBOOKS_UPLOADS = "UUdzhbDbZrDT-7Mls7VhdVZQ"; // all channel uploads

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
    const done = () => { const t = btn.textContent; btn.textContent = "تم النسخ"; setTimeout(() => (btn.textContent = t), 1600); };
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
    const missing = [...form.querySelectorAll("[required]")].find((el) => !el.value.trim());
    if (missing) { show("err", "من فضلك املأ الخانات المطلوبة (عليها علامة *)."); missing.focus(); return; }

    const fields = {};
    form.querySelectorAll("input[name], select[name], textarea[name]").forEach((el) => {
      if (el.closest(".hp")) return;
      const label = el.closest("label")?.childNodes[0]?.textContent?.replace("*", "").trim() || el.name;
      fields[el.name] = { label, value: String(el.value).trim().slice(0, 2000) };
    });

    btn.disabled = true; const old = btn.textContent; btn.textContent = "جارٍ الإرسال…";
    try {
      await addDoc(collection(db, "jc_submissions"), {
        type: form.dataset.type,
        page: location.pathname.split("/").pop() || "index.html",
        fields,
        status: "new",
        createdAt: serverTimestamp()
      });
      form.reset();
      show("ok", form.dataset.success || "تم الاستلام! سنتواصل معك قريبًا.");
    } catch (err) {
      console.error(err);
      show("err", "لم نتمكن من الإرسال الآن. جرّب مرة أخرى، أو راسلنا مباشرة على " + CONTACT_EMAIL);
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
    sBox.innerHTML = stats.map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("");
    sBox.closest("[data-when]")?.classList.remove("hide");
  }

  // gallery
  const pics = (c.gallery || []).filter((g) => (g.page === PAGE || PAGE === "home") && g.src);
  const gBox = document.getElementById("gallery");
  if (gBox && pics.length) {
    gBox.innerHTML = pics.slice(0, PAGE === "home" ? 8 : 40).map((g) =>
      `<figure><img src="${esc(g.src)}" alt="${esc(g.caption || "")}" loading="lazy">${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ""}</figure>`).join("");
    gBox.closest("[data-when]")?.classList.remove("hide");
  }

  // hall of fame (Top Team)
  const hof = c.hallOfFame || [];
  const hBox = document.getElementById("hof");
  if (hBox && hof.length) {
    hBox.innerHTML = hof.map((h) => `<tr><td>${esc(h.season)}</td><td>${esc(h.place)}</td><td>${esc(h.team)}</td><td>${esc(h.church)}</td></tr>`).join("");
    hBox.closest("[data-when]")?.classList.remove("hide");
  }

  // featured videos (Star Books)
  const vids = (c.videos || []).map((v) => ({ ...v, id: youtubeId(v.url) })).filter((v) => v.id);
  const vBox = document.getElementById("vgrid");
  if (vBox && vids.length) {
    vBox.innerHTML = vids.map((v) =>
      `<button class="vcard" type="button" data-id="${v.id}"><div class="vthumb" style="background-image:url('https://i.ytimg.com/vi/${v.id}/hqdefault.jpg')"></div><div class="vt">${esc(v.title || "فيديو")}${v.book ? `<small>${esc(v.book)}</small>` : ""}</div></button>`).join("");
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
      frame.src = `https://www.youtube-nocookie.com/embed/${card.dataset.id}?autoplay=1&rel=0`;
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

(() => {
  "use strict";

  // Backend is same-origin by default (the Rust server serves this file too).
  // Override by setting `window.API_URL` before this script loads if you're
  // hosting the frontend separately from the API.
  const API_URL = window.API_URL || "";

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  // ---------- Scene: scroll-scrubbed frame background ----------

  // Keep in sync with the files in frames/landscape (currently 0020.webp..0090.webp).
  const FRAME_START = 20;
  const FRAME_COUNT = 71;
  // How many pixels of scroll the intro frame sequence plays over, from the
  // very top of the page. Past this, the canvas just holds its last frame as
  // a fixed backdrop for the rest of the site.
  const ANIMATION_DISTANCE = 1200;
  const REVEAL_START = 0.7;
  const REVEAL_END = 0.95;

  const frameUrls = Array.from(
    { length: FRAME_COUNT },
    (_, i) => `frames/landscape/${String(FRAME_START + i).padStart(4, "0")}.webp`
  );

  const canvas = document.getElementById("sceneCanvas");
  const ctx = canvas.getContext("2d");
  const loadingEl = document.getElementById("sceneLoading");
  const loadPctEl = document.getElementById("loadPct");
  const navPill = document.getElementById("navPill");

  const images = new Array(frameUrls.length);
  let loadedCount = 0;
  let currentFrame = -1;

  function drawFrame(index) {
    const img = images[index];
    if (!img || !img.complete || !img.naturalWidth) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // "cover" fit: scale so the image fills the canvas, cropping the overflow.
    const scale = Math.max(width / img.width, height / img.height);
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    const offsetX = (width - drawWidth) / 2;
    const offsetY = (height - drawHeight) / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
  }

  frameUrls.forEach((src, i) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = img.onerror = () => {
      loadedCount += 1;
      if (loadPctEl) loadPctEl.textContent = String(Math.round((loadedCount / frameUrls.length) * 100));
      if (loadedCount === frameUrls.length) {
        loadingEl?.classList.add("is-hidden");
        drawFrame(Math.max(currentFrame, 0));
      }
    };
    img.src = src;
    images[i] = img;
  });

  function updateOnScroll() {
    const progress = clamp(window.scrollY / ANIMATION_DISTANCE, 0, 1);

    const frameIndex = Math.round(progress * (FRAME_COUNT - 1));
    if (frameIndex !== currentFrame) {
      currentFrame = frameIndex;
      drawFrame(currentFrame);
    }

    const navOpacity = clamp((progress - REVEAL_START) / (REVEAL_END - REVEAL_START), 0, 1);
    navPill.style.opacity = String(navOpacity);
    navPill.style.transform = `translateY(${(-16 * (1 - navOpacity)).toFixed(2)}px)`;
    navPill.classList.toggle("is-visible", progress > REVEAL_START);
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateOnScroll();
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => drawFrame(Math.max(currentFrame, 0)));
  updateOnScroll();

  document.getElementById("logoBtn")?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ---------- Reveal-on-scroll ----------

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -80px 0px" }
  );
  document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

  // ---------- Team / Events: fetch from the backend ----------

  async function getJson(path, fallback) {
    try {
      const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
      if (!res.ok) return fallback;
      return await res.json();
    } catch {
      return fallback;
    }
  }

  const FALLBACK_TEAM = [
    { id: "1", name: "Alex Dupont", role: "President candidate", bio: "Placeholder bio." },
    { id: "2", name: "Sam Rossi", role: "Vice-president candidate", bio: "Placeholder bio." },
    { id: "3", name: "Jo Martin", role: "Treasurer candidate", bio: "Placeholder bio." },
  ];

  const FALLBACK_EVENTS = [
    { id: "1", title: "Lancement des campagnes", date: "06/12/2026", location: "Fosse Cauchy", description: "Lorem Ipsum" },
    { id: "2", title: "Hotlines", date: "07/12/2026, 08/12/2026", location: "", description: "Lorem Ipsum" },
    { id: "3", title: "Grande Activité", date: "08/12/2026", location: "Fosse Cauchy", description: "Lorem Ipsum" },
    { id: "4", title: "Petite Activité", date: "09/12/2026", location: "Fosse Cauchy", description: "Lorem Ipsum" },
    { id: "5", title: "Petits-Déjeuners", date: "8-9/12/2026", location: "", description: "Lorem Ipsum" },
    { id: "6", title: "Dîner", date: "DD/12/2026", location: "", description: "Lorem Ipsum" },
    { id: "7", title: "Amphi de présentation", date: "8-9/12/2026", location: "Salle Polyvalente", description: "Lorem Ipsum" },
    { id: "8", title: "Elections", date: "11-12/12/2026", location: "", description: "Lorem Ipsum" },
  ];

  async function renderTeam() {
    const team = await getJson("/api/team", []);
    const members = team.length > 0 ? team : FALLBACK_TEAM;
    document.getElementById("teamStatus").textContent =
      team.length > 0
        ? "Loaded from the backend API."
        : "Backend not reachable yet — showing placeholder data.";

    const grid = document.getElementById("teamGrid");
    members.forEach((member) => {
      const card = document.createElement("div");
      card.className = "card glass team-card reveal";
      card.innerHTML = `
        <div class="avatar" aria-hidden="true"></div>
        <h3>${escapeHtml(member.name)}</h3>
        <p class="muted small">${escapeHtml(member.role)}</p>
        <p class="muted">${escapeHtml(member.bio)}</p>
      `;
      grid.appendChild(card);
      revealObserver.observe(card);
    });
  }

  async function renderEvents() {
    const events = await getJson("/api/events", []);
    const items = events.length > 0 ? events : FALLBACK_EVENTS;
    document.getElementById("eventsStatus").textContent =
      events.length > 0
        ? "Loaded from the backend API."
        : "Backend not reachable yet — showing placeholder data.";

    const list = document.getElementById("eventsList");
    items.forEach((item) => {
      const date = Array.isArray(item.date) ? item.date.join(", ") : item.date;
      const li = document.createElement("li");
      li.className = "timeline-item glass reveal";
      li.innerHTML = `
        <span class="dot" aria-hidden="true"></span>
        <p class="eyebrow small" style="display:inline-block;border:none;padding:0;text-transform:uppercase;letter-spacing:0.05em;">
          ${escapeHtml(date)} ${item.location ? "· " + escapeHtml(item.location) : ""}
        </p>
        <h3>${escapeHtml(item.title)}</h3>
        <p class="muted">${escapeHtml(item.description)}</p>
      `;
      list.appendChild(li);
      revealObserver.observe(li);
    });
  }

  renderTeam();
  renderEvents();

  // ---------- Contact / command form ----------

  const form = document.getElementById("commandForm");
  const submitBtn = document.getElementById("submitBtn");
  const formMessage = document.getElementById("formMessage");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";
    formMessage.textContent = "";
    formMessage.className = "form-message";

    try {
      const res = await fetch(`${API_URL}/api/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: data.get("first_name") || "",
          last_name: data.get("last_name") || "",
          residence: data.get("residence") || "",
          room_number: data.get("room_number") || "",
          phone_number: data.get("phone_number") || "",
          food: data.get("food") || "",
        }),
      });

      if (res.ok) {
        form.reset();
        formMessage.textContent = "Thanks! Your message has been sent.";
        formMessage.classList.add("success");
      } else {
        const body = await res.json().catch(() => null);
        formMessage.textContent = body?.error ?? "Something went wrong.";
        formMessage.classList.add("error");
      }
    } catch {
      formMessage.textContent = "Could not reach the server.";
      formMessage.classList.add("error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send message";
    }
  });

  // ---------- Footer year ----------

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();

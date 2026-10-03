import "./style.css";

// Filter the printed dispatch cards; the complete gallery also works without JS.
const filters = [...document.querySelectorAll("[data-city]")];
const cards = [...document.querySelectorAll(".dispatch-card")];
const count = document.querySelector(".gallery-count");
for (const button of filters) {
  button.addEventListener("click", () => {
    for (const filter of filters) filter.setAttribute("aria-pressed", String(filter === button));
    let visible = 0;
    for (const card of cards) {
      card.hidden = button.dataset.city !== "all" && card.dataset.location !== button.dataset.city;
      if (!card.hidden) visible++;
    }
    count.textContent = `${visible} ${visible === 1 ? "dispatch" : "dispatches"}`;
  });
}

// Native dialog supplies focus containment and Escape; image links remain the fallback.
const dialog = document.querySelector(".photo-dialog");
const photo = document.querySelector("#dialog-image");
const caption = document.querySelector("#dialog-caption");
let activeLinks = [];
let activeIndex = 0;
let opener;
function showPhoto(index) {
  activeIndex = (index + activeLinks.length) % activeLinks.length;
  const link = activeLinks[activeIndex];
  photo.src = link.href;
  photo.alt = link.querySelector("img").alt;
  caption.textContent = link.dataset.caption;
}
for (const link of document.querySelectorAll("[data-photo]")) {
  link.addEventListener("click", (event) => {
    if (typeof dialog.showModal !== "function" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    activeLinks = cards.filter((card) => !card.hidden).map((card) => card.querySelector("a"));
    opener = link;
    showPhoto(activeLinks.indexOf(link));
    dialog.showModal();
  });
}
dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
dialog.querySelector("[data-prev]").addEventListener("click", () => showPhoto(activeIndex - 1));
dialog.querySelector("[data-next]").addEventListener("click", () => showPhoto(activeIndex + 1));
dialog.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") { event.preventDefault(); showPhoto(activeIndex - 1); }
  if (event.key === "ArrowRight") { event.preventDefault(); showPhoto(activeIndex + 1); }
});
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener("close", () => opener?.focus());

// Preserve the existing Tally form, loading it as the correspondence section approaches.
function loadRegistration() {
  const frame = document.querySelector("iframe[data-tally-src]");
  frame.src = frame.dataset.tallySrc;
  const script = document.createElement("script");
  script.src = "https://tally.so/widgets/embed.js";
  script.async = true;
  script.onload = () => window.Tally?.loadEmbeds();
  document.head.append(script);
}
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      loadRegistration();
      observer.disconnect();
    }
  }, { rootMargin: "500px" });
  observer.observe(document.querySelector("#register"));
} else loadRegistration();

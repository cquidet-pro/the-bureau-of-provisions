import "./style.css";

// ---------------------------------------------------------------------------
// Early-access email capture.
//
// By default there is no backend, so submitting stores nothing but shows the
// confirmation state. To wire a real provider, set FORM_ENDPOINT to a URL that
// accepts a JSON POST of `{ email }` (Formspree, a Cloudflare Worker, a
// Firebase Function, etc.) and the handler will POST there before confirming.
// ---------------------------------------------------------------------------
const FORM_ENDPOINT = ""; // e.g. "https://formspree.io/f/xxxxxxx"

const form = document.querySelector("#register-form");
const statusEl = document.querySelector("#register-status");
const emailInput = document.querySelector("#email");

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = "register-status" + (kind ? " " + kind : "");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = emailInput.value.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setStatus("That address doesn't look right. Mind checking it?", "err");
    emailInput.focus();
    return;
  }

  const button = form.querySelector("button");
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Registering…";

  try {
    if (FORM_ENDPOINT) {
      await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    }
    setStatus("You're on the list. We'll be in touch.", "ok");
    form.reset();
  } catch (err) {
    setStatus("Something went wrong. Please try again.", "err");
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
});

// ---------------------------------------------------------------------------
// Reveal-on-scroll.
// ---------------------------------------------------------------------------
const revealEls = document.querySelectorAll("[data-reveal]");

if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("is-visible"));
}

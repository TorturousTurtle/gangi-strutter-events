function initMobileNav() {
  const btn = document.getElementById("mobileNavToggle");
  const nav = document.getElementById("mobileNav");
  const iconMenu = document.getElementById("iconMenu");
  const iconClose = document.getElementById("iconClose");

  // Header not injected yet
  if (!btn || !nav || !iconMenu || !iconClose) return false;

  // Prevent double-binding if init runs more than once
  if (btn.dataset.bound === "1") return true;
  btn.dataset.bound = "1";

  function setOpen(open) {
    nav.classList.toggle("hidden", !open);
    iconMenu.classList.toggle("hidden", open);
    iconClose.classList.toggle("hidden", !open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const isOpen = !nav.classList.contains("hidden");
    setOpen(!isOpen);
  });

  nav.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (a) setOpen(false);
  });

  setOpen(false);
  return true;
}

function boot() {
  if (initMobileNav()) return;

  // Retry for a few seconds while layout.js injects fragments
  let tries = 0;
  const maxTries = 80; // ~4s at 50ms
  const timer = setInterval(() => {
    tries += 1;
    if (initMobileNav() || tries >= maxTries) clearInterval(timer);
  }, 50);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

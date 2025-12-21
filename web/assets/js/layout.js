async function loadFragment(selector, url) {
  const el = document.querySelector(selector);
  if (!el) return;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    el.innerHTML = "<!-- fragment failed to load -->";
    return;
  }

  el.innerHTML = await res.text();
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadFragment("#site-header", "/_fragments/header.html");
  await loadFragment("#site-footer", "/_fragments/footer.html");
});

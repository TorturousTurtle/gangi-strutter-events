/**
 * Layout Module
 *
 * Loads HTML fragments (header, footer) and initializes branding.
 */

async function loadFragment(selector, url) {
  const el = document.querySelector(selector);
  if (!el) return;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    el.innerHTML = '<!-- fragment failed to load -->';
    return;
  }

  el.innerHTML = await res.text();
}

document.addEventListener('DOMContentLoaded', async () => {
  // Load header and footer fragments
  await Promise.all([
    loadFragment('#site-header', '/_fragments/header.html'),
    loadFragment('#site-footer', '/_fragments/footer.html'),
  ]);

  // Initialize branding after fragments are loaded
  if (typeof Branding !== 'undefined' && Branding.init) {
    await Branding.init();
  }
});

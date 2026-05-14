// web/assets/js/admin/reports/printWindow.js
// Centralized helper for opening a printable window and writing HTML into it.

export function openPrintWindow(html, { showToast } = {}) {
  // NOTE: do NOT pass "noopener" here.
  // Some browsers will still open the tab/window but return `null`, which means we can't write HTML into it.
  const w = window.open("", "_blank");
  if (!w) {
    if (typeof showToast === "function") {
      showToast("Popup blocked. Allow popups for this site to print reports.", "error");
    } else {
      // fallback
      alert("Popup blocked. Allow popups for this site to print reports.");
    }
    return null;
  }

  // Reduce risk of the child window being able to reach back to the opener.
  try {
    w.opener = null;
  } catch (_) {}

  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();

  return w;
}

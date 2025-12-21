const form = document.getElementById("registrationForm");

// ===== Event Options (dynamic from DB) =====
let eventOptions = []; // [{ id, name, price }]
let facilityFee = 0;   // numeric dollars (from current competition)

function formatMoney(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "$0.00";
  return `$${x.toFixed(2)}`;
}

function getCheckedEventSelections(container) {
  const checks = Array.from(container.querySelectorAll('input[type="checkbox"][data-event-opt="1"]'));
  const selected = checks.filter((c) => c.checked).map((c) => {
    return {
      id: Number(c.value),
      name: String(c.dataset.name || '').trim(),
      price: Number(c.dataset.price || 0),
    };
  });
  return selected;
}

function computeTotal(selections) {
  return selections.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
}

function insertEventOptionsUI(form) {
  // Prefer a stable mount point if present
  const mount = document.getElementById('eventOptionsMount');

  // Fallback: insert just above the submit button row
  const submitBtn = form.querySelector('button[type="submit"]');
  const anchor = submitBtn ? submitBtn.closest('div') || submitBtn : null;

  const wrapper = document.createElement('section');
  wrapper.id = 'eventOptionsSection';
  wrapper.className = 'mt-4 border-t border-gray-200 pt-4';

  wrapper.innerHTML = `
    <h2 class="text-lg font-semibold text-gray-900">Event Options</h2>
    <p class="mt-1 text-sm text-gray-600">Select the events you want to enter. Prices shown are per entry.</p>

    <div id="eventOptionsList" class="mt-4 space-y-2"></div>

    <div class="mt-5 border-t border-gray-200 pt-4 space-y-2">
      <div class="flex items-center justify-between">
        <div class="text-sm text-gray-700">Selected events</div>
        <div id="eventOptionsSubtotal" class="text-sm font-medium text-gray-900">$0.00</div>
      </div>

      <div id="facilityFeeRow" class="flex items-center justify-between hidden">
        <div class="text-sm text-gray-700">Additional fee</div>
        <div id="facilityFeeValue" class="text-sm font-medium text-gray-900">$0.00</div>
      </div>

      <div class="flex items-center justify-between">
        <div class="text-sm font-semibold text-gray-900">Total</div>
        <div id="eventOptionsTotal" class="text-sm font-semibold text-gray-900">$0.00</div>
      </div>
    </div>
  `;

  if (mount) {
    mount.innerHTML = '';
    mount.appendChild(wrapper);
  } else if (anchor && anchor.parentNode) {
    // Insert before the anchor if possible; otherwise append at end of form
    anchor.parentNode.insertBefore(wrapper, anchor);
  } else {
    form.appendChild(wrapper);
  }

  return {
    section: wrapper,
    listEl: wrapper.querySelector('#eventOptionsList'),
    subtotalEl: wrapper.querySelector('#eventOptionsSubtotal'),
    facilityRowEl: wrapper.querySelector('#facilityFeeRow'),
    facilityValEl: wrapper.querySelector('#facilityFeeValue'),
    totalEl: wrapper.querySelector('#eventOptionsTotal'),
  };
}

function renderEventOptions(listEl, options) {
  if (!listEl) return;

  if (!Array.isArray(options) || options.length === 0) {
    listEl.innerHTML = `<p class="text-sm text-gray-700">No event options are available for this competition yet.</p>`;
    return;
  }

  listEl.innerHTML = options
    .map((o) => {
      const priceNum = Number(o.price || 0);
      return `
        <label class="flex items-center justify-between gap-3">
          <span class="flex items-center gap-2">
            <input type="checkbox" data-event-opt="1" value="${o.id}" data-price="${priceNum}" data-name="${String(o.name || '').replace(/"/g, '&quot;')}" />
            <span class="text-sm text-gray-900">${o.name}</span>
          </span>
          <span class="text-sm text-gray-700">${formatMoney(priceNum)}</span>
        </label>
      `;
    })
    .join('');
}

async function loadEventOptionsFromApi() {
  const res = await fetch('/api/register.php', { method: 'GET' });
  if (!res.ok) throw new Error(`Failed to load event options (${res.status})`);
  const data = await res.json();

  const options = Array.isArray(data?.eventOptions) ? data.eventOptions : [];
  const fee = Number(data?.competition?.facilityFee ?? data?.competition?.facility_fee ?? 0);

  return {
    options,
    facilityFee: Number.isFinite(fee) ? fee : 0,
  };
}

if (form) {
  const submitBtn = form.querySelector('button[type="submit"]');
  const errorEl = document.getElementById("formError");

  const duetRadioYes = form.querySelector('input[name="isDuetOrTrio"][value="yes"]');
  const duetRadioNo = form.querySelector('input[name="isDuetOrTrio"][value="no"]');
  const duetSection = document.getElementById("duetTrioDetails");

  // Build Event Options UI (dynamic)
  const eventUI = insertEventOptionsUI(form);

  function updateEventTotal() {
    const selected = getCheckedEventSelections(eventUI.section);
    const subtotal = computeTotal(selected);
    const feeNum = Number(facilityFee) || 0;
    const total = subtotal + feeNum;

    if (eventUI.subtotalEl) eventUI.subtotalEl.textContent = formatMoney(subtotal);

    if (eventUI.facilityRowEl && eventUI.facilityValEl) {
      if (feeNum > 0) {
        eventUI.facilityRowEl.classList.remove('hidden');
        eventUI.facilityValEl.textContent = formatMoney(feeNum);
      } else {
        eventUI.facilityRowEl.classList.add('hidden');
        eventUI.facilityValEl.textContent = formatMoney(0);
      }
    }

    if (eventUI.totalEl) eventUI.totalEl.textContent = formatMoney(total);
  }

  // Load from API and render
  (async () => {
    try {
      const loaded = await loadEventOptionsFromApi();
      eventOptions = loaded.options;
      facilityFee = loaded.facilityFee;
      renderEventOptions(eventUI.listEl, eventOptions);
      updateEventTotal();

      // Recalculate total on toggle
      eventUI.section.addEventListener('change', (e) => {
        const t = e.target;
        if (t && t.matches && t.matches('input[type="checkbox"][data-event-opt="1"]')) {
          updateEventTotal();
        }
      });
    } catch (err) {
      console.error(err);
      if (eventUI.listEl) {
        eventUI.listEl.innerHTML = `<p class="text-sm text-red-600">Unable to load event options right now.</p>`;
      }
    }
  })();

  function setSubmitting(isSubmitting) {
    if (submitBtn) {
      submitBtn.disabled = isSubmitting;
      submitBtn.textContent = isSubmitting ? "Submitting…" : "Proceed to payment";
      submitBtn.classList.toggle("opacity-60", isSubmitting);
      submitBtn.classList.toggle("cursor-not-allowed", isSubmitting);
    }
  }

  function showError(message) {
    if (!errorEl) return;
    if (message) {
      errorEl.textContent = message;
      errorEl.classList.remove("hidden");
    } else {
      errorEl.textContent = "";
      errorEl.classList.add("hidden");
    }
  }

  function setDuetOpen(open) {
    if (!duetSection) return;
    duetSection.classList.toggle("hidden", !open);

    // If hiding, clear the dependent fields so they don't get accidentally submitted.
    if (!open) {
      [
        "duetAgeDivision",
        "trioAgeDivision",
        "partnerName",
      ].forEach((name) => {
        const el = form.querySelector(`[name="${name}"]`);
        if (el) el.value = "";
      });
    }
  }

  // Initialize duet/trio section state based on default radio
  const initialDuet = duetRadioYes && duetRadioYes.checked;
  setDuetOpen(Boolean(initialDuet));

  if (duetRadioYes) duetRadioYes.addEventListener("change", () => setDuetOpen(true));
  if (duetRadioNo) duetRadioNo.addEventListener("change", () => setDuetOpen(false));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError(null);
    setSubmitting(true);

    // Clear any previous draft so we don't show stale info on the payment page.
    localStorage.removeItem('registrationDraft');

    const formData = new FormData(form);

    // Normalize free-text fields
    const coachRaw = formData.get('coachName');
    if (typeof coachRaw === 'string') formData.set('coachName', coachRaw.trim());

    const teamRaw = formData.get('teamName');
    if (typeof teamRaw === 'string') formData.set('teamName', teamRaw.trim());

    // Attach selected event options + totals (for backend persistence later)
    try {
      const selected = getCheckedEventSelections(document.getElementById('eventOptionsSection') || form);
      const subtotal = computeTotal(selected);
      const fee = Number(facilityFee) || 0;
      const total = subtotal + fee;

      formData.set('eventSelections', JSON.stringify(selected));
      formData.set('eventSubtotal', String(subtotal.toFixed(2)));
      formData.set('facilityFee', String(fee.toFixed(2)));
      formData.set('eventTotal', String(total.toFixed(2)));
    } catch (_) {
      // If the section doesn't exist, ignore
    }

    try {
      // Build a draft payload from the form, so we can review + pay BEFORE writing to DB.
      const draft = {};
      for (const [k, v] of formData.entries()) {
        // Skip file inputs (none expected) and keep scalar values.
        if (typeof v === 'string') {
          draft[k] = v;
        }
      }

      // Normalize common keys so payment page can display them reliably.
      draft.first_name = draft.first_name ?? draft.firstName ?? String(formData.get('firstName') || formData.get('first_name') || '');
      draft.last_name = draft.last_name ?? draft.lastName ?? String(formData.get('lastName') || formData.get('last_name') || '');
      draft.email = String(formData.get('email') || draft.email || '');
      draft.team_name = String(formData.get('teamName') || formData.get('team_name') || draft.team_name || '');
      draft.coach_name = String(formData.get('coachName') || formData.get('coach_name') || draft.coach_name || '');
      draft.age_division = String(formData.get('ageDivision') || formData.get('age_division') || draft.age_division || '');

      // Include event selections + totals (already attached above)
      // `eventSelections` is a JSON string; keep it as-is for now.
      draft.event_selections_json = String(formData.get('eventSelections') || '[]');
      draft.event_subtotal = String(formData.get('eventSubtotal') || '0');
      draft.facility_fee = String(formData.get('facilityFee') || '0');
      draft.event_total = String(formData.get('eventTotal') || '0');

      // Store draft where payment.html can find it.
      localStorage.setItem('registrationDraft', JSON.stringify(draft));

      setSubmitting(false);
      window.location.href = "./payment.html";
    } catch (err) {
      console.error(err);
      setSubmitting(false);
      showError("Unable to start payment. Please try again.");
    }
  });
}

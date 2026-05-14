/**
 * Registration Page Controller - Multi-Step Wizard
 *
 * Uses WizardController for step management and FormBuilder for dynamic fields.
 * 5-step flow: Participant → Coach → Events → Extras → Review
 */

(function () {
  'use strict';

  // ============================================
  // DOM Elements
  // ============================================
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const errorMessage = document.getElementById('errorMessage');
  const wizardContainer = document.getElementById('wizardContainer');

  // Step containers
  const participantFields = document.getElementById('participantFields');
  const coachFields = document.getElementById('coachFields');
  const eventOptionsList = document.getElementById('eventOptionsList');

  // Stepper
  const wizardStepper = document.getElementById('wizardStepper');

  // Navigation buttons
  const step1Next = document.getElementById('step1Next');
  const step2Back = document.getElementById('step2Back');
  const step2Next = document.getElementById('step2Next');
  const step3Back = document.getElementById('step3Back');
  const step3Next = document.getElementById('step3Next');
  const step4Back = document.getElementById('step4Back');
  const step4Next = document.getElementById('step4Next');
  const step5Back = document.getElementById('step5Back');
  const submitBtn = document.getElementById('submitBtn');
  const mobileNextBtn = document.getElementById('mobileNextBtn');

  // Mobile footer
  const mobileFooter = document.getElementById('mobileFooter');

  // ============================================
  // State
  // ============================================
  let wizard = null;
  let formBuilder = null;
  let eventOptions = [];
  let eventCategories = [];
  let facilityFee = 0;
  let optionalProduct = null;
  let coaches = [];
  let fieldsConfig = null;

  // ============================================
  // Utility Functions
  // ============================================
  function formatMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '$0.00';
    return `$${num.toFixed(2)}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ============================================
  // UI State Functions
  // ============================================
  function showLoading() {
    loadingState?.classList.remove('hidden');
    wizardContainer?.classList.add('hidden');
    errorState?.classList.add('hidden');
  }

  function showError(message) {
    loadingState?.classList.add('hidden');
    wizardContainer?.classList.add('hidden');
    errorState?.classList.remove('hidden');
    if (errorMessage) errorMessage.textContent = message;
  }

  function showWizard() {
    loadingState?.classList.add('hidden');
    errorState?.classList.add('hidden');
    wizardContainer?.classList.remove('hidden');
    mobileFooter?.classList.remove('hidden');
  }

  // ============================================
  // Stepper UI
  // ============================================
  function updateStepperUI(currentStep) {
    if (!wizardStepper) return;

    const stepEls = wizardStepper.querySelectorAll('.wizard-step');
    const connectorEls = wizardStepper.querySelectorAll('.wizard-connector');
    const steps = ['participant', 'coach', 'events', 'extras', 'review'];
    const currentIndex = steps.indexOf(currentStep);

    stepEls.forEach((el, idx) => {
      const stepId = el.dataset.step;
      const stepIdx = steps.indexOf(stepId);

      // Update classes
      el.classList.remove('active', 'completed', 'inactive');

      if (stepIdx < currentIndex) {
        el.classList.add('completed');
        // Replace number with checkmark
        const numEl = el.querySelector('.wizard-step-number');
        if (numEl) {
          numEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        }
      } else if (stepIdx === currentIndex) {
        el.classList.add('active');
        const numEl = el.querySelector('.wizard-step-number');
        if (numEl) numEl.textContent = String(stepIdx + 1);
      } else {
        el.classList.add('inactive');
        const numEl = el.querySelector('.wizard-step-number');
        if (numEl) numEl.textContent = String(stepIdx + 1);
      }
    });

    // Update connectors
    connectorEls.forEach((el, idx) => {
      el.classList.remove('completed', 'active');
      if (idx < currentIndex) {
        el.classList.add('completed');
      }
    });
  }

  // ============================================
  // Step Views
  // ============================================
  function showStepView(stepId) {
    const views = document.querySelectorAll('.wizard-step-view');
    views.forEach(view => {
      view.classList.remove('active');
    });

    const currentView = document.getElementById(`step-${stepId}`);
    if (currentView) {
      currentView.classList.add('active');
    }

    // Update mobile next button text
    if (mobileNextBtn) {
      const btnText = mobileNextBtn.querySelector('span');
      if (stepId === 'review') {
        if (btnText) btnText.textContent = 'Submit';
      } else if (stepId === 'extras') {
        if (btnText) btnText.textContent = 'Review';
      } else {
        if (btnText) btnText.textContent = 'Continue';
      }
    }

    // Scroll to top of wizard
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ============================================
  // Participant Fields (Step 1)
  // ============================================
  function renderParticipantFields() {
    if (!participantFields) return;

    // Define participant fields
    const fields = [
      { id: 'first_name', label: 'First Name', type: 'text', width: 'half', required: true },
      { id: 'last_name', label: 'Last Name', type: 'text', width: 'half', required: true },
      { id: 'date_of_birth', label: 'Date of Birth', type: 'date', width: 'third', required: true },
      { id: 'gender', label: 'Gender', type: 'select', width: 'third', required: true, options: [
        { value: '', label: 'Select…', disabled: true },
        { value: 'Female', label: 'Female' },
        { value: 'Male', label: 'Male' },
        { value: 'Non-binary', label: 'Non-binary' },
        { value: 'Prefer not to say', label: 'Prefer not to say' },
        { value: 'Other', label: 'Other' }
      ]},
      { id: 'age_division', label: 'Age Division', type: 'select', width: 'third', options: [
        { value: '', label: 'Auto-calculated', disabled: true },
        { value: '0-6', label: '0–6' },
        { value: '7-9', label: '7–9' },
        { value: '10-12', label: '10–12' },
        { value: '13-15', label: '13–15' },
        { value: '16+', label: '16+' }
      ]},
      { id: 'home_phone', label: 'Phone Number', type: 'tel', width: 'half' },
      { id: 'email', label: 'Email Address', type: 'email', width: 'half', required: true }
    ];

    // Override with config fields if available
    let fieldsToRender = fields;
    if (fieldsConfig?.fields) {
      const participantFieldIds = ['first_name', 'last_name', 'date_of_birth', 'gender', 'age_division', 'home_phone', 'email'];
      const configFields = fieldsConfig.fields.filter(f =>
        participantFieldIds.includes(f.id) && f.enabled !== false
      );
      if (configFields.length > 0) {
        fieldsToRender = configFields;
      }
    }

    const html = `
      <div style="display:grid; gap:1rem; grid-template-columns: repeat(12, 1fr);">
        ${fieldsToRender.map(f => renderFieldHtml(f)).join('')}
      </div>
    `;
    participantFields.innerHTML = html;

    // Wire up DOB -> age division auto-calculation
    wireAgeDivisionCalc();
  }

  function renderFieldHtml(field) {
    const id = field.id;
    const type = field.type || 'text';
    const label = field.label || '';
    const placeholder = field.placeholder || '';
    const required = field.required === true;
    const requiredMark = required ? '<span style="color: var(--color-error);">*</span>' : '';

    const widthStyle = {
      full: 'grid-column: span 12;',
      half: 'grid-column: span 6;',
      third: 'grid-column: span 4;',
      quarter: 'grid-column: span 3;'
    }[field.width] || 'grid-column: span 12;';

    let inputHtml = '';

    switch (type) {
      case 'select':
        const optionsHtml = (field.options || []).map(opt => {
          const disabled = opt.disabled ? 'disabled' : '';
          const selected = opt.value === '' ? 'selected' : '';
          return `<option value="${escapeHtml(opt.value)}" ${disabled} ${selected}>${escapeHtml(opt.label)}</option>`;
        }).join('');
        inputHtml = `<select id="${id}" name="${id}" class="form-control" ${required ? 'required' : ''}>${optionsHtml}</select>`;
        break;
      case 'textarea':
        inputHtml = `<textarea id="${id}" name="${id}" class="form-control" placeholder="${escapeHtml(placeholder)}" ${required ? 'required' : ''}></textarea>`;
        break;
      default:
        inputHtml = `<input type="${type}" id="${id}" name="${id}" class="form-control" placeholder="${escapeHtml(placeholder)}" ${required ? 'required' : ''} />`;
    }

    return `
      <div style="${widthStyle}">
        <label class="block font-medium text-gray-800" for="${id}">${escapeHtml(label)} ${requiredMark}</label>
        ${inputHtml}
        <div class="wizard-field-error" id="${id}_error"></div>
      </div>
    `;
  }

  function wireAgeDivisionCalc() {
    const dobInput = document.getElementById('date_of_birth');
    const divisionSelect = document.getElementById('age_division');
    const resultEl = document.getElementById('ageDivisionResult');
    const valueEl = document.getElementById('ageDivisionValue');

    if (!dobInput || !divisionSelect) return;

    const calculateDivision = () => {
      const dob = dobInput.value;
      if (!dob) {
        if (resultEl) resultEl.classList.add('hidden');
        return;
      }

      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      let division = '';
      if (age >= 0 && age <= 6) division = '0-6';
      else if (age >= 7 && age <= 9) division = '7-9';
      else if (age >= 10 && age <= 12) division = '10-12';
      else if (age >= 13 && age <= 15) division = '13-15';
      else if (age >= 16) division = '16+';

      if (division) {
        divisionSelect.value = division;
        if (valueEl) valueEl.textContent = division;
        if (resultEl) resultEl.classList.remove('hidden');
      }
    };

    dobInput.addEventListener('change', calculateDivision);
    calculateDivision(); // Initial check
  }

  // ============================================
  // Coach & Team Fields (Step 2)
  // ============================================
  function renderCoachFields() {
    if (!coachFields) return;

    let html = `<div style="display:grid; gap:1.5rem;">`;

    // Coach selection
    if (coaches.length > 0) {
      html += `
        <div>
          <label class="block font-medium text-gray-800 mb-2">Select Coach(es)</label>
          <div id="coachOptionsList" style="display:grid; gap:0.5rem 1.25rem; grid-template-columns: 1fr;">
            ${coaches.map(c => `
              <label class="flex items-center gap-2" style="min-width:0;">
                <input type="checkbox" data-coach-opt="1" value="${c.id}" data-name="${escapeHtml(c.name || '')}" data-code="${escapeHtml(c.internal_code || '')}" />
                <span class="text-sm text-gray-900">${escapeHtml(c.name)}</span>
              </label>
            `).join('')}
          </div>
          <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--neutral-200);">
            <label class="flex items-center gap-2">
              <input type="checkbox" id="coach_other_enabled" />
              <span class="text-sm text-gray-900">Other coach not listed</span>
            </label>
            <input type="text" id="coach_other_name" class="form-control mt-2" placeholder="Enter coach name" style="display: none;" />
          </div>
        </div>
      `;
    } else {
      html += `
        <div>
          <label class="block font-medium text-gray-800 mb-2">Coach Name</label>
          <input type="text" id="coach_name_manual" name="coach_name_manual" class="form-control" placeholder="Enter coach name" />
        </div>
      `;
    }

    // Team name
    html += `
      <div>
        <label class="block font-medium text-gray-800" for="team_name">Team / Studio / School</label>
        <input type="text" id="team_name" name="team_name" class="form-control" placeholder="Enter team name" />
        <div class="wizard-field-error" id="team_name_error"></div>
      </div>
    `;

    html += `</div>`;
    coachFields.innerHTML = html;

    // Wire up "Other" coach toggle
    const otherEnabled = document.getElementById('coach_other_enabled');
    const otherName = document.getElementById('coach_other_name');
    if (otherEnabled && otherName) {
      otherEnabled.addEventListener('change', () => {
        otherName.style.display = otherEnabled.checked ? '' : 'none';
        if (!otherEnabled.checked) otherName.value = '';
      });
    }

    // Responsive grid for coach list
    const mq = window.matchMedia('(min-width: 640px)');
    const applyCoachCols = () => {
      const list = document.getElementById('coachOptionsList');
      if (list) {
        list.style.gridTemplateColumns = mq.matches ? '1fr 1fr' : '1fr';
      }
    };
    applyCoachCols();
    mq.addEventListener?.('change', applyCoachCols);
  }

  // ============================================
  // Event Options (Step 3)
  // ============================================
  function renderEventOptions() {
    if (!eventOptionsList) return;

    if (!Array.isArray(eventOptions) || eventOptions.length === 0) {
      eventOptionsList.innerHTML = `<p class="text-sm text-gray-600">No event options available for this competition yet.</p>`;
      return;
    }

    const hasCategories = eventOptions.some(opt => opt.category);

    if (hasCategories && eventCategories.length > 0) {
      renderGroupedEvents();
    } else {
      renderFlatEvents();
    }

    // Wire up event checkboxes for totals
    eventOptionsList.addEventListener('change', (e) => {
      if (e.target?.matches?.('input[type="checkbox"]')) {
        updateTotals();
      }
    });
  }

  function renderGroupedEvents() {
    const grouped = new Map();
    const uncategorized = [];

    eventCategories.forEach(cat => {
      grouped.set(cat.slug, { name: cat.name, events: [], subGroups: new Map() });
    });

    eventOptions.forEach(opt => {
      if (opt.category && grouped.has(opt.category)) {
        const catGroup = grouped.get(opt.category);
        if (opt.eventGroup) {
          if (!catGroup.subGroups.has(opt.eventGroup)) {
            catGroup.subGroups.set(opt.eventGroup, []);
          }
          catGroup.subGroups.get(opt.eventGroup).push(opt);
        } else {
          catGroup.events.push(opt);
        }
      } else {
        uncategorized.push(opt);
      }
    });

    let html = '';
    grouped.forEach((group, slug) => {
      const hasEvents = group.events.length > 0 || group.subGroups.size > 0;
      if (!hasEvents) return;

      html += `
        <div class="event-category" style="margin-bottom:1.5rem;">
          <h4 style="font-weight:600;color:var(--neutral-700);margin-bottom:0.5rem;font-size:0.95rem;">${escapeHtml(group.name)}</h4>
          <div class="event-category-content">
      `;

      if (group.events.length > 0) {
        html += `
          <div class="event-category-list" style="display:grid;gap:0.5rem 1.25rem;">
            ${group.events.map(opt => renderEventOptionHtml(opt)).join('')}
          </div>
        `;
      }

      group.subGroups.forEach((events, subGroupName) => {
        html += `
          <div class="event-subgroup" style="margin-top:0.75rem;margin-bottom:0.75rem;padding-left:0.5rem;border-left:3px solid var(--neutral-200);">
            <h5 style="font-weight:600;color:var(--neutral-500);margin-bottom:0.4rem;font-size:0.85rem;">${escapeHtml(subGroupName)}</h5>
            <div class="event-subgroup-list" style="display:grid;gap:0.4rem 1.25rem;">
              ${events.map(opt => renderEventOptionHtml(opt)).join('')}
            </div>
          </div>
        `;
      });

      html += `</div></div>`;
    });

    if (uncategorized.length > 0) {
      html += `
        <div class="event-category" style="margin-bottom:1.5rem;">
          <h4 style="font-weight:600;color:var(--neutral-700);margin-bottom:0.5rem;font-size:0.95rem;">Other Events</h4>
          <div class="event-category-list" style="display:grid;gap:0.5rem 1.25rem;">
            ${uncategorized.map(opt => renderEventOptionHtml(opt)).join('')}
          </div>
        </div>
      `;
    }

    eventOptionsList.innerHTML = html;
    applyEventGridColumns();
  }

  function renderFlatEvents() {
    eventOptionsList.innerHTML = eventOptions.map(opt => renderEventOptionHtml(opt)).join('');
    eventOptionsList.style.display = 'grid';
    eventOptionsList.style.gap = '0.5rem 1.25rem';
    applyEventGridColumns();
  }

  function renderEventOptionHtml(opt) {
    const price = Number(opt.price || 0);
    const name = String(opt.name || '');
    return `
      <label class="flex items-center justify-between gap-3" style="min-width:0;">
        <span class="flex items-center gap-2">
          <input type="checkbox" data-event-opt="1" value="${opt.id}" data-price="${price}" data-name="${escapeHtml(name)}" />
          <span class="text-sm text-gray-900">${escapeHtml(name)}</span>
        </span>
        <span class="text-sm text-gray-700">${formatMoney(price)}</span>
      </label>
    `;
  }

  function applyEventGridColumns() {
    const mq = window.matchMedia('(min-width: 900px)');
    const applyCols = () => {
      eventOptionsList.querySelectorAll('.event-category-list, .event-subgroup-list').forEach(list => {
        list.style.gridTemplateColumns = mq.matches ? '1fr 1fr' : '1fr';
      });
      if (!eventOptionsList.querySelector('.event-category')) {
        eventOptionsList.style.gridTemplateColumns = mq.matches ? '1fr 1fr' : '1fr';
      }
    };
    applyCols();
    mq.addEventListener?.('change', applyCols);
  }

  // ============================================
  // Extras (Step 4)
  // ============================================
  function setupExtrasSection() {
    const productCard = document.getElementById('optionalProductCard');
    const productName = document.getElementById('optionalProductName');
    const productPrice = document.getElementById('optionalProductPrice');
    const productCheckbox = document.getElementById('optionalProductSelected');

    const facilityFeeInfo = document.getElementById('facilityFeeInfo');
    const facilityFeeAmount = document.getElementById('facilityFeeAmount');
    const noExtrasMessage = document.getElementById('noExtrasMessage');

    let hasExtras = false;

    // Optional product
    if (optionalProduct?.enabled && optionalProduct.name && optionalProduct.price > 0) {
      if (productName) productName.textContent = optionalProduct.name;
      if (productPrice) productPrice.textContent = formatMoney(optionalProduct.price);
      productCard?.classList.remove('hidden');
      hasExtras = true;

      // Wire up checkbox for totals
      productCheckbox?.addEventListener('change', updateTotals);
    }

    // Facility fee
    if (facilityFee > 0) {
      if (facilityFeeAmount) facilityFeeAmount.textContent = formatMoney(facilityFee);
      facilityFeeInfo?.classList.remove('hidden');
      hasExtras = true;
    }

    // No extras message
    if (!hasExtras && noExtrasMessage) {
      noExtrasMessage.classList.remove('hidden');
    }
  }

  // ============================================
  // Totals Calculation
  // ============================================
  function getSelectedEvents() {
    if (!eventOptionsList) return [];

    const checks = eventOptionsList.querySelectorAll('input[type="checkbox"][data-event-opt="1"]:checked');
    return Array.from(checks).map((c) => ({
      id: Number(c.value),
      name: c.dataset.name || '',
      price: Number(c.dataset.price || 0)
    }));
  }

  function updateTotals() {
    const selected = getSelectedEvents();
    const subtotal = selected.reduce((sum, e) => sum + e.price, 0);

    const productCheckbox = document.getElementById('optionalProductSelected');
    const productPrice = optionalProduct?.enabled && productCheckbox?.checked
      ? Number(optionalProduct.price) || 0
      : 0;

    const fee = Number(facilityFee) || 0;
    const total = subtotal + productPrice + fee;

    // Update events step display
    const selectedCount = document.getElementById('selectedEventsCount');
    const eventsSubtotal = document.getElementById('eventsSubtotal');
    if (selectedCount) selectedCount.textContent = String(selected.length);
    if (eventsSubtotal) eventsSubtotal.textContent = formatMoney(subtotal);

    // Update sidebar
    const sidebarEventsCount = document.getElementById('sidebarEventsCount');
    const sidebarEventsSubtotal = document.getElementById('sidebarEventsSubtotal');
    const sidebarAddonRow = document.getElementById('sidebarAddonRow');
    const sidebarAddonName = document.getElementById('sidebarAddonName');
    const sidebarAddonPrice = document.getElementById('sidebarAddonPrice');
    const sidebarFacilityRow = document.getElementById('sidebarFacilityRow');
    const sidebarFacilityFee = document.getElementById('sidebarFacilityFee');
    const sidebarTotal = document.getElementById('sidebarTotal');

    if (sidebarEventsCount) sidebarEventsCount.textContent = String(selected.length);
    if (sidebarEventsSubtotal) sidebarEventsSubtotal.textContent = formatMoney(subtotal);

    if (sidebarAddonRow) {
      if (productPrice > 0) {
        sidebarAddonRow.classList.remove('hidden');
        if (sidebarAddonName) sidebarAddonName.textContent = optionalProduct?.name || 'Add-on';
        if (sidebarAddonPrice) sidebarAddonPrice.textContent = formatMoney(productPrice);
      } else {
        sidebarAddonRow.classList.add('hidden');
      }
    }

    if (sidebarFacilityRow) {
      if (fee > 0) {
        sidebarFacilityRow.classList.remove('hidden');
        if (sidebarFacilityFee) sidebarFacilityFee.textContent = formatMoney(fee);
      } else {
        sidebarFacilityRow.classList.add('hidden');
      }
    }

    if (sidebarTotal) sidebarTotal.textContent = formatMoney(total);

    // Update mobile footer
    const mobileTotal = document.getElementById('mobileTotal');
    if (mobileTotal) mobileTotal.textContent = formatMoney(total);

    // Store totals in wizard data
    if (wizard) {
      wizard.setStepData('totals', {
        subtotal,
        productPrice,
        fee,
        total
      });
    }
  }

  // ============================================
  // Review Section (Step 5)
  // ============================================
  function populateReviewSection() {
    const data = wizard ? wizard.getAllData() : {};

    // Participant info
    const firstName = document.getElementById('first_name')?.value || '';
    const lastName = document.getElementById('last_name')?.value || '';
    const email = document.getElementById('email')?.value || '';
    const phone = document.getElementById('home_phone')?.value || '';
    const ageDivision = document.getElementById('age_division')?.value || '';

    document.getElementById('reviewName').textContent = `${firstName} ${lastName}`.trim() || '--';
    document.getElementById('reviewAgeDivision').textContent = ageDivision || '--';
    document.getElementById('reviewEmail').textContent = email || '--';
    document.getElementById('reviewPhone').textContent = phone || '--';

    // Update sidebar participant name
    const sidebarParticipantName = document.getElementById('sidebarParticipantName');
    if (sidebarParticipantName) {
      sidebarParticipantName.textContent = `${firstName} ${lastName}`.trim() || '--';
    }

    // Coach info
    const selectedCoaches = getSelectedCoaches();
    const teamName = document.getElementById('team_name')?.value || '';
    const coachNames = selectedCoaches.map(c => c.name).filter(Boolean).join(', ');

    document.getElementById('reviewCoach').textContent = coachNames || '--';
    document.getElementById('reviewTeam').textContent = teamName || '--';

    // Events list
    const selectedEvents = getSelectedEvents();
    const eventsList = document.getElementById('reviewEventsList');
    if (eventsList) {
      if (selectedEvents.length > 0) {
        eventsList.innerHTML = selectedEvents.map(e => `
          <li style="display: flex; justify-content: space-between; padding: var(--space-1) 0;">
            <span>${escapeHtml(e.name)}</span>
            <span>${formatMoney(e.price)}</span>
          </li>
        `).join('');
      } else {
        eventsList.innerHTML = '<li style="color: var(--neutral-500);">No events selected</li>';
      }
    }

    // Cost summary
    const subtotal = selectedEvents.reduce((sum, e) => sum + e.price, 0);
    const productCheckbox = document.getElementById('optionalProductSelected');
    const productPrice = optionalProduct?.enabled && productCheckbox?.checked
      ? Number(optionalProduct.price) || 0
      : 0;
    const fee = Number(facilityFee) || 0;
    const total = subtotal + productPrice + fee;

    document.getElementById('reviewSubtotal').textContent = formatMoney(subtotal);

    const reviewAddonRow = document.getElementById('reviewAddonRow');
    const reviewAddonName = document.getElementById('reviewAddonName');
    const reviewAddonPrice = document.getElementById('reviewAddonPrice');
    if (reviewAddonRow) {
      if (productPrice > 0) {
        reviewAddonRow.classList.remove('hidden');
        if (reviewAddonName) reviewAddonName.textContent = optionalProduct?.name || 'Add-on';
        if (reviewAddonPrice) reviewAddonPrice.textContent = formatMoney(productPrice);
      } else {
        reviewAddonRow.classList.add('hidden');
      }
    }

    const reviewFacilityRow = document.getElementById('reviewFacilityRow');
    const reviewFacilityFee = document.getElementById('reviewFacilityFee');
    if (reviewFacilityRow) {
      if (fee > 0) {
        reviewFacilityRow.classList.remove('hidden');
        if (reviewFacilityFee) reviewFacilityFee.textContent = formatMoney(fee);
      } else {
        reviewFacilityRow.classList.add('hidden');
      }
    }

    document.getElementById('reviewTotal').textContent = formatMoney(total);
  }

  function getSelectedCoaches() {
    const coachList = document.getElementById('coachOptionsList');
    if (!coachList) {
      // Manual entry mode
      const manualInput = document.getElementById('coach_name_manual');
      if (manualInput?.value?.trim()) {
        return [{ id: 0, name: manualInput.value.trim(), internal_code: '' }];
      }
      return [];
    }

    const checks = coachList.querySelectorAll('input[type="checkbox"]:checked');
    const selected = Array.from(checks).map(c => ({
      id: Number(c.value),
      name: c.dataset.name || '',
      internal_code: c.dataset.code || ''
    }));

    // Handle "Other" coach
    const otherEnabled = document.getElementById('coach_other_enabled');
    const otherName = document.getElementById('coach_other_name');
    if (otherEnabled?.checked && otherName?.value?.trim()) {
      selected.push({
        id: 0,
        name: otherName.value.trim(),
        internal_code: 'OTHER'
      });
    }

    return selected;
  }

  // ============================================
  // Validation
  // ============================================
  function validateStep(stepId) {
    clearErrors();

    switch (stepId) {
      case 'participant':
        return validateParticipantStep();
      case 'coach':
        return validateCoachStep();
      case 'events':
        return validateEventsStep();
      case 'extras':
        return { valid: true, errors: {} }; // No required fields
      case 'review':
        return { valid: true, errors: {} };
      default:
        return { valid: true, errors: {} };
    }
  }

  function validateParticipantStep() {
    const errors = {};
    const required = ['first_name', 'last_name', 'date_of_birth', 'gender', 'email'];

    required.forEach(id => {
      const el = document.getElementById(id);
      if (!el?.value?.trim()) {
        errors[id] = 'This field is required';
      }
    });

    // Email validation
    const emailEl = document.getElementById('email');
    if (emailEl?.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value)) {
      errors['email'] = 'Please enter a valid email address';
    }

    showErrors(errors);
    return { valid: Object.keys(errors).length === 0, errors };
  }

  function validateCoachStep() {
    // Coach selection is optional
    return { valid: true, errors: {} };
  }

  function validateEventsStep() {
    const errors = {};
    const selected = getSelectedEvents();

    // Optional: require at least one event
    // if (selected.length === 0) {
    //   errors['events'] = 'Please select at least one event';
    // }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  function clearErrors() {
    document.querySelectorAll('.wizard-field-error').forEach(el => {
      el.textContent = '';
      el.style.display = 'none';
    });
    document.querySelectorAll('.form-control').forEach(el => {
      el.classList.remove('error');
    });
  }

  function showErrors(errors) {
    Object.entries(errors).forEach(([id, message]) => {
      const errorEl = document.getElementById(`${id}_error`);
      const inputEl = document.getElementById(id);
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
      }
      if (inputEl) {
        inputEl.classList.add('error');
        // Focus first error
        if (Object.keys(errors)[0] === id) {
          inputEl.focus();
        }
      }
    });
  }

  // ============================================
  // Form Submission
  // ============================================
  async function handleSubmit() {
    // Clear previous draft
    localStorage.removeItem('registrationDraft');

    // Gather all form data
    const firstName = document.getElementById('first_name')?.value || '';
    const lastName = document.getElementById('last_name')?.value || '';
    const dob = document.getElementById('date_of_birth')?.value || '';
    const gender = document.getElementById('gender')?.value || '';
    const ageDivision = document.getElementById('age_division')?.value || '';
    const phone = document.getElementById('home_phone')?.value || '';
    const email = document.getElementById('email')?.value || '';
    const teamName = document.getElementById('team_name')?.value || '';

    const selectedCoaches = getSelectedCoaches();
    const selectedEvents = getSelectedEvents();

    const subtotal = selectedEvents.reduce((sum, e) => sum + e.price, 0);
    const productCheckbox = document.getElementById('optionalProductSelected');
    const productPrice = optionalProduct?.enabled && productCheckbox?.checked
      ? Number(optionalProduct.price) || 0
      : 0;
    const fee = Number(facilityFee) || 0;
    const total = subtotal + productPrice + fee;

    // Build draft object
    const draft = {
      // Core fields
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dob,
      gender: gender,
      age_division: ageDivision,
      team_name: teamName,
      home_phone: phone,
      email: email,

      // Coach data
      coach_selections_json: JSON.stringify(selectedCoaches),
      coach_name: selectedCoaches.map(c => c.name).filter(Boolean).join(', '),
      coachSelections: JSON.stringify(selectedCoaches),
      coachNames: selectedCoaches.map(c => c.name).filter(Boolean).join(', '),

      // Event data
      eventSelections: JSON.stringify(selectedEvents),
      event_selections_json: JSON.stringify(selectedEvents),
      eventSubtotal: subtotal.toFixed(2),
      event_subtotal: subtotal.toFixed(2),

      // Fees
      facilityFee: fee.toFixed(2),
      facility_fee: fee.toFixed(2),
      eventTotal: total.toFixed(2),
      event_total: total.toFixed(2),

      // Optional product
      optionalProductSelected: productCheckbox?.checked ? 'true' : 'false',
      optional_product_selected: productCheckbox?.checked ? '1' : '0',
      optionalProductName: optionalProduct?.name || '',
      optional_product_name: optionalProduct?.name || '',
      optionalProductPrice: (productPrice || 0).toFixed(2),
      optional_product_price: (productPrice || 0).toFixed(2)
    };

    // Store draft for payment page
    localStorage.setItem('registrationDraft', JSON.stringify(draft));

    // Clear wizard draft
    wizard?.clearDraft();

    // Navigate to payment page
    window.location.href = './payment.html';
  }

  // ============================================
  // Edit Buttons (Review Step)
  // ============================================
  function wireEditButtons() {
    document.querySelectorAll('.review-section-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetStep = btn.dataset.goto;
        if (targetStep && wizard) {
          wizard.goToStep(targetStep);
        }
      });
    });
  }

  // ============================================
  // Navigation Buttons
  // ============================================
  function wireNavigationButtons() {
    // Step 1 → Step 2
    step1Next?.addEventListener('click', () => wizard?.next());

    // Step 2 ← → Step 1/3
    step2Back?.addEventListener('click', () => wizard?.back());
    step2Next?.addEventListener('click', () => wizard?.next());

    // Step 3 ← → Step 2/4
    step3Back?.addEventListener('click', () => wizard?.back());
    step3Next?.addEventListener('click', () => wizard?.next());

    // Step 4 ← → Step 3/5
    step4Back?.addEventListener('click', () => wizard?.back());
    step4Next?.addEventListener('click', () => wizard?.next());

    // Step 5 ← → Step 4/Submit
    step5Back?.addEventListener('click', () => wizard?.back());
    submitBtn?.addEventListener('click', () => wizard?.next());

    // Mobile footer next button
    mobileNextBtn?.addEventListener('click', () => {
      if (wizard?.isLastStep()) {
        wizard?.next();
      } else {
        wizard?.next();
      }
    });
  }

  // ============================================
  // Load Config
  // ============================================
  async function loadConfig() {
    // Use central API client if available, fallback to direct fetch
    if (window.api && window.api.registrations) {
      return window.api.registrations.getConfig();
    }

    // Fallback for when API client isn't loaded
    const res = await fetch('/api/register.php', { method: 'GET' });
    if (!res.ok) throw new Error(`Failed to load config (${res.status})`);

    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed to load configuration');

    return data;
  }

  // ============================================
  // Initialize
  // ============================================
  async function init() {
    showLoading();

    try {
      const config = await loadConfig();

      // Store configuration
      eventOptions = config.eventOptions || [];
      eventCategories = config.eventCategories || [];
      facilityFee = Number(config.competition?.facilityFee || 0);
      coaches = config.coaches || [];
      fieldsConfig = config.fieldsConfig || null;

      const comp = config.competition || {};
      optionalProduct = {
        enabled: Boolean(comp.productEnabled),
        name: comp.productName || '',
        price: Number(comp.productPrice || 0)
      };

      // Initialize wizard controller
      wizard = new WizardController({
        steps: ['participant', 'coach', 'events', 'extras', 'review'],
        storageKey: 'registrationWizardDraft',
        onStepChange: (currentStep, previousStep, direction) => {
          updateStepperUI(currentStep);
          showStepView(currentStep);

          // Populate review on entering review step
          if (currentStep === 'review') {
            populateReviewSection();
          }

          // Re-initialize Lucide icons for new step
          if (typeof lucide !== 'undefined') {
            lucide.createIcons();
          }
        },
        onValidate: (stepId, stepData) => {
          return validateStep(stepId);
        },
        onComplete: (allData) => {
          handleSubmit();
        }
      });

      // Render all step content
      renderParticipantFields();
      renderCoachFields();
      renderEventOptions();
      setupExtrasSection();

      // Wire up navigation
      wireNavigationButtons();
      wireEditButtons();

      // Initial UI state
      updateStepperUI(wizard.getCurrentStep());
      showStepView(wizard.getCurrentStep());
      updateTotals();

      // Show wizard
      showWizard();

      // Re-initialize Lucide icons
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }

    } catch (err) {
      console.error('Init error:', err);
      showError(err.message || 'Unable to load registration form.');
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

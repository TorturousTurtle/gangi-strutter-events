// web/assets/js/admin/tabs/dataTable.js
// Data table module for sorting, filtering, bulk selection, and pagination

export function initDataTable({
    els,
    escapeHtml,
    showToast,
    formatPaymentStatusBadge,
    onPageChange = null, // Callback for server-side pagination
}) {
    // State
    let allRegistrations = [];
    let filteredRegistrations = [];
    let selectedIds = new Set();
    let sortConfig = { field: 'date', direction: 'desc' };

    // Pagination state
    let pagination = {
        total: 0,
        page: 1,
        perPage: 50,
        totalPages: 0,
        hasMore: false,
        isServerSide: false, // True when using server-side pagination
    };

    // URL param keys
    const URL_PARAMS = {
        search: 'q',
        payment: 'payment',
        ageDiv: 'ageDiv',
        sortField: 'sort',
        sortDir: 'dir',
        page: 'page',
        perPage: 'perPage',
    };

    /**
     * Read filter/sort state from URL query params
     */
    function readStateFromUrl() {
        const params = new URLSearchParams(window.location.search);

        return {
            search: params.get(URL_PARAMS.search) || '',
            payment: params.get(URL_PARAMS.payment) || '',
            ageDiv: params.get(URL_PARAMS.ageDiv) || '',
            sortField: params.get(URL_PARAMS.sortField) || 'date',
            sortDir: params.get(URL_PARAMS.sortDir) || 'desc',
            page: parseInt(params.get(URL_PARAMS.page) || '1', 10),
            perPage: parseInt(params.get(URL_PARAMS.perPage) || '50', 10),
        };
    }

    /**
     * Update URL with current filter/sort state (without page reload)
     */
    function updateUrl() {
        const params = new URLSearchParams(window.location.search);

        // Get current values
        const search = tableEls.searchInput?.value || '';
        const payment = tableEls.paymentFilter?.value || '';
        const ageDiv = tableEls.ageDivFilter?.value || '';

        // Update or remove params based on values
        if (search) params.set(URL_PARAMS.search, search);
        else params.delete(URL_PARAMS.search);

        if (payment) params.set(URL_PARAMS.payment, payment);
        else params.delete(URL_PARAMS.payment);

        if (ageDiv) params.set(URL_PARAMS.ageDiv, ageDiv);
        else params.delete(URL_PARAMS.ageDiv);

        // Sort - only include if not default
        if (sortConfig.field !== 'date') params.set(URL_PARAMS.sortField, sortConfig.field);
        else params.delete(URL_PARAMS.sortField);

        if (sortConfig.direction !== 'desc') params.set(URL_PARAMS.sortDir, sortConfig.direction);
        else params.delete(URL_PARAMS.sortDir);

        // Pagination - only include if not default
        if (pagination.page !== 1) params.set(URL_PARAMS.page, pagination.page);
        else params.delete(URL_PARAMS.page);

        if (pagination.perPage !== 50) params.set(URL_PARAMS.perPage, pagination.perPage);
        else params.delete(URL_PARAMS.perPage);

        // Update URL without reload
        const newUrl = params.toString()
            ? `${window.location.pathname}?${params.toString()}`
            : window.location.pathname;

        window.history.replaceState({}, '', newUrl);
    }

    /**
     * Apply URL state to form controls and sort config
     */
    function applyUrlState() {
        const state = readStateFromUrl();

        // Apply to form controls
        if (tableEls.searchInput) tableEls.searchInput.value = state.search;
        if (tableEls.paymentFilter) tableEls.paymentFilter.value = state.payment;
        if (tableEls.ageDivFilter) tableEls.ageDivFilter.value = state.ageDiv;

        // Apply sort config
        const validSortFields = ['name', 'ageDivision', 'events', 'amount', 'payment', 'date'];
        if (validSortFields.includes(state.sortField)) {
            sortConfig.field = state.sortField;
        }
        if (state.sortDir === 'asc' || state.sortDir === 'desc') {
            sortConfig.direction = state.sortDir;
        }

        // Apply pagination
        if (state.page >= 1) pagination.page = state.page;
        if ([25, 50, 100].includes(state.perPage)) pagination.perPage = state.perPage;

        // Apply to per-page selector if it exists
        if (tableEls.perPageSelect) {
            tableEls.perPageSelect.value = pagination.perPage;
        }
    }

    // DOM references
    const tableEls = {
        tbody: els.tbody,
        searchInput: document.getElementById('registrantsSearch'),
        paymentFilter: document.getElementById('registrantsPaymentFilter'),
        ageDivFilter: document.getElementById('registrantsAgeDivFilter'),
        resultsCount: document.getElementById('tableResultsCount'),
        selectAllCheckbox: document.getElementById('selectAllRegistrants'),
        bulkActionsBar: document.getElementById('bulkActionsBar'),
        selectedCount: document.getElementById('selectedCount'),
        bulkExportBtn: document.getElementById('bulkExportBtn'),
        bulkDeselectBtn: document.getElementById('bulkDeselectBtn'),
        noResults: document.getElementById('tableNoResults'),
        clearFiltersBtn: document.getElementById('clearFiltersBtn'),
        table: document.getElementById('registrantsTable'),
        // Pagination elements
        paginationContainer: document.getElementById('tablePagination'),
        perPageSelect: document.getElementById('perPageSelect'),
    };

    /**
     * Extract sortable value from registration based on field
     */
    function getSortValue(reg, field) {
        switch (field) {
            case 'name':
                return `${reg.firstName || ''} ${reg.lastName || ''}`.toLowerCase();
            case 'ageDivision':
                return (reg.ageDivision || '').toLowerCase();
            case 'events':
                const selections = Array.isArray(reg.eventSelections) ? reg.eventSelections :
                    Array.isArray(reg.event_selections) ? reg.event_selections : [];
                return selections.length;
            case 'amount':
                return Number(reg.eventTotal ?? reg.event_total ?? 0);
            case 'payment':
                return (reg.paymentStatus ?? reg.payment_status ?? 'pending').toLowerCase();
            case 'date':
                const dateStr = reg.createdAt || reg.created_at || '1970-01-01';
                return new Date(String(dateStr).replace(' ', 'T')).getTime();
            default:
                return '';
        }
    }

    /**
     * Sort registrations based on current config
     */
    function sortRegistrations(regs) {
        const { field, direction } = sortConfig;
        const multiplier = direction === 'asc' ? 1 : -1;

        return [...regs].sort((a, b) => {
            const aVal = getSortValue(a, field);
            const bVal = getSortValue(b, field);

            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return (aVal - bVal) * multiplier;
            }

            return String(aVal).localeCompare(String(bVal)) * multiplier;
        });
    }

    /**
     * Filter registrations based on search and filter values
     */
    function filterRegistrations(regs) {
        const searchTerm = (tableEls.searchInput?.value || '').toLowerCase().trim();
        const paymentFilter = tableEls.paymentFilter?.value || '';
        const ageDivFilter = tableEls.ageDivFilter?.value || '';

        return regs.filter(reg => {
            // Search filter (name, email, team)
            if (searchTerm) {
                const name = `${reg.firstName || ''} ${reg.lastName || ''}`.toLowerCase();
                const email = (reg.email || '').toLowerCase();
                const team = (reg.teamName || reg.team_name || '').toLowerCase();
                const coach = (reg.coachName || '').toLowerCase();

                const matchesSearch = name.includes(searchTerm) ||
                    email.includes(searchTerm) ||
                    team.includes(searchTerm) ||
                    coach.includes(searchTerm);

                if (!matchesSearch) return false;
            }

            // Payment status filter
            if (paymentFilter) {
                const status = (reg.paymentStatus ?? reg.payment_status ?? 'pending').toLowerCase();
                if (status !== paymentFilter) return false;
            }

            // Age division filter
            if (ageDivFilter) {
                const division = (reg.ageDivision || '').toLowerCase();
                if (division !== ageDivFilter.toLowerCase()) return false;
            }

            return true;
        });
    }

    /**
     * Populate age division filter options from registrations
     */
    function populateAgeDivisionFilter(regs) {
        if (!tableEls.ageDivFilter) return;

        const divisions = new Set();
        regs.forEach(reg => {
            const division = reg.ageDivision || '';
            if (division) divisions.add(division);
        });

        // Keep first option (All Age Divisions)
        const firstOption = tableEls.ageDivFilter.querySelector('option');
        tableEls.ageDivFilter.innerHTML = '';
        if (firstOption) tableEls.ageDivFilter.appendChild(firstOption);

        // Add division options sorted alphabetically
        [...divisions].sort().forEach(division => {
            const option = document.createElement('option');
            option.value = division;
            option.textContent = division;
            tableEls.ageDivFilter.appendChild(option);
        });
    }

    /**
     * Update the results count display
     */
    function updateResultsCount() {
        if (!tableEls.resultsCount) return;

        if (pagination.isServerSide) {
            // Server-side pagination - show page info
            const start = (pagination.page - 1) * pagination.perPage + 1;
            const end = Math.min(pagination.page * pagination.perPage, pagination.total);
            if (pagination.total === 0) {
                tableEls.resultsCount.textContent = '0 registrations';
            } else {
                tableEls.resultsCount.textContent = `${start}-${end} of ${pagination.total}`;
            }
        } else {
            // Client-side filtering
            const total = allRegistrations.length;
            const filtered = filteredRegistrations.length;

            if (filtered === total) {
                tableEls.resultsCount.textContent = `${total} registrations`;
            } else {
                tableEls.resultsCount.textContent = `${filtered} of ${total}`;
            }
        }
    }

    /**
     * Render pagination controls
     */
    function renderPagination() {
        if (!tableEls.paginationContainer) return;

        // Hide pagination if not using server-side or only one page
        if (!pagination.isServerSide || pagination.totalPages <= 1) {
            tableEls.paginationContainer.classList.add('hidden');
            return;
        }

        tableEls.paginationContainer.classList.remove('hidden');

        const { page, totalPages } = pagination;

        // Generate page numbers to show (current +/- 2)
        const pageNumbers = [];
        const start = Math.max(1, page - 2);
        const end = Math.min(totalPages, page + 2);

        if (start > 1) {
            pageNumbers.push(1);
            if (start > 2) pageNumbers.push('...');
        }

        for (let i = start; i <= end; i++) {
            pageNumbers.push(i);
        }

        if (end < totalPages) {
            if (end < totalPages - 1) pageNumbers.push('...');
            pageNumbers.push(totalPages);
        }

        tableEls.paginationContainer.innerHTML = `
            <div class="pagination-controls">
                <button type="button" class="pagination-btn pagination-prev" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">
                    <i data-lucide="chevron-left"></i>
                    <span class="sr-only">Previous</span>
                </button>
                <div class="pagination-pages">
                    ${pageNumbers.map(p => {
                        if (p === '...') {
                            return '<span class="pagination-ellipsis">...</span>';
                        }
                        return `<button type="button" class="pagination-page ${p === page ? 'is-active' : ''}" data-page="${p}">${p}</button>`;
                    }).join('')}
                </div>
                <button type="button" class="pagination-btn pagination-next" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">
                    <i data-lucide="chevron-right"></i>
                    <span class="sr-only">Next</span>
                </button>
                <div class="pagination-per-page">
                    <label for="perPageSelect" class="sr-only">Per page</label>
                    <select id="perPageSelect" class="pagination-select">
                        <option value="25" ${pagination.perPage === 25 ? 'selected' : ''}>25</option>
                        <option value="50" ${pagination.perPage === 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${pagination.perPage === 100 ? 'selected' : ''}>100</option>
                    </select>
                    <span class="pagination-label">per page</span>
                </div>
            </div>
        `;

        // Update reference to new select
        tableEls.perPageSelect = tableEls.paginationContainer.querySelector('#perPageSelect');

        // Rebind events
        bindPaginationEvents();

        // Re-initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Bind pagination event listeners
     */
    function bindPaginationEvents() {
        if (!tableEls.paginationContainer) return;

        // Page button clicks
        tableEls.paginationContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-page]');
            if (!btn || btn.disabled) return;

            const newPage = parseInt(btn.dataset.page, 10);
            if (newPage === pagination.page) return;

            goToPage(newPage);
        });

        // Per-page select change
        tableEls.perPageSelect?.addEventListener('change', (e) => {
            const newPerPage = parseInt(e.target.value, 10);
            if (newPerPage === pagination.perPage) return;

            pagination.perPage = newPerPage;
            pagination.page = 1; // Reset to first page
            updateUrl();

            if (onPageChange) {
                onPageChange(pagination.page, pagination.perPage);
            }
        });
    }

    /**
     * Navigate to a specific page
     */
    function goToPage(page) {
        if (page < 1 || page > pagination.totalPages) return;
        if (page === pagination.page) return;

        pagination.page = page;
        updateUrl();

        if (onPageChange) {
            onPageChange(pagination.page, pagination.perPage);
        }
    }

    /**
     * Update bulk actions bar visibility
     */
    function updateBulkActionsBar() {
        const count = selectedIds.size;

        if (tableEls.bulkActionsBar) {
            tableEls.bulkActionsBar.classList.toggle('visible', count > 0);
        }

        if (tableEls.selectedCount) {
            tableEls.selectedCount.textContent = count;
        }

        // Update select all checkbox state
        if (tableEls.selectAllCheckbox) {
            const visibleIds = filteredRegistrations.map(r => r.id);
            const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
            const someSelected = visibleIds.some(id => selectedIds.has(id));

            tableEls.selectAllCheckbox.checked = allSelected;
            tableEls.selectAllCheckbox.indeterminate = someSelected && !allSelected;
        }
    }

    /**
     * Show skeleton loading rows in the table
     */
    function showSkeletonRows(count = 5) {
        if (!tableEls.tbody) return;

        tableEls.tbody.innerHTML = '';
        tableEls.noResults?.classList.add('hidden');

        for (let i = 0; i < count; i++) {
            const tr = document.createElement('tr');
            tr.className = `skeleton-row ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`;
            tr.innerHTML = `
                <td class="table-checkbox-cell border-y border-gray-200">
                    <div class="skeleton skeleton-avatar" style="width:16px;height:16px;"></div>
                </td>
                <td class="px-4 py-3 border-y border-gray-200">
                    <div class="skeleton skeleton-text" style="width:${70 + Math.random() * 30}%;"></div>
                </td>
                <td class="px-4 py-3 border-y border-gray-200">
                    <div class="skeleton skeleton-text-sm" style="width:${50 + Math.random() * 30}%;"></div>
                </td>
                <td class="px-4 py-3 border-y border-gray-200">
                    <div class="skeleton skeleton-text" style="width:${60 + Math.random() * 40}%;"></div>
                </td>
                <td class="px-4 py-3 border-y border-gray-200">
                    <div class="skeleton skeleton-text-sm" style="width:50%;"></div>
                </td>
                <td class="px-4 py-3 border-y border-gray-200">
                    <div class="skeleton skeleton-badge"></div>
                </td>
                <td class="px-4 py-3 border-y border-gray-200">
                    <div class="skeleton skeleton-text-xs" style="width:70%;"></div>
                </td>
            `;
            tableEls.tbody.appendChild(tr);
        }
    }

    /**
     * Render table rows with current sorting and filtering
     */
    function renderTable() {
        if (!tableEls.tbody) return;

        // Apply filters and sorting
        filteredRegistrations = sortRegistrations(filterRegistrations(allRegistrations));

        tableEls.tbody.innerHTML = '';

        if (filteredRegistrations.length === 0 && allRegistrations.length > 0) {
            // Show no results message
            tableEls.noResults?.classList.remove('hidden');
            return;
        }

        tableEls.noResults?.classList.add('hidden');

        filteredRegistrations.forEach((r, i) => {
            const tr = document.createElement('tr');
            tr.className = i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
            tr.dataset.id = r.id;

            const created = r.createdAt
                ? new Date(String(r.createdAt).replace(' ', 'T')).toLocaleDateString()
                : '';

            const selections = Array.isArray(r.eventSelections) ? r.eventSelections :
                Array.isArray(r.event_selections) ? r.event_selections : [];

            const eventsText = selections
                .map(e => (e && e.name ? String(e.name) : ''))
                .filter(Boolean)
                .join(', ');

            const amountNum = Number(r.eventTotal ?? r.event_total ?? 0);
            const amountText = Number.isFinite(amountNum) ? `$${amountNum.toFixed(2)}` : '$0.00';

            const paymentStatus = r.paymentStatus ?? r.payment_status ?? 'pending';
            const paymentBadge = formatPaymentStatusBadge(paymentStatus);

            const isSelected = selectedIds.has(r.id);

            tr.innerHTML = `
                <td class="table-checkbox-cell border-y border-gray-200">
                    <input type="checkbox" class="table-checkbox row-checkbox" data-id="${r.id}" ${isSelected ? 'checked' : ''}>
                </td>
                <td class="px-4 py-2 font-medium text-gray-900 whitespace-nowrap border-y border-gray-200">
                    ${escapeHtml(`${r.firstName} ${r.lastName}`)}
                </td>
                <td class="px-4 py-2 text-gray-700 whitespace-nowrap border-y border-gray-200">
                    ${escapeHtml(r.ageDivision || '')}
                </td>
                <td class="px-4 py-2 text-gray-700 border-y border-gray-200">
                    ${escapeHtml(eventsText)}
                </td>
                <td class="px-4 py-2 text-gray-700 whitespace-nowrap border-y border-gray-200">
                    ${escapeHtml(amountText)}
                </td>
                <td class="px-4 py-2 whitespace-nowrap border-y border-gray-200">
                    ${paymentBadge}
                </td>
                <td class="px-4 py-2 text-sm text-gray-600 whitespace-nowrap border-y border-gray-200">
                    ${escapeHtml(created)}
                </td>
            `;

            tableEls.tbody.appendChild(tr);
        });

        updateResultsCount();
        updateBulkActionsBar();

        // Re-initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Update sort indicators in table headers
     */
    function updateSortIndicators() {
        if (!tableEls.table) return;

        const headers = tableEls.table.querySelectorAll('thead th[data-sort]');
        headers.forEach(th => {
            const field = th.dataset.sort;
            if (field === sortConfig.field) {
                th.dataset.sortDir = sortConfig.direction;
            } else {
                delete th.dataset.sortDir;
            }
        });
    }

    /**
     * Handle header click for sorting
     */
    function handleHeaderClick(e) {
        const th = e.target.closest('th[data-sort]');
        if (!th) return;

        const field = th.dataset.sort;

        if (sortConfig.field === field) {
            // Toggle direction
            sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // New field, default to ascending (except date which defaults to desc)
            sortConfig.field = field;
            sortConfig.direction = field === 'date' ? 'desc' : 'asc';
        }

        updateSortIndicators();
        updateUrl();
        renderTable();
    }

    /**
     * Handle row checkbox change
     */
    function handleRowCheckboxChange(e) {
        const checkbox = e.target;
        if (!checkbox.classList.contains('row-checkbox')) return;

        const id = Number(checkbox.dataset.id);

        if (checkbox.checked) {
            selectedIds.add(id);
        } else {
            selectedIds.delete(id);
        }

        updateBulkActionsBar();
    }

    /**
     * Handle select all checkbox
     */
    function handleSelectAll() {
        const isChecked = tableEls.selectAllCheckbox.checked;

        filteredRegistrations.forEach(reg => {
            if (isChecked) {
                selectedIds.add(reg.id);
            } else {
                selectedIds.delete(reg.id);
            }
        });

        renderTable();
    }

    /**
     * Clear all selections
     */
    function clearSelection() {
        selectedIds.clear();
        renderTable();
    }

    /**
     * Export selected registrations
     */
    function exportSelected() {
        const selected = allRegistrations.filter(r => selectedIds.has(r.id));

        if (selected.length === 0) {
            showToast('No registrations selected', 'warning');
            return;
        }

        // Create CSV content
        const headers = ['ID', 'First Name', 'Last Name', 'Email', 'Age Division', 'Team', 'Coach', 'Amount', 'Payment Status', 'Date'];
        const rows = selected.map(r => [
            r.id,
            r.firstName || '',
            r.lastName || '',
            r.email || '',
            r.ageDivision || '',
            r.teamName || r.team_name || '',
            r.coachName || '',
            Number(r.eventTotal ?? r.event_total ?? 0).toFixed(2),
            r.paymentStatus ?? r.payment_status ?? 'pending',
            r.createdAt || r.created_at || '',
        ]);

        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `registrations-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        showToast(`Exported ${selected.length} registration${selected.length !== 1 ? 's' : ''}`, 'success');
    }

    /**
     * Clear all filters
     */
    function clearFilters() {
        if (tableEls.searchInput) tableEls.searchInput.value = '';
        if (tableEls.paymentFilter) tableEls.paymentFilter.value = '';
        if (tableEls.ageDivFilter) tableEls.ageDivFilter.value = '';

        // Reset sort to default
        sortConfig.field = 'date';
        sortConfig.direction = 'desc';
        updateSortIndicators();

        updateUrl();
        renderTable();
    }

    /**
     * Set registrations data and re-render
     *
     * @param {Array} regs Registration data
     * @param {Object|null} paginationData Optional pagination metadata from server
     */
    function setRegistrations(regs, paginationData = null) {
        allRegistrations = Array.isArray(regs) ? regs : [];

        // Update pagination state if server-side pagination data provided
        if (paginationData && typeof paginationData === 'object') {
            pagination.isServerSide = true;
            pagination.total = paginationData.total ?? 0;
            pagination.page = paginationData.page ?? 1;
            pagination.perPage = paginationData.perPage ?? 50;
            pagination.totalPages = paginationData.totalPages ?? 0;
            pagination.hasMore = paginationData.hasMore ?? false;
        } else {
            pagination.isServerSide = false;
        }

        populateAgeDivisionFilter(allRegistrations);
        renderTable();
        renderPagination();
    }

    /**
     * Get current pagination state
     */
    function getPagination() {
        return { ...pagination };
    }

    /**
     * Set page and trigger reload
     */
    function setPage(page) {
        goToPage(page);
    }

    /**
     * Get filtered registrations
     */
    function getFilteredRegistrations() {
        return filteredRegistrations;
    }

    // Event listeners
    if (tableEls.table) {
        const thead = tableEls.table.querySelector('thead');
        thead?.addEventListener('click', handleHeaderClick);
    }

    tableEls.tbody?.addEventListener('change', handleRowCheckboxChange);
    tableEls.selectAllCheckbox?.addEventListener('change', handleSelectAll);
    tableEls.bulkDeselectBtn?.addEventListener('click', clearSelection);
    tableEls.bulkExportBtn?.addEventListener('click', exportSelected);
    tableEls.clearFiltersBtn?.addEventListener('click', clearFilters);

    // Debounced search with URL update
    let searchTimeout;
    tableEls.searchInput?.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            updateUrl();
            renderTable();
        }, 200);
    });

    tableEls.paymentFilter?.addEventListener('change', () => {
        updateUrl();
        renderTable();
    });
    tableEls.ageDivFilter?.addEventListener('change', () => {
        updateUrl();
        renderTable();
    });

    // Apply URL state on init and initialize sort indicators
    applyUrlState();
    updateSortIndicators();

    return {
        setRegistrations,
        renderTable,
        getFilteredRegistrations,
        clearSelection,
        clearFilters,
        showSkeletonRows,
        // Pagination
        getPagination,
        setPage,
        renderPagination,
    };
}

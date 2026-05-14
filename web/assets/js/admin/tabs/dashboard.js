// web/assets/js/admin/tabs/dashboard.js
// Dashboard module for Phase 6C: Overview tab enhancements

export function initDashboard({ showToast }) {
    const els = {
        // Metric cards
        registrantCountCard: document.getElementById('registrantCountCard'),
        registrantTrend: document.getElementById('registrantTrend'),
        registrantCount2Sub: document.getElementById('registrantCount2Sub'),
        revenueValue: document.getElementById('revenueValue'),
        revenueTrend: document.getElementById('revenueTrend'),
        revenueSub: document.getElementById('revenueSub'),
        paidRateValue: document.getElementById('paidRateValue'),
        paidRateBar: document.getElementById('paidRateBar'),
        paidRateSub: document.getElementById('paidRateSub'),
        pendingCount: document.getElementById('pendingCount'),

        // Recent activity
        recentActivitySection: document.getElementById('recentActivitySection'),
        recentActivityList: document.getElementById('recentActivityList'),

        // Empty state
        emptyState: document.getElementById('emptyState'),
        registrationUrl: document.getElementById('registrationUrl'),
        copyUrlBtn: document.getElementById('copyUrlBtn'),
        tableWrap: document.getElementById('tableWrap'),
    };

    /**
     * Show skeleton loading state for dashboard
     */
    function showSkeletons() {
        // Skeleton for metric cards
        if (els.registrantCountCard) {
            els.registrantCountCard.innerHTML = '<div class="skeleton skeleton-text" style="width:60%;height:2rem;"></div>';
        }
        if (els.registrantTrend) {
            els.registrantTrend.innerHTML = '<div class="skeleton skeleton-text-sm" style="width:80%;"></div>';
        }
        if (els.revenueValue) {
            els.revenueValue.innerHTML = '<div class="skeleton skeleton-text" style="width:70%;height:2rem;"></div>';
        }
        if (els.revenueTrend) {
            els.revenueTrend.innerHTML = '<div class="skeleton skeleton-text-sm" style="width:80%;"></div>';
        }
        if (els.paidRateValue) {
            els.paidRateValue.innerHTML = '<div class="skeleton skeleton-text" style="width:50%;height:2rem;"></div>';
        }
        if (els.paidRateBar) {
            els.paidRateBar.style.width = '0%';
        }
        if (els.paidRateSub) {
            els.paidRateSub.innerHTML = '<div class="skeleton skeleton-text-xs" style="width:60%;"></div>';
        }

        // Skeleton for recent activity
        if (els.recentActivityList) {
            els.recentActivitySection?.classList.remove('hidden');
            els.recentActivityList.innerHTML = Array(3).fill(0).map(() => `
                <li class="recent-activity-item">
                    <div class="skeleton skeleton-avatar"></div>
                    <div class="recent-activity-content" style="flex:1;">
                        <div class="skeleton skeleton-text" style="width:60%;margin-bottom:4px;"></div>
                        <div class="skeleton skeleton-text-xs" style="width:80%;"></div>
                    </div>
                    <div class="skeleton skeleton-badge"></div>
                </li>
            `).join('');
        }
    }

    /**
     * Calculate dashboard metrics from registrations
     */
    function calculateMetrics(registrations) {
        const regs = Array.isArray(registrations) ? registrations : [];
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Total registrations
        const total = regs.length;

        // Revenue
        const revenue = regs.reduce((sum, r) => {
            const v = Number(r?.eventTotal ?? r?.event_total ?? 0);
            return sum + (Number.isFinite(v) ? v : 0);
        }, 0);

        // Payment status counts
        const paid = regs.filter(r => {
            const status = (r?.payment_status || r?.paymentStatus || '').toLowerCase();
            return status === 'completed' || status === 'paid';
        }).length;
        const pending = total - paid;
        const paidRate = total > 0 ? Math.round((paid / total) * 100) : 0;

        // Registrations today
        const todayRegs = regs.filter(r => {
            const created = r?.createdAt || r?.created_at;
            if (!created) return false;
            const d = new Date(String(created).replace(' ', 'T'));
            return d >= today;
        }).length;

        // Registrations this week
        const weekRegs = regs.filter(r => {
            const created = r?.createdAt || r?.created_at;
            if (!created) return false;
            const d = new Date(String(created).replace(' ', 'T'));
            return d >= weekAgo;
        }).length;

        // Revenue today
        const revenueToday = regs.filter(r => {
            const created = r?.createdAt || r?.created_at;
            if (!created) return false;
            const d = new Date(String(created).replace(' ', 'T'));
            return d >= today;
        }).reduce((sum, r) => {
            const v = Number(r?.eventTotal ?? r?.event_total ?? 0);
            return sum + (Number.isFinite(v) ? v : 0);
        }, 0);

        // Recent registrations (last 5)
        const recent = [...regs]
            .sort((a, b) => {
                const dateA = new Date(String(a?.createdAt || a?.created_at || 0).replace(' ', 'T'));
                const dateB = new Date(String(b?.createdAt || b?.created_at || 0).replace(' ', 'T'));
                return dateB - dateA;
            })
            .slice(0, 5);

        return {
            total,
            revenue,
            paid,
            pending,
            paidRate,
            todayRegs,
            weekRegs,
            revenueToday,
            recent
        };
    }

    /**
     * Format relative time
     */
    function relativeTime(dateStr) {
        if (!dateStr) return '';
        const date = new Date(String(dateStr).replace(' ', 'T'));
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    /**
     * Get initials from name
     */
    function getInitials(firstName, lastName) {
        const f = (firstName || '').charAt(0).toUpperCase();
        const l = (lastName || '').charAt(0).toUpperCase();
        return f + l || '?';
    }

    /**
     * Update dashboard UI with metrics
     */
    function updateDashboard(registrations) {
        const metrics = calculateMetrics(registrations);

        // Update registrant count card
        if (els.registrantCountCard) {
            els.registrantCountCard.textContent = String(metrics.total);
        }

        // Update registrant trend
        if (els.registrantTrend) {
            if (metrics.todayRegs > 0) {
                els.registrantTrend.className = 'metric-card-trend up';
                els.registrantTrend.innerHTML = `
                    <i data-lucide="trending-up"></i>
                    <span>+${metrics.todayRegs} today</span>
                `;
            } else if (metrics.weekRegs > 0) {
                els.registrantTrend.className = 'metric-card-trend up';
                els.registrantTrend.innerHTML = `
                    <i data-lucide="trending-up"></i>
                    <span>+${metrics.weekRegs} this week</span>
                `;
            } else {
                els.registrantTrend.className = 'metric-card-trend neutral';
                els.registrantTrend.innerHTML = `
                    <i data-lucide="minus"></i>
                    <span>No new registrations</span>
                `;
            }
        }

        // Update revenue card
        if (els.revenueValue) {
            els.revenueValue.textContent = `$${metrics.revenue.toFixed(2)}`;
        }

        // Update revenue trend
        if (els.revenueTrend) {
            if (metrics.revenueToday > 0) {
                els.revenueTrend.className = 'metric-card-trend up';
                els.revenueTrend.innerHTML = `
                    <i data-lucide="trending-up"></i>
                    <span>+$${metrics.revenueToday.toFixed(2)} today</span>
                `;
            } else if (metrics.total > 0) {
                els.revenueTrend.className = 'metric-card-trend neutral';
                els.revenueTrend.innerHTML = `
                    <i data-lucide="minus"></i>
                    <span>No new revenue today</span>
                `;
            } else {
                els.revenueTrend.className = 'metric-card-trend neutral';
                els.revenueTrend.innerHTML = `
                    <i data-lucide="minus"></i>
                    <span>No transactions</span>
                `;
            }
        }

        // Update paid rate card
        if (els.paidRateValue) {
            els.paidRateValue.textContent = `${metrics.paidRate}%`;
        }

        if (els.paidRateBar) {
            els.paidRateBar.style.width = `${metrics.paidRate}%`;
            // Change color based on rate
            if (metrics.paidRate >= 80) {
                els.paidRateBar.className = 'metric-progress-bar success';
            } else if (metrics.paidRate >= 50) {
                els.paidRateBar.className = 'metric-progress-bar warning';
            } else {
                els.paidRateBar.className = 'metric-progress-bar primary';
            }
        }

        if (els.paidRateSub) {
            els.paidRateSub.textContent = `${metrics.paid} of ${metrics.total} paid`;
        }

        if (els.pendingCount && metrics.pending > 0) {
            els.pendingCount.textContent = `${metrics.pending} pending`;
            els.pendingCount.style.color = 'var(--color-warning, #f59e0b)';
        } else if (els.pendingCount) {
            els.pendingCount.textContent = '';
        }

        // Update recent activity list
        if (els.recentActivityList) {
            if (metrics.recent.length === 0) {
                els.recentActivitySection?.classList.add('hidden');
            } else {
                els.recentActivitySection?.classList.remove('hidden');
                els.recentActivityList.innerHTML = metrics.recent.map(r => {
                    const firstName = r?.firstName || r?.first_name || '';
                    const lastName = r?.lastName || r?.last_name || '';
                    const name = `${firstName} ${lastName}`.trim() || 'Unknown';
                    const initials = getInitials(firstName, lastName);
                    const division = r?.ageDivision || r?.age_division || '';
                    const amount = Number(r?.eventTotal ?? r?.event_total ?? 0);
                    const status = (r?.payment_status || r?.paymentStatus || 'pending').toLowerCase();
                    const created = r?.createdAt || r?.created_at;
                    const isPaid = status === 'completed' || status === 'paid';

                    const selections = Array.isArray(r.eventSelections) ? r.eventSelections :
                        Array.isArray(r.event_selections) ? r.event_selections : [];
                    const eventCount = selections.length;

                    return `
                        <li class="recent-activity-item">
                            <div class="recent-activity-avatar">${escapeHtml(initials)}</div>
                            <div class="recent-activity-content">
                                <p class="recent-activity-name">${escapeHtml(name)}</p>
                                <p class="recent-activity-meta">${escapeHtml(division)} · ${eventCount} event${eventCount !== 1 ? 's' : ''} · $${amount.toFixed(2)}</p>
                            </div>
                            <span class="recent-activity-badge ${isPaid ? 'paid' : 'pending'}">
                                ${isPaid ? 'Paid' : 'Pending'}
                            </span>
                            <span class="recent-activity-time">${relativeTime(created)}</span>
                        </li>
                    `;
                }).join('');
            }
        }

        // Note: Empty state and table visibility are controlled by registrants.js
        // to avoid conflicts. Dashboard only controls the recent activity section.
        // The registrants module is the single source of truth for empty state.

        // Re-initialize Lucide icons for dynamic content
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Set the registration URL in empty state
     */
    function setRegistrationUrl(competitionId) {
        if (!els.registrationUrl) return;

        const baseUrl = window.location.origin;
        const url = competitionId
            ? `${baseUrl}/register.html?c=${competitionId}`
            : `${baseUrl}/register.html`;

        els.registrationUrl.textContent = url;
        els.registrationUrl.dataset.url = url;
    }

    /**
     * Copy URL to clipboard
     */
    function copyRegistrationUrl() {
        const url = els.registrationUrl?.dataset.url || els.registrationUrl?.textContent;
        if (!url) return;

        navigator.clipboard.writeText(url).then(() => {
            showToast('Registration URL copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = url;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('Registration URL copied to clipboard!', 'success');
        });
    }

    // Helper
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Initialize
    if (els.copyUrlBtn) {
        els.copyUrlBtn.addEventListener('click', copyRegistrationUrl);
    }

    // Set initial URL
    setRegistrationUrl(null);

    return {
        updateDashboard,
        setRegistrationUrl,
        calculateMetrics,
        showSkeletons,
    };
}

/**
 * LOANS.JS — Loan tracker derived from loan-category transactions
 *
 * Model:
 *   - Each transaction with category === 'loan' is one loan.
 *   - amount     = per-installment amount (or full amount for one-time)
 *   - date       = start / first installment date
 *   - endDate    = final installment date (used to compute total installments)
 *   - frequency  = how often (monthly, weekly, etc.)
 *
 *   Total Principal  = amount × totalInstallments
 *   Paid Installments = count of fulfilledMap entries for this transaction
 *   Total Paid       = sum of actual paidAmount values from fulfilledMap
 *   Remaining        = Total Principal − Total Paid
 */

// ============================================
// CORE: Build loan summaries from transactions
// ============================================

function getLoanSummaries() {
    const loanTransactions = transactions.filter(t =>
        t.category === 'loan' && t.type === 'expense'
    );
    if (!loanTransactions.length) return [];

    const summaries = loanTransactions.map(t => {
        // --- Compute all installment dates (start → end, or start → today if no endDate) ---
        const allDates = getAllInstallmentDates(t);   // every scheduled date
        const pastDates = getPastInstallmentDates(t);  // dates up to today
        const totalInstallments = allDates.length;
        const pastInstallments = pastDates.length;

        // --- Tally payments from fulfilledMap ---
        // Scan ALL fulfilledMap keys for this transaction id — this is the source of truth.
        // We don't rely on generated dates matching exactly; any key ending in _<id> counts.
        let paidInstallments = 0;
        let totalPaid = 0;
        const paymentHistory = [];

        const allFulfilledKeys = Object.keys(fulfilledMap).filter(k => k.endsWith(`_${t.id}`));

        allFulfilledKeys.forEach(k => {
            const record = fulfilledMap[k];
            // Skip partial-only records (partial: true means not yet fully paid for that occurrence)
            // But still count the paidAmount toward totalPaid
            const paid = typeof record === 'object' ? (record.paidAmount || t.amount) : t.amount;
            const isPartial = typeof record === 'object' && record.partial === true;
            if (!isPartial) paidInstallments++;
            totalPaid += paid;
            const dateKey = k.slice(0, k.lastIndexOf(`_${t.id}`));
            paymentHistory.push({ dateKey, paid, partial: isPartial });
        });

        const totalPrincipal = t.amount * totalInstallments;
        const remaining = Math.max(0, totalPrincipal - totalPaid);
        const pctPaid = totalPrincipal > 0 ? Math.min(100, (totalPaid / totalPrincipal) * 100) : 0;

        // Sort payment history newest first
        paymentHistory.sort((a, b) => b.dateKey.localeCompare(a.dateKey));

        return {
            transaction: t,
            displayName: t.name.trim(),
            amountPerInstallment: t.amount,
            totalInstallments,
            pastInstallments,
            paidInstallments,
            totalPrincipal,
            totalPaid,
            remaining,
            pctPaid,
            paymentHistory,
            isFullyPaid: remaining === 0 && totalPaid > 0,
        };
    });

    // Sort: by deadline (endDate) ascending — soonest due first.
    // Loans with no endDate go to the bottom (treated as far future).
    // Fully paid loans always sink to the very bottom regardless of date.
    summaries.sort((a, b) => {
        if (a.isFullyPaid !== b.isFullyPaid) return a.isFullyPaid ? 1 : -1;

        const aDate = a.transaction.endDate || '9999-12-31';
        const bDate = b.transaction.endDate || '9999-12-31';
        if (aDate !== bDate) return aDate.localeCompare(bDate);

        // Tie-breaker: larger remaining balance first
        return b.remaining - a.remaining;
    });

    return summaries;
}

/**
 * All scheduled installment dates from start → endDate (inclusive).
 * If no endDate, returns all dates from start up to today.
 */
function getAllInstallmentDates(t) {
    if (!t.date) return [];

    const endLimit = t.endDate
        ? new Date(t.endDate + 'T00:00:00')
        : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

    const dates = [];
    let cursor = new Date(t.date + 'T00:00:00');
    let count = 0;
    const MAX = 600;

    while (cursor <= endLimit && count < MAX) {
        dates.push(cursor.toISOString().split('T')[0]);
        cursor = nextDate(cursor, t.frequency);
        count++;
    }

    return dates;
}

/**
 * Installment dates from start → today (for "due so far" display).
 */
function getPastInstallmentDates(t) {
    if (!t.date) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dates = [];
    let cursor = new Date(t.date + 'T00:00:00');
    let count = 0;
    const MAX = 600;

    // Also respect endDate as a hard stop
    const endLimit = t.endDate
        ? new Date(Math.min(today, new Date(t.endDate + 'T00:00:00')))
        : today;

    while (cursor <= endLimit && count < MAX) {
        dates.push(cursor.toISOString().split('T')[0]);
        cursor = nextDate(cursor, t.frequency);
        count++;
    }

    return dates;
}

function nextDate(date, frequency) {
    const d = new Date(date);
    switch (frequency) {
        case 'weekly': d.setDate(d.getDate() + 7); break;
        case 'biweekly': d.setDate(d.getDate() + 14); break;
        case 'monthly': d.setMonth(d.getMonth() + 1); break;
        case 'quarterly': d.setMonth(d.getMonth() + 3); break;
        default: d.setFullYear(9999); break; // one-time: stop immediately
    }
    return d;
}

// ============================================
// RENDER
// ============================================

function renderLoans() {
    const container = document.getElementById('loanContainer');
    const totalDisp = document.getElementById('totalLoanDisplay');
    const section = document.getElementById('loansSection');
    if (!container) return;

    const summaries = getLoanSummaries();

    const grandTotal = summaries.reduce((s, l) => s + l.remaining, 0);
    if (totalDisp) {
        totalDisp.innerText = `₱${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    }
    if (section) section.style.display = summaries.length ? '' : 'none';

    if (!summaries.length) {
        container.innerHTML = `
            <p style="color:var(--text-muted); font-size:0.9rem; padding:1rem 0;">
                No loan transactions found. Add a transaction with category <strong>Loan</strong> to track it here.
            </p>`;
        return;
    }

    container.innerHTML = summaries.map(loan => renderLoanCard(loan)).join('');
}

function renderLoanCard(loan) {
    const barColor = loan.isFullyPaid ? 'var(--success)' : 'var(--danger)';
    const pct = Math.round(loan.pctPaid);
    const t = loan.transaction;

    // Installment progress label  e.g. "5 / 12 paid"
    const installmentLabel = loan.totalInstallments > 1
        ? `${loan.paidInstallments} / ${loan.totalInstallments} paid`
        : (loan.isFullyPaid ? 'Paid' : 'Unpaid');

    // Overdue: past installments not yet paid (hidden if loan is fully paid off)
    const overdue = loan.isFullyPaid ? 0 : Math.max(0, loan.pastInstallments - loan.paidInstallments);
    const overdueTag = overdue > 0
        ? `<span style="background:#fef2f2; color:var(--danger); font-size:0.62rem; font-weight:700;
                        padding:2px 7px; border-radius:99px; white-space:nowrap;">
               ${overdue} overdue
           </span>`
        : '';

    const latestPayment = loan.paymentHistory[0];
    const latestLine = latestPayment
        ? `Last payment: ₱${latestPayment.paid.toLocaleString()} on ${latestPayment.dateKey}`
        : 'No payments recorded yet';

    const deadlineLabel = t.endDate ? t.endDate : 'No deadline';
    const deadlineColor = (!loan.isFullyPaid && t.endDate && t.endDate < new Date().toISOString().split('T')[0])
        ? 'var(--danger)' : 'var(--text-muted)';

    const histId = `lh_${sanitizeId(loan.displayName + '_' + t.id)}`;

    return `
        <div class="card" style="
            padding: 1rem 1.25rem;
            border-left: 4px solid ${barColor};
            ${loan.isFullyPaid ? 'opacity:0.72;' : ''}
            margin-bottom: 0;
        ">
            <!-- Main row: list-style, all key info horizontally -->
            <div style="display:flex; align-items:center; gap:1.25rem; flex-wrap:wrap;">

                <!-- Name + deadline (fixed-ish width) -->
                <div style="min-width:160px; flex: 1 1 160px;">
                    <div style="font-size:0.95rem; font-weight:800; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                        🏦 ${loan.displayName}
                        ${loan.isFullyPaid ? '<span style="font-size:0.62rem; color:var(--success); background:#f0fdf4; padding:2px 7px; border-radius:99px;">PAID OFF</span>' : ''}
                        ${overdueTag}
                    </div>
                    <div style="font-size:0.7rem; color:${deadlineColor}; margin-top:2px; font-weight:${deadlineColor === 'var(--danger)' ? 700 : 400};">
                        📅 Deadline: ${deadlineLabel}
                    </div>
                </div>

                <!-- Per installment -->
                <div style="min-width:90px;">
                    <div style="font-size:0.62rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Per Installment</div>
                    <div style="font-size:0.85rem; font-weight:700;">₱${loan.amountPerInstallment.toLocaleString()}</div>
                </div>

                <!-- Total principal -->
                <div style="min-width:90px;">
                    <div style="font-size:0.62rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Principal</div>
                    <div style="font-size:0.85rem; font-weight:700;">₱${loan.totalPrincipal.toLocaleString()}</div>
                </div>

                <!-- Total paid -->
                <div style="min-width:90px;">
                    <div style="font-size:0.62rem; color:var(--success); text-transform:uppercase; font-weight:600;">Paid</div>
                    <div style="font-size:0.85rem; font-weight:700; color:var(--success);">₱${loan.totalPaid.toLocaleString()}</div>
                </div>

                <!-- Remaining -->
                <div style="min-width:100px;">
                    <div style="font-size:0.62rem; color:var(--danger); text-transform:uppercase; font-weight:600;">Remaining</div>
                    <div style="font-size:1.05rem; font-weight:800; color:${loan.isFullyPaid ? 'var(--success)' : 'var(--danger)'};">
                        ₱${loan.remaining.toLocaleString()}
                    </div>
                </div>

                <!-- Progress bar -->
                <div style="flex: 1 1 140px; min-width:140px;">
                    <div style="background:var(--border); border-radius:99px; height:7px; overflow:hidden; margin-bottom:4px;">
                        <div style="width:${pct}%; height:100%; background:${barColor}; border-radius:99px; transition:width 0.4s ease;"></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:0.65rem; color:var(--text-muted);">
                        <span>${installmentLabel}</span>
                        <span style="font-weight:700;">${pct}%</span>
                    </div>
                </div>

                <!-- History toggle -->
                <button class="btn-ghost" style="font-size:0.7rem; padding:5px 10px; white-space:nowrap;"
                        onclick="toggleLoanHistory('${histId}')">
                    History
                </button>
            </div>

            <div style="font-size:0.68rem; color:var(--text-muted); margin-top:6px;">${latestLine}</div>

            <!-- Collapsible payment history -->
            <div id="${histId}" style="display:none; margin-top:12px; border-top:1px solid var(--border); padding-top:10px;">
                <div style="font-size:0.7rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">
                    Payment History
                </div>
                ${loan.paymentHistory.length ? `
                    <div style="display:flex; flex-direction:column; gap:4px; max-height:200px; overflow-y:auto;">
                        ${loan.paymentHistory.map(p => `
                            <div style="display:flex; justify-content:space-between; align-items:center;
                                        padding:5px 10px; background:var(--bg); border-radius:8px; font-size:0.76rem;">
                                <span style="color:var(--text-muted);">${p.dateKey}</span>
                                <span style="font-weight:700; color:var(--success);">₱${p.paid.toLocaleString()}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : `<div style="font-size:0.78rem; color:var(--text-muted);">No payments recorded yet.</div>`}
            </div>
        </div>
    `;
}

function toggleLoanHistory(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function sanitizeId(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '_');
}
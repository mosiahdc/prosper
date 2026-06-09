/**
 * LOANS.JS — Loan tracker derived from loan-category transactions
 *
 * No separate data store. Reads all transactions where category === 'loan',
 * groups by name, and computes remaining balance from payment records in fulfilledMap.
 *
 * Each unique loan name becomes one loan card.
 * Remaining = sum of amounts across all occurrences - total payments recorded via fulfilledMap.
 */

// ============================================
// CORE: Build loan summaries from transactions
// ============================================

/**
 * Returns an array of loan summary objects, one per unique loan name.
 * Each entry:
 *   { name, totalOwed, totalPaid, remaining, pctPaid, occurrences[] }
 *
 * occurrences: all dated instances (past + future) from calendar data so we can
 * also count payments recorded per-date in fulfilledMap.
 */
function getLoanSummaries() {
    const loanTransactions = transactions.filter(t =>
        t.category === 'loan' && t.type === 'expense'
    );

    if (!loanTransactions.length) return [];

    // Group by name (case-insensitive key, display original casing)
    const grouped = {};
    loanTransactions.forEach(t => {
        const key = t.name.trim().toLowerCase();
        if (!grouped[key]) {
            grouped[key] = { displayName: t.name.trim(), items: [] };
        }
        grouped[key].items.push(t);
    });

    const summaries = [];

    Object.values(grouped).forEach(({ displayName, items }) => {
        // Total owed = sum of amounts across all transaction items (base amount × recurrence is
        // handled by looking at all fulfilledMap keys that match this transaction's id)
        let totalOwed = 0;
        let totalPaid = 0;
        const paymentHistory = [];

        items.forEach(t => {
            // For one-time loans: amount is the full loan amount
            // For recurring loans: amount × all occurrences that have been touched
            // Strategy: scan fulfilledMap for keys ending in _<t.id>
            const matchingKeys = Object.keys(fulfilledMap).filter(k => k.endsWith(`_${t.id}`));

            if (t.frequency === 'none') {
                // One-time loan
                totalOwed += t.amount;

                matchingKeys.forEach(k => {
                    const record = fulfilledMap[k];
                    const paid = typeof record === 'object' ? (record.paidAmount || 0) : t.amount;
                    totalPaid += paid;
                    const dateKey = k.replace(`_${t.id}`, '');
                    paymentHistory.push({ dateKey, paid, total: t.amount, transactionId: t.id });
                });
            } else {
                // Recurring loan (e.g. monthly amortisation)
                // totalOwed = base amount per occurrence. We count how many occurrences exist
                // by looking at all calendar months from the transaction's startDate until today
                const occurrenceDates = getRecurringOccurrenceDates(t);
                const occurrenceCount = occurrenceDates.length;
                totalOwed += t.amount * occurrenceCount;

                matchingKeys.forEach(k => {
                    const record = fulfilledMap[k];
                    const paid = typeof record === 'object' ? (record.paidAmount || 0) : t.amount;
                    totalPaid += paid;
                    const dateKey = k.replace(`_${t.id}`, '');
                    paymentHistory.push({ dateKey, paid, total: t.amount, transactionId: t.id });
                });
            }
        });

        const remaining = Math.max(0, totalOwed - totalPaid);
        const pctPaid = totalOwed > 0 ? Math.min(100, (totalPaid / totalOwed) * 100) : 0;

        // Sort payment history newest first
        paymentHistory.sort((a, b) => b.dateKey.localeCompare(a.dateKey));

        summaries.push({
            displayName,
            totalOwed,
            totalPaid,
            remaining,
            pctPaid,
            paymentHistory,
            transactions: items,
        });
    });

    // Sort: most remaining balance first
    summaries.sort((a, b) => b.remaining - a.remaining);

    return summaries;
}

/**
 * Returns an array of dateKey strings ("YYYY-MM-DD") for all past + current
 * occurrences of a recurring transaction, from its start up to today.
 */
function getRecurringOccurrenceDates(t) {
    const dates = [];
    if (!t.date) return dates;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let cursor = new Date(t.date + 'T00:00:00');
    const maxIterations = 600; // safety cap
    let count = 0;

    while (cursor <= today && count < maxIterations) {
        dates.push(cursor.toISOString().split('T')[0]);

        // Advance by frequency
        const next = new Date(cursor);
        switch (t.frequency) {
            case 'weekly': next.setDate(next.getDate() + 7); break;
            case 'biweekly': next.setDate(next.getDate() + 14); break;
            case 'monthly': next.setMonth(next.getMonth() + 1); break;
            case 'quarterly': next.setMonth(next.getMonth() + 3); break;
            default: next.setFullYear(9999); break; // stop
        }
        cursor = next;
        count++;
    }

    return dates;
}

// ============================================
// RENDER: Loan cards in #loanContainer
// ============================================

function renderLoans() {
    const container = document.getElementById('loanContainer');
    const totalDisp = document.getElementById('totalLoanDisplay');
    const section = document.getElementById('loansSection');
    if (!container) return;

    const summaries = getLoanSummaries();

    // Update header total
    const grandTotal = summaries.reduce((s, l) => s + l.remaining, 0);
    if (totalDisp) {
        totalDisp.innerText = `₱${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    }

    // Hide section if no loan transactions exist
    if (section) {
        section.style.display = summaries.length ? '' : 'none';
    }

    if (!summaries.length) {
        container.innerHTML = `
            <p style="color: var(--text-muted); font-size: 0.9rem; padding: 1rem 0;">
                No loan transactions found. Add a transaction with category <strong>Loan</strong> to track it here.
            </p>`;
        return;
    }

    container.innerHTML = summaries.map(loan => renderLoanCard(loan)).join('');
}

function renderLoanCard(loan) {
    const isFullyPaid = loan.remaining === 0 && loan.totalPaid > 0;
    const barColor = isFullyPaid ? 'var(--success)' : 'var(--danger)';
    const pct = Math.round(loan.pctPaid);

    // Latest payment line
    const latestPayment = loan.paymentHistory[0];
    const latestLine = latestPayment
        ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:4px;">
               Last payment: ₱${latestPayment.paid.toLocaleString()} on ${latestPayment.dateKey}
           </div>`
        : `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:4px;">No payments recorded yet</div>`;

    return `
        <div class="card" style="
            padding: 1.5rem;
            border-left: 4px solid ${barColor};
            position: relative;
            ${isFullyPaid ? 'opacity: 0.7;' : ''}
        ">
            <!-- Header row -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                <div>
                    <div style="color:var(--text-muted); font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">
                        🏦 Loan
                    </div>
                    <div style="font-size:1.1rem; font-weight:800; margin-top:3px;">
                        ${loan.displayName}
                        ${isFullyPaid ? '<span style="font-size:0.75rem; color:var(--success); margin-left:6px;">✅ PAID OFF</span>' : ''}
                    </div>
                </div>
                <button class="btn-ghost" style="font-size:0.75rem; padding:4px 10px;"
                        onclick="toggleLoanHistory('lh_${sanitizeId(loan.displayName)}')">
                    History
                </button>
            </div>

            <!-- Amounts row -->
            <div style="display:flex; gap:1.5rem; margin-bottom:14px; flex-wrap:wrap;">
                <div>
                    <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Total Owed</div>
                    <div style="font-size:1rem; font-weight:700;">₱${loan.totalOwed.toLocaleString()}</div>
                </div>
                <div>
                    <div style="font-size:0.68rem; color:var(--success); text-transform:uppercase; font-weight:600;">Total Paid</div>
                    <div style="font-size:1rem; font-weight:700; color:var(--success);">₱${loan.totalPaid.toLocaleString()}</div>
                </div>
                <div>
                    <div style="font-size:0.68rem; color:var(--danger); text-transform:uppercase; font-weight:600;">Remaining</div>
                    <div style="font-size:1.3rem; font-weight:800; color:${isFullyPaid ? 'var(--success)' : 'var(--danger)'};">
                        ₱${loan.remaining.toLocaleString()}
                    </div>
                </div>
            </div>

            <!-- Progress bar -->
            <div style="background:var(--border); border-radius:99px; height:8px; margin-bottom:8px; overflow:hidden;">
                <div style="
                    width:${pct}%;
                    height:100%;
                    background:${barColor};
                    border-radius:99px;
                    transition:width 0.4s ease;
                "></div>
            </div>
            <div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:4px;">
                ${pct}% paid off
            </div>
            ${latestLine}

            <!-- Collapsible payment history -->
            <div id="lh_${sanitizeId(loan.displayName)}" style="display:none; margin-top:14px; border-top:1px solid var(--border); padding-top:12px;">
                <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">
                    Payment History
                </div>
                ${loan.paymentHistory.length ? `
                    <div style="display:flex; flex-direction:column; gap:6px; max-height:220px; overflow-y:auto;">
                        ${loan.paymentHistory.map(p => `
                            <div style="display:flex; justify-content:space-between; align-items:center;
                                        padding:6px 10px; background:var(--bg); border-radius:8px; font-size:0.8rem;">
                                <span style="color:var(--text-muted);">${p.dateKey}</span>
                                <span style="font-weight:700; color:var(--success);">₱${p.paid.toLocaleString()}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : `<div style="font-size:0.8rem; color:var(--text-muted);">No payments yet.</div>`}
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
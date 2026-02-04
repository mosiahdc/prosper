/**
 * CALENDAR.JS - Final Fix for Past-Due Balance Calculation
 */

function getDayData(year, month, day, isLive) {
    let net = 0;
    let items = [];
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    transactions.forEach(t => {
        const tParts = t.date.split('-');
        const tDateObj = new Date(parseInt(tParts[0]), parseInt(tParts[1]) - 1, parseInt(tParts[2]));
        tDateObj.setHours(0, 0, 0, 0);

        const currentObj = new Date(year, month, day);
        currentObj.setHours(0, 0, 0, 0);

        if (t.endDate) {
            const endParts = t.endDate.split('-');
            const endDateObj = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
            endDateObj.setHours(23, 59, 59, 999);
            if (currentObj > endDateObj) return;
        }

        let match = false;
        if (t.frequency === 'none' && t.date === dateKey) {
            match = true;
        } else if (t.frequency === 'monthly' && parseInt(tParts[2]) === day && currentObj >= tDateObj) {
            match = true;
        } else if (t.frequency === 'biweekly' && currentObj >= tDateObj) {
            const diff = Math.round((currentObj - tDateObj) / 86400000);
            if (diff % 14 === 0) match = true;
        } else if (t.frequency === 'weekly' && currentObj >= tDateObj) {
            const diff = Math.round((currentObj - tDateObj) / 86400000);
            if (diff % 7 === 0) match = true;
        }

        if (match) {
            const status = fulfilledMap[`${dateKey}_${t.id}`];
            const isPaid = !!status;

            let displayAmount = t.amount;
            if (status && typeof status === 'object' && status.amountPaid !== undefined) {
                displayAmount = status.amountPaid;
            }

            const val = (t.type === 'income' ? displayAmount : -displayAmount);
            items.push({ ...t, val, isPaid, actualAmount: displayAmount });

            // In Dashboard (isLive), only show the amount if it's UNPAID.
            if (isLive) {
                if (!isPaid) net += val;
            } else {
                net += val;
            }
        }
    });
    return { net, items, dateKey };
}

function refreshUI() {
    const currentVaultCash = vaults.reduce((s, v) => s + v.balance, 0);
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const title = currentViewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    ['live', 'review'].forEach(mode => {
        const isLive = mode === 'live';
        const tbody = document.getElementById(isLive ? 'liveCalBody' : 'reviewCalBody');
        if (!tbody) return;

        let runningTotal = currentVaultCash;
        let html = '';
        let dayCounter = 1;
        let monthlyIncome = 0;
        let monthlyExpense = 0;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMo = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < 6; i++) {
            let row = '<tr>';
            let weeklyChange = 0;
            for (let j = 0; j < 7; j++) {
                if (i === 0 && j < firstDay || dayCounter > daysInMo) {
                    row += '<td></td>';
                } else {
                    const { items, dateKey } = getDayData(year, month, dayCounter, isLive);
                    let dayNetImpact = 0;

                    items.forEach(it => {
                        const status = fulfilledMap[`${dateKey}_${it.id}`];
                        const amountPaid = (status && status.amountPaid !== undefined) ? status.amountPaid : 0;

                        // Amount still owed
                        const remaining = it.amount - amountPaid;
                        const val = (it.type === 'income' ? -remaining : remaining);

                        if (isLive) {
                            dayNetImpact -= val;
                            const totalValue = it.actualAmount || it.amount;
                            if (it.type === 'income') monthlyIncome += totalValue;
                            else monthlyExpense += totalValue;
                        } else {
                            dayNetImpact += it.val;
                        }
                    });

                    weeklyChange += dayNetImpact;
                    const isToday = dateKey === today.toISOString().split('T')[0];

                    // Display calculation for the cell (Unpaid portion)
                    const cellNet = isLive ? items.reduce((acc, it) => {
                        const status = fulfilledMap[`${dateKey}_${it.id}`];
                        const paid = status ? status.amountPaid : 0;
                        const rem = it.amount - paid;
                        return acc + (it.type === 'income' ? rem : -rem);
                    }, 0) : dayNetImpact;

                    row += `
                        <td class="${isToday ? 'today-cell' : ''}" onclick="openDayModal('${dateKey}', ${isLive})">
                            <span class="day-num">${dayCounter}</span><br>
                            ${cellNet !== 0 ? `<span class="day-amount ${cellNet > 0 ? 'amt-pos' : 'amt-neg'}">${Math.round(cellNet).toLocaleString()}</span>` : ''}
                        </td>`;
                    dayCounter++;
                }
            }
            runningTotal += weeklyChange;
            const totalClass = runningTotal < 0 ? 'amt-neg' : '';
            row += `
                <td style="text-align:center; font-size:0.8rem; color:var(--text-muted)">${Math.round(weeklyChange).toLocaleString()}</td>
                <td class="col-total ${totalClass}" style="font-weight:800">₱${Math.round(runningTotal).toLocaleString()}</td>
            </tr>`;
            html += row;
            if (dayCounter > daysInMo) break;
        }
        tbody.innerHTML = html;
        updateSummary(monthlyIncome, monthlyExpense, title, isLive);
    });

    renderUpcomingSidebar();
}

function openDayModal(dateKey, isLive) {
    const parts = dateKey.split('-');
    // RE-FETCH data inside the function to see the new fulfilledMap values
    const { items } = getDayData(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), false);

    document.getElementById('dayModalDate').innerText = dateKey;
    const list = document.getElementById('dayItemList');

    list.innerHTML = items.map(it => {
        const status = fulfilledMap[`${dateKey}_${it.id}`];
        const amountPaid = status ? status.amountPaid : 0;
        const isFullyPaid = amountPaid >= it.amount;
        const isPartial = amountPaid > 0 && amountPaid < it.amount;

        let statusText = 'MARK PAID';
        let statusClass = 'status-pending';

        if (isFullyPaid) {
            statusText = 'PAID';
            statusClass = 'status-paid';
        } else if (isPartial) {
            statusText = 'PARTIAL';
            statusClass = 'status-partial';
        }

        return `
            <div class="day-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border);">
                <div>
                    <strong style="${isFullyPaid ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">${it.name}</strong>
                    <br><small>Due: ₱${it.amount.toLocaleString()} | Paid: ₱${amountPaid.toLocaleString()}</small>
                </div>
                <div style="display:flex; gap: 5px;">
                    ${(amountPaid > 0) ? `<button class="status-pill" style="background:#e74c3c; color:white;" onclick="unpayItem('${dateKey}', ${it.id})">✕</button>` : ''}
                    ${isLive ? `<button class="status-pill ${statusClass}" onclick="toggleFulfill('${dateKey}', ${it.id})">${statusText}</button>` : ''}
                </div>
            </div>`;
    }).join('') || '<p style="text-align:center; padding:20px;">No transactions.</p>';

    document.getElementById('dayModal').classList.add('active');
}

let pendingPaymentData = null; // Stores data while modal is open

function toggleFulfill(dateKey, id) {
    const k = `${dateKey}_${id}`;
    const trans = transactions.find(t => t.id === id);
    const existing = fulfilledMap[k];

    // Store the keys for the confirmation step
    pendingPaymentData = { key: k, dateKey: dateKey, id: id };

    // Set UI elements in the payment modal
    document.getElementById('paymentModalTitle').innerText = trans.name;
    document.getElementById('paymentModalDetail').innerText = `Total Due: ₱${trans.amount.toLocaleString()}`;

    const inputField = document.getElementById('paymentAmountInput');
    inputField.value = existing ? existing.amountPaid : trans.amount;

    // Show the modal
    document.getElementById('paymentModal').classList.add('active');

    // Auto-focus the input
    setTimeout(() => inputField.focus(), 100);
}

function confirmPayment() {
    if (!pendingPaymentData) return;

    const amt = parseFloat(document.getElementById('paymentAmountInput').value);
    const k = pendingPaymentData.key;
    const dateKey = pendingPaymentData.dateKey; // Capture the date before clearing data

    if (isNaN(amt) || amt <= 0) {
        delete fulfilledMap[k];
    } else {
        fulfilledMap[k] = { paid: true, amountPaid: amt };
    }

    // 1. Save data
    saveData();

    // 2. Refresh the background calendar
    refreshUI();

    // 3. Close the payment input box
    closePaymentModal();

    // 4. THE FIX: Small delay ensures the DOM is ready for the refresh
    setTimeout(() => {
        console.log("Forcing Modal Refresh for: ", dateKey);
        openDayModal(dateKey, true);
    }, 50);
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
    pendingPaymentData = null;
}

function unpayItem(dateKey, id) {
    const k = `${dateKey}_${id}`;
    if (confirm("Are you sure you want to mark this as unpaid?")) {
        delete fulfilledMap[k];
        saveData();
        refreshUI();

        // Refresh the modal so the button changes back to "MARK PAID"
        openDayModal(dateKey, true);
    }
}

// ... rest of the helper functions remain unchanged ...
function updateSummary(inc, exp, title, isLive) {
    // If isLive is true, it uses Dashboard IDs. If false, it uses Review IDs.
    const titleId = isLive ? 'monthTitleLive' : 'monthTitleReview';
    const incId = isLive ? 'sumIncome' : 'sumRevIncome';
    const expId = isLive ? 'sumExpense' : 'sumRevExpense';
    const netId = isLive ? 'sumNet' : 'sumRevNet';

    const titleEl = document.getElementById(titleId);
    if (titleEl) titleEl.innerText = title;

    const incEl = document.getElementById(incId);
    const expEl = document.getElementById(expId);
    const netEl = document.getElementById(netId);

    if (incEl) incEl.innerText = `₱${Math.round(inc).toLocaleString()}`;
    if (expEl) expEl.innerText = `₱${Math.round(exp).toLocaleString()}`;
    if (netEl) {
        const netValue = inc - exp;
        netEl.innerText = `${netValue >= 0 ? '+' : ''}₱${Math.round(netValue).toLocaleString()}`;
    }
}


function renderUpcomingSidebar() {
    const listContainer = document.getElementById('upcomingList');
    if (!listContainer) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const fiveDaysOut = new Date(today); fiveDaysOut.setDate(today.getDate() + 5);
    let upcoming = [];
    for (let d = new Date(today); d <= fiveDaysOut; d.setDate(d.getDate() + 1)) {
        const { items, dateKey } = getDayData(d.getFullYear(), d.getMonth(), d.getDate(), false);
        items.forEach(item => {
            const status = fulfilledMap[`${dateKey}_${item.id}`];
            const paid = status ? status.amountPaid : 0;
            if (paid < item.amount) upcoming.push({ ...item, dueDate: dateKey, alreadyPaid: paid });
        });
    }
    listContainer.innerHTML = upcoming.map(item => `
        <div class="card" style="padding: 12px; margin-bottom: 8px; border-left: 4px solid ${item.type === 'income' ? 'var(--success)' : 'var(--primary)'};">
            <div style="display: flex; justify-content: space-between;">
                <div><b>${item.name}</b><br><small>${item.dueDate}</small></div>
                <b>₱${(item.amount - item.alreadyPaid).toLocaleString()}</b>
            </div>
            <button class="status-pill status-pending" style="width:100%; margin-top:8px;" onclick="toggleFulfill('${item.dueDate}', ${item.id})">Mark Paid</button>
        </div>`).join('') || '<div style="text-align:center; color:var(--text-muted); padding:10px;">All clear!</div>';
}
function closeDayModal() { document.getElementById('dayModal').classList.remove('active'); }
function changeMonth(s) { currentViewDate.setMonth(currentViewDate.getMonth() + s); refreshUI(); }
function jumpToToday() { currentViewDate = new Date(); currentViewDate.setDate(1); refreshUI(); }
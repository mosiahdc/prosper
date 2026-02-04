/**
 * CALENDAR.JS - Final Consolidated Version
 * Handles the Dashboard, Review calculations, and UI Refresh
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

        // --- NEW END DATE LOGIC ---
        if (t.endDate) {
            const endParts = t.endDate.split('-');
            const endDateObj = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
            endDateObj.setHours(23, 59, 59, 999);
            if (currentObj > endDateObj) return; // Skip if we are past the end date
        }
        // --- END OF NEW LOGIC ---

        let match = false;
        if (t.frequency === 'none' && t.date === dateKey) {
            match = true;
        } else if (t.frequency === 'monthly' && parseInt(tParts[2]) === day && currentObj >= tDateObj) {
            match = true;
        } else if (t.frequency === 'biweekly' && currentObj >= tDateObj) {
            const diff = Math.round((currentObj - tDateObj) / 86400000);
            if (diff % 14 === 0) match = true;
        }
        // --- ADD THIS SECTION ---
        else if (t.frequency === 'weekly' && currentObj >= tDateObj) {
            const diff = Math.round((currentObj - tDateObj) / 86400000);
            if (diff % 7 === 0) match = true;
        }

        if (match) {
            const isPaid = fulfilledMap[`${dateKey}_${t.id}`];
            const val = (t.type === 'income' ? t.amount : -t.amount);
            items.push({ ...t, val, isPaid });

            // Logic: Live view ignores the 'net' impact of items already marked as paid
            if (!(isLive && isPaid)) net += val;
        }
    });
    return { net, items, dateKey };
}

function refreshUI() {
    const totalVaults = vaults.reduce((s, v) => s + v.balance, 0); //
    const year = currentViewDate.getFullYear(); //
    const month = currentViewDate.getMonth(); //

    // 1. CALCULATE CARRY-OVER STARTING BALANCE
    // We start with current totalVaults and roll back/forward to the start of the view month
    let startingBalance = totalVaults;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const viewMonthStart = new Date(year, month, 1);

    if (viewMonthStart > today) {
        // Looking at the FUTURE: Add net changes from Today's date up to the Start of the View Month
        let tempDate = new Date(today);
        while (tempDate < viewMonthStart) {
            const { net } = getDayData(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate(), true);
            startingBalance += net;
            tempDate.setDate(tempDate.getDate() + 1);
        }
    } else {
        // Looking at the PAST/PRESENT: Subtract net changes from the View Month Start up to Today
        let tempDate = new Date(viewMonthStart);
        while (tempDate < today) {
            const { net } = getDayData(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate(), true);
            startingBalance -= net;
            tempDate.setDate(tempDate.getDate() + 1);
        }
    }

    let monthlyIncome = 0; //
    let monthlyExpense = 0; //
    const title = currentViewDate.toLocaleString('default', { month: 'long', year: 'numeric' }); //

    ['live', 'review'].forEach(mode => {
        const isLive = mode === 'live';
        const tbody = document.getElementById(isLive ? 'liveCalBody' : 'reviewCalBody');
        if (!tbody) return;

        let runningTotal = startingBalance; // Begin each month with the carry-over balance
        let html = '';
        let dayCounter = 1;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMo = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < 6; i++) {
            let row = '<tr>';
            let weeklyChange = 0;
            for (let j = 0; j < 7; j++) {
                if (i === 0 && j < firstDay || dayCounter > daysInMo) {
                    row += '<td></td>';
                } else {
                    const { net, items, dateKey } = getDayData(year, month, dayCounter, isLive);

                    if (isLive) {
                        items.forEach(it => {
                            if (it.type === 'income') monthlyIncome += it.amount;
                            else monthlyExpense += it.amount;
                        });
                    }

                    weeklyChange += net;
                    const isToday = dateKey === new Date().toISOString().split('T')[0];
                    row += `
                        <td class="${isToday ? 'today-cell' : ''}" onclick="openDayModal('${dateKey}', ${isLive})">
                            <span class="day-num">${dayCounter}</span><br>
                            ${net !== 0 ? `<span class="day-amount ${net > 0 ? 'amt-pos' : 'amt-neg'}">${Math.round(net)}</span>` : ''}
                        </td>`;
                    dayCounter++;
                }
            }
            runningTotal += weeklyChange;
            // The Total column now reflects the accumulated balance including previous months
            row += `<td style="text-align:center">${Math.round(weeklyChange)}</td><td class="col-total">$${Math.round(runningTotal).toLocaleString()}</td></tr>`;
            html += row;
            if (dayCounter > daysInMo) break;
        }
        tbody.innerHTML = html;
    });

    // Update Summary Badges
    const suffix = ['', 'Review'];
    suffix.forEach(s => {
        const incomeEl = document.getElementById(`sumIncome${s}`);
        const expenseEl = document.getElementById(`sumExpense${s}`);
        const netEl = document.getElementById(`sumNet${s}`);
        const titleEl = document.getElementById(`monthTitle${s === '' ? 'Live' : 'Review'}`);

        if (titleEl) titleEl.innerText = title;
        if (incomeEl) incomeEl.innerText = `$${Math.round(monthlyIncome).toLocaleString()}`;
        if (expenseEl) expenseEl.innerText = `$${Math.round(monthlyExpense).toLocaleString()}`;
        if (netEl) {
            const netValue = monthlyIncome - monthlyExpense;
            netEl.innerText = `${netValue >= 0 ? '+' : ''}$${Math.round(netValue).toLocaleString()}`;
        }
    });
    // At the very end of the function:
    renderUpcomingSidebar();
}

function changeMonth(step) {
    currentViewDate.setMonth(currentViewDate.getMonth() + step);
    refreshUI();
}

function jumpToToday() {
    currentViewDate = new Date();
    currentViewDate.setDate(1);
    refreshUI();
}

function openDayModal(dateKey, isLive) {
    const todayStr = new Date().toISOString().split('T')[0];
    const parts = dateKey.split('-');

    // FIX: We fetch items. We pass 'false' to getDayData so we see ALL items 
    // regardless of whether they are paid, but we use the 'isLive' parameter 
    // passed into openDayModal to decide if we show the toggle button.
    const { items } = getDayData(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), false);

    const titlePrefix = (dateKey === todayStr) ? "⭐ Today - " : "";
    document.getElementById('dayModalDate').innerText = titlePrefix + dateKey;

    document.getElementById('dayItemList').innerHTML = items.map(it => {
        // Determine button text and class based on paid status
        const statusText = it.isPaid ? 'PAID' : 'MARK PAID';
        const statusClass = it.isPaid ? 'status-paid' : 'status-pending';

        return `
            <div class="day-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border);">
                <div>
                    <strong style="${it.isPaid ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">${it.name}</strong>
                    <br><small>$${it.amount.toLocaleString()}</small>
                </div>
                ${isLive ? `
                    <button class="status-pill ${statusClass}" 
                            onclick="toggleFulfill('${dateKey}', ${it.id})">
                        ${statusText}
                    </button>` : ''}
            </div>
        `;
    }).join('') || '<p style="text-align:center; color:var(--text-muted); padding:20px;">No transactions for this day.</p>';

    document.getElementById('dayModal').classList.add('active');
}

function toggleFulfill(dateKey, id) {
    const k = `${dateKey}_${id}`;
    if (fulfilledMap[k]) delete fulfilledMap[k]; else fulfilledMap[k] = true;
    saveData();
    refreshUI();
    openDayModal(dateKey, true);
}

function closeDayModal() {
    document.getElementById('dayModal').classList.remove('active');
}


function renderUpcomingSidebar() {
    const listContainer = document.getElementById('upcomingList');
    if (!listContainer) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const fiveDaysOut = new Date(today);
    fiveDaysOut.setDate(today.getDate() + 5);

    let upcoming = [];

    // Check every day for the next 5 days
    for (let d = new Date(today); d <= fiveDaysOut; d.setDate(d.getDate() + 1)) {
        const { items, dateKey } = getDayData(d.getFullYear(), d.getMonth(), d.getDate(), false);

        items.forEach(item => {
            // Only show if not already marked paid
            if (!item.isPaid) {
                upcoming.push({ ...item, dueDate: dateKey });
            }
        });
    }

    if (upcoming.length === 0) {
        listContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem; text-align: center; border: 1px dashed var(--border); border-radius: 8px;">All clear! No upcoming dues.</div>`;
        return;
    }

    listContainer.innerHTML = upcoming.map(item => `
        <div class="card" style="padding: 12px; margin-bottom: 0; border-left: 4px solid ${item.type === 'income' ? 'var(--success)' : 'var(--primary)'};">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <div style="font-weight: 700; font-size: 0.9rem;">${item.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${item.dueDate}</div>
                </div>
                <div style="font-weight: 800; color: ${item.type === 'income' ? 'var(--success)' : 'var(--text-main)'};">
                    $${item.amount.toLocaleString()}
                </div>
            </div>
            <button class="status-pill status-pending" style="width: 100%; margin-top: 10px; font-size: 0.6rem; padding: 4px;" 
                onclick="toggleFulfill('${item.dueDate}', ${item.id})">
                Mark Paid
            </button>
        </div>
    `).join('');
}
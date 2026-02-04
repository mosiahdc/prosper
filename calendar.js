/**
 * CALENDAR LOGIC
 * Handles the Dashboard and Review calculations
 */

function getDayData(year, month, day, isLive) {
    let net = 0;
    let items = [];
    // Standardize to YYYY-MM-DD for comparison
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    transactions.forEach(t => {
        const tParts = t.date.split('-');
        const tDateObj = new Date(parseInt(tParts[0]), parseInt(tParts[1]) - 1, parseInt(tParts[2]));
        const currentObj = new Date(year, month, day);

        let match = false;
        if (t.frequency === 'none' && t.date === dateKey) match = true;
        else if (t.frequency === 'monthly' && parseInt(tParts[2]) === day && currentObj >= tDateObj) match = true;
        else if (t.frequency === 'biweekly' && currentObj >= tDateObj) {
            const diff = Math.round((currentObj - tDateObj) / 86400000);
            if (diff % 14 === 0) match = true;
        }

        if (match) {
            const isPaid = fulfilledMap[`${dateKey}_${t.id}`];
            const val = (t.type === 'income' ? t.amount : -t.amount);
            items.push({ ...t, val, isPaid });
            if (!(isLive && isPaid)) net += val;
        }
    });
    return { net, items, dateKey };
}

function refreshUI() {
    const totalVaults = vaults.reduce((s, v) => s + v.balance, 0);
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();

    // NEW: Summary Counters
    let monthlyIncome = 0;
    let monthlyExpense = 0;

    const title = currentViewDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (document.getElementById('monthTitleLive')) document.getElementById('monthTitleLive').innerText = title;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMo = new Date(year, month + 1, 0).getDate();

    ['live', 'review'].forEach(mode => {
        const isLive = mode === 'live';
        const tbody = document.getElementById(isLive ? 'liveCalBody' : 'reviewCalBody');
        if (!tbody) return;

        let runningTotal = totalVaults;
        let html = '';
        let dayCounter = 1;

        for (let i = 0; i < 6; i++) {
            let row = '<tr>';
            let weeklyChange = 0;
            for (let j = 0; j < 7; j++) {
                if (i === 0 && j < firstDay || dayCounter > daysInMo) {
                    row += '<td></td>';
                } else {
                    const { net, items, dateKey } = getDayData(year, month, dayCounter, isLive);

                    // NEW: Track totals for the summary (only once per day loop)
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
            row += `<td style="text-align:center">${Math.round(weeklyChange)}</td><td class="col-total">$${Math.round(runningTotal).toLocaleString()}</td></tr>`;
            html += row;
            if (dayCounter > daysInMo) break;
        }
        tbody.innerHTML = html;
    });

    // Update the Summary DOM
    if (document.getElementById('sumIncome')) {
        document.getElementById('sumIncome').innerText = `$${Math.round(monthlyIncome).toLocaleString()}`;
        document.getElementById('sumExpense').innerText = `$${Math.round(monthlyExpense).toLocaleString()}`;
        const net = monthlyIncome - monthlyExpense;
        document.getElementById('sumNet').innerText = `${net >= 0 ? '+' : ''}$${Math.round(net).toLocaleString()}`;
    }
}

function changeMonth(step) {
    currentViewDate.setMonth(currentViewDate.getMonth() + step);
    refreshUI();
}

/**
 * Snaps the calendar back to the current real-world month
 */
function jumpToToday() {
    currentViewDate = new Date();
    currentViewDate.setDate(1); // Ensure we start at the 1st
    refreshUI();
}

/**
 * Enhanced Day Modal logic to show a 'Today' highlight 
 * (Optional: Add this inside openDayModal in calendar.js for better UX)
 */
function openDayModal(dateKey, isLive) {
    const todayStr = new Date().toISOString().split('T')[0];
    const parts = dateKey.split('-');
    const { items } = getDayData(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), false);

    // Highlight if it's today
    const titlePrefix = (dateKey === todayStr) ? "⭐ Today - " : "";
    document.getElementById('dayModalDate').innerText = titlePrefix + dateKey;

    document.getElementById('dayItemList').innerHTML = items.map(it => `
        <div class="day-item">
            <div><strong>${it.name}</strong><br><small>$${it.amount.toLocaleString()}</small></div>
            ${isLive ? `<button class="status-pill ${it.isPaid ? 'status-paid' : 'status-pending'}" onclick="toggleFulfill('${dateKey}',${it.id})">${it.isPaid ? 'PAID' : 'MARK PAID'}</button>` : ''}
        </div>
    `).join('') || '<p style="text-align:center; color:var(--text-muted); padding:20px;">No transactions for this day.</p>';

    document.getElementById('dayModal').classList.add('active');
}

/**
 * Fulfillment toggle logic (Keep in calendar.js)
 */
function toggleFulfill(dateKey, id) {
    const k = `${dateKey}_${id}`;
    if (fulfilledMap[k]) delete fulfilledMap[k]; else fulfilledMap[k] = true;
    saveData(); // This calls the function in app.js
    refreshUI();
    openDayModal(dateKey, true); // Refresh modal view
}

function closeDayModal() {
    document.getElementById('dayModal').classList.remove('active');
}
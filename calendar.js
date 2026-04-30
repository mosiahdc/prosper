/**
 * CALENDAR.JS - OPTIMIZED VERSION
 * Performance improvements:
 * 1. Transaction indexing by frequency type
 * 2. Pre-parsed date objects (no repeated string parsing)
 * 3. Cached calculations for getDayData
 * 4. Reduced Date object creation
 */

// ============================================
// CACHE & INDEX MANAGEMENT
// ============================================


// Add this at the very top of calendar.js (after the file content begin)
console.log('📅 calendar.js loaded');

// Add this inside invalidateTransactionCache() function:
function invalidateTransactionCache() {
    transactionIndex = buildTransactionIndex();
    dayDataCache.clear();

    // Debug logging
    console.log('📊 Transaction cache rebuilt:', {
        transactions: transactions.length,
        dayDataCacheSize: dayDataCache.size,
        transactionIndex: transactionIndex ? 'built' : 'null'
    });
}



let transactionIndex = null;
let dayDataCache = new Map();

// Helper function to get date string in YYYY-MM-DD format (local time)
function getLocalDateString(date) {
    return date.getFullYear() + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0');
}

/**
 * Builds an optimized index of transactions grouped by frequency
 * This runs once when transactions change, not on every day lookup
 */
function buildTransactionIndex() {
    const index = {
        none: [],      // One-time transactions
        weekly: [],    // Weekly recurring
        biweekly: [],  // Bi-weekly recurring
        monthly: [],    // Monthly recurring
        quarterly: []
    };

    transactions.forEach(t => {
        // Pre-parse dates once and store as Date objects
        const dateParts = t.date.split('-');
        const startDate = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2])
        );
        startDate.setHours(0, 0, 0, 0);

        let endDate = null;
        if (t.endDate) {
            const endParts = t.endDate.split('-');
            endDate = new Date(
                parseInt(endParts[0]),
                parseInt(endParts[1]) - 1,
                parseInt(endParts[2])
            );
            endDate.setHours(23, 59, 59, 999);
        }

        // Store enhanced transaction object with parsed dates
        const indexedTransaction = {
            ...t,
            startDate,
            endDate,
            startDay: parseInt(dateParts[2]),      // For monthly matching
            startTimestamp: startDate.getTime()     // For quick comparisons
        };

        // Add to appropriate frequency bucket
        if (index[t.frequency]) {
            index[t.frequency].push(indexedTransaction);
        }
    });

    return index;
}

/**
 * Invalidates caches when transactions change
 * Call this after adding/editing/deleting transactions
 */
function invalidateTransactionCache() {
    transactionIndex = buildTransactionIndex();
    dayDataCache.clear();
    console.log('📊 Transaction cache rebuilt:', {
        none: transactionIndex.none.length,
        weekly: transactionIndex.weekly.length,
        biweekly: transactionIndex.biweekly.length,
        monthly: transactionIndex.monthly.length
    });
}

// ============================================
// OPTIMIZED DATE MATCHING
// ============================================

/**
 * Checks if a transaction matches a specific date
 * Uses pre-parsed date objects for faster comparison
 */
function doesTransactionMatch(transaction, currentDate, currentTimestamp) {
    // Skip if we're past the end date
    if (transaction.endDate && currentTimestamp > transaction.endDate.getTime()) {
        return false;
    }

    // Skip if we're before the start date
    if (currentTimestamp < transaction.startTimestamp) {
        return false;
    }

    const freq = transaction.frequency;

    // One-time: Simple date comparison
    if (freq === 'none') {
        // Compare with transaction.date (which is already in YYYY-MM-DD format)
        return transaction.date === getLocalDateString(currentDate);
    }

    // Monthly: Match day of month
    if (freq === 'monthly') {
        const daysInCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        const targetDay = Math.min(transaction.startDay, daysInCurrentMonth);
        return currentDate.getDate() === targetDay;
    }

    // Calculate days since start for recurring transactions
    const daysSinceStart = Math.round((currentTimestamp - transaction.startTimestamp) / 86400000);

    // Weekly: Every 7 days
    if (freq === 'weekly') {
        return daysSinceStart % 7 === 0;
    }

    // Bi-weekly: Every 14 days
    if (freq === 'biweekly') {
        return daysSinceStart % 14 === 0;
    }

    if (freq === 'quarterly') {
        const startMonth = transaction.startDate.getMonth();
        const startYear = transaction.startDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        const monthsDiff = (currentYear - startYear) * 12 + (currentMonth - startMonth);

        const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const targetDay = Math.min(transaction.startDay, daysInCurrentMonth);

        return monthsDiff >= 0 &&
            monthsDiff % 3 === 0 &&
            currentDate.getDate() === targetDay;
    }

    return false;
}

// ============================================
// OPTIMIZED getDayData
// ============================================

/**
 * Gets transaction data for a specific day with caching
 * This is called ~60-90 times per calendar render, so optimization is critical
 */
function getDayData(year, month, day, isLive) {
    // Build index on first call
    if (!transactionIndex) {
        invalidateTransactionCache();
    }

    // Create cache key
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cacheKey = `${dateKey}_${isLive}`;

    // Return cached result if available
    if (dayDataCache.has(cacheKey)) {
        return dayDataCache.get(cacheKey);
    }

    // Create date object once
    const currentDate = new Date(year, month, day);
    currentDate.setHours(0, 0, 0, 0);
    const currentTimestamp = currentDate.getTime();

    let net = 0;
    let items = [];

    // Check each frequency type's transactions
    // This is much faster than checking ALL transactions
    for (const frequency in transactionIndex) {
        const transactionList = transactionIndex[frequency];

        for (const t of transactionList) {
            if (doesTransactionMatch(t, currentDate, currentTimestamp)) {
                const isPaid = fulfilledMap[`${dateKey}_${t.id}`];
                const isSkipped = skippedMap[`${dateKey}_${t.id}`]; // Check if this occurrence is skipped
                const val = (t.type === 'income' ? t.amount : -t.amount);

                // Always add to items for display in modal
                items.push({ ...t, val, isPaid, isSkipped });

                // For net calculation: Live view ignores paid items, Review view ignores skipped items
                if (isLive) {
                    // Live view: include everything except paid items
                    if (!isPaid) {
                        net += val;
                    }
                } else {
                    // Review view: include everything except skipped items
                    if (!isSkipped) {
                        net += val;
                    }
                }
            }
        }
    }

    const result = { net, items, dateKey };

    // Cache the result
    dayDataCache.set(cacheKey, result);

    return result;
}

// ============================================
// OPTIMIZED BALANCE CALCULATION
// ============================================

/**
 * Calculates starting balance more efficiently
 * Reduces redundant Date object creation
 */
function calculateStartingBalance(totalVaults, viewMonthStart, today) {
    let startingBalance = totalVaults;

    if (viewMonthStart > today) {
        // Looking at the FUTURE: Add net changes from Today's date up to the Start of the View Month
        let tempDate = new Date(today);
        while (tempDate < viewMonthStart) {
            const { net } = getDayData(
                tempDate.getFullYear(),
                tempDate.getMonth(),
                tempDate.getDate(),
                true
            );
            startingBalance += net;
            tempDate.setDate(tempDate.getDate() + 1);
        }
    } else {
        // Looking at the PAST/PRESENT: Subtract transactions from month start UP TO (not including) today
        let tempDate = new Date(viewMonthStart);
        while (tempDate < today) {
            const { net } = getDayData(
                tempDate.getFullYear(),
                tempDate.getMonth(),
                tempDate.getDate(),
                true
            );
            startingBalance -= net;
            tempDate.setDate(tempDate.getDate() + 1);
        }
    }

    return startingBalance;
}

// ============================================
// UI REFRESH (with performance monitoring)
// ============================================

function refreshUI() {
    const perfStart = performance.now();

    const totalVaults = vaults.reduce((s, v) => s + v.balance, 0);
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();

    // Calculate starting balance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const viewMonthStart = new Date(year, month, 1);

    console.log('💰 Starting calculation:', {
        totalVaults,
        viewMonth: `${year}-${month + 1}`,
        today: getLocalDateString(today),
        viewMonthStart: getLocalDateString(viewMonthStart)
    });

    const startingBalance = calculateStartingBalance(totalVaults, viewMonthStart, today);

    console.log('💰 Starting balance for month:', startingBalance);

    let monthlyIncome = 0;
    let monthlyExpense = 0;
    const title = currentViewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Get today's date string in local time
    const todayStr = getLocalDateString(today);

    // Render both calendars
    ['live', 'review'].forEach(mode => {
        const isLive = mode === 'live';
        const tbody = document.getElementById(isLive ? 'liveCalBody' : 'reviewCalBody');
        if (!tbody) return;

        let runningTotal = totalVaults;

        // Always walk from the earliest known transaction month up to (not including)
        // the first day of the viewed month, so balances carry over correctly
        // across all months — past, present, and future.
        let earliest = new Date(viewMonthStart);
        transactions.forEach(t => {
            const parts = t.date.split('-');
            const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            if (d < earliest) earliest = d;
        });
        let tempDate = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
        while (tempDate < viewMonthStart) {
            const { net } = getDayData(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate(), isLive);
            runningTotal += net;
            tempDate.setDate(tempDate.getDate() + 1);
        }

        let html = '';
        let dayCounter = 1;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMo = new Date(year, month + 1, 0).getDate();

        // Prev month info for leading overflow days
        const prevYear = month === 0 ? year - 1 : year;
        const prevMonth = month === 0 ? 11 : month - 1;
        const daysInPrevMo = new Date(year, month, 0).getDate();

        // Next month info for trailing overflow days
        const nextYear = month === 11 ? year + 1 : year;
        const nextMonth = month === 11 ? 0 : month + 1;
        let nextMonthDay = 1;

        for (let i = 0; i < 6; i++) {
            let row = '<tr>';
            let weeklyChange = 0;
            let weeklyChangeThisMonth = 0; // only current month days, for runningTotal
            let overflowNet = 0; // net from overflow days only, for display total

            for (let j = 0; j < 7; j++) {
                if (i === 0 && j < firstDay) {
                    // Leading overflow: days from previous month 
                    const overflowDay = daysInPrevMo - (firstDay - 1 - j);
                    const { net, dateKey } = getDayData(prevYear, prevMonth, overflowDay, isLive);
                    const isToday = dateKey === todayStr;
                    weeklyChange += net; // include overflow in weekly +/- display
                    // Leading overflow already included in carry-over walk, don't add to overflowNet
                    row += `<td class="${isToday ? 'today-cell' : ''}" style="opacity:0.4;" onclick="openDayModal('${dateKey}', ${isLive})">
                            <span class="day-num">${overflowDay}</span><br>
                            ${net !== 0 ? `<span class="day-amount ${net > 0 ? 'amt-pos' : 'amt-neg'}">${Math.round(net)}</span>` : ''}
                        </td>`;
                } else if (dayCounter > daysInMo) {
                    // Trailing overflow: days from next month 
                    const { net, dateKey } = getDayData(nextYear, nextMonth, nextMonthDay, isLive);
                    const isToday = dateKey === todayStr;
                    weeklyChange += net; // include overflow in weekly +/- display
                    overflowNet += net;
                    row += `<td class="${isToday ? 'today-cell' : ''}" style="opacity:0.4;" onclick="openDayModal('${dateKey}', ${isLive})">
                            <span class="day-num">${nextMonthDay}</span><br>
                            ${net !== 0 ? `<span class="day-amount ${net > 0 ? 'amt-pos' : 'amt-neg'}">${Math.round(net)}</span>` : ''}
                        </td>`;
                    nextMonthDay++;
                } else {
                    const { net, items, dateKey } = getDayData(year, month, dayCounter, isLive);

                    // Calculate monthly totals only for live view
                    if (isLive) {
                        items.forEach(it => {
                            const isSkipped = skippedMap[`${dateKey}_${it.id}`];
                            if (!isSkipped) {
                                if (it.type === 'income') monthlyIncome += it.amount;
                                else monthlyExpense += it.amount;
                            }
                        });
                    }

                    weeklyChange += net;
                    weeklyChangeThisMonth += net;
                    const isToday = dateKey === todayStr;

                    row += `<td class="${isToday ? 'today-cell' : ''}" onclick="openDayModal('${dateKey}', ${isLive})">
                            <span class="day-num">${dayCounter}</span><br>
                            ${net !== 0 ? `<span class="day-amount ${net > 0 ? 'amt-pos' : 'amt-neg'}">${Math.round(net)}</span>` : ''}
                        </td>`;
                    dayCounter++;
                }
            }

            runningTotal += weeklyChangeThisMonth; // only current month days keep running total accurate
            const displayTotal = runningTotal + overflowNet; // show actual balance after overflow days too
            row += `<td style="text-align:center">${Math.round(weeklyChange)}</td><td class="col-total">₱${Math.round(displayTotal).toLocaleString()}</td></tr>`;
            html += row;

            if (dayCounter > daysInMo) break;
        }

        tbody.innerHTML = html;
    });

    // Update summary badges
    const suffix = ['', 'Review'];
    suffix.forEach(s => {
        const incomeEl = document.getElementById(`sumIncome${s}`);
        const expenseEl = document.getElementById(`sumExpense${s}`);
        const netEl = document.getElementById(`sumNet${s}`);
        const titleEl = document.getElementById(`monthTitle${s === '' ? 'Live' : 'Review'}`);

        if (titleEl) titleEl.innerText = title;
        if (incomeEl) incomeEl.innerText = `₱${Math.round(monthlyIncome).toLocaleString()}`;
        if (expenseEl) expenseEl.innerText = `₱${Math.round(monthlyExpense).toLocaleString()}`;
        if (netEl) {
            const netValue = monthlyIncome - monthlyExpense;
            netEl.innerText = `${netValue >= 0 ? '+' : ''}₱${Math.round(netValue).toLocaleString()}`;
        }
    });

    renderUpcomingSidebar();

    const perfEnd = performance.now();
    console.log(`⚡ refreshUI took ${(perfEnd - perfStart).toFixed(2)}ms`);
}

// ============================================
// MONTH NAVIGATION
// ============================================

function changeMonth(step) {
    currentViewDate.setMonth(currentViewDate.getMonth() + step);
    dayDataCache.clear(); // Clear cache when changing months
    refreshUI();
}

function jumpToToday() {
    currentViewDate = new Date();
    currentViewDate.setDate(1);
    dayDataCache.clear(); // Clear cache when jumping to today
    refreshUI();
}

// ============================================
// DAY MODAL (with skip option for recurring transactions)
// ============================================

function openDayModal(dateKey, isLive) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = getLocalDateString(today);

    const parts = dateKey.split('-');

    // Always fetch all items (isLive = false) to show complete list
    const { items } = getDayData(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), false);

    const titlePrefix = (dateKey === todayStr) ? "⭐ Today - " : "";
    document.getElementById('dayModalDate').innerText = titlePrefix + dateKey;

    // Add "+ Add Transaction" button to modal header
    const addBtnContainer = document.getElementById('dayModalAddBtn');
    if (addBtnContainer) {
        addBtnContainer.onclick = () => {
            closeDayModal();
            openTransFromCalendar(dateKey);
        };
    }

    document.getElementById('dayItemList').innerHTML = items.map(it => {
        const statusText = it.isPaid ? 'PAID' : 'MARK PAID';
        const statusClass = it.isPaid ? 'status-paid' : 'status-pending';
        const isSkipped = it.isSkipped;
        const isRecurring = it.frequency !== 'none';

        // Determine what buttons to show
        let actionButtons = '';

        if (isLive) {
            // Live View: Show edit + mark paid/unpaid button
            actionButtons = `
                <div style="display: flex; gap: 5px; align-items: center;">
                    <button class="btn-ghost"
                            onclick="openEditRecurringModal(${it.id}, '${dateKey}')"
                            title="Edit this transaction"
                            style="font-size: 0.65rem; padding: 6px 8px; color: var(--primary);">
                        ✏️
                    </button>
                    <button class="status-pill ${statusClass}" 
                            onclick="toggleFulfill('${dateKey}', ${it.id})">
                        ${statusText}
                    </button>
                </div>`;
        } else {
            // Review View: Show different options based on transaction type
            if (isRecurring) {
                // For recurring transactions: show skip/unskip option
                const skipButtonText = isSkipped ? 'INCLUDE' : 'SKIP';
                const skipButtonClass = isSkipped ? 'status-paid' : 'status-pending';
                const skipButtonTitle = isSkipped ? 'Include this occurrence in forecast' : 'Skip only this occurrence in forecast';

                actionButtons = `
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <button class="btn-ghost"
                                onclick="openEditRecurringModal(${it.id}, '${dateKey}')"
                                title="Edit this recurring transaction"
                                style="font-size: 0.65rem; padding: 6px 8px; color: var(--primary);">
                            ✏️
                        </button>
                        <button class="status-pill ${skipButtonClass}" 
                                onclick="toggleSkipOccurrence('${dateKey}', ${it.id})"
                                title="${skipButtonTitle}"
                                style="font-size: 0.65rem; min-width: 70px;">
                            ${skipButtonText}
                        </button>
                        <button class="btn-ghost" 
                                onclick="deleteRecurringTransaction(${it.id})"
                                style="color: var(--danger); font-size: 0.65rem; padding: 6px 8px;"
                                title="Delete ALL future occurrences">
                            ✕
                        </button>
                    </div>`;
            } else {
                // For one-time transactions: show edit + delete button
                actionButtons = `
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <button class="btn-ghost"
                                onclick="openEditRecurringModal(${it.id}, '${dateKey}')"
                                title="Edit this transaction"
                                style="font-size: 0.65rem; padding: 6px 8px; color: var(--primary);">
                            ✏️
                        </button>
                        <button class="btn-ghost" 
                                onclick="deleteTransactionFromModal(${it.id}, '${dateKey}')"
                                style="color: var(--danger); font-size: 0.7rem; padding: 4px 8px;">
                            ✕ Delete
                        </button>
                    </div>`;
            }
        }

        // Apply strike-through style if skipped or paid
        const textStyle = isSkipped || it.isPaid ? 'text-decoration: line-through; color: var(--text-muted); opacity: 0.7;' : '';

        // Get frequency display name
        const frequencyMap = {
            'none': 'One-time',
            'weekly': 'Weekly',
            'biweekly': 'Bi-weekly',
            'monthly': 'Monthly',
            'quarterly': 'Quarterly'
        };

        // Get category display
        const categoryDisplay = it.category ? `Category: ${it.category.charAt(0).toUpperCase() + it.category.slice(1)}` : '';

        return `
            <div class="day-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border);">
                <div>
                    <div style="${textStyle}">
                        <strong>${it.name}</strong>
                        ${isSkipped ? ' <span style="color: var(--danger); font-size: 0.7rem;">(SKIPPED)</span>' : ''}
                        ${it.isPaid ? ' <span style="color: var(--success); font-size: 0.7rem;">(PAID)</span>' : ''}
                    </div>
                    <small>₱${it.amount.toLocaleString()}</small>
                    <br><small style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">
                        ${frequencyMap[it.frequency] || it.frequency} ${it.type}
                        ${isRecurring ? ' (Recurring)' : ''}
                        ${categoryDisplay ? `<br>${categoryDisplay}` : ''}
                    </small>
                </div>
                ${actionButtons}
            </div>
        `;
    }).join('') || '<p style="text-align:center; color:var(--text-muted); padding:20px;">No transactions for this day.</p>';

    document.getElementById('dayModal').classList.add('active');
}

function toggleFulfill(dateKey, id) {
    const k = `${dateKey}_${id}`;
    if (fulfilledMap[k]) delete fulfilledMap[k];
    else fulfilledMap[k] = true;

    saveData();
    dayDataCache.clear();
    invalidateTransactionCache(); // Force recalculation
    refreshUI();
    openDayModal(dateKey, true);
}

function closeDayModal() {
    document.getElementById('dayModal').classList.remove('active');
}

// Open transaction modal from calendar with date pre-filled
function openTransFromCalendar(dateKey) {
    document.getElementById('transForm').reset();
    document.getElementById('tEditId').value = '';
    document.getElementById('tDate').value = dateKey;
    document.getElementById('tCategory').value = '';
    document.getElementById('transModal').classList.add('active');
    setTimeout(() => document.getElementById('tName').focus(), 100);
}

// NEW FUNCTION: Toggle skip for a specific occurrence
function toggleSkipOccurrence(dateKey, transactionId) {
    const k = `${dateKey}_${transactionId}`;
    if (skippedMap[k]) {
        delete skippedMap[k];
    } else {
        skippedMap[k] = true;
    }

    saveData();
    dayDataCache.clear();
    invalidateTransactionCache();
    refreshUI();

    // Re-open the modal to show updated state
    const isLive = false; // Review Page
    openDayModal(dateKey, isLive);

    console.log(`↪️ Toggled skip for transaction ${transactionId} on ${dateKey}: ${skippedMap[k] ? 'Skipped' : 'Included'}`);
}

// NEW FUNCTION: Delete only the entire recurring transaction
function deleteRecurringTransaction(transactionId) {
    // Find the transaction to get its frequency
    const transactionToDelete = transactions.find(t => t.id === transactionId);
    if (!transactionToDelete) return;

    const frequencyMap = {
        'weekly': 'weekly',
        'biweekly': 'bi-weekly',
        'monthly': 'monthly',
        'quarterly': 'quarterly'
    };

    if (!confirm(`⚠️ WARNING: This is a ${frequencyMap[transactionToDelete.frequency]} recurring transaction.\n\nDeleting it will remove ALL future occurrences.\n\nDo you want to continue?`)) {
        return;
    }

    // Remove the transaction
    transactions = transactions.filter(t => t.id !== transactionId);

    // Also remove any fulfillment and skip records for this transaction
    Object.keys(fulfilledMap).forEach(key => {
        if (key.endsWith(`_${transactionId}`)) {
            delete fulfilledMap[key];
        }
    });

    Object.keys(skippedMap).forEach(key => {
        if (key.endsWith(`_${transactionId}`)) {
            delete skippedMap[key];
        }
    });

    saveData();
    dayDataCache.clear();
    invalidateTransactionCache();
    refreshUI();
    renderTransactions(); // Refresh the transaction list
    closeDayModal();

    console.log(`🗑️ Deleted recurring transaction: ${transactionToDelete.name} (ID: ${transactionId})`);
}

// FUNCTION: Delete one-time transaction (unchanged but keeping for clarity)
function deleteTransactionFromModal(transactionId, dateKey) {
    if (!confirm("Are you sure you want to delete this transaction?")) {
        return;
    }

    // Find the transaction
    const transactionToDelete = transactions.find(t => t.id === transactionId);
    if (!transactionToDelete) return;

    // Remove the transaction
    transactions = transactions.filter(t => t.id !== transactionId);

    // Also remove any fulfillment records for this transaction
    Object.keys(fulfilledMap).forEach(key => {
        if (key.endsWith(`_${transactionId}`)) {
            delete fulfilledMap[key];
        }
    });

    saveData();
    dayDataCache.clear();
    invalidateTransactionCache();
    refreshUI();
    renderTransactions(); // Refresh the transaction list
    closeDayModal();

    console.log(`🗑️ Deleted transaction: ${transactionToDelete.name} (ID: ${transactionId})`);
}

// ============================================
// EDIT RECURRING TRANSACTION FROM CALENDAR
// ============================================

/**
 * Opens a compact edit modal for any transaction from the calendar day modal.
 * Lets the user update the name, amount, and (for recurring) the monthly value.
 */
function openEditRecurringModal(transactionId, dateKey) {
    const t = transactions.find(x => x.id === transactionId);
    if (!t) return;

    // Remove existing modal if present
    const existing = document.getElementById('editRecurringModal');
    if (existing) existing.remove();

    const isRecurring = t.frequency !== 'none';
    const frequencyMap = {
        'none': 'One-time',
        'weekly': 'Weekly',
        'biweekly': 'Bi-weekly',
        'monthly': 'Monthly',
        'quarterly': 'Quarterly'
    };
    const freqLabel = frequencyMap[t.frequency] || t.frequency;

    const modal = document.createElement('div');
    modal.id = 'editRecurringModal';
    modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center;
        z-index: 10000; padding: 1rem;
    `;

    modal.innerHTML = `
        <div style="
            background: var(--surface, #fff);
            border-radius: 16px;
            padding: 1.5rem;
            width: 100%;
            max-width: 380px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                <div>
                    <h3 style="margin: 0; font-size: 1rem; font-weight: 700;">Edit Transaction</h3>
                    <div style="font-size: 0.7rem; color: var(--text-muted, #888); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${freqLabel} · ${t.type}
                        ${isRecurring ? ' · <strong style="color: var(--primary);">Recurring</strong>' : ''}
                    </div>
                </div>
                <button onclick="closeEditRecurringModal()" style="
                    background: none; border: none; cursor: pointer;
                    font-size: 1.2rem; color: var(--text-muted, #888); padding: 4px;
                ">✕</button>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                <div>
                    <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted, #888); display: block; margin-bottom: 4px;">
                        NAME
                    </label>
                    <input id="editRecName" type="text" value="${t.name}"
                        style="
                            width: 100%; box-sizing: border-box;
                            padding: 0.6rem 0.75rem;
                            border: 1.5px solid var(--border, #e0e0e0);
                            border-radius: 10px; font-size: 0.95rem;
                            background: var(--bg, #f9f9f9);
                            color: var(--text-main, #222);
                            outline: none;
                        " />
                </div>

                <div>
                    <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted, #888); display: block; margin-bottom: 4px;">
                        AMOUNT (₱)${isRecurring ? ' — updates all future occurrences' : ''}
                    </label>
                    <input id="editRecAmount" type="number" min="0" step="0.01" value="${t.amount}"
                        style="
                            width: 100%; box-sizing: border-box;
                            padding: 0.6rem 0.75rem;
                            border: 1.5px solid var(--border, #e0e0e0);
                            border-radius: 10px; font-size: 1.1rem; font-weight: 700;
                            background: var(--bg, #f9f9f9);
                            color: var(--text-main, #222);
                            outline: none;
                        " />
                </div>

                <div>
                    <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted, #888); display: block; margin-bottom: 4px;">
                        TYPE
                    </label>
                    <select id="editRecType" style="
                        width: 100%; box-sizing: border-box;
                        padding: 0.6rem 0.75rem;
                        border: 1.5px solid var(--border, #e0e0e0);
                        border-radius: 10px; font-size: 0.9rem;
                        background: var(--bg, #f9f9f9);
                        color: var(--text-main, #222);
                        outline: none;
                    ">
                        <option value="expense" ${t.type === 'expense' ? 'selected' : ''}>Expense</option>
                        <option value="income" ${t.type === 'income' ? 'selected' : ''}>Income</option>
                    </select>
                </div>

                ${isRecurring ? `
                <div style="
                    background: var(--primary-light, #eff6ff);
                    border-radius: 10px; padding: 0.65rem 0.85rem;
                    font-size: 0.75rem; color: var(--primary, #3b82f6);
                    border: 1px solid var(--primary-border, #bfdbfe);
                ">
                    ℹ️ This will update the <strong>${freqLabel.toLowerCase()}</strong> amount going forward across all calendar months.
                </div>` : ''}

                <div style="display: flex; gap: 0.75rem; margin-top: 0.25rem;">
                    <button onclick="closeEditRecurringModal()" style="
                        flex: 1; padding: 0.65rem;
                        border: 1.5px solid var(--border, #e0e0e0);
                        border-radius: 10px; background: none;
                        cursor: pointer; font-size: 0.9rem;
                        color: var(--text-muted, #888);
                    ">Cancel</button>
                    <button onclick="saveEditRecurring(${transactionId}, '${dateKey}')" style="
                        flex: 2; padding: 0.65rem;
                        border: none; border-radius: 10px;
                        background: var(--primary, #3b82f6);
                        color: #fff; cursor: pointer;
                        font-size: 0.9rem; font-weight: 700;
                    ">Save Changes</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus the amount field for quick edits
    setTimeout(() => {
        const amtInput = document.getElementById('editRecAmount');
        if (amtInput) { amtInput.focus(); amtInput.select(); }
    }, 80);
}

function closeEditRecurringModal() {
    const modal = document.getElementById('editRecurringModal');
    if (modal) modal.remove();
}

/**
 * Saves the edited transaction values (name, amount, type) and refreshes the calendar.
 */
function saveEditRecurring(transactionId, dateKey) {
    const t = transactions.find(x => x.id === transactionId);
    if (!t) return;

    const newName = (document.getElementById('editRecName')?.value || '').trim();
    const newAmount = parseFloat(document.getElementById('editRecAmount')?.value);
    const newType = document.getElementById('editRecType')?.value;

    if (!newName) {
        alert('Please enter a name for the transaction.');
        return;
    }
    if (isNaN(newAmount) || newAmount < 0) {
        alert('Please enter a valid amount.');
        return;
    }

    // Apply changes to the transaction
    t.name = newName;
    t.amount = newAmount;
    t.type = newType;

    saveData();
    invalidateTransactionCache();
    refreshUI();
    renderTransactions();

    closeEditRecurringModal();

    // Re-open the day modal so user can see the updated value
    const parts = dateKey.split('-');
    const isLive = document.getElementById('liveCalBody') !== null;
    openDayModal(dateKey, isLive);

    console.log(`✏️ Updated transaction: "${t.name}" — ₱${t.amount} (${t.frequency})`);
}



function renderUpcomingSidebar() {
    const listContainer = document.getElementById('upcomingList');
    if (!listContainer) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const OVERDUE_DAYS = 90;
    const UPCOMING_DAYS = 5;
    let overdue = [];
    let upcoming = [];

    if (!transactionIndex) invalidateTransactionCache();

    // --- OVERDUE: scan backwards, bypass cache, read fulfilledMap directly ---
    for (let i = 1; i <= OVERDUE_DAYS; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        checkDate.setHours(0, 0, 0, 0);
        const checkTimestamp = checkDate.getTime();
        const dateKey = getLocalDateString(checkDate);

        for (const frequency in transactionIndex) {
            for (const t of transactionIndex[frequency]) {
                if (doesTransactionMatch(t, checkDate, checkTimestamp)) {
                    const isPaid = !!fulfilledMap[`${dateKey}_${t.id}`];
                    const isSkipped = !!skippedMap[`${dateKey}_${t.id}`];
                    if (!isPaid && !isSkipped) {
                        overdue.push({ ...t, dueDate: dateKey, isOverdue: true, isPaid, isSkipped });
                    }
                }
            }
        }
    }
    overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    // --- UPCOMING: today + next 5 days ---
    for (let i = 0; i <= UPCOMING_DAYS; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        checkDate.setHours(0, 0, 0, 0);
        const checkTimestamp = checkDate.getTime();
        const dateKey = getLocalDateString(checkDate);

        for (const frequency in transactionIndex) {
            for (const t of transactionIndex[frequency]) {
                if (doesTransactionMatch(t, checkDate, checkTimestamp)) {
                    const isPaid = !!fulfilledMap[`${dateKey}_${t.id}`];
                    const isSkipped = !!skippedMap[`${dateKey}_${t.id}`];
                    if (!isPaid && !isSkipped) {
                        upcoming.push({ ...t, dueDate: dateKey, isOverdue: false, isPaid, isSkipped });
                    }
                }
            }
        }
    }

    const frequencyMap = {
        'none': 'One-time',
        'weekly': 'Weekly',
        'biweekly': 'Bi-weekly',
        'monthly': 'Monthly',
        'quarterly': 'Quarterly'
    };

    // Update sidebar title
    const sidebarTitle = document.querySelector('#upcomingSidebar h3');
    if (sidebarTitle) sidebarTitle.textContent = 'Dues & Overdue';

    if (overdue.length === 0 && upcoming.length === 0) {
        listContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem; text-align: center; border: 1px dashed var(--border); border-radius: 8px;">All clear! No upcoming dues.</div>`;
        return;
    }

    let html = '';

    if (overdue.length > 0) {
        html += `<div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--danger); padding: 6px 4px 4px; letter-spacing: 0.5px;">⚠️ Overdue (${overdue.length})</div>`;
        html += overdue.map(item => renderSidebarItem(item, frequencyMap)).join('');
    }

    if (upcoming.length > 0) {
        html += `<div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--primary); padding: 6px 4px 4px; letter-spacing: 0.5px;">📅 Due Soon (${upcoming.length})</div>`;
        html += upcoming.map(item => renderSidebarItem(item, frequencyMap)).join('');
    }

    listContainer.innerHTML = html;
}

function renderSidebarItem(item, frequencyMap) {
    const borderColor = item.isOverdue ? 'var(--danger)' : (item.type === 'income' ? 'var(--success)' : 'var(--primary)');
    const bgColor = item.isOverdue ? '#fff5f5' : 'white';
    return `
        <div class="card" style="padding: 12px; margin-bottom: 0; border-left: 4px solid ${borderColor}; background: ${bgColor};">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <div style="font-weight: 700; font-size: 0.9rem;">${item.name}</div>
                    <div style="font-size: 0.75rem; color: ${item.isOverdue ? 'var(--danger)' : 'var(--text-muted)'}; font-weight: ${item.isOverdue ? '600' : '400'};">
                        ${item.dueDate}${item.isOverdue ? ' · OVERDUE' : ''}
                    </div>
                    <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">
                        ${frequencyMap[item.frequency] || item.frequency}
                        ${item.category ? ` • ${item.category.charAt(0).toUpperCase() + item.category.slice(1)}` : ''}
                    </div>
                </div>
                <div style="font-weight: 800; color: ${item.type === 'income' ? 'var(--success)' : 'var(--text-main)'};">
                    ₱${item.amount.toLocaleString()}
                </div>
            </div>
            <button class="status-pill status-pending" style="width: 100%; margin-top: 10px; font-size: 0.6rem; padding: 4px;"
                onclick="toggleFulfill('${item.dueDate}', ${item.id})">
                Mark Paid
            </button>
        </div>
    `;
}
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

let transactionIndex = null;
let dayDataCache = new Map();

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
        // Get YYYY-MM-DD in local timezone (not UTC)
        const currentDateStr = currentDate.getFullYear() + '-' +
            String(currentDate.getMonth() + 1).padStart(2, '0') + '-' +
            String(currentDate.getDate()).padStart(2, '0');

        // Compare with transaction.date (which is already in YYYY-MM-DD format)
        return transaction.date === currentDateStr;
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
        today: today.toISOString().split('T')[0],
        viewMonthStart: viewMonthStart.toISOString().split('T')[0]
    });

    const startingBalance = calculateStartingBalance(totalVaults, viewMonthStart, today);

    console.log('💰 Starting balance for month:', startingBalance);

    let monthlyIncome = 0;
    let monthlyExpense = 0;
    const title = currentViewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Get today's date string once
    const todayStr = today.toISOString().split('T')[0];

    // Render both calendars
    ['live', 'review'].forEach(mode => {
        const isLive = mode === 'live';
        const tbody = document.getElementById(isLive ? 'liveCalBody' : 'reviewCalBody');
        if (!tbody) return;

        let runningTotal = totalVaults;

        // Add net from today until start of this month
        if (viewMonthStart > today) {
            let tempDate = new Date(today);
            while (tempDate < viewMonthStart) {
                const { net } = getDayData(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate(), isLive);
                runningTotal += net;
                tempDate.setDate(tempDate.getDate() + 1);
            }
        }

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

                    // Calculate monthly totals only for live view
                    if (isLive) {
                        items.forEach(it => {
                            // Only count items that are not skipped for monthly totals
                            const isSkipped = skippedMap[`${dateKey}_${it.id}`];
                            if (!isSkipped) {
                                if (it.type === 'income') monthlyIncome += it.amount;
                                else monthlyExpense += it.amount;
                            }
                        });
                    }

                    weeklyChange += net;
                    const isToday = dateKey === todayStr;

                    row += `
                        <td class="${isToday ? 'today-cell' : ''}" onclick="openDayModal('${dateKey}', ${isLive})">
                            <span class="day-num">${dayCounter}</span><br>
                            ${net !== 0 ? `<span class="day-amount ${net > 0 ? 'amt-pos' : 'amt-neg'}">${Math.round(net)}</span>` : ''}
                        </td>`;
                    dayCounter++;
                }
            }

            runningTotal += weeklyChange;
            row += `<td style="text-align:center">${Math.round(weeklyChange)}</td><td class="col-total">₱${Math.round(runningTotal).toLocaleString()}</td></tr>`;
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
    const todayStr = new Date().toISOString().split('T')[0];
    const parts = dateKey.split('-');

    // Always fetch all items (isLive = false) to show complete list
    const { items } = getDayData(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), false);

    const titlePrefix = (dateKey === todayStr) ? "⭐ Today - " : "";
    document.getElementById('dayModalDate').innerText = titlePrefix + dateKey;

    document.getElementById('dayItemList').innerHTML = items.map(it => {
        const statusText = it.isPaid ? 'PAID' : 'MARK PAID';
        const statusClass = it.isPaid ? 'status-paid' : 'status-pending';
        const isSkipped = it.isSkipped;
        const isRecurring = it.frequency !== 'none';

        // Determine what buttons to show
        let actionButtons = '';
        
        if (isLive) {
            // Live View: Show mark paid/unpaid button
            actionButtons = `
                <button class="status-pill ${statusClass}" 
                        onclick="toggleFulfill('${dateKey}', ${it.id})">
                    ${statusText}
                </button>`;
        } else {
            // Review View: Show different options based on transaction type
            if (isRecurring) {
                // For recurring transactions: show skip/unskip option
                const skipButtonText = isSkipped ? 'INCLUDE' : 'SKIP';
                const skipButtonClass = isSkipped ? 'status-paid' : 'status-pending';
                const skipButtonTitle = isSkipped ? 'Include this occurrence in forecast' : 'Skip only this occurrence in forecast';
                
                actionButtons = `
                    <div style="display: flex; gap: 5px;">
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
                // For one-time transactions: show delete button
                actionButtons = `
                    <button class="btn-ghost" 
                            onclick="deleteTransactionFromModal(${it.id}, '${dateKey}')"
                            style="color: var(--danger); font-size: 0.7rem; padding: 4px 8px;">
                        ✕ Delete
                    </button>`;
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
// UPCOMING SIDEBAR (optimized)
// ============================================

function renderUpcomingSidebar() {
    const listContainer = document.getElementById('upcomingList');
    if (!listContainer) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const UPCOMING_DAYS = 5;
    let upcoming = [];

    // Check only the next 5 days
    for (let i = 0; i <= UPCOMING_DAYS; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);

        const { items, dateKey } = getDayData(
            checkDate.getFullYear(),
            checkDate.getMonth(),
            checkDate.getDate(),
            false
        );

        // Add unpaid and non-skipped items to upcoming list
        items.forEach(item => {
            if (!item.isPaid && !item.isSkipped) {
                upcoming.push({ ...item, dueDate: dateKey });
            }
        });
    }

    if (upcoming.length === 0) {
        listContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem; text-align: center; border: 1px dashed var(--border); border-radius: 8px;">All clear! No upcoming dues.</div>`;
        return;
    }

    // Get frequency display names
    const frequencyMap = {
        'none': 'One-time',
        'weekly': 'Weekly',
        'biweekly': 'Bi-weekly',
        'monthly': 'Monthly',
        'quarterly': 'Quarterly'
    };

    listContainer.innerHTML = upcoming.map(item => `
        <div class="card" style="padding: 12px; margin-bottom: 0; border-left: 4px solid ${item.type === 'income' ? 'var(--success)' : 'var(--primary)'};">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <div style="font-weight: 700; font-size: 0.9rem;">${item.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${item.dueDate}</div>
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
    `).join('');
}
/**
 * TRANSACTIONS.JS - Updated to work with optimized calendar.js
 * Now with category grouping (collapsed by default)
 */
let transFilter = 'active';
let categoryCollapsedState = JSON.parse(localStorage.getItem('categoryCollapsedState')) || {}; // Track collapsed state of categories

// Available categories (can be extended)
const transactionCategories = [
    'bills',
    'food',
    'transportation',
    'entertainment',
    'shopping',
    'healthcare',
    'education',
    'loan',
    'obligation',
    'income',
    'other'
];

function filterTrans(type) {
    transFilter = type;
    document.getElementById('tab-active').classList.toggle('active', type === 'active');
    document.getElementById('tab-completed').classList.toggle('active', type === 'completed');
    renderTransactions();
}

function renderTransactions() {
    const todayStr = new Date().toISOString().split('T')[0];
    const container = document.getElementById('transactionList');
    const searchTerm = document.getElementById('transSearch').value.toLowerCase();

    // 1. Updated Filter Logic to handle Active vs Completed
    let filtered = transactions.filter(t => {
        // A transaction is "Finished" if:
        // - It's One-time and the date is in the past
        // - OR it has an End Date and that end date is in the past
        // - OR it's One-time and has been marked as paid (regardless of date)
        const isOneTimePast = (t.frequency === 'none' && t.date < todayStr);
        const isExpired = (t.endDate && t.endDate < todayStr);

        // Check if this one-time transaction is marked as paid
        const isPaid = (t.frequency === 'none' && fulfilledMap[`${t.date}_${t.id}`]);

        const isFinished = isOneTimePast || isExpired || isPaid;

        return transFilter === 'active' ? !isFinished : isFinished;
    });

    // 2. Filter by Search Term
    if (searchTerm) {
        filtered = filtered.filter(t =>
            t.name.toLowerCase().includes(searchTerm) ||
            t.amount.toString().includes(searchTerm) ||
            t.frequency.toLowerCase().includes(searchTerm) ||
            t.date.includes(searchTerm) ||
            (t.category && t.category.toLowerCase().includes(searchTerm))
        );
    }

    // Count active and completed transactions for the badges
    const activeCount = transactions.filter(t => {
        const isOneTimePast = (t.frequency === 'none' && t.date < todayStr);
        const isExpired = (t.endDate && t.endDate < todayStr);
        const isPaid = (t.frequency === 'none' && fulfilledMap[`${t.date}_${t.id}`]);
        const isFinished = isOneTimePast || isExpired || isPaid;
        return !isFinished;
    }).length;

    const completedCount = transactions.filter(t => {
        const isOneTimePast = (t.frequency === 'none' && t.date < todayStr);
        const isExpired = (t.endDate && t.endDate < todayStr);
        const isPaid = (t.frequency === 'none' && fulfilledMap[`${t.date}_${t.id}`]);
        const isFinished = isOneTimePast || isExpired || isPaid;
        return isFinished;
    }).length;

    // Update badge counts
    const activeCountEl = document.getElementById('activeCount');
    const completedCountEl = document.getElementById('completedCount');
    if (activeCountEl) activeCountEl.textContent = activeCount;
    if (completedCountEl) completedCountEl.textContent = completedCount;

    // 3. Group by category
    const groupedByCategory = {};
    filtered.forEach(t => {
        const category = t.category || 'uncategorized';
        if (!groupedByCategory[category]) {
            groupedByCategory[category] = [];
        }
        groupedByCategory[category].push(t);
    });

    // 4. Sort categories alphabetically (put 'uncategorized' last)
    const sortedCategories = Object.keys(groupedByCategory).sort((a, b) => {
        if (a === 'uncategorized') return 1;
        if (b === 'uncategorized') return -1;
        return a.localeCompare(b);
    });

    // Update summary
    const summaryEl = document.getElementById('transactionSummary');
    if (summaryEl) {
        const totalTransactions = filtered.length;
        const totalCategories = sortedCategories.length;
        summaryEl.textContent = `${totalTransactions} transactions in ${totalCategories} categories`;
    }

    if (sortedCategories.length === 0) {
        container.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">No transactions found.</td></tr>`;
        return;
    }

    let html = '';

    sortedCategories.forEach(category => {
        const categoryTransactions = groupedByCategory[category];

        // Set category as collapsed by default if not already set
        if (categoryCollapsedState[category] === undefined) {
            categoryCollapsedState[category] = true; // Collapsed by default
            saveCategoryCollapsedState();
        }

        const isCollapsed = categoryCollapsedState[category];
        const categoryTotal = categoryTransactions.reduce((sum, t) => {
            const val = t.type === 'income' ? t.amount : -t.amount;
            return sum + val;
        }, 0);
        const categoryIncome = categoryTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        const categoryExpense = categoryTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        // Get category display name
        const categoryDisplay = category === 'uncategorized' ? 'Uncategorized' :
            category.charAt(0).toUpperCase() + category.slice(1);

        // Get category icon
        const categoryIcon = getCategoryIcon(category);

        html += `
            <tr style="background: #f8fafc; border-bottom: 2px solid var(--border);" class="category-header">
                <td colspan="5" style="padding: 12px 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" 
                         onclick="toggleCategoryCollapse('${category}')">
                        <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                            <span style="font-size: 1.2rem; color: var(--text-muted);">
                                ${categoryIcon}
                            </span>
                            <div style="display: flex; flex-direction: column; flex: 1;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">
                                        ${categoryDisplay}
                                    </span>
                                    <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">
                                        ${categoryTransactions.length} item${categoryTransactions.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div style="display: flex; gap: 15px; margin-top: 5px;">
                                    <span style="font-size: 0.75rem; color: var(--success);">
                                        ₱${categoryIncome.toLocaleString()} income
                                    </span>
                                    <span style="font-size: 0.75rem; color: var(--danger);">
                                        ₱${categoryExpense.toLocaleString()} expense
                                    </span>
                                    <span style="font-size: 0.75rem; color: ${categoryTotal >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">
                                        Net: ₱${Math.abs(categoryTotal).toLocaleString()} ${categoryTotal >= 0 ? 'gain' : 'loss'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px; margin-left: 10px;">
                            <span style="font-size: 0.9rem; color: var(--text-muted); transition: transform 0.2s; ${isCollapsed ? '' : 'transform: rotate(180deg);'}">
                                ▲
                            </span>
                        </div>
                    </div>
                </td>
            </tr>
        `;

        // Only show transactions if category is not collapsed
        if (!isCollapsed) {
            categoryTransactions.forEach(t => {
                // Determine if this transaction is marked as paid
                const isPaid = t.frequency === 'none' ? fulfilledMap[`${t.date}_${t.id}`] : false;
                const isPast = t.date < todayStr;

                // Style for completed/paid transactions
                const rowStyle = isPaid ? 'style="opacity: 0.7; background-color: #f9fafb;"' : '';

                // Get frequency display
                const frequencyMap = {
                    'none': 'One-time',
                    'weekly': 'Weekly',
                    'biweekly': 'Bi-weekly',
                    'monthly': 'Monthly',
                    'quarterly': 'Quarterly'
                };

                // Get transaction status
                let statusBadge = '';
                if (isPaid) {
                    statusBadge = '<span style="color: var(--success); font-size: 0.7rem; background: #dcfce7; padding: 2px 8px; border-radius: 10px; margin-left: 5px;">PAID</span>';
                } else if (isPast && t.frequency === 'none') {
                    statusBadge = '<span style="color: var(--danger); font-size: 0.7rem; background: #fee2e2; padding: 2px 8px; border-radius: 10px; margin-left: 5px;">OVERDUE</span>';
                }

                html += `
                <tr class="transaction-row" ${rowStyle}>
                    <td style="padding: 12px 15px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 4px; height: 36px; background: ${t.type === 'income' ? 'var(--success)' : 'var(--primary)'}; border-radius: 2px;"></div>
                            <div style="flex: 1;">
                                <div style="font-weight: 700; display: flex; align-items: center; font-size: 0.9rem;">
                                    ${t.name}
                                    ${statusBadge}
                                </div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                                    <span style="background: ${t.type === 'income' ? '#dcfce7' : '#e0f2fe'}; color: ${t.type === 'income' ? '#166534' : '#0369a1'}; padding: 2px 6px; border-radius: 4px; margin-right: 6px;">
                                        ${frequencyMap[t.frequency] || t.frequency}
                                    </span>
                                    ${t.endDate ? `Until ${t.endDate}` : ''}
                                </div>
                            </div>
                        </div>
                    </td>
                    <td style="font-weight: 800; color: ${t.type === 'income' ? 'var(--success)' : 'var(--text-main)'}; font-size: 0.9rem;">
                        ₱${t.amount.toLocaleString()}
                    </td>
                    <td style="font-size: 0.85rem; color: var(--text-main);">
                        ${t.date}
                    </td>
                    <td style="font-size: 0.8rem; color: ${t.type === 'income' ? 'var(--success)' : 'var(--primary)'}; font-weight: 600;">
                        ${t.type === 'income' ? '📈 Income' : '📉 Expense'}
                    </td>
                    <td>
                        <div style="display: flex; gap: 5px;">
                            ${!isPaid ? `<button class="btn-ghost" onclick="editTrans(${t.id})" style="font-size: 0.75rem; padding: 4px 8px;">Edit</button>` : ''}
                            <button class="btn-ghost" onclick="copyTrans(${t.id})" style="font-size: 0.75rem; padding: 4px 8px;" title="Duplicate">📋</button>
                            ${!isPaid ? `<button class="btn-ghost" style="color: var(--danger); font-size: 0.75rem; padding: 4px 8px;" onclick="deleteTrans(${t.id})" title="Delete">✕</button>` : ''}
                        </div>
                    </td>
                </tr>
                `;
            });
        }
    });

    container.innerHTML = html;
}

// Helper function to get category icon
function getCategoryIcon(category) {
    const iconMap = {
        'bills': '🧾',
        'food': '🍔',
        'transportation': '🚗',
        'entertainment': '🎬',
        'shopping': '🛍️',
        'healthcare': '🏥',
        'education': '📚',
        'income': '💰',
        'other': '📝',
        'uncategorized': '📄'
    };
    return iconMap[category] || '📄';
}

// NEW: Save category collapsed state to localStorage
function saveCategoryCollapsedState() {
    localStorage.setItem('categoryCollapsedState', JSON.stringify(categoryCollapsedState));
}

// NEW: Toggle category collapse state
function toggleCategoryCollapse(category) {
    categoryCollapsedState[category] = !categoryCollapsedState[category];
    saveCategoryCollapsedState();
    renderTransactions();
}

// NEW: Collapse all categories
function collapseAllCategories() {
    // Set all categories to collapsed
    Object.keys(categoryCollapsedState).forEach(category => {
        categoryCollapsedState[category] = true;
    });

    // Also collapse categories that might not be in the state yet
    const container = document.getElementById('transactionList');
    if (container) {
        const categories = container.querySelectorAll('.category-header');
        categories.forEach(row => {
            const categoryText = row.querySelector('span[style*="font-weight: 700"]');
            if (categoryText) {
                const category = categoryText.textContent.toLowerCase();
                categoryCollapsedState[category] = true;
            }
        });
    }

    saveCategoryCollapsedState();
    renderTransactions();
}

// NEW: Expand all categories
function expandAllCategories() {
    // Set all categories to expanded
    Object.keys(categoryCollapsedState).forEach(category => {
        categoryCollapsedState[category] = false;
    });

    // Also expand categories that might not be in the state yet
    const container = document.getElementById('transactionList');
    if (container) {
        const categories = container.querySelectorAll('.category-header');
        categories.forEach(row => {
            const categoryText = row.querySelector('span[style*="font-weight: 700"]');
            if (categoryText) {
                const category = categoryText.textContent.toLowerCase();
                categoryCollapsedState[category] = false;
            }
        });
    }

    saveCategoryCollapsedState();
    renderTransactions();
}

function openTransModal(title = "New Transaction") {
    if (title === "New Transaction") {
        document.getElementById('transForm').reset();
        document.getElementById('tEditId').value = '';
        // Set default category to empty
        document.getElementById('tCategory').value = '';
    }
    document.getElementById('transModal').classList.add('active');

    // Accessibility: Focus the name input
    setTimeout(() => document.getElementById('tName').focus(), 100);
}

function closeTransModal() {
    document.getElementById('transModal').classList.remove('active');
    document.getElementById('tEditId').value = '';
}

document.getElementById('transForm').onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('tEditId').value;
    const entry = {
        id: id ? parseInt(id) : Date.now(),
        name: document.getElementById('tName').value,
        amount: parseFloat(document.getElementById('tAmount').value),
        type: document.getElementById('tType').value,
        frequency: document.getElementById('tFreq').value,
        category: document.getElementById('tCategory').value || null, // NEW: Category field
        date: document.getElementById('tDate').value,
        endDate: document.getElementById('tEndDate').value
    };

    if (id) {
        const idx = transactions.findIndex(t => t.id === parseInt(id));
        transactions[idx] = entry;
    } else {
        transactions.push(entry);
    }

    saveData();

    // CRITICAL: Invalidate cache when transactions change
    if (typeof invalidateTransactionCache === 'function') {
        invalidateTransactionCache();
    }

    closeTransModal();
    renderTransactions();
    if (typeof refreshUI === "function") refreshUI();
};

function editTrans(id) {
    const t = transactions.find(x => x.id === id);
    if (!t) return;

    document.getElementById('tEditId').value = t.id;
    document.getElementById('tName').value = t.name;
    document.getElementById('tAmount').value = t.amount;
    document.getElementById('tType').value = t.type;
    document.getElementById('tFreq').value = t.frequency;
    document.getElementById('tCategory').value = t.category || ''; // NEW: Load category
    document.getElementById('tDate').value = t.date;
    document.getElementById('tEndDate').value = t.endDate || '';

    openTransModal("Edit Transaction");
}

function copyTrans(id) {
    const t = transactions.find(x => x.id === id);
    if (!t) return;
    const copy = { ...t, id: Date.now(), name: t.name + " (Copy)" };
    transactions.push(copy);

    saveData();

    // CRITICAL: Invalidate cache when transactions change
    if (typeof invalidateTransactionCache === 'function') {
        invalidateTransactionCache();
    }

    renderTransactions();
    if (typeof refreshUI === "function") refreshUI();
}

function deleteTrans(id) {
    if (confirm("Are you sure you want to delete this transaction?")) {
        transactions = transactions.filter(t => t.id !== id);

        saveData();

        // CRITICAL: Invalidate cache when transactions change
        if (typeof invalidateTransactionCache === 'function') {
            invalidateTransactionCache();
        }

        renderTransactions();
        if (typeof refreshUI === "function") refreshUI();
    }
}
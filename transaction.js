/**
 * TRANSACTIONS.JS - Updated with End Date and Weekly Logic
 */
let transFilter = 'active';

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
        const isOneTimePast = (t.frequency === 'none' && t.date < todayStr);
        const isExpired = (t.endDate && t.endDate < todayStr);

        const isFinished = isOneTimePast || isExpired;

        return transFilter === 'active' ? !isFinished : isFinished;
    });

    // 2. Filter by Search Term
    if (searchTerm) {
        filtered = filtered.filter(t =>
            t.name.toLowerCase().includes(searchTerm) ||
            t.amount.toString().includes(searchTerm) ||
            t.frequency.toLowerCase().includes(searchTerm) ||
            t.date.includes(searchTerm)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">No transactions found.</td></tr>`;
        return;
    }

    container.innerHTML = filtered.map(t => `
        <tr style="border-bottom: 1px solid var(--border);">
            <td>
                <div style="font-weight: 700;">${t.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">${t.type}</div>
            </td>
            <td style="font-weight: 800; color: ${t.type === 'income' ? 'var(--success)' : 'var(--text-main)'}">
                ₱${t.amount.toLocaleString()}
            </td>
            <td class="col-freq">${t.frequency.charAt(0).toUpperCase() + t.frequency.slice(1)}</td>
            <td style="font-size: 0.85rem;">
                ${t.date} 
                ${t.endDate ? `<br><span style="color:var(--text-muted); font-size:0.75rem;">to ${t.endDate}</span>` : ''}
            </td>
            <td>
                <div style="display: flex; gap: 5px;">
                    <button class="btn-ghost" onclick="editTrans(${t.id})">Edit</button>
                    <button class="btn-ghost" onclick="copyTrans(${t.id})">📋</button>
                    <button class="btn-ghost" style="color: var(--danger);" onclick="deleteTrans(${t.id})">✕</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openTransModal(title = "New Transaction") {
    if (title === "New Transaction") {
        document.getElementById('transForm').reset();
        document.getElementById('tEditId').value = '';
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
        date: document.getElementById('tDate').value,
        endDate: document.getElementById('tEndDate').value // Added End Date support
    };

    if (id) {
        const idx = transactions.findIndex(t => t.id === parseInt(id));
        transactions[idx] = entry;
    } else {
        transactions.push(entry);
    }

    saveData();
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
    document.getElementById('tDate').value = t.date;
    document.getElementById('tEndDate').value = t.endDate || ''; // Load End Date

    openTransModal("Edit Transaction");
}

function copyTrans(id) {
    const t = transactions.find(x => x.id === id);
    if (!t) return;
    const copy = { ...t, id: Date.now(), name: t.name + " (Copy)" };
    transactions.push(copy);
    saveData();
    renderTransactions();
    if (typeof refreshUI === "function") refreshUI();
}

function deleteTrans(id) {
    if (confirm("Are you sure you want to delete this?")) {
        transactions = transactions.filter(t => t.id !== id);
        saveData();
        renderTransactions();
        if (typeof refreshUI === "function") refreshUI();
    }
}
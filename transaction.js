/**
 * TRANSACTIONS.JS - Updated with Search Logic
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

    // 1. Updated Filter Logic
    let filtered = transactions.filter(t => {
        // A transaction is "Past/Completed" if:
        // - It's One-time (none) and the date is before today
        // - OR it has an End Date and that end date is before today
        const isOneTimePast = (t.frequency === 'none' && t.date < todayStr);
        const isExpired = (t.endDate && t.endDate < todayStr);

        const isFinished = isOneTimePast || isExpired;

        return transFilter === 'active' ? !isFinished : isFinished;
    });

    // 2. Filter by Search Term (Keep existing logic)
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
        <tr style="border-bottom: 1px solid var(--border)">
            <td style="padding:15px"><strong>${t.name}</strong></td>
            <td style="color:var(--text-muted)">${t.date}</td>
            <td><span style="font-size:0.75rem; background:#f1f5f9; padding:2px 6px; border-radius:4px">${t.frequency}</span></td>
            <td style="font-weight:bold; color:${t.type === 'income' ? 'var(--success)' : 'var(--text-main)'}">
                $${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </td>
            <td>
                <button class="btn-ghost" onclick="editTrans(${t.id})">Edit</button>
                <button class="btn-ghost" onclick="duplicateTrans(${t.id})" title="Duplicate">⎘</button>
                <button class="btn-ghost" style="color:var(--danger)" onclick="deleteTrans(${t.id})">✕</button>
            </td>
        </tr>
    `).join('');
}

function editTrans(id) {
    const t = transactions.find(x => x.id === id);
    if (!t) return;
    document.getElementById('tEditId').value = t.id;
    document.getElementById('tName').value = t.name;
    document.getElementById('tAmount').value = t.amount;
    document.getElementById('tType').value = t.type;
    document.getElementById('tFreq').value = t.frequency;
    document.getElementById('tDate').value = t.date;
    document.getElementById('tEndDate').value = t.endDate || ''; // Load the end date
    openTransModal("Edit Transaction");
}

function duplicateTrans(id) {
    const t = transactions.find(x => x.id === id);
    if (!t) return;
    const copy = { ...t, id: Date.now(), name: t.name + " (Copy)" };
    transactions.push(copy);
    saveData();
    renderTransactions();
}

function deleteTrans(id) {
    if (confirm("Are you sure?")) {
        transactions = transactions.filter(t => t.id !== id);
        saveData();
        renderTransactions();
    }
}

// Modal Toggle Helpers
function openTransModal(title = "New Transaction") {
    if (title === "New Transaction") document.getElementById('transForm').reset();
    document.getElementById('transModal').classList.add('active');
}

function closeTransModal() {
    document.getElementById('transModal').classList.remove('active');
}

// Form Submission
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
        endDate: document.getElementById('tEndDate').value // Save the end date
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
};
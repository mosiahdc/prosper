/**
 * VAULTS.JS - Vault Management Logic
 */

function renderVaults() {
    const container = document.getElementById('vaultContainer');
    const totalDisplay = document.getElementById('totalVaultDisplay');

    if (!container) return;

    const total = vaults.reduce((sum, v) => sum + v.balance, 0);
    totalDisplay.innerText = `$${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    container.innerHTML = vaults.map(v => `
        <div class="card" style="padding: 1.5rem; position: relative;">
            <div style="color: var(--text-muted); font-size: 0.8rem; font-weight: 600; text-transform: uppercase;">${v.name}</div>
            <div style="font-size: 1.75rem; font-weight: 800; margin: 10px 0;">$${v.balance.toLocaleString()}</div>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button class="btn-ghost" style="flex: 1;" onclick="editVault(${v.id})">Edit</button>
                <button class="btn-ghost" style="color: var(--danger);" onclick="deleteVault(${v.id})">✕</button>
            </div>
        </div>
    `).join('');
}

function openVaultModal(title = "New Vault") {
    document.getElementById('vModalTitle').innerText = title;
    document.getElementById('vaultModal').classList.add('active');

    // Focus Name for new vaults, Balance for edits (if editVault hasn't handled it)
    setTimeout(() => {
        if (title === "New Vault") {
            document.getElementById('vName').focus();
        }
    }, 100);
}

function closeVaultModal() {
    document.getElementById('vEditId').value = '';
    document.getElementById('vName').value = '';
    document.getElementById('vBalance').value = '';
    document.getElementById('vaultModal').classList.remove('active');
}

function saveVault() {
    const id = document.getElementById('vEditId').value;
    const name = document.getElementById('vName').value;
    const balance = parseFloat(document.getElementById('vBalance').value) || 0;

    if (!name) return alert("Please enter a vault name");

    if (id) {
        // Update existing
        const idx = vaults.findIndex(v => v.id === parseInt(id));
        vaults[idx] = { ...vaults[idx], name, balance };
    } else {
        // Add new
        vaults.push({ id: Date.now(), name, balance });
    }

    saveData(); // Function in app.js
    closeVaultModal();
    renderVaults();
    if (typeof refreshUI === "function") refreshUI(); // Update calendar totals
}

function editVault(id) {
    const v = vaults.find(x => x.id === id);
    if (!v) return;
    document.getElementById('vEditId').value = v.id;
    document.getElementById('vName').value = v.name;
    document.getElementById('vBalance').value = v.balance;

    openVaultModal("Edit Vault");

    // Put focus on the amount input
    setTimeout(() => {
        const balanceInput = document.getElementById('vBalance');
        balanceInput.focus();
        balanceInput.select(); // Optional: selects the text so you can type over it immediately
    }, 100);
}

function deleteVault(id) {
    if (confirm("Are you sure you want to delete this vault?")) {
        vaults = vaults.filter(v => v.id !== id);
        saveData();
        renderVaults();
        if (typeof refreshUI === "function") refreshUI();
    }
}
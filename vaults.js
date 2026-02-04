/**
 * VAULTS.JS - Vault Management Logic with Draggable and Jar Support
 */

// NEW: Initialize sortable for vaults and jars
function initializeSortable() {
    const vaultContainer = document.getElementById('vaultContainer');
    const jarContainer = document.getElementById('jarContainer');
    
    if (vaultContainer) {
        new Sortable(vaultContainer, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function(evt) {
                // Update vault order
                const vaultElements = Array.from(vaultContainer.children);
                const newOrder = vaultElements.map(el => parseInt(el.getAttribute('data-vault-id')));
                vaultOrder = newOrder;
                saveData();
            }
        });
    }
    
    if (jarContainer) {
        new Sortable(jarContainer, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function(evt) {
                // Update jar order
                const jarElements = Array.from(jarContainer.children);
                const newOrder = jarElements.map(el => parseInt(el.getAttribute('data-jar-id')));
                jarOrder = newOrder;
                saveData();
            }
        });
    }
}

// NEW: Render jars section
function renderJars() {
    const container = document.getElementById('jarContainer');
    const totalDisplay = document.getElementById('totalJarDisplay');
    
    if (!container) return;
    
    const total = jars.reduce((sum, j) => sum + j.currentAmount, 0);
    totalDisplay.innerText = `₱${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    
    // Sort jars according to jarOrder
    let sortedJars = [...jars];
    if (jarOrder.length > 0) {
        sortedJars.sort((a, b) => {
            const indexA = jarOrder.indexOf(a.id);
            const indexB = jarOrder.indexOf(b.id);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
    }
    
    container.innerHTML = sortedJars.map(j => {
        const progressPercentage = j.goalAmount ? Math.min((j.currentAmount / j.goalAmount) * 100, 100) : 0;
        const daysLeft = j.goalDate ? calculateDaysLeft(j.goalDate) : null;
        const progressColor = progressPercentage >= 100 ? 'var(--success)' : 'var(--primary)';
        
        return `
            <div class="card jar-card" data-jar-id="${j.id}" style="padding: 1.5rem; position: relative; border-left: 4px solid var(--accent);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <div>
                        <div style="color: var(--text-muted); font-size: 0.8rem; font-weight: 600; text-transform: uppercase;">${j.name}</div>
                        <div style="font-size: 1.5rem; font-weight: 800; margin: 5px 0;">₱${j.currentAmount.toLocaleString()}</div>
                        ${j.goalAmount ? `
                            <div style="font-size: 0.85rem; color: var(--text-muted);">
                                Goal: ₱${j.goalAmount.toLocaleString()}
                                ${j.goalDate ? `<br>Target: ${formatDate(j.goalDate)}` : ''}
                            </div>
                        ` : ''}
                    </div>
                    <div style="display: flex; gap: 5px;">
                        <button class="btn-ghost" style="font-size: 0.8rem; padding: 4px 8px;" onclick="addToJar(${j.id})">+ Add</button>
                        <button class="btn-ghost" style="color: var(--danger);" onclick="deleteJar(${j.id})">✕</button>
                    </div>
                </div>
                
                ${j.goalAmount ? `
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 0.75rem;">
                            <span>Progress</span>
                            <span>${progressPercentage.toFixed(1)}%</span>
                        </div>
                        <div style="height: 8px; background: var(--border); border-radius: 4px; overflow: hidden;">
                            <div style="height: 100%; width: ${progressPercentage}%; background: ${progressColor}; border-radius: 4px;"></div>
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 5px;">
                            ${j.currentAmount >= j.goalAmount ? 
                                '🎉 Goal achieved!' : 
                                `₱${(j.goalAmount - j.currentAmount).toLocaleString()} remaining`
                            }
                            ${daysLeft !== null && daysLeft > 0 ? ` • ${daysLeft} days left` : ''}
                            ${daysLeft !== null && daysLeft <= 0 ? ' • Past deadline' : ''}
                        </div>
                    </div>
                ` : ''}
                
                <div style="display: flex; gap: 5px;">
                    <button class="btn-ghost" style="flex: 1; font-size: 0.8rem;" onclick="editJar(${j.id})">Edit Goal</button>
                    <button class="btn-ghost" style="flex: 1; font-size: 0.8rem;" onclick="withdrawFromJar(${j.id})">Withdraw</button>
                </div>
            </div>
        `;
    }).join('');
    
    initializeSortable();
}

// NEW: Helper functions for jars
function calculateDaysLeft(goalDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(goalDate);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderVaults() {
    const container = document.getElementById('vaultContainer');
    const totalDisplay = document.getElementById('totalVaultDisplay');

    if (!container) return;

    const total = vaults.reduce((sum, v) => sum + v.balance, 0);
    totalDisplay.innerText = `₱${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    // Sort vaults according to vaultOrder
    let sortedVaults = [...vaults];
    if (vaultOrder.length > 0) {
        sortedVaults.sort((a, b) => {
            const indexA = vaultOrder.indexOf(a.id);
            const indexB = vaultOrder.indexOf(b.id);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
    }

    container.innerHTML = sortedVaults.map(v => `
        <div class="card vault-card" data-vault-id="${v.id}" style="padding: 1.5rem; position: relative;">
            <div style="color: var(--text-muted); font-size: 0.8rem; font-weight: 600; text-transform: uppercase;">${v.name}</div>
            <div style="font-size: 1.75rem; font-weight: 800; margin: 10px 0;">₱${v.balance.toLocaleString()}</div>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button class="btn-ghost" style="flex: 1;" onclick="editVault(${v.id})">Edit</button>
                <button class="btn-ghost" style="color: var(--danger);" onclick="deleteVault(${v.id})">✕</button>
            </div>
        </div>
    `).join('');
    
    initializeSortable();
}

function openVaultModal(title = "New Vault") {
    document.getElementById('vModalTitle').innerText = title;
    document.getElementById('vaultModal').classList.add('active');

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

// NEW: Jar modal functions
function openJarModal(title = "New Jar") {
    document.getElementById('jModalTitle').innerText = title;
    document.getElementById('jarModal').classList.add('active');

    setTimeout(() => {
        if (title === "New Jar") {
            document.getElementById('jName').focus();
        }
    }, 100);
}

function closeJarModal() {
    document.getElementById('jEditId').value = '';
    document.getElementById('jName').value = '';
    document.getElementById('jGoalAmount').value = '';
    document.getElementById('jGoalDate').value = '';
    document.getElementById('jarModal').classList.remove('active');
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
        const newVault = { id: Date.now(), name, balance };
        vaults.push(newVault);
        vaultOrder.push(newVault.id); // Add to order
    }

    saveData();
    closeVaultModal();
    renderVaults();
    if (typeof refreshUI === "function") refreshUI();
}

// NEW: Save jar function
function saveJar() {
    const id = document.getElementById('jEditId').value;
    const name = document.getElementById('jName').value;
    const goalAmount = parseFloat(document.getElementById('jGoalAmount').value) || 0;
    const goalDate = document.getElementById('jGoalDate').value;

    if (!name) return alert("Please enter a jar name");

    if (id) {
        // Update existing
        const idx = jars.findIndex(j => j.id === parseInt(id));
        jars[idx] = { ...jars[idx], name, goalAmount, goalDate };
    } else {
        // Add new
        const newJar = { 
            id: Date.now(), 
            name, 
            currentAmount: 0, 
            goalAmount, 
            goalDate 
        };
        jars.push(newJar);
        jarOrder.push(newJar.id); // Add to order
    }

    saveData();
    closeJarModal();
    renderJars();
}

// NEW: Add money to jar
function addToJar(jarId) {
    const amount = prompt("How much would you like to add to this jar?");
    if (!amount || isNaN(parseFloat(amount))) return;
    
    const jar = jars.find(j => j.id === jarId);
    if (!jar) return;
    
    jar.currentAmount += parseFloat(amount);
    saveData();
    renderJars();
}

// NEW: Withdraw from jar
function withdrawFromJar(jarId) {
    const jar = jars.find(j => j.id === jarId);
    if (!jar) return;
    
    const amount = prompt(`How much would you like to withdraw? (Current: ₱${jar.currentAmount.toLocaleString()})`);
    if (!amount || isNaN(parseFloat(amount))) return;
    
    const withdrawAmount = parseFloat(amount);
    if (withdrawAmount > jar.currentAmount) {
        alert("Cannot withdraw more than the current amount!");
        return;
    }
    
    jar.currentAmount -= withdrawAmount;
    saveData();
    renderJars();
}

// NEW: Edit jar
function editJar(jarId) {
    const j = jars.find(x => x.id === jarId);
    if (!j) return;
    
    document.getElementById('jEditId').value = j.id;
    document.getElementById('jName').value = j.name;
    document.getElementById('jGoalAmount').value = j.goalAmount || '';
    document.getElementById('jGoalDate').value = j.goalDate || '';
    
    openJarModal("Edit Jar");
}

// NEW: Delete jar
function deleteJar(jarId) {
    if (confirm("Are you sure you want to delete this jar?")) {
        jars = jars.filter(j => j.id !== jarId);
        jarOrder = jarOrder.filter(id => id !== jarId);
        saveData();
        renderJars();
    }
}

function editVault(id) {
    const v = vaults.find(x => x.id === id);
    if (!v) return;
    document.getElementById('vEditId').value = v.id;
    document.getElementById('vName').value = v.name;
    document.getElementById('vBalance').value = v.balance;

    openVaultModal("Edit Vault");

    setTimeout(() => {
        const balanceInput = document.getElementById('vBalance');
        balanceInput.focus();
        balanceInput.select();
    }, 100);
}

function deleteVault(id) {
    if (confirm("Are you sure you want to delete this vault?")) {
        vaults = vaults.filter(v => v.id !== id);
        vaultOrder = vaultOrder.filter(vaultId => vaultId !== id);
        saveData();
        renderVaults();
        if (typeof refreshUI === "function") refreshUI();
    }
}
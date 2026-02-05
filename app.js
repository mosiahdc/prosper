/**
 * APP.JS - Global State & Navigation
 */
let vaults = JSON.parse(localStorage.getItem('vaultsData')) || [];
let jars = JSON.parse(localStorage.getItem('jarsData')) || [];
let transactions = JSON.parse(localStorage.getItem('moneyData')) || [];
let fulfilledMap = JSON.parse(localStorage.getItem('fulfilledData')) || {};
let skippedMap = JSON.parse(localStorage.getItem('skippedData')) || {};
let vaultOrder = JSON.parse(localStorage.getItem('vaultOrder')) || [];
let jarOrder = JSON.parse(localStorage.getItem('jarOrder')) || [];
let currentViewDate = new Date(); currentViewDate.setDate(1);

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');

    // Update Nav Buttons
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-${id}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Trigger page-specific refreshes
    if (id === 'input') renderTransactions();
    if (id === 'dashboard' || id === 'review') refreshUI();
    if (id === 'vault') {
        renderVaults();
        renderJars();
    }
    if (id === 'settings') renderSettings(); // NEW: Render settings page
}

function saveData() {
    localStorage.setItem('moneyData', JSON.stringify(transactions));
    localStorage.setItem('fulfilledData', JSON.stringify(fulfilledMap));
    localStorage.setItem('skippedData', JSON.stringify(skippedMap));
    localStorage.setItem('vaultsData', JSON.stringify(vaults));
    localStorage.setItem('jarsData', JSON.stringify(jars));
    localStorage.setItem('vaultOrder', JSON.stringify(vaultOrder));
    localStorage.setItem('jarOrder', JSON.stringify(jarOrder));
    localStorage.setItem('categoryCollapsedState', JSON.stringify(categoryCollapsedState || {}));

    // Track last save
    localStorage.setItem('lastSave', new Date().toISOString());

    console.log('💾 Data saved successfully');
}

// NEW: Export all data as JSON
function exportData() {
    const allData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        vaults,
        jars,
        transactions,
        fulfilledMap,
        skippedMap,
        vaultOrder,
        jarOrder,
        categoryCollapsedState: categoryCollapsedState || {}
    };

    const dataStr = JSON.stringify(allData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = `prosper-backup-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    // Show success message
    alert(`✅ Data exported successfully!\nFile: ${exportFileDefaultName}\nTotal: ${transactions.length} transactions, ${vaults.length} vaults, ${jars.length} jars`);

    return false;
}

// NEW: Import data from JSON file
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const importedData = JSON.parse(e.target.result);

            // Validate the imported data structure
            if (!confirm(`⚠️ WARNING: This will replace ALL your current data.\n\nImport from: ${importedData.exportDate || 'unknown date'}\n\nDo you want to continue?`)) {
                return;
            }

            // Import the data
            if (importedData.vaults) vaults = importedData.vaults;
            if (importedData.jars) jars = importedData.jars;
            if (importedData.transactions) transactions = importedData.transactions;
            if (importedData.fulfilledMap) fulfilledMap = importedData.fulfilledMap;
            if (importedData.skippedMap) skippedMap = importedData.skippedMap;
            if (importedData.vaultOrder) vaultOrder = importedData.vaultOrder;
            if (importedData.jarOrder) jarOrder = importedData.jarOrder;
            if (importedData.categoryCollapsedState) categoryCollapsedState = importedData.categoryCollapsedState;

            // Save to localStorage
            saveData();

            // CRITICAL: Clear all caches
            if (typeof dayDataCache !== 'undefined') {
                dayDataCache.clear();
                console.log('🗑️ Cleared dayDataCache after import');
            }

            if (typeof transactionIndex !== 'undefined') {
                transactionIndex = null;
                console.log('🗑️ Cleared transactionIndex after import');
            }

            // Force rebuild transaction index
            if (typeof invalidateTransactionCache === 'function') {
                invalidateTransactionCache();
                console.log('🔄 Rebuilt transaction cache after import');
            }

            // CRITICAL: Force refresh all UI components
            // First ensure we're on the dashboard to see changes
            setTimeout(() => {
                showPage('dashboard');

                // Then force refresh all components
                setTimeout(() => {
                    if (typeof refreshUI === "function") {
                        refreshUI();
                        console.log('🔄 Forced UI refresh after import');
                    }

                    if (typeof renderVaults === "function") {
                        renderVaults();
                        console.log('🔄 Rendered vaults after import');
                    }

                    if (typeof renderJars === "function") {
                        renderJars();
                        console.log('🔄 Rendered jars after import');
                    }

                    if (typeof renderTransactions === "function") {
                        renderTransactions();
                        console.log('🔄 Rendered transactions after import');
                    }
                }, 50);
            }, 50);

            // Clear the file input
            event.target.value = '';

            alert(`✅ Data imported successfully!\n\nSummary:\n• ${transactions.length} transactions\n• ${vaults.length} vaults\n• ${jars.length} jars\n\nRedirecting to dashboard...`);

        } catch (error) {
            alert(`❌ Error importing data: ${error.message}\n\nPlease make sure you selected a valid Prosper backup file.`);
            console.error('Import error:', error);
        }
    };
    reader.readAsText(file);
}

window.importData = importData;

// NEW: Clear all data with confirmation
function clearAllData() {
    if (!confirm(`⚠️ WARNING: This will DELETE ALL YOUR DATA!\n\nThis includes:\n• All transactions\n• All vaults\n• All jars\n• All settings\n\nThis action cannot be undone!\n\nAre you absolutely sure?`)) {
        return;
    }

    if (!confirm(`🚨 FINAL WARNING: You are about to delete ALL data.\n\nType "DELETE" to confirm:`)) {
        return;
    }

    const userInput = prompt('Type "DELETE" to confirm deletion:');
    if (userInput !== 'DELETE') {
        alert('Deletion cancelled.');
        return;
    }

    // Clear all data arrays
    vaults = [];
    jars = [];
    transactions = [];
    fulfilledMap = {};
    skippedMap = {};
    vaultOrder = [];
    jarOrder = [];
    categoryCollapsedState = {};

    // Clear localStorage
    localStorage.clear();

    // Clear calendar caches
    if (typeof dayDataCache !== 'undefined') {
        dayDataCache.clear();
        console.log('🗑️ Cleared dayDataCache');
    }

    if (typeof transactionIndex !== 'undefined') {
        transactionIndex = null;
        console.log('🗑️ Cleared transactionIndex');
    }

    // Reset view date
    currentViewDate = new Date();
    currentViewDate.setDate(1);

    // Force cache rebuild
    if (typeof invalidateTransactionCache === 'function') {
        invalidateTransactionCache();
        console.log('🔄 Invalidated transaction cache');
    }

    // Switch to dashboard FIRST
    showPage('dashboard');

    // Then force refresh all components
    setTimeout(() => {
        if (typeof refreshUI === "function") {
            refreshUI();
            console.log('🔄 Forced UI refresh');
        }

        if (typeof renderVaults === "function") {
            renderVaults();
            console.log('🔄 Rendered vaults');
        }

        if (typeof renderJars === "function") {
            renderJars();
            console.log('🔄 Rendered jars');
        }

        if (typeof renderTransactions === "function") {
            renderTransactions();
            console.log('🔄 Rendered transactions');
        }

        alert('✅ All data has been cleared. The app has been reset.');
    }, 100);
}

// NEW: Render settings page
function renderSettings() {
    const stats = {
        transactions: transactions.length,
        vaults: vaults.length,
        jars: jars.length,
        paidTransactions: Object.keys(fulfilledMap).length,
        skippedOccurrences: Object.keys(skippedMap).length,
        totalStorage: JSON.stringify(localStorage).length,
        lastBackup: localStorage.getItem('lastBackup') || 'Never'
    };

    const statsEl = document.getElementById('settingsStats');
    if (statsEl) {
        statsEl.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px;">
                <div class="card" style="padding: 20px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: 800; color: var(--primary);">${stats.transactions}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">Transactions</div>
                </div>
                <div class="card" style="padding: 20px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: 800; color: var(--primary);">${stats.vaults + stats.jars}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">Vaults & Jars</div>
                </div>
                <div class="card" style="padding: 20px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: 800; color: var(--primary);">${stats.paidTransactions}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">Paid Items</div>
                </div>
                <div class="card" style="padding: 20px; text-align: center;">
                    <div style="font-size: 2rem; font-weight: 800; color: var(--primary);">${Math.round(stats.totalStorage / 1024)}KB</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">Storage Used</div>
                </div>
            </div>
        `;
    }


}

// Initial Load
window.onload = () => showPage('dashboard');

/**
 * GLOBAL MODAL CLICK-OUTSIDE LOGIC
 * Detects if the user clicks the darkened background to close modals.
 */
window.onclick = function (event) {
    if (event.target.classList.contains('modal-overlay')) {
        const modalId = event.target.id;

        // Route to the specific cleanup functions in your other JS files
        if (modalId === 'vaultModal') {
            closeVaultModal();
        } else if (modalId === 'jarModal') {
            closeJarModal();
        } else if (modalId === 'transModal') {
            closeTransModal();
        } else if (modalId === 'dayModal') {
            closeDayModal();
        } else {
            // Fallback: just remove the active class if no specific function is found
            event.target.classList.remove('active');
        }
    }
};

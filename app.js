/**
 * APP.JS - Global State & Navigation
 */
let vaults = JSON.parse(localStorage.getItem('vaultsData')) || [];
let transactions = JSON.parse(localStorage.getItem('moneyData')) || [];
let fulfilledMap = JSON.parse(localStorage.getItem('fulfilledData')) || {};
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
    if (id === 'vault') renderVaults();
}

function saveData() {
    localStorage.setItem('moneyData', JSON.stringify(transactions));
    localStorage.setItem('fulfilledData', JSON.stringify(fulfilledMap));
    localStorage.setItem('vaultsData', JSON.stringify(vaults));
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
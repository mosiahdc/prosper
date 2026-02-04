/**
 * APP.JS - Global State & Navigation
 */
let vaults = JSON.parse(localStorage.getItem('vaultsData')) || [];
let transactions = JSON.parse(localStorage.getItem('moneyData')) || [];
let fulfilledMap = JSON.parse(localStorage.getItem('fulfilledData')) || {};
let currentViewDate = new Date(); currentViewDate.setDate(1);

function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    // Show selected page
    document.getElementById(pageId).classList.remove('hidden');

    // Refresh UI whenever we switch pages to ensure calendar renders
    if (pageId === 'dashboard' || pageId === 'review') {
        refreshUI();
    }
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
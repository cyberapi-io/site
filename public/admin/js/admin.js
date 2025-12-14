// Configuration
const CONFIG = {
    // Determine API URL based on current hostname
    API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:8000/api/v1'
        : 'https://threats.cyberapi.io/api/v1',
    REFRESH_INTERVAL: 5000 // 5 seconds
};

// State
let storedKey = localStorage.getItem('admin_api_key');
if (storedKey === 'null' || storedKey === 'undefined') storedKey = null;

const state = {
    apiKey: storedKey,
    currentTab: 'dashboard',
    isConnected: false,
    data: {
        stats: null,
        customers: [],
        testKeys: []
    }
};

// DOM Elements
const elements = {
    authModal: document.getElementById('auth-modal'),
    authForm: document.getElementById('auth-form'),
    apiKeyInput: document.getElementById('api-key-input'),
    sidebar: document.querySelector('.sidebar'),
    mainContent: document.querySelector('.main-content'),
    navItems: document.querySelectorAll('.nav-item'),
    views: document.querySelectorAll('.view'),
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    logoutBtn: document.getElementById('logout-btn'),
    refreshBtn: document.getElementById('refresh-btn'),
    lastUpdate: document.getElementById('last-update'),
    toast: document.getElementById('toast'),
    pageTitle: document.getElementById('page-title')
};

// Utils
const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
const formatDate = (isoString) => new Date(isoString).toLocaleString();
const showToast = (msg, type = 'success') => {
    elements.toast.textContent = msg;
    elements.toast.className = `toast show ${type}`;
    elements.toast.style.backgroundColor = type === 'error' ? 'var(--danger)' : 'var(--success)';
    setTimeout(() => {
        elements.toast.className = 'toast hidden';
    }, 3000);
};

// API Client
const api = {
    async request(endpoint, method = 'GET', body = null) {
        if (!state.apiKey) {
            showAuthModal();
            throw new Error('No API Key');
        }

        const headers = {
            'X-API-Key': state.apiKey,
            'Content-Type': 'application/json'
        };

        try {
            const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : null
            });

            if (response.status === 403) {
                // Invalid key
                localStorage.removeItem('admin_api_key');
                state.apiKey = null;
                showAuthModal();
                throw new Error('Invalid API Key');
            }

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'API Error');
            }

            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            showAuthModal(); // Show modal on connection error to allow re-entry
            throw error;
        }
    },

    async getStats() { return this.request('/admin/stats'); },
    async getCustomers() { return this.request('/admin/customers'); },
    async getTestKeys() { return this.request('/admin/test-keys'); },
    async getCapacity() { return this.request('/admin/capacity'); },

    async createTestKey(data) { return this.request('/admin/test-keys/create', 'POST', data); },
    async deleteTestKey(email) { return this.request(`/admin/test-keys/${email}`, 'DELETE'); },
    async deactivateCustomer(email) { return this.request(`/admin/customers/${email}/deactivate`, 'POST'); },
    async getAuditLogs() { return this.request('/admin/audit-logs'); }
};

// UI Functions
function showAuthModal() {
    elements.authModal.classList.remove('hidden');
    elements.authModal.style.display = 'flex';
    state.isConnected = false;
    updateConnectionStatus();
}

function hideAuthModal() {
    elements.authModal.classList.add('hidden');
    elements.authModal.style.display = 'none';
}

function updateConnectionStatus() {
    if (state.isConnected) {
        elements.statusDot.className = 'dot connected';
        elements.statusText.textContent = 'Connected';
        elements.statusText.style.color = 'var(--success)';
    } else {
        elements.statusDot.className = 'dot';
        elements.statusText.textContent = 'Disconnected';
        elements.statusText.style.color = 'var(--text-muted)';
    }
}

function switchTab(tabId) {
    state.currentTab = tabId;

    // Update Nav
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabId);
    });

    // Update View
    elements.views.forEach(view => {
        view.classList.toggle('active', view.id === `view-${tabId}`);
    });

    // Update Title
    elements.pageTitle.textContent = tabId.charAt(0).toUpperCase() + tabId.slice(1);

    // Refresh Data immediately
    fetchData();
}

async function fetchData() {
    if (!state.apiKey) return;

    try {
        const stats = await api.getStats();
        state.isConnected = true;
        updateConnectionStatus();
        state.data.stats = stats;

        // Update global last update
        elements.lastUpdate.textContent = new Date().toLocaleTimeString();

        // Specific Tab Data
        if (state.currentTab === 'dashboard') {
            const capacity = await api.getCapacity();
            renderDashboard(stats);
            renderCapacity(capacity);
        } else if (state.currentTab === 'customers') {
            const customers = await api.getCustomers();
            renderCustomers(customers.customers);
        } else if (state.currentTab === 'test-keys') {
            const keys = await api.getTestKeys();
            renderTestKeys(keys.test_keys);
        } else if (state.currentTab === 'audit') {
            const logs = await api.getAuditLogs();
            renderAuditLogs(logs.logs);
        }

    } catch (error) {
        state.isConnected = false;
        updateConnectionStatus();
        showToast('Connection failed: ' + error.message, 'error');
    }
}

// Render Functions
function renderDashboard(data) {
    document.getElementById('stat-total-req').textContent = data.system.redis.total_commands_processed.toLocaleString();
    document.getElementById('stat-active-users').textContent = data.customers.active;

    // Revenue is now pre-calculated by backend
    document.getElementById('stat-revenue').textContent = formatCurrency(data.customers.revenue);

    // Detailed System Stats
    const sys = data.system;
    document.getElementById('stat-system-load').innerHTML = `
        <div style="font-size: 0.8rem; line-height: 1.4;">
            <div><strong>CPU:</strong> ${sys.cpu.usage_percent}%</div>
            <div><strong>RAM:</strong> ${sys.ram.used_gb}/${sys.ram.total_gb} GB</div>
            <div><strong>DSK:</strong> ${sys.disk.used_gb}/${sys.disk.total_gb} GB</div>
        </div>
    `;

    // Update Charts (if charts.js loaded)
    if (window.updateCharts) {
        window.updateCharts(data);
    }
}

// ... UI Functions ...

// Updated renderCustomers
function renderCustomers(customers) {
    const tbody = document.querySelector('#customers-table tbody');
    tbody.innerHTML = customers.map(c => `
        <tr>
            <td>
                <div style="font-weight: 500">${c.email}</div>
                <div style="font-size: 0.8em; color: var(--text-muted)">HASH: ${c.key_hash.substring(0, 8)}...</div>
            </td>
            <td><span class="badge ${c.tier}">${c.tier}</span></td>
            <td><span class="status-dot ${c.active ? 'active' : 'inactive'}"></span> ${c.active ? 'Active' : 'Inactive'}</td>
            <td>
                <div class="usage-bar-wrapper">
                    <div class="text">${c.usage_today} / ${c.limit}</div>
                    <div class="bar-bg">
                        <div class="bar-fill" style="width: ${Math.min((c.usage_today / c.limit) * 100, 100)}%"></div>
                    </div>
                </div>
            </td>
            <td>${formatDate(c.created_at)}</td>
            <td>
                <div class="actions">
                    ${c.active
            ? `<button class="btn small danger" onclick="deactivateCustomer('${c.email}')" title="Disattiva">🛑</button>`
            : `<button class="btn small success" style="opacity:0.5; cursor:not-allowed" title="Già disattivato">🚫</button>`
        }
                    
                    <button class="btn small primary" 
                            onclick="rotateKey('${c.email}')" 
                            title="${c.active ? 'Invia nuova chiave' : 'Utente non attivo'}"
                            ${!c.active ? 'disabled style="opacity:0.5; cursor:not-allowed"' : ''}>
                        📧
                    </button>
                    
                    <button class="btn small danger" onclick="deleteCustomer('${c.email}')" title="Elimina definitivamente">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Delete Customer Action
window.deleteCustomer = async (email) => {
    if (!confirm(`SEI SICURO?\n\nStai per eliminare DEFINITIVAMENTE l'utente ${email}.\nQuesta azione è irreversibile.\n\nProcedere?`)) return;
    try {
        await api.request(`/admin/customers/${email}`, 'DELETE');
        showToast('Utente eliminato correttamente');
        fetchData();
    } catch (e) {
        showToast(e.message, 'error');
    }
};

// Rotate Key Action
window.rotateKey = async (email) => {
    if (!confirm(`Warning: This will DELETE the old key for ${email} and email them a NEW one.\n\nContinue?`)) return;
    try {
        showToast('Rotating key...', 'info');
        await api.request(`/admin/customers/${email}/rotate-key`, 'POST');
        showToast('New key sent via email');
        fetchData();
    } catch (e) {
        showToast(e.message, 'error');
    }
};

function renderAuditLogs(logs) {
    const tbody = document.querySelector('#audit-table tbody');
    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty">No audit logs found.</td></tr>';
        return;
    }
    tbody.innerHTML = logs.map(l => `
        <tr>
            <td class="timestamp">${formatDate(l.time)}</td>
            <td><strong>${l.action}</strong></td>
            <td>${l.details}</td>
            <td><span class="badge ${l.status === 'success' ? 'startup' : 'business'}">${l.status}</span></td>
        </tr>
    `).join('');
}

function renderTestKeys(keys) {
    const tbody = document.querySelector('#test-keys-table tbody');
    tbody.innerHTML = keys.map(k => `
        <tr>
            <td>${k.email}</td>
            <td>${k.tier}</td>
            <td>${k.note || '-'}</td>
            <td>${formatDate(k.created_at)}</td>
            <td>
                <button class="btn small danger" onclick="deleteTestKey('${k.email}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function renderCapacity(data) {
    const list = document.getElementById('limits-list');
    list.innerHTML = `
        <div class="metric-row">
            <span>Total Capacity</span>
            <strong>${data.current.total} / ${data.limits.total}</strong>
        </div>
        <div class="metric-row">
            <span>Startup Tier</span>
            <strong>${data.current.startup} / ${data.limits.startup}</strong>
        </div>
        <div class="metric-row">
            <span>Business Tier</span>
            <strong>${data.current.business} / ${data.limits.business}</strong>
        </div>
    `;

    if (window.updateCapacityChart) {
        window.updateCapacityChart(data);
    }
}

// Actions
window.deactivateCustomer = async (email) => {
    if (!confirm(`Deactivate ${email}?`)) return;
    try {
        await api.deactivateCustomer(email);
        showToast('Customer deactivated');
        fetchData();
    } catch (e) {
        showToast(e.message, 'error');
    }
};

window.deleteTestKey = async (email) => {
    if (!confirm(`Delete key for ${email}?`)) return;
    try {
        await api.deleteTestKey(email);
        showToast('Key deleted');
        fetchData();
    } catch (e) {
        showToast(e.message, 'error');
    }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Auth Check
    if (!state.apiKey) {
        showAuthModal();
    } else {
        fetchData();
        setInterval(fetchData, CONFIG.REFRESH_INTERVAL);
    }

    // Auth Form
    elements.authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const key = elements.apiKeyInput.value.replace(/[^\x00-\x7F]/g, "").trim();
        if (key) {
            console.log('Saving API Key:', key.substring(0, 5) + '...');
            localStorage.setItem('admin_api_key', key);
            state.apiKey = key;
            hideAuthModal();
            fetchData();
        }
    });

    // Logout
    elements.logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('admin_api_key');
        state.apiKey = null;
        showAuthModal();
    });

    // Refresh
    elements.refreshBtn.addEventListener('click', fetchData);

    // Navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchTab(item.dataset.tab);
        });
    });

    // Create Test Key Form
    document.getElementById('create-key-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        try {
            const res = await api.createTestKey({
                email: formData.get('email'),
                tier: formData.get('tier'),
                note: formData.get('note')
            });

            document.getElementById('new-key-value').textContent = res.api_key;
            document.getElementById('new-key-result').classList.remove('hidden');
            showToast('Test key created');
            fetchData();
            e.target.reset();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Copy Button
    document.querySelector('.copy-btn')?.addEventListener('click', (e) => {
        const targetId = e.target.dataset.target;
        const text = document.getElementById(targetId).textContent;
        navigator.clipboard.writeText(text);
        showToast('Copied to clipboard');
    });
});

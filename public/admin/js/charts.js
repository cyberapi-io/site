// Chart.js Instances
let trafficChart = null;
let latencyChart = null;
let customerChart = null;
let capacityChart = null;
let statusChart = null;

// Initialize Options
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";

function initCharts() {
    // Traffic Chart (Line)
    const trafficCtx = document.getElementById('trafficChart')?.getContext('2d');
    if (trafficCtx) {
        trafficChart = new Chart(trafficCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Requests',
                    data: [],
                    borderColor: '#00ff9d',
                    backgroundColor: 'rgba(0, 255, 157, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        grid: { color: '#2d3748' },
                        title: { display: true, text: 'Reqs' }
                    }
                }
            }
        });
    }

    // Latency Chart (Line)
    const latencyCtx = document.getElementById('latencyChart')?.getContext('2d');
    if (latencyCtx) {
        latencyChart = new Chart(latencyCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Avg Latency (ms)',
                    data: [],
                    borderColor: '#fbbf24',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderDash: [5, 5]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        grid: { color: '#2d3748' },
                        title: { display: true, text: 'ms' }
                    }
                }
            }
        });
    }

    // ... existing status/customer/capacity charts ...
    // Status Chart (Doughnut)
    const statusCtx = document.getElementById('statusChart')?.getContext('2d');
    if (statusCtx) {
        statusChart = new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: ['2xx OK', '4xx Client', '5xx Server'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#00ff9d', '#fbbf24', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                cutout: '70%',
                plugins: { legend: { position: 'right' } }
            }
        });
    }

    // Customer Chart (Doughnut) - standard
    const customerCtx = document.getElementById('customerChart')?.getContext('2d');
    if (customerCtx) {
        customerChart = new Chart(customerCtx, {
            type: 'doughnut',
            data: {
                labels: ['Startup', 'Business'],
                datasets: [{
                    data: [0, 0],
                    backgroundColor: ['#38bdf8', '#818cf8'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                cutout: '70%',
                plugins: { legend: { position: 'right' } }
            }
        });
    }

    // Capacity Chart (Doughnut)
    const capacityCtx = document.getElementById('capacityChart')?.getContext('2d');
    if (capacityCtx) {
        capacityChart = new Chart(capacityCtx, {
            type: 'doughnut',
            data: {
                labels: ['Used', 'Available'],
                datasets: [{
                    data: [0, 100],
                    backgroundColor: ['#ef4444', '#1f2732'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                cutout: '80%',
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                }
            }
        });
    }
}

// Update Functions called by admin.js
window.updateCharts = (data) => {
    if (!customerChart || !trafficChart || !latencyChart) initCharts();

    // Update Traffic & Latency
    if (trafficChart && latencyChart && data.traffic_history) {
        // Traffic
        trafficChart.data.labels = data.traffic_history.map(h => h.time);
        trafficChart.data.datasets[0].data = data.traffic_history.map(h => h.count);
        trafficChart.update();

        // Latency
        latencyChart.data.labels = data.traffic_history.map(h => h.time);
        latencyChart.data.datasets[0].data = data.traffic_history.map(h => h.latency);
        latencyChart.update();


        // Update Status Chart (Aggregate from history for now, or use last hour?)
        // Let's sum up the last 24h for the status distribution
        let s2xx = 0, s4xx = 0, s5xx = 0;
        data.traffic_history.forEach(h => {
            s2xx += h.status['2xx'];
            s4xx += h.status['4xx'];
            s5xx += h.status['5xx'];
        });

        if (statusChart) {
            statusChart.data.datasets[0].data = [s2xx, s4xx, s5xx];
            statusChart.update();
        }
    }

    // Update Customer Chart
    if (customerChart && data.customers) {
        customerChart.data.datasets[0].data = [
            data.customers.by_tier.startup,
            data.customers.by_tier.business
        ];
        customerChart.update();
    }
};

window.updateCapacityChart = (data) => {
    if (!capacityChart) initCharts();

    if (capacityChart && data.utilization) {
        const used = data.utilization.total_percent;
        const available = 100 - used;

        capacityChart.data.datasets[0].data = [used, available];
        capacityChart.data.datasets[0].backgroundColor = used > 80 ? ['#ef4444', '#1f2732'] : ['#00ff9d', '#1f2732'];
        capacityChart.update();

        // Add centered text (custom plugin-like behavior)
        // For simplicity in this demo, we assume the user looks at the list stats
    }
};

// Auto-init on load
document.addEventListener('DOMContentLoaded', initCharts);

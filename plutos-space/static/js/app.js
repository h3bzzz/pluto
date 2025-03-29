// @ts-check
/// <reference path="./types.d.ts" />

// @ts-ignore
const Chart = window.Chart;

/**
 * WebSocket connection
 * @type {WebSocket|null}
 */
let socket = null;

/**
 * Chart.js instance for protocol distribution
 * @type {Chart|null}
 */
let protocolChart = null;

/**
 * Chart.js instance for timeline visualization
 * @type {Chart|null}
 */
let timelineChart = null;

/**
 * Chart.js instance for traffic patterns
 * @type {Chart|null}
 */
let trafficPatternChart = null;

/**
 * Chart.js instance for protocol details
 * @type {Chart|null}
 */
let protocolDetailsChart = null;

/**
 * Currently active view
 * @type {string}
 */
let currentView = 'dashboard';

/**
 * Current page number for packet pagination
 * @type {number}
 */
let packetPage = 1;

/**
 * Number of packets to display per page
 * @type {number}
 */
let packetsPerPage = 20;

/**
 * Packet filter options
 * @type {{srcIp?: string, dstIp?: string, protocol?: string}}
 */
let packetFilters = {};

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    connectWebSocket();
    initializeCharts();
    setupEventListeners();
    
    fetchStats();
    fetchPackets();
    fetchAlerts();
});


function initNavigation() {
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            /** @type {HTMLAnchorElement} */ 
            // @ts-ignore
            const target = e.target;
            const targetId = target.getAttribute('href').substring(1);
            
            navLinks.forEach(navLink => navLink.classList.remove('active'));
            target.classList.add('active');
            
            document.querySelectorAll('.view').forEach(view => {
                view.classList.remove('active');
            });
            
            const viewElement = document.getElementById(`${targetId}-view`);
            if (viewElement) {
                viewElement.classList.add('active');
            }
            
            currentView = targetId;
        });
    });
}

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
        console.log('WebSocket connection established');
        updateConnectionStatus(true);
    };
    
    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };
    
    socket.onclose = () => {
        console.log('WebSocket connection closed');
        updateConnectionStatus(false);
        
        setTimeout(connectWebSocket, 5000);
    };
    
    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false);
    };
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connection-indicator');
    const statusText = document.getElementById('connection-text');
    
    if (connected) {
        indicator.style.backgroundColor = '#2ecc71';
        statusText.textContent = 'Connected';
    } else {
        indicator.style.backgroundColor = 'red';
        statusText.textContent = 'Disconnected';
    }
}

function handleWebSocketMessage(data) {
    console.log('Received WebSocket message:', data);
    
    switch (data.type) {
        case 'network_stats':
            updateDashboardStats(data.data);
            break;
        case 'new_packet':
            if (currentView === 'packets') {
                addNewPacketToTable(data.data);
            }
            break;
        case 'new_alert':
            if (currentView === 'alerts') {
                addNewAlert(data.data);
            }
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

function initializeCharts() {
    const protocolCtx = /** @type {HTMLCanvasElement} */ (document.getElementById('protocol-chart')).getContext('2d');
    protocolChart = new Chart(protocolCtx, {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#3498db', '#2ecc71', '#e74c3c', '#f39c12', 
                    '#9b59b6', '#1abc9c', '#34495e', '#7f8c8d'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
    
    const timelineCtx = /** @type {HTMLCanvasElement} */ (document.getElementById('timeline-chart')).getContext('2d');
    timelineChart = new Chart(timelineCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Packet Count',
                data: [],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    
    const trafficPatternCtx = /** @type {HTMLCanvasElement} */ (document.getElementById('traffic-pattern-chart')).getContext('2d');
    trafficPatternChart = new Chart(trafficPatternCtx, {
        type: 'bar',
        data: {
            labels: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
            datasets: [{
                label: 'Traffic Volume',
                data: [0, 0, 0, 0, 0, 0, 0, 0],
                backgroundColor: 'rgba(52, 152, 219, 0.7)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Packet Count'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time of Day'
                    }
                }
            }
        }
    });
    
    const protocolDetailsCtx = /** @type {HTMLCanvasElement} */ (document.getElementById('protocol-details-chart')).getContext('2d');
    protocolDetailsChart = new Chart(protocolDetailsCtx, {
        type: 'radar',
        data: {
            labels: ['TCP', 'UDP', 'ICMP', 'DNS', 'HTTP', 'HTTPS', 'Other'],
            datasets: [{
                label: 'Protocol Distribution',
                data: [0, 0, 0, 0, 0, 0, 0],
                backgroundColor: 'rgba(46, 204, 113, 0.2)',
                borderColor: 'rgba(46, 204, 113, 1)',
                pointBackgroundColor: 'rgba(46, 204, 113, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function setupEventListeners() {
    document.getElementById('apply-filters').addEventListener('click', () => {
        packetFilters = {
            srcIp: /** @type {HTMLInputElement} */ (document.getElementById('filter-src-ip')).value,
            dstIp: /** @type {HTMLInputElement} */ (document.getElementById('filter-dst-ip')).value,
            protocol: /** @type {HTMLSelectElement} */ (document.getElementById('filter-protocol')).value
        };
        packetPage = 1;
        fetchPackets();
    });
    
    document.getElementById('prev-page').addEventListener('click', () => {
        if (packetPage > 1) {
            packetPage--;
            fetchPackets();
        }
    });
    
    document.getElementById('next-page').addEventListener('click', () => {
        packetPage++;
        fetchPackets();
    });
    
    document.getElementById('alert-severity').addEventListener('change', () => {
        fetchAlerts();
    });
    
    document.getElementById('alert-search').addEventListener('input', /** @type {EventListener} */ (debounce(() => {
        fetchAlerts();
    }, 300)));
}

function updateDashboardStats(stats) {
    document.getElementById('packet-count').textContent = formatNumber(stats.packet_count);
    document.getElementById('unique-sources').textContent = formatNumber(stats.unique_src_ips);
    document.getElementById('unique-destinations').textContent = formatNumber(stats.unique_dst_ips);
    document.getElementById('traffic-volume').textContent = formatBytes(stats.total_bytes);
    
    if (stats.protocols && stats.protocols.length > 0) {
        updateProtocolChart(stats.protocols);
    }
    
    if (stats.top_sources) {
        updateTopSources(stats.top_sources);
    }
    
    if (stats.top_destinations) {
        updateTopDestinations(stats.top_destinations);
    }
}

function updateProtocolChart(protocols) {
    const labels = [];
    const data = [];
    
    protocols.forEach(protocol => {
        labels.push(protocol.protocol || 'Unknown');
        data.push(protocol.packet_count);
    });
    
    protocolChart.data.labels = labels;
    protocolChart.data.datasets[0].data = data;
    protocolChart.update();
}

function updateTopSources(sources) {
    const container = document.getElementById('top-sources');
    container.innerHTML = '';
    
    if (sources.length === 0) {
        container.innerHTML = '<p class="empty-message">No data available</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.classList.add('data-table');
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Source IP</th>
            <th>Packet Count</th>
            <th>Data Volume</th>
        </tr>
    `;
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    sources.forEach(source => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${source.src_ip}</td>
            <td>${formatNumber(source.packet_count)}</td>
            <td>${formatBytes(source.total_bytes)}</td>
        `;
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    
    container.appendChild(table);
}

function updateTopDestinations(destinations) {
    const container = document.getElementById('top-destinations');
    container.innerHTML = '';
    
    if (destinations.length === 0) {
        container.innerHTML = '<p class="empty-message">No data available</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.classList.add('data-table');
    
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Destination IP</th>
            <th>Packet Count</th>
            <th>Data Volume</th>
        </tr>
    `;
    table.appendChild(thead);
    
    const tbody = document.createElement('tbody');
    destinations.forEach(dest => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${dest.dst_ip}</td>
            <td>${formatNumber(dest.packet_count)}</td>
            <td>${formatBytes(dest.total_bytes)}</td>
        `;
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    
    container.appendChild(table);
}

function fetchStats() {
    fetch('/api/stats')
        .then(response => response.json())
        .then(data => {
            updateDashboardStats(data);
        })
        .catch(error => {
            console.error('Error fetching stats:', error);
        });
    
    fetch('/api/protocols')
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                updateProtocolChart(data);
            }
        })
        .catch(error => {
            console.error('Error fetching protocol stats:', error);
        });
}

function fetchPackets() {
    // Build query parameters
    const params = new URLSearchParams({
        page: String(packetPage),
        limit: String(packetsPerPage)
    });
    
    if (packetFilters.srcIp) params.append('src_ip', packetFilters.srcIp);
    if (packetFilters.dstIp) params.append('dst_ip', packetFilters.dstIp);
    if (packetFilters.protocol) params.append('protocol', packetFilters.protocol);
    
    fetch(`/api/packets?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
            updatePacketsTable(data);
        })
        .catch(error => {
            console.error('Error fetching packets:', error);
        });
}

function updatePacketsTable(data) {
    const tbody = document.getElementById('packets-table-body');
    tbody.innerHTML = '';
    
    if (!data.packets || data.packets.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="7">No packets found</td>';
        tbody.appendChild(tr);
        return;
    }
    
    data.packets.forEach(packet => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDateTime(packet.timestamp)}</td>
            <td>${packet.src_ip}</td>
            <td>${packet.dst_ip}</td>
            <td>${packet.protocol || 'Unknown'}</td>
            <td>${packet.src_port || '-'}</td>
            <td>${packet.dst_port || '-'}</td>
            <td>${formatBytes(packet.payload_size)}</td>
        `;
        tbody.appendChild(tr);
    });
    
    const totalPages = Math.ceil(data.total_count / packetsPerPage);
    document.getElementById('page-info').textContent = `Page ${packetPage} of ${totalPages || 1}`;
    
    updateProtocolFilterOptions(data.protocols);
}

function addNewPacketToTable(packet) {
    const tbody = document.getElementById('packets-table-body');
    const rows = tbody.getElementsByTagName('tr');
    
    if (rows.length === 1 && rows[0].cells.length === 1 && rows[0].cells[0].colSpan === 7) {
        tbody.innerHTML = '';
    }
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${formatDateTime(packet.timestamp)}</td>
        <td>${packet.src_ip}</td>
        <td>${packet.dst_ip}</td>
        <td>${packet.protocol || 'Unknown'}</td>
        <td>${packet.src_port || '-'}</td>
        <td>${packet.dst_port || '-'}</td>
        <td>${formatBytes(packet.payload_size)}</td>
    `;
    tr.classList.add('new-packet');
    tbody.insertBefore(tr, tbody.firstChild);
    
    setTimeout(() => {
        tr.classList.remove('new-packet');
    }, 2000);
    
    if (rows.length > packetsPerPage) {
        tbody.removeChild(tbody.lastChild);
    }
}

function updateProtocolFilterOptions(protocols) {
    if (!protocols || !Array.isArray(protocols)) return;
    
    const select = /** @type {HTMLSelectElement} */ (document.getElementById('filter-protocol'));
    const currentValue = select.value;
    
    const allOption = select.options[0];
    
    select.innerHTML = '';
    select.appendChild(allOption);
    
    protocols.forEach(protocol => {
        const option = document.createElement('option');
        option.value = protocol;
        option.textContent = protocol || 'Unknown';
        select.appendChild(option);
    });
    
    if (currentValue) {
        select.value = currentValue;
    }
}

function fetchAlerts() {
    const severity = /** @type {HTMLSelectElement} */ (document.getElementById('alert-severity')).value;
    const search = /** @type {HTMLInputElement} */ (document.getElementById('alert-search')).value;
    
    const params = new URLSearchParams();
    if (severity) params.append('severity', severity);
    if (search) params.append('search', search);
    
    fetch(`/api/alerts?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
            updateAlertsContainer(data);
        })
        .catch(error => {
            console.error('Error fetching alerts:', error);
        });
}

function updateAlertsContainer(data) {
    const container = document.getElementById('alerts-container');
    container.innerHTML = '';
    
    if (!data.alerts || data.alerts.length === 0) {
        container.innerHTML = '<p class="empty-message">No alerts found</p>';
        return;
    }
    
    data.alerts.forEach(alert => {
        const severity = determineSeverity(alert);
        const alertDiv = document.createElement('div');
        alertDiv.classList.add('alert-item', severity);
        
        alertDiv.innerHTML = `
            <div class="alert-header">
                <span class="alert-title">${getAlertTitle(alert)}</span>
                <span class="alert-time">${formatDateTime(alert.timestamp)}</span>
            </div>
            <div class="alert-details">
                ${alert.src_ip} → ${alert.dst_ip} (${alert.protocol || 'Unknown'})
                ${alert.threat_type ? `<br>Threat: ${alert.threat_type}` : ''}
            </div>
        `;
        
        container.appendChild(alertDiv);
    });
}

function addNewAlert(alert) {
    const container = document.getElementById('alerts-container');
    const emptyMessage = container.querySelector('.empty-message');
    
    if (emptyMessage) {
        container.innerHTML = '';
    }
    
    const severity = determineSeverity(alert);
    const alertDiv = document.createElement('div');
    alertDiv.classList.add('alert-item', severity, 'new-alert');
    
    alertDiv.innerHTML = `
        <div class="alert-header">
            <span class="alert-title">${getAlertTitle(alert)}</span>
            <span class="alert-time">${formatDateTime(alert.timestamp)}</span>
        </div>
        <div class="alert-details">
            ${alert.src_ip} → ${alert.dst_ip} (${alert.protocol || 'Unknown'})
            ${alert.threat_type ? `<br>Threat: ${alert.threat_type}` : ''}
        </div>
    `;
    
    container.insertBefore(alertDiv, container.firstChild);
    
    setTimeout(() => {
        alertDiv.classList.remove('new-alert');
    }, 2000);
}

function determineSeverity(alert) {
    if (alert.is_malicious && alert.threat_type) {
        return 'high';
    } else if (alert.is_malicious) {
        return 'medium';
    } else {
        return 'low';
    }
}

function getAlertTitle(alert) {
    if (alert.threat_type) {
        return `${alert.threat_type} Detected`;
    } else if (alert.is_malicious) {
        return 'Suspicious Activity Detected';
    } else {
        return 'Network Alert';
    }
}

function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatBytes(bytes) {
    if (bytes === null || bytes === undefined) return '0 B';
    bytes = Number(bytes);
    
    if (bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDateTime(datetime) {
    if (!datetime) return '';
    
    const date = new Date(datetime);
    if (isNaN(date.getTime())) return datetime;
    
    return date.toLocaleString();
}

/**
 * Debounce function to limit how often a function is called
 * @param {Function} func - The function to debounce
 * @param {number} wait - The time to wait in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
} 
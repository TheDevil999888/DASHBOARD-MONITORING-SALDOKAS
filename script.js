let refreshTimer = null;
let CURRENT_SECTIONS = []; // Global store for latest fetched data
let latestCloudData = null;
let cloudSettings = {};
let cloudMineraAccounts = {};

document.addEventListener('DOMContentLoaded', () => {
    loadSettings(); // Load saved settings on startup
    loadAutoRefreshSettings(); // Load auto-refresh settings
    fetchData();
    setInterval(updateTime, 1000);
    updateTime();

    // Listener for interval change
    const intervalInput = document.getElementById('refresh-interval');
    if (intervalInput) {
        intervalInput.addEventListener('change', () => {
            saveAutoRefreshSettings();
            // If currently active, restart to apply new time
            if (document.getElementById('auto-refresh-toggle').checked) {
                startAutoRefresh();
            }
        });
    }

    // Minera 'Check All' Listener
    const checkAllMinera = document.getElementById('check-all-minera');
    if (checkAllMinera) {
        checkAllMinera.addEventListener('change', function () {
            const checkboxes = document.querySelectorAll('#minera-table-body .minera-check');
            checkboxes.forEach(cb => cb.checked = this.checked);
        });
    }
});

// ... (fetchData and handleExtract remain seemingly unchanged, showing below for context) ...

// Auto Refresh Logic
function loadAutoRefreshSettings() {
    const isAuto = localStorage.getItem('autoRefreshActive') === 'true';
    const interval = localStorage.getItem('autoRefreshInterval') || '60';

    const toggle = document.getElementById('auto-refresh-toggle');
    const input = document.getElementById('refresh-interval');

    if (toggle) toggle.checked = isAuto;
    if (input) input.value = interval;

    if (isAuto) {
        startAutoRefresh();
    }
}

function saveAutoRefreshSettings() {
    const toggle = document.getElementById('auto-refresh-toggle');
    const input = document.getElementById('refresh-interval');

    if (toggle) localStorage.setItem('autoRefreshActive', toggle.checked);
    if (input) localStorage.setItem('autoRefreshInterval', input.value);
}

function toggleAutoRefresh() {
    const toggle = document.getElementById('auto-refresh-toggle');
    saveAutoRefreshSettings();

    if (toggle && toggle.checked) {
        startAutoRefresh();
    } else {
        stopAutoRefresh();
    }
}


function startAutoRefresh() {
    stopAutoRefresh(); // Clear existing

    const input = document.getElementById('refresh-interval');
    const autoLabel = document.getElementById('auto-refresh-label');

    // Safety check if element exists (e.g. if container changed)
    if (!autoLabel) {
        console.warn("Auto Refresh label not found");
        return;
    }

    let secondsTotal = parseInt(input.value);
    if (isNaN(secondsTotal) || secondsTotal < 1) secondsTotal = 60; // Default to 60 if invalid, but allow values down to 1s

    let timeLeft = secondsTotal;

    // Update label immediately
    if (document.getElementById('timer-display')) {
        document.getElementById('timer-display').textContent = `(${timeLeft}s)`;
    }

    console.log(`Auto Refresh started: ${secondsTotal} seconds`);

    refreshTimer = setInterval(() => {
        timeLeft--;
        if (document.getElementById('timer-display')) {
            document.getElementById('timer-display').textContent = `(${timeLeft}s)`;
        }

        if (timeLeft <= 0) {
            runExtraction(true);
            timeLeft = secondsTotal; // Reset timer loop
            if (document.getElementById('timer-display')) {
                document.getElementById('timer-display').textContent = `(${timeLeft}s)`;
            }
        }
    }, 1000);
}

function stopAutoRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer); // Use clearInterval for setInterval
        refreshTimer = null;
        console.log("Auto Refresh stopped");
    }
    // Reset label text
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) timerDisplay.textContent = "";
}

let lastDataString = "";

// ==========================================
// FIREBASE SYNC LOGIC
// ==========================================
let isMaster = false; // Flag to determine if this PC is the source

function listenToFirebase() {
    if (typeof firebase === 'undefined' || !db) {
        console.warn("Firebase not initialized. Check firebase-config.js");
        const syncText = document.getElementById('sync-text');
        if (syncText) syncText.textContent = "FIREBASE ERROR";
        return;
    }

    const dataRef = firebase.database().ref('dashboard_data');

    // Check connection status
    const connectedRef = firebase.database().ref(".info/connected");
    connectedRef.on("value", (snap) => {
        if (snap.val() === true) {
            console.log("FIREBASE: Connected.");
            const syncText = document.getElementById('sync-text');
            if (syncText) {
                syncText.textContent = "LIVE CONNECTED";
                syncText.style.color = "#34d399";
            }
        } else {
            console.log("FIREBASE: Disconnected.");
            const syncText = document.getElementById('sync-text');
            if (syncText) {
                syncText.textContent = "RECONNECTING...";
                syncText.style.color = "#fbbf24";
            }
        }
    });

    // Listen for updates from Cloud
    dataRef.on('value', (snapshot) => {
        const cloudData = snapshot.val();
        if (cloudData) {
            console.log("FIREBASE: New Data Received");
            latestCloudData = cloudData;
            renderCloudData(cloudData);

            const syncText = document.getElementById('sync-text');
            if (syncText && syncText.textContent === "LIVE CONNECTED") {
                syncText.textContent = "DATA UPDATED!";
                setTimeout(() => { syncText.textContent = "LIVE CONNECTED"; }, 2000);
            }
        }
    });

    // SYNC SETTINGS (Live sync settings across PCs)
    firebase.database().ref('settings').on('value', (snapshot) => {
        const settings = snapshot.val();
        if (settings) {
            console.log("FIREBASE: Settings synchronized");
            cloudSettings = settings;
            // Update UI if modal is not active or just update it anyway
            Object.keys(settings).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = settings[id];
            });
        }
    });

    // SYNC MINERA ACCOUNTS (Live sync account numbers)
    firebase.database().ref('minera_accounts').on('value', (snapshot) => {
        const accounts = snapshot.val();
        if (accounts) {
            console.log("FIREBASE: Minera accounts synchronized");
            cloudMineraAccounts = accounts;
            // If the modal is currently open, we might want to re-populate to show new numbers
            const modal = document.getElementById('minera-modal');
            if (modal && modal.classList.contains('active')) {
                // Optional: avoid re-populating if user is typing
                // For now, let's just let it update on next open or manual save
            }
        }
    });
}

function renderCloudData(cloudData) {
    if (!cloudData) return;

    const titleEl = document.getElementById('dashboard-title');
    if (cloudData.dashboardTitle && titleEl) titleEl.textContent = cloudData.dashboardTitle;

    const syncText = document.getElementById('sync-text');
    if (syncText) {
        // In peer-to-peer, everyone is "LIVE CLOUD DATA" effectively
        syncText.textContent = "LIVE DATA RECEIVED";
        syncText.style.color = "#34d399";
        setTimeout(() => {
            // Revert to connection status
            const connected = firebase.database().ref(".info/connected");
            connected.once("value", snap => {
                if (snap.val()) syncText.textContent = "LIVE CONNECTED";
            });
        }, 1500);
    }

    // FIREBASE FIX: Handle missing 'sections' wrapper
    // Sometimes data is pushed directly as array of sections, or inside 'sections' key
    let sectionsToRender = cloudData.sections;
    if (!sectionsToRender && Array.isArray(cloudData)) {
        sectionsToRender = cloudData;
    }

    // Debug Log
    console.log("Rendering Cloud Data:", sectionsToRender);

    if (sectionsToRender) {
        renderDashboard(sectionsToRender);
        CURRENT_SECTIONS = sectionsToRender;
    } else {
        console.error("Cloud Data missing 'sections' property:", cloudData);
        alert("Format Data Salah dari Cloud (Missing Sections)");
    }
}



function pushToFirebase(data) {
    if (typeof firebase === 'undefined' || !db) return;

    // VALIDATION: Prevent pushing empty/invalid data which wipes the dashboard
    if (!data || !data.sections || !Array.isArray(data.sections)) {
        console.error("PUSH ABORTED: Invalid Data Structure", data);
        return;
    }

    // Check content validity (at least one section has data)
    const hasContent = data.sections.some(s => s.data && s.data.length > 0);
    if (!hasContent) {
        console.warn("PUSH WARNING: Attempting to push empty data sections. This will clear the dashboard.");
        // Optional: return; // Uncomment to strictly forbid empty pushes
    }

    console.log("Pushing data to Firebase...", data);

    const dataRef = firebase.database().ref('dashboard_data');
    dataRef.set(data).then(() => {
        console.log("Data successfully pushed to Cloud");
        const syncText = document.getElementById('sync-text');
        if (syncText) {
            syncText.textContent = "SENDING UPDATE...";
            syncText.style.color = "#eab308";
            setTimeout(() => {
                syncText.textContent = "LIVE CONNECTED";
                syncText.style.color = "#34d399";
            }, 1000);
        }
    }).catch((error) => {
        console.error("Firebase Push Error: ", error);
        const syncText = document.getElementById('sync-text');
        if (syncText) {
            if (error.code === 'PERMISSION_DENIED') {
                syncText.textContent = "AKSES DITOLAK (RULES)";
            } else {
                syncText.textContent = "PUSH ERROR";
            }
            syncText.style.color = "#ef4444";
        }
    });
}


async function fetchData() {
    // In Peer-to-Peer mode, we try to load local data.
    // If it exists, we assume THIS PC has relevant data and broadcast it.
    // If not, we just wait for Firebase data via listenToFirebase().

    // DEBUG: Add a "Check Cloud" button to the header for manual diagnostics
    const header = document.querySelector('.dashboard-header .header-actions');
    if (header && !document.getElementById('debug-cloud-btn')) {
        const btn = document.createElement('button');
        btn.id = 'debug-cloud-btn';
        btn.textContent = '❓ DIAGNOSE';
        btn.style.background = '#6b7280';
        btn.style.color = 'white';
        btn.style.fontSize = '10px';
        btn.style.padding = '4px 8px';
        btn.onclick = () => {
            if (latestCloudData) {
                const s1 = (latestCloudData.sections && latestCloudData.sections[0]) ? latestCloudData.sections[0] : null;
                const rowCount = (s1 && s1.data && s1.data[0]) ? s1.data[0].length : 0;

                alert("CLOUD CACHE FOUND!\nTitle: " + latestCloudData.dashboardTitle + "\nSection 1 Rows: " + rowCount);
                console.log("FULL CLOUD DATA:", latestCloudData);

                // Force Re-Render
                renderCloudData(latestCloudData);
            } else {
                alert("NO CLOUD DATA CACHED YET.\nInternet: " + navigator.onLine);
                // Force a re-fetch from Firebase directly
                if (firebase && firebase.database()) {
                    firebase.database().ref('dashboard_data').once('value').then(snap => {
                        const val = snap.val();
                        alert("MANUAL FETCH RESULT: " + (val ? "DATA FOUND" : "NULL"));
                        if (val) renderCloudData(val);
                    }).catch(e => alert("FETCH ERROR: " + e.message));
                }
            }
        };
        header.appendChild(btn);
    }

    try {
        const response = await fetch('data.json');
        if (response.ok) {
            console.log("Local data.json found. Loading and broadcasting...");
            const data = await response.json();

            // Update UI
            const titleEl = document.getElementById('dashboard-title');
            if (data.dashboardTitle) titleEl.textContent = data.dashboardTitle;

            // Render Local Data
            renderDashboard(data.sections);
            CURRENT_SECTIONS = data.sections;

            // DO NOT PUSH local data to cloud on startup!
            // This prevents overwriting live cloud data with stale local file data.
            // pushToFirebase(data); 

            updateDashboardMeta();
        } else {
            console.log("No local data.json found. Waiting for Cloud Data...");
        }
    } catch (e) {
        console.log("Local fetch failed/skipped. Waiting for Cloud Data...");
    }
}

// TOGGLE MODE FUNCTION
function toggleSyncMode() {
    forceClient = !forceClient;
    localStorage.setItem('forceClient', forceClient);

    if (forceClient) {
        alert("Mode Berubah: CLIENT MODE. Dashboard ini hanya akan MENERIMA data.");
        isMaster = false;
        fetchData();
    } else {
        alert("Mode Berubah: MASTER MODE. Dashboard ini akan MENGIRIM data lokal (jika ada).");
        isMaster = true; // Will try to be master on next fetch
        fetchData();
    }
}

// Call listener on startup
document.addEventListener('DOMContentLoaded', () => {
    // Add Click Listener to Sync Text for Mode Toggle
    const syncText = document.getElementById('sync-text');
    if (syncText) {
        syncText.style.cursor = 'pointer';
        syncText.title = "KLIK UNTUK GANTI MODE (MASTER/CLIENT)";
        syncText.addEventListener('click', toggleSyncMode);
    }

    // STARTUP SEQUENCE
    fetchData(); // Try to load local data (Master check)
    listenToFirebase(); // Start listening to cloud (Client/Sync check)

    // Start interval for time
    setInterval(updateTime, 1000);
    updateTime();
});

// Function to handle the "Extract" button click (Mock Logic for now)
function handleExtract() {
    runExtraction(false); return;
    /*
    // Save settings first
    saveSettings();
    
    // Get Data Source 1
    const link1 = document.getElementById('sheet-link-1').value;
    const sheet1 = document.getElementById('sheet-name-1').value;
    const range1 = document.getElementById('sheet-range-1').value;
    const max1 = document.getElementById('sheet-max-1').value;
    
    // Get Data Source 2
    const link2 = document.getElementById('sheet-link-2').value;
    const sheet2 = document.getElementById('sheet-name-2').value;
    const range2 = document.getElementById('sheet-range-2').value;
    const max2 = document.getElementById('sheet-max-2').value;
    
    if (!link1 && !link2) {
        alert("Please enter at least one Google Sheet Link!");
        return;
    }
    
    console.log("Source 1:", { link: link1, sheet: sheet1, range: range1, maxTampung: max1 });
    console.log("Source 2:", { link: link2, sheet: sheet2, range: range2, maxTampung: max2 });
    
    // In a real extension, this would send a message to background.js or content.js
    // For now, we simulate a "Refresh" or "Extraction" effect
    const btn = document.querySelector('.btn-save');
    if (btn) {
        const originalText = btn.textContent;
        btn.textContent = "Extracting...";
        btn.disabled = true;
    
        setTimeout(() => {
            btn.textContent = "Success!";
    
            // SIMULATION: Update the Dashboard Sheet Names immediately
            updateDashboardMeta();
    
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
                alert("Settings Saved & Data Extracted! (Simulation)");
                // In real app: location.reload() might be needed if full re-fetch
                // location.reload(); 
                closeSettings();
            }, 1000);
        }, 1500);
        */
}

function openSettings() {
    document.getElementById('settings-modal').classList.add('active');
}

function closeSettings() {
    document.getElementById('settings-modal').classList.remove('active');
}

// LocalStorage & Firebase Helpers
function saveSettings() {
    const ids = [
        'sheet-link-1', 'sheet-name-1', 'sheet-range-1', 'sheet-max-1',
        'sheet-link-2', 'sheet-name-2', 'sheet-range-2', 'sheet-max-2'
    ];
    const settingsObj = {};
    ids.forEach(id => {
        const val = document.getElementById(id).value;
        localStorage.setItem(id, val);
        settingsObj[id] = val;
    });

    // PUSH SETTINGS TO CLOUD
    if (typeof firebase !== 'undefined' && db) {
        db.ref('settings').set(settingsObj);
    }
}

function loadSettings() {
    const ids = [
        'sheet-link-1', 'sheet-name-1', 'sheet-range-1', 'sheet-max-1',
        'sheet-link-2', 'sheet-name-2', 'sheet-range-2', 'sheet-max-2'
    ];
    ids.forEach(id => {
        const val = localStorage.getItem(id);
        if (val !== null) {
            document.getElementById(id).value = val;
        }
    });
}

function clearAllSettings() {
    if (confirm("Apakah Anda yakin ingin MENGHAPUS DATA SETTING? Link dan konfigurasi Google Sheet akan dikosongkan.")) {
        const ids = [
            'sheet-link-1', 'sheet-name-1', 'sheet-range-1', 'sheet-max-1',
            'sheet-link-2', 'sheet-name-2', 'sheet-range-2', 'sheet-max-2'
        ];

        // Remove from localStorage
        ids.forEach(id => {
            localStorage.removeItem(id);
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        // Also update Firebase if active
        if (typeof firebase !== 'undefined' && db) {
            db.ref('settings').remove();
        }

        alert("Data setting telah dikosongkan. Halaman akan dimuat ulang.");
        location.reload();
    }
}

function updateDashboardMeta() {
    // Update the "From: [Sheet Name] [Range]" text on the dashboard

    // Arrays to map inputs to sections
    const sources = [
        { id: 'sheet-meta-0', nameInput: 'sheet-name-1', rangeInput: 'sheet-range-1' },
        { id: 'sheet-meta-1', nameInput: 'sheet-name-2', rangeInput: 'sheet-range-2' }
    ];

    sources.forEach(source => {
        const metaEl = document.getElementById(source.id);
        const nameVal = document.getElementById(source.nameInput).value;

        if (metaEl) {
            let html = '<span class="sheet-status-dot"></span>';
            html += ` <span class="source-text">Source: ${nameVal || 'Sheet'}</span>`;
            metaEl.innerHTML = html;
        }
    });
}

function renderDashboard(inputSections) {
    if (!inputSections) return;

    // FIREBASE FIX: Ensure sections is an Array
    const sections = Array.isArray(inputSections) ? inputSections : Object.values(inputSections);

    const container = document.getElementById('main-content');
    if (!container) return; // Safety

    // Capture Global Scroll (Anunnaki Stabilizer)
    const scrollTop = container.scrollTop;

    // Check if we need a full rebuild (First load or structure change)
    const existingRows = container.querySelectorAll('.section-row');
    const needsFullRebuild = existingRows.length !== sections.length;

    if (needsFullRebuild) {
        container.innerHTML = ''; // Only clear if structure changes
    }

    // Accumulators for Footer Detailed Stats
    const detailedStats = {
        '25': { count: 0, total: 0 },
        '50': { count: 0, total: 0 },
        '100': { count: 0, total: 0 },
        '150': { count: 0, total: 0 },
        '200': { count: 0, total: 0 },
        '250': { count: 0, total: 0 }
    };

    let totalReadyAll = 0;

    sections.forEach((section, index) => {
        let rowEl;
        let scrollArea;

        if (!needsFullRebuild && existingRows[index]) {
            rowEl = existingRows[index];
            scrollArea = rowEl.querySelector('.horizontal-scroll-area');
        } else {
            rowEl = document.createElement('div');
            rowEl.className = `section-row theme-${section.theme || 'blue'}`;

            const labelEl = document.createElement('div');
            labelEl.className = 'section-label';

            const titleH2 = document.createElement('h2');
            titleH2.className = 'section-title';
            titleH2.textContent = section.title;

            const metaDiv = document.createElement('div');
            metaDiv.className = 'sheet-meta';
            metaDiv.id = `sheet-meta-${index}`;

            metaDiv.innerHTML = `<span class="sheet-status-dot"></span> <span class="source-text">Source: ${section.sheetName || 'Sheet'}</span>`;

            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'label-summary';
            summaryDiv.innerHTML = `
                <div class="summary-item">
                    <span class="summary-label">READY SUMMARY</span>
                    <div class="summary-data">
                        <span id="ready-count-${section.id}" class="summary-count">0</span>
                        <span id="ready-total-${section.id}" class="summary-amount">Rp 0</span>
                    </div>
                </div>
            `;

            // Lantern Left (Section)
            const lanternLeft = document.createElement('div');
            lanternLeft.className = 'cny-lantern-hang section-lantern-left';
            lanternLeft.innerHTML = `
                <div class="lantern-string"></div>
                <div class="lantern-container">
                    <div class="lantern-top-cap"></div>
                    <div class="lantern-shape">
                        <div class="rib-c"></div><div class="rib-l"></div><div class="rib-r"></div>
                    </div>
                    <div class="lantern-bottom-cap"></div>
                    <div class="lantern-knot"></div>
                    <div class="lantern-tassel-end"></div>
                </div>
            `;

            // Lantern Right (Section)
            const lanternRight = document.createElement('div');
            lanternRight.className = 'cny-lantern-hang section-lantern-right';
            lanternRight.innerHTML = `
                <div class="lantern-string"></div>
                <div class="lantern-container">
                    <div class="lantern-top-cap"></div>
                    <div class="lantern-shape">
                        <div class="rib-c"></div><div class="rib-l"></div><div class="rib-r"></div>
                    </div>
                    <div class="lantern-bottom-cap"></div>
                    <div class="lantern-knot"></div>
                    <div class="lantern-tassel-end"></div>
                </div>
            `;

            labelEl.appendChild(lanternLeft);
            labelEl.appendChild(titleH2);
            labelEl.appendChild(metaDiv);
            labelEl.appendChild(summaryDiv);
            labelEl.appendChild(lanternRight);
            rowEl.appendChild(labelEl);

            scrollArea = document.createElement('div');
            scrollArea.className = 'horizontal-scroll-area';
            rowEl.appendChild(scrollArea);
            container.appendChild(rowEl);
        }

        const currentScrollLeft = scrollArea.scrollLeft;
        let cardsHTML = '';
        let hasCards = false;
        let sectionReadyCount = 0;
        let sectionReadyTotal = 0;

        let rawData = section.data;
        if (rawData && !Array.isArray(rawData)) {
            const arr = [];
            if (rawData['0']) arr[0] = rawData['0'];
            if (rawData['1']) arr[1] = rawData['1'];
            if (rawData['2']) arr[2] = rawData['2'];
            if (rawData['3']) arr[3] = rawData['3'];
            rawData = arr;
        }

        if (rawData && Array.isArray(rawData) && rawData.length > 0) {
            const nameRow = rawData[0] || [];
            const nomRow = rawData[1] || [];
            const statRow = rawData[2] || [];
            const limRow = rawData[3] || [];
            const renderCount = nameRow.length;

            for (let col = 0; col < renderCount; col++) {
                const name = (nameRow[col] || '').toString().trim();
                const nominal = nomRow[col] || '-';
                const status = (statRow[col] || '').toString().toUpperCase();
                const limit = (limRow[col] || 'MAX 25JT').toString().toUpperCase();

                if (!name && nominal === '-') continue;

                cardsHTML += createCardHTML(limit, name || '-', nominal, status);
                hasCards = true;

                if (status.includes('READY')) {
                    const amount = parseNominal(nominal);
                    sectionReadyCount++;
                    sectionReadyTotal += amount;
                    totalReadyAll += amount;

                    // Update Global Detailed Stats Categories
                    let limitKey = '25';
                    if (limit.includes('250')) limitKey = '250';
                    else if (limit.includes('200')) limitKey = '200';
                    else if (limit.includes('150')) limitKey = '150';
                    else if (limit.includes('100')) limitKey = '100';
                    else if (limit.includes('50')) limitKey = '50';

                    if (detailedStats[limitKey]) {
                        detailedStats[limitKey].count++;
                        detailedStats[limitKey].total += amount;
                    }
                }
            }
        }

        if (!hasCards) {
            cardsHTML = `<div style="padding:20px; color:#94a3b8; font-size: 11px;"><em>No data loaded.</em></div>`;
        }

        scrollArea.innerHTML = cardsHTML;
        scrollArea.scrollLeft = currentScrollLeft;

        const countEl = document.getElementById(`ready-count-${section.id}`);
        const totalEl = document.getElementById(`ready-total-${section.id}`);
        if (countEl) countEl.textContent = sectionReadyCount;
        if (totalEl) totalEl.textContent = formatIDR(sectionReadyTotal);
    });

    container.scrollTop = scrollTop;

    // Update Grand Total Box
    const grandTotalEl = document.getElementById('grand-total-amount');
    if (grandTotalEl) grandTotalEl.textContent = formatIDR(totalReadyAll);

    // Update Footer Detailed Stats Hubs
    const hubs = ['25', '50', '100', '150', '200', '250'];
    hubs.forEach(h => {
        const countEl = document.getElementById(`stat-count-${h}`);
        const totalEl = document.getElementById(`stat-total-${h}`);
        if (countEl) countEl.textContent = `${detailedStats[h].count} BANK`;
        if (totalEl) totalEl.textContent = formatIDR(detailedStats[h].total);
    });
}

// Convert createCard to return HTML string instead of Element for performance
function createCardHTML(limit, name, nominal, status) {
    // Determine status class
    let statusClass = '';
    let statusText = status ? status.toUpperCase() : 'UNKNOWN';

    if (statusText.includes('READY')) statusClass = 'status-ready';
    else if (statusText.includes('OFF')) statusClass = 'status-off';
    else if (statusText.includes('CABUT') || statusText.includes('BLOCKED')) statusClass = 'status-blocked';

    // Auto-replace dots with commas
    let displayNominal = nominal || "-";
    if (typeof displayNominal === 'string' && displayNominal.indexOf('.') !== -1 && displayNominal.indexOf(',') === -1) {
        displayNominal = displayNominal.replace(/\./g, ',');
    }

    // Highlight large amounts & Format Accounting Style
    const rawVal = parseNominal(displayNominal);
    const nominalColor = rawVal > 10000000 ? '#ef4444' : 'var(--palette-success-400, #4ade80)'; // Red if > 10jt
    const nominalWeight = rawVal > 10000000 ? 'bold' : '700';

    // Force Accounting Format (Parentheses) if negative
    if (rawVal < 0) {
        displayNominal = `(${Math.abs(rawVal).toLocaleString('en-US')})`;
    }

    // Determine limit class for coloring
    let limitClass = '';
    const limitUpper = String(limit).toUpperCase();

    if (limitUpper.includes('250')) limitClass = 'limit-250';
    else if (limitUpper.includes('200')) limitClass = 'limit-200';
    else if (limitUpper.includes('150')) limitClass = 'limit-150';
    else if (limitUpper.includes('100')) limitClass = 'limit-100';
    else if (limitUpper.includes('50')) limitClass = 'limit-50';
    else if (limitUpper.includes('25')) limitClass = 'limit-25';
    else if (limitUpper.includes('20')) limitClass = 'limit-20';
    else if (limitUpper.includes('TAMPUNG')) limitClass = 'limit-special';

    return `
    <div class="data-card">
        <div class="card-header ${limitClass}" title="${limit}">${limit}</div>
        <div class="card-body">${name}</div>
        <div class="card-nominal" style="color: ${nominalColor}; font-weight: ${nominalWeight};">${displayNominal}</div>
        <div class="card-footer"><span class="status-badge ${statusClass}">${statusText}</span></div>
    </div>
    `;
}

// ... existing code ...

function formatIDR(num) {
    // Using en-US to get commas for thousands (Rp 10,000)
    // ACCOUNTING FORMAT: (10,000) for negative
    if (num < 0) {
        return 'Rp (' + Math.abs(num).toLocaleString('en-US') + ')';
    }
    return 'Rp ' + num.toLocaleString('en-US');
}

// ==========================================
// MINERA PENCAIRAN MODAL LOGIC
// ==========================================

function openMineraModal() {
    const modal = document.getElementById('minera-modal');
    if (!modal) return;
    modal.classList.add('active');
    populateMineraTable();
}

function closeMineraModal() {
    const modal = document.getElementById('minera-modal');
    if (modal) modal.classList.remove('active');
}

function openVipModal() {
    alert("Functionality for VIP Pencairan coming soon.");
}



function populateMineraTable() {
    const tbody = document.getElementById('minera-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Global Accumulators for Footer (Matching Main Dashboard Logic)
    let globalReadyCount = 0;
    let globalTotalBalance = 0;

    // Process all sections (Kotor & Bersih)
    if (typeof CURRENT_SECTIONS !== 'undefined' && Array.isArray(CURRENT_SECTIONS)) {
        CURRENT_SECTIONS.forEach(section => {
            if (!section.data || section.data.length === 0) return;

            // Data Rows Mapping
            const nameRow = section.data[0] || [];
            const nomRow = section.data[1] || [];
            const statRow = section.data[2] || [];
            const limRow = section.data[3] || [];

            const colCount = nameRow.length;

            for (let i = 0; i < colCount; i++) {
                const name = (nameRow[i] || '').trim();
                const nominalStr = nomRow[i] || '-';
                const status = (statRow[i] || '').toUpperCase();
                const limit = limRow[i] || 'MAX -';

                if (!name && nominalStr === '-') continue;

                const isReady = status.includes('READY');
                if (!isReady) continue; // ONLY SHOW READY BANKS

                // Update Global Totals (Per Unique Bank)
                globalReadyCount++;
                globalTotalBalance += parseNominal(nominalStr);

                // Parse Bank and Proper Name
                let bank = "OTHER";
                let actualName = name;
                const upperName = name.toUpperCase();

                if (upperName.includes('BCA')) bank = "BCA";
                else if (upperName.includes('BRI')) bank = "BRI";
                else if (upperName.includes('BNI')) bank = "BNI";
                else if (upperName.includes('MANDIRI')) bank = "MANDIRI";
                else if (upperName.includes('DANAMON')) bank = "DANAMON";
                else if (upperName.includes('SINARMAS')) bank = "SINARMAS";
                else if (upperName.includes('CIMB')) bank = "CIMB";
                else if (upperName.includes('PERMATA')) bank = "PERMATA";
                else if (upperName.includes('MAYBANK')) bank = "MAYBANK";
                else if (upperName.includes('PANIN')) bank = "PANIN";
                else if (upperName.includes('OCBC')) bank = "OCBC";
                else if (upperName.includes('HSBC')) bank = "HSBC";
                else if (upperName.includes('BTN')) bank = "BTN";
                else if (upperName.includes('BSI')) bank = "BSI";
                else if (upperName.includes('MEGA')) bank = "MEGA";
                else if (upperName.includes('MUAMALAT')) bank = "MUAMALAT";

                if (name.includes('/')) {
                    const parts = name.split('/');
                    actualName = parts[1].trim();
                } else {
                    actualName = name.replace(/KAS\s+/gi, '')
                        .replace(/BCA|BRI|BNI|MANDIRI|DANAMON|SINARMAS|CIMB|PERMATA|MAYBANK|PANIN|OCBC|HSBC|BTN|BSI|MEGA|MUAMALAT/gi, '')
                        .replace(/^\s*[\/\-]\s*/, '')
                        .trim();
                }

                const totalNominal = parseNominal(nominalStr);
                const limitUpper = limit.toUpperCase();
                let splitIdx = 0;

                if (limitUpper.includes('200')) {
                    createMineraRow(tbody, limit, isReady, bank, section.theme, actualName, totalNominal, 33333334, splitIdx++);
                    createMineraRow(tbody, limit, isReady, bank, section.theme, actualName, totalNominal, 33333333, splitIdx++);
                    createMineraRow(tbody, limit, isReady, bank, section.theme, actualName, totalNominal, 33333333, splitIdx++);
                    createMineraRow(tbody, limit, isReady, bank, section.theme, actualName, totalNominal, 33333333, splitIdx++);
                    createMineraRow(tbody, limit, isReady, bank, section.theme, actualName, totalNominal, 33333333, splitIdx++);
                    createMineraRow(tbody, limit, isReady, bank, section.theme, actualName, totalNominal, 33333334, splitIdx++);
                } else if (limitUpper.includes('150')) {
                    for (let j = 0; j < 5; j++) {
                        createMineraRow(tbody, limit, isReady, bank, section.theme, actualName, totalNominal, 30000000, splitIdx++);
                    }
                } else if (limitUpper.includes('100')) {
                    createMineraRow(tbody, limit, isReady, bank, section.theme, actualName, totalNominal, 37999999, splitIdx++);
                    createMineraRow(tbody, limit, isReady, bank, section.theme, actualName, totalNominal, 37999998, splitIdx++);
                    createMineraRow(tbody, limit, isReady, bank, section.theme, actualName, totalNominal, 24000003, splitIdx++);
                } else if (limitUpper.includes('50')) {
                    createMineraRow(tbody, limit, isReady, bank, section.theme, actualName, totalNominal, 24999998, splitIdx++);
                    createMineraRow(tbody, limit, isReady, bank, section.theme, actualName, totalNominal, 25000002, splitIdx++);
                } else {
                    let rowCap = 25000000;
                    if (limitUpper.includes('25')) rowCap = 24999999;
                    else if (limitUpper.includes('20')) rowCap = 19999999;
                    createMineraRow(tbody, limit, isReady, bank, section.theme, actualName, totalNominal, rowCap, splitIdx++);
                }
            }
        });
    }

    // UPDATE FOOTER SUMMARY WITH GLOBAL TOTALS
    const countEl = document.getElementById('minera-ready-count');
    const balanceEl = document.getElementById('minera-total-balance');

    if (countEl) countEl.textContent = globalReadyCount;
    if (balanceEl) balanceEl.textContent = formatIDR(globalTotalBalance);

    // Initial total out
    if (typeof updateMineraTotalOut === 'function') {
        updateMineraTotalOut();
    }

    // NOTE: recalculateMineraTotals() is deliberately skipped here for the main totals 
    // to ensure they reflect the STATIC Global Dashboard totals as requested.
    // However, we still need listeners for "Check All" to existing checks logic if needed,
    // but we will NOT update the footer counts on check changes anymore.

    const checkAll = document.getElementById('check-all-minera');
    if (checkAll) {
        // Remove old listener to avoid duplicates if any (proper way is named function but this works for now)
        const newCheckAll = checkAll.cloneNode(true);
        checkAll.parentNode.replaceChild(newCheckAll, checkAll);

        newCheckAll.addEventListener('change', function () {
            const checkboxes = document.querySelectorAll('#minera-table-body .minera-check'); // Use the checkbox
            const allChecks = tbody.querySelectorAll('input[type="checkbox"]');
            allChecks.forEach(cb => cb.checked = this.checked);
            // We do NOT call recalculateMineraTotals() to update footer digits
        });
    }
}

// Recalculate Totals based on CHECKED boxes
function recalculateMineraTotals() {
    let readyCount = 0;
    let totalBalance = 0;

    const checkboxes = document.querySelectorAll('#minera-table-body .minera-check');
    checkboxes.forEach(cb => {
        if (cb.checked) {
            readyCount++;
            // Use robust data attribute
            const val = parseFloat(cb.dataset.nominal) || 0;
            totalBalance += val;
        }
    });

    const countEl = document.getElementById('minera-ready-count');
    const balanceEl = document.getElementById('minera-total-balance');

    if (countEl) countEl.textContent = readyCount;
    if (balanceEl) balanceEl.textContent = formatIDR(totalBalance);
}

function updateMineraTotalOut() {
    const items = document.querySelectorAll('#minera-table-body .input-out');
    let total = 0;
    const itemArray = Array.from(items); // Safer iteration
    for (const input of itemArray) {
        total += parseNominal(input.value);
    }

    const display = document.getElementById('minera-total-out-val');
    if (display) {
        display.textContent = total.toLocaleString('en-US');

        // Trigger pulse animation
        display.classList.remove('pulse-animation');
        void display.offsetWidth; // Trigger reflow
        display.classList.add('pulse-animation');

        // Dynamic highlight via CSS classes
        if (total > 0) {
            display.classList.remove('empty');
        } else {
            display.classList.add('empty');
        }
    }
}

// Helper to create a single row in Minera table




// Helper to create a single row in Minera table
function createMineraRow(tbody, limit, isReady, bank, theme, name, nominalPart, rowMax, splitIndex = 0) {
    const tr = document.createElement('tr');
    if (isReady) tr.style.background = 'rgba(16, 185, 129, 0.05)';

    // Determine unique key for persistence: [Bank]-[Name]-[Limit]-[SplitIndex]
    const persistenceKey = `${bank}-${name}-${limit}-${splitIndex}`.replace(/\s+/g, '_');
    tr.dataset.persistenceKey = persistenceKey;

    // Load saved Account Number (Cloud first, then Local Fallback)
    const savedRekening = cloudMineraAccounts[persistenceKey] || localStorage.getItem(`minera-rek-${persistenceKey}`) || "";

    // Determine limit class for coloring in Minera table
    let limitClass = '';
    const limitUpper = String(limit).toUpperCase();
    if (limitUpper.includes('250')) limitClass = 'minera-limit-250';
    else if (limitUpper.includes('200')) limitClass = 'minera-limit-200';
    else if (limitUpper.includes('150')) limitClass = 'minera-limit-150';
    else if (limitUpper.includes('100')) limitClass = 'minera-limit-100';
    else if (limitUpper.includes('50')) limitClass = 'minera-limit-50';
    else if (limitUpper.includes('25')) limitClass = 'minera-limit-25';
    else if (limitUpper.includes('TAMPUNG')) limitClass = 'minera-limit-special';

    // Determine total limit for red highlighting
    let totalAccountLimit = 0;
    // Fix: Normalize and handle both "25JT" and "25000000" formats
    const normLimit = String(limit).toUpperCase().replace(/[,.]/g, '');
    const limitNumeric = normLimit.match(/(\d+)/);

    if (limitNumeric) {
        let val = parseInt(limitNumeric[0]);
        // Support both "25" (JT) and "25000000" (Full)
        if (val < 100000) {
            totalAccountLimit = val * 1000000;
        } else {
            totalAccountLimit = val;
        }
    }

    // Fix: Ensure limit > 0 and Strict Check
    const isOverLimit = totalAccountLimit > 0 && nominalPart > totalAccountLimit;
    const saldoColor = isOverLimit ? '#ef4444' : '#94a3b8';

    tr.innerHTML = `
        <td><span class="minera-limit-tag ${limitClass}">${limit}</span></td>
        <td><input type="checkbox" ${isReady ? 'checked' : ''} class="minera-check"></td>
        <td><span class="bank-tag bank-${bank.toLowerCase()}">${bank}</span></td>
        <td><span class="tipe-tag tipe-${theme}">${theme === 'yellow' ? 'Kotor' : 'Bersih'}</span></td>
        <td><input type="text" class="minera-input rek-input" placeholder="Rekening..." value="${savedRekening}"></td>
        <td style="font-weight: 600; width: 200px; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${name}">${name}</td>
        <td><input type="text" class="minera-input val-input input-in" value="0" data-max="${rowMax}"></td>
        <td><input type="text" class="minera-input val-input input-out" value="0" data-max="${rowMax}"></td>
        <td class="minera-saldo-col" style="color: ${saldoColor} !important; font-weight: ${isOverLimit ? '700' : '600'};">
            ${formatIDR(nominalPart).replace(/Rp\s/, '')}
        </td>
    `;

    // Add Auto-Capping and Formatting
    const inputs = tr.querySelectorAll('.val-input');
    inputs.forEach(input => {
        input.addEventListener('input', (e) => {
            let val = parseNominal(e.target.value);
            const max = parseInt(e.target.dataset.max);

            if (val > max) {
                val = max;
                // Subtle visual feedback?
                e.target.style.color = '#ef4444';
                setTimeout(() => { e.target.style.color = '#fff'; }, 500);
            }

            // Re-format with commas
            e.target.value = val.toLocaleString('en-US');

            // Update Total Out if this is an OUT input
            if (e.target.classList.contains('input-out')) {
                updateMineraTotalOut();
            }
        });

        // Clear zero on focus
        input.addEventListener('focus', (e) => {
            if (e.target.value === '0') e.target.value = '';
        });

        // Put zero back if empty on blur
        input.addEventListener('blur', (e) => {
            if (e.target.value === '') e.target.value = '0';
        });
    });

    tbody.appendChild(tr);
}

function autoFillMinera(type) {
    const btn = document.querySelector(`button[onclick="autoFillMinera('${type}')"]`);
    const originalContent = '<i class="fas fa-arrow-' + (type === 'in' ? 'down' : 'up') + '"></i> AUTO MAX ' + type.toUpperCase();

    // Instant Visual Feedback
    if (btn) btn.innerHTML = '<i class="fas fa-bolt"></i>';

    // Execute logic in the next animation frame to prevent UI lock
    requestAnimationFrame(() => {
        // PERF: Select inputs directly instead of querying TRs then inputs
        const inputs = document.querySelectorAll(`#minera-table-body .input-${type}`);
        let hasUpdated = false;
        let calculatedTotalOut = 0;

        // Fast Array Loop
        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i];
            const maxVal = input.dataset.max;

            if (maxVal) {
                // Formatting
                const numericMax = parseInt(maxVal);
                const formattedMax = numericMax.toLocaleString('en-US');

                // Only touch DOM if value is different
                if (input.value !== formattedMax) {
                    input.value = formattedMax;
                    input.style.color = '#fff';
                    hasUpdated = true;
                }

                // If we are doing OUT, sum it up here to avoid a second loop later
                if (type === 'out') {
                    calculatedTotalOut += numericMax;
                }
            }
        }

        // If 'out', update total immediately without re-reading DOM
        if (type === 'out' && hasUpdated) {
            const display = document.getElementById('minera-total-out-val');
            if (display) {
                display.textContent = calculatedTotalOut.toLocaleString('en-US');
                if (calculatedTotalOut > 0) display.classList.remove('empty');
                else display.classList.add('empty');
            }
        }

        // Restore button state
        if (btn) {
            btn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                // Check safety in case user clicked something else
                if (btn.innerText === '' || btn.innerHTML.includes('check')) {
                    btn.innerHTML = originalContent;
                }
            }, 300);
        }
    });
}

function copyMineraByThreshold() {
    const rows = document.querySelectorAll('#minera-table-body tr');
    let copyText = "";

    // Build text string
    rows.forEach(tr => {
        const checkbox = tr.querySelector('.minera-check');
        if (!checkbox || !checkbox.checked) return;

        const tds = tr.querySelectorAll('td');
        if (tds.length < 9) return;

        const bank = tds[2].textContent.trim();
        const tipe = tds[3].textContent.trim();
        const rek = tds[4].querySelector('input').value.trim() || "-";
        const nama = tds[5].textContent.trim();
        const danaIn = tds[6].querySelector('input').value.trim();
        const danaOut = tds[7].querySelector('input').value.trim();

        copyText += `${bank}\t${tipe}\t${rek}\t${nama}\t${danaIn}\t${danaOut}\n`;
    });

    if (copyText) {
        navigator.clipboard.writeText(copyText).then(() => {
            const btn = document.querySelector('button[onclick="copyMineraByThreshold()"]');
            if (btn) {
                const originalHTML = btn.innerHTML; // Capture current state (safe)
                btn.innerHTML = '<i class="fas fa-check"></i>';
                btn.style.background = '#10b981';
                setTimeout(() => {
                    btn.innerHTML = '<i class="fas fa-copy"></i> COPY DATA';
                    btn.style.background = '';
                }, 500);
            }
            showToast('Data Berhasil Disalin!', 'success');
        });
    } else {
        showToast('Pilih minimal satu data!', 'error');
    }
}

function resetMineraNominal() {
    // Immediate Feedback
    requestAnimationFrame(() => {
        if (window.confirm("Reset semua nominal menjadi 0?")) {
            // PERF: Direct selection is faster
            const inputs = document.querySelectorAll('#minera-table-body .val-input');
            let dirty = false;

            for (let i = 0; i < inputs.length; i++) {
                if (inputs[i].value !== '0') {
                    inputs[i].value = '0';
                    inputs[i].style.color = '#fff';
                    dirty = true;
                }
            }

            // LINKED RESET: Call Auto Check Reset
            if (typeof resetAutoCheckState === 'function') {
                resetAutoCheckState();
            }

            // Update total directly to 0 (no calc needed)
            const display = document.getElementById('minera-total-out-val');
            if (display) {
                display.textContent = "0";
                display.classList.add('empty');
            }

            showToast('Semua nominal di-reset!', 'success');
        }
    });
}

// Toast Notification System
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `anunnaki-toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;

    // Inline Styles for immediate effect (consolidated in CSS later ideally)
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%) translateY(20px)',
        background: type === 'success' ? 'rgba(6, 78, 59, 0.95)' : 'rgba(127, 29, 29, 0.95)',
        border: `1px solid ${type === 'success' ? '#10b981' : '#ef4444'}`,
        color: 'white',
        padding: '12px 24px',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        zIndex: '100000',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontFamily: "'Outfit', sans-serif",
        fontSize: '0.9rem',
        fontWeight: '600',
        backdropFilter: 'blur(10px)',
        opacity: '0',
        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
    });

    document.body.appendChild(toast);

    // Animate In
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Animate Out & Remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function saveMineraData() {
    // 1. Immediate UI Feedback (Non-blocking)
    const btn = document.querySelector('.btn-save-minera');
    let originalText = '';

    if (btn) {
        originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> SAVING...';
        btn.style.background = '#059669'; // Darker green while saving
        // REMOVED pointer-events: none to allow user to spam if they really want, or at least not feel "stuck"
    }

    // 2. Defer Heavy Logic very slightly
    setTimeout(() => {
        const rows = document.querySelectorAll('#minera-table-body tr');
        const accountsUpdate = {};

        // Fast synchronous DOM read (DOM reading is fast enough mostly)
        rows.forEach(tr => {
            const key = tr.dataset.persistenceKey;
            const input = tr.querySelector('.rek-input');
            if (key && input) {
                const val = input.value; // No trim needed for loose check, speed up
                if (val) accountsUpdate[key] = val;
                // localStorage.setItem is sync but fast for simple strings. 
                // We can debounce the actual disk write if needed, but for now this is fine.
                localStorage.setItem(`minera-rek-${key}`, val);
            }
        });

        // Fire & Forget Firebase update
        if (typeof firebase !== 'undefined' && db) {
            db.ref('minera_accounts').update(accountsUpdate).catch(console.error);
        }

        // 3. Fast Restore UI
        if (btn) {
            btn.innerHTML = '<i class="fas fa-check"></i> SAVED';
            btn.style.background = '#10b981'; // Bright green success

            setTimeout(() => {
                // Only revert if user hasn't triggered another save
                if (btn.innerHTML.includes('SAVED')) {
                    btn.innerHTML = originalText;
                    btn.style.background = '';
                }
            }, 1000); // Reduced delay
        }

        // Non-blocking toast
        showToast('Data Rekening Berhasil Disimpan!', 'success');

    }, 10);
}

// Helpers for Stats
function parseNominal(val) {
    if (!val) return 0;
    const strVal = String(val).trim();

    // Check for accounting format (123) -> -123
    const isAccountingNegative = strVal.startsWith('(') && strVal.endsWith(')');

    // Remove all non-digits EXCEPT minus sign
    const cleaned = strVal.replace(/[^0-9-]/g, '');
    let num = parseInt(cleaned) || 0;

    if (isAccountingNegative) {
        num = Math.abs(num) * -1;
    }

    return num;
}

function formatIDR(num) {
    // Using en-US to get commas for thousands (Rp 10,000)
    // ACCOUNTING FORMAT: (10,000) for negative
    if (num < 0) {
        return 'Rp (' + Math.abs(num).toLocaleString('en-US') + ')';
    }
    return 'Rp ' + num.toLocaleString('en-US');
}

// Helper to calculate column width from range string (e.g. "H10:AT13" -> 39 columns)
function getColCountFromRange(rangeStr) {
    if (!rangeStr) return 0;
    try {
        // Extract parts separated by ':'
        const parts = rangeStr.toUpperCase().split(':');
        if (parts.length < 2) return 0;

        // Parse start and end column letters
        const startCol = parts[0].replace(/[^A-Z]/g, '');
        const endCol = parts[1].replace(/[^A-Z]/g, '');

        if (!startCol || !endCol) return 0;

        const startIdx = colToIndex(startCol);
        const endIdx = colToIndex(endCol);

        return endIdx - startIdx + 1;
    } catch (e) {
        console.error("Error parsing range:", e);
        return 0;
    }
}

// Convert column letter to 1-based index (A=1, Z=26, AA=27)
function colToIndex(col) {
    let sum = 0;
    for (let i = 0; i < col.length; i++) {
        sum *= 26;
        sum += col.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
    }
    return sum;
}

function createCard(limit, name, nominal, status) {
    const card = document.createElement('div');
    card.className = 'data-card';

    // 1. Limit Header (Top)
    const header = document.createElement('div');
    header.className = 'card-header';
    header.textContent = limit || "LIMIT -";
    header.title = limit; // Tooltip for full text
    card.appendChild(header);

    // 2. Name Body (Middle)
    const body = document.createElement('div');
    body.className = 'card-body';
    body.textContent = name || "Unknown";
    card.appendChild(body);

    // 2.5 Nominal (Above Footer)
    const nomDiv = document.createElement('div');
    nomDiv.className = 'card-nominal';

    // Auto-replace dots with commas for "Keuangan" format (e.g. 50.000 -> 50,000)
    let displayNominal = nominal || "-";
    if (displayNominal && displayNominal !== '-' && displayNominal !== '#REF!') {
        displayNominal = String(displayNominal).replace(/\./g, ',');
    }

    nomDiv.textContent = displayNominal;

    // Check for Over Limit
    const numericNominal = parseNominal(nominal);
    let totalAccountLimit = 0;
    const limitNumeric = (limit || "").match(/\d+/);
    if (limitNumeric) totalAccountLimit = parseInt(limitNumeric[0]) * 1000000;

    const isOverLimit = numericNominal > totalAccountLimit && totalAccountLimit > 0;

    // Highlight Errors or Over Limit
    if (nominal === '#REF!') {
        nomDiv.style.color = '#ef4444';
        nomDiv.style.fontWeight = 'bold';
    } else if (isOverLimit) {
        nomDiv.style.color = '#ef4444';
        nomDiv.style.fontWeight = 'bold';
    }

    card.appendChild(nomDiv);

    // 3. Status Footer (Bottom)
    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const badge = document.createElement('span');
    badge.className = 'status-badge';
    badge.textContent = status || "UNKNOWN";

    // Determine Color Class
    const s = (status || '').toUpperCase();
    if (s.includes('READY')) badge.className += ' status-ready';
    else if (s.includes('OFF')) badge.className += ' status-off';
    else if (s.includes('BLOKIR')) badge.className += ' status-blocked';
    else if (s.includes('CABUT')) badge.className += ' status-cabut';
    else if (s.includes('LOGOUT')) badge.className += ' status-logout';
    else if (s.includes('ADM')) badge.className += ' status-adm';
    else if (s.includes('REF') || s.includes('ERROR')) badge.className += ' status-ref';

    footer.appendChild(badge);
    card.appendChild(footer);

    return card;
}

// Helper: Parse Google Sheet CSV (Auto-detect delimiter)
function parseCSV(text) {
    if (!text) return [];

    // Detect delimiter
    const firstLine = text.split('\n')[0] || '';
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const delim = semiCount > commaCount ? ';' : ',';

    // DEBUG: Alert/Log the raw data sample to diagnose the "Empty" issue
    console.log(`CSV Debug | Delim: '${delim}' | First Line: ${firstLine.substring(0, 50)}...`);
    // Only alert if we are in manual mode (hard to detect here, but we can assume)
    // alert(`DEBUG CSV:\nDelim: ${delim}\nFirst Line: ${firstLine}`); 

    const rows = [];
    let currentRow = [];
    let currentVal = '';
    let insideQuote = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"') {
            if (insideQuote && next === '"') {
                currentVal += '"';
                i++;
            } else {
                insideQuote = !insideQuote;
            }
        } else if (char === delim && !insideQuote) {
            currentRow.push(currentVal);
            currentVal = '';
        } else if ((char === '\r' || char === '\n') && !insideQuote) {
            if (currentVal || currentRow.length) currentRow.push(currentVal);
            if (currentRow.length) rows.push(currentRow);
            currentRow = [];
            currentVal = '';
            if (char === '\r' && next === '\n') i++;
        } else {
            currentVal += char;
        }
    }
    if (currentVal || currentRow.length) {
        currentRow.push(currentVal);
        rows.push(currentRow);
    }

    // FINAL DEBUG CHECK
    if (rows.length > 0) {
        console.log(`Parsed ${rows.length} rows. Row 0 Cols: ${rows[0].length}`);
        // If row 0 has very few columns (e.g. 1) but we expected many, alerting might help.
        if (rows[0].length < 2) {
            alert(`Warning: Parsed CSV has only ${rows[0].length} column(s). Check Delimiter!\n(${firstLine})`);
        }
    }

    return rows;
}

// Slice Data based on Range (e.g., "H11:AD13")


// Slice Data based on Range (e.g., "H11:AD13")
// Slice Data based on Range (e.g., "H11:AD13")
function sliceData(rows, rangeStr) {
    if (!rangeStr || !rows || rows.length === 0) return rows;

    try {
        const parts = rangeStr.split(':');
        if (parts.length !== 2) return rows;

        const getCoord = (s) => {
            const m = s.match(/([A-Z]+)([0-9]+)/);
            if (!m) return null;
            return { col: colToIndex(m[1]) - 1, row: parseInt(m[2]) - 1 }; // 0-indexed
        };

        const start = getCoord(parts[0]);
        const end = getCoord(parts[1]);

        if (!start || !end) return rows;

        // Auto-Detect: Is the CSV already sliced? (Relative vs Absolute)
        const reqHeight = end.row - start.row + 1;
        const reqWidth = end.col - start.col + 1;

        let effectiveStartRow = start.row;
        let effectiveStartCol = start.col;

        // Safety: If row 0 exists
        if (rows.length > 0) {
            // Condition 0: If request start column is BEYOND the CSV width, it MUST be relative.
            if (start.col >= rows[0].length) {
                effectiveStartCol = 0;
            }

            // Condition 1: Height matches (approx) -> Assume rows started at 0
            if (rows.length <= reqHeight + 10 && rows.length >= reqHeight) {
                effectiveStartRow = 0;
                // If height matches, width match is highly likely too if it's a specific range export
                const avgWidth = rows[0].length;
                if (avgWidth <= reqWidth + 10 && avgWidth >= 1) {
                    effectiveStartCol = 0;
                }
            }
        }

        const sliced = [];
        // Map requested relative rows to the actual CSV rows
        for (let r = 0; r < reqHeight; r++) {
            const srcRowIdx = effectiveStartRow + r;

            if (srcRowIdx < rows.length) {
                const rowData = rows[srcRowIdx];
                const rowSlice = [];
                for (let c = 0; c < reqWidth; c++) {
                    const srcColIdx = effectiveStartCol + c;
                    rowSlice.push(rowData[srcColIdx] !== undefined ? rowData[srcColIdx] : "");
                }
                sliced.push(rowSlice);
            }
        }
        return sliced;
    } catch (e) {
        console.warn("Slicing failed", e);
        return rows;
    }
}

// Helper: Fetch CSV from Google Sheets Export
async function fetchSheetData(url, sheetName, range) {
    if (!url) return null;

    // CASE 1: Google Apps Script Web App (JSON API)
    if (url.includes('script.google.com')) {
        console.log(`Fetching via GAS: ${url}`);
        const separator = url.includes('?') ? '&' : '?';
        const fetchUrl = `${url}${separator}name=${encodeURIComponent(sheetName)}&range=${encodeURIComponent(range)}`;
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error(`GAS HTTP ${res.status}`);
        return await res.json();
    }

    // CASE 2: Published to Web CSV Link (Prioritized)
    if (url.includes('output=csv') || url.includes('export?format=csv')) {
        console.log(`Fetching Direct CSV`);
        const res = await fetch(url);
        const allRows = parseCSV(await res.text());
        return sliceData(allRows, range);
    }

    // CASE 3: Standard Edit/Share Link -> Convert to Export & GVIZ
    let id = '';
    const m1 = url.match(/\/d\/([a-zA-Z0-9-_]+)/), m2 = url.match(/id=([a-zA-Z0-9-_]+)/);
    if (m1) id = m1[1]; else if (m2) id = m2[1]; else return null;

    // Detect GID (Sheet ID) if present - this is SAFER than Sheet Name
    let gid = '';
    const mGid = url.match(/gid=([0-9]+)/);
    if (mGid) gid = mGid[1];

    // STRATEGY A: /export endpoint (Best for Shared/Anyone links)
    // Try asking for CSV directly. Often works better than GVIZ for shared sheets.
    let exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&range=${encodeURIComponent(range)}`;

    // IF GID is present, prioritize it! It's less prone to typos than name.
    if (gid) {
        exportUrl += `&gid=${gid}`;
    } else {
        exportUrl += `&sheet=${encodeURIComponent(sheetName)}`;
    }

    console.log(`Attempting Export: ${exportUrl}`);

    try {
        const res = await fetch(exportUrl);
        if (res.ok) {
            const text = await res.text();
            // DEBUG PREVIEW (First 200 chars)
            // if (text.length > 0) console.log(`Preview: ${text.substring(0, 100)}`);

            if (!text.trim().startsWith('<!DOCTYPE html>')) return parseCSV(text);
        }
    } catch (e) { console.warn("Export fetch failed", e); }

    // STRATEGY B: GVIZ (Fallback)
    // Note: Removed 'credentials: include' because it triggers strict CORS on some public sheets.
    let gviz = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&range=${encodeURIComponent(range)}`;
    if (gid) {
        gviz += `&gid=${gid}`;
    } else {
        gviz += `&sheet=${encodeURIComponent(sheetName)}`;
    }
    console.log(`Attempting GVIZ: ${gviz}`);

    const res = await fetch(gviz);
    if (!res.ok) throw new Error(`GVIZ HTTP ${res.status}`);
    return parseCSV(await res.text());
}

// Core Extraction Logic (Shared by Button & Auto-Refresh)
// Helper: Parse Range "AK4:BG6" -> {startRow, endRow, startCol, endCol}
// Helper: Parse Range "AK4:BG6" -> {c1, r1, c2, r2} (0-indexed)
function parseR(s) {
    if (!s) return null;
    const m = s.match(/([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)/);
    if (!m) return null;
    return { c1: colToIndex(m[1]) - 1, r1: parseInt(m[2]) - 1, c2: colToIndex(m[3]) - 1, r2: parseInt(m[4]) - 1 };
}

// Helper: Build Range String from coords
function buildR(c1, r1, c2, r2) {
    const colStr = (i) => {
        let s = "", t = i + 1;
        while (t > 0) { s = String.fromCharCode(65 + (t - 1) % 26) + s; t = Math.floor((t - 1) / 26); }
        return s;
    };
    return `${colStr(c1)}${r1 + 1}:${colStr(c2)}${r2 + 1}`;
}

async function runExtraction(isAuto = false) {
    saveSettings();

    // UI Feedback
    if (!isAuto) {
        const btn = document.querySelector('.btn-save');
        if (btn) {
            btn.textContent = "Connecting...";
            btn.disabled = true;
            btn.style.cursor = 'wait';
        }
    }

    // Defer heavy work to next tick to allow button to show "Connecting..." state
    setTimeout(async () => {
        await executeExtraction(isAuto);
    }, 50);
}

async function executeExtraction(isAuto) {

    const processSource = async (idx) => {
        const p = idx + 1;
        const link = (document.getElementById(`sheet-link-${p}`).value || '').trim();
        const name = (document.getElementById(`sheet-name-${p}`).value || '').trim();
        const dRange = (document.getElementById(`sheet-range-${p}`).value || '').trim(); // DATA: AK4:BG6
        const lRange = (document.getElementById(`sheet-max-${p}`) ? document.getElementById(`sheet-max-${p}`).value : "").trim();

        console.log(`[Source ${p}] Processing: Name='${name}' Range='${dRange}' Max='${lRange}'`); // LIMIT: AK2:BG2

        if (!link || !name || !dRange) return null;

        // 1. DETERMINE FETCH RANGE (The "Bounding Box")
        // We want to fetch ONE block that covers Limit (Row 2) down to Status (Row 6)
        const dMeta = parseR(dRange);
        if (!dMeta) return null;

        const lMeta = lRange ? parseR(lRange) : null;

        let fetchStartRow = dMeta.r1; // Default to Data Start
        let fetchEndRow = dMeta.r2;
        let fetchStartCol = dMeta.c1;
        let fetchEndCol = dMeta.c2;

        // Expand if Limit is involved (e.g. Row 2)
        if (lMeta) {
            fetchStartRow = Math.min(fetchStartRow, lMeta.r1);
            fetchEndRow = Math.max(fetchEndRow, lMeta.r2);
            fetchStartCol = Math.min(fetchStartCol, lMeta.c1);
            fetchEndCol = Math.max(fetchEndCol, lMeta.c2);
        }

        const fetchRangeStr = buildR(fetchStartCol, fetchStartRow, fetchEndCol, fetchEndRow);
        console.log(`[Source ${p}] Fetching Comprehensively: ${fetchRangeStr}`); // e.g. AK2:BG6

        // 2. FETCH DATA
        // This returns a matrix of strings (e.g. 5 rows x 30 cols)
        let rawData = await fetchSheetData(link, name, fetchRangeStr);

        if (!rawData || rawData.length === 0) return null;

        // 3. MAP ROWS (Relative to the Fetched Block)
        // If we fetched AK2:BG6 (Rows 2,3,4,5,6).
        // Row 2 (Limit) is at index 0.
        // Row 4 (Name) is at index 2 (4 - 2).

        const getRow = (absoluteRowIndex) => {
            // rawData is ALREADY sliced by fetchSheetData (if Published & range match)
            // or by GVIZ.
            // Assumption: rawData[0] corresponds to fetchStartRow.
            const relIdx = absoluteRowIndex - fetchStartRow;
            return (rawData && rawData[relIdx]) ? rawData[relIdx] : [];
        };

        const rowName = getRow(dMeta.r1);       // AK4
        const rowNominal = getRow(dMeta.r1 + 1); // AK5
        const rowStatus = getRow(dMeta.r1 + 2);  // AK6
        const safeLength = rowName.length || rowNominal.length || rowStatus.length || 0;
        const rowLimit = lMeta ? getRow(lMeta.r1) : new Array(safeLength).fill("LIMIT");

        return {
            idx: idx,
            data: [rowName, rowNominal, rowStatus, rowLimit]
        };
    };

    let hasRealData = false;
    try {
        const results = await Promise.all([processSource(0), processSource(1)]);
        results.forEach(res => {
            if (res && res.data) {
                MOCK_EXTRACTED_DATA.sections[res.idx].data = res.data;
                hasRealData = true;
            }
        });
    } catch (e) { console.error("Extraction Failed", e); }

    // Update Meta immediately for responsiveness & Fallback Sync
    if (MOCK_EXTRACTED_DATA.sections[0]) {
        MOCK_EXTRACTED_DATA.sections[0].sheetName = document.getElementById('sheet-name-1').value;
        MOCK_EXTRACTED_DATA.sections[0].range = document.getElementById('sheet-range-1').value;
    }
    if (MOCK_EXTRACTED_DATA.sections[1]) {
        MOCK_EXTRACTED_DATA.sections[1].sheetName = document.getElementById('sheet-name-2').value;
        MOCK_EXTRACTED_DATA.sections[1].range = document.getElementById('sheet-range-2').value;
    }

    // Render & Clean Up
    renderDashboard(MOCK_EXTRACTED_DATA.sections);
    CURRENT_SECTIONS = MOCK_EXTRACTED_DATA.sections; // Store globally
    updateDashboardMeta();

    // BROADCAST UPDATE TO ALL PEERS
    console.log("Broadcasting extracted data to peers...");
    pushToFirebase(MOCK_EXTRACTED_DATA);

    if (!isAuto) {
        const btn = document.querySelector('.btn-save');
        if (btn) {
            setTimeout(() => {
                const msg = hasRealData ? "Real Data Fetched Successfully!" : "Fetch Failed. Check Sheet Name & Permissions.";
                btn.textContent = hasRealData ? "Success!" : "Failed";
                alert(msg);
                setTimeout(() => { btn.textContent = "Save & Extract"; btn.disabled = false; closeSettings(); }, 800);
            }, 800);
        }
    }
}

function updateTime() {
    const now = new Date();

    // Day Name
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const dayName = days[now.getDay()];

    // Full Date
    const date = now.getDate();
    const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();

    // Time
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeString = `${hours}:${minutes}:${seconds}`;

    // Update Elements
    const elDay = document.getElementById('live-day');
    const elDate = document.getElementById('live-date-text');
    const elTime = document.getElementById('live-time-anunnaki');

    if (elDay) elDay.textContent = dayName;
    if (elDate) elDate.textContent = `${date} ${monthName} ${year}`;
    if (elTime) elTime.textContent = timeString;
}

// MOCK DATA FOR SIMULATION (Updated to match H11 start)
const MOCK_EXTRACTED_DATA = {
    "dashboardTitle": "DASHBOARD MONITORING KAS",
    "sections": [
        {
            "id": "kas-kotor",
            "title": "BANK KAS KOTOR",
            "sheetName": "DOC BANK KAS KOTOR - JANUARI",
            "theme": "yellow",
            "range": "H10:AT13",
            "data": [
                // Row 1: NAMES (H11) - Extended to simulate wider range
                [
                    "KAS BCA / MUHAMMAD NAUFAL A", "KAS BCA / BUDI PRIYANTO", "KAS BCA / SINTIYANA", "KAS BCA / IRWAN MARTINUS", "KAS BCA / ABDURACHMAN",
                    "KAS BCA / MARIA KALESARAN", "KAS MCA / CAROLINA OCTORA", "KAS BCA / ANINDITA SALSABILLAH", "KAS BCA / MURTIWATI", "KAS BCA / LIE MIE",
                    "KAS MANDIRI / SUSILOWATI", "KAS BCA / KOMARIAH", "KAS MANDIRI / ABDUL ROHIM", "KAS BCA / RUDI HARTONO", "KAS BCA / DWI SAPUTRA",
                    "KAS BCA / FITRIANI", "KAS BCA / HENDRA KURNIAWAN", "KAS BCA / SITI NURHALIZA", "KAS BCA / AGUS SETIAWAN", "KAS BCA / RINA WATI"
                ],
                // Row 2: NOMINAL / SALDO AKHIR (H12)
                [
                    "25,830,696", "25,715,664", "25,262,161", "25,221,098", "25,129,300",
                    "48,371,190", "25,145,021", "25,624,443", "119,557", "26,232,352",
                    "26,237,362", "0", "26,231,182", "25,500,000", "49,100,200",
                    "15,000,000", "33,250,500", "12,100,000", "45,600,000", "22,300,000"
                ],
                // Row 3: STATUS (H13)
                [
                    "READY", "READY", "READY", "READY", "READY",
                    "DI OFFKAN", "READY", "READY", "DI OFFKAN", "READY",
                    "READY", "CABUT KAS", "READY", "READY", "READY",
                    "READY", "READY", "DI OFFKAN", "READY", "READY"
                ],
                // Row 4: MAX TAMPUNG (Simulated from H6)
                [
                    "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT",
                    "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT", "MAX TAMPUNG 300JT",
                    "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT",
                    "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT"
                ]
            ]
        },
        {
            "id": "kas-bersih",
            "title": "BANK KAS BERSIH",
            "sheetName": "DOC BANK KAS BERSIH - JANUARI",
            "theme": "blue",
            "range": "H30:AT33",
            "data": [
                // Row 1: NAMES
                [
                    "KAS BESAR DANAMON / SITI AMINAH", "KAS BESAR DANAMON / WAETIN", "KAS BESAR DANAMON / MUHAMMAD SOLEH", "KAS BESAR DANAMON / SAEFULLOH", "KAS BESAR DANAMON / MUHAMMAD AL FREDDO",
                    "KAS BESAR DANAMON / RIZKY ADITYA", "KAS BESAR DANAMON / NURUL HIDAYAH", "KAS BESAR DANAMON / FAJAR SANTOSO", "KAS BESAR DANAMON / DEWI SARTIKA", "KAS BESAR DANAMON / BUDI SANTOSO"
                ],
                // Row 2: NOMINAL
                [
                    "45,000,000", "12,500,000", "30,120,000", "49,800,000", "15,600,000",
                    "22,400,000", "38,900,100", "11,200,500", "44,500,000", "28,750,000"
                ],
                // Row 3: STATUS
                [
                    "READY", "READY", "DI OFFKAN", "READY", "READY",
                    "READY", "READY", "DI OFFKAN", "READY", "READY"
                ],
                // Row 4: MAX TAMPUNG
                [
                    "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT",
                    "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT", "MAX TAMPUNG 50JT"
                ]
            ]
        }
    ]
};

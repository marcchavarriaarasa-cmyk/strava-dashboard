
let allActivities = [];
let currentFilters = {
    year: [],
    month: [],
    type: []
};

// Month names for mapping
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

document.addEventListener('DOMContentLoaded', () => {
    fetchData();

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.multiselect-container')) {
            document.querySelectorAll('.multiselect-dropdown').forEach(el => el.classList.remove('show'));
        }
    });
});

async function fetchData() {
    try {
        // Add cache busting timestamp
        const response = await fetch(`data/activities.json?v=${new Date().getTime()}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allActivities = await response.json();
        console.log(`Loaded ${allActivities.length} activities.`);

        // Hide loading screen
        document.getElementById('loading').style.display = 'none';

        // Initialize Filters
        populateFilters(allActivities);

        // Initial Render
        applyFilters();

    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('loading').innerHTML = '<p>Error loading data. Please check console.</p>';
    }
}

function populateFilters(activities) {
    const years = new Set();
    const types = new Set();
    // distinct months present in data could be filtered, but standard 12 is better

    activities.forEach(a => {
        const date = new Date(a.start_date);
        years.add(date.getFullYear());
        types.add(a.sport_type);
    });

    const sortedYears = Array.from(years).sort().reverse();
    const sortedTypes = Array.from(types).sort();

    // Default select all
    currentFilters.year = [...sortedYears];
    currentFilters.type = [...sortedTypes];
    currentFilters.month = monthNames.map((_, i) => i); // [0, 1, ... 11]

    // Render Dropdowns
    renderCheckboxList('yearList', sortedYears, currentFilters.year, 'year');
    renderCheckboxList('typeList', sortedTypes, currentFilters.type, 'type', formatSportType);

    // Render Months (All 12)
    const allMonthIndices = monthNames.map((_, i) => i);
    renderCheckboxList('monthList', allMonthIndices, currentFilters.month, 'month', (i) => monthNames[i]);

    // Setup Toggle Buttons
    setupDropdownToggle('yearBtn', 'yearList');
    setupDropdownToggle('monthBtn', 'monthList');
    setupDropdownToggle('typeBtn', 'typeList');

    // Update Button Text
    updateButtonText('yearBtn', 'Years', currentFilters.year.length, sortedYears.length);
    updateButtonText('monthBtn', 'Months', currentFilters.month.length, 12);
    updateButtonText('typeBtn', 'Sports', currentFilters.type.length, sortedTypes.length);
}

function renderCheckboxList(elementId, items, selectedItems, filterKey, formatter = (x) => x) {
    const container = document.getElementById(elementId);
    container.innerHTML = '';

    // --- Select All / Deselect All Option ---
    const allSelected = items.length > 0 && items.every(i => selectedItems.includes(i));
    const selectAllRow = document.createElement('label');
    selectAllRow.className = 'checkbox-row select-all-row';

    const selectAllCheckbox = document.createElement('input');
    selectAllCheckbox.type = 'checkbox';
    selectAllCheckbox.checked = allSelected;

    const selectAllText = document.createTextNode(allSelected ? 'Deselect All' : 'Select All');

    selectAllRow.appendChild(selectAllCheckbox);
    selectAllRow.appendChild(selectAllText);
    container.appendChild(selectAllRow);

    // Separator
    const hr = document.createElement('div');
    hr.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
    hr.style.margin = '5px 0';
    container.appendChild(hr);

    selectAllCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            // Select All
            currentFilters[filterKey] = [...items];
        } else {
            // Deselect All
            currentFilters[filterKey] = [];
        }

        // Re-render to update all checkboxes and button text
        renderCheckboxList(elementId, items, currentFilters[filterKey], filterKey, formatter);

        const total = items.length;
        const label = filterKey.charAt(0).toUpperCase() + filterKey.slice(1) + 's';
        updateButtonText(`${filterKey}Btn`, label, currentFilters[filterKey].length, total);

        applyFilters();
    });
    // ----------------------------------------

    items.forEach(item => {
        const row = document.createElement('label');
        row.className = 'checkbox-row';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = item;
        checkbox.checked = selectedItems.includes(item);

        checkbox.addEventListener('change', (e) => {
            const val = isNaN(item) ? item : Number(item); // Keep types clean

            if (e.target.checked) {
                currentFilters[filterKey].push(val);
            } else {
                currentFilters[filterKey] = currentFilters[filterKey].filter(x => x !== val);
            }

            // Update button text
            const total = items.length;
            const label = filterKey.charAt(0).toUpperCase() + filterKey.slice(1) + 's';
            updateButtonText(`${filterKey}Btn`, label, currentFilters[filterKey].length, total);

            // Re-render list to update "Select All" state if needed (optional, but good for consistency)
            // But doing full re-render might lose focus/scroll. Let's just update "Select All" checkbox state visually?
            // Simpler: Just check if we need to update "Select All" box
            const newAllSelected = items.every(i => currentFilters[filterKey].includes(i));
            selectAllCheckbox.checked = newAllSelected;
            selectAllText.textContent = newAllSelected ? 'Deselect All' : 'Select All';

            applyFilters();
        });

        const text = document.createTextNode(formatter(item));

        row.appendChild(checkbox);
        row.appendChild(text);
        container.appendChild(row);
    });
}

function setupDropdownToggle(btnId, listId) {
    document.getElementById(btnId).addEventListener('click', (e) => {
        e.stopPropagation();
        // Close others
        document.querySelectorAll('.multiselect-dropdown').forEach(el => {
            if (el.id !== listId) el.classList.remove('show');
        });
        document.getElementById(listId).classList.toggle('show');
    });
}

function updateButtonText(btnId, label, selectedCount, totalCount) {
    const btn = document.getElementById(btnId);
    if (selectedCount === 0) {
        btn.innerText = `Select ${label}`;
    } else if (selectedCount === totalCount) {
        btn.innerText = `All ${label}`;
    } else {
        btn.innerText = `${selectedCount} ${label}`;
    }
}

function applyFilters() {
    let filtered = allActivities.filter(a => {
        const date = new Date(a.start_date);
        const year = date.getFullYear();
        const month = date.getMonth();
        const type = a.sport_type;

        return currentFilters.year.includes(year) &&
            currentFilters.month.includes(month) &&
            currentFilters.type.includes(type);
    });

    updateDashboard(filtered);
}

function updateDashboard(activities) {
    updateUserStats(activities);
    renderCharts(activities);
    renderActivityList(activities);
    renderConsistencyStats(activities);
    renderGeographyAndGear(activities);
}

function renderGeographyAndGear(activities) {
    // --- 1. Latest Route Map ---
    // Find first activity with a polyline
    const activityWithMap = activities.find(a => a.map && a.map.summary_polyline);

    if (activityWithMap) {
        const polyline = activityWithMap.map.summary_polyline;
        const coordinates = decodePolyline(polyline);

        if (coordinates.length > 0) {
            // Initialize Map (check if already exists)
            if (window.mapInstance) {
                window.mapInstance.remove();
            }

            // Center map on the start of the route
            window.mapInstance = L.map('map').setView(coordinates[0], 13);

            // Add Tile Layer (OpenStreetMap)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(window.mapInstance);

            // Draw Polyline
            const routeLine = L.polyline(coordinates, {
                color: '#fc4c02',
                weight: 4,
                opacity: 0.8
            }).addTo(window.mapInstance);

            // Fit bounds
            window.mapInstance.fitBounds(routeLine.getBounds());
        }
    } else {
        document.getElementById('map').innerHTML = '<p style="text-align:center; padding-top:150px; color:#666;">No map data available for recent activities.</p>';
    }

    // --- 2. Gear Usage Chart ---
    const gearUsage = {};

    // Config for Gear Names (User can update this later)
    const gearNames = {
        // Example: 'g1234567': 'Nike Pegasus 39',
    };

    activities.forEach(a => {
        if (a.gear_id) {
            const name = gearNames[a.gear_id] || a.gear_id;
            gearUsage[name] = (gearUsage[name] || 0) + (a.distance / 1000);
        }
    });

    // Sort by use
    const sortedGear = Object.entries(gearUsage).sort((a, b) => b[1] - a[1]);

    const ctxGear = document.getElementById('gearChart').getContext('2d');
    if (window.gearChartInstance) window.gearChartInstance.destroy();

    window.gearChartInstance = new Chart(ctxGear, {
        type: 'bar',
        data: {
            labels: sortedGear.map(g => g[0]), // Name/ID
            datasets: [{
                label: 'Distance (km)',
                data: sortedGear.map(g => g[1]),
                backgroundColor: '#2196f3',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y', // Horizontal bars for names
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#b0b0b0' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#b0b0b0' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderConsistencyStats(activities) {
    // --- 1. Heatmap (Month x Day) ---
    const heatmapContainer = document.getElementById('heatmap');
    const labelsContainer = document.getElementById('monthLabels');

    heatmapContainer.innerHTML = '';
    labelsContainer.innerHTML = ''; // Clear labels

    // Determine Year (Filter or Current)
    // If multiple years selected, maybe just show current year or last selected?
    // Let's Default to current year or 2024.
    let targetYear = new Date().getFullYear();
    if (currentFilters.year && currentFilters.year.length === 1) {
        targetYear = parseInt(currentFilters.year[0]);
    }

    // Create map of date -> count
    const activityMap = {};
    activities.forEach(a => {
        const d = new Date(a.start_date);
        // Only map if it matches the target year (though if we filter, the activities array is already filtered)
        if (d.getFullYear() === targetYear) {
            const dateStr = a.start_date.split('T')[0];
            activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
        }
    });

    // Generate Month Labels (Jan - Dec)
    const monthNamesShort = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
    // Or full names if space permits? "Jan", "Feb"...
    // With 12 columns, short names are safer.

    monthNamesShort.forEach(m => {
        const labelEl = document.createElement('div');
        labelEl.className = 'month-label';
        labelEl.innerText = m;
        labelsContainer.appendChild(labelEl);
    });

    // Generate Grid (12 Months x 31 Days)
    // grid-auto-flow: column fills column by column.
    // So we loop: Month 0 (Days 1-31), Month 1 (Days 1-31)...

    for (let m = 0; m < 12; m++) {
        const daysInMonth = new Date(targetYear, m + 1, 0).getDate(); // Get last day of month

        for (let d = 1; d <= 31; d++) {
            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';

            if (d > daysInMonth) {
                // Invisible placeholder for alignment
                cell.style.visibility = 'hidden';
                // Or opacity: 0
            } else {
                // Construct YYYY-MM-DD
                // Note: Month is 0-indexed in JS Date, but we need 01-12
                const monthStr = (m + 1).toString().padStart(2, '0');
                const dayStr = d.toString().padStart(2, '0');
                const dateStr = `${targetYear}-${monthStr}-${dayStr}`;

                const count = activityMap[dateStr] || 0;

                let level = 0;
                if (count === 1) level = 2;
                if (count >= 2) level = 4;

                cell.dataset.level = level;
                cell.title = `${dateStr}: ${count} activities`;
            }
            heatmapContainer.appendChild(cell);
        }
    }

    // Update grid styles for labels/heatmap to ensure simple 12-col layout
    labelsContainer.style.gridTemplateColumns = `repeat(12, 1fr)`;
    labelsContainer.style.gap = '2px';
    // Heatmap container styles are in CSS


    // --- 2. Streaks ---
    // Sort unique dates descending
    const uniqueDates = [...new Set(activities.map(a => a.start_date.split('T')[0]))].sort().reverse();

    let currentStreak = 0;
    let bestStreak = 0;

    if (uniqueDates.length > 0) {
        // Current Streak
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let streakStartDate = new Date(uniqueDates[0]);
        // Check if latest activity is today or yesterday to count as "active" streak
        if (uniqueDates[0] === todayStr || uniqueDates[0] === yesterdayStr) {
            currentStreak = 1;
            let checkDate = new Date(uniqueDates[0]);

            for (let i = 1; i < uniqueDates.length; i++) {
                checkDate.setDate(checkDate.getDate() - 1);
                const expectedStr = checkDate.toISOString().split('T')[0];
                if (uniqueDates[i] === expectedStr) {
                    currentStreak++;
                } else {
                    break;
                }
            }
        }
    }

    // Best Streak (Iterate all gaps)
    // This requires a full walk. Simplification:
    let tempStreak = 1;
    for (let i = 0; i < uniqueDates.length - 1; i++) {
        const d1 = new Date(uniqueDates[i]);
        const d2 = new Date(uniqueDates[i + 1]);
        const diffTime = Math.abs(d1 - d2);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            tempStreak++;
        } else {
            if (tempStreak > bestStreak) bestStreak = tempStreak;
            tempStreak = 1;
        }
    }
    if (tempStreak > bestStreak) bestStreak = tempStreak;
    if (currentStreak > bestStreak) bestStreak = currentStreak;

    animateValue('current-streak', currentStreak);
    animateValue('best-streak', bestStreak);


    // --- 3. Time of Day Chart ---
    const timeOfDay = { 'Morning': 0, 'Afternoon': 0, 'Evening': 0, 'Night': 0 };

    activities.forEach(a => {
        // local time is usually "YYYY-MM-DDTHH:MM:SSZ"
        const hour = parseInt(a.start_date_local.split('T')[1].split(':')[0]);

        if (hour >= 5 && hour < 12) timeOfDay['Morning']++;
        else if (hour >= 12 && hour < 17) timeOfDay['Afternoon']++;
        else if (hour >= 17 && hour < 21) timeOfDay['Evening']++;
        else timeOfDay['Night']++;
    });

    const ctxTime = document.getElementById('timeOfDayChart').getContext('2d');

    // Destroy if exists (we need a global var for this too)
    if (window.timeChartInstance) window.timeChartInstance.destroy();

    window.timeChartInstance = new Chart(ctxTime, {
        type: 'polarArea',
        data: {
            labels: Object.keys(timeOfDay),
            datasets: [{
                data: Object.values(timeOfDay),
                backgroundColor: [
                    'rgba(255, 206, 86, 0.6)', // Morning (Sun)
                    'rgba(255, 99, 132, 0.6)', // Afternoon (Heat)
                    'rgba(54, 162, 235, 0.6)', // Evening (Cool)
                    'rgba(153, 102, 255, 0.6)' // Night
                ],
                borderWidth: 1,
                borderColor: '#1e1e1e'
            }]
        },
        options: {
            responsive: true,
            scales: {
                r: {
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { display: false, backdropColor: 'transparent' }
                }
            },
            plugins: {
                legend: { position: 'right', labels: { color: '#b0b0b0', boxWidth: 10 } }
            }
        }
    });
}

function updateUserStats(activities) {
    // Calculate totals
    const totalDistance = activities.reduce((acc, curr) => acc + (curr.distance || 0), 0);
    const totalElevation = activities.reduce((acc, curr) => acc + (curr.total_elevation_gain || 0), 0);
    const totalTime = activities.reduce((acc, curr) => acc + (curr.moving_time || 0), 0);

    // Update DOM
    animateValue('total-distance', (totalDistance / 1000).toFixed(1));
    animateValue('total-elevation', totalElevation.toFixed(0));
    animateValue('total-activities', activities.length);

    // Format time (hours)
    const hours = Math.floor(totalTime / 3600);
    animateValue('total-time', hours);

    // --- New Headline Metrics ---

    // 1. Toughness (Elevation / Distance in km)
    const distanceKm = totalDistance / 1000;
    const toughness = distanceKm > 0 ? (totalElevation / distanceKm).toFixed(1) : '0';
    animateValue('toughness', toughness);

    // 2. Efficiency (Moving Time / Elapsed Time)
    const totalElapsed = activities.reduce((acc, curr) => acc + (curr.elapsed_time || 0), 0);
    const efficiency = totalElapsed > 0 ? ((totalTime / totalElapsed) * 100).toFixed(1) : '0';
    animateValue('efficiency', efficiency + '%');

    // 3. Avg Pace / Speed
    // Logic: If majority is Run -> min/km. If Ride -> km/h.
    // Or just check the filter? Let's check the dominant sport in the filtered set.
    const runCount = activities.filter(a => a.sport_type === 'Run').length;
    const rideCount = activities.filter(a => a.sport_type === 'Ride').length;

    // Default to Pace (min/km) unless it's clearly a Ride focus
    const isRideFocus = rideCount > runCount;

    if (totalDistance > 0 && totalTime > 0) {
        if (isRideFocus) {
            // Speed: km/h
            const avgSpeed = (distanceKm / (totalTime / 3600)).toFixed(1);
            document.getElementById('avg-pace').innerText = avgSpeed;
            document.getElementById('avg-pace-unit').innerText = 'km/h';
        } else {
            // Pace: min/km
            const paceSeconds = totalTime / distanceKm;
            const paceMins = Math.floor(paceSeconds / 60);
            const paceSecs = Math.floor(paceSeconds % 60);
            const paceStr = `${paceMins}:${paceSecs.toString().padStart(2, '0')}`;
            document.getElementById('avg-pace').innerText = paceStr;
            document.getElementById('avg-pace-unit').innerText = 'min/km';
        }
    } else {
        document.getElementById('avg-pace').innerText = '-';
        document.getElementById('avg-pace-unit').innerText = isRideFocus ? 'km/h' : 'min/km';
    }
}

function animateValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.innerText = value;
}

// Global Chart Instances
let typeChartInstance = null;
let progressChartInstance = null;

function renderCharts(activities) {
    // 1. Activity Type Breakdown
    const typeCount = {};
    activities.forEach(a => {
        typeCount[a.sport_type] = (typeCount[a.sport_type] || 0) + 1;
    });

    const ctxType = document.getElementById('typeChart').getContext('2d');

    if (typeChartInstance) typeChartInstance.destroy();

    typeChartInstance = new Chart(ctxType, {
        type: 'doughnut',
        data: {
            labels: Object.keys(typeCount).map(t => formatSportType(t)),
            datasets: [{
                data: Object.values(typeCount),
                backgroundColor: ['#fc4c02', '#4caf50', '#2196f3', '#ffeb3b', '#9c27b0', '#e91e63', '#00bcd4'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#b0b0b0' }
                }
            }
        }
    });

    // 2. Weekly Progress (Distance by Month for better Year view)
    // Dynamic logic: If filtered to 1 year, show Months. If "All Time", show Years?
    // Let's stick to Month view aggregation for now, but maybe aggregate by Year if multiple years selected?
    // User requested "range of years", so let's check selection.

    let labels, data;
    const isMultiYear = currentFilters.year.length > 1;

    const ctxProgress = document.getElementById('progressChart').getContext('2d');

    if (isMultiYear) {
        // Aggregate by Year
        const yearsData = {};
        currentFilters.year.sort().forEach(y => yearsData[y] = 0);

        activities.forEach(a => {
            const y = new Date(a.start_date).getFullYear();
            if (a.distance > 0) yearsData[y] += (a.distance / 1000);
        });

        labels = Object.keys(yearsData);
        data = Object.values(yearsData);
    } else {
        // Aggregate by Month (for single selected year)
        const months = {};
        monthNames.forEach((_, i) => months[i] = 0);

        activities.forEach(a => {
            const m = new Date(a.start_date).getMonth();
            if (a.distance > 0) months[m] += (a.distance / 1000);
        });

        labels = monthNames.map(m => m.substring(0, 3));
        data = Object.values(months);
    }

    if (progressChartInstance) progressChartInstance.destroy();

    progressChartInstance = new Chart(ctxProgress, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Distance (km)',
                data: data,
                backgroundColor: '#fc4c02',
                borderRadius: 4,
                order: 2
            }, {
                type: 'line',
                label: '4-Period Mov. Avg.',
                data: calculateMovingAverage(data, 4),
                borderColor: '#ffffff',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                order: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#b0b0b0' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#b0b0b0' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderActivityList(activities) {
    const listContainer = document.getElementById('activity-list');
    listContainer.innerHTML = '';

    // pagination for list could be added here, currently showing filtered list (limit to 50 for performance)
    activities.slice(0, 50).forEach(activity => {
        const date = new Date(activity.start_date).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', year: '2-digit'
        });

        const isWeightTraining = activity.sport_type === 'WeightTraining';
        const duration = formatDuration(activity.moving_time);

        // Metrics Logic
        let metricsHtml = '';

        if (isWeightTraining) {
            // Setup for WeightTraining
            metricsHtml = `
                <div class="activity-stats">
                    <div class="stat-group">
                        <span class="activity-stat-main">${duration}</span>
                        <span class="activity-stat-sub">Duration</span>
                    </div>
                </div>
            `;
            if (activity.has_heartrate && activity.average_heartrate) {
                metricsHtml += `
                    <div class="activity-stats">
                        <div class="stat-group">
                            <span class="activity-stat-main">${activity.average_heartrate.toFixed(0)} <span class="activity-stat-sub">bpm</span></span>
                        </div>
                    </div>
                `;
            }
        } else {
            // Setup for Cardio (Run, Ride, etc.)
            const distanceKm = (activity.distance / 1000).toFixed(2);
            const elevation = (activity.total_elevation_gain || 0).toFixed(0);

            metricsHtml = `
                <div class="activity-stats">
                    <div class="stat-group">
                        <span class="activity-stat-main">${distanceKm} <span class="activity-stat-sub">km</span></span>
                    </div>
                </div>
                <div class="activity-stats">
                    <div class="stat-group">
                        <span class="activity-stat-main">${duration}</span>
                    </div>
                </div>
                 <div class="activity-stats">
                    <div class="stat-group">
                        <span class="activity-stat-main">${elevation}m <span class="activity-stat-sub">elev</span></span>
                    </div>
                </div>
            `;

            // Add Heart Rate for Cardio if available
            if (activity.has_heartrate && activity.average_heartrate) {
                metricsHtml += `
                    <div class="activity-stats">
                        <div class="stat-group">
                            <span class="activity-stat-main">${activity.average_heartrate.toFixed(0)} <span class="activity-stat-sub">bpm</span></span>
                        </div>
                    </div>
                `;
            }
        }

        // Add Suffer Score if available
        if (activity.suffer_score) {
            metricsHtml += `
                <div class="activity-stats mobile-hide">
                    <div class="stat-group">
                        <span class="activity-stat-main" style="color:#d32f2f">${activity.suffer_score}</span>
                        <span class="activity-stat-sub">Suffer</span>
                    </div>
                </div>
            `;
        }

        const html = `
            <div class="activity-item">
                <div class="activity-info">
                    <h4>${activity.name}</h4>
                    <div class="activity-meta">
                        <span>${date}</span>
                        <span>${formatSportType(activity.sport_type)}</span>
                    </div>
                </div>
                ${metricsHtml}
            </div>
        `;
        listContainer.innerHTML += html;
    });
}

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function formatSportType(type) {
    // Add spaces to CamelCase (e.g., WeightTraining -> Weight Training)
    return type.replace(/([A-Z])/g, ' $1').trim();
}

function calculateMovingAverage(data, windowSize) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        const subset = data.slice(start, i + 1);
        const sum = subset.reduce((a, b) => a + b, 0);
        result.push(sum / subset.length);
    }
    return result;
}

// Polyline Decoder (Google Encoded Polyline Algorithm)
function decodePolyline(str, precision) {
    var index = 0,
        lat = 0,
        lng = 0,
        coordinates = [],
        shift = 0,
        result = 0,
        byte = null,
        latitude_change,
        longitude_change,
        factor = Math.pow(10, precision === undefined ? 5 : precision);

    while (index < str.length) {
        byte = null;
        shift = 0;
        result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

        shift = result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

        lat += latitude_change;
        lng += longitude_change;

        coordinates.push([lat / factor, lng / factor]);
    }

    return coordinates;
}

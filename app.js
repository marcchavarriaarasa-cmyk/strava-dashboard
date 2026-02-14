
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
                borderRadius: 4
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


let allActivities = [];
let currentFilters = {
    year: [],
    month: [],
    type: []
};

// Month names for mapping
const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthNamesEs = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// I18N Configuration
let currentLang = localStorage.getItem('strava_lang') || 'en';

const translations = {
    en: {
        title: "MY ACTIVITY",
        total_distance: "Total Distance",
        elevation_gain: "Elevation Gain",
        total_time: "Total Time",
        activities: "Activities",
        avg_pace: "Avg Pace / Speed",
        efficiency: "Efficiency",
        toughness: "Toughness",

        km: "Kilometers",
        meters: "Meters",
        hours: "Hours",
        sessions: "Sessions",
        moving_vs_elapsed: "Moving vs Elapsed",
        elev_per_km: "Elev Gain / km",

        monthly_goals: "Monthly Goals (Current Month)",
        running: "🏃‍♂️ Running",
        cycling: "🚴‍♂️ Cycling",
        on_track: "On track",

        year: "Year",
        month: "Month",
        sport: "Sport",
        select_years: "Select Years",
        select_months: "Select Months",
        select_sports: "Select Sports",
        all: "All",
        select: "Select",

        recent_distance: "Recent Activity (Distance)",
        sport_type: "Sport Type",

        consistency_trends: "Consistency & Trends",
        activity_habit: "Activity Habit (Last Year)",
        current_streak: "Current Streak",
        best_streak: "Best Streak",
        time_of_day: "Time of Day",
        days: "Days",

        personal_records: "Personal Records",
        longest_run: "Longest Run",
        longest_ride: "Longest Ride",
        max_elevation: "Max Elevation",
        best_5k: "Fastest 5k",
        best_10k: "Fastest 10k",
        best_marathon: "Marathon",

        geography_gear: "Geography & Equipment",
        latest_route: "Latest Route",
        gear_usage: "Gear Usage (Distance)",

        training_quality: "Training Quality",
        pulse_dist: "Pulse Distribution (Avg HR)",
        effort_trend: "Relative Effort Trend",

        recent_activities: "Recent Activities",
        duration: "Duration",
        elev: "elev",
        suffer: "Suffer",

        // Month Abbreviations
        months_short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    },
    es: {
        title: "MI ACTIVIDAD",
        total_distance: "Distancia Total",
        elevation_gain: "Desnivel Positivo",
        total_time: "Tiempo Total",
        activities: "Actividades",
        avg_pace: "Ritmo / Vel. Media",
        efficiency: "Eficiencia",
        toughness: "Dureza",

        km: "Kilómetros",
        meters: "Metros",
        hours: "Horas",
        sessions: "Sesiones",
        moving_vs_elapsed: "Movimiento vs Total",
        elev_per_km: "Desnivel / km",

        monthly_goals: "Objetivos Mensuales",
        running: "🏃‍♂️ Running",
        cycling: "🚴‍♂️ Cycling",
        on_track: "Proyección",

        year: "Año",
        month: "Mes",
        sport: "Deporte",
        select_years: "Filtrar Años",
        select_months: "Filtrar Meses",
        select_sports: "Filtrar Deportes",
        all: "Todos",
        select: "Seleccionar",

        recent_distance: "Actividad Reciente (Distancia)",
        sport_type: "Tipo de Deporte",

        consistency_trends: "Consistencia y Tendencias",
        activity_habit: "Hábito (Último Año)",
        current_streak: "Racha Actual",
        best_streak: "Mejor Racha",
        time_of_day: "Hora del Día",
        days: "Días",
        personal_records: "Mejores Marcas",
        longest_run: "Carrera Más Larga",
        longest_ride: "Salida Bici Más Larga",
        max_elevation: "Mayor Desnivel",
        best_5k: "Mejor 5k",
        best_10k: "Mejor 10k",
        best_marathon: "Maratón",

        geography_gear: "Geografía y Equipo",
        latest_route: "Última Ruta",
        gear_usage: "Uso de Material (Distancia)",

        training_quality: "Calidad de Entrenamiento",
        pulse_dist: "Distribución de Pulso (FC Media)",
        effort_trend: "Tendencia de Esfuerzo Relativo",

        recent_activities: "Actividades Recientes",
        duration: "Duración",
        elev: "desn",
        suffer: "Suffer",

        // Month Abbreviations
        months_short: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    }
};


document.addEventListener('DOMContentLoaded', () => {
    // Init Language
    updateLanguage();
    document.getElementById('lang-btn').addEventListener('click', toggleLanguage);
    toggleLanguage(false); // Update button text only without toggle, hacky but works via logic below

    fetchData();

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.multiselect-container') && !e.target.closest('.lang-btn')) {
            document.querySelectorAll('.multiselect-dropdown').forEach(el => el.classList.remove('show'));
        }
    });
});

function toggleLanguage(switchLang = true) {
    if (switchLang) {
        currentLang = currentLang === 'en' ? 'es' : 'en';
        localStorage.setItem('strava_lang', currentLang);
    }

    // Update Button Text (to show what you CAN switch to, or current?)
    // Let's show current.
    document.getElementById('lang-btn').innerText = currentLang === 'en' ? 'ES' : 'EN';

    updateLanguage();
    // Re-render dashboard to update dynamic js texts
    if (allActivities.length > 0) applyFilters();
}

function updateLanguage() {
    const t = translations[currentLang];

    // Update simple text elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.innerText = t[key];
    });
}


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
    // Use raw indices 0-11 for month filter, independent of name
    currentFilters.month = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

    // Render Dropdowns
    renderCheckboxList('yearList', sortedYears, currentFilters.year, 'year');
    renderCheckboxList('typeList', sortedTypes, currentFilters.type, 'type', formatSportType);

    // Render Months (All 12)
    // Use current lang month names for dropdown
    const monthNames = currentLang === 'en' ? monthNamesEn : monthNamesEs;
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

function updateButtonText(btnId, labelKey, selectedCount, totalCount) {
    const btn = document.getElementById(btnId);
    const t = translations[currentLang];
    // Dynamic Labels: "Select Years" vs "Years"
    // simplistic approach
    let baseLabel = t[labelKey] || labelKey; // e.g. "Year" -> "Año"

    // Hack: Map internal keys to i18n keys for plural buttons
    let i18nSelectKey = `select_${labelKey}s`; // select_years
    let selectText = t[i18nSelectKey] || `Select ${baseLabel}`;
    let allText = `${t.all} ${baseLabel}s`; // Todos Años (approx)

    if (selectedCount === 0) {
        btn.innerText = selectText;
    } else if (selectedCount === totalCount) {
        btn.innerText = t.all || "All";
    } else {
        btn.innerText = `${selectedCount} ${baseLabel}`; // 3 Años
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
    renderTrainingQuality(activities);
    renderPersonalRecords(activities);
    renderGoals(activities);
}

function renderPersonalRecords(activities) {
    // 1. Longest Run
    const runs = activities.filter(a => a.sport_type === 'Run' || a.type === 'Run');
    let longestRun = { distance: 0, date: '-' };
    if (runs.length > 0) {
        const maxRun = runs.reduce((max, curr) => (curr.distance > max.distance) ? curr : max, runs[0]);
        longestRun = {
            distance: (maxRun.distance / 1000).toFixed(2) + ' km',
            date: new Date(maxRun.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        };
    }

    // 2. Longest Ride
    const rides = activities.filter(a => a.sport_type === 'Ride' || a.type === 'Ride' || a.sport_type === 'MountainBikeRide');
    let longestRide = { distance: 0, date: '-' };
    if (rides.length > 0) {
        const maxRide = rides.reduce((max, curr) => (curr.distance > max.distance) ? curr : max, rides[0]);
        longestRide = {
            distance: (maxRide.distance / 1000).toFixed(2) + ' km',
            date: new Date(maxRide.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        };
    }

    // 3. Max Elevation (across all sports)
    let maxElev = { elem: 0, date: '-' };
    if (activities.length > 0) {
        const maxE = activities.reduce((max, curr) => ((curr.total_elevation_gain || 0) > (max.total_elevation_gain || 0)) ? curr : max, activities[0]);
        maxElev = {
            elem: (maxE.total_elevation_gain || 0).toFixed(0) + ' m',
            date: new Date(maxE.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        };
    }

    // 4. Best Efforts (Estimated)
    // 5k: 5000m (+/- 200m?)
    const best5k = getBestEffort(runs, 5000, 200);
    const best10k = getBestEffort(runs, 10000, 200);
    const bestMarathon = getBestEffort(runs, 42195, 500); // 42.2km +/- 500m

    // Update DOM
    document.getElementById('longest-run-dist').innerText = longestRun.distance !== 0 ? longestRun.distance : '-';
    document.getElementById('longest-run-date').innerText = longestRun.date;

    document.getElementById('longest-ride-dist').innerText = longestRide.distance !== 0 ? longestRide.distance : '-';
    document.getElementById('longest-ride-date').innerText = longestRide.date;

    document.getElementById('max-elevation').innerText = maxElev.elem !== 0 ? maxElev.elem : '-';
    document.getElementById('max-elevation-date').innerText = maxElev.date;

    document.getElementById('best-5k-time').innerText = best5k.time;
    document.getElementById('best-5k-date').innerText = best5k.date;

    document.getElementById('best-10k-time').innerText = best10k.time;
    document.getElementById('best-10k-date').innerText = best10k.date;

    document.getElementById('best-marathon-time').innerText = bestMarathon.time;
    document.getElementById('best-marathon-date').innerText = bestMarathon.date;
}

function getBestEffort(activities, targetDistance, tolerance) {
    // Find activities within range [target - tolerance, target + tolerance]
    // Then sort by moving_time ascending
    const candidates = activities.filter(a => {
        const d = a.distance;
        return d >= (targetDistance - tolerance) && d <= (targetDistance + tolerance);
    });

    if (candidates.length === 0) return { time: '-', date: '-' };

    const best = candidates.reduce((min, curr) => (curr.moving_time < min.moving_time) ? curr : min, candidates[0]);

    // Format time (HH:MM:SS or MM:SS)
    const timeStr = formatDuration(best.moving_time);
    const dateStr = new Date(best.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    return { time: timeStr, date: dateStr };
}

function renderGoals(activities) {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();
    const currentDay = now.getDate();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Goals Config
    const goalsConfig = {
        runMonthlyTarget: 100, // km
        rideMonthlyTarget: 300 // km
    };

    // Reset Totals
    let runDist = 0;
    let rideDist = 0;

    // Sum distances for current month
    activities.forEach(a => {
        const d = new Date(a.start_date); // UTC
        // Use local time for correct monthly assignment
        // If start_date_local is available usage that, but start_date JS Date obj converts to browser local usually
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            const km = a.distance / 1000;
            if (a.sport_type === 'Run' || a.type === 'Run') {
                runDist += km;
            } else if (a.sport_type === 'Ride' || a.type === 'Ride' || a.sport_type === 'MountainBikeRide') {
                rideDist += km;
            }
        }
    });

    // Update UI
    updateGoalUI('run', runDist, goalsConfig.runMonthlyTarget, currentDay, daysInMonth);
    updateGoalUI('ride', rideDist, goalsConfig.rideMonthlyTarget, currentDay, daysInMonth);
}

function updateGoalUI(type, current, target, day, totalDays) {
    // 1. Progress Bar
    const pct = Math.min((current / target) * 100, 100);
    document.getElementById(`${type}-progress`).style.width = `${pct}%`;

    // 2. Text
    document.getElementById(`${type}-current`).innerText = `${current.toFixed(1)} km`;
    document.getElementById(`${type}-target`).innerText = `/ ${target} km`;

    // 3. Projection
    // formula: (current / day) * totalDays
    // prevent division by zero or weirdness on day 0
    let projection = 0;
    if (day > 0) {
        projection = (current / day) * totalDays;
    }

    const projEl = document.getElementById(`${type}-projection`);
    const t = translations[currentLang];
    projEl.innerText = `${t.on_track}: ${projection.toFixed(0)} km`;

    // Style projection: Green if >= target, Red/Orange if < target
    if (projection >= target) {
        projEl.style.color = '#4caf50'; // Green
    } else {
        projEl.style.color = '#ff9800'; // Orange
    }
}

function renderTrainingQuality(activities) {
    // --- 1. Pulse Distribution (Avg HR Buckets) ---
    // We categorize activities by their Average HR to see polarization.
    // Buckets: <125 (Z1), 125-140 (Z2), 140-155 (Z3), 155-170 (Z4), >170 (Z5)
    // Adjust these arbitrary thresholds or make them dynamic later.
    const hrBuckets = { 'Z1 (<125)': 0, 'Z2 (125-140)': 0, 'Z3 (140-155)': 0, 'Z4 (155-170)': 0, 'Z5 (>170)': 0 };

    let hasHrData = false;
    activities.forEach(a => {
        if (a.has_heartrate && a.average_heartrate) {
            hasHrData = true;
            const hr = a.average_heartrate;
            if (hr < 125) hrBuckets['Z1 (<125)']++;
            else if (hr < 140) hrBuckets['Z2 (125-140)']++;
            else if (hr < 155) hrBuckets['Z3 (140-155)']++;
            else if (hr < 170) hrBuckets['Z4 (155-170)']++;
            else hrBuckets['Z5 (>170)']++;
        }
    });

    const ctxHr = document.getElementById('hrDistributionChart').getContext('2d');
    if (window.hrChartInstance) window.hrChartInstance.destroy();

    window.hrChartInstance = new Chart(ctxHr, {
        type: 'bar',
        data: {
            labels: Object.keys(hrBuckets),
            datasets: [{
                label: 'Activities',
                data: Object.values(hrBuckets),
                backgroundColor: [
                    '#4caf50', // Z1 Green
                    '#8bc34a', // Z2 Light Green
                    '#ffeb3b', // Z3 Yellow
                    '#ff9800', // Z4 Orange
                    '#f44336'  // Z5 Red
                ],
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

    // --- 2. Effort Trend (Suffer Score or HR) ---
    // Use last 30 activities for readability
    const recentActivities = activities.slice(0, 30).reverse(); // Oldest first
    const labels = recentActivities.map(a => new Date(a.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));

    // Data: Suffer Score if available, else null
    const sufferData = recentActivities.map(a => a.suffer_score || null);
    // Data: Avg HR as secondary
    const hrData = recentActivities.map(a => a.average_heartrate || null);

    const ctxEffort = document.getElementById('effortTrendChart').getContext('2d');
    if (window.effortChartInstance) window.effortChartInstance.destroy();

    window.effortChartInstance = new Chart(ctxEffort, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Relative Effort',
                    data: sufferData,
                    borderColor: '#f44336', // Strava Red
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Avg HR',
                    data: hrData,
                    borderColor: '#2196f3', // Blue
                    borderDash: [5, 5],
                    tension: 0.4,
                    yAxisID: 'y1',
                    hidden: true // Hide by default to not clutter
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#b0b0b0' },
                    title: { display: true, text: 'Relative Effort', color: '#b0b0b0' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#2196f3' },
                    title: { display: true, text: 'Avg HR', color: '#2196f3' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#b0b0b0' }
                }
            }
        }
    });
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
        'g21829526': 'Nike Zoom Fly 5',
        'g22746812': 'HOKA Bondi 9',
        'b16055834': 'Kross', // User confirmed name
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

        labels = translations[currentLang].months_short;
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
    const t = translations[currentLang];

    activities.slice(0, 50).forEach(activity => {
        const date = new Date(activity.start_date).toLocaleDateString(currentLang === 'es' ? 'es-ES' : 'en-US', {
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
                        <span class="activity-stat-sub">${t.duration}</span>
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
                        <span class="activity-stat-main">${elevation}m <span class="activity-stat-sub">${t.elev}</span></span>
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
                        <span class="activity-stat-sub">${t.suffer}</span>
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

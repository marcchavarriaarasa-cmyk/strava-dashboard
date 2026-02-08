
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
});

async function fetchData() {
    try {
        const response = await fetch('data/activities.json');
        const activities = await response.json();

        // Hide loading screen
        document.getElementById('loading').style.display = 'none';

        // Process Data
        updateUserStats(activities);
        renderCharts(activities);
        renderActivityList(activities);

    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('loading').innerHTML = '<p>Error loading data. Please check console.</p>';
    }
}

function updateUserStats(activities) {
    // Calculate totals
    const totalDistance = activities.reduce((acc, curr) => acc + curr.distance, 0);
    const totalElevation = activities.reduce((acc, curr) => acc + curr.total_elevation_gain, 0);
    const totalTime = activities.reduce((acc, curr) => acc + curr.moving_time, 0);

    // Update DOM
    document.getElementById('total-distance').innerText = (totalDistance / 1000).toFixed(1);
    document.getElementById('total-elevation').innerText = totalElevation.toFixed(0);
    document.getElementById('total-activities').innerText = activities.length;

    // Format time (hours)
    const hours = Math.floor(totalTime / 3600);
    document.getElementById('total-time').innerText = hours;
}

function renderCharts(activities) {
    // 1. Activity Type Breakdown
    const typeCount = {};
    activities.forEach(a => {
        typeCount[a.sport_type] = (typeCount[a.sport_type] || 0) + 1;
    });

    const ctxType = document.getElementById('typeChart').getContext('2d');
    new Chart(ctxType, {
        type: 'doughnut',
        data: {
            labels: Object.keys(typeCount),
            datasets: [{
                data: Object.values(typeCount),
                backgroundColor: ['#fc4c02', '#4caf50', '#2196f3', '#ffeb3b', '#9c27b0'],
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

    // 2. Weekly Progress (Last 7 days approx, or just recent activities)
    // Simplified: Show distance of last 7 activities for visualization
    const recentActivities = activities.slice(0, 7).reverse();
    const labels = recentActivities.map(a => new Date(a.start_date).toLocaleDateString(undefined, { weekday: 'short' }));
    const data = recentActivities.map(a => (a.distance / 1000).toFixed(1));

    const ctxProgress = document.getElementById('progressChart').getContext('2d');
    new Chart(ctxProgress, {
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

    // Take top 10 recent
    activities.slice(0, 10).forEach(activity => {
        const date = new Date(activity.start_date).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const distanceKm = (activity.distance / 1000).toFixed(2);
        const duration = formatDuration(activity.moving_time);
        const elevation = activity.total_elevation_gain.toFixed(0);

        const html = `
            <div class="activity-item">
                <div class="activity-info">
                    <h4>${activity.name}</h4>
                    <div class="activity-meta">
                        <span>${date}</span>
                        <span>${activity.sport_type}</span>
                    </div>
                </div>
                <div class="activity-stats">
                    <div class="stat-group">
                        <span class="activity-stat-main">${distanceKm} <span class="activity-stat-sub">km</span></span>
                    </div>
                </div>
                <div class="activity-stats">
                    <div class="stat-group">
                        <span class="activity-stat-main">${duration} <span class="activity-stat-sub">time</span></span>
                    </div>
                </div>
                 <div class="activity-stats">
                    <div class="stat-group">
                        <span class="activity-stat-main">${elevation}m <span class="activity-stat-sub">elev</span></span>
                    </div>
                </div>
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

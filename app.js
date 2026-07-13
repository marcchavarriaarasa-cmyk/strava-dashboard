const state = { activities: [], range: 84, sport: 'Todos' };
const sportLabels = {
  Run: 'Correr', Ride: 'Bici', MountainBikeRide: 'MTB', Walk: 'Caminar',
  Hike: 'Senderismo', WeightTraining: 'Fuerza', Swim: 'Nadar',
  Pilates: 'Pilates', Tennis: 'Tenis', Workout: 'Entreno'
};

const $ = (selector) => document.querySelector(selector);
const fmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const fmtOne = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

async function init() {
  try {
    const response = await fetch('data/activities.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.activities = (await response.json()).sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
    if (!state.activities.length) throw new Error('no hay actividades disponibles');
    bindControls();
    renderSportControls();
    render();
    $('#loading').classList.add('is-hidden');
  } catch (error) {
    $('#loading').innerHTML = `<span class="error">NO SE HAN PODIDO LEER LOS DATOS · ${error.message}</span>`;
  }
}

function bindControls() {
  document.querySelectorAll('[data-range]').forEach(button => {
    button.setAttribute('aria-pressed', button.classList.contains('is-active'));
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-range]').forEach(item => {
        item.classList.remove('is-active');
        item.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('is-active');
      button.setAttribute('aria-pressed', 'true');
      state.range = button.dataset.range === 'all' ? 'all' : Number(button.dataset.range);
      render();
    });
  });
}

function renderSportControls() {
  const sports = ['Todos', ...new Set(state.activities.map(item => item.sport_type))];
  $('#sport-switch').innerHTML = sports.map((sport, index) =>
    `<button class="${index === 0 ? 'is-active' : ''}" aria-pressed="${index === 0}" data-sport="${sport}">${sport === 'Todos' ? 'TODOS' : (sportLabels[sport] || sport).toUpperCase()}</button>`
  ).join('');
  document.querySelectorAll('[data-sport]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-sport]').forEach(item => {
        item.classList.remove('is-active');
        item.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('is-active');
      button.setAttribute('aria-pressed', 'true');
      state.sport = button.dataset.sport;
      render();
    });
  });
}

function filteredActivities() {
  const reference = new Date(state.activities[0].start_date);
  const threshold = state.range === 'all' ? null : new Date(reference.getTime() - state.range * 86400000);
  return state.activities.filter(item => {
    const inRange = !threshold || new Date(item.start_date) >= threshold;
    const matchesSport = state.sport === 'Todos' || item.sport_type === state.sport;
    return inRange && matchesSport;
  });
}

function render() {
  const activities = filteredActivities();
  const latestDate = new Date(state.activities[0].start_date_local || state.activities[0].start_date);
  $('#sync-date').textContent = `DATOS HASTA ${latestDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}`;
  $('#edition').textContent = `TEMPORADA ${latestDate.getFullYear()}`;
  renderMetrics(activities);
  renderWeeklyVolume(activities);
  renderSportMix(activities);
  renderCalendar();
  renderActivityTable(activities);
}

function renderMetrics(activities) {
  const distance = sum(activities, 'distance') / 1000;
  const time = sum(activities, 'moving_time');
  const elevation = sum(activities, 'total_elevation_gain');
  const streak = calculateStreak(state.activities);
  $('#hero-distance').textContent = fmtOne.format(distance);
  $('#hero-caption').textContent = state.sport === 'Todos' ? 'EN EL PERIODO SELECCIONADO' : `${sportLabels[state.sport] || state.sport} · PERIODO SELECCIONADO`;
  $('#metric-time').textContent = `${fmtOne.format(time / 3600)} H`;
  $('#metric-elevation').textContent = `${fmt.format(elevation)} M`;
  $('#metric-sessions').textContent = fmt.format(activities.length);
  $('#metric-streak').textContent = `${streak} D`;
  const weeks = state.range === 'all' ? Math.max(1, dateSpanDays(activities) / 7) : state.range / 7;
  $('#frequency-note').textContent = `${fmtOne.format(activities.length / Math.max(weeks, 1))} SESIONES / SEMANA`;
  $('#time-delta').textContent = distance > 0 ? `${fmtOne.format(distance / Math.max(time / 3600, 1))} KM / H ACTIVA` : 'TRABAJO SIN DISTANCIA';
}

function renderWeeklyVolume(activities) {
  const reference = startOfWeek(new Date(state.activities[0].start_date));
  const weeks = Array.from({ length: 12 }, (_, index) => {
    const start = new Date(reference.getTime() - (11 - index) * 7 * 86400000);
    const end = new Date(start.getTime() + 7 * 86400000);
    const distance = activities.filter(item => {
      const date = new Date(item.start_date);
      return date >= start && date < end;
    }).reduce((total, item) => total + (item.distance || 0), 0) / 1000;
    return { start, distance };
  });
  const max = Math.max(...weeks.map(item => item.distance), 1);
  $('#volume-chart').innerHTML = weeks.map(item => {
    const label = item.start.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).replace('.', '');
    return `<div class="week-bar" style="--height:${Math.max(1, item.distance / max * 100)}%" data-label="${label}" data-value="${fmtOne.format(item.distance)}"></div>`;
  }).join('');
}

function renderSportMix(activities) {
  const counts = activities.reduce((result, item) => {
    result[item.sport_type] = (result[item.sport_type] || 0) + 1;
    return result;
  }, {});
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = rows[0]?.[1] || 1;
  $('#sport-mix').innerHTML = rows.length ? rows.map(([sport, count]) => `
    <div class="mix-row">
      <span class="mix-name">${(sportLabels[sport] || sport).toUpperCase()}</span>
      <div class="mix-track"><div class="mix-fill" style="--width:${count / max * 100}%"></div></div>
      <span class="mix-value">${count}</span>
    </div>`).join('') : '<p>Sin actividades en este periodo.</p>';
}

function renderCalendar() {
  const reference = new Date(state.activities[0].start_date);
  const end = endOfWeek(reference);
  const start = new Date(end.getTime() - 12 * 7 * 86400000 + 86400000);
  const distanceByDay = new Map();
  state.activities.forEach(item => {
    const key = dayKey(new Date(item.start_date_local || item.start_date));
    const load = (item.distance || 0) / 1000 + (item.moving_time || 0) / 3600 * 2;
    distanceByDay.set(key, (distanceByDay.get(key) || 0) + load);
  });
  const values = [];
  for (let date = new Date(start); date <= end; date = new Date(date.getTime() + 86400000)) {
    values.push({ date: new Date(date), load: distanceByDay.get(dayKey(date)) || 0 });
  }
  const nonZero = values.map(item => item.load).filter(Boolean).sort((a, b) => a - b);
  const q1 = nonZero[Math.floor(nonZero.length * .35)] || 1;
  const q2 = nonZero[Math.floor(nonZero.length * .65)] || 3;
  const q3 = nonZero[Math.floor(nonZero.length * .85)] || 7;
  $('#training-calendar').innerHTML = values.map(item => {
    const level = item.load === 0 ? 0 : item.load <= q1 ? 1 : item.load <= q2 ? 2 : item.load <= q3 ? 3 : 4;
    const title = `${item.date.toLocaleDateString('es-ES')}: ${item.load ? fmtOne.format(item.load) + ' carga' : 'descanso'}`;
    return `<div class="day-cell" data-level="${level}" title="${title}"></div>`;
  }).join('');
  const activeDays = values.filter(item => item.load > 0).length;
  $('#active-days-note').textContent = `${activeDays} DÍAS ACTIVOS · ${values.length - activeDays} DE DESCANSO`;
}

function renderActivityTable(activities) {
  const recent = activities.slice(0, 6);
  $('#latest-count').textContent = `${activities.length} REGISTROS`;
  $('#activity-table').innerHTML = recent.length ? recent.map(item => {
    const date = new Date(item.start_date_local || item.start_date);
    const distance = (item.distance || 0) / 1000;
    return `<div class="activity-row">
      <span class="activity-date">${date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).replace('.', '')}</span>
      <span class="activity-title">${escapeHtml(item.name || 'Actividad')}<span>${(sportLabels[item.sport_type] || item.sport_type).toUpperCase()}</span></span>
      <span class="activity-value">${distance ? fmtOne.format(distance) + ' KM' : formatDuration(item.moving_time)}</span>
      <span class="activity-value">${item.total_elevation_gain ? '+' + fmt.format(item.total_elevation_gain) + ' M' : '—'}</span>
    </div>`;
  }).join('') : '<p>Sin actividades para este filtro.</p>';
}

function calculateStreak(activities) {
  const days = new Set(activities.map(item => dayKey(new Date(item.start_date_local || item.start_date))));
  let cursor = new Date(activities[0].start_date_local || activities[0].start_date);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return streak;
}

function sum(items, key) { return items.reduce((total, item) => total + (Number(item[key]) || 0), 0); }
function dayKey(date) { return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; }
function startOfWeek(date) { const copy = new Date(date); const day = (copy.getDay() + 6) % 7; copy.setHours(0, 0, 0, 0); copy.setDate(copy.getDate() - day); return copy; }
function endOfWeek(date) { return new Date(startOfWeek(date).getTime() + 7 * 86400000 - 1); }
function dateSpanDays(items) { if (items.length < 2) return 1; return Math.max(1, (new Date(items[0].start_date) - new Date(items[items.length - 1].start_date)) / 86400000); }
function formatDuration(seconds = 0) { const hours = Math.floor(seconds / 3600); const minutes = Math.round((seconds % 3600) / 60); return hours ? `${hours}H ${minutes}M` : `${minutes} MIN`; }
function escapeHtml(value) { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; }

init();

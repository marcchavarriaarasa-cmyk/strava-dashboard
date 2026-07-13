const DAY_MS = 86400000;
const state = { activities: [], range: 84, sport: 'Todos' };
const sportLabels = {
  Run: 'Correr', Ride: 'Bici', MountainBikeRide: 'MTB', Walk: 'Caminar',
  Hike: 'Senderismo', WeightTraining: 'Fuerza', Swim: 'Nadar',
  Pilates: 'Pilates', Tennis: 'Tenis', Workout: 'Entreno'
};
const nonDistanceSports = new Set(['WeightTraining', 'Pilates', 'Workout']);

const $ = (selector) => document.querySelector(selector);
const fmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const fmtOne = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

async function init() {
  try {
    const response = await fetch('data/activities.public.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.activities = (await response.json()).sort((a, b) => activityDate(b) - activityDate(a));
    if (!state.activities.length) throw new Error('no hay actividades disponibles');
    bindControls();
    renderSportControls();
    render();
    $('#loading').classList.add('is-hidden');
  } catch (error) {
    const loading = $('#loading');
    loading.textContent = `NO SE HAN PODIDO LEER LOS DATOS · ${error.message}`;
    loading.classList.add('error');
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

function activitiesForPeriod(periodOffset = 0) {
  if (state.range === 'all') {
    return periodOffset === 0 ? state.activities.filter(matchesSport) : [];
  }
  const reference = activityDate(state.activities[0]);
  const end = new Date(reference.getTime() - periodOffset * state.range * DAY_MS);
  const start = new Date(end.getTime() - (state.range - 1) * DAY_MS);
  return state.activities.filter(item => {
    const date = activityDate(item);
    return date >= start && date <= end && matchesSport(item);
  });
}

function matchesSport(item) {
  return state.sport === 'Todos' || item.sport_type === state.sport;
}

function render() {
  const activities = activitiesForPeriod(0);
  const previousActivities = activitiesForPeriod(1);
  const latestDate = activityDate(state.activities[0]);
  $('#sync-date').textContent = `DATOS HASTA ${latestDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}`;
  $('#edition').textContent = `TEMPORADA ${latestDate.getFullYear()}`;
  renderMetrics(activities, previousActivities);
  renderWeeklyVolume(activities);
  renderSportMix(activities);
  renderTrainingLoad(activities);
  renderRunningProgress(activities);
  renderPersonalBests(activities);
  renderGearUsage(activities);
  renderCalendar(state.activities.filter(matchesSport));
  renderActivityTable(activities);
}

function renderMetrics(activities, previousActivities) {
  const current = summarize(activities);
  const previous = summarize(previousActivities);
  const distanceBased = selectionUsesDistance();
  const streaks = calculateStreaks(activities);
  const weeks = periodWeeks(activities);
  const previousWeeks = periodWeeks(previousActivities);
  const currentFrequency = current.sessions / weeks;
  const previousFrequency = previous.sessions / previousWeeks;
  const currentAverageMinutes = current.sessions ? current.seconds / current.sessions / 60 : 0;
  const previousAverageMinutes = previous.sessions ? previous.seconds / previous.sessions / 60 : 0;

  $('#hero-distance').textContent = distanceBased ? fmtOne.format(current.distanceKm) : fmt.format(current.sessions);
  $('#hero-unit').textContent = distanceBased ? 'KM' : 'SESIONES';
  $('#hero-number').setAttribute('aria-label', distanceBased ? 'Distancia total del periodo' : 'Sesiones totales del periodo');
  $('#hero-caption').textContent = state.sport === 'Todos' ? 'EN EL PERIODO SELECCIONADO' : `${sportLabels[state.sport] || state.sport} · PERIODO SELECCIONADO`;
  $('#hero-comparison').textContent = formatComparison(distanceBased ? current.distanceKm : current.sessions, distanceBased ? previous.distanceKm : previous.sessions);
  $('#metric-time').textContent = `${fmtOne.format(current.hours)} H`;
  $('#time-comparison').textContent = formatComparison(current.seconds, previous.seconds);
  $('#metric-time-label').textContent = 'TIEMPO ACTIVO';
  $('#metric-streak').textContent = `${streaks.latest} D`;
  $('#metric-streak-label').textContent = state.sport === 'Todos' ? 'RACHA ACTIVA' : 'ÚLTIMA RACHA';
  $('#best-streak-note').textContent = `MEJOR RACHA · ${streaks.best} D`;

  if (distanceBased) {
    $('#metric-elevation-label').textContent = 'DESNIVEL';
    $('#metric-elevation').textContent = `${fmt.format(current.elevation)} M`;
    $('#elevation-comparison').textContent = formatComparison(current.elevation, previous.elevation);
    $('#elevation-delta').textContent = 'METROS POSITIVOS';
    $('#metric-sessions-label').textContent = 'SESIONES';
    $('#metric-sessions').textContent = fmt.format(current.sessions);
    $('#sessions-comparison').textContent = formatComparison(current.sessions, previous.sessions);
    $('#frequency-note').textContent = `${fmtOne.format(currentFrequency)} SESIONES / SEMANA`;
    $('#time-delta').textContent = current.distanceKm > 0 ? `${fmtOne.format(current.distanceKm / Math.max(current.hours, 1))} KM / H ACTIVA` : 'DURACIÓN ACUMULADA';
  } else {
    $('#metric-elevation-label').textContent = 'DURACIÓN MEDIA';
    $('#metric-elevation').textContent = `${fmt.format(currentAverageMinutes)} MIN`;
    $('#elevation-comparison').textContent = formatComparison(currentAverageMinutes, previousAverageMinutes);
    $('#elevation-delta').textContent = 'POR SESIÓN';
    $('#metric-sessions-label').textContent = 'FRECUENCIA';
    $('#metric-sessions').textContent = `${fmtOne.format(currentFrequency)} / SEM`;
    $('#sessions-comparison').textContent = formatComparison(currentFrequency, previousFrequency);
    $('#frequency-note').textContent = `${fmt.format(current.sessions)} SESIONES EN EL PERIODO`;
    $('#time-delta').textContent = 'DURACIÓN ACUMULADA';
  }
}

function selectionUsesDistance() {
  return state.sport === 'Todos' || !nonDistanceSports.has(state.sport);
}

function periodWeeks(activities) {
  if (state.range !== 'all') return state.range / 7;
  return Math.max(1, (dateSpanDays(activities) + 1) / 7);
}

function summarize(activities) {
  const seconds = sum(activities, 'moving_time');
  return {
    distanceKm: sum(activities, 'distance') / 1000,
    seconds,
    hours: seconds / 3600,
    elevation: sum(activities, 'total_elevation_gain'),
    sessions: activities.length
  };
}

function formatComparison(current, previous) {
  if (state.range === 'all') return 'TODO EL HISTORIAL';
  if (previous === 0) return current === 0 ? 'SIN ACTIVIDAD EN AMBOS PERIODOS' : 'SIN BASE ANTERIOR';
  const change = (current - previous) / previous * 100;
  if (Math.abs(change) < 0.5) return 'ESTABLE VS PERIODO ANTERIOR';
  return `${change > 0 ? '+' : ''}${fmt.format(change)} % VS PERIODO ANTERIOR`;
}

function weekCount() {
  return state.range === 28 ? 4 : 12;
}

function buildWeeks(activities) {
  const count = weekCount();
  const reference = startOfWeek(activityDate(state.activities[0]));
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(reference.getTime() - (count - 1 - index) * 7 * DAY_MS);
    const end = new Date(start.getTime() + 7 * DAY_MS);
    const items = activities.filter(item => {
      const date = activityDate(item);
      return date >= start && date < end;
    });
    return {
      start,
      label: start.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).replace('.', ''),
      items
    };
  });
}

function renderWeeklyVolume(activities) {
  const distanceBased = selectionUsesDistance();
  const weeks = buildWeeks(activities).map(week => ({
    ...week,
    value: distanceBased ? sum(week.items, 'distance') / 1000 : sum(week.items, 'moving_time') / 60
  }));
  const panel = $('.volume-panel');
  const max = Math.max(...weeks.map(item => item.value), 0);
  panel.classList.toggle('is-hidden', max === 0);
  panel.classList.toggle('is-wide', state.sport !== 'Todos');
  if (max === 0) return;
  $('#volume-legend-text').textContent = distanceBased ? 'DISTANCIA / KM' : 'MINUTOS ACTIVOS / SEMANA';
  const chart = $('#volume-chart');
  chart.setAttribute('aria-label', distanceBased ? 'Distancia semanal en kilómetros' : 'Minutos activos por semana');
  chart.style.setProperty('--week-count', weeks.length);
  chart.innerHTML = weeks.map(item =>
    `<div class="week-bar${item.value > 0 ? ' has-value' : ''}" style="--height:${item.value / max * 100}%" data-label="${item.label}" data-value="${distanceBased ? fmtOne.format(item.value) : fmt.format(item.value)}"></div>`
  ).join('');
}

function renderSportMix(activities) {
  const counts = activities.reduce((result, item) => {
    result[item.sport_type] = (result[item.sport_type] || 0) + 1;
    return result;
  }, {});
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const panel = $('.mix-panel');
  const shouldShow = state.sport === 'Todos' && rows.length > 1;
  panel.classList.toggle('is-hidden', !shouldShow);
  if (!shouldShow) return;
  const max = rows[0]?.[1] || 1;
  $('#sport-mix').innerHTML = rows.length ? rows.map(([sport, count]) => `
    <div class="mix-row">
      <span class="mix-name">${(sportLabels[sport] || sport).toUpperCase()}</span>
      <div class="mix-track"><div class="mix-fill" style="--width:${count / max * 100}%"></div></div>
      <span class="mix-value">${count}</span>
    </div>`).join('') : '<p>Sin actividades en este periodo.</p>';
}

function renderTrainingLoad(activities) {
  const panel = $('.load-panel');
  if (!selectionUsesDistance() && state.sport !== 'Todos') {
    panel.classList.add('is-hidden');
    return;
  }
  const weeks = buildWeeks(activities).map(week => {
    const cardio = week.items.filter(item => item.sport_type !== 'WeightTraining' && hasRelativeEffort(item));
    const strength = week.items.filter(item => item.sport_type === 'WeightTraining');
    return {
      ...week,
      cardioEffort: cardio.reduce((total, item) => total + (Number(item.relative_effort) || 0), 0),
      strengthMinutes: sum(strength, 'moving_time') / 60,
      strengthSessions: strength.length
    };
  });
  const cardioActivities = activities.filter(item => item.sport_type !== 'WeightTraining');
  const scored = cardioActivities.filter(hasRelativeEffort).length;
  const strengthSessions = activities.filter(item => item.sport_type === 'WeightTraining').length;
  const showCardio = scored > 0;
  const showStrength = state.sport === 'Todos' && strengthSessions > 0;
  if (!showCardio && !showStrength) {
    panel.classList.add('is-hidden');
    return;
  }
  panel.classList.remove('is-hidden');
  const last = weeks[weeks.length - 1];
  const noteParts = [];
  if (showCardio) noteParts.push(`${fmt.format(last.cardioEffort)} ESFUERZO`);
  if (showStrength) noteParts.push(`${fmt.format(last.strengthMinutes)} MIN FUERZA`);
  $('#load-note').textContent = `ÚLTIMA SEMANA · ${noteParts.join(' · ')}`;
  const lanes = [];
  if (showCardio) lanes.push(renderLoadLane('CARDIO', 'ESFUERZO RELATIVO', weeks.map(item => item.cardioEffort), weeks, 'cardio-bar', 'PTS'));
  if (showStrength) lanes.push(renderLoadLane('FUERZA', 'MINUTOS ACTIVOS', weeks.map(item => item.strengthMinutes), weeks, 'strength-bar', 'MIN'));
  $('#training-load-chart').innerHTML = lanes.join('');
  const coverageParts = [];
  if (showCardio) coverageParts.push(`ESFUERZO DISPONIBLE EN ${scored} DE ${cardioActivities.length} SESIONES DE CARDIO`);
  if (showStrength) coverageParts.push(`FUERZA MEDIDA CON ${strengthSessions} SESIONES Y SU DURACIÓN`);
  $('#load-coverage').textContent = `COBERTURA · ${coverageParts.join(' · ')}`;
}

function hasRelativeEffort(item) {
  return item.relative_effort !== null && item.relative_effort !== undefined && Number.isFinite(Number(item.relative_effort));
}

function renderLoadLane(label, subtitle, values, weeks, barClass, unit) {
  const averages = movingAverage(values, 4);
  return `<div class="load-lane">
    <div class="load-lane-label"><strong>${label}</strong><span>${subtitle}<br>MEDIA MÓVIL 4 SEMANAS</span></div>
    ${renderBarLineSvg(values, averages, weeks, barClass, unit)}
  </div>`;
}

function renderBarLineSvg(values, averages, weeks, barClass, unit) {
  const width = 1200;
  const height = 210;
  const margin = { top: 22, right: 18, bottom: 42, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const max = Math.max(...values, ...averages, 1);
  const step = plotWidth / values.length;
  const barWidth = Math.min(58, step * .52);
  const y = value => margin.top + plotHeight - value / max * plotHeight;
  const points = averages.map((value, index) => `${margin.left + step * (index + .5)},${y(value)}`).join(' ');
  const grid = [1, .5, 0].map(fraction => {
    const gridY = margin.top + plotHeight * (1 - fraction);
    return `<line class="${fraction === 0 ? 'chart-baseline' : 'chart-grid'}" x1="${margin.left}" y1="${gridY}" x2="${width - margin.right}" y2="${gridY}"></line>
      <text x="${margin.left - 10}" y="${gridY + 4}" text-anchor="end">${fmt.format(max * fraction)}</text>`;
  }).join('');
  const bars = values.map((value, index) => {
    const x = margin.left + step * (index + .5) - barWidth / 2;
    const barY = y(value);
    const barHeight = margin.top + plotHeight - barY;
    return `<g><title>${weeks[index].label}: ${fmtOne.format(value)} ${unit}</title><rect class="${barClass}" x="${x}" y="${barY}" width="${barWidth}" height="${barHeight}"></rect></g>`;
  }).join('');
  const labels = weeks.map((week, index) =>
    `<text class="axis-label" x="${margin.left + step * (index + .5)}" y="${height - 12}" text-anchor="middle">${week.label}</text>`
  ).join('');
  const averagePoints = averages.map((value, index) =>
    `<circle class="average-point" cx="${margin.left + step * (index + .5)}" cy="${y(value)}" r="3.5"><title>Media 4 semanas: ${fmtOne.format(value)} ${unit}</title></circle>`
  ).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${unit === 'PTS' ? 'Esfuerzo relativo' : 'Minutos de fuerza'} por semana y media móvil de cuatro semanas">${grid}${bars}<polyline class="average-line" points="${points}"></polyline>${averagePoints}${labels}</svg>`;
}

function renderRunningProgress(activities) {
  const panel = $('.running-panel');
  if (state.sport !== 'Todos' && state.sport !== 'Run') {
    panel.classList.add('is-hidden');
    return;
  }
  const bandDefinitions = [
    { key: 'short', label: '5–8 KM', min: 5, max: 8, lineClass: 'running-series-orange', pointClass: 'running-point-orange' },
    { key: 'long', label: '8–12 KM', min: 8, max: 12, lineClass: 'running-series-green', pointClass: 'running-point-green' }
  ];
  const bands = bandDefinitions.map(band => ({
    ...band,
    points: activities.filter(item => item.sport_type === 'Run').map(item => {
      const distanceKm = Number(item.distance) / 1000;
      const pace = Number(item.moving_time) / 60 / distanceKm;
      return { date: activityDate(item), distanceKm, pace };
    }).filter(item => item.distanceKm >= band.min && item.distanceKm < band.max && item.pace >= 2.5 && item.pace <= 12).sort((a, b) => a.date - b.date)
  }));
  const allPoints = bands.flatMap(band => band.points);
  const chart = $('#running-progress-chart');
  if (allPoints.length < 8) {
    panel.classList.add('is-hidden');
    return;
  }
  panel.classList.remove('is-hidden');
  chart.innerHTML = renderRunningSvg(bands, allPoints);
  chart.setAttribute('aria-label', `Evolución del ritmo en ${allPoints.length} carreras comparables`);
  $('#running-progress-note').textContent = `${allPoints.length} CARRERAS · RITMO EN MOVIMIENTO · ESCALA ENFOCADA, MÁS RÁPIDO ARRIBA · LÍNEAS: MEDIANA MÓVIL DE 4 CARRERAS`;
}

function renderRunningSvg(bands, allPoints) {
  const width = 1200;
  const height = 360;
  const margin = { top: 24, right: 24, bottom: 48, left: 66 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const minDate = Math.min(...allPoints.map(item => item.date.getTime()));
  const maxDate = Math.max(...allPoints.map(item => item.date.getTime()));
  const dateSpan = Math.max(maxDate - minDate, DAY_MS);
  const rawMinPace = Math.min(...allPoints.map(item => item.pace));
  const rawMaxPace = Math.max(...allPoints.map(item => item.pace));
  let minPace = Math.floor((rawMinPace - .25) * 2) / 2;
  let maxPace = Math.ceil((rawMaxPace + .25) * 2) / 2;
  if (maxPace - minPace < 1) { minPace -= .5; maxPace += .5; }
  const x = date => margin.left + (date.getTime() - minDate) / dateSpan * plotWidth;
  const y = pace => margin.top + (pace - minPace) / (maxPace - minPace) * plotHeight;
  const yTicks = Array.from({ length: 5 }, (_, index) => minPace + (maxPace - minPace) * index / 4);
  const yGrid = yTicks.map(tick => `<line class="${tick === yTicks[yTicks.length - 1] ? 'chart-baseline' : 'chart-grid'}" x1="${margin.left}" y1="${y(tick)}" x2="${width - margin.right}" y2="${y(tick)}"></line><text x="${margin.left - 12}" y="${y(tick) + 4}" text-anchor="end">${formatPace(tick)}</text>`).join('');
  const xTicks = Array.from({ length: 5 }, (_, index) => new Date(minDate + dateSpan * index / 4));
  const shortWindow = dateSpan <= 120 * DAY_MS;
  const xLabels = xTicks.map(date => `<text class="axis-label" x="${x(date)}" y="${height - 14}" text-anchor="middle">${date.toLocaleDateString('es-ES', shortWindow ? { day: '2-digit', month: 'short' } : { month: 'short', year: '2-digit' }).replace('.', '')}</text>`).join('');
  const series = bands.map(band => {
    const rolling = rollingMedian(band.points, 4);
    const line = rolling.length > 1 ? `<polyline class="${band.lineClass}" points="${rolling.map(item => `${x(item.date)},${y(item.pace)}`).join(' ')}"></polyline>` : '';
    const points = band.points.map(item => `<circle class="${band.pointClass}" cx="${x(item.date)}" cy="${y(item.pace)}" r="5"><title>${item.date.toLocaleDateString('es-ES')} · ${fmtOne.format(item.distanceKm)} km · ${formatPace(item.pace)}/km</title></circle>`).join('');
    return `${line}${points}`;
  }).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Ritmo de carrera entre 5 y 12 kilómetros a lo largo del tiempo">${yGrid}${series}${xLabels}</svg>`;
}

function renderGearUsage(activities) {
  const panel = $('.gear-panel');
  const usage = activities.reduce((result, item) => {
    if (!item.gear_name || Number(item.distance) <= 0) return result;
    const key = `${item.gear_type || 'Material'}::${item.gear_name}`;
    if (!result[key]) {
      result[key] = {
        name: item.gear_name,
        type: item.gear_type || 'Material',
        distanceKm: 0,
        sessions: 0,
      };
    }
    result[key].distanceKm += Number(item.distance) / 1000;
    result[key].sessions += 1;
    return result;
  }, {});
  const rows = Object.values(usage).sort((a, b) => b.distanceKm - a.distanceKm);
  panel.classList.toggle('is-hidden', rows.length === 0);
  if (!rows.length) return;

  const max = Math.max(...rows.map(item => item.distanceKm), 1);
  const total = rows.reduce((sum, item) => sum + item.distanceKm, 0);
  $('#gear-note').textContent = `${rows.length} ${rows.length === 1 ? 'EQUIPO' : 'EQUIPOS'} · ${fmtOne.format(total)} KM EN EL PERIODO`;
  const chart = $('#gear-usage');
  chart.setAttribute('aria-label', `Kilómetros recorridos con ${rows.length} equipos en el periodo seleccionado`);
  chart.innerHTML = rows.map(item => `
    <div class="gear-row">
      <div class="gear-meta">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.type).toUpperCase()} · ${item.sessions} ${item.sessions === 1 ? 'SESIÓN' : 'SESIONES'}</span>
      </div>
      <div class="gear-track" aria-hidden="true">
        <div class="gear-fill" data-gear-type="${escapeHtml(item.type)}" style="--width:${item.distanceKm / max * 100}%"></div>
      </div>
      <span class="gear-value">${fmtOne.format(item.distanceKm)} KM</span>
    </div>`).join('');
}

function renderPersonalBests(activities) {
  const panel = $('.achievements-panel');
  const achievements = activities.flatMap(activity =>
    (activity.personal_bests || []).map(effort => ({
      ...effort,
      activityName: activity.name || 'Actividad',
      sport: sportLabels[activity.sport_type] || activity.sport_type,
      date: activityDate(activity),
    }))
  ).sort((a, b) => b.date - a.date || a.rank - b.rank || a.distance - b.distance);

  panel.classList.toggle('is-hidden', achievements.length === 0);
  if (!achievements.length) return;

  const records = achievements.filter(item => item.rank === 1).length;
  $('#achievements-note').textContent = `${achievements.length} LOGROS · ${records} ${records === 1 ? 'RÉCORD PERSONAL' : 'RÉCORDS PERSONALES'}`;
  const list = $('#personal-achievements');
  list.setAttribute('aria-label', `${achievements.length} logros personales sin segmentos ni distancias en millas`);
  list.innerHTML = `
    <div class="achievement-row achievement-head" aria-hidden="true">
      <span>DISTANCIA</span><span>MARCA</span><span>RANGO</span><span>FECHA</span><span>ACTIVIDAD</span>
    </div>
    ${achievements.map(item => `
      <div class="achievement-row">
        <strong class="achievement-distance">${escapeHtml(item.name)}</strong>
        <span class="achievement-time">${formatEffortTime(item.elapsed_time)}</span>
        <span class="achievement-rank" data-rank="${item.rank}">${personalRankLabel(item.rank)}</span>
        <time class="achievement-date" datetime="${toIsoDay(item.date)}">${item.date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '')}</time>
        <span class="achievement-activity">${escapeHtml(item.activityName)}<small>${escapeHtml(item.sport).toUpperCase()}</small></span>
      </div>`).join('')}`;
}

function personalRankLabel(rank) {
  return rank === 1 ? 'RÉCORD PERSONAL' : rank === 2 ? '2ª MEJOR MARCA' : '3ª MEJOR MARCA';
}

function renderCalendar(activities) {
  const panel = $('.consistency-panel');
  const reference = activityDate(state.activities[0]);
  const end = endOfWeek(reference);
  const start = new Date(end.getTime() - 12 * 7 * DAY_MS + DAY_MS);
  const minutesByDay = new Map();
  activities.forEach(item => {
    const key = dayKey(activityDate(item));
    minutesByDay.set(key, (minutesByDay.get(key) || 0) + (Number(item.moving_time) || 0) / 60);
  });
  const values = [];
  for (let date = new Date(start); date <= end; date = new Date(date.getTime() + DAY_MS)) {
    values.push({ date: new Date(date), minutes: minutesByDay.get(dayKey(date)) || 0 });
  }
  $('#training-calendar').innerHTML = values.map(item => {
    const level = item.minutes === 0 ? 0 : item.minutes <= 30 ? 1 : item.minutes <= 60 ? 2 : item.minutes <= 90 ? 3 : 4;
    const title = `${item.date.toLocaleDateString('es-ES')}: ${item.minutes ? fmt.format(item.minutes) + ' min activos' : 'descanso'}`;
    return `<div class="day-cell" data-level="${level}" title="${title}"></div>`;
  }).join('');
  const activeDays = values.filter(item => item.minutes > 0).length;
  panel.classList.toggle('is-hidden', activeDays === 0);
  $('.latest-panel').classList.toggle('is-wide', activeDays === 0);
  if (activeDays === 0) return;
  $('#active-days-note').textContent = `${activeDays} DÍAS ACTIVOS · ${values.length - activeDays} DE DESCANSO`;
  $('#calendar-legend').innerHTML = [
    ['0', 'DESCANSO'], ['1', '1–30 MIN'], ['2', '31–60 MIN'], ['3', '61–90 MIN'], ['4', '+90 MIN']
  ].map(([level, label]) => `<span><i class="day-cell" data-level="${level}"></i>${label}</span>`).join('');
}

function renderActivityTable(activities) {
  const recent = activities.slice(0, 6);
  const distanceBased = selectionUsesDistance();
  $('#latest-count').textContent = `${activities.length} REGISTROS`;
  $('#activity-table').innerHTML = recent.length ? recent.map(item => {
    const date = activityDate(item);
    const distance = Number(item.distance) / 1000;
    return `<div class="activity-row${distanceBased ? '' : ' is-compact'}">
      <span class="activity-date">${date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).replace('.', '')}</span>
      <span class="activity-title">${escapeHtml(item.name || 'Actividad')}<span>${(sportLabels[item.sport_type] || item.sport_type).toUpperCase()}</span></span>
      <span class="activity-value">${distanceBased && distance ? fmtOne.format(distance) + ' KM' : formatDuration(item.moving_time)}</span>
      ${distanceBased ? `<span class="activity-value">${item.total_elevation_gain ? '+' + fmt.format(item.total_elevation_gain) + ' M' : '—'}</span>` : ''}
    </div>`;
  }).join('') : '<p>Sin actividades para este filtro.</p>';
}

function calculateStreaks(activities) {
  const days = [...new Set(activities.map(item => item.date))].sort();
  if (!days.length) return { latest: 0, best: 0 };
  let best = days.length ? 1 : 0;
  let running = days.length ? 1 : 0;
  for (let index = 1; index < days.length; index += 1) {
    const previous = isoDate(days[index - 1]);
    const current = isoDate(days[index]);
    running = Math.round((current - previous) / DAY_MS) === 1 ? running + 1 : 1;
    best = Math.max(best, running);
  }
  const daySet = new Set(days);
  let cursor = isoDate(days[days.length - 1]);
  let latest = 0;
  while (daySet.has(toIsoDay(cursor))) {
    latest += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return { latest, best };
}

function movingAverage(values, windowSize) {
  return values.map((_, index) => {
    const slice = values.slice(Math.max(0, index - windowSize + 1), index + 1);
    return slice.reduce((total, value) => total + value, 0) / slice.length;
  });
}

function rollingMedian(points, windowSize) {
  return points.map((point, index) => {
    const values = points.slice(Math.max(0, index - windowSize + 1), index + 1).map(item => item.pace).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    const pace = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    return { date: point.date, pace };
  });
}

function sum(items, key) { return items.reduce((total, item) => total + (Number(item[key]) || 0), 0); }
function activityDate(item) { return isoDate(item.date); }
function isoDate(value) { return new Date(`${value}T12:00:00`); }
function toIsoDay(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function dayKey(date) { return toIsoDay(date); }
function startOfWeek(date) { const copy = new Date(date); const day = (copy.getDay() + 6) % 7; copy.setHours(0, 0, 0, 0); copy.setDate(copy.getDate() - day); return copy; }
function endOfWeek(date) { return new Date(startOfWeek(date).getTime() + 7 * DAY_MS - 1); }
function dateSpanDays(items) { if (items.length < 2) return 1; return Math.max(1, (activityDate(items[0]) - activityDate(items[items.length - 1])) / DAY_MS); }
function formatDuration(seconds = 0) { const hours = Math.floor(seconds / 3600); const minutes = Math.round((seconds % 3600) / 60); return hours ? `${hours}H ${minutes}M` : `${minutes} MIN`; }
function formatEffortTime(seconds = 0) { const whole = Math.max(0, Math.round(Number(seconds) || 0)); const hours = Math.floor(whole / 3600); const minutes = Math.floor((whole % 3600) / 60); const remaining = whole % 60; return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}` : `${minutes}:${String(remaining).padStart(2, '0')}`; }
function formatPace(minutes) { let whole = Math.floor(minutes); let seconds = Math.round((minutes - whole) * 60); if (seconds === 60) { whole += 1; seconds = 0; } return `${whole}:${String(seconds).padStart(2, '0')}`; }
function escapeHtml(value) { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; }

init();

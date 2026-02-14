import json

with open('data/activities.json', 'r') as f:
    activities = json.load(f)

runs = [a for a in activities if a.get('sport_type') == 'Run' or a.get('type') == 'Run']

distances = {
    '1k': [],
    '5k': [],
    '10k': [],
    'Half': [],
    'Marathon': []
}

for r in runs:
    dist = r.get('distance', 0)
    time = r.get('moving_time', 0)
    
    if 900 <= dist <= 1100: distances['1k'].append(time)
    elif 4800 <= dist <= 5200: distances['5k'].append(time)
    elif 9800 <= dist <= 10200: distances['10k'].append(time)
    elif 21000 <= dist <= 21200: distances['Half'].append(time)
    elif 42000 <= dist <= 42300: distances['Marathon'].append(time)

print("Run Counts by Distance:")
for k, v in distances.items():
    if v:
        best_time = min(v)
        m, s = divmod(best_time, 60)
        print(f"{k}: {len(v)} runs. Best: {int(m)}:{int(s):02d}")
    else:
        print(f"{k}: 0 runs")

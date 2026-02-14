import json

with open('data/activities.json', 'r') as f:
    activities = json.load(f)

print("--- All Runs ---")
for a in activities:
    if a.get('sport_type') == 'Run' or a.get('type') == 'Run':
        d = a.get('distance', 0)
        time = a.get('moving_time', 0)
        id = a.get('id')
        name = a.get('name')
        print(f"ID: {id} | Dist: {d:.2f}m ({d/1000:.2f}km) | Time: {time}s | Name: {name}")

import json

target_id = 16606825895

with open('data/activities.json', 'r') as f:
    activities = json.load(f)

found = False
for a in activities:
    if a.get('id') == target_id:
        print(json.dumps(a, indent=4))
        found = True
        break

if not found:
    print(f"Activity {target_id} not found.")

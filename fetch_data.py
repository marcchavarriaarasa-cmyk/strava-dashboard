
import requests
import json
import os
import sys

# Configuration - Load from Environment Variables for Security
CLIENT_ID = os.getenv('STRAVA_CLIENT_ID')
CLIENT_SECRET = os.getenv('STRAVA_CLIENT_SECRET')
REFRESH_TOKEN = os.getenv('STRAVA_REFRESH_TOKEN')

def get_access_token():
    if not all([CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN]):
        print("Error: Missing environment variables. Please set STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, and STRAVA_REFRESH_TOKEN.")
        sys.exit(1)

    print("Refreshing access token...")
    auth_url = "https://www.strava.com/oauth/token"
    payload = {
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'refresh_token': REFRESH_TOKEN,
        'grant_type': 'refresh_token'
    }
    
    try:
        response = requests.post(auth_url, data=payload)
        response.raise_for_status()
        tokens = response.json()
        print("Access token refreshed successfully.")
        return tokens['access_token']
    except requests.exceptions.RequestException as e:
        print(f"Error refreshing token: {e}")
        if response.text:
            print(f"Response details: {response.text}")
        sys.exit(1)

def generate_context_file(activities):
    """Generates a text file summarizing recent activities."""
    print("Generating entrenamientos_contexto.txt...")
    filename = 'entrenamientos_contexto.txt'
    
    with open(filename, 'w') as f:
        f.write("RESUMEN DE ENTRENAMIENTOS RECIENTES (Contexto para IA)\n")
        f.write("====================================================\n\n")
        
        if not activities:
            f.write("No hay actividades recientes.\n")
            return

        # Take the last 50 activities for context
        recent_activities = activities[:50]
        
        for activity in recent_activities:
            # Extract key metrics
            name = activity.get('name', 'Sin nombre')
            type_ = activity.get('type', 'Desconocido')
            date = activity.get('start_date_local', '').split('T')[0]
            distance_km = round(activity.get('distance', 0) / 1000, 2)
            moving_time_min = round(activity.get('moving_time', 0) / 60, 2)
            avg_speed_kmh = round(activity.get('average_speed', 0) * 3.6, 2)
            elevation_gain = round(activity.get('total_elevation_gain', 0), 1)
            
            f.write(f"Fecha: {date}\n")
            f.write(f"Actividad: {name} ({type_})\n")
            f.write(f"Distancia: {distance_km} km\n")
            f.write(f"Tiempo en movimiento: {moving_time_min} min\n")
            f.write(f"Velocidad media: {avg_speed_kmh} km/h\n")
            f.write(f"Desnivel positivo: {elevation_gain} m\n")
            f.write("-" * 30 + "\n")
            
    print(f"Successfully saved {len(recent_activities)} activities to {filename}")

def fetch_activities(access_token):
    url = 'https://www.strava.com/api/v3/athlete/activities'
    headers = {'Authorization': f'Bearer {access_token}'}
    
    all_activities = []
    page = 1
    per_page = 50 # Fetch fewer per page to be gentle, but we iterate until done or limit
    
    while True:
        print(f"Fetching page {page}...")
        params = {'per_page': per_page, 'page': page}
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            
            data = response.json()
            if not data:
                break
            
            all_activities.extend(data)
            print(f"Retrieved {len(data)} activities. Total: {len(all_activities)}")
            
            # Safety break to avoid fetching infinite history if not needed, 
            # or remove if user wants EVERYTHING. User asked for "updated with my last trainings", 
            # so fetching everything is safer to ensure we have the latest, 
            # but maybe limit to avoid API limits if they have thousands.
            # Let's limit to Top 200 for now for context file, but save all to JSON.
            # Actually, standard behavior is fetch all.
            
            page += 1
        except requests.exceptions.RequestException as e:
            print(f"Error fetching activities: {e}")
            break
            
    print(f"Finished. Total activities found: {len(all_activities)}")
    
    # Save JSON
    os.makedirs('data', exist_ok=True)
    with open('data/activities.json', 'w') as f:
        json.dump(all_activities, f, indent=2)
    print("Successfully saved to data/activities.json")
    
    # Generate Context File
    generate_context_file(all_activities)


if __name__ == "__main__":
    token = get_access_token()
    if token:
        fetch_activities(token)

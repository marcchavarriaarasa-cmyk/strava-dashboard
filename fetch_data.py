
import requests
import json
import os
import sys
import tempfile
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Configuration - Load from Environment Variables for Security
CLIENT_ID = os.getenv('STRAVA_CLIENT_ID')
CLIENT_SECRET = os.getenv('STRAVA_CLIENT_SECRET')
REFRESH_TOKEN = os.getenv('STRAVA_REFRESH_TOKEN')

REQUEST_TIMEOUT = (10, 30)
PUBLIC_DATA_PATH = 'data/activities.public.json'
KNOWN_GEAR_NAMES = {
    'g21829526': 'Nike Zoom Fly 5',
    'g22746812': 'HOKA Bondi 9',
    'b16055834': 'Kross',
}


class StravaError(RuntimeError):
    """Raised when the sync cannot safely complete."""


def build_session():
    """Create an HTTP session resilient to temporary Strava/CDN failures."""
    retry = Retry(
        total=4,
        connect=4,
        read=4,
        status=4,
        backoff_factor=1,
        status_forcelist=(403, 429, 500, 502, 503, 504),
        allowed_methods=frozenset({'GET', 'POST'}),
        respect_retry_after_header=True,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session = requests.Session()
    session.mount('https://', adapter)
    return session


SESSION = build_session()


def require_credentials():
    missing_vars = [
        name for name, value in (
            ('STRAVA_CLIENT_ID', CLIENT_ID),
            ('STRAVA_CLIENT_SECRET', CLIENT_SECRET),
            ('STRAVA_REFRESH_TOKEN', REFRESH_TOKEN),
        ) if not value
    ]
    if missing_vars:
        raise StravaError(
            f"Missing environment variables: {', '.join(missing_vars)}. "
            "Configure them as GitHub Repository Secrets or in your local environment."
        )


def atomic_write_json(path, data):
    """Replace a JSON file only after the complete payload has been written."""
    directory = os.path.dirname(path) or '.'
    os.makedirs(directory, exist_ok=True)
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode='w', encoding='utf-8', dir=directory, delete=False
        ) as temp_file:
            temp_path = temp_file.name
            json.dump(data, temp_file, indent=2, ensure_ascii=False)
            temp_file.write('\n')
        os.replace(temp_path, path)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


def gear_type_from_id(gear_id):
    if gear_id.startswith('b'):
        return 'Bicicleta'
    if gear_id.startswith('g'):
        return 'Zapatillas'
    return 'Material'


def gear_display_name(gear_id, gear):
    name = (gear or {}).get('name')
    if name:
        return name
    brand_and_model = ' '.join(
        part.strip()
        for part in (
            (gear or {}).get('brand_name') or '',
            (gear or {}).get('model_name') or '',
        )
        if part.strip()
    )
    return brand_and_model or KNOWN_GEAR_NAMES.get(gear_id)


def fetch_gear_catalog(access_token, activities):
    """Resolve unique gear ids without exposing those ids to GitHub Pages."""
    headers = {'Authorization': f'Bearer {access_token}'}
    gear_ids = sorted({activity.get('gear_id') for activity in activities if activity.get('gear_id')})
    catalog = {}
    for gear_id in gear_ids:
        gear = {}
        try:
            response = SESSION.get(
                f'https://www.strava.com/api/v3/gear/{gear_id}',
                headers=headers,
                timeout=REQUEST_TIMEOUT,
            )
            response.raise_for_status()
            gear = response.json()
        except (requests.exceptions.RequestException, ValueError):
            print(
                'Warning: unable to resolve one gear item; using a known fallback when available.',
                file=sys.stderr,
            )

        name = gear_display_name(gear_id, gear)
        if name:
            catalog[gear_id] = {
                'name': name,
                'type': gear_type_from_id(gear_id),
            }
    print(f'Resolved {len(catalog)} of {len(gear_ids)} gear items.')
    return catalog


def build_public_activities(activities, gear_catalog=None):
    """Return the minimal, privacy-conscious dataset used by GitHub Pages."""
    gear_catalog = gear_catalog or {}
    public_activities = []
    for activity in activities:
        local_date = activity.get('start_date_local') or activity.get('start_date') or ''
        public_activity = {
            'name': activity.get('name') or 'Actividad',
            'sport_type': activity.get('sport_type') or activity.get('type') or 'Workout',
            'date': local_date.split('T', 1)[0],
            'distance': activity.get('distance') or 0,
            'moving_time': activity.get('moving_time') or 0,
            'elapsed_time': activity.get('elapsed_time') or 0,
            'total_elevation_gain': activity.get('total_elevation_gain') or 0,
            'relative_effort': activity.get('suffer_score'),
        }
        gear = gear_catalog.get(activity.get('gear_id'))
        if gear:
            public_activity['gear_name'] = gear['name']
            public_activity['gear_type'] = gear['type']
        public_activities.append(public_activity)
    return public_activities


def get_access_token():
    require_credentials()

    print("Refreshing access token...")
    auth_url = "https://www.strava.com/oauth/token"
    payload = {
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'refresh_token': REFRESH_TOKEN,
        'grant_type': 'refresh_token'
    }
    
    try:
        response = SESSION.post(auth_url, data=payload, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        tokens = response.json()
        if not tokens.get('access_token'):
            raise StravaError('Strava token response did not include an access token.')
        print("Access token refreshed successfully.")
        return tokens['access_token']
    except (requests.exceptions.RequestException, ValueError) as error:
        detail = getattr(locals().get('response'), 'text', '')
        if detail:
            detail = f" Response: {detail[:500]}"
        raise StravaError(f"Unable to refresh the Strava token: {error}.{detail}") from error


def generate_context_file(activities):
    """Generates a text file summarizing recent activities."""
    print("Generating entrenamientos_contexto.txt...")
    filename = 'entrenamientos_contexto.txt'
    
    temp_path = None
    try:
        temp_file = tempfile.NamedTemporaryFile(
            mode='w', encoding='utf-8', dir='.', delete=False
        )
        temp_path = temp_file.name
        f = temp_file
        f.write("RESUMEN DE ENTRENAMIENTOS RECIENTES (Contexto para IA)\n")
        f.write("====================================================\n\n")
        
        if not activities:
            f.write("No hay actividades recientes.\n")
            recent_activities = []
        else:
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
            heart_rate = activity.get('average_heartrate', 'Null')
            if heart_rate != 'Null':
                heart_rate = round(heart_rate, 1)
            
            f.write(f"Fecha: {date}\n")
            f.write(f"Actividad: {name} ({type_})\n")
            f.write(f"Distancia: {distance_km} km\n")
            f.write(f"Tiempo en movimiento: {moving_time_min} min\n")
            f.write(f"Velocidad media: {avg_speed_kmh} km/h\n")
            f.write(f"Desnivel positivo: {elevation_gain} m\n")
            f.write(f"Frecuencia cardíaca media: {heart_rate} bpm\n")
            f.write("-" * 30 + "\n")
        f.close()
        os.replace(temp_path, filename)
        temp_path = None
    finally:
        if 'f' in locals() and not f.closed:
            f.close()
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

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
            response = SESSION.get(
                url, headers=headers, params=params, timeout=REQUEST_TIMEOUT
            )
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
        except (requests.exceptions.RequestException, ValueError) as error:
            raise StravaError(
                f"Unable to fetch activities on page {page}: {error}"
            ) from error
            
    print(f"Finished. Total activities found: {len(all_activities)}")
    
    # Publish only the fields required by the dashboard. Exact routes,
    # coordinates, athlete identifiers, devices and heart-rate samples stay out
    # of the GitHub Pages payload.
    gear_catalog = fetch_gear_catalog(access_token, all_activities)
    public_activities = build_public_activities(all_activities, gear_catalog)
    atomic_write_json(PUBLIC_DATA_PATH, public_activities)
    print(f"Successfully saved privacy-safe data to {PUBLIC_DATA_PATH}")
    
    # Generate Context File
    generate_context_file(all_activities)


def main():
    try:
        token = get_access_token()
        fetch_activities(token)
        return 0
    except StravaError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())

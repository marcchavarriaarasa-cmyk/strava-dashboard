
import requests
import json
import os
import sys
import tempfile
import time
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Configuration - Load from Environment Variables for Security
CLIENT_ID = os.getenv('STRAVA_CLIENT_ID')
CLIENT_SECRET = os.getenv('STRAVA_CLIENT_SECRET')
REFRESH_TOKEN = os.getenv('STRAVA_REFRESH_TOKEN')

REQUEST_TIMEOUT = (10, 30)
PUBLIC_DATA_PATH = 'data/activities.public.json'
MILE_EFFORT_DISTANCES = (804.67, 1609.34, 3218.69, 16093.4)
READ_RATE_LIMIT_RESERVE = 5
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


def load_public_activities(path=PUBLIC_DATA_PATH):
    """Load the last safe snapshot so detailed achievements can be cached."""
    try:
        with open(path, encoding='utf-8') as public_file:
            data = json.load(public_file)
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def activity_cache_key(activity):
    """Match an activity across syncs without persisting its Strava identifier."""
    local_date = activity.get('start_date_local') or activity.get('start_date') or activity.get('date') or ''
    return (
        local_date.split('T', 1)[0],
        activity.get('sport_type') or activity.get('type') or 'Workout',
        activity.get('name') or 'Actividad',
        float(activity.get('distance') or 0),
        int(activity.get('elapsed_time') or 0),
    )


def is_mile_effort(name, distance):
    normalized_name = (name or '').casefold()
    if 'mile' in normalized_name or 'milla' in normalized_name:
        return True
    return any(abs(float(distance or 0) - mile_distance) <= 5 for mile_distance in MILE_EFFORT_DISTANCES)


def extract_personal_bests(detailed_activity):
    """Keep only non-mile top-three best efforts; segment efforts are never read."""
    personal_bests = []
    for effort in detailed_activity.get('best_efforts') or []:
        rank = effort.get('pr_rank')
        distance = effort.get('distance') or 0
        elapsed_time = effort.get('elapsed_time') or effort.get('moving_time') or 0
        name = (effort.get('name') or '').strip()
        if rank not in (1, 2, 3) or is_mile_effort(name, distance) or elapsed_time <= 0:
            continue
        personal_bests.append({
            'name': name or f'{round(float(distance))} m',
            'distance': round(float(distance), 1),
            'elapsed_time': int(elapsed_time),
            'rank': int(rank),
        })
    return sorted(personal_bests, key=lambda effort: (effort['rank'], effort['distance']))


def rank_current_personal_bests(personal_bests):
    """Rebuild the current top three per distance from historical Strava awards."""
    ranked = {activity_id: [] for activity_id in personal_bests}
    by_distance = {}
    for activity_id, efforts in personal_bests.items():
        for effort in efforts:
            distance_key = round(float(effort.get('distance') or 0), 1)
            by_distance.setdefault(distance_key, []).append((activity_id, effort))

    for candidates in by_distance.values():
        candidates.sort(key=lambda item: (
            int(item[1].get('elapsed_time') or 0),
            str(item[0]),
        ))
        for rank, (activity_id, effort) in enumerate(candidates[:3], start=1):
            ranked[activity_id].append({**effort, 'rank': rank})

    for efforts in ranked.values():
        efforts.sort(key=lambda effort: (effort['distance'], effort['rank']))
    return ranked


def wait_for_read_limit_reset(response):
    """Pause before exhausting Strava's short read window during a backfill."""
    limits = response.headers.get('X-ReadRateLimit-Limit', '').split(',')
    usage = response.headers.get('X-ReadRateLimit-Usage', '').split(',')
    try:
        short_limit = int(limits[0])
        short_usage = int(usage[0])
    except (IndexError, TypeError, ValueError):
        return
    if short_usage < short_limit - READ_RATE_LIMIT_RESERVE:
        return
    wait_seconds = 15 * 60 - int(time.time()) % (15 * 60) + 5
    print(f'Read limit nearly reached; waiting {wait_seconds} seconds for the next Strava window.')
    time.sleep(wait_seconds)


def fetch_personal_bests(access_token, activities, previous_public=None):
    """Resolve activity best efforts while reusing the privacy-safe public cache."""
    previous_public = previous_public or []
    cached = {
        activity_cache_key(activity): activity.get('personal_bests') or []
        for activity in previous_public
        if 'personal_bests' in activity
    }
    candidates = [
        activity for activity in activities
        if activity.get('id') and int(activity.get('achievement_count') or 0) > 0
    ]
    headers = {'Authorization': f'Bearer {access_token}'}
    resolved = {}
    pending = []
    for activity in candidates:
        cache_key = activity_cache_key(activity)
        if cache_key in cached:
            resolved[activity['id']] = cached[cache_key]
        else:
            pending.append(activity)
    for index, activity in enumerate(pending):
        try:
            response = SESSION.get(
                f"https://www.strava.com/api/v3/activities/{activity['id']}",
                headers=headers,
                params={'include_all_efforts': 'false'},
                timeout=REQUEST_TIMEOUT,
            )
            response.raise_for_status()
            detailed_activity = response.json()
        except (requests.exceptions.RequestException, ValueError) as error:
            raise StravaError('Unable to fetch detailed activity achievements.') from error
        resolved[activity['id']] = extract_personal_bests(detailed_activity)
        if index < len(pending) - 1:
            wait_for_read_limit_reset(response)
    historical_total = sum(len(efforts) for efforts in resolved.values())
    ranked = rank_current_personal_bests(resolved)
    current_total = sum(len(efforts) for efforts in ranked.values())
    print(
        f'Resolved {historical_total} historical non-segment, non-mile achievements; '
        f'published {current_total} current top-three marks across {len(candidates)} '
        f'candidate activities ({len(pending)} API requests).'
    )
    return ranked


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


def build_public_activities(activities, gear_catalog=None, personal_bests=None):
    """Return the minimal, privacy-conscious dataset used by GitHub Pages."""
    gear_catalog = gear_catalog or {}
    personal_bests = personal_bests or {}
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
        if activity.get('id') in personal_bests:
            public_activity['personal_bests'] = personal_bests[activity['id']]
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
    previous_public = load_public_activities()
    gear_catalog = fetch_gear_catalog(access_token, all_activities)
    personal_bests = fetch_personal_bests(access_token, all_activities, previous_public)
    public_activities = build_public_activities(all_activities, gear_catalog, personal_bests)
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

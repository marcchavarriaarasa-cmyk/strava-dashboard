
import requests
import json
import os

# Configuration
CLIENT_ID = '200918'
CLIENT_SECRET = '19d66a6a2f53fcb6b7ad58937b2edeb9394cb377'
CODE = '1810ee2180a0157e1b3632276ff92477d41c7026'

def get_access_token():
    print("Exchanging code for access token...")
    auth_url = "https://www.strava.com/oauth/token"
    payload = {
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'code': CODE,
        'grant_type': 'authorization_code'
    }
    response = requests.post(auth_url, data=payload)
    if response.status_code == 200:
        return response.json()['access_token']
    else:
        print(f"Error getting token: {response.text}")
        return None

def fetch_activities(access_token):
    url = 'https://www.strava.com/api/v3/athlete/activities?per_page=30'
    headers = {'Authorization': f'Bearer {access_token}'}
    print(f"Fetching activities from {url}...")
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"Found {len(data)} activities.")
        
        os.makedirs('data', exist_ok=True)
        with open('data/activities.json', 'w') as f:
            json.dump(data, f, indent=2)
        print("Successfully saved to data/activities.json")
    else:
        print("Error fetching activities:", response.text)

if __name__ == "__main__":
    token = get_access_token()
    if token:
        fetch_activities(token)

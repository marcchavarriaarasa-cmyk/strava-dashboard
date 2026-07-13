import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

import requests

import fetch_data


class FailingSession:
    def get(self, *args, **kwargs):
        response = requests.Response()
        response.status_code = 503
        response.url = args[0]
        response._content = b'temporary failure'
        response.raise_for_status()


class FetchDataTests(unittest.TestCase):
    def test_missing_credentials_are_reported_together(self):
        with (
            patch.object(fetch_data, 'CLIENT_ID', None),
            patch.object(fetch_data, 'CLIENT_SECRET', None),
            patch.object(fetch_data, 'REFRESH_TOKEN', None),
        ):
            with self.assertRaisesRegex(
                fetch_data.StravaError,
                'STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN',
            ):
                fetch_data.require_credentials()

    def test_fetch_failure_does_not_replace_existing_files(self):
        with tempfile.TemporaryDirectory() as directory:
            old_cwd = os.getcwd()
            os.chdir(directory)
            try:
                Path('data').mkdir()
                activities_file = Path('data/activities.public.json')
                context_file = Path('entrenamientos_contexto.txt')
                activities_file.write_text('[{"existing": true}]\n', encoding='utf-8')
                context_file.write_text('existing context\n', encoding='utf-8')

                with patch.object(fetch_data, 'SESSION', FailingSession()):
                    with self.assertRaises(fetch_data.StravaError):
                        fetch_data.fetch_activities('token')

                self.assertEqual(
                    activities_file.read_text(encoding='utf-8'),
                    '[{"existing": true}]\n',
                )
                self.assertEqual(
                    context_file.read_text(encoding='utf-8'),
                    'existing context\n',
                )
            finally:
                os.chdir(old_cwd)

    def test_atomic_json_write_replaces_complete_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'activities.json'
            fetch_data.atomic_write_json(path, [{'name': 'Carrera'}])
            self.assertEqual(
                path.read_text(encoding='utf-8'),
                '[\n  {\n    "name": "Carrera"\n  }\n]\n',
            )

    def test_public_activities_exclude_sensitive_fields(self):
        activity = {
            'id': 123,
            'athlete': {'id': 456},
            'name': 'Carrera matinal',
            'sport_type': 'Run',
            'start_date': '2026-07-12T06:00:00Z',
            'start_date_local': '2026-07-12T08:00:00Z',
            'distance': 10000,
            'moving_time': 3000,
            'elapsed_time': 3060,
            'total_elevation_gain': 80,
            'suffer_score': 42,
            'average_heartrate': 155,
            'device_name': 'Private device',
            'gear_id': 'g-private',
            'map': {'summary_polyline': 'private-route'},
            'start_latlng': [40.0, 0.5],
        }

        result = fetch_data.build_public_activities([activity])

        self.assertEqual(result, [{
            'name': 'Carrera matinal',
            'sport_type': 'Run',
            'date': '2026-07-12',
            'distance': 10000,
            'moving_time': 3000,
            'elapsed_time': 3060,
            'total_elevation_gain': 80,
            'relative_effort': 42,
        }])
        serialized = str(result)
        for sensitive_value in ('private-route', 'Private device', 'average_heartrate', 'athlete', 'g-private'):
            self.assertNotIn(sensitive_value, serialized)

    def test_public_activities_include_safe_gear_labels(self):
        activity = {
            'name': 'Carrera',
            'sport_type': 'Run',
            'start_date_local': '2026-07-12T08:00:00Z',
            'distance': 10000,
            'moving_time': 3000,
            'elapsed_time': 3060,
            'total_elevation_gain': 80,
            'gear_id': 'g123',
        }

        result = fetch_data.build_public_activities([activity], {
            'g123': {'name': 'HOKA Bondi 9', 'type': 'Zapatillas'},
        })

        self.assertEqual(result[0]['gear_name'], 'HOKA Bondi 9')
        self.assertEqual(result[0]['gear_type'], 'Zapatillas')
        self.assertNotIn('g123', str(result))

    def test_personal_bests_exclude_segments_miles_and_non_ranked_efforts(self):
        detailed_activity = {
            'best_efforts': [
                {'name': '1k', 'distance': 1000, 'elapsed_time': 210, 'pr_rank': 1},
                {'name': '1 mile', 'distance': 1609.34, 'elapsed_time': 360, 'pr_rank': 1},
                {'name': '5k', 'distance': 5000, 'elapsed_time': 1200, 'pr_rank': None},
                {'name': '10k', 'distance': 10000, 'elapsed_time': 2600, 'pr_rank': 3},
            ],
            'segment_efforts': [
                {'name': 'Subida privada', 'distance': 900, 'elapsed_time': 180, 'pr_rank': 1},
            ],
        }

        self.assertEqual(fetch_data.extract_personal_bests(detailed_activity), [
            {'name': '1k', 'distance': 1000.0, 'elapsed_time': 210, 'rank': 1},
            {'name': '10k', 'distance': 10000.0, 'elapsed_time': 2600, 'rank': 3},
        ])

    def test_public_activities_include_only_safe_personal_best_fields(self):
        activity = {
            'id': 987,
            'name': 'Carrera',
            'sport_type': 'Run',
            'start_date_local': '2026-07-12T08:00:00Z',
            'distance': 10000,
            'moving_time': 3000,
            'elapsed_time': 3060,
            'total_elevation_gain': 80,
        }
        personal_bests = {
            987: [{'name': '5k', 'distance': 5000.0, 'elapsed_time': 1240, 'rank': 1}],
        }

        result = fetch_data.build_public_activities([activity], personal_bests=personal_bests)

        self.assertEqual(result[0]['personal_bests'], personal_bests[987])
        self.assertNotIn('987', str(result))

    def test_personal_bests_reuse_safe_cache(self):
        activity = {
            'id': 123,
            'name': 'Carrera',
            'sport_type': 'Run',
            'start_date_local': '2026-07-12T08:00:00Z',
            'distance': 10000,
            'elapsed_time': 3060,
            'achievement_count': 2,
        }
        cached_activity = {
            'name': 'Carrera',
            'sport_type': 'Run',
            'date': '2026-07-12',
            'distance': 10000,
            'elapsed_time': 3060,
            'personal_bests': [],
        }

        with patch.object(fetch_data.SESSION, 'get') as get:
            result = fetch_data.fetch_personal_bests('token', [activity], [cached_activity])

        self.assertEqual(result, {123: []})
        get.assert_not_called()

    def test_personal_bests_are_reranked_by_current_time_per_distance(self):
        historical = {
            1: [{'name': '15K', 'distance': 15000.0, 'elapsed_time': 4164, 'rank': 1}],
            2: [{'name': '15K', 'distance': 15000.0, 'elapsed_time': 4098, 'rank': 2}],
            3: [{'name': '15K', 'distance': 15000.0, 'elapsed_time': 5165, 'rank': 3}],
            4: [{'name': '15K', 'distance': 15000.0, 'elapsed_time': 4866, 'rank': 1}],
        }

        ranked = fetch_data.rank_current_personal_bests(historical)

        self.assertEqual(ranked[2][0]['rank'], 1)
        self.assertEqual(ranked[1][0]['rank'], 2)
        self.assertEqual(ranked[4][0]['rank'], 3)
        self.assertEqual(ranked[3], [])
        ordered = sorted(
            (effort['rank'], effort['elapsed_time'])
            for efforts in ranked.values() for effort in efforts
        )
        self.assertEqual(ordered, [(1, 4098), (2, 4164), (3, 4866)])

    def test_gear_catalog_resolves_each_unique_item_once(self):
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {
            'brand_name': 'HOKA',
            'model_name': 'Bondi 9',
        }
        activities = [
            {'gear_id': 'g123'},
            {'gear_id': 'g123'},
            {'gear_id': None},
        ]

        with patch.object(fetch_data.SESSION, 'get', return_value=response) as get:
            catalog = fetch_data.fetch_gear_catalog('token', activities)

        self.assertEqual(catalog, {
            'g123': {'name': 'HOKA Bondi 9', 'type': 'Zapatillas'},
        })
        self.assertEqual(get.call_count, 1)


if __name__ == '__main__':
    unittest.main()

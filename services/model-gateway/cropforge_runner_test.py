from __future__ import annotations

import unittest
from datetime import date, timedelta

from cropforge_runner import CropForgeShadowRequest, CropForgeWeatherDay, run_cropforge_shadow


def weather(start: date, count: int):
    return [
        CropForgeWeatherDay(
            date=start + timedelta(days=index),
            tmin_c=10.0,
            tmax_c=24.0,
            radiation_mj_m2=18.0,
            rain_mm=0.0,
            et0_mm=3.5,
            wind_m_s=2.0,
            humidity_pct=55.0,
        )
        for index in range(count)
    ]


class CropForgeRunnerTest(unittest.TestCase):
    def test_rejects_partial_season_weather(self):
        planting = date(2026, 3, 1)
        with self.assertRaises(ValueError):
            CropForgeShadowRequest(
                field_id='field-1',
                latitude=39.0,
                longitude=35.0,
                crop_key='wheat',
                planting_date=planting,
                area_ha=1.0,
                soil_profile_verified=True,
                weather=weather(planting + timedelta(days=1), 3),
            )

    def test_real_cropforge_wheat_shadow_has_no_authority(self):
        planting = date(2026, 3, 1)
        payload = CropForgeShadowRequest(
            field_id='field-1',
            latitude=39.0,
            longitude=35.0,
            crop_key='wheat',
            planting_date=planting,
            area_ha=1.0,
            soil_profile_verified=True,
            weather=weather(planting, 10),
        )
        result = run_cropforge_shadow(payload)
        self.assertTrue(result['ok'])
        self.assertEqual(result['engine'], 'cropforge')
        self.assertEqual(result['mode'], 'shadow')
        self.assertFalse(result['production_authority'])
        self.assertFalse(result['yield_authority'])
        self.assertFalse(result['soil_physics_enabled'])
        self.assertEqual(result['simulation_days'], 10)
        self.assertIn('phenological_stage', result['result'])
        self.assertGreaterEqual(result['result']['thermal_time_degree_days'], 0)


if __name__ == '__main__':
    unittest.main()

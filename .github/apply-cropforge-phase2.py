from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, found {count}')
    p.write_text(text.replace(old, new, 1))

p = Path('services/model-gateway/requirements.txt')
text = p.read_text()
if 'cropforge==1.0.1' not in text:
    text = text.rstrip() + '\ncropforge==1.0.1  # real CropForge core shadow runtime; no production authority\n'
p.write_text(text)

p = Path('services/model-gateway/engine_registry.py')
text = p.read_text()
start = text.index('    "cropforge": {')
end = text.index('    "dssat": {', start)
block = '''    "cropforge": {
        "role": "crop_digital_twin_weather_growth_shadow",
        "rollout": "shadow",
        "upstream": "saswatsundar123/CropForge",
        "upstream_release": "v1.0.1",
        "package": "cropforge==1.0.1",
        "license": "MIT",
        "adapter_version": 2,
        "production_authority": False,
        "yield_authority": False,
        "irrigation_prescription_authority": False,
        "nutrient_prescription_authority": False,
        "execution_enabled": True,
        "input_authority": "server-derived-only",
        "supported_crops": ["wheat", "maize"],
        "runtime_scope": "observed weather + first-party crop plugin only; soil-water, nutrients, terrain, erosion and management physics remain gated",
        "candidate_features": [
            "crop_growth_scenario",
            "fao56_et0_cross_check",
            "terrain_erosion_scenario",
            "multi_season_rotation",
        ],
        "note": "Phase 2 executes the real CropForge v1.0.1 crop/weather core in shadow mode only. Output has no production, yield or prescription authority.",
    },
'''
p.write_text(text[:start] + block + text[end:])

replace_once(
    'services/model-gateway/app.py',
    'from aquacrop_runner import AquaCropPilotRequest, run_aquacrop_pilot\n',
    'from aquacrop_runner import AquaCropPilotRequest, run_aquacrop_pilot\nfrom cropforge_runner import CropForgeShadowRequest, run_cropforge_shadow\n',
    'app cropforge import',
)
replace_once(
    'services/model-gateway/app.py',
    '    version="0.7.0",',
    '    version="0.8.0",',
    'app version',
)
replace_once(
    'services/model-gateway/app.py',
    '        "aquacrop": _module_status("aquacrop"),\n        "dssat": dssat_runtime_status(),',
    '        "aquacrop": _module_status("aquacrop"),\n        "cropforge": _module_status("cropforge"),\n        "dssat": dssat_runtime_status(),',
    'health cropforge',
)

p = Path('services/model-gateway/app.py')
text = p.read_text()
start = text.index('@app.post("/v1/scenario/cropforge/readiness")')
end = text.index('@app.get("/v1/scenario/dssat/health")', start)
block = '''@app.post("/v1/scenario/cropforge/readiness")
def cropforge_readiness(
    payload: EngineReadinessRequest,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    """Validate CropForge core shadow inputs without granting decision authority."""
    _authorize(x_model_gateway_key)
    result = _readiness("cropforge", payload, REQUIRED_CROPFORGE_INPUTS)
    execution_enabled = ENGINE_REGISTRY["cropforge"]["rollout"] in {
        "shadow",
        "pilot",
        "production",
    }
    return {
        **result,
        "input_ready": result["ready"],
        "execution_enabled": execution_enabled,
        "ready": bool(result["ready"] and execution_enabled),
        "production_authority": False,
        "yield_authority": False,
        "irrigation_prescription_authority": False,
        "nutrient_prescription_authority": False,
        "terrain_physics_ready": False,
        "note": (
            "Core CropForge inputs are complete and the crop/weather shadow runner is enabled. Terrain and decision physics remain gated."
            if result["ready"] and execution_enabled
            else result["note"]
        ),
    }


@app.post("/v1/scenario/cropforge/shadow")
def cropforge_shadow(
    payload: CropForgeShadowRequest,
    x_model_gateway_key: str | None = Header(default=None),
) -> dict[str, Any]:
    _authorize(x_model_gateway_key)
    if ENGINE_REGISTRY["cropforge"]["rollout"] not in {"shadow", "pilot", "production"}:
        raise HTTPException(status_code=409, detail="CropForge shadow rollout is disabled")
    try:
        return run_cropforge_shadow(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"CropForge shadow failed: {exc}") from exc


'''
p.write_text(text[:start] + block + text[end:])

replace_once(
    'supabase/functions/model-engine-readiness/index.ts',
    "    rollout: 'shadow-readiness',\n    required: ['field_location', 'daily_weather', 'crop_parameters', 'soil_profile', 'planting_date'],",
    "    rollout: 'shadow',\n    required: ['field_location', 'daily_weather', 'crop_parameters', 'soil_profile', 'planting_date'],",
    'readiness rollout',
)
replace_once(
    'supabase/functions/model-engine-readiness/index.ts',
    "      cropforge_phase: 'shadow-readiness-v1',\n      execution_enabled: false,",
    "      cropforge_phase: 'shadow-runtime-v1',\n      execution_enabled: true,",
    'readiness execution context',
)

p = Path('src/services/modelReadiness.service.ts')
text = p.read_text()
if 'ensureCropForgeShadowFreshBestEffort' not in text:
    text += '''\n\nconst cropForgeShadowInFlight = new Set<string>();\n\nexport function ensureCropForgeShadowFreshBestEffort(\n  fieldId: string,\n  maxAgeHours = DEFAULT_MAX_AGE_HOURS,\n) {\n  const field = normalizedId(fieldId);\n  if (!field || cropForgeShadowInFlight.has(field)) return;\n  cropForgeShadowInFlight.add(field);\n\n  void (async () => {\n    try {\n      const { data, error } = await supabase\n        .from('model_engine_runs')\n        .select('status,updated_at,completed_at')\n        .eq('field_id', field)\n        .eq('engine', 'cropforge')\n        .eq('mode', 'shadow')\n        .order('updated_at', { ascending: false })\n        .limit(1)\n        .maybeSingle();\n\n      if (!error && data) {\n        const timestamp = Date.parse(String(data.completed_at ?? data.updated_at ?? ''));\n        const freshForMs = Math.max(0.25, maxAgeHours) * 60 * 60 * 1000;\n        if (Number.isFinite(timestamp) && Date.now() - timestamp <= freshForMs) return;\n      }\n\n      const { data: result, error: invokeError } = await supabase.functions.invoke(\n        'cropforge-shadow-run',\n        { body: { field_id: field } },\n      );\n      if (invokeError) throw invokeError;\n      if (result?.ok === false) {\n        throw new Error(String(result?.error ?? 'CropForge shadow çalıştırılamadı.'));\n      }\n    } catch (error) {\n      console.warn('[cropforge-shadow] background run failed', error);\n    } finally {\n      cropForgeShadowInFlight.delete(field);\n    }\n  })();\n}\n'''
    p.write_text(text)

p = Path('src/features/field-detail/components/SeasonModelInputs.tsx')
text = p.read_text()
if 'ensureCropForgeShadowFreshBestEffort' not in text:
    text = text.replace(
        '  ensureCropForgeReadinessFreshBestEffort,\n  ensurePyFao56ReadinessFreshBestEffort,',
        '  ensureCropForgeReadinessFreshBestEffort,\n  ensureCropForgeShadowFreshBestEffort,\n  ensurePyFao56ReadinessFreshBestEffort,',
        1,
    )
    text = text.replace(
        '    ensureCropForgeReadinessFreshBestEffort(fieldId, 24);',
        '    ensureCropForgeReadinessFreshBestEffort(fieldId, 24);\n    ensureCropForgeShadowFreshBestEffort(fieldId, 24);',
        1,
    )
    p.write_text(text)

Path('.github/apply-cropforge-phase2.py').unlink(missing_ok=True)
Path('.github/workflows/apply-cropforge-phase2.yml').unlink(missing_ok=True)

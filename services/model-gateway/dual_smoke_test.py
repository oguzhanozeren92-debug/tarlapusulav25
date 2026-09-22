from pathlib import Path
from __future__ import annotations

from datetime import date, timedelta
import os

from pyfao56_dual_runner import (
    DualKcBasalProfile,
    DualKcInitialState,
    DualKcStation,
    DualKcWeatherDay,
    PyFao56DualKcShadowRequest,
)
from dual_app import run_pyfao56_dual_kc_shadow


def weather_day(day: date, kcb: float = 0.8) -> DualKcWeatherDay:
    return DualKcWeatherDay(
        date=day,
        solar_radiation_mj_m2=20.0,
        tmax_c=30.0,
        tmin_c=16.0,
        dew_point_c=10.0,
        wind_m_s=2.0,
        rain_mm=0.0,
        kcb=kcb,
    )


def main() -> None:
    os.environ["MODEL_GATEWAY_ENV"] = "development"
    os.environ.pop("MODEL_GATEWAY_SHARED_KEY", None)

    start = date(2026, 9, 15)
    payload = PyFao56DualKcShadowRequest(
        field_id="dual-smoke-field",
        station=DualKcStation(
            latitude=37.05,
            elevation_m=850.0,
            wind_height_m=2.0,
        ),
        basal_profile=DualKcBasalProfile(
            initial=0.20,
            mid=0.85,
            end=0.60,
        ),
        state=DualKcInitialState(
            theta_fc=0.30,
            theta_wp=0.12,
            root_depth_m=1.0,
            depletion_fraction_p=0.50,
            ze_m=0.15,
            initial_de_mm=10.0,
            initial_dr_mm=50.0,
            canopy_height_m=2.5,
            canopy_cover_fraction=0.50,
        ),
        rew_values_mm=[8.0, 12.0],
        irrigation_wetting_fraction_range=[0.3, 0.4],
        days=[
            weather_day(start),
            weather_day(start + timedelta(days=1)),
            weather_day(start + timedelta(days=2)),
        ],
    )

    result = run_pyfao56_dual_kc_shadow(payload, None)

    assert result["ok"] is True
    assert result["production_authority"] is False
    assert result["shadow_scope"] == "dual_kc_water_balance_bounded_rew"
    assert result["initial_state_injection"]["enabled"] is True
    assert result["initial_state_injection"]["surface_depletion_mm"] == 10.0
    assert result["initial_state_injection"]["root_depletion_mm"] == 50.0
    assert result["uncertainty"]["scenario_count"] == 2
    assert result["uncertainty"]["rew_values_mm"] == [8.0, 12.0]
    assert result["uncertainty"]["irrigation_wetting_fraction_range"] == [0.3, 0.4]
    assert len(result["scenarios"]) == 2

    for scenario in result["scenarios"]:
        assert scenario["basal_profile"] == {"initial": 0.2, "mid": 0.85, "end": 0.6}
        assert len(scenario["days"]) == 3
        assert scenario["initial_state"]["surface_depletion_mm"] == 10.0
        assert scenario["initial_state"]["root_depletion_mm"] == 50.0
        assert scenario["days"][0]["reference_et_mm"] is not None
        assert scenario["days"][0]["actual_et_mm"] is not None
        assert scenario["days"][0]["surface_depletion_mm"] is not None
        assert scenario["days"][0]["root_depletion_mm"] is not None

    print(
        "dual-kc smoke ok",
        {
            "engine_version": result.get("engine_version"),
            "scenario_count": result["uncertainty"]["scenario_count"],
            "scope": result["shadow_scope"],
        },
    )


if __name__ == "__main__":
    main()


def test_pcse_runner_uses_phenology_only_engine():
    source = Path(__file__).with_name("pcse_runner.py").read_text(encoding="utf-8")
    assert "Wofost72_Phenology" in source
    assert "model = Wofost72_Phenology(" in source
    assert '"production_level": "phenology_only"' in source
    assert "Wofost72_PP(" not in source
    assert 'keep = ["day", "DVS"]' in source
    for forbidden in ["LAI", "TAGP", "TWSO", "TRA", "RD", "SM"]:
        assert forbidden not in source.split('keep = ["day", "DVS"]', 1)[0].split("def _last_output_row", 1)[-1]


def test_pcse_edge_and_client_fail_closed_on_phenology_contract():
    root = Path(__file__).resolve().parents[2]
    edge = (root / "supabase/functions/pcse-pilot-run/index.ts").read_text(encoding="utf-8")
    client = (root / "src/features/phenology/services/pcsePhenology.service.ts").read_text(encoding="utf-8")
    for source in (edge, client):
        assert "Wofost72_Phenology" in source
        assert "production_level" in source
        assert "phenology_only" in source
        assert "production_authority" in source
        assert "water_stress_authority" in source


def test_aquacrop_edge_rejects_client_model_inputs():
    root = Path(__file__).resolve().parents[2]
    edge = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    assert "AquaCrop tarımsal/model girdileri istemciden kabul edilmez" in edge
    for forbidden in [
        "crop_model_key", "weather", "soil_layers", "initial_water_layers",
        "irrigation_management", "simulation_start", "simulation_end",
    ]:
        assert f"'{forbidden}'" in edge


def test_pdf_archives_only_trusted_ready_aquacrop_evidence():
    root = Path(__file__).resolve().parents[2]
    pdf = (root / "src/features/pusula-pdf/services/pusulaPdfAquaCropEvidence.service.ts").read_text(encoding="utf-8")
    assert "evidence.status !== 'ready'" in pdf
    assert "evidence.productionAuthority !== false" in pdf
    assert "return false" in pdf


def test_aquacrop_edge_binds_output_to_server_run():
    root = Path(__file__).resolve().parents[2]
    edge = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    for token in [
        "result.field_id !== fieldId",
        "result?.simulation?.start !== plantingDate",
        "result?.simulation?.end !== simulationEnd",
        "result?.simulation?.crop_model_key !== String(crop.modelCropKey)",
        "Number(result?.simulation?.weather_days) !== weather.length",
        "result?.simulation?.irrigation_mode !== String(management.mode)",
    ]:
        assert token in edge


def test_aquacrop_archived_evidence_matches_persisted_input_summary():
    root = Path(__file__).resolve().parents[2]
    source = (root / "src/features/irrigation/services/aquaCropPilotEvidence.service.ts").read_text(encoding="utf-8")
    assert "stringOrNull(output?.field_id) === audit.fieldId" in source
    assert "outputSimulation?.start" in source and "inputSummary?.simulation_start" in source
    assert "outputSimulation?.crop_model_key" in source and "inputSummary?.crop_model_key" in source
    assert "outputSimulation?.weather_days" in source and "inputSummary?.weather_days" in source


def test_aquacrop_contract_requires_gapless_weather_and_schedule_bounds():
    root = Path(__file__).resolve().parents[2]
    source = (root / "services/model-gateway/aquacrop_runner.py").read_text(encoding="utf-8")
    assert "weather must cover every calendar day in the simulation range without gaps" in source
    assert "any((current - previous).days != 1" in source
    assert "irrigation schedule date must fall inside simulation range" in source


def test_aquacrop_source_and_output_continuity_are_fail_closed():
    root = Path(__file__).resolve().parents[2]
    edge = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    runner = (root / "services/model-gateway/aquacrop_runner.py").read_text(encoding="utf-8")
    assert "weather.length !== expectedDays" in edge
    assert "!gapless" in edge
    assert "fully and continuously cover requested AquaCrop simulation window" in edge
    assert "AquaCrop returned no water-flux evidence" in runner
    assert "AquaCrop returned no water-storage evidence" in runner
    assert "AquaCrop output does not cover the requested daily simulation horizon" in runner


def test_aquacrop_authority_and_exact_horizon_contract():
    root = Path(__file__).resolve().parents[2]
    runner = (root / "services/model-gateway/aquacrop_runner.py").read_text(encoding="utf-8")
    edge = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    frontend = (root / "src/features/irrigation/services/aquaCropPilotEvidence.service.ts").read_text(encoding="utf-8")
    pdf = (root / "src/features/pusula-pdf/services/pusulaPdfAquaCropEvidence.service.ts").read_text(encoding="utf-8")
    assert '"irrigation_prescription_authority": False' in runner
    assert '"yield_authority": False' in runner
    assert '"evidence_scope": "season_scale_validation_only"' in runner
    assert "len(water_flux) != expected_days" in runner
    assert "result.irrigation_prescription_authority !== false" in edge
    assert "output?.irrigation_prescription_authority === false" in frontend
    assert "evidenceScope: 'season_scale_validation_only'" in pdf
    assert "initial_water_layers:" in edge and "irrigation_mode:" in edge


def test_aquacrop_full_provenance_and_management_contract():
    root = Path(__file__).resolve().parents[2]
    runner = (root / "services/model-gateway/aquacrop_runner.py").read_text(encoding="utf-8")
    edge = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    frontend = (root / "src/features/irrigation/services/aquaCropPilotEvidence.service.ts").read_text(encoding="utf-8")
    assert "unexpected irrigation settings" in runner
    assert "duplicate irrigation schedule dates are not allowed" in runner
    assert "Number(result?.simulation?.soil_layers)" in edge
    assert "Number(result?.simulation?.initial_water_layers)" in edge
    assert "outputSimulation?.soil_layers" in frontend
    assert "outputSimulation?.initial_water_layers" in frontend
    assert "outputSimulation?.irrigation_mode" in frontend


def test_aquacrop_request_surface_and_input_provenance_are_locked():
    root = Path(__file__).resolve().parents[2]
    inputs = (root / "supabase/functions/aquacrop-pilot-inputs/index.ts").read_text(encoding="utf-8")
    edge = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    assert "bodyKeys.some((key) => key !== 'field_id')" in inputs
    assert "bodyKeys.some((key) => key !== 'field_id')" in edge
    assert "irrigation_mode: management.mode" in edge
    assert "irrigation_management: management?.source ?? management?.managementSource ?? null" in edge
    assert "initial_water: initialWater?.source ?? null" in edge


def test_aquacrop_provenance_survives_all_run_states_and_pdf_archive():
    root = Path(__file__).resolve().parents[2]
    edge = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    frontend = (root / "src/features/irrigation/services/aquaCropPilotEvidence.service.ts").read_text(encoding="utf-8")
    pdf = (root / "src/features/pusula-pdf/services/pusulaPdfAquaCropEvidence.service.ts").read_text(encoding="utf-8")
    assert edge.count("input_summary: inputSummary") >= 3
    assert edge.count("source_versions: sourceVersions") >= 3
    assert "weatherFingerprint = await sha256(weather)" in edge
    assert "initialWaterFingerprint = await sha256(water.layers)" in edge
    assert "managementFingerprint = await sha256(modelPayload.irrigation_management)" in edge
    assert "source_versions,output" in frontend
    assert "sourceVersions: audit.sourceVersions" in pdf


def test_aquacrop_pinned_version_and_evidence_only_contract():
    root = Path(__file__).resolve().parents[2]
    runner = (root / "services/model-gateway/aquacrop_runner.py").read_text(encoding="utf-8")
    edge = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    frontend = (root / "src/features/irrigation/services/aquaCropPilotEvidence.service.ts").read_text(encoding="utf-8")
    pdf = (root / "src/features/pusula-pdf/services/pusulaPdfAquaCropEvidence.service.ts").read_text(encoding="utf-8")
    assert "crop_parameter_source_commit: '36cc20e44644ed1704398889312435c85e04a2f3'" in edge
    assert "weather_variables:" in edge and "soil_assumptions:" in edge and "soil_warnings:" in edge
    assert "!String(result.engine_version ?? '').trim()" in edge
    assert 'len(simulation_results) != 1' in runner
    assert '"evidence_only": True' in runner
    assert "result?.outputs?.evidence_only !== true" in edge
    assert "output?.engine_version) === audit.engineVersion" in frontend
    assert "soilAssumptions:" in pdf and "soilWarnings:" in pdf


def test_aquacrop_strict_request_and_profile_contract():
    root = Path(__file__).resolve().parents[2]
    runner = (root / "services/model-gateway/aquacrop_runner.py").read_text(encoding="utf-8")
    edge = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    assert "parsed_smt" in runner
    assert 'set(item) != {"date", "depth_mm"}' in runner
    assert "depth_mm must be within (0, 500]" in runner
    assert "manual_schedule is not allowed" in runner
    assert "server_derived_irrigation_management" in edge
    assert "simulation_start must equal planting_date" in runner
    assert "profile must cover exactly" in runner
    assert "Math.abs(cursor - 200) <= 0.001" in edge
    assert "modelPayloadBytes > 2_000_000" in edge
    assert '"contract_version": 3' in runner
    assert "Number(result.contract_version) !== 3" in edge


def test_aquacrop_adapter_management_and_profile_integrity():
    root = Path(__file__).resolve().parents[2]
    inputs = (root / "supabase/functions/aquacrop-pilot-inputs/index.ts").read_text(encoding="utf-8")
    edge = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    assert "allowedModes = new Set(['rainfed', 'soil_moisture_target', 'recorded_schedule'])" in inputs
    assert "verifiedAtValid" in inputs and "sourceValid" in inputs
    assert "Aynı güne ait Sulama kayıtlarının toplamı" in inputs
    assert "overlappingUnused" in inputs
    assert "modelReady && !overlappingUnused" in inputs
    assert "verified_crop_parameters" in edge
    assert "soil_profile_depth" in edge
    assert "initial_water_profile_depth" in edge


def test_aquacrop_frontend_evidence_trust_contract():
    root = Path(__file__).resolve().parents[2]
    frontend = (root / "src/features/irrigation/services/aquaCropPilotEvidence.service.ts").read_text(encoding="utf-8")
    assert "const sourceFingerprints" in frontend
    assert "output?.outputs?.evidence_only === true" in frontend
    assert "finiteNumber(output?.contract_version) === 4" in frontend
    assert "completedMs > nowMs + 60_000" in frontend
    assert "outputSimulation?.planting_date" in frontend
    assert "model_payload_bytes" in frontend
    assert "input_adapter_version) === 4" in frontend
    assert "run_adapter_version) === 3" in frontend
    assert "weather_timezone) === 'UTC'" in frontend
    assert "et0_fao_evapotranspiration" in frontend
    assert "Boolean(audit.sourceVersions?.irrigation_management)" in frontend


def test_aquacrop_pdf_archive_provenance_contract():
    root = Path(__file__).resolve().parents[2]
    pdf = (root / "src/features/pusula-pdf/services/pusulaPdfAquaCropEvidence.service.ts").read_text(encoding="utf-8")
    assert "schemaVersion: 2" in pdf
    assert "provenanceHash" in pdf and "provenanceFingerprint: provenanceHash" in pdf
    assert "contractVersion: 4" in pdf
    assert "modelPayloadBytes:" in pdf
    assert "inputAdapterVersion:" in pdf and "runAdapterVersion:" in pdf
    assert "upstreamCommit:" in pdf
    assert "weatherSource:" in pdf and "weatherTimezone:" in pdf and "weatherVariables:" in pdf
    assert "immutableEvidence: true" in pdf


def test_aquacrop_pdf_archive_full_input_identity():
    root = Path(__file__).resolve().parents[2]
    pdf = (root / "src/features/pusula-pdf/services/pusulaPdfAquaCropEvidence.service.ts").read_text(encoding="utf-8")
    assert "fingerprintParts = ['weather', 'soil', 'initial_water', 'irrigation_management']" in pdf
    assert "inputFingerprints:" in pdf
    assert "inputFingerprintVerified: true" in pdf
    assert "plantingDate:" in pdf
    assert "initialWaterCoherenceHours:" in pdf
    assert "serverDerivedInputs:" in pdf
    assert "audit.inputSummary?.server_derived !== true" in pdf
    assert "36 * 60 * 60 * 1000" in pdf


def test_aquacrop_decision_attachment_is_non_authoritative():
    root = Path(__file__).resolve().parents[2]
    attach = (root / "src/features/irrigation/services/irrigationAquaCropEvidenceAttach.service.ts").read_text(encoding="utf-8")
    assert "Sezon kanıtı ·" in attach
    assert "confidence: decision.confidence" in attach
    assert "code: decision.code" in attach
    assert "waterMm: decision.waterMm" in attach
    assert "grossWaterMm: decision.grossWaterMm" in attach
    assert "seasonModelEvidence.productionAuthority !== false" in attach
    assert "return decision;" in attach
    assert "seasonModelEvidence.sourceModel === 'aquacrop-pilot'" in attach
    assert "seasonModelEvidence.missingInputs.length === 0" in attach


def test_aquacrop_attachment_preserves_production_contract():
    root = Path(__file__).resolve().parents[2]
    attach = (root / "src/features/irrigation/services/irrigationAquaCropEvidenceAttach.service.ts").read_text(encoding="utf-8")
    for field in ["decision: decision.decision", "recommendation: decision.recommendation", "waterBalance: decision.waterBalance", "forecast: decision.forecast", "display: decision.display", "warnings: decision.warnings", "missing: decision.missing", "generatedAt: decision.generatedAt", "modelEvidence: decision.modelEvidence", "synthesis: decision.synthesis"]:
        assert field in attach
    assert "seasonModelEvidence.productionAuthority === false" in attach
    assert "remainingSlots = Math.max(0, 10 - productionReasons.length)" in attach


def test_aquacrop_initial_water_depth_semantics_contract():
    root = Path(__file__).resolve().parents[2]
    runner = (root / "services/model-gateway/aquacrop_runner.py").read_text(encoding="utf-8")
    edge = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    assert 'method="Depth"' in runner
    assert '"initial_water_method": "Depth"' in runner
    assert '"contract_version": 8' in runner
    assert "initial_water_method !== 'Depth'" in edge
    assert "aquacrop_runtime_package: '3.1.0'" in edge


def test_aquacrop_runtime_version_drift_fails_closed():
    root = Path(__file__).resolve().parents[2]
    runner = (root / "services/model-gateway/aquacrop_runner.py").read_text(encoding="utf-8")
    edge = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    evidence = (root / "src/features/irrigation/services/aquaCropPilotEvidence.service.ts").read_text(encoding="utf-8")
    assert 'runtime_version != "3.1.0"' in runner
    assert "String(result.engine_version) !== '3.1.0'" in edge
    assert "audit.engineVersion === '3.1.0'" in evidence


def test_aquacrop_input_contract_v8_is_bound_end_to_end():
    root = Path(__file__).resolve().parents[2]
    adapter = (root / "supabase/functions/aquacrop-pilot-inputs/index.ts").read_text(encoding="utf-8")
    run = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    assert "inputContractVersion: 8" in adapter
    assert "Number(payload.inputContractVersion) !== 8" in run


def test_aquacrop_daily_output_counter_integrity():
    root = Path(__file__).resolve().parents[2]
    runner = (root / "services/model-gateway/aquacrop_runner.py").read_text(encoding="utf-8")
    edge = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    client = (root / "src/features/irrigation/services/aquaCropPilotEvidence.service.ts").read_text(encoding="utf-8")
    assert "def _validate_daily_output_horizon" in runner
    assert "time_step_counter is not contiguous" in runner
    assert '"daily_output_integrity": "exact_zero_based_time_step_counter"' in runner
    assert "daily_output_integrity !== 'exact_zero_based_time_step_counter'" in edge
    assert "daily_output_integrity) === 'exact_zero_based_time_step_counter'" in client


def test_aquacrop_water_evidence_only_output_scope():
    root = Path(__file__).resolve().parents[2]
    runner = (root / "services/model-gateway/aquacrop_runner.py").read_text(encoding="utf-8")
    edge = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    assert '"output_scope": "water_balance_evidence_only"' in runner
    assert '"Yield (tonne/ha)"' not in runner
    assert '"last_crop_growth"' not in runner
    assert "output_scope !== 'water_balance_evidence_only'" in edge


def test_aquacrop_scoped_crop_parameter_provenance():
    root = Path(__file__).resolve().parents[2]
    run = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    client = (root / "src/features/irrigation/services/aquaCropPilotEvidence.service.ts").read_text(encoding="utf-8")
    pdf = (root / "src/features/pusula-pdf/services/pusulaPdfAquaCropEvidence.service.ts").read_text(encoding="utf-8")
    assert "crop_parameter_source_commit" in run
    assert "aquacrop_upstream_commit" not in run
    assert "crop_parameter_source_commit" in client
    assert "cropParameterSourceCommit" in pdf


def test_aquacrop_soil_pedotransfer_contract():
    root = Path(__file__).resolve().parents[2]
    soil = (root / "supabase/functions/aquacrop-soil-profile/index.ts").read_text(encoding="utf-8")
    adapter = (root / "supabase/functions/aquacrop-pilot-inputs/index.ts").read_text(encoding="utf-8")
    assert "adapter_contract_version: 2" in soil
    assert "pedotransfer_method: 'Saxton-Rawls 2006'" in soil
    assert "Number(payload.adapter_contract_version) !== 2" in adapter
    assert "payload.pedotransfer_method !== 'Saxton-Rawls 2006'" in adapter


def test_aquacrop_soil_provenance_chain():
    root = Path(__file__).resolve().parents[2]
    run = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    client = (root / "src/features/irrigation/services/aquaCropPilotEvidence.service.ts").read_text(encoding="utf-8")
    pdf = (root / "src/features/pusula-pdf/services/pusulaPdfAquaCropEvidence.service.ts").read_text(encoding="utf-8")
    assert "soil_adapter_contract_version" in run
    assert "soil_pedotransfer_method" in run
    assert "soil_adapter_contract_version) === 2" in client
    assert "soil_pedotransfer_method) === 'Saxton-Rawls 2006'" in client
    assert "soilPedotransferMethod" in pdf


def test_aquacrop_soilgrids_access_provenance():
    root = Path(__file__).resolve().parents[2]
    soil = (root / "supabase/functions/aquacrop-soil-profile/index.ts").read_text(encoding="utf-8")
    assert "SoilGrids250m 2.0" in soil
    assert "accessMethod: 'OGC WCS 2.0.1'" in soil
    assert "statistic: 'mean'" in soil
    assert "dataType: 'model-estimate'" in soil


def test_aquacrop_oversized_payload_is_audited():
    root = Path(__file__).resolve().parents[2]
    run = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    marker = "if (modelPayloadBytes > 2_000_000)"
    block = run[run.index(marker):run.index(marker) + 1400]
    assert "await persistRun(serviceClient" in block
    assert "status: 'failed'" in block
    assert "model_payload_bytes: modelPayloadBytes" in block
    assert "}, 413)" in block


def test_aquacrop_gateway_v6_trust_boundary():
    root = Path(__file__).resolve().parents[2]
    run = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    assert "Number(result.contract_version) !== 8" in run
    assert "String(result.engine_version ?? '') !== '3.1.0'" in run
    assert "initial_water_method !== 'Depth'" in run
    assert "daily_output_integrity !== 'exact_zero_based_time_step_counter'" in run
    assert "output_scope !== 'water_balance_evidence_only'" in run


def test_aquacrop_gateway_contract_failure_is_audited():
    root = Path(__file__).resolve().parents[2]
    run = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    marker = "AquaCrop gateway response trust boundary doğrulanamadı."
    assert run.count(marker) >= 2
    boundary = run[run.index("result.production_authority !== false"):run.index("await persistRun(serviceClient, {", run.index("result.production_authority !== false")) + 1000]
    assert "status: 'failed'" in boundary
    assert "source_versions: sourceVersions" in boundary


def test_aquacrop_requires_complete_weather_horizon():
    root = Path(__file__).resolve().parents[2]
    run = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    assert "expectedWeatherDays" in run
    assert "weather.length !== expectedWeatherDays" in run
    assert "AquaCrop weather horizon incomplete" in run


def test_aquacrop_weather_adapter_provenance():
    root = Path(__file__).resolve().parents[2]
    run = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    client = (root / "src/features/irrigation/services/aquaCropPilotEvidence.service.ts").read_text(encoding="utf-8")
    pdf = (root / "src/features/pusula-pdf/services/pusulaPdfAquaCropEvidence.service.ts").read_text(encoding="utf-8")
    assert "weather_adapter_contract_version: 2" in run
    assert "weather_adapter_contract_version) === 2" in client
    assert "weatherAdapterContractVersion" in pdf


def test_aquacrop_archive_lag_provenance():
    root = Path(__file__).resolve().parents[2]
    run = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    client = (root / "src/features/irrigation/services/aquaCropPilotEvidence.service.ts").read_text(encoding="utf-8")
    pdf = (root / "src/features/pusula-pdf/services/pusulaPdfAquaCropEvidence.service.ts").read_text(encoding="utf-8")
    assert "archive_lag_days: ARCHIVE_LAG_DAYS" in run
    assert "archive_lag_days) === 5" in client
    assert "archiveLagDays" in pdf


def test_aquacrop_initial_water_uses_measured_interval_midpoints():
    root = Path(__file__).resolve().parents[2]
    runner = (root / "services/model-gateway/aquacrop_runner.py").read_text(encoding="utf-8")
    edge = (root / "supabase/functions/aquacrop-pilot-run/index.ts").read_text(encoding="utf-8")
    assert "top_m + 1e-9" not in runner
    assert "(float(item.from_cm) + float(item.to_cm)) / 200.0" in runner
    assert '"initial_water_depth_semantics": "measured_interval_midpoints"' in runner
    assert "initial_water_depth_semantics !== 'measured_interval_midpoints'" in edge


def test_aquacrop_exact_zero_based_counter_values():
    root = Path(__file__).resolve().parents[2]
    runner = (root / "services/model-gateway/aquacrop_runner.py").read_text(encoding="utf-8")
    assert "counters[0] != 0" in runner
    assert "counters != list(range(expected_days))" in runner
    assert "time_step_counter contains invalid values" in runner


def test_aquacrop_non_authoritative_contract_is_complete():
    root = Path(__file__).resolve().parents[2]
    runner = (root / "services/model-gateway/aquacrop_runner.py").read_text(encoding="utf-8")
    client = (root / "src/features/irrigation/services/aquaCropPilotEvidence.service.ts").read_text(encoding="utf-8")
    for guard in ['"production_authority": False', '"irrigation_prescription_authority": False', '"yield_authority": False']:
        assert guard in runner
    assert "output?.production_authority === false" in client
    assert "output?.irrigation_prescription_authority === false" in client
    assert "output?.yield_authority === false" in client


def test_agrifm_registry_is_non_authoritative():
    root = Path(__file__).resolve().parents[2]
    registry = (root / "services/model-gateway/engine_registry.py").read_text(encoding="utf-8")
    assert '"agrifm"' in registry
    assert '"upstream": "flyakon/AgriFM"' in registry
    assert '"upstream_commit": "13f476e2d5b698387fa8ce068e793cc1c33f8279"' in registry
    block = registry[registry.index('"agrifm"'):registry.index('"autogeobound"')]
    assert '"rollout": "off"' in block
    assert '"production_authority": False' in block
    assert '"license": "Apache-2.0 (upstream LICENSE)"' in block


def test_agrifm_input_adapter_fails_closed_without_real_cube():
    root = Path(__file__).resolve().parents[2]
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    assert "only_field_id_is_accepted" in adapter
    assert "server_side_multiband_temporal_cube_adapter" in adapter
    assert "client_supplied_satellite_values_accepted: false" in adapter
    assert "production_authority: false" in adapter
    assert "NDVI aggregates are not substituted for model inputs" in adapter


def test_agrifm_thresholds_are_bound():
    root = Path(__file__).resolve().parents[2]
    registry = (root / "services/model-gateway/engine_registry.py").read_text(encoding="utf-8")
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    assert '"minimum_observations": 4' in registry
    assert '"maximum_scene_cloud_cover_percent": 30' in registry
    assert "const MIN_OBSERVATIONS = 4" in adapter
    assert "const MAX_CLOUD_COVER = 30" in adapter


def test_agrifm_execution_gate_is_closed():
    root = Path(__file__).resolve().parents[2]
    run = (root / "supabase/functions/agrifm-pilot-run/index.ts").read_text(encoding="utf-8")
    assert "only_field_id_is_accepted" in run
    assert "model_execution_attempted: false" in run
    assert "validated_server_side_multiband_temporal_cube" in run
    assert "validated_model_weights" in run
    assert "production_authority: false" in run


def test_agrifm_frontend_never_promotes_blocked_inputs():
    root = Path(__file__).resolve().parents[2]
    client = (root / "src/features/satellite/services/agrifmPilotEvidence.service.ts").read_text(encoding="utf-8")
    assert "productionAuthority: false" in client
    assert "evidenceScope: 'research_only'" in client
    assert "must remain fail-closed" in client


def test_agrifm_mask_policy_is_bound():
    root = Path(__file__).resolve().parents[2]
    registry = (root / "services/model-gateway/engine_registry.py").read_text(encoding="utf-8")
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    for token in ["0, 1, 3, 8, 9, 10, 11", "ascending_acquisition_time", "duplicate_acquisition_policy"]:
        assert token in registry
        assert token in adapter


def test_agrifm_geometry_cannot_be_client_supplied():
    root = Path(__file__).resolve().parents[2]
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    assert "only_field_id_is_accepted" in adapter
    assert "geometry_authority: 'stored_field_geometry'" in adapter
    assert "client_geometry_accepted: false" in adapter


def test_agrifm_cube_schema_is_bound():
    root = Path(__file__).resolve().parents[2]
    registry = (root / "services/model-gateway/engine_registry.py").read_text(encoding="utf-8")
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    for token in ["cube_schema_version", "float32", "unitless_0_1"]:
        assert token in registry
        assert token in adapter


def test_agrifm_spatial_policy_is_bound():
    root = Path(__file__).resolve().parents[2]
    registry = (root / "services/model-gateway/engine_registry.py").read_text(encoding="utf-8")
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    for token in ["common_10m_grid", "explicit_per_band_required", "mask_not_zero_fill"]:
        assert token in registry
        assert token in adapter


def test_agrifm_scene_provenance_is_required():
    root = Path(__file__).resolve().parents[2]
    registry = (root / "services/model-gateway/engine_registry.py").read_text(encoding="utf-8")
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    for token in ["stac_item_id_plus_acquisition_time", "stac_item_id", "acquired_at"]:
        assert token in registry
        assert token in adapter


def test_agrifm_reflectance_policy_is_bound():
    root = Path(__file__).resolve().parents[2]
    registry = (root / "services/model-gateway/engine_registry.py").read_text(encoding="utf-8")
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    assert '"reflectance_range": [0, 1]' in registry
    assert "reflectance_range: [0, 1]" in adapter
    assert "reject_unmasked_out_of_range" in registry and "reject_unmasked_out_of_range" in adapter


def test_agrifm_cube_fingerprint_is_required():
    root = Path(__file__).resolve().parents[2]
    registry = (root / "services/model-gateway/engine_registry.py").read_text(encoding="utf-8")
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    for token in ["SHA-256", "pixels_mask_dates_scene_ids_geometry_contract"]:
        assert token in registry
        assert token in adapter


def test_agrifm_run_gate_binds_cube_contract():
    root = Path(__file__).resolve().parents[2]
    run = (root / "supabase/functions/agrifm-pilot-run/index.ts").read_text(encoding="utf-8")
    assert "contract_version: 2" in run
    assert "sentinel2_l2a_temporal_cube_v1" in run
    assert "required_cube_schema_version: 1" in run
    assert "required_fingerprint_algorithm: 'SHA-256'" in run


def test_agrifm_frontend_exposes_cube_contract():
    root = Path(__file__).resolve().parents[2]
    client = (root / "src/features/satellite/services/agrifmPilotEvidence.service.ts").read_text(encoding="utf-8")
    assert "cubeContract: 'sentinel2_l2a_temporal_cube_v1'" in client
    assert "productionAuthority: false" in client


def test_agrifm_adapter_checks_field_ownership_and_geometry():
    root = Path(__file__).resolve().parents[2]
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    assert ".eq('user_id', userData.user.id)" in adapter
    assert "valid_stored_field_geometry_required" in adapter
    assert "parcel_geometry" in adapter


def test_agrifm_discovers_real_sentinel_scenes_server_side():
    root = Path(__file__).resolve().parents[2]
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    assert "COPERNICUS_CLIENT_ID" in adapter and "COPERNICUS_CLIENT_SECRET" in adapter
    assert "sentinel-2-l2a" in adapter
    assert "eligible_scene_count" in adapter
    assert "minimum_real_sentinel_observations" in adapter


def test_agrifm_multiband_script_keeps_validity_mask_separate():
    root = Path(__file__).resolve().parents[2]
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    assert 'bands: ["B02","B03","B04","B08","SCL","dataMask"]' in adapter
    assert 'id: "reflectance"' in adapter
    assert 'id: "validMask"' in adapter
    assert "sampleType: \"FLOAT32\"" in adapter


def test_agrifm_cube_dimensions_are_bound():
    root = Path(__file__).resolve().parents[2]
    registry = (root / "services/model-gateway/engine_registry.py").read_text(encoding="utf-8")
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    for token in ["fixed_64x64_field_bbox", "64"]:
        assert token in registry
        assert token in adapter


def test_agrifm_cube_payload_is_capped():
    root = Path(__file__).resolve().parents[2]
    registry = (root / "services/model-gateway/engine_registry.py").read_text(encoding="utf-8")
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    assert '"maximum_cube_bytes": 8388608' in registry
    assert "MAX_CUBE_BYTES = 8 * 1024 * 1024" in adapter
    assert "oversized_cube_policy" in registry and "oversized_cube_policy" in adapter


def test_agrifm_temporal_length_is_bound():
    root = Path(__file__).resolve().parents[2]
    registry = (root / "services/model-gateway/engine_registry.py").read_text(encoding="utf-8")
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    assert '"maximum_selected_observations": 12' in registry
    assert "MAX_SELECTED_OBSERVATIONS = 12" in adapter
    assert "latest_eligible_unique_acquisitions" in registry and "latest_eligible_unique_acquisitions" in adapter


def test_agrifm_process_endpoint_is_server_side_only():
    root = Path(__file__).resolve().parents[2]
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    assert "https://sh.dataspace.copernicus.eu/process/v1" in adapter
    assert "client_supplied_satellite_values_accepted: false" in adapter
    assert "MULTIBAND_SCRIPT" in adapter


def test_agrifm_scene_selection_is_deterministic():
    root = Path(__file__).resolve().parents[2]
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    assert "eligible.sort((a,b) => a.acquired_at.localeCompare(b.acquired_at))" in adapter
    assert "unique.set" in adapter
    assert "slice(-MAX_SELECTED_OBSERVATIONS)" in adapter


def test_agrifm_process_requests_multiband_tiffs():
    root = Path(__file__).resolve().parents[2]
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    assert "Accept: 'application/tar'" in adapter
    assert "identifier: 'reflectance'" in adapter
    assert "identifier: 'validMask'" in adapter
    assert "type: 'image/tiff'" in adapter
    assert "invalid_scene_tensor_payload" in adapter


def test_agrifm_real_scene_payloads_are_hashed():
    root = Path(__file__).resolve().parents[2]
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    assert "crypto.subtle.digest('SHA-256'" in adapter
    assert "payload_sha256" in adapter
    assert "payload_bytes" in adapter
    assert "fetchSceneTensor(token" in adapter


def test_agrifm_manifest_binds_field_contract_and_scenes():
    root = Path(__file__).resolve().parents[2]
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    assert "evidence_manifest_sha256" in adapter
    assert "field_id: fieldId" in adapter
    assert "contract: 'sentinel2_l2a_temporal_cube_v1'" in adapter
    assert "scenes: evidenceManifest" in adapter


def test_agrifm_total_evidence_payload_is_capped():
    root = Path(__file__).resolve().parents[2]
    registry = (root / "services/model-gateway/engine_registry.py").read_text(encoding="utf-8")
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    assert '"maximum_total_evidence_bytes": 33554432' in registry
    assert "MAX_TOTAL_EVIDENCE_BYTES = 32 * 1024 * 1024" in adapter
    assert "agrifm_evidence_payload_too_large" in adapter


def test_agrifm_input_contract_v2_requires_decoded_cube():
    root = Path(__file__).resolve().parents[2]
    adapter = (root / "supabase/functions/agrifm-pilot-inputs/index.ts").read_text(encoding="utf-8")
    client = (root / "src/features/satellite/services/agrifmPilotEvidence.service.ts").read_text(encoding="utf-8")
    assert "contract_version: 2" in adapter
    assert "decoded_validated_temporal_cube" in adapter
    assert "inputContractVersion: 2" in client


def test_agrifm_numeric_cube_validator_is_fail_closed():
    root = Path(__file__).resolve().parents[2]
    cube = (root / "services/model-gateway/agrifm_cube.py").read_text(encoding="utf-8")
    for token in ["agrifm_reflectance_shape_mismatch", "agrifm_mask_shape_mismatch", "agrifm_mask_not_binary", "agrifm_reflectance_non_finite", "agrifm_reflectance_out_of_range"]:
        assert token in cube


def test_agrifm_masked_pixels_become_nan_not_zero():
    root = Path(__file__).resolve().parents[2]
    cube = (root / "services/model-gateway/agrifm_cube.py").read_text(encoding="utf-8")
    assert "else math.nan" in cube
    assert "pack_scene" in cube


def test_agrifm_valid_pixel_threshold_is_bound():
    root = Path(__file__).resolve().parents[2]
    registry = (root / "services/model-gateway/engine_registry.py").read_text(encoding="utf-8")
    cube = (root / "services/model-gateway/agrifm_cube.py").read_text(encoding="utf-8")
    assert '"minimum_valid_pixel_fraction": 0.10' in registry
    assert "MIN_VALID_PIXEL_FRACTION = 0.10" in cube
    assert "agrifm_scene_valid_fraction_too_low" in cube


def test_agrifm_whole_cube_validation_locks_time_axis():
    root = Path(__file__).resolve().parents[2]
    cube = (root / "services/model-gateway/agrifm_cube.py").read_text(encoding="utf-8")
    assert "agrifm_observation_count_out_of_range" in cube
    assert "agrifm_scene_order_or_duplicate_invalid" in cube
    assert "return (len(scenes), len(BANDS), HEIGHT, WIDTH)" in cube


def test_agrifm_tensor_assembly_is_float32():
    root = Path(__file__).resolve().parents[2]
    cube = (root / "services/model-gateway/agrifm_cube.py").read_text(encoding="utf-8")
    assert 'struct.pack(f"<{len(values)}f"' in cube
    assert 'return b"".join(pack_scene(scene) for scene in scenes)' in cube
    assert "cube_byte_length" in cube


def test_agrifm_decoded_tensor_cap_is_bound():
    root = Path(__file__).resolve().parents[2]
    registry = (root / "services/model-gateway/engine_registry.py").read_text(encoding="utf-8")
    cube = (root / "services/model-gateway/agrifm_cube.py").read_text(encoding="utf-8")
    assert '"maximum_decoded_tensor_bytes": 786432' in registry
    assert "MAX_TENSOR_BYTES = 12 * len(BANDS) * HEIGHT * WIDTH * 4" in cube
    assert "agrifm_tensor_payload_too_large" in cube


def test_agrifm_tensor_metadata_is_explicit():
    root = Path(__file__).resolve().parents[2]
    cube = (root / "services/model-gateway/agrifm_cube.py").read_text(encoding="utf-8")
    for token in ['"dtype": "float32"', '"band_order": list(BANDS)', '"masked_value": "NaN"', '"valid_pixel_fractions"']:
        assert token in cube

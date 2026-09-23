import * as maplibregl from 'maplibre-gl';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './mapRuntime.css';
import { hasMapboxSatellite, mapboxAccessToken } from './mapStyle';

class ApplicationMapboxMap extends mapboxgl.Map {
  constructor(options: mapboxgl.MapOptions) {
    super({
      ...options,
      accessToken: mapboxAccessToken,
      // MapLibre accepts an options object while this Mapbox version expects a boolean.
      // Preserve explicit false; every other common-runtime value keeps attribution enabled.
      attributionControl: options.attributionControl !== false,
    });
  }
}

// The application uses the common GL API (raster, GeoJSON, markers and controls).
// Keep the existing MapLibre types at this boundary for the legacy drawing editor.
// Without the user's own public token the current map remains usable.
export const mapRuntime: typeof maplibregl = hasMapboxSatellite
  ? {
      ...maplibregl,
      Map: ApplicationMapboxMap,
      Marker: mapboxgl.Marker,
      Popup: mapboxgl.Popup,
      NavigationControl: mapboxgl.NavigationControl,
      ScaleControl: mapboxgl.ScaleControl,
      AttributionControl: mapboxgl.AttributionControl,
    } as unknown as typeof maplibregl
  : maplibregl;

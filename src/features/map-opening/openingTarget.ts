export type OpeningTarget = {
  center: [number, number];
  bbox: number[] | null;
  zoom: number;
};

export async function resolveOpeningTarget(
  hasField: boolean,
  fieldCenter: [number, number],
  fieldBounds: number[] | null | undefined,
): Promise<OpeningTarget | null> {
  // A saved field always takes priority. GPS must never replace its position.
  if (hasField) return { center: fieldCenter, bbox: fieldBounds ?? null, zoom: 16 };
  if (!navigator.geolocation) return null;
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ center: [coords.longitude, coords.latitude], bbox: null, zoom: 13 }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 300000, enableHighAccuracy: false },
    );
  });
}

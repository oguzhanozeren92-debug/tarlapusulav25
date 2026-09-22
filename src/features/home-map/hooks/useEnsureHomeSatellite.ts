import { useEffect } from 'react';

export function useEnsureHomeSatellite({
  field,
  fieldKey,
  status,
  loadFieldSatellite,
}: {
  field: any;
  fieldKey: string;
  status?: string;
  loadFieldSatellite?: (field: any) => unknown;
}) {
  useEffect(() => {
    if (!field?.parcelGeometry || !fieldKey || typeof loadFieldSatellite !== 'function') {
      return;
    }

    if (!status || status === 'idle') {
      void loadFieldSatellite(field);
    }
  }, [field, fieldKey, status, loadFieldSatellite]);
}

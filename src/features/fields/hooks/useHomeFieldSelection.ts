import { useMemo, useState } from 'react';

type HomeFieldSelectionInput = {
  fields?: any[] | null;
  favoriteFieldId?: unknown;
};

export function useHomeFieldSelection({
  fields,
  favoriteFieldId,
}: HomeFieldSelectionInput) {
  const fallbackId = fields?.some((field: any) => String(field?.id) === String(favoriteFieldId))
    ? String(favoriteFieldId)
    : String(fields?.[0]?.id ?? '');
  const [selectedId, setFieldId] = useState('');
  const fieldId = fields?.some((field: any) => String(field?.id) === selectedId)
    ? selectedId
    : fallbackId;

  const field = useMemo(
    () =>
      fields?.find((item: any) => String(item?.id) === String(fieldId)) ??
      fields?.find(
        (item: any) => String(item?.id) === String(favoriteFieldId),
      ) ??
      fields?.[0] ??
      null,
    [fields, fieldId, favoriteFieldId],
  );

  return {
    fieldId,
    setFieldId,
    field,
    fieldKey: String(field?.id ?? ''),
  };
}

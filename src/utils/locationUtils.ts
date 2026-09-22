import type { LocationOption } from '../types';

export const sortTurkishLocationOptions = (items: LocationOption[]) =>
  [...items].sort((a, b) =>
    a.name.localeCompare(b.name, 'tr-TR', {
      sensitivity: 'base',
      numeric: true,
    }),
  );

const normalizeLocationName = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '');

const getSelectedProvinceName = (
  provinceOptions: LocationOption[],
  selectedProvinceId: number | null,
  fieldCity: string,
) =>
  provinceOptions.find(
    (province) => Number(province.id) === Number(selectedProvinceId),
  )?.name ?? fieldCity;

const isCentralDistrictName = (
  districtName: string,
  provinceOptions: LocationOption[],
  selectedProvinceId: number | null,
  fieldCity: string,
) => {
  const province = normalizeLocationName(
    getSelectedProvinceName(provinceOptions, selectedProvinceId, fieldCity),
  );
  const district = normalizeLocationName(districtName);

  if (!province || !district) return false;

  return (
    district === province ||
    district === `${province}merkez` ||
    district === `merkez${province}`
  );
};

export const getDistrictDisplayName = (
  districtName: string,
  provinceOptions: LocationOption[],
  selectedProvinceId: number | null,
  fieldCity: string,
) =>
  isCentralDistrictName(
    districtName,
    provinceOptions,
    selectedProvinceId,
    fieldCity,
  )
    ? 'Merkez'
    : districtName;

export const getDistrictLookupName = (
  districtName: string,
  provinceOptions: LocationOption[],
  selectedProvinceId: number | null,
  fieldCity: string,
) =>
  isCentralDistrictName(
    districtName,
    provinceOptions,
    selectedProvinceId,
    fieldCity,
  )
    ? 'Merkez'
    : districtName;

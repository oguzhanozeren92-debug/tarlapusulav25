import { useState } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { supabase } from '../../../supabaseClient';
import type { CropCycle, Field, FieldSeason, PerennialYield } from '../../../types';

type Options = {
  selectedField: Field | null;
  setSelectedField: Dispatch<SetStateAction<Field | null>>;
  setRealFields: Dispatch<SetStateAction<Field[]>>;
};

export function useFieldProductionHistory({ selectedField, setSelectedField, setRealFields }: Options) {
  const [annualSeasons, setAnnualSeasons] = useState<FieldSeason[]>([]);
  const [perennialYields, setPerennialYields] = useState<PerennialYield[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyMessage, setHistoryMessage] = useState('');

  const [annualFormOpen, setAnnualFormOpen] = useState(false);
  const [annualFormLoading, setAnnualFormLoading] = useState(false);
  const [annualYear, setAnnualYear] = useState(String(new Date().getFullYear()));
  const [annualCrop, setAnnualCrop] = useState('');
  const [annualPlantingDate, setAnnualPlantingDate] = useState('');
  const [annualHarvestDate, setAnnualHarvestDate] = useState('');
  const [annualNotes, setAnnualNotes] = useState('');

  const [yieldFormOpen, setYieldFormOpen] = useState(false);
  const [yieldFormLoading, setYieldFormLoading] = useState(false);
  const [yieldYear, setYieldYear] = useState(String(new Date().getFullYear()));
  const [yieldKg, setYieldKg] = useState('');
  const [yieldHarvestDate, setYieldHarvestDate] = useState('');
  const [yieldNotes, setYieldNotes] = useState('');

  const [productionProfileOpen, setProductionProfileOpen] = useState(false);
  const [productionProfileLoading, setProductionProfileLoading] = useState(false);
  const [productionProfileMessage, setProductionProfileMessage] = useState('');
  const [detailCropCycle, setDetailCropCycle] = useState<CropCycle>('annual');
  const [detailPlantingYear, setDetailPlantingYear] = useState('');
  const [detailBearing, setDetailBearing] = useState(true);

  const resetAnnualForm = () => {
    setAnnualYear(String(new Date().getFullYear()));
    setAnnualCrop(selectedField?.crop ?? '');
    setAnnualPlantingDate('');
    setAnnualHarvestDate('');
    setAnnualNotes('');
    setHistoryMessage('');
  };

  const resetYieldForm = () => {
    setYieldYear(String(new Date().getFullYear()));
    setYieldKg('');
    setYieldHarvestDate('');
    setYieldNotes('');
    setHistoryMessage('');
  };

  const loadProductionHistory = async (field: Field) => {
    if (field.demo) {
      setAnnualSeasons([]);
      setPerennialYields([]);
      return;
    }

    setHistoryLoading(true);
    setHistoryMessage('');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setAnnualSeasons([]);
        setPerennialYields([]);
        return;
      }

      const [seasonResult, yieldResult] = await Promise.all([
        supabase
          .from('field_seasons')
          .select('id, field_id, year, crop, variety_name, planting_date, harvest_date, notes')
          .eq('field_id', String(field.id))
          .eq('user_id', user.id)
          .order('year', { ascending: false }),
        supabase
          .from('perennial_yields')
          .select('id, year, yield_kg, harvest_date, notes')
          .eq('field_id', String(field.id))
          .eq('user_id', user.id)
          .is('field_section_id', null)
          .order('year', { ascending: false }),
      ]);
      if (seasonResult.error) throw seasonResult.error;
      if (yieldResult.error) throw yieldResult.error;

      setAnnualSeasons((seasonResult.data ?? []).map((item) => ({
        id: String(item.id),
        fieldId: String(item.field_id),
        year: Number(item.year),
        crop: item.crop ?? 'Ürün belirtilmedi',
        varietyName: item.variety_name ?? null,
        plantingDate: item.planting_date ?? null,
        harvestDate: item.harvest_date ?? null,
        notes: item.notes ?? null,
      })));
      setPerennialYields((yieldResult.data ?? []).map((item) => ({
        id: String(item.id),
        year: Number(item.year),
        yieldKg: item.yield_kg == null ? null : Number(item.yield_kg),
        harvestDate: item.harvest_date ?? null,
        notes: item.notes ?? null,
      })));
    } catch (error) {
      console.error('Üretim geçmişi yüklenemedi:', error);
      setHistoryMessage(error instanceof Error ? error.message : 'Üretim geçmişi yüklenemedi.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSaveProductionProfile = async () => {
    if (!selectedField || selectedField.demo) return;

    const parsedPlantingYear = detailPlantingYear.trim() ? Number(detailPlantingYear) : null;
    if (
      detailCropCycle === 'perennial' &&
      parsedPlantingYear !== null &&
      (!Number.isInteger(parsedPlantingYear) || parsedPlantingYear < 1900 || parsedPlantingYear > new Date().getFullYear())
    ) {
      setProductionProfileMessage('Dikim yılı geçerli değil.');
      return;
    }

    setProductionProfileLoading(true);
    setProductionProfileMessage('');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');

      const { error } = await supabase
        .from('fields')
        .update({
          crop_cycle: detailCropCycle,
          planting_year: detailCropCycle === 'perennial' ? parsedPlantingYear : null,
          bearing: detailCropCycle === 'perennial' ? detailBearing : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', String(selectedField.id))
        .eq('user_id', user.id);
      if (error) throw error;

      const updatedField: Field = {
        ...selectedField,
        cropCycle: detailCropCycle,
        plantingYear: detailCropCycle === 'perennial' ? parsedPlantingYear : null,
        bearing: detailCropCycle === 'perennial' ? detailBearing : null,
      };
      setSelectedField(updatedField);
      setRealFields((current) => current.map((field) => String(field.id) === String(updatedField.id) ? updatedField : field));
      setProductionProfileOpen(false);
      setProductionProfileMessage('Ürün tipi güncellendi.');
      await loadProductionHistory(updatedField);
    } catch (error) {
      console.error('Ürün tipi güncellenemedi:', error);
      setProductionProfileMessage(error instanceof Error ? error.message : 'Ürün tipi güncellenemedi.');
    } finally {
      setProductionProfileLoading(false);
    }
  };

  const handleAddAnnualSeason = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedField || selectedField.demo) return;
    const year = Number(annualYear);
    const crop = annualCrop.trim();
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      setHistoryMessage('Sezon yılı geçerli değil.');
      return;
    }
    if (!crop) {
      setHistoryMessage('Sezonda yetiştirilen ürünü yaz.');
      return;
    }

    setAnnualFormLoading(true);
    setHistoryMessage('');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');
      const { error } = await supabase.from('field_seasons').insert({
        field_id: String(selectedField.id),
        user_id: user.id,
        year,
        crop,
        planting_date: annualPlantingDate || null,
        harvest_date: annualHarvestDate || null,
        notes: annualNotes.trim() || null,
      });
      if (error) throw error;
      resetAnnualForm();
      setAnnualFormOpen(false);
      await loadProductionHistory(selectedField);
    } catch (error) {
      console.error('Sezon kaydedilemedi:', error);
      setHistoryMessage(error instanceof Error ? error.message : 'Sezon kaydedilemedi.');
    } finally {
      setAnnualFormLoading(false);
    }
  };

  const handleDeleteAnnualSeason = async (id: string) => {
    if (!selectedField || selectedField.demo) return;
    if (!window.confirm('Bu sezon kaydını silmek istiyor musun?')) return;
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');
      const { error } = await supabase.from('field_seasons').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      await loadProductionHistory(selectedField);
    } catch (error) {
      setHistoryMessage(error instanceof Error ? error.message : 'Sezon silinemedi.');
    }
  };

  const handleAddPerennialYield = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedField || selectedField.demo) return;
    const year = Number(yieldYear);
    const yieldValue = yieldKg.trim() ? Number(yieldKg.replace(',', '.')) : null;
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      setHistoryMessage('Verim yılı geçerli değil.');
      return;
    }
    if (yieldValue !== null && (!Number.isFinite(yieldValue) || yieldValue < 0)) {
      setHistoryMessage('Ürün miktarı geçerli değil.');
      return;
    }

    setYieldFormLoading(true);
    setHistoryMessage('');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');

      const { data: existing, error: existingError } = await supabase
        .from('perennial_yields')
        .select('id')
        .eq('field_id', String(selectedField.id))
        .eq('user_id', user.id)
        .eq('year', year)
        .is('field_section_id', null)
        .maybeSingle();
      if (existingError) throw existingError;

      if (existing?.id) {
        const { error } = await supabase
          .from('perennial_yields')
          .update({
            yield_kg: yieldValue,
            harvest_date: yieldHarvestDate || null,
            notes: yieldNotes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('perennial_yields').insert({
          field_id: String(selectedField.id),
          user_id: user.id,
          field_section_id: null,
          year,
          yield_kg: yieldValue,
          harvest_date: yieldHarvestDate || null,
          notes: yieldNotes.trim() || null,
        });
        if (error) throw error;
      }

      resetYieldForm();
      setYieldFormOpen(false);
      await loadProductionHistory(selectedField);
    } catch (error) {
      console.error('Yıllık verim kaydedilemedi:', error);
      setHistoryMessage(error instanceof Error ? error.message : 'Yıllık verim kaydedilemedi.');
    } finally {
      setYieldFormLoading(false);
    }
  };

  const handleDeletePerennialYield = async (id: string) => {
    if (!selectedField || selectedField.demo) return;
    if (!window.confirm('Bu yıllık verim kaydını silmek istiyor musun?')) return;
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');
      const { error } = await supabase.from('perennial_yields').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      await loadProductionHistory(selectedField);
    } catch (error) {
      setHistoryMessage(error instanceof Error ? error.message : 'Verim kaydı silinemedi.');
    }
  };

  const syncProfileFromField = (field: Field) => {
    setDetailCropCycle(field.cropCycle ?? 'annual');
    setDetailPlantingYear(field.plantingYear == null ? '' : String(field.plantingYear));
    setDetailBearing(field.bearing ?? true);
  };

  const resetProductionUi = () => {
    setAnnualFormOpen(false);
    setYieldFormOpen(false);
    setHistoryMessage('');
    setProductionProfileOpen(false);
    setProductionProfileMessage('');
  };

  return {
    annualSeasons, perennialYields, historyLoading, historyMessage, setHistoryMessage,
    annualFormOpen, setAnnualFormOpen, annualFormLoading, annualYear, setAnnualYear,
    annualCrop, setAnnualCrop, annualPlantingDate, setAnnualPlantingDate,
    annualHarvestDate, setAnnualHarvestDate, annualNotes, setAnnualNotes,
    yieldFormOpen, setYieldFormOpen, yieldFormLoading, yieldYear, setYieldYear,
    yieldKg, setYieldKg, yieldHarvestDate, setYieldHarvestDate, yieldNotes, setYieldNotes,
    productionProfileOpen, setProductionProfileOpen, productionProfileLoading,
    productionProfileMessage, setProductionProfileMessage,
    detailCropCycle, setDetailCropCycle, detailPlantingYear, setDetailPlantingYear,
    detailBearing, setDetailBearing,
    resetAnnualForm, resetYieldForm, loadProductionHistory, handleSaveProductionProfile,
    handleAddAnnualSeason, handleDeleteAnnualSeason, handleAddPerennialYield,
    handleDeletePerennialYield, syncProfileFromField, resetProductionUi,
  };
}

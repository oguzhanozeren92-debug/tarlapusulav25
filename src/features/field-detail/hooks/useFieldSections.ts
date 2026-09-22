import { useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../../../supabaseClient';
import type { Field, FieldSection } from '../../../types';

type Options = { selectedField: Field | null };

export function useFieldSections({ selectedField }: Options) {
  const [fieldSections, setFieldSections] = useState<FieldSection[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionFormOpen, setSectionFormOpen] = useState(false);
  const [sectionFormLoading, setSectionFormLoading] = useState(false);
  const [sectionFormMessage, setSectionFormMessage] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [sectionCrop, setSectionCrop] = useState('');
  const [sectionArea, setSectionArea] = useState('');

  const resetSectionForm = () => {
    setSectionName('');
    setSectionCrop('');
    setSectionArea('');
    setSectionFormMessage('');
  };

  const resetSectionsUi = () => {
    setSectionFormOpen(false);
    setSectionFormMessage('');
  };

  const loadFieldSections = async (field: Field) => {
    if (field.demo) {
      setFieldSections([]);
      return;
    }
    setSectionsLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setFieldSections([]);
        return;
      }
      const { data, error } = await supabase
        .from('field_sections')
        .select('id, field_id, name, crop, area_decare')
        .eq('field_id', String(field.id))
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setFieldSections((data ?? []).map((item) => ({
        id: String(item.id),
        fieldId: String(item.field_id),
        name: item.name?.trim() || 'İsimsiz bölüm',
        crop: item.crop?.trim() || 'Ürün belirtilmedi',
        area: item.area_decare == null ? null : Number(item.area_decare),
      })));
    } catch (error) {
      console.error('Tarla bölümleri yüklenemedi:', error);
      setSectionFormMessage(error instanceof Error ? error.message : 'Tarla bölümleri yüklenemedi.');
    } finally {
      setSectionsLoading(false);
    }
  };

  const handleAddFieldSection = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedField || selectedField.demo) {
      setSectionFormMessage('Bu işlem gerçek bir tarla kaydı gerektirir.');
      return;
    }
    const cleanName = sectionName.trim();
    const cleanCrop = sectionCrop.trim();
    const parsedArea = sectionArea.trim() ? Number(sectionArea.replace(',', '.')) : null;
    if (!cleanName || !cleanCrop) {
      setSectionFormMessage('Bölüm adı ve ürün bilgisini doldur.');
      return;
    }
    if (parsedArea !== null && (!Number.isFinite(parsedArea) || parsedArea <= 0)) {
      setSectionFormMessage('Bölüm alanı geçerli bir sayı olmalı.');
      return;
    }
    const otherSectionsArea = fieldSections.reduce((total, item) => total + (item.area ?? 0), 0);
    if (parsedArea !== null && otherSectionsArea + parsedArea > selectedField.area + 0.0001) {
      setSectionFormMessage(`Bölümlerin toplam alanı tarla alanını (${selectedField.area.toLocaleString('tr-TR')} da) geçemez.`);
      return;
    }

    setSectionFormLoading(true);
    setSectionFormMessage('');
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');
      const { error } = await supabase.from('field_sections').insert({
        field_id: String(selectedField.id),
        user_id: user.id,
        name: cleanName,
        crop: cleanCrop,
        area_decare: parsedArea,
      });
      if (error) throw error;
      resetSectionForm();
      setSectionFormOpen(false);
      await loadFieldSections(selectedField);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tarla bölümü kaydedilemedi.';
      console.error('Tarla bölümü kayıt hatası:', error);
      setSectionFormMessage(message);
    } finally {
      setSectionFormLoading(false);
    }
  };

  const handleDeleteFieldSection = async (sectionId: string) => {
    if (!selectedField || selectedField.demo) return;
    if (!window.confirm('Bu tarla bölümünü silmek istiyor musun?')) return;
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Oturum bulunamadı.');
      const { error } = await supabase.from('field_sections').delete().eq('id', sectionId).eq('user_id', user.id);
      if (error) throw error;
      await loadFieldSections(selectedField);
    } catch (error) {
      console.error('Tarla bölümü silinemedi:', error);
      setSectionFormMessage(error instanceof Error ? error.message : 'Tarla bölümü silinemedi.');
    }
  };

  return {
    fieldSections, sectionsLoading, sectionFormOpen, setSectionFormOpen,
    sectionFormLoading, sectionFormMessage, setSectionFormMessage,
    sectionName, setSectionName, sectionCrop, setSectionCrop, sectionArea, setSectionArea,
    resetSectionForm, resetSectionsUi, loadFieldSections, handleAddFieldSection, handleDeleteFieldSection,
  };
}

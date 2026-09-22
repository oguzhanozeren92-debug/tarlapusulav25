import { useEffect, useRef, useState } from 'react';

import { supabase } from '../../../supabaseClient';
import type { HomeSystemNotification } from '../../decision/types/homeDecision';
import type { PhenologyResult } from '../../phenology/types/phenology';

type Input = {
  fieldId: string;
  fieldName: string;
  phenology: PhenologyResult | null;
  enabled: boolean;
};

function sourceForPhenology(phenology: PhenologyResult) {
  const evidence = (phenology.basis ?? [])
    .map((item) => String(item ?? '').toLocaleLowerCase('tr-TR'))
    .join(' ');

  if (evidence.includes('nasa harvest')) return 'nasa-harvest-crop-stage';
  if (evidence.includes('hr-vpp') || evidence.includes('copernicus')) {
    return 'phenology-fusion';
  }
  return 'phenology-engine';
}

export function usePhenologyStageChangeNotification({
  fieldId,
  fieldName,
  phenology,
  enabled,
}: Input): HomeSystemNotification | null {
  const [notification, setNotification] =
    useState<HomeSystemNotification | null>(null);
  const signatureRef = useRef('');

  useEffect(() => {
    const stage = String(phenology?.stage ?? '').trim();
    const confidence = String(phenology?.confidence ?? '').trim();
    const usable = phenology?.dataStatus === 'usable';

    if (
      !enabled ||
      !fieldId ||
      !usable ||
      !stage ||
      stage === 'unknown' ||
      confidence === 'low'
    ) {
      signatureRef.current = '';
      setNotification(null);
      return;
    }

    const signature = `${fieldId}:${stage}:${confidence}`;
    if (signatureRef.current === signature) return;
    signatureRef.current = signature;

    let cancelled = false;

    void supabase
      .rpc('tp_sync_phenology_stage_notification', {
        p_field_id: fieldId,
        p_stage: stage,
        p_confidence: confidence,
        p_source: sourceForPhenology(phenology),
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) throw error;

        const result =
          data && typeof data === 'object' && !Array.isArray(data)
            ? (data as Record<string, unknown>)
            : {};

        if (result.changed !== true) {
          setNotification(null);
          return;
        }

        const id = String(
          result.notification_id ??
            `phenology:${fieldId}:${result.previous_stage ?? 'previous'}:${stage}`,
        );
        const title = String(
          result.notification_title ??
            `${fieldName || 'Tarlan'} gelişim dönemi değişti`,
        );
        const detail = String(
          result.notification_message ??
            `${result.previous_stage_label ?? 'Önceki dönem'} → ${
              result.current_stage_label ?? phenology.stageLabel
            }`,
        );

        setNotification({
          id: `phenology-stage-change:${id}`,
          priority: 82,
          severity: 'info',
          source: 'phenology',
          title,
          detail,
          iconKey: 'leaf',
          iconTone: 'green',
          dotTone: 'info',
          target: 'field_growth',
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        signatureRef.current = '';
        console.warn(
          '[phenology-notification] Gelişim dönemi bildirimi senkronize edilemedi:',
          error,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    fieldId,
    fieldName,
    phenology?.stage,
    phenology?.stageLabel,
    phenology?.confidence,
    phenology?.dataStatus,
    phenology?.basis,
  ]);

  return notification;
}

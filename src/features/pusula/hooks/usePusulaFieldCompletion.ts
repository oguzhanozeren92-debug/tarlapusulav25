import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  loadFieldCompletionContext,
  saveFieldCanopyDevelopmentClass,
  saveFieldCanopyHeightClass,
  saveFieldIrrigationStatus,
  type FieldCompletionContext,
  type FieldIrrigationStatusValue,
} from '../../fields/services/fieldCompletion.service';

import {
  loadFieldIrrigationMethod,
  saveFieldIrrigationMethod,
  type FieldIrrigationMethod,
} from '../../fields/services/irrigationMethod.service';

import {
  CANOPY_DEVELOPMENT_OPTIONS,
  CANOPY_HEIGHT_OPTIONS,
  estimateCanopyDevelopmentFromAge,
  isTreeOrchardCanopyCrop,
} from '../../fields/data/canopyDevelopmentProfiles';

export type PusulaFieldQuestionOption = {
  value: string;
  label: string;
  hint?: string;
  recommended?: boolean;
};

export type PusulaFieldAnswer =
  | FieldIrrigationStatusValue
  | FieldIrrigationMethod
  | string
  | number;

export type PusulaFieldQuestionTarget =
  | 'irrigation-status'
  | 'irrigation-method'
  | 'canopy-development'
  | 'canopy-height'
  | null;

export type PusulaFieldQuestion =
  | {
      id: string;
      kind: 'choice';
      prompt: string;
      helper?: string;
      options: PusulaFieldQuestionOption[];
    }
  | {
      id: string;
      kind: 'number';
      prompt: string;
      helper?: string;
      unit: string;
      min: number;
      max: number;
      step: number;
      placeholder?: string;
    };

type UsePusulaFieldCompletionInput = {
  field: any | null | undefined;
  fields?: any[] | null;
  preferredQuestion?: PusulaFieldQuestionTarget;
};

type ContextState = {
  fieldId: string;
  checked: boolean;
  loading: boolean;
  data: FieldCompletionContext | null;
  error: string | null;
};

type IrrigationMethodState = {
  fieldId: string;
  checked: boolean;
  loading: boolean;
  value: FieldIrrigationMethod | null;
  error: string | null;
};

const EMPTY_CONTEXT_STATE: ContextState = {
  fieldId: '',
  checked: false,
  loading: false,
  data: null,
  error: null,
};

const EMPTY_IRRIGATION_METHOD_STATE: IrrigationMethodState = {
  fieldId: '',
  checked: false,
  loading: false,
  value: null,
  error: null,
};

const IRRIGATION_METHODS = new Set<FieldIrrigationMethod>([
  'sprinkler',
  'basin',
  'border',
  'furrow_every_narrow',
  'furrow_every_wide',
  'furrow_alternating',
  'trickle',
  'unknown',
]);

function textOrNull(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

export function usePusulaFieldCompletion({
  field,
  fields,
  preferredQuestion = null,
}: UsePusulaFieldCompletionInput) {
  const fieldId = textOrNull(field?.id) ?? '';
  const [reloadKey, setReloadKey] = useState(0);
  const [contextState, setContextState] =
    useState<ContextState>(EMPTY_CONTEXT_STATE);
  const [irrigationMethodState, setIrrigationMethodState] =
    useState<IrrigationMethodState>(EMPTY_IRRIGATION_METHOD_STATE);

  const rawField = useMemo(() => {
    if (!fieldId || !Array.isArray(fields)) return null;
    return fields.find((item) => String(item?.id ?? '') === fieldId) ?? null;
  }, [fieldId, fields]);

  useEffect(() => {
    let cancelled = false;

    if (!fieldId || field?.demo) {
      setContextState({
        fieldId,
        checked: true,
        loading: false,
        data: null,
        error: null,
      });
      return () => {
        cancelled = true;
      };
    }

    setContextState({
      fieldId,
      checked: false,
      loading: true,
      data: null,
      error: null,
    });

    void loadFieldCompletionContext(fieldId)
      .then((data) => {
        if (cancelled) return;
        setContextState({
          fieldId,
          checked: true,
          loading: false,
          data,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setContextState({
          fieldId,
          checked: true,
          loading: false,
          data: null,
          error:
            error instanceof Error
              ? error.message
              : 'Tarla bilgileri kontrol edilemedi.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [fieldId, field?.demo, reloadKey]);

  useEffect(() => {
    let cancelled = false;

    if (!fieldId || field?.demo) {
      setIrrigationMethodState({
        fieldId,
        checked: true,
        loading: false,
        value: null,
        error: null,
      });
      return () => {
        cancelled = true;
      };
    }

    setIrrigationMethodState({
      fieldId,
      checked: false,
      loading: true,
      value: null,
      error: null,
    });

    void loadFieldIrrigationMethod(fieldId)
      .then((value) => {
        if (cancelled) return;
        setIrrigationMethodState({
          fieldId,
          checked: true,
          loading: false,
          value,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setIrrigationMethodState({
          fieldId,
          checked: true,
          loading: false,
          value: null,
          error:
            error instanceof Error
              ? error.message
              : 'Sulama yöntemi kontrol edilemedi.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [fieldId, field?.demo, reloadKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !fieldId) return;

    const handleFieldContextUpdated = (event: Event) => {
      const detail = (event as CustomEvent)?.detail ?? {};
      if (String(detail?.fieldId ?? '') !== fieldId) return;

      const changedFields = Array.isArray(detail?.changedFields)
        ? detail.changedFields.map((item: unknown) => String(item))
        : [];

      if (
        changedFields.some((name: string) =>
          [
            'irrigation_status',
            'irrigation_method',
            'canopy_development_class',
            'canopy_height_class',
            'canopy_cover_percent',
            'canopy_height_m',
            'bearing',
            'crop_cycle',
            'planting_year',
            'crop',
          ].includes(name),
        )
      ) {
        setReloadKey((value) => value + 1);
      }
    };

    window.addEventListener(
      'tp:field-context-updated',
      handleFieldContextUpdated as EventListener,
    );

    return () => {
      window.removeEventListener(
        'tp:field-context-updated',
        handleFieldContextUpdated as EventListener,
      );
    };
  }, [fieldId]);

  const context =
    contextState.fieldId === fieldId
      ? contextState.data
      : null;

  const irrigationMethod =
    irrigationMethodState.fieldId === fieldId
      ? irrigationMethodState.value
      : null;

  const fieldName =
    textOrNull(field?.name) ??
    textOrNull(rawField?.name) ??
    'Bu tarla';

  const ageSuggestion = useMemo(
    () =>
      context
        ? estimateCanopyDevelopmentFromAge({
            cropName: context.cropName,
            plantingYear: context.plantingYear,
          })
        : null,
    [context?.cropName, context?.plantingYear],
  );

  const question = useMemo<PusulaFieldQuestion | null>(() => {
    if (
      !fieldId ||
      field?.demo ||
      contextState.fieldId !== fieldId ||
      !contextState.checked ||
      contextState.loading ||
      !context ||
      irrigationMethodState.fieldId !== fieldId ||
      !irrigationMethodState.checked ||
      irrigationMethodState.loading
    ) {
      return null;
    }

    const irrigationQuestion = (): PusulaFieldQuestion => ({
      id: `field:${fieldId}:irrigation-status`,
      kind: 'choice',
      prompt: `${fieldName} nasıl sulanıyor?`,
      helper:
        'Bunu bilirsem su stresi ve sulama yorumlarını doğru yapabilirim.',
      options: [
        { value: 'sulu', label: 'Sulu' },
        { value: 'susuz', label: 'Susuz' },
        { value: 'kısmi', label: 'Kısmi / İhtiyaca göre' },
      ],
    });

    const irrigationMethodQuestion = (): PusulaFieldQuestion => ({
      id: `field:${fieldId}:irrigation-method`,
      kind: 'choice',
      prompt: `${fieldName} için hangi sulama yöntemi kullanılıyor?`,
      helper:
        'Yalnız yöntemi seç. Islanan yüzey oranını tek sayı uydurmak yerine FAO-56 referans aralığıyla modelleyeceğim.',
      options: [
        { value: 'trickle', label: 'Damlama' },
        { value: 'sprinkler', label: 'Yağmurlama' },
        { value: 'basin', label: 'Tava / göllendirme' },
        { value: 'border', label: 'Şerit / salma' },
        { value: 'furrow_every_narrow', label: 'Karık · her karık, dar yatak' },
        { value: 'furrow_every_wide', label: 'Karık · her karık, geniş yatak' },
        { value: 'furrow_alternating', label: 'Karık · dönüşümlü karık' },
        { value: 'unknown', label: 'Bilmiyorum / emin değilim' },
      ],
    });

    const needsIrrigationMethod =
      context.irrigationStatus === 'irrigated' ||
      context.irrigationStatus === 'partial';

    const isOrchardCanopyCrop = isTreeOrchardCanopyCrop(context.cropName);
    const needsYoungOrchardCanopy =
      context.bearing === false && isOrchardCanopyCrop;

    const canopyDevelopmentQuestion = (): PusulaFieldQuestion => {
      const ageLead = ageSuggestion
        ? `${fieldName} ${ageSuggestion.plantingYear}'de dikilmiş; yaklaşık ${ageSuggestion.age} yaşında. Yaşına ve ürününe bakınca “${ageSuggestion.suggestedLabel}” bana başlangıç için en yakın seçenek gibi geliyor.`
        : context.bearing === false
          ? `${fieldName} genç / ürün vermeyen bahçe olarak kayıtlı.`
          : `${fieldName} için taç gelişimi henüz kayıtlı değil.`;

      return {
        id: `field:${fieldId}:canopy-development`,
        kind: 'choice',
        prompt:
          `${ageLead} Ağaçların taç gelişimi gerçekte hangisine daha yakın?`,
        helper:
          'Ağacın dallı-yapraklı üst kısmını düşün. Kesin ölçüm gerekmiyor; senin saha gözlemin model tahmininden üstündür.',
        options: CANOPY_DEVELOPMENT_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
          recommended:
            ageSuggestion?.suggestedDevelopment === option.value,
          hint:
            ageSuggestion?.suggestedDevelopment === option.value
              ? 'Dikim yılına göre Pusula tahmini'
              : undefined,
        })),
      };
    };

    const canopyHeightQuestion = (): PusulaFieldQuestion => ({
      id: `field:${fieldId}:canopy-height-class`,
      kind: 'choice',
      prompt:
        `${fieldName} için ağaçların ortalama boyu hangisine daha yakın?`,
      helper:
        'Kesin ölçüm gerekmiyor. Bahçenin genelindeki ortalama ağacı düşün.',
      options: CANOPY_HEIGHT_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    });

    /* Görevden gelindiyse yalnız o gerçek eksik alanı aç. */
    if (preferredQuestion === 'irrigation-status') {
      return !context.irrigationStatus
        ? irrigationQuestion()
        : null;
    }

    if (preferredQuestion === 'irrigation-method') {
      return needsIrrigationMethod && irrigationMethod === null
        ? irrigationMethodQuestion()
        : null;
    }

    if (preferredQuestion === 'canopy-development') {
      return (
        isOrchardCanopyCrop &&
        context.canopyDevelopmentClass === null &&
        context.canopyCoverPercent === null
      )
        ? canopyDevelopmentQuestion()
        : null;
    }

    if (preferredQuestion === 'canopy-height') {
      return (
        isOrchardCanopyCrop &&
        context.canopyHeightClass === null &&
        context.canopyHeightM === null
      )
        ? canopyHeightQuestion()
        : null;
    }

    /* Normal Pusula akışı sakin kalır; mature canopy soruları yalnız görevden açılır. */
    if (!context.irrigationStatus) {
      return irrigationQuestion();
    }

    if (needsIrrigationMethod && irrigationMethod === null) {
      return irrigationMethodQuestion();
    }

    if (!needsYoungOrchardCanopy) {
      return null;
    }

    if (
      context.canopyDevelopmentClass === null &&
      context.canopyCoverPercent === null
    ) {
      return canopyDevelopmentQuestion();
    }

    if (
      context.canopyHeightClass === null &&
      context.canopyHeightM === null
    ) {
      return canopyHeightQuestion();
    }

    return null;
  }, [
    fieldId,
    field?.demo,
    fieldName,
    context,
    contextState.fieldId,
    contextState.checked,
    contextState.loading,
    irrigationMethod,
    irrigationMethodState.fieldId,
    irrigationMethodState.checked,
    irrigationMethodState.loading,
    ageSuggestion,
    preferredQuestion,
  ]);

  const answerQuestion = useCallback(
    async (value: PusulaFieldAnswer) => {
      if (!fieldId || !question) {
        throw new Error('Tarla sorusu artık geçerli değil.');
      }

      if (question.id.endsWith(':irrigation-status')) {
        if (
          value !== 'sulu' &&
          value !== 'susuz' &&
          value !== 'kısmi'
        ) {
          throw new Error('Geçerli bir sulama durumu seç.');
        }

        await saveFieldIrrigationStatus({
          fieldId,
          irrigationStatus: value,
        });
        return;
      }

      if (question.id.endsWith(':irrigation-method')) {
        if (
          typeof value !== 'string' ||
          !IRRIGATION_METHODS.has(value as FieldIrrigationMethod)
        ) {
          throw new Error('Geçerli bir sulama yöntemi seç.');
        }

        await saveFieldIrrigationMethod({
          fieldId,
          irrigationMethod: value as FieldIrrigationMethod,
        });
        setIrrigationMethodState((current) => ({
          ...current,
          fieldId,
          checked: true,
          loading: false,
          value: value as FieldIrrigationMethod,
          error: null,
        }));
        return;
      }

      if (question.id.endsWith(':canopy-development')) {
        if (typeof value !== 'string') {
          throw new Error('Geçerli bir taç gelişimi seç.');
        }

        await saveFieldCanopyDevelopmentClass({
          fieldId,
          canopyDevelopmentClass:
            value as
              | 'very_small'
              | 'small'
              | 'medium'
              | 'large'
              | 'very_large',
        });
        return;
      }

      if (question.id.endsWith(':canopy-height-class')) {
        if (typeof value !== 'string') {
          throw new Error('Geçerli bir ağaç boyu seç.');
        }

        await saveFieldCanopyHeightClass({
          fieldId,
          canopyHeightClass:
            value as
              | 'under_1m'
              | '1_2m'
              | '2_3m'
              | '3_5m'
              | 'over_5m',
        });
        return;
      }

      throw new Error('Bu soru tipi henüz desteklenmiyor.');
    },
    [fieldId, question],
  );

  return {
    question,
    answerQuestion,
    irrigationStatus: context?.irrigationStatus ?? null,
    irrigationMethod,
    fieldCompletionContext: context,
    ageSuggestion,
    checking:
      (contextState.fieldId === fieldId && contextState.loading) ||
      (irrigationMethodState.fieldId === fieldId && irrigationMethodState.loading),
    checkError:
      contextState.fieldId === fieldId && contextState.error
        ? contextState.error
        : irrigationMethodState.fieldId === fieldId
          ? irrigationMethodState.error
          : null,
  };
}

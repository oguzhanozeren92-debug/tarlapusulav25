export type PusulaSourceValue =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

export type PusulaContextSource = {
  key: string;
  getContext: () =>
    | PusulaSourceValue
    | Promise<PusulaSourceValue>;
};

export type PusulaFocusContext = {
  module: string;
  screen: string;
  title?: string;
  data?: Record<string, unknown>;
};

export type PusulaFieldContext = {
  id?: string | null;
  name?: string | null;
  crop?: string | null;
  city?: string | null;
  district?: string | null;
};

export type CollectedPusulaContext = {
  focus: PusulaFocusContext;

  field?: PusulaFieldContext | null;

  supportingContext: Record<
    string,
    PusulaSourceValue
  >;

  collectedAt: string;
};

const sourceRegistry = new Map<
  string,
  PusulaContextSource
>();

export function registerPusulaSource(
  source: PusulaContextSource,
) {
  const key = String(
    source?.key ?? '',
  ).trim();

  if (!key) {
    throw new Error(
      'Pusula veri kaynağının key değeri gerekli.',
    );
  }

  sourceRegistry.set(key, {
    ...source,
    key,
  });

  return () => {
    sourceRegistry.delete(key);
  };
}

export function unregisterPusulaSource(
  key: string,
) {
  sourceRegistry.delete(
    String(key ?? '').trim(),
  );
}

export function clearPusulaSources() {
  sourceRegistry.clear();
}

export function getRegisteredPusulaSources() {
  return Array.from(
    sourceRegistry.keys(),
  );
}

/**
 * Aktif ekran her zaman focus olur.
 *
 * Registry'deki diğer kaynaklar yalnızca supportingContext
 * olarak gönderilir.
 *
 * Böylece Pusula:
 * - bulunduğu ekranın konusundan kopmaz,
 * - ama gerektiğinde diğer modüllerin verilerinden yararlanabilir.
 */
export async function collectPusulaContext({
  focus,
  field,
  extraSources,
}: {
  focus: PusulaFocusContext;

  field?: PusulaFieldContext | null;

  extraSources?: Record<
    string,
    PusulaSourceValue
  >;
}): Promise<CollectedPusulaContext> {
  const supportingContext: Record<
    string,
    PusulaSourceValue
  > = {
    ...(extraSources ?? {}),
  };

  for (
    const source
    of sourceRegistry.values()
  ) {
    /*
     * Aktif ekranın kendi veri kaynağını tekrar
     * supportingContext içine koymaya gerek yok.
     *
     * Örn:
     * focus.module === "market"
     * ise registry'deki "market" ayrıca destek verisi yapılmaz.
     */
    if (
      source.key === focus.module
    ) {
      continue;
    }

    try {
      const value =
        await source.getContext();

      if (
        value !== undefined &&
        value !== null
      ) {
        supportingContext[
          source.key
        ] = value;
      }
    } catch (error) {
      console.warn(
        `Pusula veri kaynağı okunamadı: ${source.key}`,
        error,
      );
    }
  }

  return {
    focus,
    field:
      field ?? null,

    supportingContext,

    collectedAt:
      new Date().toISOString(),
  };
}
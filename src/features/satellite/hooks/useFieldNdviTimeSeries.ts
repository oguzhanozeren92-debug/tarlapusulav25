import {
  useCallback,
  useRef,
  useState,
} from 'react';

import {
  fetchFieldNdviTimeSeries,
} from '../services/ndviTimeSeries.service';

import type {
  NdviTimeSeriesResult,
} from '../types/ndviTimeSeries';

import type {
  Field,
} from '../../../types';

export type NdviTimeSeriesState = {
  status:
    | 'idle'
    | 'loading'
    | 'ready'
    | 'error';
  data?: NdviTimeSeriesResult;
  message?: string;
};

export function useFieldNdviTimeSeries() {
  const [
    stateByField,
    setStateByField,
  ] =
    useState<
      Record<
        string,
        NdviTimeSeriesState
      >
    >({});

  const stateRef =
    useRef<
      Record<
        string,
        NdviTimeSeriesState
      >
    >({});

  const inFlightRef =
    useRef<
      Map<
        string,
        Promise<NdviTimeSeriesResult>
      >
    >(new Map());

  const commitFieldState =
    useCallback(
      (
        key: string,
        next:
          | NdviTimeSeriesState
          | ((
              current:
                | NdviTimeSeriesState
                | undefined,
            ) => NdviTimeSeriesState),
      ) => {
        setStateByField(
          (previous) => {
            const current =
              previous[key];

            const resolved =
              typeof next ===
              'function'
                ? next(current)
                : next;

            const merged = {
              ...previous,
              [key]: resolved,
            };

            stateRef.current =
              merged;

            return merged;
          },
        );
      },
      [],
    );

  const load =
    useCallback(
      async (
        field: Field,
        options?: {
          force?: boolean;
          daysBack?: number;
          maxCloudCoverage?: number;
        },
      ) => {
        if (
          field?.id ===
          null ||
          field?.id ===
          undefined
        ) {
          throw new Error(
            'NDVI zaman serisi için tarla kimliği bulunamadı.',
          );
        }

        if (
          !field?.parcelGeometry
        ) {
          throw new Error(
            'NDVI zaman serisi için parsel geometrisi bulunamadı.',
          );
        }

        const key =
          String(field.id);

        const current =
          stateRef.current[
            key
          ];

        if (
          !options?.force &&
          current?.status ===
            'ready'
        ) {
          return (
            current.data ??
            null
          );
        }

        const existing =
          inFlightRef.current.get(
            key,
          );

        if (
          !options?.force &&
          existing
        ) {
          return existing;
        }

        commitFieldState(
          key,
          (previous) => ({
            status:
              'loading',
            data:
              previous?.data,
            message:
              undefined,
          }),
        );

        const request =
          fetchFieldNdviTimeSeries(
            field.parcelGeometry,
            {
              daysBack:
                options?.daysBack ??
                90,
              maxCloudCoverage:
                options?.maxCloudCoverage,
            },
          );

        inFlightRef.current.set(
          key,
          request,
        );

        try {
          const data =
            await request;

          commitFieldState(
            key,
            {
              status:
                'ready',
              data,
              message:
                data.message,
            },
          );

          return data;
        } catch (error) {
          const message =
            error instanceof
            Error
              ? error.message
              : 'NDVI zaman serisi alınamadı.';

          commitFieldState(
            key,
            (previous) => ({
              status:
                'error',
              data:
                previous?.data,
              message,
            }),
          );

          throw error;
        } finally {
          if (
            inFlightRef.current.get(
              key,
            ) === request
          ) {
            inFlightRef.current.delete(
              key,
            );
          }
        }
      },
      [commitFieldState],
    );

  const clear =
    useCallback(
      (
        fieldId?:
          | string
          | number,
      ) => {
        if (
          fieldId ===
          undefined
        ) {
          stateRef.current =
            {};

          inFlightRef.current.clear();

          setStateByField(
            {},
          );

          return;
        }

        const key =
          String(fieldId);

        inFlightRef.current.delete(
          key,
        );

        setStateByField(
          (previous) => {
            const next = {
              ...previous,
            };

            delete next[key];

            stateRef.current =
              next;

            return next;
          },
        );
      },
      [],
    );

  return {
    stateByField,
    load,
    clear,
  };
}

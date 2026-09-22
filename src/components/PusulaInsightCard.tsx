import {
  useState,
} from 'react';

import {
  savePusulaFeedback,
  type PusulaFeedbackReason,
  type PusulaInsight,
} from '../services/pusulaIntelligence';

import './PusulaInsightCard.css';

type Props = {
  insight:
    | PusulaInsight
    | null;

  loading?: boolean;
};

const dislikeReasons: Array<{
  key: PusulaFeedbackReason;
  label: string;
}> = [
  {
    key: 'irrelevant',
    label: 'İlgisiz',
  },
  {
    key: 'already_known',
    label: 'Zaten biliyorum',
  },
  {
    key: 'wrong_or_incomplete',
    label: 'Yanlış / eksik',
  },
  {
    key: 'too_general',
    label: 'Çok genel',
  },
];

export default function PusulaInsightCard({
  insight,
  loading = false,
}: Props) {
  const [
    feedback,
    setFeedback,
  ] =
    useState<
      boolean | null
    >(null);

  const [
    showReasons,
    setShowReasons,
  ] =
    useState(false);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const sendFeedback =
    async (
      liked: boolean,
      reason:
        | PusulaFeedbackReason
        | null = null,
    ) => {
      if (
        !insight?.id ||
        saving
      ) {
        return;
      }

      setSaving(true);

      try {
        await savePusulaFeedback({
          insightId:
            insight.id,
          liked,
          reason,
        });

        setFeedback(
          liked,
        );

        if (liked) {
          setShowReasons(
            false,
          );
        }
      } catch (
        error
      ) {
        console.error(
          'Pusula geri bildirimi kaydedilemedi:',
          error,
        );
      } finally {
        setSaving(false);
      }
    };

  if (loading) {
    return (
      <section className="tp-pusula-insight-card loading">
        <div className="tp-pusula-insight-eyebrow">
          PUSULA’DAN SANA
        </div>

        <div className="tp-pusula-insight-skeleton wide" />
        <div className="tp-pusula-insight-skeleton" />
      </section>
    );
  }

  if (!insight) {
    return null;
  }

  return (
    <section className="tp-pusula-insight-card">
      <div className="tp-pusula-insight-eyebrow">
        PUSULA’DAN SANA
      </div>

      <h3>
        {insight.headline}
      </h3>

      <p className="tp-pusula-insight-summary">
        {insight.summary}
      </p>

      {insight.reasons.length >
        0 && (
        <details className="tp-pusula-insight-reasons">
          <summary>
            Neden bunu
            öneriyorum?
          </summary>

          <ul>
            {insight.reasons.map(
              (
                reason,
                index,
              ) => (
                <li
                  key={`${reason}-${index}`}
                >
                  {reason}
                </li>
              ),
            )}
          </ul>
        </details>
      )}

      {insight.dataWarning && (
        <div className="tp-pusula-insight-warning">
          {insight.dataWarning}
        </div>
      )}

      <footer className="tp-pusula-insight-footer">
        <span>
          Bu öneri faydalı mı?
        </span>

        <div className="tp-pusula-insight-feedback">
          <button
            type="button"
            disabled={saving}
            className={
              feedback === true
                ? 'active'
                : ''
            }
            onClick={() =>
              void sendFeedback(
                true,
              )
            }
            aria-label="Faydalı"
          >
            👍
          </button>

          <button
            type="button"
            disabled={saving}
            className={
              feedback === false
                ? 'active'
                : ''
            }
            onClick={() => {
              setFeedback(
                false,
              );

              setShowReasons(
                true,
              );

              void sendFeedback(
                false,
              );
            }}
            aria-label="Faydalı değil"
          >
            👎
          </button>
        </div>
      </footer>

      {showReasons &&
        feedback === false && (
          <div className="tp-pusula-dislike-reasons">
            <span>
              İstersen nedenini
              seç:
            </span>

            <div>
              {dislikeReasons.map(
                (
                  item,
                ) => (
                  <button
                    key={
                      item.key
                    }
                    type="button"
                    disabled={
                      saving
                    }
                    onClick={() => {
                      void sendFeedback(
                        false,
                        item.key,
                      );

                      setShowReasons(
                        false,
                      );
                    }}
                  >
                    {
                      item.label
                    }
                  </button>
                ),
              )}
            </div>
          </div>
        )}
    </section>
  );
}
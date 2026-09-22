import { PUSULA_SANA_BG_SRC } from '../../home/homeAssets';
import { titleCaseEachWordTr } from '../../home/homeFormatters';
import type { PhenologyResult } from '../../phenology/types/phenology';

type FarmerGuide = {
  what: string;
  agriculturalUse: string;
  interpretation: string;
  compareWith: string;
  caution: string;
  source: string;
};

type Props = {
  layerLabel: string;
  fieldName: string;
  loading: boolean;
  loadingDots: string;
  headline: string;
  summary: string;
  result: any;
  error: string | null;
  guide: FarmerGuide;
  phenology?: PhenologyResult | null;
  phenologyTimeSeriesStatus?: 'idle' | 'loading' | 'ready' | 'error';
  onRefresh: () => void;
};

export default function PusulaForYouCard({
  layerLabel,
  fieldName,
  loading,
  loadingDots,
  headline,
  summary,
  result,
  error,
  guide,
  phenology,
  phenologyTimeSeriesStatus = 'idle',
  onRefresh,
}: Props) {
  return (
    <section className="tp-ai-card">
      <img
        src={`${PUSULA_SANA_BG_SRC}?v=20260907-2`}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{
          position: 'absolute',
          top: 0,
          right: '-7%',
          bottom: 0,
          width: '66%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'right center',
          zIndex: 0,
          opacity: 0.28,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
        onError={(event) => {
          console.warn(
            '[PusulaForYouCard] Pusuladan Sana arka planı yüklenemedi:',
            event.currentTarget.src,
          );
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          background:
            'linear-gradient(90deg, rgba(3,8,5,.99) 0%, rgba(3,8,5,.96) 30%, rgba(3,8,5,.79) 50%, rgba(3,8,5,.43) 70%, rgba(3,8,5,.10) 100%)',
        }}
      />

      <div className="tp-ai-top">
        <div>
          <div className="tp-ai-kicker">✦ PUSULA'DAN SANA · {layerLabel}</div>
          <p style={{ marginTop: 3, fontSize: 10 }}>
            Aktif Tarla · {titleCaseEachWordTr(fieldName || 'Tarlan')}
          </p>
        </div>
      </div>

      <div className="tp-ai-section-label">Senin Tarlada</div>
      <h1>
        {titleCaseEachWordTr(
          loading ? `${layerLabel} haritası okunuyor${loadingDots}` : headline,
        )}
      </h1>
      <p>
        {titleCaseEachWordTr(
          loading
            ? 'Pusula yalnızca açık olan harita katmanını okuyup bu katmana ait bilgiyi hazırlıyor.'
            : summary,
        )}
      </p>
      {phenology && (
        <div
          style={{
            marginTop: 10,
            padding: '9px 10px',
            borderRadius: 12,
            border: '1px solid rgba(116,201,139,.18)',
            background: 'rgba(7,19,12,.56)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: '.08em',
                color: '#b8c9b9',
                textTransform: 'uppercase',
              }}
            >
              Gelişim Evresi
            </span>

            {phenology.progressPercent != null && (
              <strong style={{ fontSize: 10, color: '#dfeadf' }}>
                %{phenology.progressPercent}
              </strong>
            )}
          </div>

          <strong
            style={{
              display: 'block',
              marginTop: 4,
              fontSize: 12,
              color: '#eef5eb',
            }}
          >
            {titleCaseEachWordTr(phenology.stageLabel)}
          </strong>

          <div
            style={{
              marginTop: 4,
              fontSize: 10,
              lineHeight: 1.45,
              color: '#aebcaf',
            }}
          >
            {phenology.summary}
          </div>

          {phenologyTimeSeriesStatus === 'loading' && (
            <div style={{ marginTop: 5, fontSize: 9, color: '#7f9f87' }}>
              NDVI geçmişi de kontrol ediliyor…
            </div>
          )}

          {phenology.warnings?.[0] && (
            <div
              style={{
                marginTop: 6,
                fontSize: 9,
                lineHeight: 1.4,
                color: '#d8b985',
              }}
            >
              {phenology.warnings[0]}
            </div>
          )}
        </div>
      )}

      <button className="tp-ai-open" onClick={onRefresh} disabled={loading}>
        {titleCaseEachWordTr(
          loading
            ? `${layerLabel} okunuyor${loadingDots}`
            : '↻ Haritayı Yeniden Yorumla',
        )}
      </button>

      {result?.analysis && (
        <div
          style={{
            marginTop: 9,
            padding: '9px 10px',
            borderRadius: 12,
            border: '1px solid rgba(116,201,139,.22)',
            background: 'rgba(7,19,12,.68)',
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: '.08em',
              color: '#cdb26d',
              textTransform: 'uppercase',
            }}
          >
            NE YAPMALISIN?
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              lineHeight: 1.4,
              color: '#e9f3e8',
            }}
          >
            {titleCaseEachWordTr(result.analysis.action)}
          </div>

          {result.analysis.importantArea && (
            <div
              style={{
                marginTop: 7,
                padding: '6px 8px',
                borderRadius: 9,
                border: '1px solid rgba(205,178,109,.18)',
                background: 'rgba(18,32,22,.78)',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: '.08em',
                  color: '#cdb26d',
                  textTransform: 'uppercase',
                }}
              >
                ÖNCELİKLİ BÖLGE
              </div>
              <strong
                style={{
                  display: 'block',
                  marginTop: 0,
                  fontSize: 11,
                  color: '#eef5eb',
                  textTransform: 'capitalize',
                }}
              >
                {result.analysis.importantArea.area}
              </strong>
            </div>
          )}

          <div className="tp-ai-compare">
            <strong>Birlikte Kontrol Et:</strong> {guide.compareWith}
          </div>
          <div className="tp-ai-compare">
            <strong>Dikkat:</strong> {titleCaseEachWordTr(guide.caution)}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: '#78a888' }}>
            {titleCaseEachWordTr(
              `${result.activeLayerLabel || layerLabel} verisi hazır${
                result.snapshotId ? ' · veri hafızaya kaydedildi' : ''
              }`,
            )}
          </div>

          {Array.isArray(result.analysis.reasons) &&
            result.analysis.reasons.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary
                  style={{ cursor: 'pointer', fontSize: 10, color: '#cdb26d' }}
                >
                  Neden Bunu Öneriyorsun?
                </summary>
                <ul
                  style={{
                    margin: '7px 0 0',
                    paddingLeft: 18,
                    fontSize: 10,
                    lineHeight: 1.5,
                    color: '#aeb7ad',
                  }}
                >
                  {result.analysis.reasons
                    .slice(0, 3)
                    .map((reason: unknown, index: number) => (
                      <li key={index}>{titleCaseEachWordTr(reason)}</li>
                    ))}
                </ul>
              </details>
            )}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 8, fontSize: 10, color: '#e7a89c' }}>
          {titleCaseEachWordTr(error)}
        </div>
      )}

      <div className="tp-layer-guide" style={{ marginTop: 14 }}>
        <div className="tp-layer-guide-item">
          <span>Bu Neyi Gösteriyor?</span>
          <strong>{titleCaseEachWordTr(guide.what)}</strong>
        </div>
        <div className="tp-layer-guide-item">
          <span>Tarımda Ne İşe Yarar?</span>
          <strong>{titleCaseEachWordTr(guide.agriculturalUse)}</strong>
        </div>
        <div className="tp-layer-guide-item interpret">
          <span>Nasıl Yorumlanmalı?</span>
          <strong>{titleCaseEachWordTr(guide.interpretation)}</strong>
        </div>
        <div className="tp-layer-guide-footer">
          <span>
            Birlikte Kontrol Et: <b>{guide.compareWith}</b>
          </span>
          <span>Veri Kaynağı: {guide.source}</span>
        </div>
      </div>
    </section>
  );
}

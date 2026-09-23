import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CloudSun, House, MapPinned, Sparkles } from 'lucide-react';
import MobileWheelPicker from '../../components/MobileWheelPicker';
import {
  synthesizeFieldObservations,
  type FieldSynthesisResult,
} from '../../services/unifiedMapAiService';
import { onboardingStyles } from '../../styles/onboardingStyles';
import type { UnifiedClimateContext } from '../../features/weather/hooks/useAppWeatherData';
import { useEntitlementStore } from '../../entitlements/useEntitlementStore';
import { getCurrentWeeklyPusulaReport, getPusulaPdfCycleState, listPusulaPdfReports, type PusulaPdfHistoryItem } from '../../features/pusula-pdf/services/pusulaPdfData.service';
import { openArchivedPusulaPdf } from '../../features/pusula-pdf/services/pusulaPdfArchive.service';
import { getPusulaPdfJob, requestPusulaPdf, subscribePusulaPdfJob } from '../../features/pusula-pdf/services/pusulaPdfJob.service';
import { PUSULAPDF_STAGE_LABEL, type PusulaPdfJob } from '../../features/pusula-pdf/types.async';
import type { WeeklyPusulaReport } from '../../features/pusula-pdf/types';
import OfficialVerificationCard from '../../features/official-verification/components/OfficialVerificationCard';
import type {
  AiAccessStatus,
  AiFieldAnalysis,
  CmsBlockRow,
  CmsPageRow,
  Field,
  FieldWeatherState,
  Screen,
} from '../../types';

type Setter<T> = (value: T) => void;


const PUSULA_AI_EXTRA_STYLES = `
  .tp-ai-page{min-height:100dvh!important;background:#f5f6f7!important;color:#111820!important;padding-bottom:92px!important;box-sizing:border-box!important}
  .tp-ai-page-header{position:sticky;top:0;z-index:20;display:grid;grid-template-columns:42px minmax(0,1fr) 42px;align-items:center;gap:12px;padding:12px 16px;background:rgba(255,255,255,.94);backdrop-filter:blur(18px);border-bottom:1px solid #e4e7ea}
  .tp-ai-page-header>button{width:38px;height:38px;border:1px solid #e1e5e8;border-radius:12px;background:#f7f8f9;color:#111820;font-size:20px;cursor:pointer}
  .tp-ai-page-header>div:nth-child(2){min-width:0;display:grid;gap:2px}.tp-ai-page-header>div:nth-child(2) span{font-size:9px;font-weight:900;letter-spacing:.12em;color:#66717c;text-transform:uppercase}.tp-ai-page-header>div:nth-child(2) strong{font-size:16px;line-height:1.2;color:#111820;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tp-ai-page-spark{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#111820!important;color:#fff!important}

  .tp-ai-page-content{width:min(760px,100%);margin:0 auto;padding:16px}
  .tp-pusula-hub-intro{padding:18px;border:1px solid #dde2e6;border-radius:22px;background:#fff;box-shadow:0 8px 30px rgba(17,24,32,.05);margin-bottom:14px}
  .tp-pusula-hub-kicker{display:block;color:#6b7580;font-size:10px;font-weight:900;letter-spacing:.12em;margin-bottom:7px}.tp-pusula-hub-intro h1{margin:0;color:#111820;font-size:25px;line-height:1.12}.tp-pusula-hub-intro p{margin:8px 0 0;color:#5f6974;font-size:13px;line-height:1.55}
  .tp-pusula-hub-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:15px}.tp-pusula-hub-action{min-height:82px;padding:13px;border:1px solid #dfe3e7;border-radius:16px;background:#f8f9fa;color:#111820;text-align:left;cursor:pointer;display:flex;flex-direction:column;justify-content:space-between;gap:8px}.tp-pusula-hub-action.primary{background:#111820;border-color:#111820;color:#fff}.tp-pusula-hub-action span{font-size:20px}.tp-pusula-hub-action strong{font-size:13px;line-height:1.25}.tp-pusula-hub-action small{font-size:10px;line-height:1.35;color:#7a848e}.tp-pusula-hub-action.primary small{color:#cbd1d6}
  .tp-pusula-synthesis{position:relative;overflow:hidden;border:1px solid #dde2e6;border-radius:22px;padding:18px;margin-bottom:14px;background:#fff;color:#111820;box-shadow:0 8px 30px rgba(17,24,32,.05)}
  .tp-pusula-synthesis-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.tp-pusula-synthesis-kicker{display:block;margin-bottom:5px;color:#69737d;font-size:10px;font-weight:900;letter-spacing:.12em}.tp-pusula-synthesis-copy h2{margin:0;color:#111820;font-size:21px;line-height:1.12}.tp-pusula-synthesis-copy p{margin:7px 0 0;color:#68727d;font-size:12px;line-height:1.5}
  .tp-pusula-synthesis-anchor{flex:0 0 62px;width:62px;height:62px;border:1px solid #e0e4e7;padding:5px;border-radius:50%;background:#f5f6f7;cursor:pointer}.tp-pusula-synthesis-anchor img{width:100%;height:100%;object-fit:contain;display:block}.tp-pusula-synthesis-anchor.loading img{animation:tpPusulaThinking 1.15s ease-in-out infinite}@keyframes tpPusulaThinking{0%{transform:rotate(-5deg) scale(.98)}45%{transform:rotate(7deg) scale(1.04)}100%{transform:rotate(-5deg) scale(.98)}}
  .tp-pusula-synthesis-progress,.tp-pusula-synthesis-empty,.tp-pusula-synthesis-error{margin-top:16px;padding:14px 15px;border-radius:14px;border:1px solid #e0e4e7;background:#f7f8f9;color:#3d4650}.tp-pusula-synthesis-error{color:#8f2f2f;border-color:#ead0d0;background:#fff6f6}.tp-pusula-synthesis-progress span{display:block;margin-top:5px;color:#6d7781;font-size:11px}
  .tp-pusula-synthesis-result{margin-top:18px}.tp-pusula-synthesis-status{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:15px;border-bottom:1px solid #e5e8eb}.tp-pusula-synthesis-status span{display:block;margin-bottom:4px;color:#7a848e;font-size:9px;font-weight:800;letter-spacing:.12em}.tp-pusula-synthesis-status strong{color:#111820;font-size:18px;line-height:1.2}.tp-pusula-status-pill{flex:0 0 auto;padding:7px 10px;border-radius:999px;font-size:9px;font-weight:900;background:#111820!important;color:#fff!important}
  .tp-pusula-main-summary{margin:15px 0 0;color:#4f5964;font-size:13px;line-height:1.65}.tp-pusula-important-area,.tp-pusula-action{margin-top:15px;padding:13px 14px;border-radius:14px;background:#f6f7f8;border:1px solid #e1e5e8}.tp-pusula-important-area span,.tp-pusula-action span{display:block;color:#68727d;font-size:9px;font-weight:900;letter-spacing:.11em}.tp-pusula-important-area strong{display:block;margin-top:4px;color:#111820;text-transform:capitalize}.tp-pusula-important-area p,.tp-pusula-action p{margin:5px 0 0;color:#5d6772;font-size:12px;line-height:1.5}
  .tp-pusula-section{margin-top:17px}.tp-pusula-section-title{display:block;margin-bottom:8px;color:#68727d;font-size:9px;font-weight:900;letter-spacing:.10em}.tp-pusula-causes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.tp-pusula-cause{padding:12px;border-radius:14px;background:#f8f9fa;border:1px solid #e5e8eb}.tp-pusula-cause strong{color:#111820;font-size:12px}.tp-pusula-cause p{margin:6px 0 0;color:#68727d;font-size:11px;line-height:1.5}.tp-pusula-evidence{display:grid;gap:7px}.tp-pusula-evidence-row{display:grid;grid-template-columns:105px minmax(0,1fr);gap:10px;padding:10px 11px;border-radius:12px;background:#f7f8f9}.tp-pusula-evidence-row strong{color:#111820;font-size:10px}.tp-pusula-evidence-row span{color:#626c76;font-size:11px;line-height:1.45}.tp-pusula-synthesis-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:15px;color:#737d87;font-size:10px}.tp-pusula-refresh{border:1px solid #111820;border-radius:10px;padding:8px 11px;background:#111820;color:#fff;cursor:pointer;font-size:10px;font-weight:800}.tp-pusula-caution{margin-top:13px;color:#7b858f;font-size:9px;line-height:1.45}
  .tp-ai-hero{display:none!important}.tp-ai-access-card,.tp-ai-workspace{border:1px solid #dde2e6!important;border-radius:22px!important;background:#fff!important;color:#111820!important;box-shadow:0 8px 30px rgba(17,24,32,.05)!important}.tp-ai-access-card{margin-bottom:14px!important}.tp-ai-workspace{scroll-margin-top:82px!important}.tp-ai-workspace *{box-sizing:border-box}.tp-ai-main-analyze{background:#111820!important;color:#fff!important;-webkit-text-fill-color:#fff!important;border-color:#111820!important}.tp-ai-main-analyze span{color:#fff!important;-webkit-text-fill-color:#fff!important}.tp-ai-save-history{background:#111820!important;color:#fff!important;-webkit-text-fill-color:#fff!important}.tp-ai-bottom-nav .tp-ai-nav-main{background:#111820!important;color:#fff!important}.tp-ai-bottom-nav .tp-ai-nav-main span{color:#fff!important}.tp-ai-page-result{border-color:#dde2e6!important;background:#f8f9fa!important;color:#111820!important}

  /* Pusula AI merkezi — eski onboarding/global buton kurallarını ezer */
  .tp-ai-page .tp-ai-page-header{grid-template-columns:42px minmax(0,1fr)!important}
  .tp-ai-page .tp-ai-page-header>div:nth-child(2) span{color:#6d7781!important}
  .tp-ai-page .tp-ai-page-header>div:nth-child(2) strong{color:#111820!important;font-size:16px!important}
  .tp-ai-page .tp-pusula-hub-intro{display:block!important;padding:18px!important;margin:0 0 14px!important;border:1px solid #dfe3e7!important;border-radius:20px!important;background:#fff!important;box-shadow:0 8px 24px rgba(17,24,32,.05)!important}
  .tp-ai-page .tp-pusula-hub-kicker{display:block!important;margin:0 0 7px!important;color:#69737d!important;font-size:10px!important;font-weight:900!important;letter-spacing:.12em!important}
  .tp-ai-page .tp-pusula-hub-intro h1{margin:0!important;color:#111820!important;font-size:25px!important;line-height:1.1!important}
  .tp-ai-page .tp-pusula-hub-intro>p{margin:8px 0 0!important;color:#5f6974!important;font-size:13px!important;line-height:1.5!important}
  .tp-ai-page .tp-pusula-hub-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important;margin-top:16px!important}
  .tp-ai-page button.tp-pusula-hub-action{appearance:none!important;width:100%!important;min-width:0!important;min-height:92px!important;margin:0!important;padding:14px!important;border:1px solid #dfe3e7!important;border-radius:16px!important;background:#f7f8f9!important;color:#111820!important;box-shadow:none!important;text-align:left!important;display:grid!important;grid-template-columns:32px minmax(0,1fr)!important;grid-template-rows:auto auto!important;column-gap:10px!important;row-gap:2px!important;align-items:center!important;white-space:normal!important;overflow:hidden!important}
  .tp-ai-page button.tp-pusula-hub-action.primary{background:#111820!important;border-color:#111820!important;color:#fff!important}
  .tp-ai-page button.tp-pusula-hub-action>span{grid-row:1 / span 2!important;width:32px!important;height:32px!important;display:grid!important;place-items:center!important;border-radius:10px!important;background:#fff!important;border:1px solid #e0e4e7!important;color:#111820!important;font-size:16px!important}
  .tp-ai-page button.tp-pusula-hub-action.primary>span{background:#fff!important;color:#111820!important}
  .tp-ai-page button.tp-pusula-hub-action>strong{display:block!important;margin:0!important;color:inherit!important;font-size:13px!important;line-height:1.25!important}
  .tp-ai-page button.tp-pusula-hub-action>small{display:block!important;margin:0!important;color:#717b85!important;font-size:10px!important;line-height:1.35!important}
  .tp-ai-page button.tp-pusula-hub-action.primary>small{color:#cbd1d6!important}
  .tp-ai-page .tp-pusula-synthesis{display:block!important;padding:18px!important;margin:0 0 14px!important;border:1px solid #dfe3e7!important;border-radius:20px!important;background:#fff!important;box-shadow:0 8px 24px rgba(17,24,32,.05)!important}
  .tp-ai-page .tp-pusula-synthesis-head{display:block!important}
  .tp-ai-page .tp-pusula-synthesis-copy h2{margin:0!important;color:#111820!important;font-size:20px!important}
  .tp-ai-page .tp-pusula-synthesis-copy p{max-width:100%!important;margin:7px 0 0!important;color:#68727d!important;font-size:12px!important;line-height:1.5!important}
  .tp-ai-page .tp-pusula-synthesis-error{display:grid!important;gap:7px!important;color:#5d3434!important}
  .tp-ai-page .tp-pusula-synthesis-error strong{font-size:12px!important}
  .tp-ai-page .tp-pusula-synthesis-error span{font-size:11px!important;line-height:1.45!important}
  .tp-ai-page .tp-pusula-synthesis-error button{justify-self:start!important;margin-top:2px!important;padding:8px 11px!important;border:1px solid #111820!important;border-radius:10px!important;background:#111820!important;color:#fff!important;font-size:10px!important;font-weight:800!important}
  .tp-ai-page .tp-ai-page-error{border:1px solid #ead0d0!important;border-radius:12px!important;background:#fff6f6!important;color:#6f3434!important;font-size:11px!important;line-height:1.45!important}
  .tp-ai-page .tp-ai-bottom-nav .tp-ai-nav-main{background:#111820!important;border-color:#111820!important;color:#fff!important}
  .tp-ai-page .tp-ai-bottom-nav .tp-ai-nav-main>span{display:grid!important;place-items:center!important;background:#fff!important;color:#111820!important;font-weight:900!important;font-size:13px!important}


  .tp-ai-page .tp-pusula-pdf-ready{margin-top:10px;padding:12px 13px;border:1px solid #dfe3e7;border-radius:14px;background:#f7f8f9;display:grid;gap:3px}
  .tp-ai-page .tp-pusula-pdf-ready strong{font-size:12px;color:#111820}.tp-ai-page .tp-pusula-pdf-ready span,.tp-ai-page .tp-pusula-pdf-ready small{font-size:10px;color:#69737d;line-height:1.4}

  /* 2026-09 Pusula AI final mobile presentation */
  .tp-ai-page .tp-pusula-hub-intro,
  .tp-ai-page .tp-pusula-synthesis{
    box-sizing:border-box!important;
    width:100%!important;
    overflow:hidden!important;
  }
  .tp-ai-page .tp-pusula-hub-actions{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:8px!important;
  }
  .tp-ai-page button.tp-pusula-hub-action{
    display:grid!important;
    grid-template-columns:38px minmax(0,1fr)!important;
    grid-template-rows:auto auto!important;
    min-height:70px!important;
    height:auto!important;
    padding:11px 12px!important;
    border-radius:14px!important;
    white-space:normal!important;
    text-align:left!important;
  }
  .tp-ai-page button.tp-pusula-hub-action>strong{
    grid-column:2!important;
    grid-row:1!important;
    align-self:end!important;
    overflow-wrap:anywhere!important;
  }
  .tp-ai-page button.tp-pusula-hub-action>small{
    grid-column:2!important;
    grid-row:2!important;
    align-self:start!important;
    overflow-wrap:anywhere!important;
  }
  .tp-ai-page .tp-pusula-synthesis-body{
    display:grid!important;
    gap:10px!important;
    margin-top:14px!important;
  }
  .tp-ai-page .tp-pusula-synthesis-summary{
    margin:0!important;
    padding:12px 13px!important;
    border:1px solid #e1e5e8!important;
    border-radius:13px!important;
    background:#f7f8f9!important;
    color:#37414b!important;
    font-size:12px!important;
    line-height:1.55!important;
  }
  .tp-ai-page .tp-pusula-synthesis-section{
    display:block!important;
    margin:0!important;
    padding:12px 13px!important;
    border:1px solid #e1e5e8!important;
    border-radius:13px!important;
    background:#fff!important;
  }
  .tp-ai-page .tp-pusula-synthesis-section>span,
  .tp-ai-page .tp-pusula-synthesis-section>small{
    display:block!important;
    margin:0 0 5px!important;
    color:#737d87!important;
    font-size:9px!important;
    font-weight:900!important;
    letter-spacing:.1em!important;
    text-transform:uppercase!important;
  }
  .tp-ai-page .tp-pusula-synthesis-section>strong{
    display:block!important;
    margin:0!important;
    color:#111820!important;
    font-size:14px!important;
    line-height:1.35!important;
    overflow-wrap:anywhere!important;
  }
  .tp-ai-page .tp-pusula-synthesis-section>p{
    display:block!important;
    margin:6px 0 0!important;
    color:#59646f!important;
    font-size:11px!important;
    line-height:1.5!important;
    overflow-wrap:anywhere!important;
  }
  .tp-ai-page .tp-pusula-synthesis-result,
  .tp-ai-page .tp-pusula-synthesis-important,
  .tp-ai-page .tp-pusula-synthesis-reason,
  .tp-ai-page .tp-pusula-synthesis-action,
  .tp-ai-page .tp-pusula-synthesis-evidence{
    display:block!important;
    margin:10px 0 0!important;
    padding:12px 13px!important;
    border:1px solid #e1e5e8!important;
    border-radius:13px!important;
    background:#fff!important;
    color:#111820!important;
    line-height:1.5!important;
    overflow-wrap:anywhere!important;
  }
  .tp-ai-page .tp-pusula-synthesis-result *,
  .tp-ai-page .tp-pusula-synthesis-important *,
  .tp-ai-page .tp-pusula-synthesis-reason *,
  .tp-ai-page .tp-pusula-synthesis-action *,
  .tp-ai-page .tp-pusula-synthesis-evidence *{
    max-width:100%!important;
    white-space:normal!important;
    overflow-wrap:anywhere!important;
  }


  .tp-ai-page .tp-ai-modebar{margin:-4px 0 12px!important}
  .tp-ai-page .tp-ai-modebar button{
    appearance:none!important;border:0!important;background:transparent!important;
    color:#111820!important;padding:7px 0!important;font-size:11px!important;font-weight:800!important;
  }
  .tp-ai-page .tp-pusula-hub-action{
    grid-template-columns:36px minmax(0,1fr)!important;
  }
  .tp-ai-page .tp-pusula-hub-action strong,
  .tp-ai-page .tp-pusula-hub-action small{
    width:auto!important;max-width:none!important;min-width:0!important;
  }
  .tp-ai-page .tp-ai-bottom-nav .tp-ai-nav-main{
    background:#111820!important;border-color:#111820!important;color:#fff!important;
  }
  .tp-ai-page .tp-ai-bottom-nav .tp-ai-nav-main>span{
    background:#fff!important;color:#111820!important;border:0!important;
  }

  @media(max-width:680px){.tp-ai-page-content{padding:12px!important}.tp-pusula-hub-intro,.tp-pusula-synthesis{padding:15px;border-radius:18px}.tp-pusula-causes{grid-template-columns:1fr}.tp-pusula-hub-actions{grid-template-columns:1fr 1fr}.tp-pusula-hub-action{min-height:76px}}
  /* PUSULA AI MERKEZİ — kompakt premium mobil düzen */
  .tp-ai-page .tp-pusula-hub-intro{padding:16px!important;margin:0 0 14px!important;border:1px solid #e1e5e8!important;border-radius:18px!important;background:#fff!important;box-shadow:0 5px 18px rgba(17,24,32,.045)!important}
  .tp-ai-page .tp-pusula-hub-kicker{display:block!important;margin:0 0 5px!important;color:#7b858f!important;font-size:9px!important;font-weight:900!important;letter-spacing:.13em!important;text-transform:uppercase!important}
  .tp-ai-page .tp-pusula-hub-intro h1{margin:0!important;color:#111820!important;font-size:22px!important;font-weight:850!important;line-height:1.12!important}
  .tp-ai-page .tp-pusula-hub-intro>p{margin:7px 0 0!important;max-width:36ch!important;color:#68727d!important;font-size:11px!important;line-height:1.45!important}
  .tp-ai-page .tp-pusula-hub-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;margin-top:13px!important}
  .tp-ai-page button.tp-pusula-hub-action{appearance:none!important;width:100%!important;min-width:0!important;min-height:88px!important;padding:11px!important;margin:0!important;border:1px solid #e0e4e7!important;border-radius:14px!important;background:#f7f8f9!important;color:#111820!important;box-shadow:none!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:flex-start!important;gap:4px!important;text-align:left!important;white-space:normal!important;overflow:hidden!important;cursor:pointer!important}
  .tp-ai-page button.tp-pusula-hub-action.primary{background:#111820!important;border-color:#111820!important;color:#fff!important}
  .tp-ai-page button.tp-pusula-hub-action>span{display:grid!important;place-items:center!important;width:28px!important;height:28px!important;min-width:28px!important;margin:0 0 3px!important;border:1px solid #dfe3e7!important;border-radius:9px!important;background:#fff!important;color:#111820!important;font-size:14px!important;font-weight:900!important;line-height:1!important}
  .tp-ai-page button.tp-pusula-hub-action>strong{display:block!important;width:100%!important;margin:0!important;color:inherit!important;font-size:12px!important;font-weight:850!important;line-height:1.2!important;overflow-wrap:anywhere!important}
  .tp-ai-page button.tp-pusula-hub-action>small{display:block!important;width:100%!important;margin:0!important;color:#737d87!important;font-size:9px!important;font-weight:500!important;line-height:1.3!important;overflow-wrap:anywhere!important}
  .tp-ai-page button.tp-pusula-hub-action.primary>small{color:#cbd1d6!important}
  .tp-ai-page button.tp-pusula-hub-action:disabled{opacity:.48!important;cursor:not-allowed!important}
  @media(max-width:380px){.tp-ai-page .tp-pusula-hub-actions{grid-template-columns:1fr!important}.tp-ai-page button.tp-pusula-hub-action{min-height:72px!important}}

`


type AiAnalysisScreenProps = {
  cmsRuntimeCss: string;
  cmsPageFor: (pageKey: string) => CmsPageRow | undefined;
  cmsBlockFor: (pageKey: string, blockKey: string) => CmsBlockRow | undefined;
  cmsText: (block: CmsBlockRow | undefined, fallback: string) => string;
  cmsSub: (block: CmsBlockRow | undefined, fallback: string) => string;

  aiAccessStatus: AiAccessStatus | null;
  aiAccessLoading: boolean;

  realFields: Field[];
  fieldWeather: Record<string, FieldWeatherState>;
  loadFieldWeather: (field: Field) => void | Promise<void>;
  unifiedClimateContext: UnifiedClimateContext | null;
  selectedField: Field | null;
  setSelectedField: Setter<Field | null>;

  activityPhotoPreview: string;
  activityPhoto: File | null;
  activityNotes: string;
  setActivityNotes: Setter<string>;

  aiAnalyzing: boolean;
  aiAnalysisError: string;
  aiAnalysis: AiFieldAnalysis | null;
  diagnosisSequenceNo: number;
  diagnosisNeedsMoreEvidence: boolean;
  diagnosisRequestedEvidence: string;
  aiHistorySaveStatus: 'idle' | 'saving' | 'success' | 'error';
  aiHistorySaveMessage: string;
  aiHistorySavedPoints: number;

  setScreen: Setter<Screen>;
  clearActivityPhoto: () => void;
  handleActivityPhotoChange: (file?: File) => void | Promise<void>;
  handleAiAnalyzeActivityPhoto: () => void | Promise<void>;
  handleDiagnosisFollowUpPhoto: (file?: File) => void | Promise<void>;
  handleSaveAiAnalysisToHistory: () => void | Promise<void>;
  openAddField: () => void;
  openCalendarScreen: () => void;
};


const PUSULA_HUB_FINAL_STYLES = String.raw`
.tp-ai-page .tp-pusula-hub-intro{box-sizing:border-box!important;width:100%!important;margin:0 0 14px!important;padding:14px!important;background:#fff!important;border:1px solid #e3e6e9!important;border-radius:16px!important;box-shadow:0 4px 16px rgba(17,24,32,.04)!important;overflow:hidden!important}
.tp-ai-page .tp-pusula-hub-kicker{display:block!important;margin:0 0 5px!important;color:#858e97!important;font-size:9px!important;font-weight:900!important;line-height:1.2!important;letter-spacing:.12em!important}
.tp-ai-page .tp-pusula-hub-intro h1{margin:0!important;padding:0!important;color:#111820!important;font-size:23px!important;font-weight:900!important;line-height:1.1!important}
.tp-ai-page .tp-pusula-hub-intro>p{margin:7px 0 0!important;padding:0!important;color:#68727c!important;font-size:11px!important;line-height:1.4!important}
.tp-ai-page .tp-pusula-hub-actions{width:100%!important;margin:13px 0 0!important;padding:0!important;display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:8px!important}
.tp-ai-page .tp-pusula-hub-actions>.tp-pusula-hub-action{box-sizing:border-box!important;width:100%!important;min-width:0!important;height:92px!important;min-height:92px!important;margin:0!important;padding:11px!important;border:1px solid #e0e4e7!important;border-radius:13px!important;background:#f5f6f7!important;box-shadow:none!important;color:#111820!important;display:grid!important;grid-template-columns:30px minmax(0,1fr)!important;grid-template-rows:auto auto!important;column-gap:8px!important;row-gap:3px!important;align-content:center!important;align-items:center!important;text-align:left!important;white-space:normal!important;overflow:hidden!important;font-family:inherit!important}
.tp-ai-page .tp-pusula-hub-actions>.tp-pusula-hub-action.primary{background:#111820!important;border-color:#111820!important;color:#fff!important}
.tp-ai-page .tp-pusula-hub-action>span{grid-column:1!important;grid-row:1/span 2!important;width:30px!important;height:30px!important;min-width:30px!important;margin:0!important;padding:0!important;border:1px solid #dfe3e6!important;border-radius:9px!important;background:#fff!important;color:#111820!important;display:grid!important;place-items:center!important;font-size:14px!important;font-weight:900!important;line-height:1!important}
.tp-ai-page .tp-pusula-hub-action>strong{grid-column:2!important;grid-row:1!important;display:block!important;margin:0!important;padding:0!important;color:inherit!important;font-size:11px!important;font-weight:900!important;line-height:1.18!important;white-space:normal!important}
.tp-ai-page .tp-pusula-hub-action>small{grid-column:2!important;grid-row:2!important;display:block!important;margin:0!important;padding:0!important;color:#747e88!important;font-size:8.5px!important;font-weight:500!important;line-height:1.28!important;white-space:normal!important}
.tp-ai-page .tp-pusula-hub-action.primary>small{color:#cbd0d5!important}
.tp-ai-page .tp-pusula-hub-action:disabled{opacity:.42!important}
.tp-ai-page .tp-ai-workspace-back{appearance:none!important;display:inline-flex!important;align-items:center!important;min-height:32px!important;margin:0 0 12px!important;padding:0 11px!important;border:1px solid #e0e4e7!important;border-radius:10px!important;background:#fff!important;color:#343d46!important;box-shadow:none!important;font-size:10px!important;font-weight:800!important}
@media(max-width:360px){.tp-ai-page .tp-pusula-hub-actions{grid-template-columns:1fr!important}.tp-ai-page .tp-pusula-hub-actions>.tp-pusula-hub-action{height:72px!important;min-height:72px!important}}

/* Pusula merkezi: aksiyonlar mobilde alt alta */
.tp-ai-page .tp-pusula-hub-actions{grid-template-columns:1fr!important}
.tp-ai-page .tp-pusula-hub-actions>.tp-pusula-hub-action{width:100%!important}

.tp-ai-page .tp-premium-badge{display:inline-flex!important;margin-left:6px!important;padding:2px 5px!important;border-radius:5px!important;background:#111820!important;color:#fff!important;font-size:7px!important;line-height:1!important;letter-spacing:.08em!important;vertical-align:middle!important}
.tp-ai-page .tp-pusula-hub-action.is-premium-locked{border-style:dashed!important;background:#fafafa!important}
.tp-ai-page .tp-premium-info{margin:0 0 14px!important;padding:13px!important;border:1px solid #dfe3e6!important;border-radius:14px!important;background:#fff!important;display:flex!important;gap:12px!important;align-items:flex-start!important}
.tp-ai-page .tp-premium-info>div{min-width:0!important;flex:1!important}
.tp-ai-page .tp-premium-info span{display:block!important;color:#737d87!important;font-size:8px!important;font-weight:900!important;letter-spacing:.1em!important}
.tp-ai-page .tp-premium-info strong{display:block!important;margin-top:4px!important;color:#111820!important;font-size:13px!important}
.tp-ai-page .tp-premium-info p{margin:5px 0 0!important;color:#626d77!important;font-size:10px!important;line-height:1.4!important}
.tp-ai-page .tp-premium-info button,.tp-ai-page .tp-pusula-pdf{appearance:none!important;border:1px solid #111820!important;border-radius:9px!important;background:#111820!important;color:#fff!important;padding:8px 10px!important;font-size:9px!important;font-weight:800!important;white-space:nowrap!important}
.tp-ai-page .tp-pusula-synthesis-footer{flex-wrap:wrap!important}

/* PUSULAPDF — snapshot durum kartı */
.tp-ai-page .tp-pusula-pdf-ready{margin-top:10px!important;padding:13px!important;border:1px solid #dfe3e7!important;border-radius:14px!important;background:#f7f8f9!important;display:grid!important;gap:10px!important}
.tp-ai-page .tp-pusula-pdf-ready-head{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:10px!important}
.tp-ai-page .tp-pusula-pdf-ready-copy{min-width:0!important}
.tp-ai-page .tp-pusula-pdf-ready-copy>span{display:block!important;margin-bottom:3px!important;color:#7b858f!important;font-size:8px!important;font-weight:900!important;letter-spacing:.11em!important;text-transform:uppercase!important}
.tp-ai-page .tp-pusula-pdf-ready-copy>strong{display:block!important;color:#111820!important;font-size:12px!important;line-height:1.3!important}
.tp-ai-page .tp-pusula-pdf-ready-period{flex:0 0 auto!important;padding:5px 7px!important;border:1px solid #dde2e6!important;border-radius:8px!important;background:#fff!important;color:#59646f!important;font-size:9px!important;font-weight:800!important;white-space:nowrap!important}
.tp-ai-page .tp-pusula-pdf-missing{padding-top:9px!important;border-top:1px solid #e2e6e9!important}
.tp-ai-page .tp-pusula-pdf-missing>span{display:block!important;margin-bottom:7px!important;color:#68727d!important;font-size:9px!important;font-weight:900!important}
.tp-ai-page .tp-pusula-pdf-missing-list{display:flex!important;flex-wrap:wrap!important;gap:6px!important}
.tp-ai-page .tp-pusula-pdf-missing-chip{display:inline-flex!important;align-items:center!important;min-height:25px!important;padding:5px 8px!important;border:1px solid #dfe3e7!important;border-radius:999px!important;background:#fff!important;color:#4f5964!important;font-size:9px!important;font-weight:700!important;line-height:1.25!important}
.tp-ai-page .tp-pusula-pdf-note{display:block!important;margin:0!important;color:#7a848e!important;font-size:9px!important;line-height:1.4!important}
.tp-ai-page .tp-pusula-pdf-complete{padding-top:9px!important;border-top:1px solid #e2e6e9!important;color:#4f5964!important;font-size:9px!important;line-height:1.4!important}
.tp-ai-page .tp-pusula-pdf-download{appearance:none!important;width:100%!important;min-height:40px!important;border:0!important;border-radius:10px!important;background:#111820!important;color:#fff!important;font-size:10px!important;font-weight:900!important;letter-spacing:.02em!important;cursor:pointer!important}
.tp-ai-page .tp-pusula-pdf-download:disabled{opacity:.55!important;cursor:wait!important}
`;

export default function AiAnalysisScreen({
  cmsRuntimeCss,
  cmsPageFor,
  cmsBlockFor,
  cmsText,
  cmsSub,
  aiAccessStatus,
  aiAccessLoading,
  realFields,
  fieldWeather,
  loadFieldWeather,
  unifiedClimateContext,
  selectedField,
  setSelectedField,
  activityPhotoPreview,
  activityPhoto,
  activityNotes,
  setActivityNotes,
  aiAnalyzing,
  aiAnalysisError,
  aiAnalysis,
  diagnosisSequenceNo,
  diagnosisNeedsMoreEvidence,
  diagnosisRequestedEvidence,
  aiHistorySaveStatus,
  aiHistorySaveMessage,
  aiHistorySavedPoints,
  setScreen,
  clearActivityPhoto,
  handleActivityPhotoChange,
  handleAiAnalyzeActivityPhoto,
  handleDiagnosisFollowUpPhoto,
  handleSaveAiAnalysisToHistory,
  openAddField,
  openCalendarScreen,
}: AiAnalysisScreenProps) {
  const aiPage = cmsPageFor('aiAnalysis');
  const aiHeaderBlock = cmsBlockFor('aiAnalysis', 'page-header');
  const aiHeroBlock = cmsBlockFor('aiAnalysis', 'hero');
  const aiAccessBlock = cmsBlockFor('aiAnalysis', 'access');
  const aiFieldStepBlock = cmsBlockFor('aiAnalysis', 'field-step');
  const aiPhotoStepBlock = cmsBlockFor('aiAnalysis', 'photo-step');
  const aiPickerBlock = cmsBlockFor('aiAnalysis', 'photo-picker');
  const aiNoteBlock = cmsBlockFor('aiAnalysis', 'note');
  const aiAnalyzeBlock = cmsBlockFor('aiAnalysis', 'analyze-button');

  // Geliştirme aşamasında fotoğraf teşhisinde günlük/reklam hakkı uygulanmıyor.
  const canAnalyze = true;

  const {
    isPremium: entitlementIsPremium,
    effectivePlan,
    developerMode,
    canOverride,
  } = useEntitlementStore();

  // Gerçek Premium + geliştirici TEST PREMIUM aynı yetkiyi açar.
  // localStorage fallback yalnız geliştirici override yetkisi varsa kullanılır;
  // normal kullanıcı bunu değiştirerek Premium açamaz.
  const storedDeveloperMode =
    canOverride && typeof window !== 'undefined'
      ? (() => {
          try {
            return String(window.localStorage.getItem('tp_dev_plan_mode_v2') ?? '')
              .trim()
              .toLowerCase();
          } catch {
            return '';
          }
        })()
      : '';

  const isPremiumPlan =
    entitlementIsPremium ||
    effectivePlan === 'premium' ||
    (canOverride && developerMode === 'premium') ||
    (canOverride && storedDeveloperMode === 'premium');

  const [premiumInfoOpen, setPremiumInfoOpen] = useState(false);
  const [pusulaPdfStatus, setPusulaPdfStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [pusulaPdfReport, setPusulaPdfReport] = useState<WeeklyPusulaReport | null>(null);
  const [pusulaPdfError, setPusulaPdfError] = useState('');
  const [pusulaPdfJob, setPusulaPdfJob] = useState<PusulaPdfJob | null>(null);
  const [pusulaPdfDownloading, setPusulaPdfDownloading] = useState(false);
  const [pusulaPdfHistory, setPusulaPdfHistory] = useState<PusulaPdfHistoryItem[]>([]);
  const [pusulaPdfHistoryOpen, setPusulaPdfHistoryOpen] = useState(false);
  const [pusulaPdfNextAt, setPusulaPdfNextAt] = useState<string | null>(null);

  const pusulaPdfProgress: Record<PusulaPdfJob['stage'], number> = {
    queued: 5,
    collecting: 15,
    satellite: 35,
    weather: 50,
    field_memory: 65,
    interpreting: 80,
    rendering: 95,
    ready: 100,
    failed: 0,
  };

  const pusulaPdfMissingLabels: Record<string, string> = {
    parcel_geometry: 'Parsel geometrisi',
    satellite_30d: '30 günlük uydu serisi',
    weather: 'Hava verisi',
    activities: 'Tarla işlemleri',
    soil_analysis: 'Toprak analizi',
    resolved_diagnosis: 'Tamamlanmış Pusula teşhisi',
    irrigation_kc: 'Sulama / fenoloji kaydı',
  };

  const formatPusulaPdfDate = (value: string) => {
    const parsed = new Date(`${value}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const synthesisField = selectedField ?? realFields[0] ?? null;

  const synthesisWeather =
    synthesisField
      ? fieldWeather[String(synthesisField.id)] ?? null
      : null;


  const handleReadyPusulaPdf = async () => {
    if (!pusulaPdfReport?.report_data || pusulaPdfStatus !== 'ready' || pusulaPdfDownloading) return;

    // StackBlitz / mobil webview gibi sandbox ortamlarında async PDF üretiminden sonra
    // yeni sekme veya indirme kullanıcı hareketi sayılmayabiliyor. Sekmeyi doğrudan
    // tıklama anında açıp PDF hazır olunca aynı sekmeye bağlıyoruz.
    let previewWindow: Window | null = null;
    try {
      previewWindow = window.open('', 'tarlapusula-pusulapdf');
      if (previewWindow) {
        previewWindow.document.title = 'PUSULAPDF hazırlanıyor';
        previewWindow.document.body.style.cssText =
          'margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f6f7;color:#111820;font-family:Arial,sans-serif';
        previewWindow.document.body.innerHTML =
          '<div style="text-align:center;padding:24px"><strong style="font-size:18px">PUSULAPDF hazırlanıyor…</strong><div style="margin-top:8px;font-size:13px;color:#6b7580">Hazır rapor PDF biçimine dönüştürülüyor.</div></div>';
      }
    } catch (error) {
      console.warn('[PUSULAPDF] Önizleme sekmesi açılamadı:', error);
      previewWindow = null;
    }

    setPusulaPdfDownloading(true);
    setPusulaPdfError('');
    try {
      // Yalnızca worker'ın hazırladığı immutable snapshot render edilir.
      // Burada yeniden veri toplama / yeni rapor oluşturma yapılmaz.
      try { previewWindow?.close(); } catch {}
      await openArchivedPusulaPdf(pusulaPdfReport);
    } catch (error) {
      try {
        previewWindow?.close();
      } catch {
        // Kapatma izni yoksa kullanıcı boş sekmeyi kapatabilir.
      }
      console.error('[PUSULAPDF] Hazır PDF açılamadı:', error);
      setPusulaPdfError(error instanceof Error ? error.message : 'Hazır PUSULAPDF açılamadı.');
    } finally {
      setPusulaPdfDownloading(false);
    }
  };

  const queuePusulaPdf = async () => {
    if (!isPremiumPlan) { setPremiumInfoOpen(true); return; }
    if (!synthesisField?.id || pusulaPdfStatus === 'loading') return;

    try {
      const cycle = await getPusulaPdfCycleState(String(synthesisField.id));
      setPusulaPdfNextAt(cycle.nextReportAt);
      if (!cycle.canCreateNew && cycle.latest) {
        setPusulaPdfReport(cycle.latest);
        setPusulaPdfStatus('ready');
        setPusulaPdfHistory(await listPusulaPdfReports(String(synthesisField.id)));
        return;
      }
    } catch (error) {
      console.warn('[PUSULAPDF] 7 günlük döngü kontrolü alınamadı:', error);
    }

    setPusulaPdfStatus('loading');
    setPusulaPdfError('');
    setPusulaPdfReport(null);

    try {
      const request = await requestPusulaPdf(String(synthesisField.id));
      setPusulaPdfJob({
        id: request.job_id,
        user_id: '',
        field_id: String(synthesisField.id),
        report_id: request.report_id,
        stage: 'queued',
        status: 'queued',
        attempts: 0,
        max_attempts: 3,
        error_code: null,
        error_message: null,
        progress_meta: {},
        created_at: new Date().toISOString(),
        started_at: null,
        finished_at: null,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[PUSULAPDF] Kuyruğa alınamadı:', error);
      setPusulaPdfJob(null);
      setPusulaPdfError(error instanceof Error ? error.message : 'PUSULAPDF kuyruğa alınamadı.');
      setPusulaPdfStatus('error');
    }
  };

  useEffect(() => {
    if (!pusulaPdfJob?.id || pusulaPdfJob.status === 'ready' || pusulaPdfJob.status === 'failed') return;
    const channel = subscribePusulaPdfJob(pusulaPdfJob.id, (job) => setPusulaPdfJob(job));
    return () => { void channel.unsubscribe(); };
  }, [pusulaPdfJob?.id, pusulaPdfJob?.status]);

  // Realtime bağlantısı kesilse bile rapor kartı donmuş görünmesin.
  useEffect(() => {
    const jobId = pusulaPdfJob?.id;
    if (!jobId || pusulaPdfJob.status === 'ready' || pusulaPdfJob.status === 'failed') return;

    let cancelled = false;
    const refresh = async () => {
      try {
        const fresh = await getPusulaPdfJob(jobId);
        if (!cancelled) setPusulaPdfJob(fresh);
      } catch (error) {
        console.warn('[PUSULAPDF] Job durumu yenilenemedi:', error);
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pusulaPdfJob?.id, pusulaPdfJob?.status]);

  useEffect(() => {
    if (!pusulaPdfJob) return;

    if (pusulaPdfJob.status === 'failed') {
      setPusulaPdfStatus('error');
      setPusulaPdfError(pusulaPdfJob.error_message ?? 'PUSULAPDF hazırlanamadı.');
      return;
    }

    if (pusulaPdfJob.status !== 'ready') {
      setPusulaPdfStatus('loading');
      return;
    }

    if (!synthesisField?.id) return;
    let cancelled = false;
    void getCurrentWeeklyPusulaReport(String(synthesisField.id))
      .then((report) => {
        if (cancelled || !report) return;
        setPusulaPdfReport(report);
        setPusulaPdfStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setPusulaPdfError(error instanceof Error ? error.message : 'Hazır rapor açılamadı.');
        setPusulaPdfStatus('error');
      });

    return () => { cancelled = true; };
  }, [pusulaPdfJob?.status, pusulaPdfJob?.report_id, synthesisField?.id]);


  useEffect(() => {
    if (!synthesisField?.id || !isPremiumPlan) {
      setPusulaPdfHistory([]);
      setPusulaPdfNextAt(null);
      return;
    }
    let cancelled = false;
    void Promise.all([
      listPusulaPdfReports(String(synthesisField.id)),
      getPusulaPdfCycleState(String(synthesisField.id)),
    ]).then(([history, cycle]) => {
      if (cancelled) return;
      setPusulaPdfHistory(history);
      setPusulaPdfNextAt(cycle.nextReportAt);
      if (cycle.latest && !cycle.canCreateNew) {
        setPusulaPdfReport(cycle.latest);
        setPusulaPdfStatus('ready');
      }
    }).catch((error) => console.warn('[PUSULAPDF] Rapor geçmişi alınamadı:', error));
    return () => { cancelled = true; };
  }, [synthesisField?.id, isPremiumPlan]);

  useEffect(() => {
    if (!synthesisField?.id) return;

    const current =
      fieldWeather[String(synthesisField.id)];

    if (
      current?.status === 'ready' ||
      current?.status === 'loading'
    ) {
      return;
    }

    void loadFieldWeather(synthesisField);
  }, [
    synthesisField?.id,
    fieldWeather,
    loadFieldWeather,
  ]);

  const synthesisWeatherContext = useMemo(() => {
    if (!synthesisField || !synthesisWeather) return null;

    return {
      fieldId: String(synthesisField.id),
      locationLabel: synthesisWeather.locationLabel ?? null,
      status: synthesisWeather.status,
      forecast: Array.isArray(synthesisWeather.forecast)
        ? synthesisWeather.forecast.slice(0, 5)
        : [],
      providers: Array.isArray(synthesisWeather.providers)
        ? synthesisWeather.providers.slice(0, 3).map((provider: any) => ({
            name: provider?.name ?? null,
            forecast: Array.isArray(provider?.forecast)
              ? provider.forecast.slice(0, 5)
              : [],
          }))
        : [],
      message: synthesisWeather.message ?? null,
    };
  }, [
    synthesisField?.id,
    synthesisWeather,
  ]);

  const synthesisClimateContext = useMemo(() => {
    const context: any = unifiedClimateContext;
    if (!context || !synthesisField) return null;

    return String(context.fieldId ?? '') === String(synthesisField.id)
      ? context
      : null;
  }, [
    unifiedClimateContext,
    synthesisField?.id,
  ]);
  const [synthesisLoading, setSynthesisLoading] = useState(false);
  const [synthesisResult, setSynthesisResult] = useState<FieldSynthesisResult | null>(null);
  const [synthesisError, setSynthesisError] = useState('');
  const [loadingDots, setLoadingDots] = useState('.');
  const synthesisRequestRef = useRef(0);

  useEffect(() => {
    if (!synthesisLoading) {
      setLoadingDots('.');
      return;
    }
    const timer = window.setInterval(() => {
      setLoadingDots((current) => current === '.' ? '..' : current === '..' ? '...' : '.');
    }, 420);
    return () => window.clearInterval(timer);
  }, [synthesisLoading]);

  const createSynthesisPdf = (freshResult?: typeof synthesisResult) => {
    const reportResult = freshResult ?? synthesisResult;
    if (!isPremiumPlan || !synthesisField || !reportResult) return;

    const escapeHtml = (value: unknown) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const safeValue = (value: unknown, suffix = '') => {
      if (value === null || value === undefined || value === '') return 'Veri bulunamadı';
      return `${escapeHtml(value)}${suffix}`;
    };

    const fieldAny = synthesisField as any;
    const weatherAny = fieldWeather as any;
    const climateAny = unifiedClimateContext as any;
    const resultAny = synthesisResult as any;

    const cropName =
      fieldAny?.cropName || fieldAny?.crop || fieldAny?.productName || fieldAny?.product || 'Veri bulunamadı';
    const areaValue =
      fieldAny?.areaHa ?? fieldAny?.area ?? fieldAny?.hectares ?? fieldAny?.sizeHa ?? null;
    const stageName =
      fieldAny?.phenologyStage || fieldAny?.growthStage || fieldAny?.stage || 'Veri bulunamadı';

    const ndviValue =
      resultAny?.ndvi ?? resultAny?.metrics?.ndvi ?? fieldAny?.ndvi ?? null;
    const ndreValue =
      resultAny?.ndre ?? resultAny?.metrics?.ndre ?? fieldAny?.ndre ?? null;
    const temperature =
      weatherAny?.temperature ?? weatherAny?.current?.temperature ?? climateAny?.temperature ?? null;
    const rain =
      weatherAny?.rain ?? weatherAny?.precipitation ?? climateAny?.precipitation ?? climateAny?.rainfall ?? null;
    const etValue =
      climateAny?.et ?? climateAny?.evapotranspiration ?? resultAny?.metrics?.et ?? null;

    const satelliteDate =
      resultAny?.satelliteDate || resultAny?.dataDate || resultAny?.latestDataDate || 'Veri tarihi bulunamadı';

    const satelliteImageUrl =
      resultAny?.satelliteImageUrl ||
      resultAny?.imageUrl ||
      resultAny?.mapImageUrl ||
      fieldAny?.satelliteImageUrl ||
      fieldAny?.mapImageUrl ||
      '';

    const fieldPhotoUrl =
      resultAny?.fieldPhotoUrl ||
      resultAny?.photoUrl ||
      fieldAny?.photoUrl ||
      '';
    const weatherDate =
      weatherAny?.date || weatherAny?.updatedAt || weatherAny?.observedAt || 'Veri tarihi bulunamadı';

    const evidence = (reportResult.evidence || [])
      .map(
        (item) =>
          `<li><b>${escapeHtml(item.layerLabel)}</b><span>${escapeHtml(item.finding)}</span></li>`,
      )
      .join('');

    const causes = (reportResult.likelyCauses || [])
      .map(
        (item) =>
          `<li><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.reason)}</span></li>`,
      )
      .join('');

    const importantArea = reportResult.importantArea
      ? `<div class="attention">
           <span class="eyebrow">DİKKAT EDİLECEK BÖLGE</span>
           <strong>${escapeHtml(reportResult.importantArea.area)}</strong>
           <p>${escapeHtml(reportResult.importantArea.summary)}</p>
         </div>`
      : `<div class="attention empty"><span class="eyebrow">DİKKAT EDİLECEK BÖLGE</span><strong>Belirgin bölge kaydı yok</strong><p>Mevcut değerlendirmede ayrı bir problem alanı işaretlenmedi.</p></div>`;

    const reportId = `TP-${String(synthesisField.id || 'FIELD').slice(0, 8).toUpperCase()}-${Date.now()
      .toString()
      .slice(-6)}`;

    const reportHtml = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<title>TarlaPusula - ${escapeHtml(synthesisField.name)} Tarla Raporu</title>
<style>
@page{size:A4 portrait;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#eef0f2;color:#111820;font-family:Arial,Helvetica,sans-serif}
.page{position:relative;width:210mm;height:297mm;margin:0 auto;background:#fff;display:grid;grid-template-rows:73mm 112mm 1fr;overflow:hidden;page-break-after:always}
.page:last-child{page-break-after:auto}
.top{padding:13mm 14mm 8mm;border-bottom:1px solid #dfe3e6}
.brandline{display:flex;align-items:center;justify-content:space-between;margin-bottom:8mm}
.brand{font-size:10px;font-weight:900;letter-spacing:.22em}
.premium{font-size:7px;font-weight:900;letter-spacing:.14em;background:#111820;color:#fff;border-radius:999px;padding:5px 8px}
.hero{display:grid;grid-template-columns:1.08fr .92fr;gap:8mm;align-items:stretch}
h1{font-size:22px;line-height:1.05;margin:0 0 3mm;letter-spacing:-.04em}
.subtitle{font-size:10px;color:#66717b;margin-bottom:5mm}
.field-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm}
.meta{border-top:1px solid #dfe3e6;padding-top:2mm}
.meta span,.eyebrow{display:block;color:#7b858e;font-size:6.5px;font-weight:900;letter-spacing:.12em;margin-bottom:1mm}
.meta strong{font-size:9px}

.report-accent{position:absolute;left:0;right:0;top:0;height:3mm;background:#111820;z-index:2}
.mapimage{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.satellite-placeholder{position:absolute;inset:0;background:linear-gradient(145deg,#d9dddf,#f4f5f6);overflow:hidden}
.sat-grid{position:absolute;inset:-20%;transform:rotate(-12deg);background-image:linear-gradient(rgba(17,24,32,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(17,24,32,.12) 1px,transparent 1px);background-size:9mm 9mm}
.parcel-shape{position:absolute;left:18%;top:18%;width:64%;height:61%;clip-path:polygon(12% 8%,75% 0,100% 43%,82% 100%,18% 88%,0 48%);background:rgba(255,255,255,.55);border:2px solid #111820;filter:drop-shadow(0 4px 8px rgba(0,0,0,.12))}
.north{position:absolute;right:3mm;top:3mm;background:#fff;border-radius:999px;padding:2mm;font-size:6px;font-weight:900}
.visual-note{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:70%;text-align:center;font-size:6px;font-weight:900;letter-spacing:.1em;color:#5e6870}
.mapshade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(0,0,0,.55))}
.maptag{position:absolute;left:3mm;top:3mm;background:#111820;color:#fff;border-radius:999px;padding:1.5mm 2.5mm;font-size:6px;font-weight:900;letter-spacing:.1em}
.field-photo-card{background:#fff;border:1px solid #dfe3e6;border-radius:4mm;padding:3mm;overflow:hidden}
.field-photo-card img{display:block;width:100%;height:26mm;object-fit:cover;border-radius:2.5mm;margin-top:2mm}
.mapbox{position:relative;min-height:42mm;border:1px solid #dfe3e6;border-radius:5mm;overflow:hidden;background:linear-gradient(145deg,#f1f3f4,#e2e6e8)}
.mapgrid{position:absolute;inset:0;background-image:linear-gradient(#cbd1d5 1px,transparent 1px),linear-gradient(90deg,#cbd1d5 1px,transparent 1px);background-size:12mm 12mm;opacity:.45}
.parcel{position:absolute;left:20%;top:18%;width:62%;height:60%;border:2px solid #111820;clip-path:polygon(10% 18%,75% 0,100% 55%,72% 100%,8% 82%,0 40%);background:rgba(255,255,255,.55)}
.maplabel{position:absolute;left:3mm;bottom:3mm;background:#fff;border:1px solid #dfe3e6;border-radius:2mm;padding:2mm 2.5mm;font-size:7px;font-weight:800}
.middle{padding:7mm 14mm;display:grid;grid-template-rows:auto 1fr;gap:4mm}
.section-title{display:flex;align-items:flex-end;justify-content:space-between}
.section-title h2{margin:0;font-size:13px;letter-spacing:-.02em}
.section-title span{font-size:7px;color:#7b858e}
.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}
.metric-card{border:1px solid #dfe3e6;border-radius:4mm;padding:4mm;min-width:0;background:linear-gradient(180deg,#fff,#fafbfb);box-shadow:0 2mm 5mm rgba(17,24,32,.045)}
.metric-card h3{font-size:9px;margin:0 0 3mm}
.kpi{display:flex;justify-content:space-between;gap:3mm;padding:2.3mm 0;border-bottom:1px solid #eceff1}
.kpi:last-of-type{border-bottom:0}
.kpi span{font-size:7px;color:#6c7780}
.kpi b{font-size:8px;text-align:right}
.spark{height:18mm;margin-top:3mm;display:flex;align-items:flex-end;gap:1.2mm;border-bottom:1px solid #dfe3e6}
.spark i{display:block;flex:1;background:#c7cdd1;border-radius:1mm 1mm 0 0}
.spark i:nth-child(1){height:32%}.spark i:nth-child(2){height:48%}.spark i:nth-child(3){height:42%}.spark i:nth-child(4){height:64%}.spark i:nth-child(5){height:58%}.spark i:nth-child(6){height:76%}.spark i:nth-child(7){height:69%}
.note{font-size:6.5px;color:#899198;margin-top:2mm}
.bottom{padding:7mm 14mm 10mm;background:#f7f8f9;border-top:1px solid #dfe3e6;display:grid;grid-template-columns:1.1fr .9fr;grid-template-rows:auto 1fr auto;gap:4mm 5mm}
.result{grid-column:1/-1;background:linear-gradient(135deg,#111820,#28323a);color:#fff;border-radius:4mm;padding:4mm 5mm;box-shadow:0 2mm 5mm rgba(17,24,32,.14)}
.result .eyebrow{color:#b9c0c5}
.result h2{font-size:14px;margin:0 0 1.5mm}
.result p{font-size:8px;line-height:1.45;margin:0;color:#e5e8ea}
.attention,.action,.evidence{background:#fff;border:1px solid #dfe3e6;border-radius:4mm;padding:4mm}
.attention strong,.action strong{display:block;font-size:10px;margin-bottom:1.5mm}
.attention p,.action p{font-size:7.5px;line-height:1.45;margin:0;color:#5f6a73}
.evidence ul,.causes{list-style:none;margin:0;padding:0}
.evidence li,.causes li{padding:1.7mm 0;border-bottom:1px solid #eceff1}
.evidence li:last-child,.causes li:last-child{border-bottom:0}
.evidence b,.evidence span,.causes b,.causes span{display:block;font-size:7px}
.evidence span,.causes span{color:#68737c;margin-top:.5mm}
.action{border:2px solid #111820}
.footer{grid-column:1/-1;display:flex;justify-content:space-between;gap:5mm;padding-top:2.5mm;border-top:1px solid #dfe3e6;color:#7b858e;font-size:6.5px}
.printbar{position:fixed;right:18px;top:18px;z-index:20;border:0;border-radius:9px;background:#111820;color:#fff;padding:11px 15px;font-weight:800;cursor:pointer;box-shadow:0 5px 18px rgba(0,0,0,.18)}
@media print{html,body{background:#fff}.printbar{display:none}.page{margin:0}}
</style>
</head>
<body>
<button class="printbar" onclick="window.print()">PDF olarak kaydet</button>

<article class="page">
  <div class="report-accent"></div>
  <section class="top">
    <div class="brandline">
      <div class="brand">TARLAPUSULA · PUSULA AI</div>
      <div class="premium">PREMIUM TARLA RAPORU</div>
    </div>
    <div class="hero">
      <div>
        <h1>${escapeHtml(synthesisField.name)}</h1>
        <div class="subtitle">Pusula Tarla Değerlendirme Raporu</div>
        <div class="field-meta">
          <div class="meta"><span>ÜRÜN</span><strong>${escapeHtml(cropName)}</strong></div>
          <div class="meta"><span>ALAN</span><strong>${areaValue == null ? 'Veri bulunamadı' : `${escapeHtml(areaValue)} ha`}</strong></div>
          <div class="meta"><span>GELİŞİM</span><strong>${escapeHtml(stageName)}</strong></div>
        </div>
      </div>
      <div class="mapbox">
        ${
          satelliteImageUrl
            ? `<img class="mapimage" src="${escapeHtml(satelliteImageUrl)}" alt="Tarla uydu görünümü"/>`
            : `<div class="satellite-placeholder">
                 <div class="sat-grid"></div>
                 <div class="parcel-shape"></div>
                 <div class="north">N ↑</div>
                 <div class="visual-note">GERÇEK HARİTA GÖRSELİ BAĞLI DEĞİL</div>
               </div>`
        }
        <div class="mapshade"></div>
        <div class="maptag">UYDU / PARSEL</div>
        <div class="maplabel">${escapeHtml(synthesisField.name)} · ${escapeHtml(satelliteDate)}</div>
      </div>
    </div>
  </section>

  <section class="middle">
    <div class="section-title">
      <h2>Tarla verileri</h2>
      <span>Yalnızca mevcut gerçek kayıtlar gösterilir</span>
    </div>
    <div class="metrics">
      <div class="metric-card">
        <h3>Bitki Sağlığı</h3>
        <div class="kpi"><span>NDVI</span><b>${safeValue(ndviValue)}</b></div>
        <div class="kpi"><span>NDRE</span><b>${safeValue(ndreValue)}</b></div>
        <div class="kpi"><span>Uydu veri tarihi</span><b>${escapeHtml(satelliteDate)}</b></div>
        <div class="spark"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="note">Grafik alanı: gerçek zaman serisi bağlandığında gerçek değerlerden çizilir.</div>
      </div>
      <div class="metric-card">
        <h3>Hava & Su</h3>
        <div class="kpi"><span>Sıcaklık</span><b>${safeValue(temperature, ' °C')}</b></div>
        <div class="kpi"><span>Yağış</span><b>${safeValue(rain, ' mm')}</b></div>
        <div class="kpi"><span>ET</span><b>${safeValue(etValue, ' mm')}</b></div>
        <div class="kpi"><span>Hava veri tarihi</span><b>${escapeHtml(weatherDate)}</b></div>
      </div>
      <div class="metric-card">
        <h3>Tarla Durumu</h3>
        <div class="kpi"><span>Ürün</span><b>${escapeHtml(cropName)}</b></div>
        <div class="kpi"><span>Gelişim evresi</span><b>${escapeHtml(stageName)}</b></div>
        <div class="kpi"><span>Kanıt katmanı</span><b>${safeValue(reportResult.layerCount)}</b></div>
        <div class="kpi"><span>Rapor tarihi</span><b>${new Date().toLocaleDateString('tr-TR')}</b></div>
      </div>
    </div>
  </section>

  <section class="bottom">
    <div class="result">
      <span class="eyebrow">PUSULA'NIN SONUCU</span>
      <h2>${escapeHtml(reportResult.headline)}</h2>
      <p>${escapeHtml(reportResult.summary)}</p>
    </div>

    ${importantArea}

    ${
      fieldPhotoUrl
        ? `<div class="field-photo-card">
             <span class="eyebrow">SAHA KANITI</span>
             <img src="${escapeHtml(fieldPhotoUrl)}" alt="Tarla saha fotoğrafı"/>
           </div>`
        : ''
    }

    <div class="action">
      <span class="eyebrow">NE YAPMALISIN?</span>
      <strong>Pusula'nın önerdiği sonraki adım</strong>
      <p>${escapeHtml(reportResult.action)}</p>
    </div>

    <div class="evidence">
      <span class="eyebrow">KANITLAR</span>
      <ul>${evidence || '<li><b>Kanıt listesi yok</b><span>Bu değerlendirmede ayrı kanıt kaydı bulunamadı.</span></li>'}</ul>
    </div>

    <div class="evidence">
      <span class="eyebrow">OLASI NEDENLER</span>
      <ul class="causes">${causes || '<li><b>Kesin neden atanmadı</b><span>Pusula mevcut veriden tanı üretmez.</span></li>'}</ul>
    </div>

    <div class="footer">
      <span>Rapor ID: ${reportId} · ${escapeHtml(reportResult.layerCount)} veri/harita kaydı harmanlandı</span>
      <span>${escapeHtml(reportResult.caution)}</span>
    </div>
  </section>
</article>

</body>
</html>`;

    const previous = document.getElementById('tp-pdf-report-overlay');
    previous?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'tp-pdf-report-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483600;background:#eef0f2;display:flex;flex-direction:column;';

    const toolbar = document.createElement('div');
    toolbar.style.cssText =
      'height:54px;flex:0 0 54px;background:#fff;border-bottom:1px solid #dfe3e6;display:flex;align-items:center;justify-content:space-between;padding:0 16px;font-family:Arial,Helvetica,sans-serif;';
    toolbar.innerHTML =
      '<strong style="font-size:13px;color:#111820">TarlaPusula · Premium Tarla Raporu</strong>';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = 'Kapat';
    closeButton.style.cssText =
      'border:1px solid #dfe3e6;border-radius:9px;background:#fff;color:#111820;padding:8px 12px;font-weight:800;cursor:pointer;';
    closeButton.onclick = () => overlay.remove();
    toolbar.appendChild(closeButton);

    const frame = document.createElement('iframe');
    frame.title = 'TarlaPusula Premium Tarla Raporu';
    frame.style.cssText = 'width:100%;height:calc(100vh - 54px);border:0;background:#fff;flex:1;';
    frame.srcdoc = reportHtml;

    overlay.appendChild(toolbar);
    overlay.appendChild(frame);
    document.body.appendChild(overlay);
  };

  const runSynthesis = async () => {
    if (!synthesisField?.id) return;
    const requestId = ++synthesisRequestRef.current;
    setSynthesisLoading(true);
    setSynthesisError('');
    try {
      const result = await synthesizeFieldObservations({
        fieldId: String(synthesisField.id),
        fieldName: synthesisField.name,
        crop: synthesisField.crop,
        weatherContext: synthesisWeatherContext,
        climateContext: synthesisClimateContext,
      });
      if (requestId !== synthesisRequestRef.current) return;
      setSynthesisResult(result);
      return result;
    } catch (error) {
      if (requestId !== synthesisRequestRef.current) return;
      setSynthesisResult(null);
      setSynthesisError(
        error instanceof Error ? error.message : 'Pusula genel değerlendirmeyi oluşturamadı.',
      );
    } finally {
      if (requestId === synthesisRequestRef.current) setSynthesisLoading(false);
    }
  };

  useEffect(() => {
    if (!synthesisField?.id) {
      setSynthesisResult(null);
      setSynthesisError('');
      return;
    }
    const timer = window.setTimeout(() => void runSynthesis(), 320);
    return () => window.clearTimeout(timer);
  }, [
    synthesisField?.id,
    synthesisWeather?.status,
    synthesisWeather?.forecast?.length,
  ]);

  const [tpAiMode, setTpAiMode] = useState<'hub' | 'photo' | 'field'>('hub');


  return (
    <>
      <style>{cmsRuntimeCss + onboardingStyles + PUSULA_AI_EXTRA_STYLES}</style>

      <div className="tp-ai-page">
        <div
          aria-hidden="true"
          style={{
            display: 'block',
            width: '100%',
            height: '64px',
            minHeight: '64px',
            flex: '0 0 64px',
            pointerEvents: 'none',
          }}
        />
        <main className="tp-ai-page-content">
        <style>{PUSULA_HUB_FINAL_STYLES}</style>
          <section className="tp-ai-hero">
            <div className="tp-ai-hero-icon">✦</div>

            <div>
              <span>{aiHeroBlock?.icon || 'AI TARLA ASİSTANI'}</span>
              <h1>
                {cmsText(
                  aiHeroBlock,
                  'Fotoğrafla saha gözlemi ekle.',
                )}
              </h1>
              <p>
                {cmsSub(
                  aiHeroBlock,
                  'Yaprak, meyve veya sorunlu bölgenin net bir fotoğrafını yükle. Fotoğraf sonucu tek başına kesin teşhis değildir; Pusula bunu saha kanıtı olarak değerlendirir.',
                )}
              </p>
            </div>
          </section>

          <section className="tp-pusula-hub-intro">
            <span className="tp-pusula-hub-kicker">PUSULA AI MERKEZİ</span>
            <h1>{synthesisField ? synthesisField.name : 'Tarlanı seç'}</h1>
            <p>Uydu, hava ve tarla kayıtlarını tek yerde değerlendir.</p>

            <div className="tp-pusula-hub-actions">
              <button
                type="button"
                className={`tp-pusula-hub-action ${isPremiumPlan ? '' : 'is-premium-locked'}`}
                onClick={queuePusulaPdf}
                disabled={synthesisLoading || !synthesisField || pusulaPdfStatus === 'loading'}
                aria-disabled={pusulaPdfStatus === 'loading'}
              >
                <span>✦</span>
                <strong>
                  {pusulaPdfStatus === 'loading' ? (pusulaPdfJob ? PUSULAPDF_STAGE_LABEL[pusulaPdfJob.stage] : 'Haftalık rapor hazırlanıyor') : pusulaPdfStatus === 'ready' ? 'Bu Haftanın Raporu Hazır' : 'Haftalık Pusula Tarla Raporu'}
                  {!isPremiumPlan ? <b className="tp-premium-badge">PREMIUM</b> : null}
                </strong>
                <small>
                  {pusulaPdfStatus === 'loading'
                    ? 'Arka planda hazırlanıyor. Bu ekrandan çıkabilirsin; hazır olduğunda bildirim altyapısına bağlanacak.'
                    : pusulaPdfStatus === 'ready'
                      ? (pusulaPdfNextAt ? `Bu haftanın kapsamlı raporu hazır · yeni rapor ${new Date(pusulaPdfNextAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} sonrası` : 'Bu haftanın kapsamlı raporu hazır.')
                      : 'Uydu, hava, toprak, sulama, riskler ve Pusula önerilerini tek kapsamlı PDF raporunda birleştir.'}
                </small>
              </button>

              {isPremiumPlan ? (
                <button
                  type="button"
                  className="tp-pusula-hub-action"
                  onClick={() => setPusulaPdfHistoryOpen((value) => !value)}
                  disabled={!synthesisField}
                >
                  <span>◷</span>
                  <strong>Eski Raporlarım</strong>
                  <small>{pusulaPdfHistory.length ? `${pusulaPdfHistory.length} rapor arşivde` : 'Geçmiş haftalık raporlarını burada göreceksin.'}</small>
                </button>
              ) : null}

              <button
                type="button"
                className="tp-pusula-hub-action primary"
                onClick={() => {
                  setTpAiMode('photo');
                  requestAnimationFrame(() => {
                    document.querySelector('.tp-ai-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  });
                }}
              >
                <span>⌁</span>
                <strong>Fotoğrafla İncele</strong>
                <small>Belirtiyi fotoğrafla incele.</small>
              </button>
            </div>
            {isPremiumPlan && pusulaPdfHistoryOpen ? (
              <div className="tp-pusula-pdf-ready">
                <div className="tp-pusula-pdf-ready-head">
                  <div className="tp-pusula-pdf-ready-copy">
                    <span>RAPOR ARŞİVİ</span>
                    <strong>Eski Raporlarım</strong>
                  </div>
                </div>
                {pusulaPdfHistory.length ? pusulaPdfHistory.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    className="tp-pusula-pdf-download"
                    style={{ marginTop: 8 }}
                    onClick={() => void openArchivedPusulaPdf(report).catch((error) => setPusulaPdfError(error instanceof Error ? error.message : 'Rapor açılamadı.'))}
                  >
                    {formatPusulaPdfDate(report.period_end)} · Haftalık raporu aç
                  </button>
                )) : <small>Henüz arşivlenmiş haftalık rapor yok.</small>}
              </div>
            ) : null}

            {pusulaPdfStatus === 'ready' && pusulaPdfReport ? (
              <div className="tp-pusula-pdf-ready" aria-live="polite">
                <div className="tp-pusula-pdf-ready-head">
                  <div className="tp-pusula-pdf-ready-copy">
                    <span>7 GÜNLÜK SNAPSHOT</span>
                    <strong>PUSULAPDF verisi hazır</strong>
                  </div>
                  <div className="tp-pusula-pdf-ready-period">
                    {formatPusulaPdfDate(pusulaPdfReport.period_start)} → {formatPusulaPdfDate(pusulaPdfReport.period_end)}
                  </div>
                </div>

                {pusulaPdfReport.report_data.missing.length > 0 ? (
                  <div className="tp-pusula-pdf-missing">
                    <span>Eksik veri kaynakları · {pusulaPdfReport.report_data.missing.length}</span>
                    <div className="tp-pusula-pdf-missing-list">
                      {pusulaPdfReport.report_data.missing.map((source) => (
                        <span className="tp-pusula-pdf-missing-chip" key={source}>
                          {pusulaPdfMissingLabels[source] ?? source}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="tp-pusula-pdf-complete">
                    Tüm bağlı veri kaynakları snapshot içine alındı.
                  </div>
                )}

                <small className="tp-pusula-pdf-note">
                  Eksik alanlar için değer üretilmez; rapor yalnızca mevcut gerçek kayıtları kullanır.
                </small>
                <div className="tp-pusula-pdf-complete">
                  <div className="tp-pusula-pdf-ready-row">
                    <span>✓ Arka planda tamamlandı</span>
                    <strong>%100</strong>
                  </div>
                  <button
                    type="button"
                    className="tp-pusula-pdf-download"
                    onClick={() => void handleReadyPusulaPdf()}
                    disabled={pusulaPdfDownloading}
                  >
                    {pusulaPdfDownloading ? 'PDF açılıyor…' : 'PDF’yi Aç / İndir'}
                  </button>
                  <small>Hazır snapshot kullanılır; tekrar veri toplanmaz.</small>
                </div>
              </div>
            ) : null}
            {pusulaPdfStatus === 'error' && pusulaPdfError ? <div className="tp-ai-page-error" style={{ marginTop: 10, padding: 11 }}>PUSULAPDF: {pusulaPdfError}</div> : null}
          </section>
          {premiumInfoOpen ? (
            <section className="tp-premium-info" aria-live="polite">
              <div>
                <span>PREMIUM ÖZELLİK</span>
                <strong>Toplu Tarla Değerlendirmesi</strong>
                <p>Premium PusulaPDF; uydu, NDVI, hava, iklim ve tarla kayıtlarını kapsamlı bir raporda birleştirir. Hazırlama arka planda sürer; rapor tamamlandığında bildirim gönderilir.</p>
              {pusulaPdfStatus === 'loading' && (
                <div className="tp-pusula-pdf-progress" aria-live="polite">
                  <div className="tp-pusula-pdf-progress-head">
                    <strong>{pusulaPdfJob ? PUSULAPDF_STAGE_LABEL[pusulaPdfJob.stage] : 'Sıraya alınıyor'}</strong>
                    <span>%{pusulaPdfJob ? pusulaPdfProgress[pusulaPdfJob.stage] : 3}</span>
                  </div>
                  <div
                    className="tp-pusula-pdf-progress-track"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pusulaPdfJob ? pusulaPdfProgress[pusulaPdfJob.stage] : 3}
                  >
                    <div
                      className="tp-pusula-pdf-progress-fill"
                      style={{ width: `${pusulaPdfJob ? pusulaPdfProgress[pusulaPdfJob.stage] : 3}%` }}
                    />
                  </div>
                  <small>
                    {(pusulaPdfJob?.progress_meta?.message as string) ||
                      'Rapor işi başlatılıyor. Bu ekrandan çıkabilirsin.'}
                  </small>
                </div>
              )}
              </div>
              <button type="button" onClick={() => setPremiumInfoOpen(false)}>Kapat</button>
            </section>
          ) : null}

        {tpAiMode !== 'hub' ? (
          <div className="tp-ai-modebar">
            <button type="button" onClick={() => setTpAiMode('hub')}>← Pusula AI merkezine dön</button>
          </div>
        ) : null}


          {tpAiMode === 'field' ? (
<section className="tp-pusula-synthesis">
            <div className="tp-pusula-synthesis-head">
              <div className="tp-pusula-synthesis-copy">
                <span className="tp-pusula-synthesis-kicker">PUSULA GENEL DEĞERLENDİRMESİ</span>
                <h2>{synthesisField ? synthesisField.name : 'Tarlanı seç'}</h2>
                <p>Pusula’dan Sana kayıtlarını birlikte okuyup aynı bölgede çakışan işaretleri karşılaştırıyorum.</p>

                {synthesisWeather?.status === 'ready' && (
                  <p style={{ marginTop: 5 }}>
                    5 günlük hava tahmini de genel değerlendirmeye dahil.
                  </p>
                )}
              </div>
            </div>

            {!synthesisField && (
              <div className="tp-pusula-synthesis-empty">
                <strong>Önce bir tarla eklemelisin.</strong>
                <p>Pusula genel değerlendirme yapabilmek için bir tarlanın kayıtlarına ihtiyaç duyar.</p>
              </div>
            )}

            {synthesisLoading && (
              <div className="tp-pusula-synthesis-progress">
                <strong>Pusula verileri harmanlıyor ve sonucu hazırlıyor{loadingDots}</strong>
                <span>Sağlık, radar, toprak ve iklim kayıtlarındaki son gözlemler karşılaştırılıyor.</span>
              </div>
            )}

            {!!synthesisError && !synthesisLoading && (
              <div className="tp-pusula-synthesis-error">
                <strong>Genel değerlendirme şu anda alınamadı.</strong>
                <span>Mevcut tarla ve fotoğraf işlemlerine devam edebilirsin. Pusula değerlendirmesini biraz sonra yeniden deneyebilirsin.</span>
                <button type="button" onClick={() => void runSynthesis()}>Yeniden dene</button>
              </div>
            )}

            {synthesisResult && !synthesisLoading && (
              <div className="tp-pusula-synthesis-result">
                <div className="tp-pusula-synthesis-status">
                  <div>
                    <span>PUSULA'NIN SONUCU</span>
                    <strong>{synthesisResult.headline}</strong>
                  </div>
                  <div className={`tp-pusula-status-pill ${synthesisResult.status}`}>
                    {synthesisResult.status === 'normal'
                      ? 'NORMAL'
                      : synthesisResult.status === 'dikkat'
                        ? 'DİKKAT'
                        : 'KONTROL'}
                  </div>
                </div>

                <p className="tp-pusula-main-summary">{synthesisResult.summary}</p>

                {synthesisResult.importantArea && (
                  <div className="tp-pusula-important-area">
                    <span>PUSULA'NIN ÖNEMLİ GÖRDÜĞÜ BÖLGE</span>
                    <strong>{synthesisResult.importantArea.area}</strong>
                    <p>{synthesisResult.importantArea.summary}</p>
                  </div>
                )}

                {synthesisResult.likelyCauses.length > 0 && (
                  <div className="tp-pusula-section">
                    <span className="tp-pusula-section-title">NE OLABİLİR?</span>
                    <div className="tp-pusula-causes">
                      {synthesisResult.likelyCauses.map((item, index) => (
                        <article className="tp-pusula-cause" key={`pusula-cause-${index}`}>
                          <strong>{item.title}</strong>
                          <p>{item.reason}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                {synthesisResult.evidence.length > 0 && (
                  <div className="tp-pusula-section">
                    <span className="tp-pusula-section-title">BUNU NEDEN SÖYLÜYORUM?</span>
                    <div className="tp-pusula-evidence">
                      {synthesisResult.evidence.map((item, index) => (
                        <div className="tp-pusula-evidence-row" key={`pusula-evidence-${index}`}>
                          <strong>{item.layerLabel}</strong>
                          <span>{item.finding}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {synthesisResult.evidence.length > 0 && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: '13px 14px',
                      borderRadius: 15,
                      border: '1px solid rgba(205,178,109,.14)',
                      background: 'rgba(255,255,255,.025)',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        marginBottom: 8,
                        color: '#cdb26d',
                        fontSize: 9,
                        fontWeight: 900,
                        letterSpacing: '.1em',
                      }}
                    >
                      PUSULA'NIN KULLANDIĞI VERİLER
                    </span>

                    {synthesisResult.evidence.slice(0, 6).map((item, index) => (
                      <p
                        key={`pusula-data-${index}`}
                        style={{
                          margin: index === 0 ? 0 : '7px 0 0',
                          color: '#aeb9b0',
                          fontSize: 11,
                          lineHeight: 1.5,
                        }}
                      >
                        <strong style={{ color: '#e7d9b5' }}>
                          {item.layerLabel}:
                        </strong>{' '}
                        {item.finding}
                      </p>
                    ))}
                  </div>
                )}

                <div className="tp-pusula-action">
                  <span>NE YAPMALISIN?</span>
                  <p>{synthesisResult.action}</p>
                </div>

                <div className="tp-pusula-synthesis-footer">
                  <span>{synthesisResult.layerCount} güncel harita kaydı harmanlandı</span>
                  <button
                    type="button"
                    className="tp-pusula-refresh"
                    onClick={() => void runSynthesis()}
                    disabled={synthesisLoading}
                  >
                    ↻ Yeniden Harmanla
                  </button>
                  {isPremiumPlan ? (
                    <button
                      type="button"
                      className="tp-pusula-pdf"
                      onClick={() => createSynthesisPdf()}
                    >
                      PDF Raporu Oluştur
                    </button>
                  ) : null}
                </div>

                <div className="tp-pusula-caution">{synthesisResult.caution}</div>
              </div>
            )}
          </section>
) : null}



          <section className="tp-ai-workspace">
            <div className="tp-ai-workspace-head">
              <div>
                <span>{aiFieldStepBlock?.icon || '1. TARLAYI SEÇ'}</span>
                <strong>
                  {cmsText(aiFieldStepBlock, 'Analizin hangi tarlaya ait?')}
                </strong>
              </div>
            </div>

            {realFields.length > 0 ? (
              <MobileWheelPicker
                className="tp-ai-field-select"
                title="Analiz edilecek tarla"
                value={selectedField ? String(selectedField.id) : ''}
                placeholder="Tarla seç"
                searchable
                options={realFields.map((field) => ({
                  value: String(field.id),
                  label: field.name,
                  subtitle: `${field.crop} • ${field.area.toLocaleString('tr-TR')} da`,
                }))}
                onChange={(value) => {
                  const field = realFields.find(
                    (item) => String(item.id) === value,
                  );
                  setSelectedField(field ?? null);
                  clearActivityPhoto();
                }}
              />
            ) : (
              <div className="tp-ai-empty-field">
                <strong>Önce bir tarla eklemelisin.</strong>
                <button onClick={openAddField}>+ Tarla Ekle</button>
              </div>
            )}

            <div className="tp-ai-workspace-head tp-ai-step-two">
              <div>
                <span>{aiPhotoStepBlock?.icon || '2. FOTOĞRAF'}</span>
                <strong>
                  {cmsText(
                    aiPhotoStepBlock,
                    'Belirtiyi net gösteren bir görüntü ekle',
                  )}
                </strong>
              </div>
            </div>

            {activityPhotoPreview ? (
              <div className="tp-ai-main-photo">
                <img src={activityPhotoPreview} alt="AI analiz fotoğrafı" />

                <div>
                  <strong>Fotoğraf hazır</strong>
                  <small>
                    Yakın çekim ve iyi ışık analiz kalitesini artırır.
                  </small>

                  <label>
                    Fotoğrafı Değiştir
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) =>
                        void handleActivityPhotoChange(e.target.files?.[0])
                      }
                    />
                  </label>

                  <button type="button" onClick={clearActivityPhoto}>
                    Fotoğrafı Kaldır
                  </button>
                </div>
              </div>
            ) : (
              <label className="tp-ai-main-picker">
                <div>📷</div>
                <strong>
                  {cmsText(aiPickerBlock, 'Fotoğraf Çek / Galeriden Seç')}
                </strong>
                <span>
                  {cmsSub(
                    aiPickerBlock,
                    'Yaprak, meyve, gövde veya sorunlu bölgeyi mümkün olduğunca net göster.',
                  )}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) =>
                    void handleActivityPhotoChange(e.target.files?.[0])
                  }
                />
              </label>
            )}

            <label className="tp-ai-note-field">
              {cmsText(aiNoteBlock, 'Gözlemin (isteğe bağlı)')}
              <textarea
                value={activityNotes}
                onChange={(e) => setActivityNotes(e.target.value)}
                placeholder="Örn: Yapraklardaki lekeler 3 gündür artıyor..."
              />
            </label>



            <button
              className="tp-ai-main-analyze"
              type="button"
              onClick={() => void handleAiAnalyzeActivityPhoto()}
              disabled={aiAnalyzing || !selectedField || !activityPhoto}
            >
              <span>{aiAnalyzing ? '◌' : '✦'}</span>
              {aiAnalyzing
                ? 'Pusula AI fotoğrafı inceliyor...'
                : cmsText(aiAnalyzeBlock, 'AI ile Analiz Et')}
            </button>

            {aiAnalysisError && (
              <div className="tp-ai-error tp-ai-page-error">
                Fotoğraf analizi şu anda tamamlanamadı. Fotoğrafın ve seçili tarlan korunuyor; biraz sonra yeniden deneyebilirsin.
              </div>
            )}

            {aiAnalysis && (
              <div
                className={`tp-ai-result tp-ai-page-result tp-ai-${aiAnalysis.status}`}
              >
                <div className="tp-ai-result-head">
                  <div>
                    <span>AI ÖN DEĞERLENDİRME</span>
                    <strong>{aiAnalysis.headline}</strong>
                  </div>

                  {diagnosisNeedsMoreEvidence ? (
                    <div className="tp-ai-confidence">
                      <span style={{ fontSize: 11, lineHeight: 1.05 }}>Teşhis</span>
                      <small>sürüyor</small>
                    </div>
                  ) : (
                    <div className="tp-ai-confidence">
                      %{aiAnalysis.confidence}
                      <small>güven</small>
                    </div>
                  )}
                </div>

                <div className="tp-ai-possible">
                  <span>Olası durum</span>
                  <strong>{aiAnalysis.possibleIssue}</strong>
                </div>

                {aiAnalysis.observations.length > 0 && (
                  <div className="tp-ai-list">
                    <span>Fotoğrafta görülenler</span>
                    {aiAnalysis.observations.map((item, index) => (
                      <p key={`main-ai-obs-${index}`}>• {item}</p>
                    ))}
                  </div>
                )}

                {diagnosisNeedsMoreEvidence ? (
                  <div style={{ marginTop: 14, padding: 14, border: '1px solid #d9dee2', borderRadius: 14, background: '#f7f8f8' }}>
                    <span style={{ display: 'block', color: '#5c7d65', fontSize: 9, fontWeight: 900, letterSpacing: '.08em' }}>TEŞHİSİ NETLEŞTİRELİM</span>
                    <strong style={{ display: 'block', marginTop: 5, color: '#111820', fontSize: 15 }}>Bir fotoğrafa daha ihtiyacım var</strong>
                    <p style={{ margin: '7px 0 12px', color: '#59636d', fontSize: 11, lineHeight: 1.45 }}>
                      {diagnosisRequestedEvidence || 'Belirtiyi daha yakından, net ve iyi ışıkta gösteren bir fotoğraf çek.'}
                    </p>
                    <label className="tp-ai-save-history" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: aiAnalyzing ? 'wait' : 'pointer' }}>
                      {aiAnalyzing ? 'İnceleniyor...' : `📷 ${Math.max(2, diagnosisSequenceNo + 1)}. Fotoğrafı Ekle`}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        disabled={aiAnalyzing}
                        style={{ display: 'none' }}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          event.currentTarget.value = '';
                          if (file) void handleDiagnosisFollowUpPhoto(file);
                        }}
                      />
                    </label>
                    <small style={{ display: 'block', marginTop: 8, color: '#7a838c', fontSize: 9, textAlign: 'center' }}>
                      {Math.max(1, diagnosisSequenceNo)} fotoğraf incelendi · Aynı teşhis vakası devam ediyor
                    </small>
                  </div>
                ) : (
                  <>
                    {aiAnalysis.recommendations.length > 0 && (
                      <div className="tp-ai-list">
                        <span>Önerilen adımlar</span>
                        {aiAnalysis.recommendations.map((item, index) => (
                          <p key={`main-ai-rec-${index}`}>• {item}</p>
                        ))}
                      </div>
                    )}
                    <OfficialVerificationCard verification={aiAnalysis.officialVerification} />
                    <div className="tp-ai-disclaimer">{aiAnalysis.disclaimer}</div>
                    <button
                      type="button"
                      className="tp-ai-save-history"
                      disabled={aiHistorySaveStatus === 'saving' || aiHistorySaveStatus === 'success'}
                      onClick={() => void handleSaveAiAnalysisToHistory()}
                      style={
                        aiHistorySaveStatus === 'success'
                          ? { background: '#edf8ef', borderColor: '#b9dfbf', color: '#246b35' }
                          : undefined
                      }
                    >
                      {aiHistorySaveStatus === 'saving'
                        ? 'Kaydediliyor...'
                        : aiHistorySaveStatus === 'success'
                          ? `✓ Tarla geçmişime kaydedildi${aiHistorySavedPoints > 0 ? ` · +${aiHistorySavedPoints} Puan` : ''}`
                          : '📒 Tarla geçmişime kaydet'}
                    </button>

                    {aiHistorySaveMessage && (
                      <div
                        role="status"
                        aria-live="polite"
                        style={{
                          marginTop: 8,
                          padding: '9px 10px',
                          borderRadius: 10,
                          border:
                            aiHistorySaveStatus === 'error'
                              ? '1px solid #f0c2bd'
                              : '1px solid #c9e4ce',
                          background:
                            aiHistorySaveStatus === 'error'
                              ? '#fff3f1'
                              : '#f1f8f2',
                          color:
                            aiHistorySaveStatus === 'error'
                              ? '#9a3027'
                              : '#2d6e3b',
                          fontSize: 10,
                          fontWeight: 800,
                          lineHeight: 1.4,
                          textAlign: 'center',
                        }}
                      >
                        {aiHistorySaveStatus === 'error' ? '✕ ' : '✓ '}
                        {aiHistorySaveMessage}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        </main>

        <nav className="tp-bottom" aria-label="Ana menü">
          <button type="button" onClick={() => setScreen('home')}>
            <span className="tp-bottom-icon-shell">
              <House className="tp-bottom-line-icon" aria-hidden="true" strokeWidth={1.8} />
            </span>
            Ana Sayfa
          </button>

          <button
            type="button"
            onClick={() => setScreen('weatherHub')}
            aria-label="Hava Durumu"
          >
            <span className="tp-bottom-icon-shell">
              <CloudSun className="tp-bottom-line-icon" aria-hidden="true" strokeWidth={1.8} />
            </span>
            Hava Durumu
          </button>

          <button className="ai" type="button" aria-current="page">
            <span className="tp-bottom-ai-shell">
              <Sparkles className="tp-bottom-line-icon" aria-hidden="true" strokeWidth={1.8} />
            </span>
            Pusula AI
          </button>

          <button type="button" onClick={openCalendarScreen}>
            <span className="tp-bottom-icon-shell">
              <CalendarDays className="tp-bottom-line-icon" aria-hidden="true" strokeWidth={1.8} />
            </span>
            Takvim
          </button>

          <button
            type="button"
            aria-label="Tarlalarım listesini aç"
            onClick={() => {
              setScreen('home');
              window.setTimeout(() => {
                const target = document.querySelector(
                  'button[aria-label="Tarlalarım listesini aç"]',
                ) as HTMLButtonElement | null;
                target?.click();
              }, 80);
            }}
          >
            <span className="tp-bottom-icon-shell">
              <MapPinned className="tp-bottom-line-icon" aria-hidden="true" strokeWidth={1.8} />
            </span>
            Tarlalarım
          </button>
        </nav>
      </div>
    </>
  );
}
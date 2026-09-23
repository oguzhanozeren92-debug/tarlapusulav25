import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { createPortal } from 'react-dom';
import { Bell, ClipboardList } from 'lucide-react';
import HomeMapSection from './HomeMapSection';
import {
  HOME_CLIMATE_DEPTH_LABELS,
  HOME_CLIMATE_LAYER_LABELS,
  HOME_SOIL_DEPTH_LABELS,
  HOME_SOIL_PROPERTY_LABELS,
  type HomeClimateDepth,
  type HomeClimateLayer,
  type HomeLayer,
  type HomeSoilDepth,
  type HomeSoilProperty,
} from '../HomeMapEngine';

type HomeMapSectionMapFirstProps = ComponentProps<typeof HomeMapSection> & {
  onOpenToday?: () => void;
  onOpenNotifications?: () => void;
  onOpenTasks?: () => void;
  notificationCount?: number;
};

type LayerOption = {
  id: HomeLayer;
  label: string;
  shortLabel: string;
  hint: string;
};

const LAYERS: LayerOption[] = [
  {
    id: 'vegetation',
    label: 'Bitki Sağlığı',
    shortLabel: 'NDVI',
    hint: 'Sentinel-2 · bitki gelişim farkları',
  },
  {
    id: 'radar-vv',
    label: 'Nemli Alanlar',
    shortLabel: 'VV',
    hint: 'Sentinel-1 · yüzey radar sinyali',
  },
  {
    id: 'radar-vh',
    label: 'Yüzey & Bitki Farkı',
    shortLabel: 'VH',
    hint: 'Sentinel-1 · yapı ve bitki farkları',
  },
  {
    id: 'radar-water',
    label: 'Su Birikimi Riski',
    shortLabel: 'Su',
    hint: 'Sentinel-1 · göllenme / su adayı alanlar',
  },
];

const CSS = String.raw`
.tp-map-first-shell{
  position:relative;
}

/* =========================================================
   MAP-FIRST V2 — DAHA FERAH, ÇAKIŞMASIZ
   ========================================================= */
.tp-map-first-shell .tp-home-field{
  overflow:hidden!important;
}

.tp-map-first-shell .tp-ref-map-title,
.tp-map-first-shell .tp-map-section-heading{
  display:none!important;
}

/* Başlık alanı artık yalnızca tarla seçimi + 2 küçük aksiyon. */
.tp-map-first-shell .tp-field-head{
  min-height:54px!important;
  display:block!important;
  padding:6px 9px!important;
  border-bottom:1px solid rgba(30,58,36,.52)!important;
  background:linear-gradient(180deg,rgba(3,12,6,.96),rgba(2,8,4,.94))!important;
}

.tp-map-first-shell .tp-field-head::after{
  display:none!important;
}

.tp-map-first-shell .tp-field-head::before{
  opacity:.05!important;
}

.tp-map-first-shell .tp-field-toolbar{
  width:100%!important;
  max-width:none!important;
  display:grid!important;
  grid-template-columns:40px minmax(0,1fr) 40px 40px!important;
  gap:6px!important;
  align-items:center!important;
  margin:0!important;
}

.tp-map-first-shell .tp-field-select-wrap{
  min-width:0!important;
}

.tp-map-first-shell .tp-field-select-wrap>small{
  display:none!important;
}

.tp-map-first-shell .tp-field-select-box{
  width:100%!important;
  min-height:40px!important;
  height:40px!important;
  border-radius:11px!important;
  background:rgba(3,13,7,.70)!important;
  border-color:rgba(82,113,90,.20)!important;
  box-shadow:none!important;
}

.tp-map-first-shell .tp-field-pin{
  opacity:.68!important;
}

.tp-map-first-shell .tp-field-select{
  height:38px!important;
  min-height:38px!important;
  font-size:10.5px!important;
}

.tp-map-first-shell .tp-field-toolbar .tp-add-field-3d{
  position:static!important;
  width:40px!important;
  height:40px!important;
  min-width:40px!important;
  min-height:40px!important;
  border-radius:11px!important;
  border-color:rgba(82,113,90,.20)!important;
  background:rgba(3,13,7,.70)!important;
  box-shadow:none!important;
}

.tp-map-first-shell .tp-field-toolbar .tp-add-field-3d:hover{
  background:rgba(7,25,13,.82)!important;
  border-color:rgba(101,142,111,.32)!important;
}

.tp-mf-operation-toolbar{
  width:40px!important;
  height:40px!important;
  min-width:40px!important;
  min-height:40px!important;
  display:grid!important;
  place-items:center!important;
  padding:0!important;
  order:-1!important;
  border:1px solid rgba(82,113,90,.20)!important;
  border-radius:11px!important;
  background:rgba(3,13,7,.70)!important;
  color:rgba(213,247,223,.92)!important;
  box-shadow:none!important;
  cursor:pointer!important;
  font-size:18px!important;
  line-height:1!important;
}

.tp-mf-operation-toolbar:hover{
  background:rgba(7,25,13,.82)!important;
  border-color:rgba(34,197,94,.30)!important;
  box-shadow:0 0 16px rgba(34,197,94,.07)!important;
}

.tp-mf-operation-toolbar:active{
  transform:translateY(1px);
}

/* Eski üst katman sekmeleri tamamen kalkıyor. */
.tp-map-first-shell .tp-map-shortcut-stack,
.tp-map-first-shell .tp-layer-subbar,
.tp-map-first-shell .tp-soil-popover{
  display:none!important;
}

/* =========================================================
   HARİTA GERÇEKTEN ALANI DOLDURSUN
   ========================================================= */
.tp-map-first-shell .tp-map-stage{
  height:510px!important;
  min-height:510px!important;
  overflow:hidden!important;
  border-top:0!important;
  background:#020804!important;
}

/* HomeInlineLayerMap inline height=390 gelse bile stage'i tamamen doldur. */
.tp-map-first-shell .tp-map-stage>.tp-real-home-map{
  height:100%!important;
  min-height:100%!important;
}

.tp-map-first-shell .tp-real-home-map,
.tp-map-first-shell .tp-real-home-map-canvas,
.tp-map-first-shell .tp-real-home-map .maplibregl-map,
.tp-map-first-shell .tp-real-home-map .maplibregl-canvas-container{
  height:100%!important;
}

/* Eski veri kartları artık alan kaplamasın. */
.tp-map-first-shell .tp-real-home-badge,
.tp-map-first-shell .tp-map-data-badge,
.tp-map-first-shell .tp-ndvi-legend-card{
  display:none!important;
}

/*
 * NDVI görünümünde eski legend/gradient kalıntısı bazen HMR sonrasında
 * DOM'da kalıp haritanın üstünde boş beyaz bir şerit gibi görünebiliyor.
 * Yeni NDVI açıklaması tp-mf-ndvi üzerinden geldiği için eski legend'i
 * yalnız vegetation katmanında kesin olarak gizle. Diğer katmanlar etkilenmez.
 */
.tp-map-first-shell.tp-map-first-layer-vegetation
.tp-real-home-map > .tp-real-home-legend,
.tp-map-first-shell.tp-map-first-layer-vegetation
.tp-real-home-map > .tp-gradient,
.tp-map-first-shell.tp-map-first-layer-vegetation
.tp-real-home-map .tp-real-home-legend .tp-gradient{
  display:none!important;
  visibility:hidden!important;
  width:0!important;
  height:0!important;
  min-height:0!important;
  margin:0!important;
  padding:0!important;
  border:0!important;
}

/* Sağ harita araçları, katman düğmesinin altında tek hat. */
.tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-top-right{
  top:55px!important;
  right:10px!important;
}

.tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-group{
  border-color:rgba(128,161,136,.18)!important;
  background:rgba(2,10,5,.84)!important;
  box-shadow:0 7px 20px rgba(0,0,0,.28)!important;
}

/* =========================================================
   KATMANLAR — ÜSTTE PANEL DEĞİL, HARİTA ALT SHEET
   ========================================================= */
.tp-mf-layer-trigger{
  position:absolute;
  z-index:35;
  top:10px;
  right:10px;
  min-height:36px;
  display:flex;
  align-items:center;
  gap:6px;
  padding:0 9px;
  border:1px solid rgba(128,161,136,.20);
  border-radius:10px;
  background:rgba(2,10,5,.86);
  backdrop-filter:blur(9px);
  -webkit-backdrop-filter:blur(9px);
  color:rgba(232,240,234,.90);
  box-shadow:0 7px 20px rgba(0,0,0,.24);
  cursor:pointer;
}

.tp-mf-layer-trigger svg{
  width:15px;
  height:15px;
  stroke:rgba(159,190,166,.82);
  fill:none;
}

.tp-mf-layer-trigger span{
  display:grid;
  gap:1px;
  text-align:left;
}

.tp-mf-layer-trigger small{
  color:rgba(154,172,159,.52);
  font-size:6.3px;
  font-weight:800;
  letter-spacing:.06em;
  text-transform:uppercase;
}

.tp-mf-layer-trigger strong{
  color:rgba(235,242,236,.92);
  font-size:8.3px;
  font-weight:850;
}

/* Haritanın altından açılır; Pusula bandının üstünde kalır. */
.tp-mf-layer-panel{
  position:absolute;
  z-index:42;
  left:50%;
  right:auto;
  top:auto;
  bottom:76px;
  width:min(520px,calc(100% - 24px));
  max-height:min(310px,calc(100% - 96px));
  display:flex;
  flex-direction:column;
  transform:translateX(-50%);
  overflow:hidden;
  border:1px solid rgba(128,161,136,.20);
  border-radius:16px;
  background:
    radial-gradient(circle at 90% 0%,rgba(70,105,79,.10),transparent 34%),
    rgba(2,10,5,.96);
  backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
  box-shadow:0 18px 50px rgba(0,0,0,.48);
}

.tp-mf-layer-panel-head{
  flex:0 0 auto;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  padding:10px 11px 8px;
  border-bottom:1px solid rgba(128,161,136,.09);
}

.tp-mf-layer-panel-head div{
  min-width:0;
}

.tp-mf-layer-panel-head small{
  display:block;
  color:rgba(139,178,149,.64);
  font-size:6.6px;
  font-weight:900;
  letter-spacing:.09em;
  text-transform:uppercase;
}

.tp-mf-layer-panel-head strong{
  display:block;
  margin-top:2px;
  color:rgba(237,243,238,.92);
  font-size:10.5px;
}

.tp-mf-layer-panel-close{
  width:27px;
  height:27px;
  border:0;
  border-radius:8px;
  background:rgba(255,255,255,.028);
  color:rgba(217,229,220,.70);
  font-size:16px;
  cursor:pointer;
}

.tp-mf-layer-list{
  min-height:0;
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:5px;
  padding:8px 8px 12px;
  overflow-y:auto;
  overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;
  scrollbar-width:thin;
  scrollbar-color:rgba(170,188,175,.34) transparent;
}

.tp-mf-layer-list::-webkit-scrollbar{
  width:4px;
}

.tp-mf-layer-list::-webkit-scrollbar-track{
  background:transparent;
}

.tp-mf-layer-list::-webkit-scrollbar-thumb{
  border-radius:999px;
  background:rgba(170,188,175,.34);
}

.tp-mf-layer-option{
  min-width:0;
  min-height:48px;
  display:flex;
  flex-direction:column;
  align-items:flex-start;
  justify-content:center;
  padding:7px 8px;
  border:1px solid rgba(90,120,98,.11);
  border-radius:10px;
  background:rgba(255,255,255,.014);
  color:rgba(203,216,206,.66);
  text-align:left;
  cursor:pointer;
}

.tp-mf-layer-option:hover{
  border-color:rgba(128,161,136,.24);
  background:rgba(89,124,98,.045);
}

.tp-mf-layer-option.active{
  border-color:rgba(111,164,124,.34);
  background:rgba(74,116,83,.11);
  color:rgba(238,246,240,.94);
}

.tp-mf-layer-option strong{
  overflow:hidden;
  max-width:100%;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:8.5px;
  font-weight:850;
}

.tp-mf-layer-option small{
  margin-top:2px;
  overflow:hidden;
  max-width:100%;
  text-overflow:ellipsis;
  white-space:nowrap;
  color:rgba(164,181,168,.46);
  font-size:6.2px;
  line-height:1.2;
}


/* =========================================================
   TOPRAK / İKLİM ALT KATMANLARI
   Eski subbar map-first görünümünde gizliydi. Artık seçili katmanın
   gerçek alt seçenekleri haritanın üzerinde erişilebilir.
   ========================================================= */
.tp-mf-sublayer-trigger{
  position:absolute;
  z-index:36;
  top:10px;
  left:10px;
  max-width:calc(100% - 68px);
  min-height:36px;
  display:flex;
  align-items:center;
  gap:7px;
  padding:0 10px;
  border:1px solid rgba(128,161,136,.20);
  border-radius:10px;
  background:rgba(2,10,5,.88);
  backdrop-filter:blur(10px);
  -webkit-backdrop-filter:blur(10px);
  color:rgba(232,240,234,.90);
  box-shadow:0 7px 20px rgba(0,0,0,.24);
  cursor:pointer;
}

.tp-mf-sublayer-trigger small{
  color:rgba(143,181,152,.68);
  font-size:6.5px;
  font-weight:900;
  letter-spacing:.07em;
  text-transform:uppercase;
}

.tp-mf-sublayer-trigger strong{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  color:rgba(235,242,236,.92);
  font-size:8.5px;
  font-weight:850;
}

.tp-mf-sublayer-panel{
  position:absolute;
  z-index:43;
  top:8px;
  left:8px;
  right:8px;
  width:auto;
  overflow:hidden;
  border:1px solid rgba(128,161,136,.20);
  border-radius:14px;
  background:
    radial-gradient(circle at 0% 0%,rgba(70,105,79,.10),transparent 34%),
    rgba(2,10,5,.965);
  backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
  box-shadow:0 16px 44px rgba(0,0,0,.44);
}

.tp-mf-sublayer-head{
  min-height:35px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  padding:7px 8px 6px 10px;
  border-bottom:1px solid rgba(128,161,136,.09);
}

.tp-mf-sublayer-head div{
  min-width:0;
}

.tp-mf-sublayer-head small{
  display:block;
  color:rgba(139,178,149,.64);
  font-size:6.2px;
  font-weight:900;
  letter-spacing:.08em;
  text-transform:uppercase;
}

.tp-mf-sublayer-head strong{
  display:block;
  margin-top:2px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  color:rgba(237,243,238,.92);
  font-size:9.2px;
}

.tp-mf-sublayer-close{
  width:25px;
  height:25px;
  flex:0 0 25px;
  display:grid;
  place-items:center;
  border:0;
  border-radius:8px;
  background:rgba(255,255,255,.025);
  color:rgba(217,229,220,.72);
  font-size:15px;
  cursor:pointer;
}

.tp-mf-sublayer-group{
  padding:7px 8px 8px;
}

.tp-mf-sublayer-group + .tp-mf-sublayer-group{
  padding-top:0;
}

.tp-mf-sublayer-label{
  display:block;
  margin:0 2px 5px;
  color:rgba(158,178,163,.52);
  font-size:6.2px;
  font-weight:850;
  letter-spacing:.055em;
  text-transform:uppercase;
}

.tp-mf-sublayer-scroll{
  display:flex;
  gap:5px;
  max-width:100%;
  overflow-x:auto;
  overscroll-behavior-x:contain;
  scrollbar-width:none;
  padding-bottom:1px;
}

.tp-mf-sublayer-scroll::-webkit-scrollbar{
  display:none;
}

/* İklim seçenekleri tek sırada, eşit genişlikte ve iki satırlı. */
.tp-mf-climate-data-grid{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:5px;
  overflow:visible;
  padding-bottom:0;
}

.tp-mf-climate-data-grid .tp-mf-sublayer-chip{
  width:100%;
  min-width:0;
  min-height:38px;
  padding:4px 5px;
  white-space:normal;
  line-height:1.08;
  text-align:center;
}

.tp-mf-sublayer-chip{
  flex:0 0 auto;
  min-height:28px;
  padding:0 9px;
  border:1px solid rgba(90,120,98,.12);
  border-radius:8px;
  background:rgba(255,255,255,.014);
  color:rgba(199,214,203,.66);
  font-size:7.3px;
  font-weight:800;
  white-space:nowrap;
  cursor:pointer;
}

.tp-mf-sublayer-chip.active{
  border-color:rgba(73,181,103,.36);
  background:rgba(34,197,94,.105);
  color:rgba(226,246,232,.94);
  box-shadow:inset 0 0 0 1px rgba(34,197,94,.04);
}

@media(max-width:560px){
  .tp-mf-sublayer-trigger{
    top:8px;
    left:8px;
    max-width:calc(100% - 58px);
    min-height:34px;
    padding:0 8px;
  }

  .tp-mf-sublayer-panel{
    top:8px;
    left:8px;
    right:8px;
    width:auto;
    max-height:176px;
  }

  .tp-mf-sublayer-chip{
    min-height:27px;
    padding:0 8px;
    font-size:7px;
  }
}


/* =========================================================
   NDVI — SOL ÜST KÖŞEDE KÜÇÜK KULP, SAĞA DOĞRU AÇILIR
   ========================================================= */
.tp-mf-ndvi{
  position:absolute;
  z-index:34;
  top:10px;
  left:9px;
  display:flex;
  align-items:stretch;
  max-width:calc(100% - 105px);
  transform:none;
  border:1px solid rgba(128,161,136,.18);
  border-radius:10px;
  background:rgba(2,10,5,.86);
  backdrop-filter:blur(10px);
  -webkit-backdrop-filter:blur(10px);
  box-shadow:0 7px 20px rgba(0,0,0,.26);
}

.tp-mf-ndvi-handle{
  width:48px;
  min-width:48px;
  min-height:34px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:4px;
  padding:0 5px;
  border:0;
  border-radius:9px;
  background:transparent;
  color:rgba(219,232,222,.84);
  cursor:pointer;
}

.tp-mf-ndvi-handle b{
  font-size:7.4px;
  font-weight:900;
  letter-spacing:.045em;
}

.tp-mf-ndvi-handle i{
  color:rgba(143,181,152,.62);
  font-size:11px;
  font-style:normal;
}

.tp-mf-ndvi.open .tp-mf-ndvi-handle{
  border-radius:9px 0 0 9px;
  border-right:1px solid rgba(128,161,136,.10);
}

.tp-mf-ndvi-body{
  width:150px;
  padding:8px 9px 7px;
  animation:tpMfLegendOpen .16s ease both;
}

@keyframes tpMfLegendOpen{
  from{opacity:0;transform:translateX(-4px)}
  to{opacity:1;transform:translateX(0)}
}

.tp-mf-ndvi-body>strong{
  display:block;
  margin-bottom:6px;
  color:rgba(235,243,237,.92);
  font-size:8.2px;
}

.tp-mf-ndvi-row{
  min-height:18px;
  display:grid;
  grid-template-columns:6px 43px 1fr;
  align-items:center;
  gap:4px;
}

.tp-mf-ndvi-row i{
  width:6px;
  height:6px;
  border-radius:999px;
  box-shadow:0 0 7px currentColor;
}

.tp-mf-ndvi-row span,
.tp-mf-ndvi-row b{
  color:rgba(204,216,207,.66);
  font-size:6.4px;
  font-weight:700;
}

.tp-mf-ndvi-row b{
  color:rgba(224,233,226,.76);
}

.tp-mf-ndvi-row.very i{background:#22c55e;color:#22c55e}
.tp-mf-ndvi-row.good i{background:#84cc16;color:#84cc16}
.tp-mf-ndvi-row.medium i{background:#f59e0b;color:#f59e0b}
.tp-mf-ndvi-row.weak i{background:#ef4444;color:#ef4444}

.tp-mf-ndvi-average{
  margin-top:6px;
  padding-top:6px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  border-top:1px solid rgba(128,161,136,.09);
}

.tp-mf-ndvi-average span{
  color:rgba(157,174,161,.50);
  font-size:6.2px;
}

.tp-mf-ndvi-average strong{
  color:rgba(236,243,237,.90);
  font-size:8.3px;
}

/* =========================================================
   MOBİL
   ========================================================= */
@media(max-width:560px){
  .tp-map-first-shell .tp-field-head{
    min-height:50px!important;
    padding:5px 7px!important;
  }

  .tp-map-first-shell .tp-field-toolbar{
    grid-template-columns:38px minmax(0,1fr) 38px 38px!important;
    gap:5px!important;
  }

  .tp-mf-operation-toolbar{
    width:38px!important;
    height:38px!important;
    min-width:38px!important;
    min-height:38px!important;
    border-radius:10px!important;
    font-size:17px!important;
  }

  .tp-map-first-shell .tp-field-select-box{
    min-height:38px!important;
    height:38px!important;
  }

  .tp-map-first-shell .tp-field-select{
    height:36px!important;
    min-height:36px!important;
  }

  .tp-map-first-shell .tp-field-toolbar .tp-add-field-3d{
    width:38px!important;
    height:38px!important;
    min-width:38px!important;
    min-height:38px!important;
  }

  .tp-map-first-shell .tp-map-stage{
    height:495px!important;
    min-height:495px!important;
  }

  .tp-mf-layer-trigger{
    top:8px;
    right:8px;
    min-height:33px;
    padding:0 8px;
  }

  .tp-mf-layer-trigger small{
    display:none;
  }

  .tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-top-right{
    top:48px!important;
    right:8px!important;
  }

  .tp-mf-layer-panel{
    bottom:72px;
    width:calc(100% - 16px);
    max-height:min(300px,calc(100% - 88px));
    border-radius:14px;
  }

  .tp-mf-layer-list{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }

  .tp-mf-ndvi{
    top:8px;
    left:7px;
    max-width:calc(100% - 92px);
  }

  .tp-mf-ndvi-handle{
    width:44px;
    min-width:44px;
    min-height:32px;
  }

  .tp-mf-ndvi-body{
    width:138px;
  }
}

/* =========================================================
   MAP-FIRST V3 — SAĞ KONTROLLER TEK DÜZEN
   Katmanlar + zoom +/- aynı kolon; gereksiz tekrarlar gizli.
   ========================================================= */

.tp-mf-layer-trigger{
  top:10px!important;
  right:10px!important;
  width:40px!important;
  height:40px!important;
  min-width:40px!important;
  min-height:40px!important;
  padding:0!important;
  display:grid!important;
  place-items:center!important;
  border-radius:11px!important;
}

.tp-mf-layer-trigger svg{
  width:18px!important;
  height:18px!important;
}

.tp-mf-layer-trigger span{
  display:none!important;
}

/* Alt katman paneli açıkken sağdaki harita araçları panelin altına iner. */
.tp-map-first-shell .tp-map-stage:has(.tp-mf-sublayer-panel) .tp-map-control-rail{
  top:146px!important;
}

/*
 * Sağ kontrol rayı.
 * ÖNEMLİ: child sırasına göre ikon gizleme yok.
 * Katman değişiminde conditional butonlar girip çıktığı için :first/:last-child
 * kullanmak yanlış ikonu saklıyordu.
 */
.tp-map-first-shell .tp-map-control-rail{
  top:55px!important;
  right:10px!important;
  z-index:33!important;
  border-radius:11px!important;
  border-color:rgba(128,161,136,.18)!important;
  background:rgba(2,10,5,.84)!important;
  box-shadow:0 7px 20px rgba(0,0,0,.27)!important;
}

/* Yalnız eski/tekrarlı "tarlayı ortala" kontrolü gizli kalır. */
.tp-map-first-shell .tp-map-control-rail .tp-map-fit-control{
  display:none!important;
}

/* NDVI'ye dönüldüğünde bu iki kontrol mutlaka tekrar görünür. */
.tp-map-first-shell .tp-map-control-rail .tp-map-tracking-control,
.tp-map-first-shell .tp-map-control-rail .tp-map-satellite-history-control{
  display:grid!important;
  place-items:center!important;
}

.tp-map-first-shell .tp-map-control-rail .tp-map-control-btn{
  width:40px!important;
  height:40px!important;
  min-width:40px!important;
  min-height:40px!important;
  flex:0 0 40px!important;
  color:rgba(230,239,232,.88)!important;
}

.tp-map-first-shell .tp-map-control-rail .tp-map-control-btn svg{
  width:19px!important;
  height:19px!important;
}

/* Alt sağ pusula daha sessiz */
.tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-bottom-right{
  right:10px!important;
  bottom:10px!important;
  top:auto!important;
}

.tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group.tp-map-compass,
.tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-bottom-right .tp-map-compass__button{
  width:38px!important;
  height:38px!important;
  min-width:38px!important;
  min-height:38px!important;
  border-radius:10px!important;
  opacity:.88!important;
}

.tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-bottom-right .tp-map-compass__rose{
  width:31px!important;
  height:31px!important;
  margin-left:-15.5px!important;
  margin-top:-15.5px!important;
}

/* MapLibre'ın eski sağ üst kontrolleri tekrar görünmesin */
.tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-top-right{
  display:none!important;
}

@media(max-width:560px){
  .tp-mf-layer-trigger{
    top:8px!important;
    right:8px!important;
    width:36px!important;
    height:36px!important;
    min-width:36px!important;
    min-height:36px!important;
  }

  .tp-map-first-shell .tp-map-control-rail{
    top:49px!important;
    right:8px!important;
  }

  .tp-map-first-shell .tp-map-stage:has(.tp-mf-sublayer-panel) .tp-map-control-rail{
    top:148px!important;
  }

  .tp-map-first-shell .tp-map-control-rail .tp-map-control-btn{
    width:36px!important;
    height:36px!important;
    min-width:36px!important;
    min-height:36px!important;
    flex-basis:36px!important;
  }

  .tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-bottom-right{
    right:8px!important;
    bottom:8px!important;
  }

  .tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-bottom-right .maplibregl-ctrl-group.tp-map-compass,
  .tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-bottom-right .tp-map-compass__button{
    width:34px!important;
    height:34px!important;
    min-width:34px!important;
    min-height:34px!important;
    border-radius:9px!important;
  }

  .tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-bottom-right .tp-map-compass__rose{
    width:28px!important;
    height:28px!important;
    margin-left:-14px!important;
    margin-top:-14px!important;
  }
}

/* Mobilde harita dikey tam ekran açılır; cihaz yönünü değiştirmez. */
@media(max-width:760px){
  .tp-map-first-shell.tp-map-portrait-active,
  .tp-map-first-shell.tp-map-portrait-active .tp-home-field{
    overflow:visible!important;
    isolation:auto!important;
    z-index:2147483000!important;
  }

  .tp-map-first-shell .tp-map-stage.tp-map-portrait-fullscreen{
    position:fixed!important;
    inset:0!important;
    z-index:2147483001!important;
    width:100vw!important;
    height:100vh!important;
    height:100dvh!important;
    min-height:100vh!important;
    min-height:100dvh!important;
    margin:0!important;
    border:0!important;
    border-radius:0!important;
    background:#020804!important;
  }

  .tp-map-first-shell .tp-map-stage.tp-map-portrait-fullscreen>.tp-real-home-map,
  .tp-map-first-shell .tp-map-stage.tp-map-portrait-fullscreen .tp-real-home-map-canvas{
    height:100%!important;
    min-height:100%!important;
  }

  .tp-map-portrait-close{
    position:absolute;
    z-index:100;
    top:max(12px, env(safe-area-inset-top));
    left:50%;
    transform:translateX(-50%);
    width:44px;
    height:44px;
    display:grid;
    place-items:center;
    border:1px solid rgba(128,161,136,.32);
    border-radius:12px;
    background:rgba(2,10,5,.92);
    color:#e5f5e8;
    font:600 27px/1 system-ui,sans-serif;
    box-shadow:0 6px 20px rgba(0,0,0,.35);
  }
}


/* =========================================================
   PUSULA — KÜÇÜK HARİTADA DA HER ZAMAN GÖRÜNÜR
   Sağ kontrol rayının altında kalmaz; normal ve tam ekranda
   aynı gerçek MapLibre pusulası kullanılır.
   ========================================================= */

html body .tp-map-first-shell
.tp-real-home-map
.maplibregl-ctrl-bottom-right{
  display:block!important;
  visibility:visible!important;
  opacity:1!important;
  top:auto!important;
  right:10px!important;
  bottom:10px!important;
  z-index:48!important;
  pointer-events:none!important;
}

html body .tp-map-first-shell
.tp-real-home-map
.maplibregl-ctrl-bottom-right
.maplibregl-ctrl-group.tp-map-compass{
  display:grid!important;
  place-items:center!important;
  width:44px!important;
  height:44px!important;
  min-width:44px!important;
  min-height:44px!important;
  margin:0!important;
  overflow:hidden!important;
  border:1px solid rgba(17,24,39,.18)!important;
  border-radius:13px!important;
  background:rgba(255,255,255,.95)!important;
  box-shadow:
    0 7px 20px rgba(0,0,0,.18),
    inset 0 1px 0 rgba(255,255,255,.95)!important;
  backdrop-filter:blur(10px)!important;
  -webkit-backdrop-filter:blur(10px)!important;
  pointer-events:auto!important;
  opacity:1!important;
}

html body .tp-map-first-shell
.tp-real-home-map
.maplibregl-ctrl-bottom-right
.tp-map-compass__button{
  display:block!important;
  position:relative!important;
  width:44px!important;
  height:44px!important;
  min-width:44px!important;
  min-height:44px!important;
  padding:0!important;
  border:0!important;
  border-radius:13px!important;
  background:transparent!important;
  color:#171b20!important;
  opacity:1!important;
}

html body .tp-map-first-shell
.tp-real-home-map
.maplibregl-ctrl-bottom-right
.tp-map-compass__button::before{
  display:none!important;
  content:none!important;
}

html body .tp-map-first-shell
.tp-real-home-map
.tp-map-compass__rose{
  position:absolute!important;
  inset:4px!important;
  width:auto!important;
  height:auto!important;
  margin:0!important;
  opacity:1!important;
}

html body .tp-map-first-shell
.tp-real-home-map
.tp-map-compass__ring{
  inset:6px!important;
  border:1px solid rgba(31,41,55,.20)!important;
  box-shadow:none!important;
}

html body .tp-map-first-shell
.tp-real-home-map
.tp-map-compass__ticks{
  inset:4px!important;
  opacity:.72!important;
}

html body .tp-map-first-shell
.tp-real-home-map
.tp-map-compass__label{
  color:#5f6873!important;
  font-size:6.2px!important;
  font-weight:900!important;
  line-height:1!important;
  text-shadow:none!important;
  opacity:1!important;
}

html body .tp-map-first-shell
.tp-real-home-map
.tp-map-compass__north{
  top:0!important;
  color:#111827!important;
  font-size:7.5px!important;
}

html body .tp-map-first-shell
.tp-real-home-map
.tp-map-compass__south{
  bottom:0!important;
}

html body .tp-map-first-shell
.tp-real-home-map
.tp-map-compass__east{
  right:0!important;
}

html body .tp-map-first-shell
.tp-real-home-map
.tp-map-compass__west{
  left:0!important;
}

html body .tp-map-first-shell
.tp-real-home-map
.tp-map-compass__needle{
  width:10px!important;
  height:22px!important;
  filter:none!important;
}

html body .tp-map-first-shell
.tp-real-home-map
.tp-map-compass__needle-north{
  border-left-width:3px!important;
  border-right-width:3px!important;
  border-bottom-width:10px!important;
  border-bottom-color:#111827!important;
}

html body .tp-map-first-shell
.tp-real-home-map
.tp-map-compass__needle-south{
  border-left-width:2.5px!important;
  border-right-width:2.5px!important;
  border-top-width:9px!important;
  border-top-color:#9ca3af!important;
}

html body .tp-map-first-shell
.tp-real-home-map
.tp-map-compass__center{
  width:5px!important;
  height:5px!important;
  border:1px solid #fff!important;
  background:#111827!important;
  box-shadow:0 0 0 1px rgba(17,24,39,.18)!important;
}

/* Dikey tam ekranda biraz daha büyük ve safe-area içinde. */
@media(max-width:760px){
  html body .tp-map-first-shell
  .tp-real-home-map
  .maplibregl-ctrl-bottom-right{
    top:auto!important;
    right:10px!important;
    bottom:10px!important;
  }

  html body .tp-map-first-shell
  .tp-map-stage.tp-map-portrait-fullscreen
  .tp-real-home-map
  .maplibregl-ctrl-bottom-right{
    right:max(14px, env(safe-area-inset-right))!important;
    bottom:max(16px, env(safe-area-inset-bottom))!important;
  }

  html body .tp-map-first-shell
  .tp-real-home-map
  .maplibregl-ctrl-bottom-right
  .maplibregl-ctrl-group.tp-map-compass,
  html body .tp-map-first-shell
  .tp-real-home-map
  .maplibregl-ctrl-bottom-right
  .tp-map-compass__button{
    width:42px!important;
    height:42px!important;
    min-width:42px!important;
    min-height:42px!important;
    border-radius:12px!important;
  }
}


/* =========================================================
   PUSULA SON KONUM / BOYUT DÜZELTMESİ
   Normal haritada alt bilgi bandının ÜSTÜNDE görünür.
   Tam ekranda sağ altta, büyük ve tam ortalanmış görünür.
   ========================================================= */

/* MapLibre kontrol köşesi kesin görünür. */
html body .tp-map-first-shell
.tp-real-home-map
.maplibregl-ctrl-bottom-right{
  display:block!important;
  visibility:visible!important;
  opacity:1!important;
  top:auto!important;
  right:10px!important;
  bottom:10px!important;
  margin:0!important;
  z-index:95!important;
  pointer-events:none!important;
}

/* Normal/küçük harita */
html body .tp-map-first-shell
.tp-map-stage:not(.tp-map-portrait-fullscreen)
.tp-real-home-map
.maplibregl-ctrl-bottom-right{
  position:absolute!important;
  top:auto!important;
  left:auto!important;
  right:10px!important;
  bottom:10px!important;
  display:flex!important;
  flex-direction:column!important;
  align-items:flex-end!important;
  justify-content:flex-end!important;
  width:auto!important;
  height:auto!important;
  margin:0!important;
  transform:none!important;
  z-index:160!important;
}

/* Kontrol kutusu */
html body .tp-map-first-shell
.tp-real-home-map
.maplibregl-ctrl-bottom-right
.maplibregl-ctrl-group.tp-map-compass{
  display:grid!important;
  place-items:center!important;
  width:48px!important;
  height:48px!important;
  min-width:48px!important;
  min-height:48px!important;
  margin:0!important;
  padding:0!important;
  border-radius:14px!important;
  opacity:1!important;
  pointer-events:auto!important;
}

/* İç buton */
html body .tp-map-first-shell
.tp-real-home-map
.maplibregl-ctrl-bottom-right
.tp-map-compass__button{
  display:block!important;
  position:relative!important;
  width:48px!important;
  height:48px!important;
  min-width:48px!important;
  min-height:48px!important;
  margin:0!important;
  padding:0!important;
  border-radius:14px!important;
  opacity:1!important;
}

/* Pusulanın tam merkezde kalmasını zorla. */
html body .tp-map-first-shell
.tp-real-home-map
.maplibregl-ctrl-bottom-right
.tp-map-compass__rose{
  position:absolute!important;
  inset:4px!important;
  width:auto!important;
  height:auto!important;
  margin:0!important;
}

/* Tam ekran: biraz daha büyük, sağ altta düzgün boşlukla. */
html body .tp-map-first-shell
.tp-map-stage.tp-map-portrait-fullscreen
.tp-real-home-map
.maplibregl-ctrl-bottom-right{
  right:max(18px, env(safe-area-inset-right))!important;
  bottom:max(22px, env(safe-area-inset-bottom))!important;
}

html body .tp-map-first-shell
.tp-map-stage.tp-map-portrait-fullscreen
.tp-real-home-map
.maplibregl-ctrl-bottom-right
.maplibregl-ctrl-group.tp-map-compass,
html body .tp-map-first-shell
.tp-map-stage.tp-map-portrait-fullscreen
.tp-real-home-map
.maplibregl-ctrl-bottom-right
.tp-map-compass__button{
  width:58px!important;
  height:58px!important;
  min-width:58px!important;
  min-height:58px!important;
  border-radius:16px!important;
}

html body .tp-map-first-shell
.tp-map-stage.tp-map-portrait-fullscreen
.tp-real-home-map
.maplibregl-ctrl-bottom-right
.tp-map-compass__rose{
  inset:5px!important;
}

@media(max-width:560px){
  html body .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-map
  .maplibregl-ctrl-bottom-right{
    right:8px!important;
    bottom:8px!important;
  }

  html body .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-map
  .maplibregl-ctrl-bottom-right
  .maplibregl-ctrl-group.tp-map-compass,
  html body .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-map
  .maplibregl-ctrl-bottom-right
  .tp-map-compass__button{
    width:46px!important;
    height:46px!important;
    min-width:46px!important;
    min-height:46px!important;
    border-radius:13px!important;
  }
}



/* =========================================================
   BLACK / WHITE CONTROL OVERRIDE
   NDVI kulpu ve mobil tam ekran kapatma tuşu.
   ========================================================= */
.tp-mf-ndvi{
  border-color:rgba(17,24,39,.16)!important;
  background:rgba(255,255,255,.96)!important;
  box-shadow:0 6px 18px rgba(17,24,39,.12)!important;
}

.tp-mf-ndvi-handle{
  background:#ffffff!important;
  color:#111827!important;
}

.tp-mf-ndvi-handle b,
.tp-mf-ndvi-handle i{
  color:#111827!important;
  -webkit-text-fill-color:#111827!important;
  opacity:1!important;
  text-shadow:none!important;
}

html body .tp-map-first-shell .tp-mf-ndvi .tp-mf-ndvi-handle,
html body .tp-map-first-shell .tp-mf-ndvi .tp-mf-ndvi-handle b,
html body .tp-map-first-shell .tp-mf-ndvi .tp-mf-ndvi-handle i{
  color:#111827!important;
  -webkit-text-fill-color:#111827!important;
  opacity:1!important;
}

.tp-mf-ndvi.open .tp-mf-ndvi-handle{
  border-right-color:#e5e7eb!important;
}

.tp-mf-ndvi-body{
  background:#ffffff!important;
}

.tp-mf-ndvi-body>strong,
.tp-mf-ndvi-row span,
.tp-mf-ndvi-row b,
.tp-mf-ndvi-average strong{
  color:#111827!important;
}

.tp-mf-ndvi-average span{
  color:#6b7280!important;
}

.tp-mf-ndvi-average{
  border-top-color:#e5e7eb!important;
}

.tp-map-portrait-close{
  border:1px solid #d7dde2!important;
  background:#ffffff!important;
  color:#111827!important;
  box-shadow:0 6px 18px rgba(17,24,39,.14)!important;
}

.tp-map-portrait-close:hover{
  background:#f4f6f7!important;
}


/* =========================================================
   KATMAN SHEET + GERCEK MOBIL TAM EKRAN — SON OVERRIDE
   - Katman secici Pusula bandinin altinda kalmaz.
   - Dört ana katman mobilde 2x2 ve tamamen görünür.
   - Tam ekran stage görünür viewport ölçüsünü birebir kaplar.
   ========================================================= */
@media(max-width:760px){
  .tp-map-first-shell .tp-mf-layer-panel{
    top:56px!important;
    bottom:auto!important;
    left:8px!important;
    right:8px!important;
    width:auto!important;
    max-height:calc(100% - 126px)!important;
    transform:none!important;
    border-radius:14px!important;
  }

  .tp-map-first-shell .tp-mf-layer-list{
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    gap:6px!important;
    padding:8px 8px 10px!important;
    overflow-y:auto!important;
  }

  .tp-map-first-shell .tp-mf-layer-option{
    min-height:48px!important;
  }

  .tp-map-first-shell .tp-map-stage.tp-map-portrait-fullscreen{
    position:fixed!important;
    inset:auto!important;
    top:0!important;
    left:0!important;
    right:auto!important;
    bottom:auto!important;
    width:100vw!important;
    max-width:none!important;
    height:100vh!important;
    height:100dvh!important;
    min-height:100vh!important;
    min-height:100dvh!important;
    max-height:none!important;
    margin:0!important;
    padding:0!important;
    overflow:hidden!important;
    border:0!important;
    border-radius:0!important;
    z-index:2147483647!important;
  }

  .tp-map-first-shell .tp-map-stage.tp-map-portrait-fullscreen>.tp-real-home-map,
  .tp-map-first-shell .tp-map-stage.tp-map-portrait-fullscreen .tp-real-home-map-canvas,
  .tp-map-first-shell .tp-map-stage.tp-map-portrait-fullscreen .maplibregl-map,
  .tp-map-first-shell .tp-map-stage.tp-map-portrait-fullscreen .maplibregl-canvas-container,
  .tp-map-first-shell .tp-map-stage.tp-map-portrait-fullscreen .maplibregl-canvas{
    width:100%!important;
    max-width:none!important;
    height:100%!important;
    min-height:100%!important;
    max-height:none!important;
  }

  .tp-map-first-shell .tp-map-stage.tp-map-portrait-fullscreen .tp-mf-layer-panel{
    top:max(68px, calc(env(safe-area-inset-top) + 58px))!important;
    bottom:auto!important;
    left:max(10px, env(safe-area-inset-left))!important;
    right:max(10px, env(safe-area-inset-right))!important;
    width:auto!important;
    max-height:calc(100dvh - 150px)!important;
    transform:none!important;
  }
}

/* Son garanti: normal haritada pusula doğrudan sağ altta görünür. */
@media(max-width:760px){
  html body .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-map
  .maplibregl-ctrl-bottom-right{
    display:block!important;
    visibility:visible!important;
    opacity:1!important;
    top:auto!important;
    right:10px!important;
    bottom:12px!important;
    z-index:140!important;
  }
}

/* =========================================================
   STAGE PUSULASI — MAPLIBRE KÖŞESİNDEN BAĞIMSIZ
   Normal ve tam ekranda doğrudan görünür harita alanına çizilir.
   ========================================================= */
.tp-map-first-shell .tp-map-stage{
  position:relative!important;
}

.tp-map-first-shell .tp-mf-stage-compass{
  position:absolute!important;
  z-index:72!important;
  top:auto!important;
  left:auto!important;
  right:12px!important;
  bottom:12px!important;
  width:46px!important;
  height:46px!important;
  min-width:46px!important;
  min-height:46px!important;
  margin:0!important;
  padding:0!important;
  display:grid!important;
  place-items:center!important;
  overflow:hidden!important;
  border:1px solid rgba(17,24,39,.18)!important;
  border-radius:13px!important;
  background:rgba(255,255,255,.96)!important;
  box-shadow:0 7px 20px rgba(0,0,0,.20)!important;
  color:#111827!important;
  cursor:pointer!important;
  pointer-events:auto!important;
  -webkit-tap-highlight-color:transparent!important;
}

.tp-map-first-shell .tp-mf-stage-compass .tp-mf-stage-compass-rose{
  position:relative!important;
  inset:auto!important;
  width:38px!important;
  height:38px!important;
  margin:0!important;
  transform:rotate(14deg);
  transform-origin:50% 50%!important;
}

.tp-map-first-shell .tp-mf-stage-compass .tp-mf-stage-compass-ring{
  position:absolute;
  inset:4px;
  border:1px solid rgba(17,24,39,.24);
  border-radius:50%;
}

.tp-map-first-shell .tp-mf-stage-compass .tp-mf-stage-compass-ticks{
  position:absolute;
  inset:2px;
  border-radius:50%;
  background:
    linear-gradient(#111827,#111827) center top/1px 4px no-repeat,
    linear-gradient(#9ca3af,#9ca3af) center bottom/1px 3px no-repeat,
    linear-gradient(90deg,#9ca3af,#9ca3af) left center/3px 1px no-repeat,
    linear-gradient(90deg,#9ca3af,#9ca3af) right center/3px 1px no-repeat;
}

.tp-map-first-shell .tp-mf-stage-compass .tp-mf-stage-compass-label{
  position:absolute;
  z-index:3;
  color:#6b7280;
  font:900 6px/1 Inter,system-ui,sans-serif;
  user-select:none;
}
.tp-map-first-shell .tp-mf-stage-compass .north{top:0;left:50%;transform:translateX(-50%);color:#111827;font-size:7px}
.tp-map-first-shell .tp-mf-stage-compass .south{bottom:0;left:50%;transform:translateX(-50%)}
.tp-map-first-shell .tp-mf-stage-compass .east{right:0;top:50%;transform:translateY(-50%)}
.tp-map-first-shell .tp-mf-stage-compass .west{left:0;top:50%;transform:translateY(-50%)}

.tp-map-first-shell .tp-mf-stage-compass .tp-mf-stage-compass-needle{
  position:absolute;
  z-index:4;
  left:50%;
  top:50%;
  width:10px;
  height:22px;
  transform:translate(-50%,-50%);
}
.tp-map-first-shell .tp-mf-stage-compass .tp-mf-stage-compass-needle::before{
  content:'';
  position:absolute;
  left:50%;
  top:0;
  transform:translateX(-50%);
  border-left:3px solid transparent;
  border-right:3px solid transparent;
  border-bottom:10px solid #111827;
}
.tp-map-first-shell .tp-mf-stage-compass .tp-mf-stage-compass-needle::after{
  content:'';
  position:absolute;
  left:50%;
  bottom:0;
  transform:translateX(-50%);
  border-left:2.5px solid transparent;
  border-right:2.5px solid transparent;
  border-top:9px solid #9ca3af;
}
.tp-map-first-shell .tp-mf-stage-compass .tp-mf-stage-compass-center{
  position:absolute;
  z-index:5;
  left:50%;
  top:50%;
  width:5px;
  height:5px;
  transform:translate(-50%,-50%);
  border:1px solid #fff;
  border-radius:50%;
  background:#111827;
}

.tp-map-first-shell .tp-map-stage.tp-map-portrait-fullscreen .tp-mf-stage-compass{
  right:max(16px,env(safe-area-inset-right))!important;
  bottom:max(18px,env(safe-area-inset-bottom))!important;
  width:54px!important;
  height:54px!important;
  min-width:54px!important;
  min-height:54px!important;
  border-radius:15px!important;
}
.tp-map-first-shell .tp-map-stage.tp-map-portrait-fullscreen .tp-mf-stage-compass .tp-mf-stage-compass-rose{
  width:44px!important;
  height:44px!important;
}

@media(max-width:560px){
  .tp-map-first-shell .tp-map-stage:not(.tp-map-portrait-fullscreen) .tp-mf-stage-compass{
    right:9px!important;
    /* Normal görünümde Pusula yorum bandının hemen üstünde kalır. */
    bottom:12px!important;
    width:44px!important;
    height:44px!important;
    min-width:44px!important;
    min-height:44px!important;
  }
  .tp-map-first-shell .tp-map-stage:not(.tp-map-portrait-fullscreen) .tp-mf-stage-compass .tp-mf-stage-compass-rose{
    width:36px!important;
    height:36px!important;
  }
}


/* =========================================================
   FULLSCREEN V4 — NORMAL HARİTA VE TAM EKRAN AYRI DÜZEN
   Tam ekran stage document.body altına taşınır. Böylece uygulama header,
   Pusula bandı ve alt navigasyon haritanın üstüne binemez.
   ========================================================= */

/* Native MapLibre pusulası kullanılmıyor; tek pusula React stage pusulası. */
.tp-map-first-shell .tp-real-home-map .maplibregl-ctrl-group.tp-map-compass,
body.tp-map-body-fullscreen .tp-map-stage .maplibregl-ctrl-group.tp-map-compass{
  display:none!important;
  visibility:hidden!important;
  pointer-events:none!important;
}

/* Normal ana sayfa haritası: pusula gerçekten HARİTANIN sağ alt köşesinde. */
.tp-map-first-shell .tp-map-stage:not(.tp-map-portrait-fullscreen){
  position:relative!important;
}
.tp-map-first-shell .tp-map-stage:not(.tp-map-portrait-fullscreen) .tp-mf-stage-compass{
  position:absolute!important;
  top:auto!important;
  left:auto!important;
  right:10px!important;
  bottom:10px!important;
  z-index:180!important;
  width:44px!important;
  height:44px!important;
  min-width:44px!important;
  min-height:44px!important;
}
.tp-map-first-shell .tp-map-stage:not(.tp-map-portrait-fullscreen) .tp-mf-stage-compass .tp-mf-stage-compass-rose{
  width:36px!important;
  height:36px!important;
}

body.tp-map-body-fullscreen{
  overflow:hidden!important;
  overscroll-behavior:none!important;
}

body.tp-map-body-fullscreen .tp-map-stage.tp-map-portrait-fullscreen{
  position:fixed!important;
  inset:0!important;
  width:100vw!important;
  height:100dvh!important;
  min-height:100dvh!important;
  max-height:none!important;
  margin:0!important;
  padding:0!important;
  overflow:hidden!important;
  border:0!important;
  border-radius:0!important;
  background:#020804!important;
  z-index:2147483647!important;
  isolation:isolate!important;
}

body.tp-map-body-fullscreen .tp-map-stage.tp-map-portrait-fullscreen>.tp-real-home-map,
body.tp-map-body-fullscreen .tp-map-stage.tp-map-portrait-fullscreen .tp-real-home-map-canvas,
body.tp-map-body-fullscreen .tp-map-stage.tp-map-portrait-fullscreen .maplibregl-map,
body.tp-map-body-fullscreen .tp-map-stage.tp-map-portrait-fullscreen .maplibregl-canvas-container,
body.tp-map-body-fullscreen .tp-map-stage.tp-map-portrait-fullscreen .maplibregl-canvas{
  width:100%!important;
  height:100%!important;
  min-height:100%!important;
  max-height:none!important;
}

/* TAM EKRAN ÜST SATIR: kapat solda, katman sağda. */
body.tp-map-body-fullscreen .tp-map-stage .tp-map-portrait-close{
  position:absolute!important;
  top:max(12px,env(safe-area-inset-top))!important;
  left:max(12px,env(safe-area-inset-left))!important;
  right:auto!important;
  transform:none!important;
  z-index:240!important;
  width:44px!important;
  height:44px!important;
  border-radius:13px!important;
}

body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-trigger{
  position:absolute!important;
  top:max(12px,env(safe-area-inset-top))!important;
  right:max(12px,env(safe-area-inset-right))!important;
  left:auto!important;
  z-index:230!important;
  width:44px!important;
  height:44px!important;
  min-width:44px!important;
  min-height:44px!important;
  border-radius:13px!important;
}

/* Sağ araç rayı tek kolon; katman düğmesinin hemen altında. */
body.tp-map-body-fullscreen .tp-map-stage .tp-map-control-rail{
  position:absolute!important;
  top:max(66px,calc(env(safe-area-inset-top) + 66px))!important;
  right:max(12px,env(safe-area-inset-right))!important;
  left:auto!important;
  bottom:auto!important;
  z-index:220!important;
  display:flex!important;
  flex-direction:column!important;
  align-items:stretch!important;
  gap:0!important;
  width:44px!important;
  padding:0!important;
  margin:0!important;
  overflow:hidden!important;
  border:1px solid #d7dde2!important;
  border-radius:13px!important;
  background:rgba(255,255,255,.96)!important;
  box-shadow:0 7px 20px rgba(17,24,39,.18)!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-map-control-rail .tp-map-fit-control{
  display:none!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-map-control-rail .tp-map-control-btn{
  width:44px!important;
  height:44px!important;
  min-width:44px!important;
  min-height:44px!important;
  flex:0 0 44px!important;
  margin:0!important;
  border:0!important;
  border-bottom:1px solid #e5e7eb!important;
  border-radius:0!important;
  background:#fff!important;
  color:#111827!important;
  box-shadow:none!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-map-control-rail .tp-map-control-btn:last-child{
  border-bottom:0!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-map-control-rail .tp-map-control-btn span{
  display:none!important;
}

/* NDVI etiketi kapanın yanına; katman/araç kolonuna girmez. */
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-ndvi{
  top:max(12px,env(safe-area-inset-top))!important;
  left:max(68px,calc(env(safe-area-inset-left) + 68px))!important;
  right:auto!important;
  bottom:auto!important;
  z-index:215!important;
  max-width:calc(100% - 136px)!important;
}

/* Katman sheet açıldığında üst kontrol satırının ALTINDAN başlar. */
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-panel{
  position:absolute!important;
  top:max(68px,calc(env(safe-area-inset-top) + 68px))!important;
  left:max(12px,env(safe-area-inset-left))!important;
  right:max(12px,env(safe-area-inset-right))!important;
  bottom:auto!important;
  width:auto!important;
  max-height:calc(100dvh - 160px)!important;
  z-index:235!important;
  transform:none!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-list{
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
}

/* Alt düzen: legend solda-yukarı, tarih ortada, pusula sağ altta. */
body.tp-map-body-fullscreen .tp-map-stage .tp-real-home-legend{
  position:absolute!important;
  left:max(12px,env(safe-area-inset-left))!important;
  right:auto!important;
  bottom:max(76px,calc(env(safe-area-inset-bottom) + 76px))!important;
  z-index:205!important;
  width:min(190px,calc(100% - 86px))!important;
  max-width:190px!important;
  margin:0!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-home-spatial-note{
  left:max(12px,env(safe-area-inset-left))!important;
  right:auto!important;
  bottom:max(130px,calc(env(safe-area-inset-bottom) + 130px))!important;
  z-index:206!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-measurement-date{
  left:50%!important;
  right:auto!important;
  top:auto!important;
  bottom:max(16px,calc(env(safe-area-inset-bottom) + 16px))!important;
  transform:translateX(-50%)!important;
  z-index:210!important;
  max-width:calc(100% - 150px)!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-stage-compass{
  position:absolute!important;
  top:auto!important;
  left:auto!important;
  right:max(12px,env(safe-area-inset-right))!important;
  bottom:max(12px,env(safe-area-inset-bottom))!important;
  z-index:225!important;
  width:50px!important;
  height:50px!important;
  min-width:50px!important;
  min-height:50px!important;
  border-radius:14px!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-stage-compass .tp-mf-stage-compass-rose{
  width:41px!important;
  height:41px!important;
}

/* Eski büyük veri kartları tam ekranda geri dönmesin. */
body.tp-map-body-fullscreen .tp-map-stage .tp-real-home-badge,
body.tp-map-body-fullscreen .tp-map-stage .tp-map-data-badge,
body.tp-map-body-fullscreen .tp-map-stage .tp-ndvi-legend-card{
  display:none!important;
}

/* Küçük ekranlarda biraz daha kompakt. */
@media(max-width:430px){
  body.tp-map-body-fullscreen .tp-map-stage .tp-map-portrait-close,
  body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-trigger,
  body.tp-map-body-fullscreen .tp-map-stage .tp-map-control-rail,
  body.tp-map-body-fullscreen .tp-map-stage .tp-map-control-rail .tp-map-control-btn{
    width:40px!important;
    min-width:40px!important;
  }
  body.tp-map-body-fullscreen .tp-map-stage .tp-map-portrait-close,
  body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-trigger,
  body.tp-map-body-fullscreen .tp-map-stage .tp-map-control-rail .tp-map-control-btn{
    height:40px!important;
    min-height:40px!important;
  }
  body.tp-map-body-fullscreen .tp-map-stage .tp-map-control-rail{
    top:max(60px,calc(env(safe-area-inset-top) + 60px))!important;
  }
  body.tp-map-body-fullscreen .tp-map-stage .tp-real-home-legend{
    max-width:170px!important;
    bottom:max(70px,calc(env(safe-area-inset-bottom) + 70px))!important;
  }
  body.tp-map-body-fullscreen .tp-map-stage .tp-mf-stage-compass{
    width:46px!important;
    height:46px!important;
    min-width:46px!important;
    min-height:46px!important;
  }
}

/* =========================================================
   NORMAL TELEFON — ALT BİLGİLER GÜVENLİ BÖLGEDE
   Radar veri tarihi + legend ekranın altında kalmasın.
   Tam ekran düzenini etkilemez.
   ========================================================= */
@media(max-width:760px){
  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-legend{
    left:10px!important;
    right:auto!important;
    top:auto!important;
    bottom:158px!important;
    width:min(215px,64%)!important;
    max-width:215px!important;
    margin:0!important;
    z-index:172!important;
  }

  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-measurement-date{
    left:50%!important;
    right:auto!important;
    top:auto!important;
    bottom:236px!important;
    transform:translateX(-50%)!important;
    max-width:calc(100% - 92px)!important;
    z-index:176!important;
  }

  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-home-spatial-note{
    bottom:210px!important;
    z-index:174!important;
  }
}

@media(max-width:430px){
  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-legend{
    bottom:152px!important;
    width:min(205px,62%)!important;
  }

  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-measurement-date{
    bottom:228px!important;
    max-width:calc(100% - 84px)!important;
  }
}

/* =========================================================
   NORMAL MOBİL V7 — RADAR LEGENDİ KESİNLİKLE YUKARIDA
   Eski stil/HMR sırası ne olursa olsun son söz burada.
   ========================================================= */
@media(max-width:760px){
  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-legend{
    top:auto!important;
    bottom:158px!important;
    transform:none!important;
  }

  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-measurement-date{
    top:auto!important;
    bottom:236px!important;
  }
}

@media(max-width:430px){
  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-legend{
    bottom:152px!important;
  }

  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-measurement-date{
    bottom:228px!important;
  }
}

/* =========================================================
   V10 — TARİH + LEGEND TEK ALT BİLGİ GRUBU
   Normal mobilde ve tam ekranda iki parça birlikte hareket eder:
   üstte tarih pill'i, hemen altında ortalanmış renk açıklaması.
   ========================================================= */
@media(max-width:760px){
  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-legend{
    left:50%!important;
    right:auto!important;
    top:auto!important;
    bottom:0!important;
    transform:translateX(-50%)!important;
    width:min(330px,calc(100% - 104px))!important;
    max-width:330px!important;
    min-height:82px!important;
    box-sizing:border-box!important;
    margin:0!important;
    padding:11px 13px 10px!important;
    border-radius:16px 16px 0 0!important;
    overflow:visible!important;
    z-index:180!important;
    box-shadow:0 -8px 24px rgba(15,23,42,.12)!important;
  }

  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-legend > strong{
    display:block!important;
    font-size:11px!important;
    line-height:1.2!important;
    font-weight:850!important;
    color:#111827!important;
  }

  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-legend .tp-gradient{
    height:9px!important;
    margin:7px 0 6px!important;
    border-radius:999px!important;
  }

  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-legend .tp-legend-label{
    display:grid!important;
    grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;
    align-items:start!important;
    gap:8px!important;
    margin-top:0!important;
    font-size:8.5px!important;
    line-height:1.18!important;
    color:#374151!important;
  }

  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-legend .tp-legend-label span{
    min-width:0!important;
    white-space:normal!important;
    font-weight:800!important;
    color:#374151!important;
  }

  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-measurement-date{
    left:50%!important;
    right:auto!important;
    top:auto!important;
    bottom:90px!important;
    transform:translateX(-50%)!important;
    width:auto!important;
    max-width:min(330px,calc(100% - 104px))!important;
    margin:0!important;
    white-space:nowrap!important;
    z-index:184!important;
  }

  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-home-spatial-note{
    left:50%!important;
    right:auto!important;
    bottom:130px!important;
    transform:translateX(-50%)!important;
    max-width:min(330px,calc(100% - 104px))!important;
    z-index:182!important;
  }
}

@media(max-width:430px){
  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-legend{
    width:calc(100% - 104px)!important;
    max-width:none!important;
    min-height:82px!important;
    padding:10px 12px 9px!important;
  }

  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-measurement-date{
    bottom:90px!important;
    max-width:calc(100% - 104px)!important;
  }
}

/* Tam ekran: aynı görsel grup, safe-area ile birlikte yukarı taşınır. */
body.tp-map-body-fullscreen .tp-map-stage .tp-real-home-legend{
  left:50%!important;
  right:auto!important;
  top:auto!important;
  bottom:max(12px,calc(env(safe-area-inset-bottom) + 12px))!important;
  transform:translateX(-50%)!important;
  width:min(310px,calc(100% - 112px))!important;
  max-width:310px!important;
  min-height:82px!important;
  box-sizing:border-box!important;
  margin:0!important;
  padding:11px 13px 10px!important;
  border-radius:16px!important;
  z-index:205!important;
  box-shadow:0 10px 28px rgba(0,0,0,.20)!important;
}

body.tp-map-body-fullscreen .tp-map-stage .tp-real-home-legend > strong{
  display:block!important;
  font-size:11px!important;
  line-height:1.2!important;
  font-weight:850!important;
}

body.tp-map-body-fullscreen .tp-map-stage .tp-real-home-legend .tp-gradient{
  height:9px!important;
  margin:7px 0 6px!important;
  border-radius:999px!important;
}

body.tp-map-body-fullscreen .tp-map-stage .tp-real-home-legend .tp-legend-label{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;
  align-items:start!important;
  gap:8px!important;
  margin-top:0!important;
  font-size:8.5px!important;
  line-height:1.18!important;
}

body.tp-map-body-fullscreen .tp-map-stage .tp-measurement-date{
  left:50%!important;
  right:auto!important;
  top:auto!important;
  bottom:max(102px,calc(env(safe-area-inset-bottom) + 102px))!important;
  transform:translateX(-50%)!important;
  width:auto!important;
  max-width:min(310px,calc(100% - 112px))!important;
  margin:0!important;
  white-space:nowrap!important;
  z-index:210!important;
}

body.tp-map-body-fullscreen .tp-map-stage .tp-home-spatial-note{
  left:50%!important;
  right:auto!important;
  bottom:max(142px,calc(env(safe-area-inset-bottom) + 142px))!important;
  transform:translateX(-50%)!important;
  max-width:min(310px,calc(100% - 112px))!important;
  z-index:208!important;
}

/* =========================================================
   V11 — ALT BİLGİ BLOĞU BEYAZ + NORMAL MOBİLDE BİRAZ YUKARI
   Tarih üstte, legend hemen altında. İkisi aynı merkez hattında.
   ========================================================= */
@media(max-width:760px){
  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-legend{
    bottom:20px!important;
    background:#ffffff!important;
    color:#111827!important;
    border:1px solid #d9dee3!important;
    border-radius:16px!important;
    box-shadow:0 10px 24px rgba(15,23,42,.14)!important;
  }

  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-measurement-date{
    bottom:110px!important;
  }

  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-legend > strong,
  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-legend .tp-legend-label,
  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-legend .tp-legend-label span{
    color:#111827!important;
  }
}

@media(max-width:430px){
  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-legend{
    bottom:18px!important;
  }

  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-measurement-date{
    bottom:108px!important;
  }
}

body.tp-map-body-fullscreen .tp-map-stage .tp-real-home-legend{
  background:#ffffff!important;
  color:#111827!important;
  border:1px solid #d9dee3!important;
  box-shadow:0 10px 28px rgba(15,23,42,.18)!important;
}

body.tp-map-body-fullscreen .tp-map-stage .tp-real-home-legend > strong,
body.tp-map-body-fullscreen .tp-map-stage .tp-real-home-legend .tp-legend-label,
body.tp-map-body-fullscreen .tp-map-stage .tp-real-home-legend .tp-legend-label span{
  color:#111827!important;
  text-shadow:none!important;
  opacity:1!important;
}


/* =========================================================
   V12 — ALT BİLGİLER GERÇEK BİR STACK GİBİ DAVRANIR
   Pusula yorum bandı uzadıkça legend + tarih birlikte yukarı gider.
   Legend uzarsa tarih de legend tarafından yukarı itilir.
   ========================================================= */
@media(max-width:760px){
  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-legend{
    left:50%!important;
    right:auto!important;
    top:auto!important;
    bottom:calc(var(--tp-pusula-strip-height, 88px) + 8px)!important;
    transform:translateX(-50%)!important;
    width:min(330px,calc(100% - 28px))!important;
    max-width:330px!important;
    margin:0!important;
    background:#ffffff!important;
    color:#111827!important;
    border:1px solid #d9dee3!important;
    border-radius:16px!important;
    box-shadow:0 10px 24px rgba(15,23,42,.14)!important;
    z-index:180!important;
  }

  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-measurement-date{
    left:50%!important;
    right:auto!important;
    top:auto!important;
    bottom:calc(
      var(--tp-pusula-strip-height, 88px) +
      var(--tp-map-legend-height, 82px) +
      16px
    )!important;
    transform:translateX(-50%)!important;
    width:auto!important;
    max-width:min(330px,calc(100% - 28px))!important;
    margin:0!important;
    white-space:nowrap!important;
    z-index:184!important;
  }

  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-home-spatial-note{
    left:50%!important;
    right:auto!important;
    top:auto!important;
    bottom:calc(
      var(--tp-pusula-strip-height, 88px) +
      var(--tp-map-legend-height, 82px) +
      var(--tp-map-date-height, 34px) +
      24px
    )!important;
    transform:translateX(-50%)!important;
    max-width:min(330px,calc(100% - 28px))!important;
    z-index:182!important;
  }
}

@media(max-width:430px){
  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-real-home-legend{
    width:calc(100% - 24px)!important;
    max-width:none!important;
  }

  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-measurement-date{
    max-width:calc(100% - 24px)!important;
  }
 }

/* =========================================================
   V13 — NDVI DE AYNI ALT BİLGİ STACK'İNDE
   Soldaki açılır NDVI kutusu kaldırıldı. NDVI açıklaması artık
   tarih rozetinin hemen altında yatay bir şerit olarak durur.
   ========================================================= */
.tp-mf-ndvi-strip{
  position:absolute;
  left:50%;
  right:auto;
  bottom:96px;
  transform:translateX(-50%);
  width:min(330px,calc(100% - 28px));
  box-sizing:border-box;
  margin:0;
  padding:10px 12px 9px;
  border:1px solid #d9dee3;
  border-radius:16px;
  background:#ffffff;
  color:#111827;
  box-shadow:0 10px 24px rgba(15,23,42,.14);
  z-index:180;
  pointer-events:none;
}

.tp-mf-ndvi-strip-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  min-width:0;
  margin-bottom:7px;
}

.tp-mf-ndvi-strip-head strong{
  min-width:0;
  color:#111827;
  font-size:11px;
  line-height:1.2;
  font-weight:850;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

.tp-mf-ndvi-strip-head span{
  flex:0 0 auto;
  color:#4b5563;
  font-size:9px;
  line-height:1;
  font-weight:800;
  white-space:nowrap;
}

.tp-mf-ndvi-gradient{
  width:100%;
  height:9px;
  border-radius:999px;
  background:linear-gradient(
    90deg,
    #ef4444 0%,
    #ef4444 20%,
    #f59e0b 42%,
    #84cc16 68%,
    #22c55e 100%
  );
  box-shadow:inset 0 0 0 1px rgba(15,23,42,.06);
}

.tp-mf-ndvi-strip-labels{
  display:grid;
  grid-template-columns:1fr 1fr 1fr;
  align-items:start;
  gap:8px;
  margin-top:6px;
}

.tp-mf-ndvi-strip-labels span{
  min-width:0;
  color:#374151;
  font-size:8.5px;
  line-height:1.15;
  font-weight:800;
  white-space:normal;
}
.tp-mf-ndvi-strip-labels span:first-child{text-align:left}
.tp-mf-ndvi-strip-labels span:nth-child(2){text-align:center}
.tp-mf-ndvi-strip-labels span:last-child{text-align:right}

@media(max-width:760px){
  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-mf-ndvi-strip{
    left:50%!important;
    right:auto!important;
    top:auto!important;
    bottom:calc(var(--tp-pusula-strip-height, 88px) + 8px)!important;
    transform:translateX(-50%)!important;
    width:min(330px,calc(100% - 28px))!important;
    max-width:330px!important;
    margin:0!important;
    z-index:180!important;
  }
}

@media(max-width:430px){
  body:not(.tp-map-body-fullscreen)
  .tp-map-first-shell
  .tp-map-stage:not(.tp-map-portrait-fullscreen)
  .tp-mf-ndvi-strip{
    width:calc(100% - 24px)!important;
    max-width:none!important;
  }
}

body.tp-map-body-fullscreen .tp-map-stage .tp-mf-ndvi-strip{
  left:50%!important;
  right:auto!important;
  top:auto!important;
  bottom:max(12px,calc(env(safe-area-inset-bottom) + 12px))!important;
  transform:translateX(-50%)!important;
  width:min(310px,calc(100% - 112px))!important;
  max-width:310px!important;
  margin:0!important;
  background:#ffffff!important;
  color:#111827!important;
  border:1px solid #d9dee3!important;
  box-shadow:0 10px 28px rgba(15,23,42,.18)!important;
  z-index:205!important;
}

/* Tarih her katmanda, gerçek legend yüksekliği kadar yukarı itilir. */
body.tp-map-body-fullscreen .tp-map-stage .tp-measurement-date{
  bottom:calc(
    env(safe-area-inset-bottom) +
    var(--tp-map-legend-height, 72px) +
    20px
  )!important;
}

/* =========================================================
   V14 — TAM EKRAN YALNIZCA HARİTAYI BÜYÜTÜR
   Ana sayfadaki beyaz / siyah arayüz dili fullscreen'de de aynıdır.
   Body altına taşınırken kaybolan tema kapsamını burada geri kuruyoruz.
   ========================================================= */
body.tp-map-body-fullscreen .tp-map-stage{
  --tp-fullscreen-surface:#ffffff;
  --tp-fullscreen-surface-soft:#f7f8f8;
  --tp-fullscreen-text:#111827;
  --tp-fullscreen-muted:#667085;
  --tp-fullscreen-line:#d9dee3;
}

/* Katman düğmesi normal ekrandaki gibi beyaz + koyu. */
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-trigger{
  border:1px solid var(--tp-fullscreen-line)!important;
  background:rgba(255,255,255,.97)!important;
  color:var(--tp-fullscreen-text)!important;
  box-shadow:0 7px 20px rgba(17,24,39,.15)!important;
  backdrop-filter:blur(10px)!important;
  -webkit-backdrop-filter:blur(10px)!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-trigger svg{
  stroke:var(--tp-fullscreen-text)!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-trigger small{
  color:var(--tp-fullscreen-muted)!important;
  opacity:1!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-trigger strong{
  color:var(--tp-fullscreen-text)!important;
  opacity:1!important;
}

/* Katman paneli fullscreen'e geçince tema değiştirmez. */
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-panel{
  border:1px solid var(--tp-fullscreen-line)!important;
  background:rgba(255,255,255,.98)!important;
  color:var(--tp-fullscreen-text)!important;
  box-shadow:0 18px 48px rgba(15,23,42,.18)!important;
  backdrop-filter:blur(16px)!important;
  -webkit-backdrop-filter:blur(16px)!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-panel-head{
  border-bottom:1px solid #e5e7eb!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-panel-head small{
  color:var(--tp-fullscreen-muted)!important;
  opacity:1!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-panel-head strong{
  color:var(--tp-fullscreen-text)!important;
  opacity:1!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-panel-close{
  background:#f3f4f6!important;
  color:var(--tp-fullscreen-text)!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-option{
  border-color:#e5e7eb!important;
  background:#ffffff!important;
  color:var(--tp-fullscreen-text)!important;
  opacity:1!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-option:hover{
  border-color:#cfd5dc!important;
  background:#f8f9fa!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-option.active{
  border-color:#cbd5d1!important;
  background:#eef2f0!important;
  color:var(--tp-fullscreen-text)!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-option strong{
  color:var(--tp-fullscreen-text)!important;
  opacity:1!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-layer-option small{
  color:var(--tp-fullscreen-muted)!important;
  opacity:1!important;
}

/* Üst sol katman/NDVI etiketi de normal ekran temasını korur. */
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-ndvi{
  border-color:var(--tp-fullscreen-line)!important;
  background:rgba(255,255,255,.97)!important;
  color:var(--tp-fullscreen-text)!important;
  box-shadow:0 7px 20px rgba(17,24,39,.15)!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-ndvi,
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-ndvi *{
  color:var(--tp-fullscreen-text)!important;
  text-shadow:none!important;
  opacity:1!important;
}

/* Sağ araçlar fullscreen'de başka renge bürünmez. */
body.tp-map-body-fullscreen .tp-map-stage .tp-map-control-rail{
  border-color:var(--tp-fullscreen-line)!important;
  background:rgba(255,255,255,.97)!important;
  box-shadow:0 7px 20px rgba(17,24,39,.15)!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-map-control-rail .tp-map-control-btn{
  background:#ffffff!important;
  color:var(--tp-fullscreen-text)!important;
  border-bottom-color:#e5e7eb!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-map-control-rail .tp-map-control-btn svg{
  color:var(--tp-fullscreen-text)!important;
  stroke:currentColor!important;
}

/* Kapat düğmesi de aynı beyaz kart dilinde. */
body.tp-map-body-fullscreen .tp-map-stage .tp-map-portrait-close{
  border:1px solid var(--tp-fullscreen-line)!important;
  background:rgba(255,255,255,.97)!important;
  color:var(--tp-fullscreen-text)!important;
  box-shadow:0 7px 20px rgba(17,24,39,.15)!important;
}

/* Alt bilgi stack'i normal görünümle birebir aynı renklerde. */
body.tp-map-body-fullscreen .tp-map-stage .tp-real-home-legend,
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-ndvi-strip{
  background:#ffffff!important;
  color:var(--tp-fullscreen-text)!important;
  border-color:var(--tp-fullscreen-line)!important;
  box-shadow:0 10px 24px rgba(15,23,42,.14)!important;
}
body.tp-map-body-fullscreen .tp-map-stage .tp-real-home-legend > strong,
body.tp-map-body-fullscreen .tp-map-stage .tp-real-home-legend .tp-legend-label,
body.tp-map-body-fullscreen .tp-map-stage .tp-real-home-legend .tp-legend-label span,
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-ndvi-strip-head strong,
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-ndvi-strip-head span,
body.tp-map-body-fullscreen .tp-map-stage .tp-mf-ndvi-strip-labels span{
  color:var(--tp-fullscreen-text)!important;
  text-shadow:none!important;
  opacity:1!important;
}

`

function LayerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3-8.5 4.5L12 12l8.5-4.5L12 3Z" strokeWidth="1.7" />
      <path d="m4 12 8 4.2 8-4.2M4 16.3l8 4.2 8-4.2" strokeWidth="1.7" />
    </svg>
  );
}

export default function HomeMapSectionMapFirst(
  props: HomeMapSectionMapFirstProps,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [mapStage, setMapStage] = useState<HTMLElement | null>(null);
  const [fieldToolbar, setFieldToolbar] = useState<HTMLElement | null>(null);
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [subLayerMenuOpen, setSubLayerMenuOpen] = useState(false);
  const [portraitExpanded, setPortraitExpanded] = useState(false);


  const activeLayer = props.activeHomeLayer as HomeLayer;
  const satelliteData = props.satelliteData ?? null;

  const homeSoilProperty =
    (props.homeSoilProperty ?? 'phh2o') as HomeSoilProperty;
  const homeSoilDepth =
    (props.homeSoilDepth ?? '0-5cm') as HomeSoilDepth;
  const homeClimateLayer =
    (props.homeClimateLayer ?? 'soil-moisture') as HomeClimateLayer;
  const homeClimateDepth =
    (props.homeClimateDepth ?? '0-7cm') as HomeClimateDepth;

  const activeLayerOption = useMemo(
    () => LAYERS.find((item) => item.id === activeLayer) ?? LAYERS[0],
    [activeLayer],
  );

  // Toprak, iklim, yüzey sıcaklığı, ET₀ ve yağış artık harita katmanı değil.
  // Eski oturum/local state bu katmanlardan biriyle açılırsa kullanıcıyı
  // otomatik olarak haritanın ana katmanı olan NDVI'ye döndür.
  useEffect(() => {
    if (LAYERS.some((item) => item.id === activeLayer)) return;

    setLayerMenuOpen(false);
    setSubLayerMenuOpen(false);
    if (typeof props.openMapLayer === 'function') {
      props.openMapLayer('vegetation');
    }
  }, [activeLayer, props.openMapLayer]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const syncTargets = () => {
      const nextStage = root.querySelector('.tp-map-stage') as HTMLElement | null;
      const nextToolbar = root.querySelector('.tp-field-toolbar') as HTMLElement | null;

      /*
       * Tam ekranda aynı map stage'i document.body altına taşınıyor.
       * Bu sırada root.querySelector doğal olarak null döner; ancak mevcut stage
       * hâlâ document'e bağlıdır. Onu null'a çekersek fullscreen effect cleanup
       * çalışıp haritayı anında eski yerine taşır. Yalnız gerçekten DOM'dan
       * kopmuş bir stage'i null kabul ediyoruz.
       */
      setMapStage((current) => {
        if (nextStage) return current === nextStage ? current : nextStage;
        if (current?.isConnected) return current;
        return null;
      });

      setFieldToolbar((current) => (current === nextToolbar ? current : nextToolbar));
    };

    syncTargets();

    const observer = new MutationObserver(syncTargets);
    observer.observe(root, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  /*
   * Ana sayfadaki alt bilgi elemanları artık sabit piksel tahminleriyle değil,
   * gerçek yükseklikleriyle birbirini iter. Pusula yorum metni 1 satırdan
   * 3 satıra çıktığında strip'in yüksekliği büyür; legend ve tarih de aynı
   * miktarda yukarı kayar. Legend'in yüksekliği değişirse tarih onun üstünde
   * kalmaya devam eder.
   */
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !mapStage) return;

    const shell = root.closest('.tp-home-map-pusula-shell') ?? root.parentElement;
    if (!shell) return;

    const syncBottomStack = () => {
      const pusulaStrip = shell.querySelector(
        '.tp-home-map-pusula-strip',
      ) as HTMLElement | null;
      const legend = mapStage.querySelector(
        activeLayer === 'vegetation'
          ? '.tp-mf-ndvi-strip'
          : '.tp-real-home-legend',
      ) as HTMLElement | null;
      const date = mapStage.querySelector(
        '.tp-measurement-date',
      ) as HTMLElement | null;

      const stripHeight = Math.ceil(
        pusulaStrip?.getBoundingClientRect().height ?? 88,
      );
      const legendHeight = Math.ceil(
        legend?.getBoundingClientRect().height ?? 82,
      );
      const dateHeight = Math.ceil(
        date?.getBoundingClientRect().height ?? 34,
      );

      mapStage.style.setProperty('--tp-pusula-strip-height', `${stripHeight}px`);
      mapStage.style.setProperty('--tp-map-legend-height', `${legendHeight}px`);
      mapStage.style.setProperty('--tp-map-date-height', `${dateHeight}px`);
    };

    syncBottomStack();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(syncBottomStack)
        : null;

    const pusulaStrip = shell.querySelector(
      '.tp-home-map-pusula-strip',
    ) as HTMLElement | null;
    const legend = mapStage.querySelector(
      activeLayer === 'vegetation'
        ? '.tp-mf-ndvi-strip'
        : '.tp-real-home-legend',
    ) as HTMLElement | null;
    const date = mapStage.querySelector(
      '.tp-measurement-date',
    ) as HTMLElement | null;

    if (resizeObserver) {
      if (pusulaStrip) resizeObserver.observe(pusulaStrip);
      if (legend) resizeObserver.observe(legend);
      if (date) resizeObserver.observe(date);
    }

    const mutationObserver = new MutationObserver(syncBottomStack);
    mutationObserver.observe(shell, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.addEventListener('resize', syncBottomStack);
    const timers = [
      window.setTimeout(syncBottomStack, 40),
      window.setTimeout(syncBottomStack, 180),
      window.setTimeout(syncBottomStack, 500),
    ];

    return () => {
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', syncBottomStack);
      timers.forEach((timer) => window.clearTimeout(timer));
      mapStage.style.removeProperty('--tp-pusula-strip-height');
      mapStage.style.removeProperty('--tp-map-legend-height');
      mapStage.style.removeProperty('--tp-map-date-height');
    };
  }, [mapStage, activeLayer]);

  useEffect(() => {
    setLayerMenuOpen(false);
    setSubLayerMenuOpen(
      activeLayer === 'soil' || activeLayer === 'climate',
    );
  }, [activeLayer]);

  useEffect(() => {
    if (!mapStage) return;

    let touchStart: { id: number; x: number; y: number; cancelled: boolean } | null = null;
    const isMobile = () => window.matchMedia('(max-width:760px)').matches;
    const onPointerDown = (event: PointerEvent) => {
      if (touchStart) {
        touchStart.cancelled = true;
        return;
      }
      if (!isMobile() || !(event.target instanceof HTMLCanvasElement)) return;
      touchStart = { id: event.pointerId, x: event.clientX, y: event.clientY, cancelled: false };
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!touchStart || touchStart.id !== event.pointerId) return;
      const start = touchStart;
      touchStart = null;
      if (
        start.cancelled ||
        !(event.target instanceof HTMLCanvasElement) ||
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10
      ) return;
      setPortraitExpanded(true);
    };
    const onPointerCancel = () => { touchStart = null; };

    mapStage.addEventListener('pointerdown', onPointerDown);
    mapStage.addEventListener('pointerup', onPointerUp);
    mapStage.addEventListener('pointercancel', onPointerCancel);
    return () => {
      mapStage.removeEventListener('pointerdown', onPointerDown);
      mapStage.removeEventListener('pointerup', onPointerUp);
      mapStage.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [mapStage]);

  // MapLibre kontrolünün kendi köşesi eski HomeScreen CSS bloklarından etkilenebiliyor.
  // Görsel pusulayı stage overlay olarak biz çiziyoruz; native kontrol yalnızca
  // kuzeye döndürme davranışı için arkada tutuluyor ve görünmez yapılıyor.
  useEffect(() => {
    if (!mapStage) return;

    const hideNativeCompass = () => {
      const nativeCompass = mapStage.querySelector(
        '.tp-real-home-map .maplibregl-ctrl-group.tp-map-compass',
      ) as HTMLElement | null;

      if (!nativeCompass) return;
      nativeCompass.style.setProperty('display', 'none', 'important');
      nativeCompass.style.setProperty('visibility', 'hidden', 'important');
      nativeCompass.style.setProperty('pointer-events', 'none', 'important');
      nativeCompass.setAttribute('aria-hidden', 'true');
    };

    hideNativeCompass();
    const timers = [
      window.setTimeout(hideNativeCompass, 80),
      window.setTimeout(hideNativeCompass, 260),
      window.setTimeout(hideNativeCompass, 700),
    ];

    const observer = new MutationObserver(hideNativeCompass);
    observer.observe(mapStage, { childList: true, subtree: true });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
    };
  }, [mapStage, activeLayer]);

  useEffect(() => {
    if (!portraitExpanded || !mapStage) return;

    /*
     * ÖNEMLİ: StackBlitz/mobil önizlemede üst kapsayıcılardaki transform/scale,
     * position:fixed elemanı cihaz viewport'u yerine uygulama kartına kilitleyebiliyor.
     * Bu yüzden tam ekranda gerçek map stage'i geçici olarak document.body altına
     * taşıyoruz. Harita instance'ı yeniden kurulmaz; aynı DOM/canvas yaşamaya devam eder.
     */
    const root = rootRef.current;
    const homeField = root?.querySelector('.tp-home-field');
    const originalParent = mapStage.parentNode;
    const placeholder = document.createComment('tp-map-stage-home-position');

    const mapRoot = mapStage.querySelector('.tp-real-home-map') as HTMLElement | null;
    const mapCanvasRoot = mapStage.querySelector('.tp-real-home-map-canvas') as HTMLElement | null;

    const oldOverflow = document.body.style.overflow;
    const oldRootOverflow = document.documentElement.style.overflow;
    const oldStageStyle = mapStage.getAttribute('style');
    const oldMapRootStyle = mapRoot?.getAttribute('style') ?? null;
    const oldCanvasRootStyle = mapCanvasRoot?.getAttribute('style') ?? null;

    setLayerMenuOpen(false);
    setSubLayerMenuOpen(false);

    if (originalParent) {
      originalParent.insertBefore(placeholder, mapStage);
    }
    document.body.appendChild(mapStage);

    root?.classList.add('tp-map-portrait-active');
    homeField?.classList.add('tp-map-portrait-parent');
    document.body.classList.add('tp-map-body-fullscreen');
    mapStage.classList.add('tp-map-portrait-fullscreen');

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const resizeMap = () => window.dispatchEvent(new Event('resize'));

    const syncFullscreenSize = () => {
      const viewport = window.visualViewport;
      const width = Math.round(
        viewport?.width ?? document.documentElement.clientWidth ?? window.innerWidth,
      );
      const height = Math.round(
        viewport?.height ?? document.documentElement.clientHeight ?? window.innerHeight,
      );
      const left = Math.round(viewport?.offsetLeft ?? 0);
      const top = Math.round(viewport?.offsetTop ?? 0);

      mapStage.style.setProperty('position', 'fixed', 'important');
      mapStage.style.setProperty('left', `${left}px`, 'important');
      mapStage.style.setProperty('top', `${top}px`, 'important');
      mapStage.style.setProperty('right', 'auto', 'important');
      mapStage.style.setProperty('bottom', 'auto', 'important');
      mapStage.style.setProperty('width', `${width}px`, 'important');
      mapStage.style.setProperty('max-width', 'none', 'important');
      mapStage.style.setProperty('height', `${height}px`, 'important');
      mapStage.style.setProperty('min-height', `${height}px`, 'important');
      mapStage.style.setProperty('max-height', 'none', 'important');
      mapStage.style.setProperty('margin', '0', 'important');
      mapStage.style.setProperty('padding', '0', 'important');
      mapStage.style.setProperty('overflow', 'hidden', 'important');
      mapStage.style.setProperty('border-radius', '0', 'important');
      mapStage.style.setProperty('z-index', '2147483647', 'important');

      mapRoot?.style.setProperty('width', '100%', 'important');
      mapRoot?.style.setProperty('height', '100%', 'important');
      mapRoot?.style.setProperty('min-height', '100%', 'important');
      mapCanvasRoot?.style.setProperty('width', '100%', 'important');
      mapCanvasRoot?.style.setProperty('height', '100%', 'important');
      mapCanvasRoot?.style.setProperty('min-height', '100%', 'important');

      window.requestAnimationFrame(resizeMap);
      window.setTimeout(resizeMap, 60);
      window.setTimeout(resizeMap, 180);
    };

    syncFullscreenSize();

    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', syncFullscreenSize);
    viewport?.addEventListener('scroll', syncFullscreenSize);
    window.addEventListener('resize', syncFullscreenSize);
    window.addEventListener('orientationchange', syncFullscreenSize);

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPortraitExpanded(false);
    };
    document.addEventListener('keydown', onEscape);

    return () => {
      document.removeEventListener('keydown', onEscape);
      viewport?.removeEventListener('resize', syncFullscreenSize);
      viewport?.removeEventListener('scroll', syncFullscreenSize);
      window.removeEventListener('resize', syncFullscreenSize);
      window.removeEventListener('orientationchange', syncFullscreenSize);

      /* Önce gerçek yerine geri koy; sonra normal ekran stillerini geri yükle. */
      if (placeholder.parentNode) {
        placeholder.parentNode.insertBefore(mapStage, placeholder);
        placeholder.parentNode.removeChild(placeholder);
      } else if (originalParent) {
        originalParent.appendChild(mapStage);
      }

      root?.classList.remove('tp-map-portrait-active');
      homeField?.classList.remove('tp-map-portrait-parent');
      document.body.classList.remove('tp-map-body-fullscreen');
      mapStage.classList.remove('tp-map-portrait-fullscreen');
      document.body.style.overflow = oldOverflow;
      document.documentElement.style.overflow = oldRootOverflow;

      if (oldStageStyle === null) mapStage.removeAttribute('style');
      else mapStage.setAttribute('style', oldStageStyle);

      if (mapRoot) {
        if (oldMapRootStyle === null) mapRoot.removeAttribute('style');
        else mapRoot.setAttribute('style', oldMapRootStyle);
      }

      if (mapCanvasRoot) {
        if (oldCanvasRootStyle === null) mapCanvasRoot.removeAttribute('style');
        else mapCanvasRoot.setAttribute('style', oldCanvasRootStyle);
      }

      window.requestAnimationFrame(resizeMap);
      window.setTimeout(resizeMap, 80);
    };
  }, [portraitExpanded, mapStage]);

  const selectLayer = (layer: HomeLayer) => {
    setLayerMenuOpen(false);

    if (typeof props.openMapLayer === 'function') {
      props.openMapLayer(layer);
    }

    // Map-first görünümde eski ayrı Toprak/İklim popover'ını açtırmıyoruz.
    // Alt seçimler aşağıdaki kendi panelimizden yapılır.
    if (typeof props.setSoilMenuOpen === 'function') {
      props.setSoilMenuOpen(false);
    }
    if (typeof props.setClimateMenuOpen === 'function') {
      props.setClimateMenuOpen(false);
    }
  };

  const subLayerSummary =
    activeLayer === 'soil'
      ? `${HOME_SOIL_PROPERTY_LABELS[homeSoilProperty]} · ${HOME_SOIL_DEPTH_LABELS[homeSoilDepth]}`
      : activeLayer === 'climate'
        ? `${HOME_CLIMATE_LAYER_LABELS[homeClimateLayer]}${
            homeClimateLayer === 'soil-moisture' ||
            homeClimateLayer === 'soil-temperature'
              ? ` · ${HOME_CLIMATE_DEPTH_LABELS[homeClimateDepth]}`
              : ''
          }`
        : '';

  const setSoilProperty = (value: HomeSoilProperty) => {
    if (typeof props.setHomeSoilProperty === 'function') {
      props.setHomeSoilProperty(value);
    }
  };

  const setSoilDepth = (value: HomeSoilDepth) => {
    if (typeof props.setHomeSoilDepth === 'function') {
      props.setHomeSoilDepth(value);
    }
  };

  const setClimateLayer = (value: HomeClimateLayer) => {
    if (typeof props.setHomeClimateLayer === 'function') {
      props.setHomeClimateLayer(value);
    }
  };

  const setClimateDepth = (value: HomeClimateDepth) => {
    if (typeof props.setHomeClimateDepth === 'function') {
      props.setHomeClimateDepth(value);
    }
  };

  const ndviAverage =
    satelliteData?.ndviAverage != null &&
    Number.isFinite(Number(satelliteData.ndviAverage))
      ? Number(satelliteData.ndviAverage).toFixed(2)
      : '—';

  const operationToolbarButton =
    fieldToolbar != null
      ? createPortal(
          <button
            type="button"
            className="tp-mf-operation-toolbar"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('tp:home-map-open-field-operation'),
                );
              }
            }}
            aria-label="Tarla işlemi ekle"
            title="Tarlada yaptığın işlemi kaydet"
          >
            <span aria-hidden="true">🚜</span>
          </button>,
          fieldToolbar,
        )
      : null;

  const quickToolbarButtons = fieldToolbar != null
    ? createPortal(
        <>
          <button
            type="button"
            className="tp-mf-quick-action tp-mf-quick-today"
            onClick={() => props.onOpenToday?.()}
            aria-label="Bugün ne yapmalısın?"
            aria-haspopup="dialog"
            title="Bugün ne yapmalısın?"
          >
            <ClipboardList size={19} strokeWidth={1.9} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="tp-mf-quick-action tp-mf-quick-notifications"
            onClick={() => props.onOpenNotifications?.()}
            aria-label={`Bildirimler${props.notificationCount > 0 ? `, ${props.notificationCount} yeni gelişme` : ''}`}
            aria-haspopup="dialog"
            title="Bildirimler"
          >
            <Bell size={19} strokeWidth={1.9} aria-hidden="true" />
            {props.notificationCount > 0 && <span className="tp-mf-notification-dot" aria-hidden="true" />}
          </button>
        </>,
        fieldToolbar,
      )
    : null;

  const mapOverlay =
    mapStage != null
      ? createPortal(
          <>
            {!subLayerMenuOpen ? (
              <button
                type="button"
                className="tp-mf-layer-trigger"
                onClick={() => {
                                setLayerMenuOpen((open) => !open);
                }}
                aria-expanded={layerMenuOpen}
                aria-label="Harita katmanlarını aç"
              >
                <LayerIcon />
                <span>
                  <small>Katmanlar</small>
                  <strong>{activeLayerOption.shortLabel}</strong>
                </span>
              </button>
            ) : null}

            {layerMenuOpen ? (
              <section
                className="tp-mf-layer-panel"
                role="dialog"
                aria-label="Harita katmanları"
              >
                <div className="tp-mf-layer-panel-head">
                  <div>
                    <small>HARİTA</small>
                    <strong>Katman seç</strong>
                  </div>
                  <button
                    type="button"
                    className="tp-mf-layer-panel-close"
                    onClick={() => setLayerMenuOpen(false)}
                    aria-label="Katmanları kapat"
                  >
                    ×
                  </button>
                </div>

                <div className="tp-mf-layer-list">
                  {LAYERS.map((layer) => (
                    <button
                      type="button"
                      key={layer.id}
                      className={`tp-mf-layer-option ${
                        layer.id === activeLayer ? 'active' : ''
                      }`}
                      onClick={() => selectLayer(layer.id)}
                    >
                      <strong>{layer.label}</strong>
                      <small>{layer.hint}</small>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {(activeLayer === 'soil' || activeLayer === 'climate') ? (
              subLayerMenuOpen ? (
                <section
                  className="tp-mf-sublayer-panel"
                  role="dialog"
                  aria-label={
                    activeLayer === 'soil'
                      ? 'Toprak alt katmanları'
                      : 'İklim alt katmanları'
                  }
                >
                  <div className="tp-mf-sublayer-head">
                    <div>
                      <small>
                        {activeLayer === 'soil' ? 'TOPRAK' : 'İKLİM'}
                      </small>
                      <strong>{subLayerSummary}</strong>
                    </div>

                    <button
                      type="button"
                      className="tp-mf-sublayer-close"
                      onClick={() => setSubLayerMenuOpen(false)}
                      aria-label="Alt katmanları kapat"
                    >
                      ×
                    </button>
                  </div>

                  {activeLayer === 'soil' ? (
                    <>
                      <div className="tp-mf-sublayer-group">
                        <span className="tp-mf-sublayer-label">
                          Toprak özelliği
                        </span>
                        <div className="tp-mf-sublayer-scroll">
                          {(
                            Object.keys(
                              HOME_SOIL_PROPERTY_LABELS,
                            ) as HomeSoilProperty[]
                          ).map((property) => (
                            <button
                              type="button"
                              key={property}
                              className={`tp-mf-sublayer-chip ${
                                homeSoilProperty === property ? 'active' : ''
                              }`}
                              onClick={() => setSoilProperty(property)}
                            >
                              {HOME_SOIL_PROPERTY_LABELS[property]}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="tp-mf-sublayer-group">
                        <span className="tp-mf-sublayer-label">
                          Derinlik
                        </span>
                        <div className="tp-mf-sublayer-scroll">
                          {(
                            Object.keys(
                              HOME_SOIL_DEPTH_LABELS,
                            ) as HomeSoilDepth[]
                          ).map((depth) => (
                            <button
                              type="button"
                              key={depth}
                              className={`tp-mf-sublayer-chip ${
                                homeSoilDepth === depth ? 'active' : ''
                              }`}
                              onClick={() => setSoilDepth(depth)}
                            >
                              {HOME_SOIL_DEPTH_LABELS[depth]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="tp-mf-sublayer-group tp-mf-climate-data-group">
                        <span className="tp-mf-sublayer-label">
                          İklim verisi
                        </span>
                        <div className="tp-mf-sublayer-scroll tp-mf-climate-data-grid">
                          {(
                            Object.keys(
                              HOME_CLIMATE_LAYER_LABELS,
                            ) as HomeClimateLayer[]
                          ).map((item) => (
                            <button
                              type="button"
                              key={item}
                              className={`tp-mf-sublayer-chip ${
                                homeClimateLayer === item ? 'active' : ''
                              }`}
                              onClick={() => setClimateLayer(item)}
                            >
                              {item === 'soil-moisture' ? (
                                <>
                                  Toprak
                                  <br />
                                  Nemi
                                </>
                              ) : item === 'soil-temperature' ? (
                                <>
                                  Toprak
                                  <br />
                                  Sıcaklığı
                                </>
                              ) : item === 'air-temperature' ? (
                                <>
                                  Hava
                                  <br />
                                  Sıcaklığı
                                </>
                              ) : (
                                HOME_CLIMATE_LAYER_LABELS[item]
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {(homeClimateLayer === 'soil-moisture' ||
                        homeClimateLayer === 'soil-temperature') ? (
                        <div className="tp-mf-sublayer-group">
                          <span className="tp-mf-sublayer-label">
                            Derinlik
                          </span>
                          <div className="tp-mf-sublayer-scroll">
                            {(
                              Object.keys(
                                HOME_CLIMATE_DEPTH_LABELS,
                              ) as HomeClimateDepth[]
                            )
                              .filter((depth) =>
                                homeClimateLayer === 'soil-temperature'
                                  ? depth !== '28-100cm'
                                  : true,
                              )
                              .map((depth) => (
                                <button
                                  type="button"
                                  key={depth}
                                  className={`tp-mf-sublayer-chip ${
                                    homeClimateDepth === depth ? 'active' : ''
                                  }`}
                                  onClick={() => setClimateDepth(depth)}
                                >
                                  {HOME_CLIMATE_DEPTH_LABELS[depth]}
                                </button>
                              ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </section>
              ) : (
                <button
                  type="button"
                  className="tp-mf-sublayer-trigger"
                  onClick={() => {
                    setLayerMenuOpen(false);
                                    setSubLayerMenuOpen(true);
                  }}
                  aria-expanded={false}
                  aria-label={
                    activeLayer === 'soil'
                      ? 'Toprak alt katmanlarını aç'
                      : 'İklim alt katmanlarını aç'
                  }
                >
                  <small>
                    {activeLayer === 'soil' ? 'Toprak' : 'İklim'}
                  </small>
                  <strong>{subLayerSummary}</strong>
                </button>
              )
            ) : null}

            <button
              type="button"
              className="tp-mf-stage-compass"
              aria-label="Haritayı kuzeye döndür"
              title="Kuzeye döndür"
              onClick={() => {
                const nativeButton = rootRef.current?.querySelector(
                  '.tp-real-home-map .tp-map-compass__button',
                ) as HTMLButtonElement | null;
                nativeButton?.click();

                const rose = mapStage.querySelector(
                  '.tp-mf-stage-compass-rose',
                ) as HTMLElement | null;
                rose?.style.setProperty('transform', 'rotate(0deg)');
              }}
            >
              <span className="tp-mf-stage-compass-rose" aria-hidden="true">
                <span className="tp-mf-stage-compass-ring" />
                <span className="tp-mf-stage-compass-ticks" />
                <span className="tp-mf-stage-compass-label north">K</span>
                <span className="tp-mf-stage-compass-label east">D</span>
                <span className="tp-mf-stage-compass-label south">G</span>
                <span className="tp-mf-stage-compass-label west">B</span>
                <span className="tp-mf-stage-compass-needle" />
                <span className="tp-mf-stage-compass-center" />
              </span>
            </button>

            {activeLayer === 'vegetation' ? (
              <aside
                className="tp-mf-ndvi-strip"
                aria-label="NDVI renk açıklaması"
              >
                <div className="tp-mf-ndvi-strip-head">
                  <strong>NDVI · Bitki Sağlığı</strong>
                  <span>Ort. {ndviAverage}</span>
                </div>
                <div className="tp-mf-ndvi-gradient" aria-hidden="true" />
                <div className="tp-mf-ndvi-strip-labels">
                  <span>Düşük &lt; 0.30</span>
                  <span>Orta 0.30–0.59</span>
                  <span>Yüksek ≥ 0.60</span>
                </div>
              </aside>
            ) : null}
          </>,
          mapStage,
        )
      : null;

  const portraitClose = portraitExpanded && mapStage
    ? createPortal(
        <button
          type="button"
          className="tp-map-portrait-close"
          aria-label="Tam ekran haritayı kapat"
          onClick={() => setPortraitExpanded(false)}
        >
          ×
        </button>,
        mapStage,
      )
    : null;

  return (
    <div
      ref={rootRef}
      className={`tp-map-first-shell tp-map-first-layer-${activeLayer}`}
      onClickCapture={(event) => {
        if (
          window.matchMedia('(max-width:760px)').matches &&
          (event.target as Element).closest('.tp-map-fullscreen-btn')
        ) {
          event.preventDefault();
          event.stopPropagation();
          setPortraitExpanded((current) => !current);
        }
      }}
    >
      <style>{CSS}</style>

      <HomeMapSection {...props} />

      {operationToolbarButton}
      {quickToolbarButtons}
      {mapOverlay}
      {portraitClose}
    </div>
  );
}

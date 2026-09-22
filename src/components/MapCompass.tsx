import type {
  ControlPosition,
  IControl,
  Map as MapLibreMap,
} from 'maplibre-gl';

class TarlaCompassControl implements IControl {
  private map?: MapLibreMap;
  private container?: HTMLDivElement;
  private rose?: HTMLDivElement;

  private readonly updateBearing = () => {
    if (this.map && this.rose) {
      this.rose.style.transform = `rotate(${-this.map.getBearing()}deg)`;
    }
  };

  onAdd(map: MapLibreMap) {
    this.map = map;

    const container = document.createElement('div');
    container.className =
      'maplibregl-ctrl maplibregl-ctrl-group mapboxgl-ctrl mapboxgl-ctrl-group tp-map-compass';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tp-map-compass__button';
    button.setAttribute('aria-label', 'Haritayı kuzeye döndür');
    button.title = 'Kuzeye döndür';

    const rose = document.createElement('div');
    rose.className = 'tp-map-compass__rose';
    rose.innerHTML = `
      <span class="tp-map-compass__ring" aria-hidden="true"></span>
      <span class="tp-map-compass__ticks" aria-hidden="true"></span>

      <span class="tp-map-compass__label tp-map-compass__north">K</span>
      <span class="tp-map-compass__label tp-map-compass__east">D</span>
      <span class="tp-map-compass__label tp-map-compass__south">G</span>
      <span class="tp-map-compass__label tp-map-compass__west">B</span>

      <span class="tp-map-compass__needle" aria-hidden="true">
        <span class="tp-map-compass__needle-north"></span>
        <span class="tp-map-compass__needle-south"></span>
      </span>

      <span class="tp-map-compass__center" aria-hidden="true"></span>
    `;

    button.appendChild(rose);
    container.appendChild(button);

    if (!document.getElementById('tp-map-compass-style')) {
      const style = document.createElement('style');
      style.id = 'tp-map-compass-style';

      style.textContent = `
        .maplibregl-ctrl-group.tp-map-compass{
          display:grid!important;
          place-items:center!important;
          width:48px!important;
          height:48px!important;
          min-width:48px!important;
          min-height:48px!important;
          margin:0!important;
          padding:0!important;
          overflow:hidden!important;
          border:1px solid rgba(17,24,39,.16)!important;
          border-radius:14px!important;
          background:rgba(255,255,255,.96)!important;
          box-shadow:
            0 8px 22px rgba(0,0,0,.18),
            inset 0 1px 0 rgba(255,255,255,.98)!important;
          backdrop-filter:blur(10px)!important;
          -webkit-backdrop-filter:blur(10px)!important;
        }

        .maplibregl-ctrl-group.tp-map-compass
        button.tp-map-compass__button{
          display:block!important;
          position:relative!important;
          width:48px!important;
          height:48px!important;
          min-width:48px!important;
          min-height:48px!important;
          margin:0!important;
          padding:0!important;
          overflow:hidden!important;
          border:0!important;
          border-radius:14px!important;
          background:transparent!important;
          color:#111827!important;
          cursor:pointer!important;
        }

        .maplibregl-ctrl-group.tp-map-compass
        button.tp-map-compass__button::before{
          display:none!important;
          content:none!important;
        }

        .tp-map-compass__button:hover{
          background:#f5f6f7!important;
        }

        .tp-map-compass__button:focus-visible{
          outline:2px solid rgba(17,24,39,.28)!important;
          outline-offset:-3px!important;
        }

        .tp-map-compass__rose{
          position:absolute!important;
          z-index:1!important;
          inset:4px!important;
          width:auto!important;
          height:auto!important;
          margin:0!important;
          transform-origin:50% 50%!important;
          transition:transform .18s ease-out;
          will-change:transform;
        }

        .tp-map-compass__ring{
          position:absolute!important;
          inset:4px!important;
          border:1px solid rgba(17,24,39,.20)!important;
          border-radius:50%!important;
          background:
            radial-gradient(circle at 50% 50%,rgba(17,24,39,.025),transparent 62%)!important;
        }

        .tp-map-compass__ticks{
          position:absolute!important;
          inset:2px!important;
          border-radius:50%!important;
          background:
            linear-gradient(#111827,#111827) center top/1px 4px no-repeat,
            linear-gradient(#9ca3af,#9ca3af) center bottom/1px 3px no-repeat,
            linear-gradient(90deg,#9ca3af,#9ca3af) left center/3px 1px no-repeat,
            linear-gradient(90deg,#9ca3af,#9ca3af) right center/3px 1px no-repeat!important;
          opacity:.78!important;
        }

        .tp-map-compass__label{
          position:absolute!important;
          z-index:3!important;
          color:#69727d!important;
          font:900 6px/1 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
          letter-spacing:0!important;
          text-shadow:none!important;
          user-select:none!important;
        }

        .tp-map-compass__north{
          top:0!important;
          left:50%!important;
          transform:translateX(-50%)!important;
          color:#111827!important;
          font-size:7.5px!important;
        }

        .tp-map-compass__east{
          right:0!important;
          top:50%!important;
          transform:translateY(-50%)!important;
        }

        .tp-map-compass__south{
          bottom:0!important;
          left:50%!important;
          transform:translateX(-50%)!important;
        }

        .tp-map-compass__west{
          left:0!important;
          top:50%!important;
          transform:translateY(-50%)!important;
        }

        .tp-map-compass__needle{
          position:absolute!important;
          z-index:4!important;
          left:50%!important;
          top:50%!important;
          width:12px!important;
          height:26px!important;
          transform:translate(-50%,-50%)!important;
          filter:none!important;
        }

        .tp-map-compass__needle-north{
          position:absolute!important;
          left:50%!important;
          top:0!important;
          width:0!important;
          height:0!important;
          transform:translateX(-50%)!important;
          border-left:3.5px solid transparent!important;
          border-right:3.5px solid transparent!important;
          border-bottom:12px solid #111827!important;
        }

        .tp-map-compass__needle-south{
          position:absolute!important;
          left:50%!important;
          bottom:0!important;
          width:0!important;
          height:0!important;
          transform:translateX(-50%)!important;
          border-left:3px solid transparent!important;
          border-right:3px solid transparent!important;
          border-top:10px solid #9ca3af!important;
        }

        .tp-map-compass__center{
          position:absolute!important;
          z-index:5!important;
          left:50%!important;
          top:50%!important;
          width:6px!important;
          height:6px!important;
          transform:translate(-50%,-50%)!important;
          border:1px solid #fff!important;
          border-radius:50%!important;
          background:#111827!important;
          box-shadow:0 0 0 1px rgba(17,24,39,.16)!important;
        }
      `;

      document.head.appendChild(style);
    }

    button.addEventListener('click', () => {
      this.map?.easeTo({
        bearing: 0,
        duration: 450,
      });
    });

    this.container = container;
    this.rose = rose;

    map.on('rotate', this.updateBearing);
    this.updateBearing();

    return container;
  }

  onRemove() {
    this.map?.off('rotate', this.updateBearing);
    this.container?.remove();

    this.map = undefined;
    this.container = undefined;
    this.rose = undefined;
  }
}

export function addTarlaCompass(
  map: MapLibreMap,
  position: ControlPosition = 'top-right',
) {
  const control = new TarlaCompassControl();
  map.addControl(control, position);
  return control;
}

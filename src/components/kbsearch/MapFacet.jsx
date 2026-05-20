import React, { useMemo, useState, useEffect } from 'react';

// ISO alpha-2 → ISO alpha-3 map (subset covering common policy fields)
const A2_TO_A3 = {
  AF:'AFG',AL:'ALB',DZ:'DZA',AD:'AND',AO:'AGO',AG:'ATG',AR:'ARG',AM:'ARM',AU:'AUS',AT:'AUT',
  AZ:'AZE',BS:'BHS',BH:'BHR',BD:'BGD',BB:'BRB',BY:'BLR',BE:'BEL',BZ:'BLZ',BJ:'BEN',BT:'BTN',
  BO:'BOL',BA:'BIH',BW:'BWA',BR:'BRA',BN:'BRN',BG:'BGR',BF:'BFA',BI:'BDI',CV:'CPV',KH:'KHM',
  CM:'CMR',CA:'CAN',CF:'CAF',TD:'TCD',CL:'CHL',CN:'CHN',CO:'COL',KM:'COM',CG:'COG',CD:'COD',
  CR:'CRI',HR:'HRV',CU:'CUB',CY:'CYP',CZ:'CZE',DK:'DNK',DJ:'DJI',DM:'DMA',DO:'DOM',EC:'ECU',
  EG:'EGY',SV:'SLV',GQ:'GNQ',ER:'ERI',EE:'EST',SZ:'SWZ',ET:'ETH',FJ:'FJI',FI:'FIN',FR:'FRA',
  GA:'GAB',GM:'GMB',GE:'GEO',DE:'DEU',GH:'GHA',GR:'GRC',GD:'GRD',GT:'GTM',GN:'GIN',GW:'GNB',
  GY:'GUY',HT:'HTI',HN:'HND',HU:'HUN',IS:'ISL',IN:'IND',ID:'IDN',IR:'IRN',IQ:'IRQ',IE:'IRL',
  IL:'ISR',IT:'ITA',JM:'JAM',JP:'JPN',JO:'JOR',KZ:'KAZ',KE:'KEN',KI:'KIR',KW:'KWT',KG:'KGZ',
  LA:'LAO',LV:'LVA',LB:'LBN',LS:'LSO',LR:'LBR',LY:'LBY',LI:'LIE',LT:'LTU',LU:'LUX',MG:'MDG',
  MW:'MWI',MY:'MYS',MV:'MDV',ML:'MLI',MT:'MLT',MH:'MHL',MR:'MRT',MU:'MUS',MX:'MEX',FM:'FSM',
  MD:'MDA',MC:'MCO',MN:'MNG',ME:'MNE',MA:'MAR',MZ:'MOZ',MM:'MMR',NA:'NAM',NR:'NRU',NP:'NPL',
  NL:'NLD',NZ:'NZL',NI:'NIC',NE:'NER',NG:'NGA',NO:'NOR',OM:'OMN',PK:'PAK',PW:'PLW',PA:'PAN',
  PG:'PNG',PY:'PRY',PE:'PER',PH:'PHL',PL:'POL',PT:'PRT',QA:'QAT',RO:'ROU',RU:'RUS',RW:'RWA',
  KN:'KNA',LC:'LCA',VC:'VCT',WS:'WSM',SM:'SMR',ST:'STP',SA:'SAU',SN:'SEN',RS:'SRB',SC:'SYC',
  SL:'SLE',SG:'SGP',SK:'SVK',SI:'SVN',SB:'SLB',SO:'SOM',ZA:'ZAF',SS:'SSD',ES:'ESP',LK:'LKA',
  SD:'SDN',SR:'SUR',SE:'SWE',CH:'CHE',SY:'SYR',TW:'TWN',TJ:'TJK',TZ:'TZA',TH:'THA',TL:'TLS',
  TG:'TGO',TO:'TON',TT:'TTO',TN:'TUN',TR:'TUR',TM:'TKM',TV:'TUV',UG:'UGA',UA:'UKR',AE:'ARE',
  GB:'GBR',US:'USA',UY:'URY',UZ:'UZB',VU:'VUT',VE:'VEN',VN:'VNM',YE:'YEM',ZM:'ZMB',ZW:'ZWE',
  EU:'EU',  // virtual "EU" token
};

// Normalise any ISO code (alpha-2, alpha-3, or full name) → uppercase alpha-2 or alpha-3
function normalise(raw) {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  // Already alpha-2?
  if (A2_TO_A3[s]) return s;
  // Already alpha-3? find alpha-2
  const a2 = Object.keys(A2_TO_A3).find(k => A2_TO_A3[k] === s);
  if (a2) return a2;
  return null;  // unknown — will be shown in legend but not on map
}

// ── Minimal SVG world map ──────────────────────────────────────────
// We use react-leaflet would require Leaflet CSS which isn't bundled,
// so we render a simplified SVG world map using Natural Earth–style paths.
// Each country shape is keyed by ISO alpha-2.
// For brevity we use a very compact approximation. A full geo-accurate
// map is loaded from a static GeoJSON hosted on CDN and projected here.

// ViewBox: 0 0 1009 665 (standard Natural Earth projection dimensions)
const VIEWBOX = "0 0 1009 665";

// Simple equirectangular projection helper
function lonLatToXY(lon, lat, vw = 1009, vh = 665) {
  const x = ((lon + 180) / 360) * vw;
  const y = ((90 - lat) / 180) * vh;
  return [x, y];
}

// Country centroid approximations for small-country markers
// [lon, lat]
const CENTROIDS = {
  AF:[67.7,33.9],AL:[20.2,41.2],DZ:[2.6,28.0],AO:[17.9,-11.2],AR:[-63.6,-38.4],AM:[45.0,40.1],
  AU:[133.8,-25.3],AT:[14.6,47.7],AZ:[47.6,40.1],BY:[28.0,53.5],BE:[4.5,50.5],BO:[-64.7,-16.3],
  BA:[17.7,44.2],BR:[-51.9,-14.2],BG:[25.5,42.7],CA:[-96.8,56.1],CL:[-71.5,-35.7],CN:[104.2,35.9],
  CO:[-74.3,4.1],HR:[16.4,45.2],CU:[-79.5,21.5],CZ:[15.5,49.8],DK:[10.3,56.3],DO:[-70.2,18.7],
  EC:[-78.1,-1.8],EG:[30.8,26.8],ET:[40.5,9.1],FI:[26.3,64.0],FR:[2.2,46.2],DE:[10.5,51.2],
  GH:[-1.0,7.9],GR:[21.8,39.1],GT:[-90.2,15.8],HN:[-86.2,15.2],HU:[19.5,47.2],IN:[78.7,20.6],
  ID:[117.7,-0.8],IR:[53.7,32.4],IQ:[43.7,33.2],IE:[-8.2,53.2],IL:[34.8,30.8],IT:[12.7,42.8],
  JP:[138.3,36.2],JO:[36.2,30.6],KZ:[67.0,48.0],KE:[37.9,-0.0],KG:[74.6,41.2],LA:[103.0,17.9],
  LV:[24.6,57.0],LB:[35.8,33.9],LY:[17.2,26.3],LT:[23.9,55.7],MG:[46.9,-18.8],MY:[109.7,4.2],
  ML:[-2.0,17.6],MX:[-102.5,23.6],MA:[-7.1,31.8],MZ:[35.5,-18.7],MM:[95.9,19.2],NA:[18.5,-22.0],
  NP:[84.1,28.4],NL:[5.3,52.1],NZ:[172.0,-40.9],NI:[-85.1,12.9],NG:[8.7,9.1],NO:[8.5,60.5],
  PK:[69.3,30.4],PA:[-80.8,8.6],PG:[143.9,-6.3],PY:[-58.4,-23.4],PE:[-75.0,-9.2],PH:[121.8,12.9],
  PL:[19.3,52.1],PT:[-8.2,39.4],RO:[24.9,45.9],RU:[105.3,61.5],SA:[44.5,24.2],SN:[-14.5,14.5],
  RS:[21.1,44.0],SL:[-11.8,8.6],SG:[103.8,1.4],SK:[19.7,48.7],SI:[14.8,46.1],SO:[46.2,5.2],
  ZA:[25.1,-29.0],ES:[-3.7,40.5],LK:[80.8,7.9],SD:[29.9,12.9],SE:[17.6,62.2],CH:[8.2,46.8],
  SY:[38.0,34.8],TJ:[71.3,38.9],TZ:[34.9,-6.4],TH:[100.9,15.9],TN:[9.0,33.9],TR:[35.2,39.1],
  TM:[59.6,38.9],UG:[32.3,1.4],UA:[31.2,49.0],AE:[53.8,23.4],GB:[-3.4,55.4],US:[-101.3,39.8],
  UY:[-56.0,-32.5],UZ:[63.9,41.4],VE:[-66.6,6.4],VN:[108.3,14.1],YE:[47.6,15.9],ZM:[27.8,-13.1],
  ZW:[29.9,-19.0],
};

// We fetch a simplified world GeoJSON from CDN and render it as SVG paths
// using an equirectangular projection.
const GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

// Project a GeoJSON geometry ring to SVG path commands
function ringToPath(ring) {
  return ring.map(([lon, lat], i) => {
    const [x, y] = lonLatToXY(lon, lat);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + ' Z';
}

function geometryToPaths(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates.map(ringToPath).join(' ')];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map(poly => poly.map(ringToPath).join(' '));
  }
  return [];
}

// ── Main Component ─────────────────────────────────────────────────

export default function MapFacet({ facetKey, facet, counts = {}, facetState, onChange }) {
  const selected = facetState?.values || [];
  const logic = facetState?.logic || facet?.default_logic || 'OR';

  const [geoData, setGeoData] = React.useState(null);
  const [geoError, setGeoError] = React.useState(false);
  const [tooltip, setTooltip] = useState(null);

  // Fetch GeoJSON once
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(r => r.json())
      .then(setGeoData)
      .catch(() => setGeoError(true));
  }, []);

  // Normalise count keys to alpha-2
  const normalisedCounts = useMemo(() => {
    const out = {};
    Object.entries(counts).forEach(([raw, cnt]) => {
      const a2 = normalise(raw);
      if (a2) out[a2] = (out[a2] || 0) + cnt;
    });
    return out;
  }, [counts]);

  const countriesWithData = useMemo(() => new Set(Object.keys(normalisedCounts)), [normalisedCounts]);

  const toggle = (a2) => {
    const next = selected.includes(a2)
      ? selected.filter(v => v !== a2)
      : [...selected, a2];
    onChange(facetKey, { values: next, logic });
  };

  // Compute zoom bounding box around countries that have data
  const zoomBox = useMemo(() => {
    if (countriesWithData.size === 0) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    countriesWithData.forEach(a2 => {
      const c = CENTROIDS[a2];
      if (!c) return;
      const [x, y] = lonLatToXY(c[0], c[1]);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    if (!isFinite(minX)) return null;
    // Pad generously
    const padX = Math.max(60, (maxX - minX) * 0.5);
    const padY = Math.max(60, (maxY - minY) * 0.5);
    const vx = Math.max(0, minX - padX);
    const vy = Math.max(0, minY - padY);
    const vw = Math.min(1009 - vx, maxX - minX + padX * 2);
    const vh = Math.min(665 - vy, maxY - minY + padY * 2);
    return `${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`;
  }, [countriesWithData]);

  // Build per-country SVG path data from GeoJSON
  const countryPaths = useMemo(() => {
    if (!geoData) return [];
    return geoData.features.map(f => {
      const a2 = f.properties?.ISO_A2 || f.properties?.iso_a2 || '';
      const name = f.properties?.ADMIN || f.properties?.name || a2;
      const paths = geometryToPaths(f.geometry);
      return { a2: a2.toUpperCase(), name, paths };
    });
  }, [geoData]);

  const hasData = countriesWithData.size > 0;

  if (geoError) {
    return (
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-foreground">{facet.title}</span>
        <div className="text-xs text-muted-foreground italic">Map unavailable</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-foreground">{facet.title}</span>

      {/* SVG Map */}
      <div className="relative rounded overflow-hidden border border-border/30 bg-muted/10">
        {!geoData && (
          <div className="flex items-center justify-center h-28 text-xs text-muted-foreground">Loading map…</div>
        )}
        {geoData && (
          <svg
            viewBox={zoomBox && hasData ? zoomBox : VIEWBOX}
            className="w-full"
            style={{ display: 'block', transition: 'all 0.4s ease' }}
          >
            {countryPaths.map(({ a2, name, paths }) => {
              const hasDatum = countriesWithData.has(a2);
              const isSelected = selected.includes(a2);
              const count = normalisedCounts[a2] || 0;
              return paths.map((d, i) => (
                <path
                  key={`${a2}-${i}`}
                  d={d}
                  fill={
                    hasDatum
                      ? isSelected
                        ? 'hsl(var(--primary))'
                        : 'hsl(var(--chart-2))'
                      : 'hsl(var(--muted))'
                  }
                  fillOpacity={hasDatum ? (isSelected ? 1 : 0.65) : 0.25}
                  stroke="hsl(var(--border))"
                  strokeWidth={hasDatum ? 0.6 : 0.3}
                  strokeOpacity={0.5}
                  cursor={hasDatum ? 'pointer' : 'default'}
                  onClick={() => hasDatum && toggle(a2)}
                  onMouseEnter={hasDatum ? (e) => setTooltip({ a2, name, count, x: e.clientX, y: e.clientY }) : undefined}
                  onMouseLeave={() => setTooltip(null)}
                />
              ));
            })}
          </svg>
        )}

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none rounded-md border border-border/60 bg-popover px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: tooltip.x + 10, top: tooltip.y - 30 }}
          >
            <span className="font-medium text-foreground">{tooltip.name}</span>
            <span className="ml-2 text-muted-foreground">{tooltip.count}</span>
          </div>
        )}
      </div>

      {/* Legend — countries with data */}
      {hasData && (
        <div className="space-y-1">
          {Object.entries(normalisedCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([a2, cnt]) => {
              const isActive = selected.includes(a2);
              const name = geoData
                ? countryPaths.find(c => c.a2 === a2)?.name || a2
                : a2;
              return (
                <div
                  key={a2}
                  onClick={() => toggle(a2)}
                  className={`flex items-center gap-2 cursor-pointer rounded px-1.5 py-0.5 text-[11px] transition-colors ${
                    isActive ? 'bg-muted/60 text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-sm shrink-0"
                    style={{ background: isActive ? 'hsl(var(--primary))' : 'hsl(var(--chart-2))' }}
                  />
                  <span className="flex-1 truncate">{name}</span>
                  <span className="tabular-nums">{cnt}</span>
                </div>
              );
            })}
        </div>
      )}

      {!hasData && geoData && (
        <div className="text-xs text-muted-foreground italic">No location data</div>
      )}

      {selected.length > 0 && (
        <button
          onClick={() => onChange(facetKey, { values: [], logic })}
          className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Clear
        </button>
      )}
    </div>
  );
}
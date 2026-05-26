// gallery.jsx — Rideekanda Forest Monastery gallery
// React app: hero + grid + lightbox + tweaks
// Fetches real photos from Google Places API when an API key is configured,
// falls back to deterministic earth-tone gradient placeholders otherwise.

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ──────────────────────────────────────────────────────────────────────
// Google Places configuration (key is in index.html's Maps JS script tag)
const PLACE_ID = 'ChIJLwCJ_Yz04joRwhfEgMDjxkw';
const MAX_PHOTO_WIDTH = 1200;

// ──────────────────────────────────────────────────────────────────────
// Tweakable defaults — host rewrites this block on disk when user adjusts.
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "stillness",
  "columns": 3,
  "density": "regular",
  "captions": false,
  "grain": true
}/*EDITMODE-END*/;

// ──────────────────────────────────────────────────────────────────────
// Palettes — three quiet moods.
const PALETTES = {
  stillness: {
    label: 'Stillness',
    bg: '#f3ecdc',
    paper: '#faf6ea',
    ink: '#2a2418',
    muted: 'rgba(42, 36, 24, .58)',
    line: 'rgba(42, 36, 24, .14)',
    swatch: ['#f3ecdc', '#c9b994', '#6b5a3c'],
    tones: ['#c9b994','#8b7d5b','#5a5238','#a89875','#736548','#d8c9a4','#9b8e6a','#4a4332']
  },
  forest: {
    label: 'Forest',
    bg: '#ece6d2',
    paper: '#f5efdb',
    ink: '#1c2418',
    muted: 'rgba(28, 36, 24, .58)',
    line: 'rgba(28, 36, 24, .14)',
    swatch: ['#ece6d2', '#7a8458', '#2e3a22'],
    tones: ['#5a6a48','#4a5638','#7a8458','#2e3a22','#9aa278','#5a6238','#8a9468','#3a4628']
  },
  dusk: {
    label: 'Dusk',
    bg: '#f1e7df',
    paper: '#f9f1e9',
    ink: '#33231c',
    muted: 'rgba(51, 35, 28, .58)',
    line: 'rgba(51, 35, 28, .14)',
    swatch: ['#f1e7df', '#c89a82', '#7a4e3a'],
    tones: ['#c89a82','#a06a52','#7a4e3a','#dda899','#8c5c44','#b78870','#603628','#e5c0ad']
  }
};

// ──────────────────────────────────────────────────────────────────────
// Fallback items — shown when no API key is set or while photos load.
const FALLBACK_ITEMS = [
  { caption: 'Dawn light through the canopy',              type: 'photo' },
  { caption: 'Forest path to the meditation cave',         type: 'photo' },
  { caption: 'Walking meditation track, before the bell',  type: 'photo' },
  { caption: 'The Bodhi tree at dusk',                     type: 'photo' },
  { caption: 'Almsround through the village at first light', type: 'photo' },
  { caption: 'Rain on the stupa roof',                     type: 'photo' },
  { caption: 'Cave kuti, monsoon morning',                 type: 'photo' },
  { caption: 'Lotus pond by the second pavilion',          type: 'photo' },
  { caption: 'Evening chanting in the dhamma hall',        type: 'photo' },
  { caption: 'Mist between the rubber trees',              type: 'photo' },
  { caption: 'Stone steps to the upper shrine',            type: 'photo' },
  { caption: 'View from the meditation hall window',       type: 'photo' },
];

// ──────────────────────────────────────────────────────────────────────
// Google Places — fetch real photos via Maps JavaScript API (CORS-safe)
// The Maps JS API is loaded in index.html; __onMapsReady resolves when ready.
const __mapsReady = new Promise((resolve) => {
  if (window.google?.maps?.places) { resolve(); return; }
  window.__onMapsReady = resolve;
});

function useGooglePlacePhotos() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    __mapsReady
      .then(async () => {
        if (cancelled) return;
        await google.maps.importLibrary('places');
        const place = new google.maps.places.Place({ id: PLACE_ID });
        await place.fetchFields({ fields: ['photos', 'displayName'] });
        if (cancelled) return;
        const placePhotos = place.photos || [];
        if (placePhotos.length === 0) {
          setError('No photos found for this place');
          setLoading(false);
          return;
        }
        const mapped = placePhotos.map((photo, i) => {
          const attribs = photo.authorAttributions || [];
          const authorName = attribs[0]?.displayName || `Visitor photo ${i + 1}`;
          return {
            caption: authorName,
            type: 'photo',
            src: photo.getURI({ maxWidth: MAX_PHOTO_WIDTH }),
            thumbSrc: photo.getURI({ maxWidth: 400 }),
            width: photo.widthPx,
            height: photo.heightPx,
            attribution: authorName,
          };
        });
        setPhotos(mapped);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('Google Places photo fetch failed:', err);
        setError(err.message || 'Places API failed');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { photos, loading, error };
}

// Aspect-ratio rhythm for masonry tiles — mix of tall / medium / square / wide
// gives the page a hand-arranged feel rather than a uniform grid.
const ASPECTS = [
  '3 / 5',  '4 / 5',  '1 / 1',  '3 / 4',
  '4 / 5',  '4 / 3',  '3 / 5',  '1 / 1',
  '4 / 5',  '3 / 4',  '4 / 3',  '4 / 5',
  '3 / 5',  '1 / 1',  '4 / 5',  '3 / 4',
  '4 / 5',  '4 / 3',  '3 / 5',  '1 / 1',
  '4 / 5',  '3 / 4',  '4 / 5',  '4 / 3'
];

// Pseudo-random but deterministic shuffler so tile gradients feel varied per index
function gradient(i, tones) {
  const n = tones.length;
  const a = tones[(i * 5 + 1) % n];
  const b = tones[(i * 11 + 3) % n];
  const c = tones[(i * 17 + 5) % n];
  const angle = ((i * 53) % 180);
  const variants = [
    `linear-gradient(${angle}deg, ${a} 0%, ${b} 55%, ${c} 100%)`,
    `linear-gradient(180deg, ${a} 0%, ${b} 60%, ${c} 100%)`,
    `radial-gradient(ellipse at 50% 75%, ${a} 0%, ${b} 45%, ${c} 100%)`,
    `linear-gradient(${angle + 30}deg, ${c}, ${b} 50%, ${a})`,
    `linear-gradient(160deg, ${a} 0%, ${b} 40%, ${c} 100%)`,
    `radial-gradient(circle at 30% 30%, ${a} 0%, ${b} 50%, ${c} 100%)`
  ];
  return variants[i % variants.length];
}

// ──────────────────────────────────────────────────────────────────────
// Small SVG primitives (brand glyph + play icon)
function Lotus({ className }) {
  return (
    <img
      className={className}
      src="assets/lotus.png"
      alt="Rideekanda Forest Monastery"
      draggable="false"
    />
  );
}
function PlayGlyph() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 3 L17 10 L5 17 Z" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Tile
function Tile({ item, index, onOpen }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const delay = (index % 6) * 70;
          setTimeout(() => setVisible(true), delay);
          io.unobserve(el);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [index]);

  const hasSrc = !!item.thumbSrc || !!item.src;
  const bg = item.gradient;
  const ar = ASPECTS[index % ASPECTS.length];
  return (
    <figure
      ref={ref}
      className={`tile ${visible ? 'in' : ''}`}
      onClick={() => onOpen(index)}
      style={{ ['--tile-bg']: bg, ['--tile-ar']: ar }}
      role="button"
      aria-label={`Open ${item.caption}`}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(index); }}
    >
      <div className="ph" />
      {hasSrc && (
        <img
          className={`tile-img ${imgLoaded ? 'loaded' : ''}`}
          src={item.thumbSrc || item.src}
          alt={item.caption}
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          draggable="false"
        />
      )}
      <div className="grain" />
      <div className="vignette" />
      {item.type === 'video' && (
        <div className="play"><PlayGlyph /></div>
      )}
      <div className="idx">{String(index + 1).padStart(2, '0')}</div>
      <figcaption className="cap">{item.caption}</figcaption>
    </figure>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Lightbox
function Lightbox({ items, index, onClose, onPrev, onNext }) {
  const open = index !== null;
  const item = open ? items[index] : null;
  const [swapping, setSwapping] = useState(false);
  const lastIdx = useRef(index);

  // brief crossfade on item change
  useEffect(() => {
    if (index === lastIdx.current) return;
    if (!open) { lastIdx.current = index; return; }
    setSwapping(true);
    const t = setTimeout(() => { setSwapping(false); }, 220);
    lastIdx.current = index;
    return () => clearTimeout(t);
  }, [index, open]);

  // keyboard
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onPrev();
      else if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose, onPrev, onNext]);

  return (
    <div className="lb" data-open={open ? 1 : 0} onClick={onClose} role="dialog" aria-modal="true">
      {open && (
        <>
          <button className="lb-x" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close">✕</button>
          <button className="lb-nav prev" onClick={(e) => { e.stopPropagation(); onPrev(); }} aria-label="Previous">‹</button>
          <button className="lb-nav next" onClick={(e) => { e.stopPropagation(); onNext(); }} aria-label="Next">›</button>
          <div className="lb-stage" onClick={(e) => e.stopPropagation()}>
            <div
              className={`lb-frame ${swapping ? 'swap' : ''} ${item.src ? 'has-img' : ''}`}
              style={{
                ['--tile-bg']: item.gradient,
                aspectRatio: item.src ? undefined : (typeof ASPECTS !== 'undefined' ? ASPECTS[index % ASPECTS.length] : '4 / 5')
              }}
            >
              <div className="ph" />
              {item.src && (
                <img
                  className="lb-img"
                  src={item.src}
                  alt={item.caption}
                  draggable="false"
                />
              )}
              <div className="grain" />
              <div className="vignette" />
              {item.type === 'video' && (
                <div className="play big"><PlayGlyph /></div>
              )}
            </div>
            <div className="lb-meta">
              <div className="num">{String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</div>
              <div className="cap">{item.caption}</div>
              <div className="num right">
                {item.attribution
                  ? <span dangerouslySetInnerHTML={{ __html: item.attribution }} />
                  : 'Photograph'}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Apply palette to CSS variables on :root
function applyPalette(p) {
  const r = document.documentElement.style;
  r.setProperty('--bg', p.bg);
  r.setProperty('--paper', p.paper);
  r.setProperty('--ink', p.ink);
  r.setProperty('--muted', p.muted);
  r.setProperty('--line', p.line);
  p.tones.forEach((t, i) => r.setProperty(`--t${i + 1}`, t));
}

// ──────────────────────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [idx, setIdx] = useState(null);
  const { photos, loading, error } = useGooglePlacePhotos();

  const palette = PALETTES[t.palette] || PALETTES.stillness;
  useEffect(() => { applyPalette(palette); }, [palette]);

  useEffect(() => {
    const gap = t.density === 'spacious' ? 40 : t.density === 'dense' ? 12 : 24;
    document.documentElement.style.setProperty('--gap', `${gap}px`);
    document.documentElement.style.setProperty('--cols', String(t.columns));
    document.body.dataset.captions = t.captions ? '1' : '0';
    document.body.dataset.grain = t.grain ? '1' : '0';
  }, [t.density, t.columns, t.captions, t.grain]);

  const sourceItems = photos.length > 0 ? photos : FALLBACK_ITEMS;

  const items = useMemo(() => sourceItems.map((it, i) => ({
    ...it,
    gradient: gradient(i, palette.tones)
  })), [palette, sourceItems]);

  const open  = useCallback((i) => setIdx(i), []);
  const close = useCallback(() => setIdx(null), []);
  const prev  = useCallback(() => setIdx((i) => (i === null ? null : (i - 1 + items.length) % items.length)), [items.length]);
  const next  = useCallback(() => setIdx((i) => (i === null ? null : (i + 1) % items.length)), [items.length]);

  const photoCount = items.filter(i => i.type === 'photo').length;

  return (
    <>
      <main className="shell">
        <section className="hero" data-screen-label="02 Hero">
          <Lotus className="lotus" />
          <p className="place">Rideekanda&nbsp;·&nbsp;Forest Monastery</p>
          <div className="rule" />
        </section>

        <section className="intro" data-screen-label="03 Intro">
          <p className="lead">A gallery</p>
          <p style={{margin: 0}}>
            Photographs shared by visitors to the forest
            monastery — quiet glimpses of a place that asks for very little, and gives
            back what arrives in the silence.
          </p>
        </section>

        {loading && (
          <div className="api-status loading">
            <div className="api-spinner" />
            <span>Loading photos from Google Maps…</span>
          </div>
        )}

        {error && (
          <div className="api-status error">
            <span>Could not load Google Maps photos — showing placeholders</span>
          </div>
        )}

        <section className="gallery-section" data-screen-label="04 Gallery">
          <div className="section-label">
            <span>Gallery</span>
            <span className="line" />
            <span className="count">
              {String(photoCount).padStart(2,'0')} photographs
              {photos.length > 0 && ' · via Google Maps'}
            </span>
          </div>

          <div className="grid">
            {items.map((it, i) => (
              <Tile key={i} item={it} index={i} onOpen={open} />
            ))}
          </div>
        </section>

        <footer className="footer" data-screen-label="05 Footer">
          <div className="mono"><Lotus /></div>
          <p>Rideekanda Forest Monastery</p>
          <p className="note">photographs shared by visitors via Google Maps</p>
        </footer>
      </main>

      <Lightbox
        items={items}
        index={idx}
        onClose={close}
        onPrev={prev}
        onNext={next}
      />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Palette" />
        <TweakColor
          label="Mood"
          value={palette.swatch}
          options={Object.values(PALETTES).map(p => p.swatch)}
          onChange={(v) => {
            const key = Object.entries(PALETTES).find(([, p]) => p.swatch.join() === v.join())?.[0];
            if (key) setTweak('palette', key);
          }}
        />

        <TweakSection label="Layout" />
        <TweakRadio
          label="Columns"
          value={String(t.columns)}
          options={['2', '3', '4']}
          onChange={(v) => setTweak('columns', parseInt(v, 10))}
        />
        <TweakRadio
          label="Density"
          value={t.density}
          options={['dense', 'regular', 'spacious']}
          onChange={(v) => setTweak('density', v)}
        />

        <TweakSection label="Detail" />
        <TweakToggle
          label="Captions always visible"
          value={t.captions}
          onChange={(v) => setTweak('captions', v)}
        />
        <TweakToggle
          label="Paper grain"
          value={t.grain}
          onChange={(v) => setTweak('grain', v)}
        />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

# Rideekanda Forest Monastery — Gallery

A quiet, contemplative web gallery for photographs and short videos shared by visitors via Google Maps.

## Files

```
index.html          – page shell, loads React + Babel + the gallery
styles.css          – all visual styles (palette tokens, masonry grid, lightbox)
gallery.jsx         – gallery app (items list, tiles, lightbox, tweaks)
tweaks-panel.jsx    – design-tweaks panel (hidden in production)
assets/
  lotus.png         – monastery logo
```

## Adding real Google Maps photos / videos

Open `gallery.jsx` and replace the entries in the `ITEMS` array.
Each entry currently looks like:

```js
{ caption: 'Dawn light through the canopy', type: 'photo' }
```

Add a `src` field with the image or video URL:

```js
{ caption: 'Dawn light through the canopy', type: 'photo', src: 'photos/dawn.jpg' }
{ caption: 'Rain on the stupa roof',       type: 'video', src: 'videos/rain.mp4', poster: 'photos/rain-poster.jpg' }
```

(The placeholder gradient renders only when `src` is missing — once you add real URLs the tile and the lightbox will show the actual photo/video.)

> Note: tile / lightbox markup currently renders the placeholder. If you want me to wire in `<img>` / `<video>` rendering for real media, just ask.

## Hosting on GitHub Pages

1. Push this folder to a repository (or to the `gh-pages` branch of an existing one).
2. In the repo **Settings → Pages**, choose the branch and the folder containing `index.html`.
3. GitHub will serve it at `https://<user>.github.io/<repo>/`.

The `.nojekyll` file ships with this folder so GitHub Pages serves files as-is without Jekyll processing.

## Local preview

Open `index.html` in any modern browser. No build step required — Babel compiles the JSX in the page on load.

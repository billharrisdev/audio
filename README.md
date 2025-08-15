## Audio Source Separation Web App (Angular + GitHub Pages)

This project hosts a lightweight, client‑side (browser) demo for removing or attenuating stems (vocals, drums, bass, guitar) from a mixed audio track. It is implemented as an Angular application and deploys automatically to GitHub Pages.

### Features (MVP)

- Upload a local audio file (mp3 / wav / m4a / etc. supported by the browser).

- Or pick from included/sample Creative Commons demo tracks.
- Choose a stem to remove (vocals, drums, bass, guitar) using simple heuristic DSP filters.

- Render a new processed audio file fully in the browser (OfflineAudioContext).
- Download or preview the processed result (WAV format output).
- Responsive, minimal UI ready for extension with real ML models (e.g., Demucs / Spleeter via WebAssembly or remote API later).

### IMPORTANT QUALITY NOTE

True source separation requires trained machine learning models. The current implementation uses fast, naive/heuristic filtering techniques:

- Vocals: Mid/center cancellation (L-R) approximation.
- Bass: High‑pass filtering to attenuate low frequencies.
- Guitar: Multi mid‑band notch filters.

- Drums: Broad spectral attenuation + transient softening approximation (very crude).

These approaches will NOT give production quality results, but they demonstrate the architecture, UI flow, and offline processing pipeline while keeping everything 100% client‑side and lightweight. You can later plug in a proper model (see "Future Enhancements" below).

### Tech Stack

- Angular 17 (standalone APIs)
- TypeScript

- Web Audio API (OfflineAudioContext, BiquadFilterNode, ChannelSplitter/Merger)
- GitHub Actions for CI deploy to `gh-pages`

### Local Development

```bash
npm install

npm start
```

Then open: http://localhost:4200

### Building

```bash
npm run build
```

Outputs to `dist/audio-app/browser`.

### Deploy (Manual)

```bash
npm run deploy:gh
```

This builds with the correct `baseHref` and publishes the `dist` folder to the `gh-pages` branch (using the `gh-pages` npm package if run locally). Normally this is handled automatically by the GitHub Actions workflow on push to `main`.

### GitHub Pages Configuration

The app expects to be served at `/audio/` (repository name). If you fork or rename, adjust:

1. `angular.json` -> `projects.audio-app.architect.build.options.baseHref`
2. Workflow file `.github/workflows/deploy.yml` (the `--base-href` flag)
3. `package.json` deploy script (same flag)

### Project Structure (Key Files)

```
package.json

angular.json
src/
	main.ts
	index.html
	styles.css
	app/
		app.routes.ts
		app.component.ts
		components/source-separator/
			source-separator.component.ts
			source-separator.component.html
			source-separator.component.css
		services/audio-separation.service.ts
		util/wav-encoder.ts
```

### Future Enhancements

- Plug in ONNX / WebAssembly model (Demucs / MDX / Spleeter) with `onnxruntime-web`.
- Worker thread offloading for heavy computation & progress UI.
- Multi-stem export (individual isolated stems instead of only "mix minus target").
- Waveform + spectral visualization (Canvas/WebGL).
- Drag & drop & mobile refinements.
- Caching & model lazy loading.

### ML Separation (Experimental)

An experimental scaffold for a quantized MDX-Demucs 4-stem ONNX model is included:

- Model registry: `src/app/services/ml/model-registry.ts`
- Worker-based inference: `src/app/workers/onnx-separator.worker.ts`
- Lazy-loading runtime: `onnxruntime-web` imported dynamically inside the worker to keep initial bundle small.
- UI toggle: Enable "Use ML Model" in the main page to attempt model-based separation (currently placeholder behavior until a real model is supplied).

To activate real separation:
1. Provide a quantized ONNX model at `src/assets/models/mdx_demucs_4stem_q.onnx` (or adjust path/ID in registry).
2. Update worker code to perform correct preprocessing (STFT / normalization) and map real output tensor names to stems.
3. (Optional) Implement chunked streaming to reduce peak memory usage for long tracks.
 4. (Optional) Host the model via CDN / GitHub Release and update the URL in `model-registry.ts` to avoid inflating the repo size.


### License & Audio Samples

Sample audio (if added later) must retain original licenses/attribution. Current demo includes only a tiny embedded CC0 clip for demonstration. Replace with properly licensed content for broader use.


# audio
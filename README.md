# VIT SMART — Movement Studio

**Live site:** [chubikm.github.io/VIT-ENT](https://chubikm.github.io/VIT-ENT/)

A browser-first exercise observation prototype for ENT303TC Team Technopreneurship. Open the studio as a guest, analyze movement locally, and optionally discuss a text summary with an AI model using your own API key.

## Browser edition

- **Guest workspace:** no registration, account database or server session.
- **Local pose analysis:** camera or saved video, MediaPipe landmarks, image-plane joint angles and visibility statistics. Video never leaves the browser.
- **Session summary:** bounded in-memory aggregates and observation notes, with JSON export. A new session replaces the previous one; reloading clears the workspace.
- **Direct AI connection:** user-entered DashScope key, Beijing/Singapore region selection, model selection, streamed responses, connection test, cancellation and explicit error states.
- **Private by default:** keys are not written to localStorage, sessionStorage, URLs, databases or build output. Changing region, clearing the key, or leaving/reloading the page removes it. AI requests go directly to the selected provider; no VIT SMART proxy is involved.
- **Responsive interface:** landing page, movement studio, local summary and AI companion; usable under a GitHub Pages repository subpath.

The static interface includes a browser Web Serial CH1 waveform module, a clearly labeled synthetic demo, pasted-data parsing and CSV export. Node serial-port controls and account login remain excluded. The existing backend source is retained separately for development/reference and is not shipped to Pages.

## Run locally

Use Node.js 22 or newer. The static build and preview use only built-in Node modules, so **no dependency installation or `.env` file is required**.

```bash
npm run test:static
npm start
```

Open [http://localhost:4922/VIT-ENT/](http://localhost:4922/VIT-ENT/).

Individual commands:

```bash
npm run build       # Copy the explicit public-file allowlist into dist/
npm run preview     # Serve dist/ locally, including the Pages subpath
```

Camera access needs HTTPS or localhost. Internet access is required for the MediaPipe runtime/model, optional web fonts, and AI calls. The pose model loads only when starting a camera or video session, with CPU fallback if GPU initialization fails.

## Connect AI

1. Open **AI companion**.
2. Select the region matching your DashScope key and enter an available model (default: `qwen-plus`).
3. Enter your own API key. **Test connection** sends a small model request and may consume API credits.
4. Send a message. Enable **Include current session summary** only when you want that structured text shared. Video is never sent.

Messages and a bounded recent conversation are sent directly to the provider. Generated explanations are not validated exercise or medical advice. Use a trusted browser/device for a browser-entered API key.

On 2026-10-28, real browser requests from the deployed `https://chubikm.github.io/VIT-ENT/` site could read `401 invalid_api_key` responses from both supported regions. Beijing's explicit preflight also allowed POST and Authorization/Content-Type headers. This verifies the tested cross-origin request and error path, not a paid successful inference. See [deployment and verification notes](docs/github-pages-readiness.md).

## GitHub Pages

The prepared [workflow](.github/workflows/pages.yml) runs on pushes to **main** (and manual dispatch) and publishes only `dist/`.

1. `main` contains the deployable application and project evidence. Use `web_dev` for development, then merge into `main` to publish.
2. In **Settings → Pages**, choose **GitHub Actions** as the publishing source.
3. Push to `main` or dispatch **Deploy browser studio to Pages**. The `github-pages` environment must allow `main`.
4. Verify the deployment URL, camera permission, video analysis and your own provider connection.

No API key is needed in GitHub Secrets or the build. Do not publish the repository root: it contains backend files and project materials. The build excludes `.env`, databases, research documents and Node dependencies.

## Validation

`npm run test:static` covers aspect-corrected angles, missing/partial detections, sample accounting, request validation, streaming boundaries, errors, timeouts, cancellation and static-route checks. Browser acceptance covered the Pages subpath, guest flow, real MediaPipe loading with a synthetic camera, generated local video, stop/completion, summary export, phone layout and key clearing. Synthetic inputs validate the pipeline; they do not establish human movement accuracy.

The older server tests remain available through `npm test` after installing native dependencies compatible with your Node version. `npm run start:legacy` starts the retained Express API; the current frontend does not depend on it.

## Scope and evidence

VIT SMART is re-validating the value of EMG, pose and hybrid feedback. This static edition focuses on visible movement observations. Its joint angles are 2D estimates; visibility is not accuracy, and left–right differences are not proof of incorrect form, injury or fatigue.

See the project's [Baseline Declaration](docs/01_Baseline/Baseline_Declaration.md) for the prior development cycle and unresolved evidence gaps.

## Repository provenance

Migrated to [CHUBIKM/VIT-ENT](https://github.com/CHUBIKM/VIT-ENT) from [Peidong111/ENT-Project-VIT-SMART](https://github.com/Peidong111/ENT-Project-VIT-SMART), preserving the application and evidence commit histories. The original repository is retained.

## EMG frontend

Open **EMG waveform**. Desktop Chrome/Edge with Web Serial can select a local serial device (default 115200 baud, 8-N-1). No Node service is used. Unsupported browsers can still use pasted data and the explicitly labeled synthetic demo.

Accepted newline-terminated formats: `CH1:123`, `channel 1=123`, numeric CSV (CH1 is the first column), or a single numeric value. CR/LF/CRLF and fragmented reads are supported. Unlike the old parser, diagnostic lines such as `error 404` are ignored. A partial line waits for its delimiter; firmware without line endings must be adjusted before using this mode.

The waveform retains the latest 512 received samples; the x-axis is sample order, not elapsed time. The raw signal is preserved alongside legacy display smoothing (alpha 0.22, step clamp 240). Export includes data source and browser receipt timestamps. Simulated exports remain labeled after stopping. No fatigue classification or automatic AI sharing is performed.

Frontend tests cover formats, framing, bounded buffering, filtering, mocked serial disconnect/unplug/reconnect and mobile layout. Physical CH340/EMG acquisition has not been verified.

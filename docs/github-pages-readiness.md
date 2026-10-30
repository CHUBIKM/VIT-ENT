# GitHub Pages — static edition and verification

Checked: 2026-10-28. Status: deployed and browser-validated at https://chubikm.github.io/VIT-ENT/.

## Architecture

```text
GitHub Pages -> landing page / guest workspace
Camera or local video -> browser MediaPipe -> in-memory aggregate -> JSON export
User message + optional text summary -> direct DashScope request -> streamed answer
```

The static frontend has no `/api`, `/login`, `/register`, SQLite or Node serial dependencies. MediaPipe runtime/model downloads and optional web fonts still require internet access. No offline guarantee is made. Existing Express/SQLite source remains for reference and server tests; it is not included in the static artifact.

## Files and publishing

- `npm run build`: copies an explicit list of eight public files into `dist/`, plus `.nojekyll`.
- `npm run preview`: serves the result at `/VIT-ENT/` as well as the local root.
- `.github/workflows/pages.yml`: pushes to `main` or manual dispatch, static tests, build, Pages artifact upload and deploy. No dependency install or API secret is required.
- A repository administrator must select GitHub Actions in Settings → Pages. Pushes to `main` trigger deployment; environment protection must allow that branch. Manual dispatch in the UI requires the workflow on the default branch.
- Relative assets, navigation and module imports support the repository subpath. Only `dist/` is published; private research files, databases and `.env` are excluded.

## Live CORS checks

Source origin used: `https://peidong111.github.io` (no path; CORS is origin-based).

| Check | Endpoint | Observed result |
| --- | --- | --- |
| Explicit OPTIONS preflight | Beijing `/compatible-mode/v1/chat/completions` | HTTP 200; `Access-Control-Allow-Origin: *`; methods POST/GET; allowed headers authorization, content-type |
| Actual POST with deliberately invalid placeholder key | Beijing | HTTP 401; `Access-Control-Allow-Origin: *`; JSON `invalid_api_key` readable |
| Browser fetch with normal CORS enforcement | Beijing | Readable HTTP 401 / `invalid_api_key` |
| Browser fetch with normal CORS enforcement | Singapore | Readable HTTP 401 / `invalid_api_key` |

For browser checks, Playwright served the local built HTML/assets at the Pages URL via interception. Provider requests were real, external requests with standard browser CORS enforcement; no provider response was mocked for these checks. This is not an actual GitHub Pages deployment.

A deliberately invalid key avoids using private credentials or charging a model request. The results demonstrate preflight/request/error-response compatibility at the time of testing. Successful authenticated streaming still needs a valid user key; provider policies may change. Choose a key for the matching region. The UI offers an explicit connection test.

## Reproduce browser checks

After `npm run build`, run `npm run test:browser` in an environment with Playwright and Chrome installed. If Playwright is outside this project, set `PLAYWRIGHT_MODULE` to its module path. The script creates a temporary browser profile, simulates the Pages origin, and saves screenshots/CORS results/exported JSON to a fresh temporary directory. It uses only synthetic camera/video and an explicitly invalid key for real provider probes.

## Browser acceptance

- Guest entry and repository-subpath navigation.
- Missing key blocks requests; key clearing, region change and refresh remove the input; no local/session storage.
- Mocked successful AI stream for deterministic response-display testing, separately from real CORS checks.
- Real MediaPipe model download/initialization and inference over Chrome's synthetic camera.
- A generated local WebM file runs through the real inference loop and stops at video completion.
- Local summaries include missed detections in the denominator, count each sampled frame once, and export as JSON without keys or video.
- Phone viewport checks and screenshots; no legacy API calls or uncaught page errors in the exercised flows.

These checks establish software behavior only. No real person's movement, physical EMG hardware, medical accuracy, or successful paid AI inference was validated.

## Data lifecycle

- Latest session aggregate and up to 20 observation notes live in page memory; no per-frame archive grows without bound.
- At most four recent conversation exchanges are retained in memory.
- Media objects and camera tracks are released on stop, completion, error or leaving the page.
- Only user-requested AI messages, recent conversation and explicitly selected summary text reach DashScope.
- Keys are held only in the page input and in-flight request, not in browser persistence or source files. Clear/region change/navigation also abort an active AI request.
- JSON export contains only a session summary. Refresh clears the workspace.

## References

- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [DashScope endpoints and region-specific keys](https://help.aliyun.com/en/model-studio/base-url)

## New repository

The project now lives at `CHUBIKM/VIT-ENT`. `main` deploys to `https://chubikm.github.io/VIT-ENT/`; `web_dev` is the development branch. The historical CORS checks above used the old origin. The new deployed site passed live acceptance as recorded below.

## Live acceptance — CHUBIKM/VIT-ENT

- Deployed application commit: `860e5a5` (merged source/evidence histories).
- Successful Actions run: https://github.com/CHUBIKM/VIT-ENT/actions/runs/40655969627
- The real public site returned HTTP 200. Browser tests loaded the deployed HTML/modules directly, without interception of site resources.
- Guest entry, subpath navigation, real MediaPipe model load, synthetic camera inference, generated local WebM analysis, automatic completion, stop, summary and JSON export passed.
- Beijing and Singapore requests from the actual Pages origin returned readable HTTP 401 / `invalid_api_key` with the intentionally invalid test key. No real key or paid inference was used.
- AI success display was tested separately with a mocked provider stream; live successful authenticated inference remains user-key-dependent.
- Key validation, clearing, region-change clearing, refresh, mobile overflow checks, absence of legacy API calls and absence of uncaught page errors passed in the exercised flows.
- Repeat against the public site with `LIVE_SITE=1 npm run test:browser` (requires Playwright and Chrome; set `PLAYWRIGHT_MODULE` if installed externally). Without `LIVE_SITE=1`, the script serves local build files at the same origin for isolated acceptance.

## EMG frontend addition — 2026-10-30

A Web Serial CH1 module is now prepared in development, alongside local paste/demo inputs and CSV export. It has no Node API dependency. Frontend tests use a mocked serial stream, not physical hardware. Web Serial requires a supporting browser and a secure context; see https://developer.chrome.com/docs/capabilities/serial. The capture button is labeled `Start capture`; generated samples retain simulated provenance. Run `LIVE_SITE=1 node scripts/check-emg-browser.cjs` with `PLAYWRIGHT_MODULE` to verify the deployed assets, paste parsing, mocked serial framing/reconnection, random captures, CSV export and mobile layout.


### EMG live acceptance — 2026-10-30

- Deployed application commit: `4bfd52b`.
- Successful Pages run: https://github.com/CHUBIKM/VIT-ENT/actions/runs/41081741600 (manually dispatched after push).
- Loaded the actual Pages HTML and modules without resource interception. The deployed EMG module SHA-256 matched the local source.
- `Start capture`, two distinct randomized captures, stopping/restarting, simulated-source CSV export, pasted CH1/CSV parsing, invalid-line handling, mobile overflow and Studio navigation passed without uncaught page errors.
- Mocked Web Serial tests on the live page passed: 115200 baud, fragmented input, disconnect, unplug and reconnect. These do not validate physical hardware or real EMG signal quality.
- Static unit tests: 11 passed. Browser evidence screenshots and CSV are generated in the operating system temporary directory by `scripts/check-emg-browser.cjs`.

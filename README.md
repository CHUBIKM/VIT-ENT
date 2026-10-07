# VIT SMART

> **Evidence-led Smart Exercise Feedback System**  
> A continuing student venture developed for ENT303TC Team Technopreneurship.

VIT SMART explores how exercise signals and movement observations can become understandable, actionable feedback. The existing web prototype combines EMG waveform display, camera-based pose analysis, serial-device communication, and AI-assisted explanations.

**Current status:** the project is re-validating its core problem and technical direction. The existing prototype demonstrates an integrated workflow; it does not establish the accuracy of fatigue detection or the effectiveness of training advice.

## Project direction

The previous development cycle focused on EMG-based muscle fatigue monitoring, using three display states: **Normal**, **High Load**, and **Fatigue Risk**.

The [Baseline Declaration](docs/01_Baseline/Baseline_Declaration.md) records the limitations of this approach: fatigue thresholds lack sufficient physiological validation, signal stability is affected by sensor placement and movement, and some original raw evidence may no longer be available.

The current cycle will compare three possible directions:

- **EMG feedback:** determine whether physiological signals can support reliable, defensible exercise feedback.
- **Pose and movement-quality feedback:** assess whether visible movement features provide practical, actionable guidance.
- **Hybrid feedback:** investigate whether combining the two adds value over either approach alone.

The final direction remains open and will be selected using fresh user, technical, and market evidence.

## Repository guide

| Branch | Purpose | Contents |
| --- | --- | --- |
| [`main`](https://github.com/Peidong111/ENT-Project-VIT-SMART/tree/main) | Project overview and evidence hub | Baseline declaration, previous presentation, and fresh user interview document |
| [`web_dev`](https://github.com/Peidong111/ENT-Project-VIT-SMART/tree/web_dev) | Runnable web prototype | Node.js server, dashboard, pose-data pipeline, serial integration, and tests |
| [`web_frontend_public`](https://github.com/Peidong111/ENT-Project-VIT-SMART/tree/web_frontend_public) | Separate frontend snapshot | Static HTML pages; no backend server |

**To run the application, use `web_dev`.** The default `main` branch does not contain the application or its `package.json`.

## Existing prototype

The following capabilities are present in the `web_dev` source:

| Area | Implementation |
| --- | --- |
| Accounts | Registration and password verification with bcrypt hashes and SQLite storage |
| EMG display | Serial CH1 waveform display and threshold-based three-state feedback |
| Pose input | MediaPipe Pose Landmarker with camera and uploaded-video input |
| Pose data | APIs and SQLite storage for sessions, frame features, action samples, risk events, and summaries |
| Serial devices | Port discovery, connection management, sending, and receive logs through the Node.js backend |
| AI assistance | Qwen chat, streamed responses, and analysis based on structured pose summaries |

The backend uses **Node.js, Express, better-sqlite3, bcryptjs, and serialport**. The browser interface uses HTML, CSS, JavaScript, and MediaPipe.

### Data flow

```text
Serial-connected device -> Node.js serial service -> EMG waveform and state display

Camera / local video -> Browser MediaPipe pose analysis
                     -> Pose APIs -> SQLite -> Structured session summary
                                           -> Qwen analysis -> Dashboard

Dashboard chat -> Node.js Qwen proxy -> Model response
```

These are implemented paths in the prototype. A validated combined EMG-and-pose assessment has not yet been established.

## Run the web prototype

### Requirements

- Node.js **22.x or 24.x** with npm. These versions are supported by the checked-in dependency requirements; the older Node.js 18 instruction is insufficient.
- A browser with camera access for live pose input, or a local video for video analysis.
- Internet access for the externally hosted MediaPipe runtime and model.
- A compatible serial-connected device for live EMG input.
- A provider API key for Qwen features. Other parts of the application can be explored without it.

### Setup

```bash
git clone --branch web_dev https://github.com/Peidong111/ENT-Project-VIT-SMART.git
cd ENT-Project-VIT-SMART
npm ci
cp .env.example .env
```

For AI features, edit `.env`:

```dotenv
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-plus
```

Keep real API keys out of version control.

```bash
npm start
```

Open [http://localhost:4922](http://localhost:4922).

The server creates `auth.db` and `pose.db` by default. Optional settings include `PORT`, `AUTH_DB_PATH`, `POSE_DB_PATH`, `JSON_BODY_LIMIT`, and `BCRYPT_ROUNDS`; see [the environment template](https://github.com/Peidong111/ENT-Project-VIT-SMART/blob/web_dev/.env.example).

Serial ports are accessed on the machine running the Node.js server. Native dependencies such as `better-sqlite3` and `serialport` may require platform build tools if compatible prebuilt binaries are unavailable.

### Tests and technical reference

```bash
npm test
```

The existing tests cover account flows, legacy password migration, missing AI configuration, a basic pose-data pipeline, and mocked serial operations. These tests do not establish real-device reliability, pose accuracy, or physiological validity.

See the [pose data contract](https://github.com/Peidong111/ENT-Project-VIT-SMART/blob/web_dev/docs/pose-data-contract.md) and [test source](https://github.com/Peidong111/ENT-Project-VIT-SMART/blob/web_dev/test/auth.test.js) for implementation details.

## Evidence hub

| Material | Purpose |
| --- | --- |
| [Baseline overview](docs/01_Baseline/README.md) | Starting evidence structure for the current development cycle |
| [Baseline Declaration](docs/01_Baseline/Baseline_Declaration.md) | Previous outputs, known limitations, and re-validation priorities |
| [Previous outputs](docs/01_Baseline/Previous_Outputs/README.md) | Context for retained historical artefacts |
| [Previous Demo Day presentation](docs/01_Baseline/Previous_Outputs/Session%5B3%5DGroup%5B3%5D_DemoDay.pptx) | Historical presentation |
| [Fresh User Interview document](docs/02/Fresh%20User%20Interview.docx) | User-research material retained in the repository |

Historical presentations and interview documents should be read in context; their presence alone does not establish technical performance or market demand.

## Known limitations

- **EMG states are heuristic.** The current UI maps received values to fixed thresholds. Labels such as “Fatigue Risk” are prototype outputs, not validated physiological conclusions.
- **Pose feedback requires evaluation.** Camera framing, visibility, exercise type, and movement conditions need explicit accuracy and reliability checks.
- **AI output is generated guidance.** Connecting a language model to summaries does not validate the observations or recommendations.
- **Account protection is incomplete.** The backend checks credentials but does not establish an authenticated session or enforce authentication on pose, AI, and serial routes. Keep the prototype in a controlled local environment until access controls are implemented.
- **Hardware acceptance remains separate from software tests.** Mocked serial tests do not demonstrate stable EMG acquisition during exercise.

## Next validation priorities

1. Re-confirm the target user, exercise context, and problem through fresh research.
2. Compare demand for fatigue feedback, posture feedback, and a hybrid experience.
3. Evaluate EMG stability and pose-feedback reliability under defined conditions with appropriate reference measurements.
4. Select a bounded prototype direction and define measurable acceptance criteria.
5. Update the value proposition, competitor analysis, and business assumptions from the resulting evidence.

The aim is to build a defensible exercise-feedback system whose claims can be traced to evidence.

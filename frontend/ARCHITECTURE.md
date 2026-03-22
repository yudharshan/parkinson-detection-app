# NeuroTrack – Frontend Architecture

Scalable frontend-only structure for a React Native (Expo) health app that collects **accelerometer**, **reaction time**, and **tracing task** data, ready for future ML API integration.

---

## Folder Structure

```
NeuroTrack/
├── app/                          # Expo Router (file-based routing)
│   ├── _layout.tsx               # Root layout, providers, theme
│   ├── index.tsx                 # Entry / home
│   ├── (tabs)/                   # Tab navigator group
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Dashboard / home tab
│   │   ├── tasks.tsx             # Task list (accelerometer, reaction, tracing)
│   │   └── history.tsx           # Past sessions
│   ├── accelerometer/
│   │   └── [sessionId].tsx       # Accelerometer data collection screen
│   ├── reaction/
│   │   └── [sessionId].tsx       # Reaction time task screen
│   ├── tracing/
│   │   └── [sessionId].tsx       # Tracing task screen
│   └── settings.tsx
│
├── src/
│   ├── components/               # Reusable UI
│   │   ├── common/               # Buttons, cards, layout, typography
│   │   ├── sensors/              # Accelerometer viz, reaction UI, tracing canvas
│   │   └── tasks/                # Task cards, session summary
│   ├── screens/                  # Screen composition (optional; can live in app/)
│   │   ├── accelerometer/
│   │   ├── reaction/
│   │   └── tracing/
│   ├── services/                 # I/O and side effects
│   │   ├── api/                  # ML API client (future)
│   │   ├── sensors/              # Accelerometer, device motion
│   │   ├── storage/              # Local persistence (AsyncStorage / MMKV)
│   │   └── export/               # Export data (JSON, CSV) for ML
│   ├── models/                   # Data shapes and types
│   │   ├── accelerometer.ts
│   │   ├── reaction.ts
│   │   ├── tracing.ts
│   │   └── session.ts
│   ├── hooks/                    # Custom hooks (sensors, API, state)
│   ├── utils/                    # Helpers, formatters, validation
│   ├── constants/                # Routes, config, feature flags
│   ├── theme/                    # Colors, spacing, typography
│   └── navigation/               # Types, params (if not using Expo Router only)
│
├── assets/                       # Images, fonts
├── app.json
├── package.json
└── tsconfig.json
```

---

## Module Roles

| Layer        | Purpose |
|-------------|---------|
| **app/**    | Routes and top-level layouts (Expo Router). One route per major flow. |
| **screens/**| Optional; use for heavy screen logic shared across similar routes. |
| **components/** | Shared UI: common (buttons, cards), sensors (accelerometer graph, reaction/tracing UI), tasks (task list, session cards). |
| **services/**   | All I/O: **api/** for future ML backend, **sensors/** for device motion/reaction/tracing capture, **storage/** for local cache, **export/** for sending/exporting datasets. |
| **models/**     | TypeScript types/interfaces for accelerometer, reaction, tracing, and session payloads. Single source of truth for API and storage. |
| **hooks/**      | Encapsulate sensor subscription, API calls, and local state (e.g. `useAccelerometer`, `useReactionTask`, `useTracingTask`). |
| **utils/**      | Timestamps, number formatting, validation, data transformation. |
| **constants/**  | Route names, API base URL, task config (durations, thresholds). |
| **theme/**      | Design tokens so UI stays consistent and easy to change. |

---

## Data Flow (ML-ready)

1. **Capture** – Services in `services/sensors/` collect raw data; types from `models/`.
2. **Store** – `services/storage/` persists sessions locally (and optionally caches for offline).
3. **Export** – `services/export/` can package sessions (e.g. JSON/CSV) for upload or file share.
4. **API (future)** – `services/api/` will send payloads that match `models/` to your ML backend; keep request/response types in `models/` or next to the client.

Keeping **models/** as the single source of truth ensures the same shapes are used for storage, export, and the future ML API.

---

## Conventions

- **Barrel exports**: Use `index.ts` in each folder (e.g. `components/common/index.ts`) for clean imports: `import { Button } from '@/components/common'`.
- **Path alias**: Configure `@/` (or `@/src`) in `tsconfig.json` and `babel.config.js` to point at `src/`.
- **Naming**: `PascalCase` for components/screens, `camelCase` for hooks/utils/services, `kebab-case` for file names if you prefer (optional).
- **ML readiness**: All collected payloads should implement interfaces from `models/` so swapping from local export to API is a service-layer change only.

You can start by implementing screens and services under this structure, then add the ML API client under `services/api/` when the backend is ready.

# NeuroTrack

React Native (Expo) frontend for a mobile health app that collects **accelerometer**, **reaction time**, and **tracing task** data for ML processing.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Path alias**  
   `@/` is configured in `tsconfig.json` and `babel.config.js` to point at `src/`. Install `babel-plugin-module-resolver` (in devDependencies) so imports like `import { X } from '@/models'` resolve.

3. **Run**
   ```bash
   npx expo start
   ```

## Project structure

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the full folder layout, module roles, and data flow.

- **`app/`** – Expo Router screens (tabs, accelerometer, reaction, tracing, settings).
- **`src/models/`** – TypeScript types for accelerometer, reaction, tracing, and session (ML-ready).
- **`src/services/`** – API client (future ML), sensors, storage, export.
- **`src/components/`** – Common, sensors, tasks (barrel exports ready).
- **`src/hooks/`**, **`src/utils/`**, **`src/constants/`**, **`src/theme/`** – Hooks, helpers, config, design tokens.

## ML readiness

All collected data uses types from `src/models/`. Local storage and export use the same shapes; when you add an ML backend, `src/services/api/` can send these payloads with minimal changes.

---
name: toho_egs_development
description: Operational boundaries, allowed actions (DOs), and strictly prohibited actions (DONTs) for Toho EGS Flutter development.
---

# Toho EGS AI Development Skill & Operational Guardrails

This skill defines explicit rules for what the AI agent **MAY DO** (Boleh dilakukan) and **MUST NOT DO** (TIDAK boleh dilakukan) when modifying or creating code in the `toho_EGS` repository.

---

## 🟢 Allowed Actions (Boleh Dilakukan)

1. **MVVM Presenter Pattern**:
   - Create and isolate state logic inside Riverpod `Notifier<State>` presenter classes in `presenter/` directories.
   - Keep UI components (`Widget` classes) thin, delegating actions to presenters via `ref.read(...)`.

2. **UI & Design System**:
   - Style all UI elements using `AppTheme.of(context)` tokens (`pageBackground`, `surfaceColor`, `textOnSurface`, `appBarAccent`, etc.).
   - Standardize page headers using `GlobalAppBarActions()` in the AppBar `actions` array.
   - Apply the **Calibration Layout** (3:1 flex split, `360.00°` capped tilt display, dark parameter cards) when requested or constructing sensor/calibration screens.

3. **Feature Flagging**:
   - Add new feature toggles into `ConfigPresenter` (`lib/features/setup/presenter/config_presenter.dart`).
   - Listen reactively to `configProvider` in presenters (e.g. `MapPresenter`) to dynamically control feature behavior (such as `mock_data` stream).

4. **Code Quality & Maintenance**:
   - Replace deprecated Flutter APIs with modern standards (`.withValues(alpha: ...)` instead of `withOpacity`, `activeThumbColor` instead of `activeColor`).
   - Run `flutter analyze` and ensure zero errors and zero warnings before finishing a task.
   - Update `README.md` key features and changelog, and create Git commits with structured messages.

5. **Mandatory Documentation (`docs/`)**:
   - **ALWAYS** generate or update a markdown documentation file (`.md`) in `docs/` for every version bump, feature addition, or major bugfix analysis.
   - Include: Problem analysis & urgency (why mandatory), technical solution, data model scope, SOP user guide, and architecture/verification results.


---

## 🔴 Strictly Prohibited Actions (TIDAK Boleh Dilakukan)

1. **No Logic in UI**:
   - **DO NOT** write business logic, database transactions, raw timers, or complex calculations directly inside `StatefulWidget` or `ConsumerWidget` `build()` methods.

2. **No Raw StreamBuilder**:
   - **DO NOT** use classic Flutter `StreamBuilder` for fetching async list data from Isar or APIs. Wrap streams in Riverpod `StreamProvider` and use `.when(data: ..., loading: ..., error: ...)`.

3. **No Unsafe Provider Lifecycle Mutations**:
   - **DO NOT** modify another provider's state or trigger synchronous provider side-effects directly inside `onDispose()`. ALWAYS wrap disposal mutations in `Future.microtask(() => ...);`.

4. **No Hardcoded Ad-Hoc Styling**:
   - **DO NOT** hardcode static hex colors (e.g. `Color(0xFF123456)`) for general UI elements when `AppTheme.of(context)` theme tokens are available.

5. **No Placeholder Code**:
   - **DO NOT** leave placeholder comments (e.g. `// TODO: implement logic`) or return dummy null data when real feature logic is required.

6. **No Premature Completion Declaration**:
   - **DO NOT** declare a task completed without running `flutter analyze` to verify zero issues.

7. **Mode Isolation (Spot Mode vs Crumbling Mode)**:
   - **DO NOT** modify or touch Crumbling mode logic when discussing, analyzing, or fixing Spot mode, and vice versa.
   - **ALWAYS** ask for user clarification and confirmation first before making any cross-mode or shared architecture changes.

8. **No Incompatible ParentData in Non-Flex Layouts (Release Mode Defense)**:
   - **DO NOT** place `Spacer()`, `Expanded`, or `Flexible` directly inside `AlertDialog.actions`, `Stack`, `Wrap`, or `ListView`. `AlertDialog.actions` is laid out using `OverflowBar`, which rejects `FlexParentData`.
   - **ALWAYS** use `actionsAlignment: MainAxisAlignment.spaceBetween` in `AlertDialog` to align buttons, or wrap button groups in an explicit `Row(children: [...])`.
   - **CRITICAL**: On Flutter `--release` builds, unhandled layout/build exceptions cause Flutter to render a solid grey rectangle (`Color(0xFFA5A5A5)` - `ErrorWidget`), concealing error details.

---

## 📚 Technical Blueprint & Recreate References (SSOT)

Saat bertugas **membangun ulang (*recreate*) sistem baru**, memodifikasi rumus, atau mengaudit arsitektur Toho EGS, AI Agent **WAJIB** membaca dan merujuk pada katalog spesifikasi modular di folder `docs/technical_reference/`:

- [`docs/technical_reference/00_MASTER_INDEX.md`](../../../docs/technical_reference/00_MASTER_INDEX.md): Dokumen induk peta arsitektur dan standar implementasi.
- [`docs/technical_reference/01_HARDWARE_IO_AND_USB_PROTOCOL.md`](../../../docs/technical_reference/01_HARDWARE_IO_AND_USB_PROTOCOL.md): Serial USB CP2102N, Packet Framing, Algoritma CRC-16 CCITT, Matriks OpCode, dan Decoder Biner.
- [`docs/technical_reference/02_GEOSPATIAL_AND_COORDINATE_SYSTEMS.md`](../../../docs/technical_reference/02_GEOSPATIAL_AND_COORDINATE_SYSTEMS.md): Proyeksi Transverse Mercator WGS84 $\leftrightarrow$ UTM, Adaptive Grid DEM 3D, Simplifikasi Polyline RDP, dan Formula Geodesik.
- [`docs/technical_reference/03_EXCAVATOR_KINEMATICS_AND_CALIBRATION.md`](../../../docs/technical_reference/03_EXCAVATOR_KINEMATICS_AND_CALIBRATION.md): Forward Kinematics 3D Boom-Stick-Bucket, Pitch & Roll Tilt Correction, Matriks Kalibrasi Mode & Parameter, Capping Rule 360.00°.
- [`docs/technical_reference/04_WORK_MODES_AND_WORKSPEED_CALCULATION.md`](../../../docs/technical_reference/04_WORK_MODES_AND_WORKSPEED_CALCULATION.md): Isolasi Mode Spot (Targeting & 2-stage done) vs Crumbling (Trench sweep & 4-quadrant QC), dan Rumus Kecepatan Kerja (Workspeed).
- [`docs/technical_reference/05_DATA_MODELS_ISAR_AND_STATE_MANAGEMENT.md`](../../../docs/technical_reference/05_DATA_MODELS_ISAR_AND_STATE_MANAGEMENT.md): Skema 18 Model Isar DB, Hierarki Riverpod Notifier, dan Protokol Sinkronisasi Biner Offline.
- [`docs/technical_reference/06_TIMESHEET_DIAGNOSTICS_AND_ALERTS.md`](../../../docs/technical_reference/06_TIMESHEET_DIAGNOSTICS_AND_ALERTS.md): Shift Timesheet, 1-Minute Error Accumulator, Diagnostik Stream CRC, dan Audio TTS/Alarms.


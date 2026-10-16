---
trigger: always_on
description: Mandatory architecture, layout, design, and coding rules for toho_EGS project
---

# Toho EGS Project Rules & Standards

These rules govern all code modifications, architecture design, and UI implementations within the `toho_EGS` project.

---

## 1. Calibration Layout Rule

When requested to use or create a **Calibration Layout**, apply the following structural grid and styling:

### Grid Structure
- Single `Padding(padding: EdgeInsets.all(16.0))` wrapping a `Row`.
- **Horizontal 3:1 Divide**: Split using `Expanded(flex: ...)`
  - **Left Column**: `Expanded(flex: 3)`
  - **Right Column**: `Expanded(flex: 1)`

### Left Column Details
- Container: Use `Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [...])` for full width.
- **Top Image Region**: `Expanded(flex: 3)`
  - Decoration: `Color(0xFF1E293B)`, `BorderRadius.circular(16)`, `Border.all(color: Color(0xFF1E3A2A))`
  - Purpose: Displays reference graphics/3D asset with `BoxFit.contain`.
- Spacer: `SizedBox(height: 16)`
- **Bottom Control Region**: `Expanded(flex: 1)`
  - Decoration: Same as Top
  - Content: `Row` (`mainAxisAlignment: MainAxisAlignment.spaceEvenly`) housing action controls.
  - Divider: Separate distinct control groups with `Container(width: 1, height: double.infinity, color: Colors.white24)`.

### Right Column Details (Parameter Stack)
- Decoration: Same dark card styling as Left Column.
- Header: Centered text `"PARAMETERS"` (`Color(0xFFFFFFFF)`, `FontWeight.bold`, `letterSpacing: 1.2`, `fontSize: 16`).
- Divider: `Divider(color: Color(0xFF1E3A2A))`.
- Body: `Expanded(child: ListView(children: [...]))` with Parameter Cards.

### Parameter Card Aesthetic
```dart
Card(
  color: const Color(0xFF1E293B),
  margin: const EdgeInsets.symmetric(vertical: 6.0),
  child: InkWell(
    onTap: () { /* Open parameter dialog */ },
    borderRadius: BorderRadius.circular(12),
    child: Padding(
      padding: const EdgeInsets.all(12.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(abbreviation, style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 16)),
              Text(title, style: const TextStyle(color: Colors.white54, fontSize: 12)),
            ],
          ),
          Text(
            value.toString(),
            style: const TextStyle(color: Color(0xFF2ECC71), fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    ),
  ),
)
```

### Tilt & Angle Values Capping Constraint
- **Angle Capping**: ANY value representing an Angle or Tilt (Pitch, Roll, Boom/Stick/Bucket Tilt) MUST be visually capped at a maximum of `360.00`. If raw value > 360, display `360.00` (or modulo `% 360` if intended).
- **Degree Formatting**: ALWAYS append the degree symbol `°` to displayed angle values.
  - Example: `(rawValue > 360 ? 360.0 : rawValue).toStringAsFixed(2) + '°'`

### Parameter Modal Dialog (`_showSetParamDialog`)
- Background: `AlertDialog` with `backgroundColor: const Color(0xFF1E293B)`.
- Input Field: `TextField` filled with `Color(0xFF0F1410)`, text color white, border `OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none)`.
- Buttons: Cancel (`Colors.white54`), Set (`Color(0xFF2ECC71)` with white text).

---

## 2. Core Architecture Rules (MVVM & Riverpod)

1. **Presenter Pattern**: Every page or major feature MUST isolate state and business logic inside a `Presenter` class extending Riverpod's `Notifier<State>` or `StateNotifier<State>`.
2. **Thin UI Widgets**: UI `Widget` classes (pages, tabs, dialogs) MUST remain pure UI containers (`ConsumerWidget` / `ConsumerStatefulWidget`). Never write inline database queries, complex state calculations, or raw timers in widget states.
3. **Stream Management**: Avoid `StreamBuilder` for fetching async list data from Isar or APIs. Wrap streams inside Riverpod `StreamProvider` and handle states using `.when(data: ..., loading: ..., error: ...)`.
4. **Scaffold & AppBar Standard**: Standard page `AppBar` must include:
   - Descriptive title on the left with optional icon box container (`theme.iconBoxBackground`).
   - `GlobalAppBarActions()` in the `actions` array on the right for USB connection status and user ProfileWidget.
5. **App Theme Integration**: ALWAYS style UI components using `AppTheme.of(context)` tokens (`pageBackground`, `surfaceColor`, `textOnSurface`, `textSecondary`, `appBarAccent`, etc.).

---

## 3. Feature Flags & Config Management

1. **Centralized Configuration**: All system feature flags (e.g. `mock_data`, `chat`, `voice_alerts`, `auto_sync`) must be registered in `ConfigPresenter` (`lib/features/setup/presenter/config_presenter.dart`).
2. **Dynamic Service Integration**: Presenters and services (such as `MapPresenter`) must listen to or read `configProvider` to dynamically enable/disable runtime mock data streams, auto sync, or audio alerts.

---

## 4. Safety & Code Integrity Rules

1. **Riverpod Lifecycle Side-Effects**: NEVER mutate state of another provider or invoke synchronous mutations inside `onDispose()`. Wrap any teardown state mutations in `Future.microtask(() => ...);`.
2. **Deprecation Standards**:
   - Use `.withValues(alpha: ...)` instead of deprecated `.withOpacity(...)`.
   - Use `activeThumbColor` / `activeTrackColor` instead of deprecated `activeColor` in `Switch`.
3. **Import Preservation**: Do NOT remove essential Flutter or project imports during refactoring.
4. **Zero Analyzer Issues**: Code must pass `flutter analyze` cleanly without errors or warnings before declaring task completion.

---

## 5. Mode Isolation Rule (Spot Mode vs Crumbling Mode)

1. **Strict Context Isolation**:
   - Ketika sedang membahas, menganalisis, atau melakukan perbaikan/fitur pada **Mode SPOT**, **DILARANG KERAS** melakukan modifikasi atau menyentuh logika pada **Mode CRUMBLING**, begitu juga sebaliknya.
2. **Mandatory Prior Confirmation for Cross-Mode Changes**:
   - Jika terdapat perubahan mendasar pada logika bersama (*shared architecture/core services*) yang berdampak pada kedua mode sekaligus, **WAJIB** menjelaskan alasannya dan meminta konfirmasi/persetujuan dari pengguna (*user confirmation*) terlebih dahulu sebelum melakukan perubahan kode.

---

## 6. Mandatory Version Update Documentation Rule (Docs Generation)

1. **Wajib Membuat Dokumen Setiap Update Versi / Fitur / Perbaikan Bug**:
   - Setiap kali melakukan update versi aplikasi, penambahan fitur baru, perombakan modul, atau perbaikan bug (*bugfix*), **WAJIB** membuat atau memperbarui file dokumentasi dalam format **Markdown (`.md`)** dan menyimpannya di dalam folder **`docs/`** (contoh: `docs/<NAMA_FITUR_ATAU_PERBAIKAN>_MANUAL.md` atau `docs/<NAMA_FITUR>_BLUEPRINT.md`).
2. **Struktur Wajib Dokumen di `docs/`**:
   - **Latar Belakang & Analisa Urgensi**: Penjelasan mendalam kenapa perubahan ini wajib/penting (*mandatory*), masalah operasional apa yang diselesaikan, dan dampaknya pada sistem.
   - **Solusi Teknis & Cakupan Data**: Penjelasan arsitektur, parameter, model/entitas data yang terlibat, rumus/protokol yang digunakan.
   - **Panduan Operasional & SOP Penggunaan**: Langkah demi langkah cara menggunakan fitur bagi operator, teknisi, atau developer.
   - **Arsitektur & Integritas Kode**: Penjelasan file yang dimodifikasi, presenter yang terlibat, dan hasil verifikasi (*flutter analyze* dan *unit tests*).
3. **Sinkronisasi README.md**:
   - Tautkan link file dokumen dari `docs/` ke dalam entri `## Changelog` di [README.md](../../README.md).

---

## 7. UI Widget Tree Integrity & ParentData Rules (Release Mode Defense)

1. **Strict ParentData Scope (`Spacer`, `Expanded`, `Flexible`)**:
   - Widget `Spacer`, `Expanded`, dan `Flexible` **HANYA BOLEH** menjadi anak langsung (*direct child*) dari widget keluarga `Flex` (`Row`, `Column`, atau `Flex`).
   - **DILARANG KERAS** meletakkan `Spacer()`, `Expanded`, atau `Flexible` langsung di dalam:
     - Properti `actions` pada `AlertDialog` (karena secara internal `AlertDialog.actions` dibungkus menggunakan `OverflowBar`, bukan `Flex`).
     - `Stack`, `Wrap`, `ListView`, atau container non-Flex lainnya.
2. **Pencegahan Layar Kotak Abu-Abu (*Grey Box*) pada Mode Release**:
   - Pada Flutter mode `--release`, unhandled layout/build exception (seperti `Incorrect use of ParentDataWidget: Expanded wants to apply FlexParentData to _OverflowBarParentData`) **tidak** memunculkan layar merah atau stack trace, melainkan secara senyap merender `ErrorWidget` bawaan berupa **kotak abu-abu polos (`Color(0xFFA5A5A5)`)**.
   - Setiap kali merancang dialog atau layout, pastikan pohon widget mematuhi kontrak parent data agar tidak merusak tampilan pada build release APK.
3. **Standar Alignment Tombol `AlertDialog`**:
   - Untuk memisahkan tombol aksi (misalnya tombol aksi di kiri dan tombol konfirmasi di kanan), **WAJIB** menggunakan properti native:
     ```dart
     AlertDialog(
       actionsAlignment: MainAxisAlignment.spaceBetween,
       actions: [
         TextButton(...), // Tombol kiri (misal: Leaderboard / Cancel)
         ElevatedButton(...), // Tombol kanan (misal: Done / OK)
       ],
     )
     ```
   - Jika membutuhkan layout kustom yang sangat fleksibel di dalam `actions`, bungkus seluruh baris tombol secara eksplisit di dalam satu widget `Row(children: [...])`.

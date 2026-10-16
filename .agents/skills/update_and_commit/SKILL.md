---
name: update_and_commit
description: Shortcut workflow to automate updating pubspec.yaml version, updating README.md header & changelog, running verification (analyze & test), and performing git commit without push.
---

# Update & Commit Workflow (Shortcut)

Use this skill whenever the user asks for `"update and commit"`, `"release commit"`, `"update readme pubspec commit"`, or mentions the shortcut for versioning and committing.

---

## 🚀 Trigger Keywords & Shortcuts
- `update and commit` / `update & commit`
- `release commit` / `commit release`
- `release apk` / `build release apk` / `release build`
- `update readme dan pubspec lalu commit`
- `shortcut commit`

---

## 📋 Step-by-Step Execution Sequence

### Step 1: Version Bumping
1. Read current version in `pubspec.yaml` (e.g. `version: 4.1.2+50`).
2. Increment patch version and build number (e.g. `4.1.3+51`).
3. Update `lib/core/utils/app_constants.dart` (`appVersion` & `buildNumber`) to match.

### Step 2: README.md Synchronization
1. Update top header badge & status note in `README.md` to reflect the new version and release status.
2. In the `## Changelog` section:
   - Add `### v<NewVersion> (Current)` at the very top of the changelog list (right below `## Changelog`).
   - Add concise bullet points detailing all implemented features, bugfixes, or refactoring done in the session.
   - Demote the previous version header from `(Current)` to standard header.
   - Link the documentation created in `docs/`.

### Step 2.5: Mandatory Documentation Generation (`docs/`)
1. Create or update a comprehensive documentation file in `.md` (Markdown) inside the `docs/` folder (e.g. `docs/<FEATURE_OR_BUGFIX_NAME>_MANUAL.md` or `docs/<TOPIC>_BLUEPRINT.md`).
2. The documentation MUST include:
   - **Latar Belakang & Analisa Urgensi**: Mengapa fitur/perbaikan ini mandatory, masalah nyata apa yang diselesaikan.
   - **Solusi Teknis & Cakupan Data**: Arsitektur, parameter, protokol, dan model data yang terlibat.
   - **Panduan Penggunaan (SOP)**: Petunjuk langkah-demi-langkah penggunaan fitur bagi operator/teknisi.
   - **Arsitektur & Integritas Kode**: Rincian file yang dimodifikasi dan hasil verifikasi pengujian.

### Step 3: Quality Verification
1. Run `flutter analyze` to ensure **0 issues found**.
2. Run `flutter test` to ensure **100% test pass rate**.

### Step 4: Local Git Commit (No Push)
1. Check changed files with `git status`.
2. Stage modified files: `git add .` (or specific files).
3. Commit with structured commit message:
   ```bash
   git commit -m "<type>: <concise summary> (v<Version>+<Build>)" -m "- <detail point 1>" -m "- <detail point 2>"
   ```
4. **CRITICAL**: Do **NOT** run `git push`.

### Step 5: Release APK Build (When Requested / Release Trigger)
When building the production release APK for tablet deployment:
```bash
flutter build apk --split-per-abi --no-shrink
```
Generated APKs location: `build/app/outputs/flutter-apk/app-<abi>-release.apk` (e.g. `app-arm64-v8a-release.apk`, `app-armeabi-v7a-release.apk`).


# Update Version, README & Commit Workflow (Shortcut)

This workflow defines the standard shortcut procedure to bump versions, update documentation, verify code quality, and commit locally without pushing.

---

## 🚀 Shortcut Triggers
Whenever the user mentions:
- `update and commit`
- `release commit`
- `release apk` / `build release apk` / `release build`
- `update readme pubspec commit`
- `shortcut commit`

---

## 🔄 Execution Steps

1. **Version Update**:
   - Bump version in `pubspec.yaml` (e.g., `4.1.2+50`).
   - Sync `lib/core/utils/app_constants.dart` (`AppConstants.appVersion` and `AppConstants.buildNumber`).

2. **README Documentation**:
   - Update header status note and version badge in `README.md`.
   - Add new entry under `### vX.Y.Z (Current)` in `README.md` Changelog detailing the changes.

3. **Quality Check**:
   - Execute `flutter analyze` (Zero issues required).
   - Execute `flutter test` (All tests must pass).

4. **Git Commit (No Push)**:
   - Stage modified files (`git add .`).
   - Run structured commit:
     ```bash
     git commit -m "<type>: <description> (vX.Y.Z+B)" -m "- <detail 1>" -m "- <detail 2>"
     ```
   - Do **NOT** push to remote.

5. **Release APK Build (When Requested / Release Trigger)**:
   - Build production split APK without code shrinking:
     ```bash
     flutter build apk --split-per-abi --no-shrink
     ```
   - Target APK outputs: `build/app/outputs/flutter-apk/app-<abi>-release.apk`.


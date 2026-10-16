# Toho EGS Standard Development Workflow

This workflow documents the mandatory step-by-step lifecycle for planning, implementing, verifying, and documenting features in the **Toho EGS** Flutter codebase.

---

## Workflow Steps Overview

```
┌─────────────────────────────────────────────────────────┐
│ Phase 1: Context Verification & Planning                │
│ Check context7, inspect codebase, draft implementation  │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│ Phase 2: Presenter & State Layer Implementation (MVVM) │
│ Create Notifier<State>, define model, wire config flags │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│ Phase 3: UI Widget Construction                         │
│ ConsumerWidget, AppTheme tokens, GlobalAppBarActions    │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│ Phase 4: Integration & Service Wiring                   │
│ Connect presenters to ComService/Isar/ConfigProvider    │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│ Phase 5: Static Analysis & Quality Verification         │
│ Run `flutter analyze`, replace deprecated APIs, test    │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│ Phase 6: Documentation & Git Version Control            │
│ Update README.md changelog, walkthrough, git commit     │
└─────────────────────────────────────────────────────────┘
```

---

## Detailed Phase Execution

### Phase 1: Context Verification & Planning
1. **Context Check**: Always query `context7` MCP server to ensure latest context and documentation access.
2. **Codebase Inspection**: Use `view_file` and `grep_search` to inspect existing patterns before writing new logic.
3. **Planning & Feedback**: For complex feature additions, create an `implementation_plan.md` artifact to present the design for user review.

---

### Phase 2: Presenter & State Layer Implementation (MVVM)
1. **State Definition**: Create an immutable State class with `copyWith()` method.
2. **Presenter Class**: Implement Riverpod `Notifier<State>` (or `StateNotifier<State>`).
3. **Feature Toggles**: If adding a feature toggle, register the item in `ConfigPresenter` (`lib/features/setup/presenter/config_presenter.dart`).
4. **Provider Exposing**: Expose state via `NotifierProvider`.

---

### Phase 3: UI Widget Construction
1. **ConsumerWidget**: Keep UI widgets as thin declarative containers.
2. **App Theme Styling**: Apply `AppTheme.of(context)` tokens for all background, card, text, and border colors.
3. **AppBar Standard**: Integrate `GlobalAppBarActions()` in the AppBar `actions` parameter.
4. **Special Layouts**: Apply Calibration Layout (3:1 flex divide, parameter cards, `360.00°` tilt capping constraint) whenever calibration or sensor input screens are built.

---

### Phase 4: Integration & Service Wiring
1. **Reactive Listening**: Use `ref.listen(configProvider)` inside presenters to respond to feature flag changes (e.g. enabling/disabling `mock_data` stream dynamically in `MapPresenter`).
2. **Stream Management**: Consume asynchronous streams using Riverpod `StreamProvider` + `.when(...)` UI syntax.
3. **Lifecycle Safety**: Wrap teardown logic in `onDispose()` with `Future.microtask(() => ...);` to avoid modifying providers during state disposal.

---

### Phase 5: Static Analysis & Quality Verification
1. **Run Analyzer**: Execute `flutter analyze` across affected feature directories.
2. **Zero Deprecation Policy**:
   - Replace `.withOpacity(x)` with `.withValues(alpha: x)`.
   - Replace `activeColor` with `activeThumbColor`.
3. **Build Runner Compatibility**: If modifying Isar models, execute `dart run build_runner build --delete-conflicting-outputs`.

---

### Phase 6: Documentation & Git Version Control
1. **README Update**: Add new features to `README.md` under **Key Features** and record changes under **Changelog**.
2. **Walkthrough Artifact**: Generate or update `walkthrough.md` summarizing files modified and verification results.
3. **Git Commit**: Execute structured commit using conventional commit format:
   ```bash
   git commit -m "feat: <feature summary>" -m "- <detail 1>" -m "- <detail 2>"
   ```

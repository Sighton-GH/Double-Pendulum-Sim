# Copilot Instructions

## Big picture
- This repo has **two parallel implementations** of the same simulator:
	- **Desktop (pygame)**: `main.py` (single-file app)
	- **Web (Canvas + vanilla JS)**: `index.html` + `app.js` + `style.css` (no bundler)
- Both versions intentionally mirror: RK4 integrator, parameter controls, hotkeys, “drag when paused”, trail + rewind, and energy drift HUD.
- Web version also includes **graph tabs + recording/export** (Angles/Velocities/Phase plots + CSV download).

## Run / dev workflow
- Desktop: `pip install -r requirements.txt` then `python main.py`.
- Web: `python -m http.server 8123 --bind 0.0.0.0` then open `/index.html`.
- Windows convenience: `./run_web.ps1` (auto-picks a free port, prints local + Tailscale URL). Use `./run_web.ps1 -OpenFirewall` if needed.
- No test suite/build pipeline in this repo; keep changes runnable from repo root.

## Physics + integration invariants (keep in sync across Python + JS)
- `DoublePendulum` state is `(theta1, theta2, omega1, omega2)`; accelerations come from `_derivatives(...)` with **linear viscous damping** (`domega -= damping * omega`).
- Time scaling is handled by **sub-stepping** with `maxDt = 0.002` inside the main loop (Python: `Simulator.run`; Web: `Simulator._frame`).
- Energy drift display uses an “initial energy” reference (Python: `_initial_energy`, Web: `initialEnergy`): reset it whenever parameters change or dragging edits state.

## UI + interaction patterns
- Layout: render area + right panel; panel auto-collapses when width `< panelWidth + 520` (Python: `_auto_collapse`; Web: `_autoCollapse`). Origin is near top-center; scaling is based on `L1 + L2` (`_compute_scale` / `_computeScale`).
- Trail timeline supports rewind/step-back:
	- Python: `trail_history` + `trail_index` + `_step_frame(direction)` + `_advance_trail_forward()`.
	- Web: `trailHistory` + `trailIndex` + `_stepFrame(direction)` + `_advanceTrailForward()`.
	Preserve the “rewindInProgress” guard that prevents trail shrinkage while paused.
- Dragging masses is only allowed while paused:
	- End mass uses simple IK (`_apply_drag_end` / `_applyDragEnd`) with reachability clamping; mid mass keeps elbow angle (`_apply_drag_mid` / `_applyDragMid`).
	- Dragging zeroes omegas and clears trail + energy reference; Web also resets graph history on drag (`_resetGraphHistory()`).

## Controls + conventions
- Hotkeys are documented in `README.md` and mirrored in both apps (space/r/n/t/c/e/d/s and +/- for gravity).
- Python sliders support **direct text entry** (see `active_input_slider`, `input_buffer`, `input_cursor`); after any slider commit call `_sync_from_sliders()`.
- Web controls are paired range+number inputs; changes flow through `_syncModelFromControls()` and `_syncControlsFromModel()`.
- Web view switching uses `Simulator._setView(tab)` and toggles `#app` `data-view` between `sim` vs `graphs` (CSS hides the panel in graph mode).
- Web graph sampling is append-only while playing: `_recordGraphSample()` runs from `_frame()` whenever `!paused` (independent of CSV recording).
- Web recording/export is separate: `_recordExportSample()` runs only when `recordingEnabled && !paused`; the record toggle resets export samples via `_resetExportHistory()`; stopping recording reveals the download button; export is driven by `_exportGraphData()`.
- Web theming: uses CSS variables in `style.css` and persists choice in `localStorage` key `dp_theme`.

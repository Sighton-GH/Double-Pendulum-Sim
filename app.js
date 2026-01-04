(() => {
  "use strict";

  class DoublePendulum {
    constructor({ m1 = 1.0, m2 = 1.0, L1 = 1.0, L2 = 1.0, g = 9.81, damping = 0.0 } = {}) {
      this.m1 = m1;
      this.m2 = m2;
      this.L1 = L1;
      this.L2 = L2;
      this.g = g;
      this.damping = damping;

      this.theta1 = Math.PI / 2;
      this.theta2 = Math.PI / 2;
      this.omega1 = 0.0;
      this.omega2 = 0.0;

      this.initialEnergy = null;
    }

    reset({ theta1 = Math.PI / 2, theta2 = Math.PI / 2 } = {}) {
      this.theta1 = theta1;
      this.theta2 = theta2;
      this.omega1 = 0.0;
      this.omega2 = 0.0;
      this.initialEnergy = this.energy();
    }

    _derivatives(theta1, theta2, omega1, omega2) {
      const { m1, m2, L1, L2, g } = this;
      const delta = theta2 - theta1;

      const den1 = (m1 + m2) * L1 - m2 * L1 * Math.pow(Math.cos(delta), 2);
      const den2 = (L2 / L1) * den1;

      let domega1 =
        (m2 * L1 * omega1 * omega1 * Math.sin(delta) * Math.cos(delta) +
          m2 * g * Math.sin(theta2) * Math.cos(delta) +
          m2 * L2 * omega2 * omega2 * Math.sin(delta) -
          (m1 + m2) * g * Math.sin(theta1)) /
        den1;

      let domega2 =
        (-m2 * L2 * omega2 * omega2 * Math.sin(delta) * Math.cos(delta) +
          (m1 + m2) *
            (g * Math.sin(theta1) * Math.cos(delta) -
              L1 * omega1 * omega1 * Math.sin(delta) -
              g * Math.sin(theta2))) /
        den2;

      domega1 -= this.damping * omega1;
      domega2 -= this.damping * omega2;

      return [omega1, omega2, domega1, domega2];
    }

    step(dt) {
      const th1 = this.theta1;
      const th2 = this.theta2;
      const w1 = this.omega1;
      const w2 = this.omega2;

      const k1 = this._derivatives(th1, th2, w1, w2);
      const k2 = this._derivatives(
        th1 + 0.5 * dt * k1[0],
        th2 + 0.5 * dt * k1[1],
        w1 + 0.5 * dt * k1[2],
        w2 + 0.5 * dt * k1[3]
      );
      const k3 = this._derivatives(
        th1 + 0.5 * dt * k2[0],
        th2 + 0.5 * dt * k2[1],
        w1 + 0.5 * dt * k2[2],
        w2 + 0.5 * dt * k2[3]
      );
      const k4 = this._derivatives(
        th1 + dt * k3[0],
        th2 + dt * k3[1],
        w1 + dt * k3[2],
        w2 + dt * k3[3]
      );

      this.theta1 += (dt / 6.0) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      this.theta2 += (dt / 6.0) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      this.omega1 += (dt / 6.0) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
      this.omega2 += (dt / 6.0) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
    }

    positions() {
      const x1 = this.L1 * Math.sin(this.theta1);
      const y1 = this.L1 * Math.cos(this.theta1);
      const x2 = x1 + this.L2 * Math.sin(this.theta2);
      const y2 = y1 + this.L2 * Math.cos(this.theta2);
      return { x1, y1, x2, y2 };
    }

    energy() {
      const { m1, m2, L1, L2, g } = this;
      const { y1, y2 } = this.positions();

      const v1_sq = Math.pow(L1 * this.omega1, 2);
      const v2_sq =
        v1_sq +
        Math.pow(L2 * this.omega2, 2) +
        2 * L1 * L2 * this.omega1 * this.omega2 * Math.cos(this.theta1 - this.theta2);

      const T = 0.5 * m1 * v1_sq + 0.5 * m2 * v2_sq;
      const V = -g * (m1 * y1 + m2 * y2);
      return T + V;
    }
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  class Simulator {
    constructor() {
      this.panelWidth = 340;
      this.panelCollapsed = false;

      this.app = document.getElementById("app");
      this.render = document.getElementById("render");
      this._activeTab = "sim";

      this.content = document.getElementById("content");
      this.canvas = document.getElementById("canvas");
      this.ctx = this.canvas.getContext("2d");

      this.plot = document.getElementById("plot");
      this.plotCanvas = document.getElementById("plotCanvas");
      this.plotCtx = this.plotCanvas.getContext("2d");

      this.btnRecord = document.getElementById("btnRecord");
      this.recordLabel = document.getElementById("recordLabel");
      this.btnDownload = document.getElementById("btnDownload");

      this.graphStepBack = document.getElementById("graphStepBack");
      this.graphPlay = document.getElementById("graphPlay");
      this.graphPlayLabel = document.getElementById("graphPlayLabel");
      this.graphStepForward = document.getElementById("graphStepForward");

      this.tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
      this.panel = document.getElementById("panel");
      this.panelToggle = document.getElementById("panelToggle");
      this.panelToggleIcon = document.getElementById("panelToggleIcon");

      this.themeToggle = document.getElementById("themeToggle");
      this.themeToggleLabel = document.getElementById("themeToggleLabel");

      this.btnStepBack = document.getElementById("btnStepBack");
      this.btnStart = document.getElementById("btnStart");
      this.startLabel = document.getElementById("startLabel");
      this.btnStepForward = document.getElementById("btnStepForward");
      this.btnReset = document.getElementById("btnReset");
      this.btnRandom = document.getElementById("btnRandom");
      this.btnAbout = document.getElementById("btnAbout");

      this.optionsEl = document.querySelector(".options");
      this.btnToggleOptions = document.getElementById("btnToggleOptions");
      this.optionsToggleIcon = document.getElementById("optionsToggleIcon");

      this.about = document.getElementById("about");
      this.btnCloseAbout = document.getElementById("btnCloseAbout");

      this.controls = this._wireControls();

      this.pendulum = new DoublePendulum({ L1: 1.0, L2: 1.0, m1: 1.0, m2: 1.0, damping: 0.01, g: 9.81 });
      this.pendulum.reset();

      this.defaults = { L1: 1.0, L2: 1.0, m1: 1.0, m2: 1.0, g: 9.81, damping: 0.01, timeScale: 1.0 };

      this.paused = true;
      this.showTrail = true;
      this.showEnergy = true;
      this.showArrows = false;
      this.showArrowMagnitudes = false;
      this.showAngleLabels = false;
      this.showAngleRadians = false;
      this.slowMotion = false;
      this._savedTimeScaleBeforeSlow = null;
      this.timeScale = 1.0;
      this.simTime = 0.0;
      this.defaultDamping = this.pendulum.damping;

      this.trailHistory = [];
      this.trailIndex = 0;
      this.lastTrailIndex = 0;
      this.rewindInProgress = false;

      this.draggingEnd = false;
      this.draggingMid = false;

      this.origin = { x: 0, y: 0 };
      this.scale = 1.0;

      this.graphHistory = [];
      this._lastGraphSampleTime = null;
      this.exportHistory = [];
      this._lastExportSampleTime = null;
      this._graphMaxPoints = 12000;
      this._graphWindowSec = 12.0;
      this._graphWindowSecPhase = 36.0;
      this._graphLockedRanges = {
        angles: null,
        velocities: null,
        phase: null,
      };

      this._syncControlsFromModel();
      this._initTheme();
      if (this.app) this.app.dataset.view = "sim";
      this._autoCollapse();
      this._resizeCanvas();
      this._resizePlotCanvas();
      this._resetTrailWithCurrent();

      this._resetAllHistory();

      // Graphs always populate while playing; recording only controls CSV export capture.
      this.recordingEnabled = false;
      this._updateRecordingUi();

      this._wireOptionToggles();
      this._syncOptionTogglesFromState();

      this._wireEvents();

      this._lastTimestamp = null;
      requestAnimationFrame((ts) => this._frame(ts));
    }

    _wireControls() {
      const bindPair = (rangeId, numberId) => {
        const rng = document.getElementById(rangeId);
        const num = document.getElementById(numberId);
        return { rng, num };
      };

      return {
        L1: bindPair("rngL1", "numL1"),
        L2: bindPair("rngL2", "numL2"),
        m1: bindPair("rngM1", "numM1"),
        m2: bindPair("rngM2", "numM2"),
        g: bindPair("rngG", "numG"),
        damping: bindPair("rngD", "numD"),
        timeScale: bindPair("rngT", "numT"),
      };
    }

    _syncModelFromControls() {
      const prevL1 = this.pendulum.L1;
      const prevL2 = this.pendulum.L2;

      this.pendulum.L1 = parseFloat(this.controls.L1.num.value);
      this.pendulum.L2 = parseFloat(this.controls.L2.num.value);
      this.pendulum.m1 = parseFloat(this.controls.m1.num.value);
      this.pendulum.m2 = parseFloat(this.controls.m2.num.value);
      this.pendulum.g = parseFloat(this.controls.g.num.value);
      this.pendulum.damping = parseFloat(this.controls.damping.num.value);
      const nextTimeScale = parseFloat(this.controls.timeScale.num.value);
      if (this.slowMotion && nextTimeScale !== 0.5) {
        this.slowMotion = false;
        this._savedTimeScaleBeforeSlow = null;
      }
      this.timeScale = nextTimeScale;

      this.defaultDamping = this.pendulum.damping;
      this.scale = this._computeScale();

      this.pendulum.initialEnergy = this.pendulum.energy();

      this._resetAllHistory();

      if (this.pendulum.L1 !== prevL1 || this.pendulum.L2 !== prevL2) {
        this._resetTrailWithCurrent();
      }

      this._syncOptionTogglesFromState();
    }

    _syncControlsFromModel() {
      const setPair = (pair, val) => {
        pair.rng.value = String(val);
        pair.num.value = String(val);
      };

      setPair(this.controls.L1, this.pendulum.L1);
      setPair(this.controls.L2, this.pendulum.L2);
      setPair(this.controls.m1, this.pendulum.m1);
      setPair(this.controls.m2, this.pendulum.m2);
      setPair(this.controls.g, this.pendulum.g);
      setPair(this.controls.damping, this.pendulum.damping);
      setPair(this.controls.timeScale, this.timeScale);
    }

    _wireEvents() {
      this.tabButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const tab = btn.dataset.tab || "sim";
          this._setView(tab);
        });
      });

      this.btnRecord?.addEventListener("click", () => {
        // Toggle CSV recording. Starting a new recording session clears previous export samples.
        this.recordingEnabled = !this.recordingEnabled;
        if (this.recordingEnabled) this._resetExportHistory();
        this._updateRecordingUi();
      });

      this.btnDownload?.addEventListener("click", () => this._exportGraphData());

      this.graphStepBack?.addEventListener("click", () => this._stepFrame(-1));
      this.graphStepForward?.addEventListener("click", () => this._stepFrame(1));
      this.graphPlay?.addEventListener("click", () => (this.paused = !this.paused));

      const wirePair = (pair) => {
        const onChange = () => {
          const min = parseFloat(pair.num.min);
          const max = parseFloat(pair.num.max);
          const step = parseFloat(pair.num.step || "0");
          let v = parseFloat(pair.num.value);
          if (!Number.isFinite(v)) v = min;
          v = clamp(v, min, max);
          if (step > 0) {
            const steps = Math.round((v - min) / step);
            v = min + steps * step;
          }
          pair.num.value = String(v);
          pair.rng.value = String(v);
          this._syncModelFromControls();
        };

        pair.rng.addEventListener("input", () => {
          pair.num.value = pair.rng.value;
          onChange();
        });

        pair.num.addEventListener("input", onChange);
        pair.num.addEventListener("change", onChange);
      };

      Object.values(this.controls).forEach(wirePair);

      this.btnStart.addEventListener("click", () => (this.paused = !this.paused));
      this.btnStepBack.addEventListener("click", () => this._stepFrame(-1));
      this.btnStepForward.addEventListener("click", () => this._stepFrame(1));
      this.btnReset.addEventListener("click", () => this._resetToDefaults());
      this.btnRandom.addEventListener("click", () => this._randomizeParametersOnly());
      this.btnAbout.addEventListener("click", () => this._setAboutVisible(true));
      this.btnCloseAbout.addEventListener("click", () => this._setAboutVisible(false));
      this.about.addEventListener("mousedown", (e) => {
        if (e.target === this.about) this._setAboutVisible(false);
      });

      this.panelToggle.addEventListener("click", () => this._togglePanel());

      this.btnToggleOptions.addEventListener("click", () => this._toggleOptionsMenu());

      this.themeToggle.addEventListener("click", () => this._toggleTheme());

      window.addEventListener("resize", () => {
        this._autoCollapse();
        this._resizeCanvas();
        this._resizePlotCanvas();
      });

      window.addEventListener("keydown", (e) => this._handleKey(e));

      this.canvas.addEventListener("mousedown", (e) => this._onMouseDown(e));
      window.addEventListener("mousemove", (e) => this._onMouseMove(e));
      window.addEventListener("mouseup", () => this._onMouseUp());
    }

    _setView(tab) {
      const next = tab === "angles" || tab === "velocities" || tab === "phase" ? tab : "sim";
      if (next === this._activeTab) return;

      this._activeTab = next;
      if (this.app) this.app.dataset.view = next === "sim" ? "sim" : "graphs";

      this.tabButtons.forEach((btn) => {
        const isActive = (btn.dataset.tab || "sim") === next;
        btn.classList.toggle("active", isActive);
        if (isActive) btn.setAttribute("aria-current", "page");
        else btn.removeAttribute("aria-current");
      });

      if (next !== "sim") {
        // Graph tabs have no panel controls, but the simulation state should still reflect
        // whether the user is currently playing or paused.
        this._setAboutVisible(false);
      }

      this._autoCollapse();
      this._resizeCanvas();
      this._resizePlotCanvas();
      this.scale = this._computeScale();
    }

    _resetGraphHistory() {
      this.graphHistory = [];
      this._lastGraphSampleTime = null;
      this._graphLockedRanges.angles = null;
      this._graphLockedRanges.velocities = null;
      this._graphLockedRanges.phase = null;
    }

    _resetExportHistory() {
      this.exportHistory = [];
      this._lastExportSampleTime = null;
    }

    _resetAllHistory() {
      this._resetGraphHistory();
      this._resetExportHistory();
    }

    _recordGraphSample() {
      if (this._lastGraphSampleTime === null) this._lastGraphSampleTime = this.simTime;
      const sampleDt = 1.0 / 60.0;
      if (this.simTime - this._lastGraphSampleTime < sampleDt) return;
      this._lastGraphSampleTime = this.simTime;

      this.graphHistory.push({
        t: this.simTime,
        theta1: this.pendulum.theta1,
        theta2: this.pendulum.theta2,
        omega1: this.pendulum.omega1,
        omega2: this.pendulum.omega2,
      });

      if (this.graphHistory.length > this._graphMaxPoints) {
        this.graphHistory.splice(0, this.graphHistory.length - this._graphMaxPoints);
      }
    }

    _recordExportSample() {
      if (this._lastExportSampleTime === null) this._lastExportSampleTime = this.simTime;
      const sampleDt = 1.0 / 60.0;
      if (this.simTime - this._lastExportSampleTime < sampleDt) return;
      this._lastExportSampleTime = this.simTime;

      this.exportHistory.push({
        t: this.simTime,
        theta1: this.pendulum.theta1,
        theta2: this.pendulum.theta2,
        omega1: this.pendulum.omega1,
        omega2: this.pendulum.omega2,
      });

      if (this.exportHistory.length > this._graphMaxPoints) {
        this.exportHistory.splice(0, this.exportHistory.length - this._graphMaxPoints);
      }
    }

    _toggleOptionsMenu() {
      const collapsed = this.optionsEl.classList.toggle("collapsed");
      this.optionsToggleIcon.textContent = collapsed ? "▸" : "▾";
    }

    _wireOptionToggles() {
      this.optTrail = document.getElementById("optTrail");
      this.optEnergy = document.getElementById("optEnergy");
      this.optArrows = document.getElementById("optArrows");
      this.optArrowMag = document.getElementById("optArrowMag");
      this.optAngles = document.getElementById("optAngles");
      this.optRadians = document.getElementById("optRadians");
      this.optSlow = document.getElementById("optSlow");

      this.optTrail.addEventListener("change", () => {
        this.showTrail = !!this.optTrail.checked;
      });
      this.optEnergy.addEventListener("change", () => {
        this.showEnergy = !!this.optEnergy.checked;
      });
      this.optArrows.addEventListener("change", () => {
        this.showArrows = !!this.optArrows.checked;
      });
      this.optArrowMag.addEventListener("change", () => {
        this.showArrowMagnitudes = !!this.optArrowMag.checked;
      });
      this.optAngles.addEventListener("change", () => {
        this.showAngleLabels = !!this.optAngles.checked;
        this._syncOptionTogglesFromState();
      });
      this.optRadians.addEventListener("change", () => {
        this.showAngleRadians = !!this.optRadians.checked;
        this._syncOptionTogglesFromState();
      });

      this.optSlow.addEventListener("change", () => {
        const on = !!this.optSlow.checked;
        this._setSlowMotion(on);
      });
    }

    _setSlowMotion(on) {
      if (on) {
        if (!this.slowMotion) {
          this._savedTimeScaleBeforeSlow = this.timeScale;
        }
        this.slowMotion = true;
        this.timeScale = 0.5;
        this._syncControlsFromModel();
      } else {
        this.slowMotion = false;
        if (typeof this._savedTimeScaleBeforeSlow === "number" && Number.isFinite(this._savedTimeScaleBeforeSlow)) {
          this.timeScale = this._savedTimeScaleBeforeSlow;
        }
        this._savedTimeScaleBeforeSlow = null;
        this._syncControlsFromModel();
      }
      this._syncOptionTogglesFromState();
    }

    _syncOptionTogglesFromState() {
      if (this.optTrail) this.optTrail.checked = !!this.showTrail;
      if (this.optEnergy) this.optEnergy.checked = !!this.showEnergy;
      if (this.optArrows) this.optArrows.checked = !!this.showArrows;
      if (this.optArrowMag) this.optArrowMag.checked = !!this.showArrowMagnitudes;
      if (this.optAngles) this.optAngles.checked = !!this.showAngleLabels;
      if (this.optRadians) {
        this.optRadians.checked = !!this.showAngleRadians;
        this.optRadians.disabled = !this.showAngleLabels;
      }
      if (this.optSlow) this.optSlow.checked = !!this.slowMotion;
    }

    _getTheme() {
      const t = document.documentElement.getAttribute("data-theme");
      return t === "light" ? "light" : "dark";
    }

    _setTheme(theme) {
      const t = theme === "light" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", t);
      try {
        localStorage.setItem("dp_theme", t);
      } catch {}
      this._updateThemeColors();
      this._updateThemeToggleLabel();
    }

    _initTheme() {
      let stored = null;
      try {
        stored = localStorage.getItem("dp_theme");
      } catch {}
      if (stored === "light" || stored === "dark") {
        this._setTheme(stored);
        return;
      }
      const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
      this._setTheme(prefersLight ? "light" : "dark");
    }

    _toggleTheme() {
      this._setTheme(this._getTheme() === "dark" ? "light" : "dark");
    }

    _updateThemeToggleLabel() {
      // Show the *other* mode as the icon hint.
      const theme = this._getTheme();
      this.themeToggleLabel.textContent = theme === "dark" ? "☀" : "☾";
      this.themeToggle.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    }

    _updateThemeColors() {
      const css = getComputedStyle(document.documentElement);
      const get = (name, fallback) => {
        const v = css.getPropertyValue(name).trim();
        return v || fallback;
      };
      this.colors = {
        bg: get("--bg", "rgb(18, 22, 27)"),
        render: get("--render", "rgb(22, 26, 32)"),
        trail: get("--trail", "rgb(96, 128, 255)"),
        rod: get("--rod", "rgb(94, 105, 120)"),
        muted: get("--muted", "rgb(80, 88, 100)"),
        origin: get("--origin-dot", "rgb(245, 248, 252)"),
        bob1: get("--bob1", "rgb(255, 152, 99)"),
        bob2: get("--bob2", "rgb(86, 160, 255)"),
        arrow1: get("--arrow1", "rgb(255, 180, 120)"),
        arrow2: get("--arrow2", "rgb(140, 200, 255)"),
        hud: get("--text", "rgb(230, 234, 238)"),
      };
    }

    _setAboutVisible(visible) {
      this.about.classList.toggle("hidden", !visible);
    }

    _handleKey(e) {
      if (this._activeTab !== "sim") return;

      if (!this.about.classList.contains("hidden") && (e.key === "Escape" || e.key === "Enter")) {
        this._setAboutVisible(false);
        return;
      }

      if (e.key === " ") {
        e.preventDefault();
        this.paused = !this.paused;
      } else if (e.key.toLowerCase() === "r") {
        this._resetToDefaults();
      } else if (e.key.toLowerCase() === "n") {
        const th1 = (Math.random() * 2 - 1) * Math.PI;
        const th2 = (Math.random() * 2 - 1) * Math.PI;
        this.pendulum.reset({ theta1: th1, theta2: th2 });
        this.paused = false;
        this.simTime = 0.0;
        this._resetTrailWithCurrent();
        this._resetAllHistory();
      } else if (e.key.toLowerCase() === "t") {
        this.showTrail = !this.showTrail;
        this._syncOptionTogglesFromState();
      } else if (e.key.toLowerCase() === "e") {
        this.showEnergy = !this.showEnergy;
        this._syncOptionTogglesFromState();
      } else if (e.key.toLowerCase() === "c") {
        this._resetTrailWithCurrent();
        this._resetAllHistory();
      } else if (e.key === "-" || e.key === "_") {
        this.pendulum.g = Math.max(0.5, this.pendulum.g - 0.5);
        this._syncControlsFromModel();
        this.pendulum.initialEnergy = this.pendulum.energy();
        this._resetAllHistory();
      } else if (e.key === "=" || e.key === "+") {
        this.pendulum.g = Math.min(25.0, this.pendulum.g + 0.5);
        this._syncControlsFromModel();
        this.pendulum.initialEnergy = this.pendulum.energy();
        this._resetAllHistory();
      } else if (e.key.toLowerCase() === "d") {
        if (this.pendulum.damping > 0) this.pendulum.damping = 0.0;
        else this.pendulum.damping = this.defaultDamping;
        this._syncControlsFromModel();
        this.pendulum.initialEnergy = this.pendulum.energy();
        this._resetAllHistory();
      } else if (e.key.toLowerCase() === "s") {
        const options = [0.25, 0.5, 1.0, 1.5, 2.0];
        const idx = options.includes(this.timeScale) ? options.indexOf(this.timeScale) : 2;
        this.timeScale = options[(idx + 1) % options.length];
        if (this.slowMotion && this.timeScale !== 0.5) {
          this.slowMotion = false;
          this._savedTimeScaleBeforeSlow = null;
        }
        this._syncControlsFromModel();
        this._syncOptionTogglesFromState();
        this._resetAllHistory();
      }
    }

    _togglePanel() {
      this.panelCollapsed = !this.panelCollapsed;
      this._applyPanelState();
      this._resizeCanvas();
      this._resizePlotCanvas();
    }

    _autoCollapse() {
      const threshold = this.panelWidth + 520;
      this.panelCollapsed = window.innerWidth < threshold;
      this._applyPanelState();
    }

    _applyPanelState() {
      this.panel.classList.toggle("collapsed", this.panelCollapsed);
      this.panelToggle.classList.toggle("collapsed", this.panelCollapsed);
      this.panelToggle.classList.toggle("expanded", !this.panelCollapsed);
      this.panelToggleIcon.textContent = this.panelCollapsed ? "▶" : "◀";
    }

    _resizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const renderRect = this.render.getBoundingClientRect();
      const wCss = renderRect.width;
      const hCss = renderRect.height;
      this.canvas.width = Math.max(1, Math.floor(wCss * dpr));
      this.canvas.height = Math.max(1, Math.floor(hCss * dpr));
      this.canvas.style.width = `${wCss}px`;
      this.canvas.style.height = `${hCss}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      this.origin.x = Math.floor(wCss / 2);
      this.origin.y = Math.max(140, Math.floor(hCss * 0.18));
      this.scale = this._computeScale();
    }

    _resizePlotCanvas() {
      // Render the plot at 2x resolution for sharper lines.
      const dpr = (window.devicePixelRatio || 1) * 2;
      const plotRect = this.plot.getBoundingClientRect();
      const wCss = plotRect.width;
      const hCss = plotRect.height;
      this.plotCanvas.width = Math.max(1, Math.floor(wCss * dpr));
      this.plotCanvas.height = Math.max(1, Math.floor(hCss * dpr));
      this.plotCanvas.style.width = `${wCss}px`;
      this.plotCanvas.style.height = `${hCss}px`;
      this.plotCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    _exportGraphData() {
      const rows = this.exportHistory;
      if (!rows || rows.length === 0) return;

      const header = ["t_s", "theta1_rad", "theta2_rad", "omega1_rad_s", "omega2_rad_s"];
      const lines = [header.join(",")];
      for (const r of rows) {
        lines.push(
          [
            r.t.toFixed(6),
            r.theta1.toFixed(10),
            r.theta2.toFixed(10),
            r.omega1.toFixed(10),
            r.omega2.toFixed(10),
          ].join(",")
        );
      }

      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });

      const pad2 = (n) => String(n).padStart(2, "0");
      const d = new Date();
      const name = `double_pendulum_graph_data_${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(
        d.getHours()
      )}${pad2(d.getMinutes())}${pad2(d.getSeconds())}.csv`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    _computeScale() {
      const totalLength = this.pendulum.L1 + this.pendulum.L2;
      const renderRect = this.render.getBoundingClientRect();
      const renderWidth = renderRect.width;
      const renderHeight = renderRect.height;
      const usableHeight = renderHeight - 260;
      const usableWidth = renderWidth - 140;
      return 0.75 * Math.min(usableWidth, usableHeight) / Math.max(totalLength, 0.1);
    }

    _currentPoint() {
      const { x2, y2 } = this.pendulum.positions();
      return { x: x2, y: y2 };
    }

    _resetTrailWithCurrent() {
      this.trailHistory = [];
      this.trailIndex = 0;
      this.lastTrailIndex = 0;
      this._appendCurrentPoint();
    }

    _appendCurrentPoint() {
      this.trailHistory.push(this._currentPoint());
      this.trailIndex = this.trailHistory.length;
      this.lastTrailIndex = this.trailIndex;
    }

    _advanceTrailForward() {
      if (this.trailIndex < this.trailHistory.length) {
        this.trailHistory[this.trailIndex] = this._currentPoint();
        this.trailIndex += 1;
      } else {
        this._appendCurrentPoint();
      }
      this.lastTrailIndex = this.trailIndex;
    }

    _updateTrail() {
      this._advanceTrailForward();
      this.lastTrailIndex = this.trailIndex;
    }

    _stepFrame(direction) {
      this.paused = true;
      const frameDt = (1.0 / 60.0) * this.timeScale;
      const dt = frameDt * direction;
      this.pendulum.step(dt);
      this.simTime = Math.max(0.0, this.simTime + dt);

      if (dt > 0) {
        this._advanceTrailForward();
      } else {
        this.trailIndex = Math.max(1, this.trailIndex - 1);
        if (this.trailHistory.length > 0) {
          this.trailHistory[this.trailIndex - 1] = this._currentPoint();
        }
        this.rewindInProgress = true;
      }
      this.lastTrailIndex = this.trailIndex;
    }

    _resetFromControls({ theta1, theta2 } = {}) {
      this._syncModelFromControls();
      this.pendulum.reset({ theta1, theta2 });
      this.pendulum.initialEnergy = this.pendulum.energy();
      this.simTime = 0.0;
      this._resetTrailWithCurrent();
      this._resetAllHistory();
      this.rewindInProgress = false;
    }

    _resetToDefaults() {
      this.controls.L1.num.value = String(this.defaults.L1);
      this.controls.L2.num.value = String(this.defaults.L2);
      this.controls.m1.num.value = String(this.defaults.m1);
      this.controls.m2.num.value = String(this.defaults.m2);
      this.controls.g.num.value = String(this.defaults.g);
      this.controls.damping.num.value = String(this.defaults.damping);
      this.controls.timeScale.num.value = String(this.defaults.timeScale);

      Object.values(this.controls).forEach(({ num, rng }) => (rng.value = num.value));
      this._resetFromControls({ theta1: Math.PI / 2, theta2: Math.PI / 2 });
      this.paused = true;
      this.simTime = 0.0;
      this.rewindInProgress = false;

      this._resetAllHistory();

      this.showTrail = true;
      this.showEnergy = true;
      this.showArrows = false;
      this.showArrowMagnitudes = false;
      this.showAngleLabels = false;
      this.showAngleRadians = false;
      this._syncOptionTogglesFromState();
    }

    _randomizeParametersOnly() {
      const rand = (min, max) => min + Math.random() * (max - min);

      const setPair = (pair) => {
        const min = parseFloat(pair.num.min);
        const max = parseFloat(pair.num.max);
        const step = parseFloat(pair.num.step || "0");
        let v = rand(min, max);
        if (step > 0) {
          const steps = Math.round((v - min) / step);
          v = min + steps * step;
        }
        v = clamp(v, min, max);
        pair.num.value = String(v);
        pair.rng.value = String(v);
      };

      [
        this.controls.L1,
        this.controls.L2,
        this.controls.m1,
        this.controls.m2,
        this.controls.g,
        this.controls.damping,
        this.controls.timeScale,
      ].forEach(setPair);

      this._syncModelFromControls();
      this.pendulum.omega1 = 0.0;
      this.pendulum.omega2 = 0.0;
      this.pendulum.initialEnergy = this.pendulum.energy();
      this._resetTrailWithCurrent();
      this._resetAllHistory();
      this.rewindInProgress = false;
      this.paused = true;
      this.simTime = 0.0;
    }

    _screenPoints() {
      const { x1, y1, x2, y2 } = this.pendulum.positions();
      const p1 = { x: this.origin.x + x1 * this.scale, y: this.origin.y + y1 * this.scale };
      const p2 = { x: this.origin.x + x2 * this.scale, y: this.origin.y + y2 * this.scale };
      return { p1, p2 };
    }

    _dist(a, b) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.hypot(dx, dy);
    }

    _canvasPosFromEvent(e) {
      const rect = this.canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    _onMouseDown(e) {
      if (this._activeTab !== "sim") return;
      if (!this.paused) return;
      const pos = this._canvasPosFromEvent(e);
      const { p1, p2 } = this._screenPoints();

      if (this._dist(pos, p2) < 20) {
        this.draggingEnd = true;
        this.draggingMid = false;
      } else if (this._dist(pos, p1) < 20) {
        this.draggingMid = true;
        this.draggingEnd = false;
      }
    }

    _onMouseMove(e) {
      if (this._activeTab !== "sim") return;
      if (!this.paused) return;
      if (!this.draggingEnd && !this.draggingMid) return;
      const pos = this._canvasPosFromEvent(e);
      if (this.draggingEnd) this._applyDragEnd(pos);
      if (this.draggingMid) this._applyDragMid(pos);

      this._resetTrailWithCurrent();
      this.pendulum.initialEnergy = this.pendulum.energy();
      this._resetAllHistory();
      this.rewindInProgress = false;
    }

    _onMouseUp() {
      this.draggingEnd = false;
      this.draggingMid = false;
    }

    _applyDragMid(pos) {
      const delta = this.pendulum.theta2 - this.pendulum.theta1;
      const rel = { x: pos.x - this.origin.x, y: pos.y - this.origin.y };
      const theta1 = Math.atan2(rel.x, rel.y);
      this.pendulum.theta1 = theta1;
      this.pendulum.theta2 = theta1 + delta;
      this.pendulum.omega1 = 0.0;
      this.pendulum.omega2 = 0.0;
    }

    _applyDragEnd(pos) {
      const x = (pos.x - this.origin.x) / this.scale;
      const y = (pos.y - this.origin.y) / this.scale;

      const L1 = this.pendulum.L1;
      const L2 = this.pendulum.L2;

      let r = Math.hypot(x, y);
      r = Math.min(Math.max(r, Math.abs(L1 - L2) + 1e-4), L1 + L2 - 1e-4);

      let cosElbow = (r * r - L1 * L1 - L2 * L2) / (2 * L1 * L2);
      cosElbow = clamp(cosElbow, -1.0, 1.0);
      const elbow = Math.acos(cosElbow);

      const phi = Math.atan2(y, x);
      const theta1_x = phi - Math.atan2(L2 * Math.sin(elbow), L1 + L2 * Math.cos(elbow));
      const theta2_x = theta1_x + elbow;

      this.pendulum.theta1 = Math.PI / 2 - theta1_x;
      this.pendulum.theta2 = Math.PI / 2 - theta2_x;
      this.pendulum.omega1 = 0.0;
      this.pendulum.omega2 = 0.0;
    }

    _frame(timestampMs) {
      if (this._lastTimestamp === null) this._lastTimestamp = timestampMs;
      const dtReal = (timestampMs - this._lastTimestamp) / 1000.0;
      this._lastTimestamp = timestampMs;

      const dtTarget = dtReal * this.timeScale;

      if (!this.paused) {
        const maxDt = 0.002;
        let remaining = dtTarget;
        while (remaining > 0) {
          const dt = Math.min(remaining, maxDt);
          this.pendulum.step(dt);
          remaining -= dt;
          this.simTime += dt;
        }
        this._updateTrail();
        // Graphs always sample while playing; recording only gates CSV export capture.
        this._recordGraphSample();
        if (this.recordingEnabled) this._recordExportSample();
      }

      this._draw();
      if (this._activeTab !== "sim") {
        this._drawPlot();
      }
      this._updateRecordingUi();
      requestAnimationFrame((ts) => this._frame(ts));
    }

    _updateRecordingUi() {
      const armed = !!this.recordingEnabled;
      const activelyRecording = armed && !this.paused;
      const waitingForSim = armed && this.paused;

      if (this.recordLabel) {
        this.recordLabel.textContent = activelyRecording ? "Recording" : waitingForSim ? "Waiting for sim" : "Record";
      }

      if (this.btnRecord) {
        // Keep the armed state visually obvious, even if paused.
        this.btnRecord.classList.toggle("active", armed);
        this.btnRecord.title = activelyRecording
          ? "Recording (CSV). Stop to download"
          : waitingForSim
          ? "Waiting for simulation. Press Play to start capturing CSV"
          : "Record (CSV)";
      }

      if (this.btnDownload) {
        const showDownload = !armed && this.exportHistory && this.exportHistory.length > 0;
        this.btnDownload.style.display = showDownload ? "inline-flex" : "none";
        this.btnDownload.title = showDownload ? "Download CSV" : "";
      }
    }

    _drawPlot() {
      const ctx = this.plotCtx;
      const plotRect = this.plotCanvas.getBoundingClientRect();
      const w = plotRect.width;
      const h = plotRect.height;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = this.colors?.render || "rgb(22, 26, 32)";
      ctx.fillRect(0, 0, w, h);

      const data = this.graphHistory;
      if (!data || data.length < 2) {
        ctx.font = "18px Segoe UI";
        ctx.fillStyle = this.colors?.hud || "rgb(230, 234, 238)";
        ctx.fillText("Waiting for data…", 18, 28);
        return;
      }

      const tMax = data[data.length - 1].t;
      const windowSec = this._activeTab === "phase" ? this._graphWindowSecPhase : this._graphWindowSec;
      const tMin = Math.max(0.0, tMax - windowSec);
      const windowed = data.filter((p) => p.t >= tMin);
      if (windowed.length < 2) return;

      // Leave extra space above the graph box for the title.
      const margin = { l: 56, r: 18, t: 54, b: 44 };
      const innerW = Math.max(1, w - margin.l - margin.r);
      const innerH = Math.max(1, h - margin.t - margin.b);

      const minMax = (vals) => {
        let mn = Infinity;
        let mx = -Infinity;
        for (const v of vals) {
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
        if (!Number.isFinite(mn) || !Number.isFinite(mx)) return { mn: -1, mx: 1 };
        if (Math.abs(mx - mn) < 1e-9) return { mn: mn - 1, mx: mx + 1 };
        const pad = 0.1 * (mx - mn);
        return { mn: mn - pad, mx: mx + pad };
      };

      const niceStep = (range, targetTicks) => {
        const r = Math.max(1e-9, range);
        const rough = r / Math.max(1, targetTicks);
        const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
        const scaled = rough / pow10;
        const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
        return nice * pow10;
      };

      const ticks = (min, max, targetTicks) => {
        const step = niceStep(max - min, targetTicks);
        const start = Math.ceil(min / step) * step;
        const out = [];
        for (let v = start; v <= max + 1e-9; v += step) out.push(v);
        return { step, values: out };
      };

      const drawGridAndTicks = ({ xTicks, yTicks, xToPx, yToPx, fmtX, fmtY }) => {
        const grid = this.colors?.muted || "rgb(80, 88, 100)";
        ctx.strokeStyle = grid;
        ctx.lineWidth = 1;

        // vertical grid + x ticks
        for (const xv of xTicks.values) {
          const x = xToPx(xv);
          ctx.beginPath();
          ctx.moveTo(x, margin.t);
          ctx.lineTo(x, margin.t + innerH);
          ctx.stroke();
        }

        // horizontal grid + y ticks
        for (const yv of yTicks.values) {
          const y = yToPx(yv);
          ctx.beginPath();
          ctx.moveTo(margin.l, y);
          ctx.lineTo(margin.l + innerW, y);
          ctx.stroke();
        }

        ctx.font = "13px Segoe UI";
        ctx.fillStyle = this.colors?.hud || "rgb(230, 234, 238)";

        // x tick labels
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        for (const xv of xTicks.values) {
          const x = xToPx(xv);
          ctx.fillText(fmtX(xv), x, margin.t + innerH + 6);
        }

        // y tick labels
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        for (const yv of yTicks.values) {
          const y = yToPx(yv);
          ctx.fillText(fmtY(yv), margin.l - 8, y);
        }

        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
      };

      const drawAxes = (title, xLabel, yLabel) => {
        ctx.strokeStyle = this.colors?.rod || "rgb(94, 105, 120)";
        ctx.lineWidth = 2;
        ctx.strokeRect(margin.l, margin.t, innerW, innerH);

        ctx.font = "18px Segoe UI";
        ctx.fillStyle = this.colors?.hud || "rgb(230, 234, 238)";
        // Title sits above the box (no collision with plotted data).
        ctx.fillText(title, margin.l, 26);

        ctx.font = "14px Segoe UI";
        ctx.fillText(xLabel, margin.l + innerW - 90, margin.t + innerH + 34);
        ctx.fillText(yLabel, 18, margin.t + 18);
      };

      const drawZeroAxes = ({ xMin, xMax, yMin, yMax, xToPx, yToPx }) => {
        ctx.strokeStyle = this.colors?.rod || "rgb(94, 105, 120)";
        ctx.lineWidth = 2;

        // y=0 axis (puts the time axis through the middle when values are symmetric)
        if (yMin < 0 && yMax > 0) {
          const y0 = yToPx(0);
          ctx.beginPath();
          ctx.moveTo(margin.l, y0);
          ctx.lineTo(margin.l + innerW, y0);
          ctx.stroke();
        }

        // x=0 axis (phase plot)
        if (xMin < 0 && xMax > 0) {
          const x0 = xToPx(0);
          ctx.beginPath();
          ctx.moveTo(x0, margin.t);
          ctx.lineTo(x0, margin.t + innerH);
          ctx.stroke();
        }
      };

      const symmetricRange = (vals) => {
        let mn = Infinity;
        let mx = -Infinity;
        for (const v of vals) {
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
        if (!Number.isFinite(mn) || !Number.isFinite(mx)) return { mn: -1, mx: 1 };
        const maxAbs = Math.max(Math.abs(mn), Math.abs(mx), 1e-6);
        const pad = 0.1 * maxAbs;
        return { mn: -(maxAbs + pad), mx: maxAbs + pad };
      };

      const expandToFitSymmetric = (locked, suggested) => {
        if (!locked) return suggested;
        const mn = Math.min(locked.mn, suggested.mn);
        const mx = Math.max(locked.mx, suggested.mx);
        const maxAbs = Math.max(Math.abs(mn), Math.abs(mx), 1e-6);
        return { mn: -maxAbs, mx: maxAbs };
      };

      const legend = (items) => {
        ctx.font = "14px Segoe UI";
        let x = margin.l;
        const y = margin.t + 38;
        for (const it of items) {
          ctx.fillStyle = it.color;
          ctx.fillRect(x, y - 10, 10, 10);
          ctx.fillStyle = this.colors?.hud || "rgb(230, 234, 238)";
          ctx.fillText(it.label, x + 14, y);
          x += 92;
        }
      };

      const line = (points, xOf, yOf, stroke) => {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
          const p = points[i];
          const x = xOf(p);
          const y = yOf(p);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };

      const toXTime = (t) => margin.l + ((t - tMin) / Math.max(1e-6, tMax - tMin)) * innerW;

      if (this._activeTab === "angles") {
        drawAxes("Angles vs Time", "time (s)", "θ (rad)");
        const suggested = symmetricRange(windowed.flatMap((p) => [p.theta1, p.theta2]));
        if (!this._graphLockedRanges.angles && windowed.length >= 30) {
          this._graphLockedRanges.angles = suggested;
        } else if (this._graphLockedRanges.angles) {
          this._graphLockedRanges.angles = expandToFitSymmetric(this._graphLockedRanges.angles, suggested);
        }
        const mm = this._graphLockedRanges.angles || suggested;
        const toY = (v) => margin.t + (1.0 - (v - mm.mn) / Math.max(1e-6, mm.mx - mm.mn)) * innerH;

        const xTicks = ticks(tMin, tMax, 6);
        const yTicks = ticks(mm.mn, mm.mx, 6);
        drawGridAndTicks({
          xTicks,
          yTicks,
          xToPx: (t) => toXTime(t),
          yToPx: (v) => toY(v),
          fmtX: (t) => t.toFixed(0),
          fmtY: (v) => v.toFixed(2),
        });

        drawZeroAxes({ xMin: tMin, xMax: tMax, yMin: mm.mn, yMax: mm.mx, xToPx: (t) => toXTime(t), yToPx: (v) => toY(v) });

        line(windowed, (p) => toXTime(p.t), (p) => toY(p.theta1), this.colors?.bob1 || "rgb(255, 152, 99)");
        line(windowed, (p) => toXTime(p.t), (p) => toY(p.theta2), this.colors?.bob2 || "rgb(86, 160, 255)");
        legend([
          { label: "θ1", color: this.colors?.bob1 || "rgb(255, 152, 99)" },
          { label: "θ2", color: this.colors?.bob2 || "rgb(86, 160, 255)" },
        ]);
      } else if (this._activeTab === "velocities") {
        drawAxes("Velocities vs Time", "time (s)", "ω (rad/s)");
        const suggested = symmetricRange(windowed.flatMap((p) => [p.omega1, p.omega2]));
        if (!this._graphLockedRanges.velocities && windowed.length >= 30) {
          this._graphLockedRanges.velocities = suggested;
        } else if (this._graphLockedRanges.velocities) {
          this._graphLockedRanges.velocities = expandToFitSymmetric(this._graphLockedRanges.velocities, suggested);
        }
        const mm = this._graphLockedRanges.velocities || suggested;
        const toY = (v) => margin.t + (1.0 - (v - mm.mn) / Math.max(1e-6, mm.mx - mm.mn)) * innerH;

        const xTicks = ticks(tMin, tMax, 6);
        const yTicks = ticks(mm.mn, mm.mx, 6);
        drawGridAndTicks({
          xTicks,
          yTicks,
          xToPx: (t) => toXTime(t),
          yToPx: (v) => toY(v),
          fmtX: (t) => t.toFixed(0),
          fmtY: (v) => v.toFixed(2),
        });

        drawZeroAxes({ xMin: tMin, xMax: tMax, yMin: mm.mn, yMax: mm.mx, xToPx: (t) => toXTime(t), yToPx: (v) => toY(v) });

        line(windowed, (p) => toXTime(p.t), (p) => toY(p.omega1), this.colors?.arrow1 || "rgb(255, 180, 120)");
        line(windowed, (p) => toXTime(p.t), (p) => toY(p.omega2), this.colors?.arrow2 || "rgb(140, 200, 255)");
        legend([
          { label: "ω1", color: this.colors?.arrow1 || "rgb(255, 180, 120)" },
          { label: "ω2", color: this.colors?.arrow2 || "rgb(140, 200, 255)" },
        ]);
      } else if (this._activeTab === "phase") {
        drawAxes("Angles vs Each Other", "θ1 (rad)", "θ2 (rad)");
        const suggestedX = symmetricRange(windowed.map((p) => p.theta1));
        const suggestedY = symmetricRange(windowed.map((p) => p.theta2));
        if (!this._graphLockedRanges.phase && windowed.length >= 30) {
          this._graphLockedRanges.phase = { x: suggestedX, y: suggestedY };
        } else if (this._graphLockedRanges.phase) {
          this._graphLockedRanges.phase = {
            x: expandToFitSymmetric(this._graphLockedRanges.phase.x, suggestedX),
            y: expandToFitSymmetric(this._graphLockedRanges.phase.y, suggestedY),
          };
        }
        const mmX = this._graphLockedRanges.phase?.x || suggestedX;
        const mmY = this._graphLockedRanges.phase?.y || suggestedY;
        const toX = (v) => margin.l + ((v - mmX.mn) / Math.max(1e-6, mmX.mx - mmX.mn)) * innerW;
        const toY = (v) => margin.t + (1.0 - (v - mmY.mn) / Math.max(1e-6, mmY.mx - mmY.mn)) * innerH;

        const xTicks = ticks(mmX.mn, mmX.mx, 6);
        const yTicks = ticks(mmY.mn, mmY.mx, 6);
        drawGridAndTicks({
          xTicks,
          yTicks,
          xToPx: (v) => toX(v),
          yToPx: (v) => toY(v),
          fmtX: (v) => v.toFixed(2),
          fmtY: (v) => v.toFixed(2),
        });

        drawZeroAxes({ xMin: mmX.mn, xMax: mmX.mx, yMin: mmY.mn, yMax: mmY.mx, xToPx: (v) => toX(v), yToPx: (v) => toY(v) });

        line(windowed, (p) => toX(p.theta1), (p) => toY(p.theta2), this.colors?.trail || "rgb(96, 128, 255)");
        legend([{ label: "θ2 vs θ1", color: this.colors?.trail || "rgb(96, 128, 255)" }]);
      }
    }

    _draw() {
      const ctx = this.ctx;
      const renderRect = this.render.getBoundingClientRect();
      const renderWidth = renderRect.width;
      const renderHeight = renderRect.height;

      ctx.clearRect(0, 0, renderWidth, renderHeight);
      ctx.fillStyle = this.colors?.bg || "rgb(18, 22, 27)";
      ctx.fillRect(0, 0, renderWidth, renderHeight);

      ctx.fillStyle = this.colors?.render || "rgb(22, 26, 32)";
      ctx.fillRect(0, 0, renderWidth, renderHeight);

      const { p1, p2 } = this._screenPoints();

      if (this.showTrail && this.trailIndex > 1) {
        if (this.paused && !this.rewindInProgress && this.trailIndex < this.lastTrailIndex) {
          this.trailIndex = Math.min(this.lastTrailIndex, this.trailHistory.length);
        }

        ctx.strokeStyle = this.colors?.trail || "rgb(96, 128, 255)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < this.trailIndex; i++) {
          const pt = this.trailHistory[i];
          const x = this.origin.x + pt.x * this.scale;
          const y = this.origin.y + pt.y * this.scale;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        if (this.paused) {
          this.rewindInProgress = false;
          this.lastTrailIndex = this.trailIndex;
        }
      }

      // origin and rods
      ctx.fillStyle = this.colors?.origin || "rgb(245, 248, 252)";
      ctx.beginPath();
      ctx.arc(this.origin.x, this.origin.y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = this.colors?.rod || "rgb(94, 105, 120)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.origin.x, this.origin.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      ctx.fillStyle = this.colors?.bob1 || "rgb(255, 152, 99)";
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = this.colors?.bob2 || "rgb(86, 160, 255)";
      ctx.beginPath();
      ctx.arc(p2.x, p2.y, 14, 0, Math.PI * 2);
      ctx.fill();

      if (this.showArrows) {
        this._drawVelocityArrows(p1, p2);
      }

      if (this.showAngleLabels) {
        this._drawAngleLabels(p1, p2);
      }

      this._drawHud();

      // update start button visuals
      this.startLabel.textContent = this.paused ? "Play" : "Pause";
      this.btnStart.classList.toggle("active", !this.paused);

      if (this.graphPlayLabel && this.graphPlay) {
        this.graphPlayLabel.textContent = this.paused ? "Play" : "Pause";
        this.graphPlay.classList.toggle("active", !this.paused);
      }
    }

    _drawVelocityArrows(p1, p2) {
      const L1 = this.pendulum.L1;
      const L2 = this.pendulum.L2;
      const t1 = this.pendulum.theta1;
      const t2 = this.pendulum.theta2;
      const w1 = this.pendulum.omega1;
      const w2 = this.pendulum.omega2;

      const v1 = { x: L1 * w1 * Math.cos(t1), y: -L1 * w1 * Math.sin(t1) };
      const v2 = { x: v1.x + L2 * w2 * Math.cos(t2), y: v1.y - L2 * w2 * Math.sin(t2) };

      const drawArrow = (origin, vel, color) => {
        const scale = 40;
        const vx = vel.x * scale;
        const vy = vel.y * scale;
        const end = { x: origin.x + vx, y: origin.y + vy };

        const ctx = this.ctx;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        const angle = vx || vy ? Math.atan2(vy, vx) : 0;
        const ah = 10;
        const left = {
          x: end.x - ah * Math.cos(angle - Math.PI / 6),
          y: end.y - ah * Math.sin(angle - Math.PI / 6),
        };
        const right = {
          x: end.x - ah * Math.cos(angle + Math.PI / 6),
          y: end.y - ah * Math.sin(angle + Math.PI / 6),
        };
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.closePath();
        ctx.fill();

        return { end, vx, vy };
      };

      const a1 = drawArrow(p1, v1, this.colors?.arrow1 || "rgb(255, 180, 120)");
      const a2 = drawArrow(p2, v2, this.colors?.arrow2 || "rgb(140, 200, 255)");

      if (this.showArrowMagnitudes) {
        const mag1 = Math.hypot(v1.x, v1.y);
        const mag2 = Math.hypot(v2.x, v2.y);
        this._drawArrowMagnitudeLabel(a1.end, a1.vx, a1.vy, mag1);
        this._drawArrowMagnitudeLabel(a2.end, a2.vx, a2.vy, mag2);
      }
    }

    _drawArrowMagnitudeLabel(end, vx, vy, magnitude) {
      const ctx = this.ctx;
      const len = Math.hypot(vx, vy);
      const ux = len > 1e-6 ? vx / len : 1;
      const uy = len > 1e-6 ? vy / len : 0;
      // Slightly past the tip of the arrow
      const x = end.x + ux * 8;
      const y = end.y + uy * 8;

      ctx.font = "15px Segoe UI";
      ctx.fillStyle = this.colors?.hud || "rgb(230, 234, 238)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${magnitude.toFixed(2)} m/s`, x, y);

      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }

    _drawAngleLabels(p1, p2) {
      const ctx = this.ctx;
      const theta1 = this.pendulum.theta1;
      const theta2 = this.pendulum.theta2;

      const mid1 = { x: (this.origin.x + p1.x) / 2, y: (this.origin.y + p1.y) / 2 };
      const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

      const off1 = this._normalOffset(this.origin, p1, 14);
      const off2 = this._normalOffset(p1, p2, 14);

      ctx.font = "15px Segoe UI";
      ctx.fillStyle = this.colors?.hud || "rgb(230, 234, 238)";
      ctx.textAlign = "center";

      const deg1 = (theta1 * 180) / Math.PI;
      const deg2 = (theta2 * 180) / Math.PI;

      ctx.fillText(`θ1 ${deg1.toFixed(2)}°`, mid1.x + off1.x, mid1.y + off1.y);
      ctx.fillText(`θ2 ${deg2.toFixed(2)}°`, mid2.x + off2.x, mid2.y + off2.y);

      if (this.showAngleRadians) {
        ctx.fillText(`${theta1.toFixed(3)} rad`, mid1.x + off1.x, mid1.y + off1.y + 16);
        ctx.fillText(`${theta2.toFixed(3)} rad`, mid2.x + off2.x, mid2.y + off2.y + 16);
      }

      ctx.textAlign = "start";
    }

    _normalOffset(a, b, amount) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) return { x: 0, y: -amount };
      // left-hand normal
      const nx = -dy / len;
      const ny = dx / len;
      return { x: nx * amount, y: ny * amount };
    }

    _drawHud() {
      const ctx = this.ctx;
      const lines = [];
      lines.push(`Paused: ${this.paused ? "yes" : "no"} | time x${this.timeScale.toFixed(2)}`);
      lines.push(`t: ${this.simTime.toFixed(2).padStart(7, " ")} s`);
      lines.push(`g: ${this.pendulum.g.toFixed(2)} m/s^2 | damping: ${this.pendulum.damping.toFixed(4)}`);
      lines.push(
        `theta1: ${(this.pendulum.theta1 * 180 / Math.PI).toFixed(2).padStart(6, " ")}°  theta2: ${(this.pendulum.theta2 * 180 / Math.PI).toFixed(2).padStart(6, " ")}°`
      );
      lines.push(
        `omega1: ${this.pendulum.omega1.toFixed(2).padStart(7, " ")} rad/s  omega2: ${this.pendulum.omega2.toFixed(2).padStart(7, " ")} rad/s`
      );

      if (this.showEnergy) {
        const E = this.pendulum.energy();
        if (this.pendulum.initialEnergy === null) this.pendulum.initialEnergy = E;
        const drift = E - this.pendulum.initialEnergy;
        lines.push(`Energy: ${E.toFixed(3).padStart(8, " ")} J (drift ${drift >= 0 ? "+" : ""}${drift.toFixed(5)} J)`);
      }

      ctx.font = "18px Segoe UI";
      ctx.fillStyle = this.colors?.hud || "rgb(230, 234, 238)";
      let y = 20;
      for (const text of lines) {
        ctx.fillText(text, 16, y);
        y += 24;
      }
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    new Simulator();
  });
})();

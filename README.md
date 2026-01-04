# Double Pendulum Simulator

A lightweight pygame-powered simulator of a double pendulum that uses a 4th-order Runge–Kutta integrator and standard equations of motion for two rigid rods. It includes toggles to explore different physical parameters and visualize energy drift.

## Prerequisites
- Python 3.9+ recommended
- `pygame` (install via `pip install -r requirements.txt`)

## Run
```bash
pip install -r requirements.txt
python main.py
```

## Run (Web)
This repo also includes a browser-based version (Canvas + JavaScript) that mirrors the same RK4 integration, parameter sliders, hotkeys, and drag-when-paused interaction.

From the repo root, start a simple static file server (binds to all interfaces so it can be reached via Tailscale):
```bash
python -m http.server 8123 --bind 0.0.0.0
```

Then open:
- http://localhost:8123/index.html

### Tailscale access
If you have Tailscale installed/running on this machine, you can open the same URL from another device on your tailnet:
- `http://<this-machine-tailscale-ip>:8123/index.html`

### Convenience (Windows)
Use the included launcher to automatically pick a free port and print both the local + Tailscale URL:
```powershell
./run_web.ps1
```

If PowerShell blocks script execution on your machine, run it with a one-time bypass:
```powershell
powershell -ExecutionPolicy Bypass -File .\run_web.ps1
```

If your Windows Firewall blocks inbound connections, run:
```powershell
./run_web.ps1 -OpenFirewall
```

Note: adding a firewall rule typically requires running PowerShell as Administrator.

## Controls

### Hotkeys
- `Space`: Start / Pause simulation
- `R`: Reset all parameters to defaults
- `N`: Randomize initial conditions
- `T`: Toggle motion trail visibility
- `C`: Clear current trail history
- `E`: Toggle energy / drift display
- `D`: Toggle damping (friction)
- `S`: Cycle time scale (0.25x - 2.0x)
- `+` / `-`: Increase / Decrease gravity

### Mouse Controls
- **Drag**: Move masses (only when paused)
  - End mass: Uses Inverse Kinematics to follow mouse
  - Mid mass: Adjusts angle directly
- **Click**: Edit slider values directly
- **Panel**: Toggle control panel visibility

### UI Buttons
- **Step**: Advance/Rewind frame-by-frame (when paused)
- **Arrows**: Toggle velocity vectors overlay

## Physics
- Model: two point masses $m_1, m_2$ on massless rods $L_1, L_2$ with angles $\theta_1, \theta_2$ measured from vertical. Gravity $g$ acts downward and an optional viscous damping term $c$ opposes angular velocity.
- Equations of motion (derived from the Lagrangian and solved for angular accelerations):
	$$\begin{aligned}
	\delta &= \theta_2 - \theta_1, \\
	d_1 &= (m_1 + m_2)L_1 - m_2 L_1 \cos^2 \delta, \\
	d_2 &= \frac{L_2}{L_1} d_1, \\
	\dot\omega_1 &= \frac{m_2 L_1 \omega_1^2 \sin\delta \cos\delta + m_2 g \sin \theta_2 \cos\delta + m_2 L_2 \omega_2^2 \sin\delta - (m_1 + m_2) g \sin \theta_1}{d_1} - c\,\omega_1, \\
	\dot\omega_2 &= \frac{-m_2 L_2 \omega_2^2 \sin\delta \cos\delta + (m_1 + m_2)(g \sin \theta_1 \cos\delta - L_1 \omega_1^2 \sin\delta - g \sin \theta_2)}{d_2} - c\,\omega_2.
	\end{aligned}$$
- State update uses 4th-order Runge–Kutta (RK4) with a small fixed sub-step for stability under time scaling.
- Energy (used for drift display): kinetic $T$ and potential $V$ combine to total $E = T + V$ with
	$$T = \tfrac12 m_1 (L_1 \omega_1)^2 + \tfrac12 m_2\big[(L_1 \omega_1)^2 + (L_2 \omega_2)^2 + 2 L_1 L_2 \omega_1 \omega_2 \cos(\theta_1 - \theta_2)\big],$$
	$$V = -g\,(m_1 y_1 + m_2 y_2), \quad y_1 = L_1 \cos \theta_1, \quad y_2 = y_1 + L_2 \cos \theta_2.$$
- Damping is linear (viscous) at each joint: torque proportional to angular velocity; it steadily removes mechanical energy.

## Notes
- Integration uses RK4; energy drift is displayed to help gauge numerical stability. Minor drift is expected, especially at high speeds or with large time scaling.
- The rendering origin is near the top-center of the window; lengths are scaled to fit the viewport while preserving the modeled dimensions.

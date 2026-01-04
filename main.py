import math
import random
from dataclasses import dataclass, field

import pygame


class DoublePendulum:
    """Double pendulum integrator using RK4."""

    def __init__(self, m1=1.0, m2=1.0, L1=1.0, L2=1.0, g=9.81, damping=0.0):
        self.m1 = m1
        self.m2 = m2
        self.L1 = L1
        self.L2 = L2
        self.g = g
        self.damping = damping  # viscous damping coefficient

        # angles (rad) and angular velocities (rad/s)
        self.theta1 = math.pi / 2
        self.theta2 = math.pi / 2
        self.omega1 = 0.0
        self.omega2 = 0.0

        self._initial_energy = None

    def reset(self, theta1=None, theta2=None):
        self.theta1 = theta1 if theta1 is not None else math.pi / 2
        self.theta2 = theta2 if theta2 is not None else math.pi / 2
        self.omega1 = 0.0
        self.omega2 = 0.0
        self._initial_energy = self.energy()

    def state(self):
        return (self.theta1, self.theta2, self.omega1, self.omega2)

    def _derivatives(self, theta1, theta2, omega1, omega2):
        m1, m2, L1, L2, g = self.m1, self.m2, self.L1, self.L2, self.g
        delta = theta2 - theta1

        den1 = (m1 + m2) * L1 - m2 * L1 * math.cos(delta) ** 2
        den2 = (L2 / L1) * den1

        domega1 = (
            m2 * L1 * omega1 ** 2 * math.sin(delta) * math.cos(delta)
            + m2 * g * math.sin(theta2) * math.cos(delta)
            + m2 * L2 * omega2 ** 2 * math.sin(delta)
            - (m1 + m2) * g * math.sin(theta1)
        ) / den1

        domega2 = (
            -m2 * L2 * omega2 ** 2 * math.sin(delta) * math.cos(delta)
            + (m1 + m2)
            * (
                g * math.sin(theta1) * math.cos(delta)
                - L1 * omega1 ** 2 * math.sin(delta)
                - g * math.sin(theta2)
            )
        ) / den2

        # simple viscous damping on each joint
        domega1 -= self.damping * omega1
        domega2 -= self.damping * omega2

        return omega1, omega2, domega1, domega2

    def step(self, dt):
        # 4th-order Runge-Kutta integration
        th1, th2, w1, w2 = self.theta1, self.theta2, self.omega1, self.omega2

        k1 = self._derivatives(th1, th2, w1, w2)
        k2 = self._derivatives(
            th1 + 0.5 * dt * k1[0],
            th2 + 0.5 * dt * k1[1],
            w1 + 0.5 * dt * k1[2],
            w2 + 0.5 * dt * k1[3],
        )
        k3 = self._derivatives(
            th1 + 0.5 * dt * k2[0],
            th2 + 0.5 * dt * k2[1],
            w1 + 0.5 * dt * k2[2],
            w2 + 0.5 * dt * k2[3],
        )
        k4 = self._derivatives(
            th1 + dt * k3[0],
            th2 + dt * k3[1],
            w1 + dt * k3[2],
            w2 + dt * k3[3],
        )

        self.theta1 += dt / 6.0 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0])
        self.theta2 += dt / 6.0 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])
        self.omega1 += dt / 6.0 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2])
        self.omega2 += dt / 6.0 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3])

    def positions(self):
        x1 = self.L1 * math.sin(self.theta1)
        y1 = self.L1 * math.cos(self.theta1)
        x2 = x1 + self.L2 * math.sin(self.theta2)
        y2 = y1 + self.L2 * math.cos(self.theta2)
        return (x1, y1), (x2, y2)

    def energy(self):
        m1, m2, L1, L2, g = self.m1, self.m2, self.L1, self.L2, self.g
        (x1, y1), (x2, y2) = self.positions()

        v1_sq = (L1 * self.omega1) ** 2
        v2_sq = (
            v1_sq
            + (L2 * self.omega2) ** 2
            + 2 * L1 * L2 * self.omega1 * self.omega2 * math.cos(self.theta1 - self.theta2)
        )

        T = 0.5 * m1 * v1_sq + 0.5 * m2 * v2_sq
        V = -g * (m1 * y1 + m2 * y2)
        return T + V


@dataclass
class Slider:
    label: str
    min_value: float
    max_value: float
    value: float
    rect: pygame.Rect
    precision: int = 2
    dragging: bool = False
    label_rect: pygame.Rect | None = field(default=None, compare=False)
    step: float | None = None
    input_rect: pygame.Rect | None = field(default=None, compare=False)

    def handle_event(self, event):
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self.input_rect and self.input_rect.collidepoint(event.pos):
                return
            if self.rect.collidepoint(event.pos):
                self.dragging = True
                self._update_value_from_pos(event.pos[0])
        elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
            self.dragging = False
        elif event.type == pygame.MOUSEMOTION and self.dragging:
            self._update_value_from_pos(event.pos[0])

    def _update_value_from_pos(self, x):
        # clamp x to slider width and map to value range
        pct = (x - self.rect.x) / self.rect.w
        pct = max(0.0, min(1.0, pct))
        raw = self.min_value + pct * (self.max_value - self.min_value)
        if self.step:
            steps = round((raw - self.min_value) / self.step)
            raw = self.min_value + steps * self.step
        self.value = max(self.min_value, min(self.max_value, raw))

    def draw(self, surface, font, active=False, input_text=None, cursor_on=False, cursor_pos=None):
        # thin line track
        line_y = self.rect.centery
        start = (self.rect.x, line_y)
        end = (self.rect.x + self.rect.w, line_y)
        pygame.draw.line(surface, (80, 88, 100), start, end, 6)
        pygame.draw.line(surface, (200, 210, 225), (start[0] + 3, line_y), (end[0] - 3, line_y), 2)

        pct = (self.value - self.min_value) / (self.max_value - self.min_value)
        knob_x = int(self.rect.x + pct * self.rect.w)
        knob_rect = pygame.Rect(knob_x - 10, line_y - 12, 20, 24)
        pygame.draw.rect(surface, (96, 128, 255) if not active else (65, 180, 130), knob_rect, border_radius=6)

        display_val = input_text if input_text is not None else f"{self.value:.{self.precision}f}"
        label_pos = (self.rect.x, self.rect.y - 26)
        label_surf = font.render(f"{self.label}", True, (230, 234, 238))
        surface.blit(label_surf, label_pos)
        self.label_rect = label_surf.get_rect(topleft=label_pos)

        # input box always visible
        box_w = 132
        box_h = 28
        box_rect = pygame.Rect(self.rect.right - box_w, self.rect.y - 30, box_w, box_h)
        self.input_rect = box_rect
        pygame.draw.rect(surface, (40, 46, 56), box_rect, border_radius=6)
        border_color = (96, 128, 255) if active else (70, 78, 90)
        pygame.draw.rect(surface, border_color, box_rect, 2, border_radius=6)
        val_text = display_val
        if active and cursor_pos is not None:
            cursor_index = max(0, min(len(display_val), cursor_pos))
            pipe = "|" if cursor_on else ""
            val_text = display_val[:cursor_index] + pipe + display_val[cursor_index:]
        val_surf = font.render(val_text, True, (235, 240, 245))
        val_rect = val_surf.get_rect(midleft=(box_rect.x + 8, box_rect.centery))
        surface.blit(val_surf, val_rect)


@dataclass
class Button:
    label: str
    rect: pygame.Rect
    primary: bool = False
    icon: str | None = None

    def draw(self, surface, font, active=False, icon_override=None):
        base_color = (96, 128, 255) if self.primary else (70, 78, 90)
        color = base_color if not active else (65, 180, 130)
        pygame.draw.rect(surface, color, self.rect, border_radius=10)
        pygame.draw.rect(surface, (30, 34, 40), self.rect, 2, border_radius=10)

        icon = icon_override or self.icon
        if icon:
            self._draw_icon(surface, icon)
        else:
            text_surf = font.render(self.label, True, (245, 248, 252))
            text_rect = text_surf.get_rect(center=self.rect.center)
            surface.blit(text_surf, text_rect)

    def _draw_icon(self, surface, icon):
        color = (245, 248, 252)
        cx, cy = self.rect.center
        if icon == "play":
            pts = [(cx - 8, cy - 12), (cx - 8, cy + 12), (cx + 12, cy)]
            pygame.draw.polygon(surface, color, pts)
        elif icon == "pause":
            bar_w = 7
            gap = 6
            bar_h = 20
            left = pygame.Rect(cx - gap - bar_w, cy - bar_h // 2, bar_w, bar_h)
            right = pygame.Rect(cx + gap, cy - bar_h // 2, bar_w, bar_h)
            pygame.draw.rect(surface, color, left)
            pygame.draw.rect(surface, color, right)
        elif icon == "step_back":
            pts = [(cx + 8, cy - 12), (cx + 8, cy + 12), (cx - 10, cy)]
            pygame.draw.polygon(surface, color, pts)
        elif icon == "step_forward":
            pts = [(cx - 8, cy - 12), (cx - 8, cy + 12), (cx + 10, cy)]
            pygame.draw.polygon(surface, color, pts)

    def was_clicked(self, event):
        return (
            event.type == pygame.MOUSEBUTTONDOWN
            and event.button == 1
            and self.rect.collidepoint(event.pos)
        )


class Simulator:
    def __init__(self):
        pygame.init()
        self.panel_width = 340
        self.width, self.height = self._initial_size()
        self.panel_collapsed = False
        self.panel_toggle_rect = None
        self.render_width = self.width - self.panel_width
        self.screen = pygame.display.set_mode((self.width, self.height), pygame.RESIZABLE)
        pygame.display.set_caption("Double Pendulum Simulator")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont("segoeui", 18)
        self.font_small = pygame.font.SysFont("segoeui", 15)

        self.pendulum = DoublePendulum(L1=1.0, L2=1.0, m1=1.0, m2=1.0, damping=0.01)
        self.pendulum.reset()

        self.origin = (self.render_width // 2, max(140, int(self.height * 0.18)))
        self.scale = self._compute_scale()

        self.trail_history = []  # world-space (x2, y2) samples
        self.trail_index = 0
        self._last_trail_index = 0
        self._rewind_in_progress = False
        self.paused = True  # start paused until user presses start
        self.show_trail = True
        self.show_energy = True
        self.show_arrows = False
        self.time_scale = 1.0
        self.sim_time = 0.0
        self.default_damping = self.pendulum.damping
        self.about_visible = False
        self.about_close_rect = None
        self._about_rect = None

        self.dragging_end = False
        self.dragging_mid = False

        self.active_input_slider = None
        self.input_buffer = ""
        self.input_cursor = 0

        self.defaults = {
            "L1": 1.0,
            "L2": 1.0,
            "m1": 1.0,
            "m2": 1.0,
            "g": 9.81,
            "d": 0.01,
            "t": 1.0,
        }

        self._auto_collapse(self.width)
        self._update_layout()
        self._build_controls()
        self._reset_trail_with_current()

    def run(self):
        running = True
        while running:
            dt_real = self.clock.tick(60) / 1000.0
            dt_target = dt_real * self.time_scale

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.VIDEORESIZE:
                    self._on_resize(event.w, event.h)
                elif event.type == pygame.KEYDOWN:
                    if self._handle_text_input(event):
                        continue
                    self._handle_key(event.key)
                elif event.type in (pygame.MOUSEBUTTONDOWN, pygame.MOUSEBUTTONUP, pygame.MOUSEMOTION):
                    self._handle_mouse(event)

            if not self.paused:
                # Sub-step integration for stability at high time scales
                max_dt = 0.002  # small fixed step for accuracy
                remaining = dt_target
                while remaining > 0:
                    dt = min(remaining, max_dt)
                    self.pendulum.step(dt)
                    remaining -= dt
                    self.sim_time += dt
                self._update_trail()

            self._draw()

        pygame.quit()

    def _handle_key(self, key):
        if self.about_visible and key in (pygame.K_ESCAPE, pygame.K_RETURN):
            self.about_visible = False
            return
        if key == pygame.K_SPACE:
            self.paused = not self.paused
        elif key == pygame.K_r:
            self._reset_to_defaults()
        elif key == pygame.K_t:
            self.show_trail = not self.show_trail
        elif key == pygame.K_e:
            self.show_energy = not self.show_energy
        elif key == pygame.K_MINUS or key == pygame.K_KP_MINUS:
            self.pendulum.g = max(0.5, self.pendulum.g - 0.5)
        elif key == pygame.K_EQUALS or key == pygame.K_PLUS or key == pygame.K_KP_PLUS:
            self.pendulum.g = min(30.0, self.pendulum.g + 0.5)
        elif key == pygame.K_d:
            if self.pendulum.damping > 0:
                self.pendulum.damping = 0.0
            else:
                self.pendulum.damping = self.default_damping
        elif key == pygame.K_s:
            # cycle through slow/fast motion factors
            options = [0.25, 0.5, 1.0, 1.5, 2.0]
            idx = options.index(self.time_scale) if self.time_scale in options else 2
            self.time_scale = options[(idx + 1) % len(options)]
        elif key == pygame.K_c:
            self._reset_trail_with_current()
        elif key == pygame.K_n:
            # randomize initial conditions for chaos exploration
            th1 = random.uniform(-math.pi, math.pi)
            th2 = random.uniform(-math.pi, math.pi)
            self.pendulum.reset(theta1=th1, theta2=th2)
            self.paused = False
            self.sim_time = 0.0
            self._reset_trail_with_current()

    def _step_frame(self, direction):
        # single frame advance; direction should be +1 or -1
        self.paused = True
        frame_dt = (1.0 / 60.0) * self.time_scale
        dt = frame_dt * direction
        self.pendulum.step(dt)
        self.sim_time = max(0.0, self.sim_time + dt)
        # maintain a reversible trail timeline
        if dt > 0:
            self._advance_trail_forward()
        else:
            self.trail_index = max(1, self.trail_index - 1)
            # keep visible path aligned with current state when rewinding
            if self.trail_history:
                self.trail_history[self.trail_index - 1] = self._current_point()
            self._rewind_in_progress = True
        self._last_trail_index = self.trail_index

    def _reset_trail_with_current(self):
        self.trail_history = []
        self.trail_index = 0
        self._last_trail_index = 0
        self._append_current_point()

    def _update_trail(self):
        # keep recording even when trail is hidden so rewind works later
        self._advance_trail_forward()
        self._last_trail_index = self.trail_index

    def _append_current_point(self):
        self.trail_history.append(self._current_point())
        self.trail_index = len(self.trail_history)
        self._last_trail_index = self.trail_index

    def _advance_trail_forward(self):
        if self.trail_index < len(self.trail_history):
            # refresh stored point with the actual current position, then advance
            self.trail_history[self.trail_index] = self._current_point()
            self.trail_index += 1
        else:
            self._append_current_point()
        self._last_trail_index = self.trail_index

    def _current_point(self):
        (_, _), (x2, y2) = self.pendulum.positions()
        return (x2, y2)

    def _draw(self):
        self.screen.fill((18, 22, 27))

        # split layout: left render, right panel
        render_rect = pygame.Rect(0, 0, self.render_width, self.height)
        panel_rect = pygame.Rect(self.render_width, 0, self.panel_width, self.height)

        pygame.draw.rect(self.screen, (22, 26, 32), render_rect)
        if not self.panel_collapsed:
            pygame.draw.rect(self.screen, (27, 32, 40), panel_rect)

        (x1, y1), (x2, y2) = self.pendulum.positions()
        p1 = (int(self.origin[0] + x1 * self.scale), int(self.origin[1] + y1 * self.scale))
        p2 = (int(self.origin[0] + x2 * self.scale), int(self.origin[1] + y2 * self.scale))

        if self.show_trail and self.trail_index > 1:
            # protect against accidental trail shrinkage when paused
            if self.paused and not self._rewind_in_progress and self.trail_index < self._last_trail_index:
                self.trail_index = min(self._last_trail_index, len(self.trail_history))

            points = [
                (int(self.origin[0] + x * self.scale), int(self.origin[1] + y * self.scale))
                for (x, y) in self.trail_history[: self.trail_index]
            ]
            pygame.draw.lines(self.screen, (96, 128, 255), False, points, 2)

            if self.paused:
                self._rewind_in_progress = False
                self._last_trail_index = self.trail_index

        pygame.draw.circle(self.screen, (245, 248, 252), self.origin, 5)
        pygame.draw.line(self.screen, (94, 105, 120), self.origin, p1, 3)
        pygame.draw.line(self.screen, (94, 105, 120), p1, p2, 3)
        pygame.draw.circle(self.screen, (255, 152, 99), p1, 14)
        pygame.draw.circle(self.screen, (86, 160, 255), p2, 14)

        if getattr(self, "show_arrows", False):
            self._draw_velocity_arrows(p1, p2)

        self._draw_hud(p1, p2)
        if not self.panel_collapsed:
            self._draw_panel(panel_rect)
        self._draw_panel_toggle()
        self._draw_about_popup()
        pygame.display.flip()

    def _draw_hud(self, p1, p2):
        lines = []
        lines.append(f"Paused: {'yes' if self.paused else 'no'} | time x{self.time_scale:.2f}")
        lines.append(f"t: {self.sim_time:7.2f} s")
        lines.append(f"g: {self.pendulum.g:.2f} m/s^2 | damping: {self.pendulum.damping:.4f}")
        lines.append(
            f"theta1: {math.degrees(self.pendulum.theta1):6.2f}°  theta2: {math.degrees(self.pendulum.theta2):6.2f}°"
        )
        lines.append(
            f"omega1: {self.pendulum.omega1:7.2f} rad/s  omega2: {self.pendulum.omega2:7.2f} rad/s"
        )

        if self.show_energy:
            energy = self.pendulum.energy()
            if self.pendulum._initial_energy is None:
                self.pendulum._initial_energy = energy
            drift = energy - self.pendulum._initial_energy
            lines.append(f"Energy: {energy:8.3f} J (drift {drift:+.5f} J)")

        y = 16
        for text in lines:
            surf = self.font.render(text, True, (230, 234, 238))
            self.screen.blit(surf, (16, y))
            y += 24

    def _build_controls(self):
        x = self.render_width + 24
        y = 32
        w = self.panel_width - 48

        # space under title
        btn_y = y + 34
        step_w = 44
        gap = 8
        start_w = w - (step_w * 2 + gap * 2)

        self.buttons = {
            "step_back": Button("", pygame.Rect(x, btn_y, step_w, 42), icon="step_back"),
            "start": Button("", pygame.Rect(x + step_w + gap, btn_y, start_w, 42), primary=True, icon="play"),
            "step_forward": Button(
                "",
                pygame.Rect(x + step_w + gap + start_w + gap, btn_y, step_w, 42),
                icon="step_forward",
            ),
            "reset": Button("Reset", pygame.Rect(x, btn_y + 58, w // 2 - 6, 36)),
            "random": Button("Randomize", pygame.Rect(x + w // 2 + 6, btn_y + 58, w // 2 - 6, 36)),
            "arrows": Button("Toggle Arrows", pygame.Rect(x, btn_y + 112, w // 2 - 6, 36)),
            "about": Button("About", pygame.Rect(x + w // 2 + 6, btn_y + 112, w // 2 - 6, 36)),
        }

        y = btn_y + 200  # extra breathing room below title/buttons
        slider_height = 32
        spacing = 64
        self.sliders = []
        def rect_row(offset):
            return pygame.Rect(x, y + offset, w, slider_height)

        self.length1_slider = Slider("Length 1 (m)", 0.4, 2.5, self.pendulum.L1, rect_row(0), precision=2, step=0.01)
        self.length2_slider = Slider("Length 2 (m)", 0.4, 2.5, self.pendulum.L2, rect_row(spacing), precision=2, step=0.01)
        self.mass1_slider = Slider("Mass 1 (kg)", 0.5, 5.0, self.pendulum.m1, rect_row(spacing * 2), precision=2, step=0.05)
        self.mass2_slider = Slider("Mass 2 (kg)", 0.5, 5.0, self.pendulum.m2, rect_row(spacing * 3), precision=2, step=0.05)
        self.gravity_slider = Slider("Gravity (m/s^2)", 0.5, 25.0, self.pendulum.g, rect_row(spacing * 4), precision=2, step=0.1)
        self.damping_slider = Slider("Damping", 0.0, 0.05, self.pendulum.damping, rect_row(spacing * 5), precision=4, step=0.0005)
        self.time_scale_slider = Slider("Time Scale", 0.25, 3.0, 1.0, rect_row(spacing * 6), precision=2, step=0.05)

        self.sliders.extend([
            self.length1_slider,
            self.length2_slider,
            self.mass1_slider,
            self.mass2_slider,
            self.gravity_slider,
            self.damping_slider,
            self.time_scale_slider,
        ])

    def _handle_mouse(self, event):
        # panel toggle always active
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if self.panel_toggle_rect and self.panel_toggle_rect.collidepoint(event.pos):
                self._toggle_panel()
                return

        # buttons
        if self.about_visible:
            if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                if self.about_close_rect and self.about_close_rect.collidepoint(event.pos):
                    self.about_visible = False
                elif self._about_rect and self._about_rect.collidepoint(event.pos):
                    pass
                else:
                    self.about_visible = False
            return

        # dragging is only allowed while paused
        if self.paused:
            if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                self._begin_drag_if_hit(event.pos)
                if self.dragging_end or self.dragging_mid:
                    return
            elif event.type == pygame.MOUSEMOTION:
                self._drag_update(event.pos)
            elif event.type == pygame.MOUSEBUTTONUP and event.button == 1:
                self.dragging_end = False
                self.dragging_mid = False

        if self.buttons["step_back"].was_clicked(event):
            self._step_frame(direction=-1)
        elif self.buttons["start"].was_clicked(event):
            self.paused = not self.paused
        elif self.buttons["step_forward"].was_clicked(event):
            self._step_frame(direction=1)
        elif self.buttons["reset"].was_clicked(event):
            self._reset_to_defaults()
        elif self.buttons["random"].was_clicked(event):
            self._randomize_sliders_only()
            self.paused = True
            self.sim_time = 0.0
        elif self.buttons.get("arrows") and self.buttons["arrows"].was_clicked(event):
            self.show_arrows = not self.show_arrows
        elif self.buttons.get("about") and self.buttons["about"].was_clicked(event):
            self.about_visible = True

        # sliders
        if self.panel_collapsed:
            return
        for slider in self.sliders:
            slider.handle_event(event)
            if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                if slider.label_rect and slider.label_rect.collidepoint(event.pos):
                    prev = self.active_input_slider
                    self.active_input_slider = slider
                    if prev is not slider or not self.input_buffer:
                        self.input_buffer = f"{slider.value:.{slider.precision}f}"
                    self.input_cursor = len(self.input_buffer)
                    pygame.key.start_text_input()
                    return
                if slider.input_rect and slider.input_rect.collidepoint(event.pos):
                    prev = self.active_input_slider
                    self.active_input_slider = slider
                    if prev is not slider or not self.input_buffer:
                        self.input_buffer = f"{slider.value:.{slider.precision}f}"
                    self.input_cursor = self._cursor_from_click(slider, event.pos)
                    pygame.key.start_text_input()
                    return
        # click outside any input/label clears text entry
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1 and self.active_input_slider:
            hit = False
            for slider in self.sliders:
                if slider.label_rect and slider.label_rect.collidepoint(event.pos):
                    hit = True
                if slider.input_rect and slider.input_rect.collidepoint(event.pos):
                    hit = True
            if not hit:
                self.active_input_slider = None
                self.input_cursor = 0
                pygame.key.stop_text_input()
        self._sync_from_sliders()

    def _cursor_from_click(self, slider, pos):
        if not slider.input_rect:
            return len(self.input_buffer)
        padding = 8
        rel_x = pos[0] - (slider.input_rect.x + padding)
        if rel_x <= 0:
            return 0
        text = self.input_buffer if self.active_input_slider is slider else f"{slider.value:.{slider.precision}f}"
        for i in range(len(text) + 1):
            width, _ = self.font_small.size(text[:i])
            if width >= rel_x:
                return i
        return len(text)

    def _sync_from_sliders(self):
        prev_L1, prev_L2 = self.pendulum.L1, self.pendulum.L2
        self.pendulum.L1 = self.length1_slider.value
        self.pendulum.L2 = self.length2_slider.value
        self.pendulum.m1 = self.mass1_slider.value
        self.pendulum.m2 = self.mass2_slider.value
        self.pendulum.g = self.gravity_slider.value
        self.pendulum.damping = self.damping_slider.value
        self.time_scale = self.time_scale_slider.value
        self.default_damping = self.damping_slider.value
        self.scale = self._compute_scale()
        # reset energy reference when parameters change
        self.pendulum._initial_energy = self.pendulum.energy()
        if self.pendulum.L1 != prev_L1 or self.pendulum.L2 != prev_L2:
            self._reset_trail_with_current()

    def _reset_from_sliders(self, theta1=None, theta2=None):
        self._sync_from_sliders()
        self.pendulum.reset(theta1=theta1, theta2=theta2)
        self.pendulum._initial_energy = self.pendulum.energy()
        self.sim_time = 0.0
        self._reset_trail_with_current()
        self._rewind_in_progress = False

    def _randomize_sliders_only(self):
        # randomize physical parameters but keep angles/positions
        def rand_between(slider):
            slider.value = random.uniform(slider.min_value, slider.max_value)

        for slider in [
            self.length1_slider,
            self.length2_slider,
            self.mass1_slider,
            self.mass2_slider,
            self.gravity_slider,
            self.damping_slider,
            self.time_scale_slider,
        ]:
            rand_between(slider)

        self._sync_from_sliders()
        # keep current angles, zero velocities
        self.pendulum.omega1 = 0.0
        self.pendulum.omega2 = 0.0
        self.pendulum._initial_energy = self.pendulum.energy()
        self._reset_trail_with_current()
        self._rewind_in_progress = False

    def _reset_to_defaults(self):
        self.length1_slider.value = self.defaults["L1"]
        self.length2_slider.value = self.defaults["L2"]
        self.mass1_slider.value = self.defaults["m1"]
        self.mass2_slider.value = self.defaults["m2"]
        self.gravity_slider.value = self.defaults["g"]
        self.damping_slider.value = self.defaults["d"]
        self.time_scale_slider.value = self.defaults["t"]
        self.time_scale = self.defaults["t"]
        self.pendulum.damping = self.defaults["d"]
        self.pendulum.g = self.defaults["g"]
        self._reset_from_sliders(theta1=math.pi / 2, theta2=math.pi / 2)
        self.paused = True
        self.sim_time = 0.0
        self._rewind_in_progress = False

    def _compute_scale(self):
        total_length = self.pendulum.L1 + self.pendulum.L2
        usable_height = self.height - 260
        usable_width = self.render_width - 140
        return 0.75 * min(usable_width, usable_height) / max(total_length, 0.1)

    def _screen_points(self):
        (x1, y1), (x2, y2) = self.pendulum.positions()
        p1 = (int(self.origin[0] + x1 * self.scale), int(self.origin[1] + y1 * self.scale))
        p2 = (int(self.origin[0] + x2 * self.scale), int(self.origin[1] + y2 * self.scale))
        return p1, p2

    def _begin_drag_if_hit(self, pos):
        p1, p2 = self._screen_points()
        if self._dist(pos, p2) < 20:
            self.dragging_end = True
            self.dragging_mid = False
        elif self._dist(pos, p1) < 20:
            self.dragging_mid = True
            self.dragging_end = False

    def _drag_update(self, pos):
        if self.dragging_end:
            self._apply_drag_end(pos)
        elif self.dragging_mid:
            self._apply_drag_mid(pos)
        self._reset_trail_with_current()
        self.pendulum._initial_energy = self.pendulum.energy()
        self._rewind_in_progress = False

    def _apply_drag_mid(self, pos):
        # adjust first joint angle, keep elbow angle constant
        delta = self.pendulum.theta2 - self.pendulum.theta1
        rel = (pos[0] - self.origin[0], pos[1] - self.origin[1])
        theta1 = math.atan2(rel[0], rel[1])
        self.pendulum.theta1 = theta1
        self.pendulum.theta2 = theta1 + delta
        self.pendulum.omega1 = 0.0
        self.pendulum.omega2 = 0.0

    def _apply_drag_end(self, pos):
        # inverse kinematics to place end mass at mouse position
        x = (pos[0] - self.origin[0]) / self.scale
        y = (pos[1] - self.origin[1]) / self.scale
        L1, L2 = self.pendulum.L1, self.pendulum.L2
        r = math.hypot(x, y)
        r = min(max(r, abs(L1 - L2) + 1e-4), L1 + L2 - 1e-4)

        cos_elbow = (r * r - L1 * L1 - L2 * L2) / (2 * L1 * L2)
        cos_elbow = max(-1.0, min(1.0, cos_elbow))
        elbow = math.acos(cos_elbow)

        phi = math.atan2(y, x)
        theta1_x = phi - math.atan2(L2 * math.sin(elbow), L1 + L2 * math.cos(elbow))
        theta2_x = theta1_x + elbow

        self.pendulum.theta1 = math.pi / 2 - theta1_x
        self.pendulum.theta2 = math.pi / 2 - theta2_x
        self.pendulum.omega1 = 0.0
        self.pendulum.omega2 = 0.0

    def _draw_velocity_arrows(self, p1, p2):
        # velocities in world units
        L1, L2 = self.pendulum.L1, self.pendulum.L2
        t1, t2 = self.pendulum.theta1, self.pendulum.theta2
        w1, w2 = self.pendulum.omega1, self.pendulum.omega2

        v1 = (L1 * w1 * math.cos(t1), -L1 * w1 * math.sin(t1))
        v2 = (
            v1[0] + L2 * w2 * math.cos(t2),
            v1[1] - L2 * w2 * math.sin(t2),
        )

        def draw_arrow(origin, vel, color):
            scale = 40  # pixels per (m/s)
            vx, vy = vel[0] * scale, vel[1] * scale
            end = (origin[0] + int(vx), origin[1] + int(vy))
            pygame.draw.line(self.screen, color, origin, end, 3)
            # arrowhead
            angle = math.atan2(vy, vx) if vx or vy else 0
            ah = 10
            left = (
                end[0] - int(ah * math.cos(angle - math.pi / 6)),
                end[1] - int(ah * math.sin(angle - math.pi / 6)),
            )
            right = (
                end[0] - int(ah * math.cos(angle + math.pi / 6)),
                end[1] - int(ah * math.sin(angle + math.pi / 6)),
            )
            pygame.draw.polygon(self.screen, color, [end, left, right])

        draw_arrow(p1, v1, (255, 180, 120))
        draw_arrow(p2, v2, (140, 200, 255))

    def _handle_text_input(self, event):
        if not self.active_input_slider:
            return False
        if event.key == pygame.K_RETURN:
            self._commit_input_buffer()
            return True
        if event.key == pygame.K_ESCAPE:
            self.active_input_slider = None
            self.input_cursor = 0
            pygame.key.stop_text_input()
            return True
        if event.key == pygame.K_LEFT:
            self.input_cursor = max(0, self.input_cursor - 1)
            return True
        if event.key == pygame.K_RIGHT:
            self.input_cursor = min(len(self.input_buffer), self.input_cursor + 1)
            return True
        if event.key == pygame.K_HOME:
            self.input_cursor = 0
            return True
        if event.key == pygame.K_END:
            self.input_cursor = len(self.input_buffer)
            return True
        if event.key == pygame.K_BACKSPACE:
            if self.input_cursor > 0:
                self.input_buffer = self.input_buffer[: self.input_cursor - 1] + self.input_buffer[self.input_cursor :]
                self.input_cursor -= 1
            return True
        if event.key == pygame.K_DELETE:
            if self.input_cursor < len(self.input_buffer):
                self.input_buffer = self.input_buffer[: self.input_cursor] + self.input_buffer[self.input_cursor + 1 :]
            return True
        if event.unicode and (event.unicode.isdigit() or event.unicode in {".", "-"}):
            self.input_buffer = (
                self.input_buffer[: self.input_cursor]
                + event.unicode
                + self.input_buffer[self.input_cursor :]
            )
            self.input_cursor += 1
            return True
        return True

    def _commit_input_buffer(self):
        if not self.active_input_slider:
            return
        try:
            val = float(self.input_buffer)
        except ValueError:
            self.active_input_slider = None
            return
        slider = self.active_input_slider
        val = max(slider.min_value, min(slider.max_value, val))
        if slider.step:
            steps = round((val - slider.min_value) / slider.step)
            val = slider.min_value + steps * slider.step
        slider.value = val
        self.active_input_slider = None
        self.input_cursor = 0
        pygame.key.stop_text_input()
        self._sync_from_sliders()

    @staticmethod
    def _dist(a, b):
        return math.hypot(a[0] - b[0], a[1] - b[1])

    def _initial_size(self):
        info = pygame.display.Info()
        max_w = int(info.current_w * 0.9)
        max_h = int(info.current_h * 0.9)
        width = min(1280, max_w)
        height = min(840, max_h)
        width = max(width, self.panel_width + 480)
        height = max(height, 640)
        return width, height

    def _on_resize(self, w, h):
        # enforce a minimum render area to keep controls readable
        self.width = max(w, self.panel_width + 480)
        self.height = max(h, 640)
        self._auto_collapse(self.width)
        self._update_layout()
        self.screen = pygame.display.set_mode((self.width, self.height), pygame.RESIZABLE)

        # preserve current slider values then rebuild layout to reposition UI
        saved = {
            "L1": self.length1_slider.value,
            "L2": self.length2_slider.value,
            "m1": self.mass1_slider.value,
            "m2": self.mass2_slider.value,
            "g": self.gravity_slider.value,
            "d": self.damping_slider.value,
            "t": self.time_scale_slider.value,
        }

        self._build_controls()

        # restore slider values after rebuilding rects
        self.length1_slider.value = saved["L1"]
        self.length2_slider.value = saved["L2"]
        self.mass1_slider.value = saved["m1"]
        self.mass2_slider.value = saved["m2"]
        self.gravity_slider.value = saved["g"]
        self.damping_slider.value = saved["d"]
        self.time_scale_slider.value = saved["t"]

        self._sync_from_sliders()

    def _auto_collapse(self, w):
        threshold = self.panel_width + 520
        self.panel_collapsed = w < threshold

    def _update_layout(self):
        self.render_width = self.width - (0 if self.panel_collapsed else self.panel_width)
        self.origin = (self.render_width // 2, max(140, int(self.height * 0.18)))
        self.scale = self._compute_scale()

    def _toggle_panel(self):
        self.panel_collapsed = not self.panel_collapsed
        if self.panel_collapsed:
            self.active_input_slider = None
            self.input_cursor = 0
            pygame.key.stop_text_input()
        self._update_layout()

    def _draw_panel(self, panel_rect):
        title = self.font.render("Controls", True, (230, 234, 238))
        self.screen.blit(title, (panel_rect.x + 20, panel_rect.y + 12))

        for key, button in self.buttons.items():
            active = key == "start" and not self.paused
            icon_override = None
            if key == "start":
                icon_override = "pause" if not self.paused else "play"
            button.draw(self.screen, self.font_small, active=active, icon_override=icon_override)

        for slider in self.sliders:
            slider.draw(
                self.screen,
                self.font_small,
                active=slider is self.active_input_slider,
                input_text=self.input_buffer if slider is self.active_input_slider else None,
                cursor_on=(pygame.time.get_ticks() // 500) % 2 == 0 and slider is self.active_input_slider,
                cursor_pos=self.input_cursor if slider is self.active_input_slider else None,
            )

    def _draw_about_popup(self):
        if not self.about_visible:
            return
        overlay = pygame.Surface((self.width, self.height), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 150))
        self.screen.blit(overlay, (0, 0))

        box_w = min(600, self.width - 80)
        box_h = min(600, self.height - 80)
        x = (self.width - box_w) // 2
        y = (self.height - box_h) // 2
        rect = pygame.Rect(x, y, box_w, box_h)
        self._about_rect = rect

        pygame.draw.rect(self.screen, (32, 38, 46), rect, border_radius=14)
        pygame.draw.rect(self.screen, (70, 78, 90), rect, 2, border_radius=14)

        title = self.font.render("Simulation Guide", True, (235, 240, 245))
        self.screen.blit(title, (rect.x + 20, rect.y + 18))

        info_lines = [
            "Hotkeys:",
            "  Space : Start / Pause simulation",
            "  R     : Reset all parameters to defaults",
            "  N     : Randomize initial conditions",
            "  T     : Toggle motion trail visibility",
            "  C     : Clear current trail history",
            "  E     : Toggle energy / drift display",
            "  D     : Toggle damping (friction)",
            "  S     : Cycle time scale (0.25x - 2.0x)",
            "  +/-   : Increase / Decrease gravity",
            "",
            "Mouse Controls:",
            "  Drag  : Move masses (only when paused)",
            "          - End mass: Inverse Kinematics",
            "          - Mid mass: Adjust angle",
            "  Click : Edit slider values directly",
            "  Panel : Toggle control panel visibility",
            "",
            "UI Buttons:",
            "  Step  : Frame-by-frame (when paused)",
            "  Arrows: Toggle velocity vectors"
        ]

        y_text = rect.y + 60
        for line in info_lines:
            if not line.strip():
                y_text += 12
                continue
            color = (210, 216, 224)
            if line.endswith(":") and not line.startswith(" "):
                 color = (96, 128, 255)
            
            surf = self.font_small.render(line, True, color)
            self.screen.blit(surf, (rect.x + 28, y_text))
            y_text += 22

        close_rect = pygame.Rect(rect.centerx - 70, rect.bottom - 50, 140, 36)
        self.about_close_rect = close_rect
        pygame.draw.rect(self.screen, (96, 128, 255), close_rect, border_radius=10)
        pygame.draw.rect(self.screen, (30, 34, 40), close_rect, 2, border_radius=10)
        close_text = self.font.render("Close", True, (245, 248, 252))
        close_rect_text = close_text.get_rect(center=close_rect.center)
        self.screen.blit(close_text, close_rect_text)

    def _draw_panel_toggle(self):
        # icon-only vertical tab that sits along the sidebar edge
        tab_w = 28
        tab_h = 96
        y = (self.height - tab_h) // 2
        if self.panel_collapsed:
            x = self.width - tab_w - 6
        else:
            x = self.render_width - tab_w // 2

        rect = pygame.Rect(x, y, tab_w, tab_h)
        self.panel_toggle_rect = rect
        color = (96, 128, 255) if self.panel_collapsed else (70, 78, 90)
        pygame.draw.rect(self.screen, color, rect, border_radius=12)
        pygame.draw.rect(self.screen, (30, 34, 40), rect, 2, border_radius=12)

        # arrow icon
        cx = rect.centerx
        cy = rect.centery
        if self.panel_collapsed:
            pts = [(cx - 4, cy), (cx + 8, cy - 14), (cx + 8, cy + 14)]
        else:
            pts = [(cx + 4, cy), (cx - 8, cy - 14), (cx - 8, cy + 14)]
        pygame.draw.polygon(self.screen, (245, 248, 252), pts)


if __name__ == "__main__":
    Simulator().run()

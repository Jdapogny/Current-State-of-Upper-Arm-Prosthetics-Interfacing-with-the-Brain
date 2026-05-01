/**
 * Side-by-side planar 2-link arm IK:
 * Left = ideal biological tracking
 * Right = lag + noise + speed limit + quantized target (thought-controlled prosthesis metaphor)
 */

(function () {
  const canvas = document.getElementById("simCanvas");
  const ctx = canvas.getContext("2d");

  const showIntentEl = document.getElementById("showIntent");
  const singleArmEl = document.getElementById("singleArmMode");
  const resetBtn = document.getElementById("resetBtn");

  const lagSlider = document.getElementById("lag");
  const noiseSlider = document.getElementById("noise");
  const speedSlider = document.getElementById("speed");
  const quantSlider = document.getElementById("quantize");

  const lagVal = document.getElementById("lagVal");
  const noiseVal = document.getElementById("noiseVal");
  const speedVal = document.getElementById("speedVal");
  const quantVal = document.getElementById("quantizeVal");

  function getDevelopmentProfile() {
    const el = document.querySelector('input[name="devProfile"]:checked');
    return el && el.value === "congenital" ? "congenital" : "acquired";
  }

  document.querySelectorAll('input[name="devProfile"]').forEach((r) => {
    r.addEventListener("change", () => {
      filtX = mouse.x;
      filtY = mouse.y;
    });
  });

  const COLORS = {
    natural: "#5fd39a",
    prosthetic: "#7c9eff",
    joint: "#dce6ef",
    bone: "rgba(232, 238, 244, 0.85)",
    target: "#e8a838",
    arena: "rgba(255,255,255,0.04)",
  };

  const L1 = 110;
  const L2 = 95;

  let W = 920;
  let H = 420;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  /** @type {{x:number,y:number}|null} */
  let mouse = { x: W * 0.55, y: H * 0.45 };

  // Filtered target for prosthetic (lag)
  let filtX = mouse.x;
  let filtY = mouse.y;

  // Current joint angles (rad) — shoulder, elbow for each arm
  const natural = { shoulder: 0.9, elbow: 1.8 };
  const prosthetic = { shoulder: 0.9, elbow: 1.8 };

  function shoulderBase(side) {
    const cy = H * 0.62;
    if (singleArmEl.checked) {
      return { x: W / 2, y: cy };
    }
    const margin = W * 0.08;
    const cx = side === "natural" ? margin + L1 * 0.35 : W - margin - L1 * 0.35;
    return { x: cx, y: cy };
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  /**
   * Planar 2-link IK; elbow "up" solution
   */
  function ik(tx, ty, baseX, baseY) {
    const dx = tx - baseX;
    const dy = ty - baseY;
    let dist = Math.hypot(dx, dy);
    const maxReach = L1 + L2 - 0.001;
    if (dist > maxReach) {
      const s = maxReach / dist;
      const nx = baseX + dx * s;
      const ny = baseY + dy * s;
      dist = maxReach;
      tx = nx;
      ty = ny;
    }
    const nx = tx - baseX;
    const ny = ty - baseY;
    dist = Math.hypot(nx, ny);
    const minReach = Math.abs(L1 - L2) + 0.001;
    if (dist < minReach) dist = minReach;

    const a = (nx * nx + ny * ny + L1 * L1 - L2 * L2) / (2 * L1 * dist);
    const ac = clamp(a, -1, 1);
    const alpha = Math.atan2(ny, nx);
    const beta = Math.acos(ac);
    const shoulder = alpha + beta;
    const elbowInner =
      (nx * nx + ny * ny - L1 * L1 - L2 * L2) / (2 * L1 * L2);
    const elbow = Math.PI - Math.acos(clamp(elbowInner, -1, 1));
    return { shoulder, elbow };
  }

  function fk(shoulder, elbow, baseX, baseY) {
    const ex = baseX + L1 * Math.cos(shoulder);
    const ey = baseY + L1 * Math.sin(shoulder);
    const hx = ex + L2 * Math.cos(shoulder + elbow - Math.PI);
    const hy = ey + L2 * Math.sin(shoulder + elbow - Math.PI);
    return { elbowX: ex, elbowY: ey, handX: hx, handY: hy };
  }

  function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }

  function quantizeTarget(px, py, amount01) {
    if (amount01 <= 0.001) return { x: px, y: py };
    const grid = 8 + Math.round(amount01 * 36);
    return {
      x: Math.round(px / grid) * grid,
      y: Math.round(py / grid) * grid,
    };
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 8) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mouse.x = clamp(mouse.x, 12, W - 12);
    mouse.y = clamp(mouse.y, 12, H - 12);
    filtX = mouse.x;
    filtY = mouse.y;
  }

  function drawArm(side, shoulder, elbow, color, label) {
    const base = shoulderBase(side);
    const fkout = fk(shoulder, elbow, base.x, base.y);

    ctx.strokeStyle = COLORS.bone;
    ctx.lineWidth = side === "natural" ? 5 : 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(fkout.elbowX, fkout.elbowY);
    ctx.lineTo(fkout.handX, fkout.handY);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // joints
    [base, { x: fkout.elbowX, y: fkout.elbowY }, { x: fkout.handX, y: fkout.handY }].forEach(
      (p, i) => {
        ctx.beginPath();
        ctx.fillStyle = i === 2 ? color : COLORS.joint;
        ctx.arc(p.x, p.y, i === 2 ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();
      }
    );

    ctx.font = "600 11px DM Sans, sans-serif";
    ctx.fillStyle = "rgba(232,238,244,0.55)";
    ctx.fillText(label, base.x - 28, base.y + L1 + L2 + 22);
  }

  function drawSplitLine() {
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2, 16);
    ctx.lineTo(W / 2, H - 16);
    ctx.stroke();
  }

  function drawLabels() {
    ctx.font = "600 13px DM Sans, sans-serif";
    ctx.fillStyle = "rgba(232,238,244,0.9)";
    if (singleArmEl.checked) {
      ctx.textAlign = "center";
      ctx.fillText("Thought-controlled prosthesis", W / 2, 28);
      ctx.textAlign = "left";
      return;
    }
    ctx.fillText("Biological control", 18, 28);
    ctx.textAlign = "right";
    ctx.fillText("Thought-controlled prosthesis", W - 18, 28);
    ctx.textAlign = "left";
  }

  function updateSliderLabels() {
    lagVal.textContent = `${lagSlider.value}%`;
    noiseVal.textContent = `${noiseSlider.value}%`;
    speedVal.textContent = `${speedSlider.value}%`;
    quantVal.textContent = `${quantSlider.value}%`;
  }

  let lastT = performance.now();

  function tick(now) {
    const dt = clamp((now - lastT) / 1000, 0, 0.05);
    lastT = now;

    const profile = getDevelopmentProfile();

    let lag01 = lagSlider.value / 100;
    let noise01 = noiseSlider.value / 100;
    const speed01 = speedSlider.value / 100;
    let quant01 = quantSlider.value / 100;

    let speedMult = 1;
    if (profile === "congenital") {
      lag01 = clamp(lag01 * 1.14, 0, 1);
      noise01 = clamp(noise01 * 1.22, 0, 1);
      quant01 = clamp(quant01 * 1.12, 0, 1);
      speedMult = 0.9;
    } else {
      lag01 = clamp(lag01 * 0.84, 0, 1);
      noise01 = clamp(noise01 * 0.78, 0, 1);
      quant01 = clamp(quant01 * 0.88, 0, 1);
      speedMult = 1.08;
    }

    const alpha = 1 - Math.pow(1 - 0.08, 3 + lag01 * 25);
    filtX += (mouse.x - filtX) * alpha;
    filtY += (mouse.y - filtY) * alpha;

    const q = quantizeTarget(filtX, filtY, quant01);
    const jitter =
      noise01 *
      14 *
      (Math.sin(now * 0.0091) * Math.cos(now * 0.0073 + 1.2) +
        Math.sin(now * 0.011 + 0.5));

    let nx = q.x + jitter;
    let ny = q.y + jitter * 0.85;

    if (profile === "congenital") {
      const hunt =
        17 * Math.sin(now * 0.0026 + mouse.x * 0.014) +
        9 * Math.sin(now * 0.0041);
      const huntY =
        13 * Math.cos(now * 0.0021 + mouse.y * 0.011) +
        7 * Math.cos(now * 0.0033 + 0.7);
      nx += hunt;
      ny += huntY;
    }

    const noisyTarget = { x: nx, y: ny };

    const baseNat = shoulderBase("natural");
    const basePro = shoulderBase("prosthetic");

    const idealNat = ik(mouse.x, mouse.y, baseNat.x, baseNat.y);
    const idealPro = ik(noisyTarget.x, noisyTarget.y, basePro.x, basePro.y);

    const maxSpeedNat = 9 * speed01 + 6;
    const maxSpeedPro = (2.2 + speed01 * 3.6) * speedMult;

    function stepAngles(current, ideal, maxRadPerSec) {
      let ds = angleDiff(current.shoulder, ideal.shoulder);
      let de = angleDiff(current.elbow, ideal.elbow);
      const step = maxRadPerSec * dt;
      ds = clamp(ds, -step, step);
      de = clamp(de, -step, step);
      return {
        shoulder: current.shoulder + ds,
        elbow: current.elbow + de,
      };
    }

    if (!singleArmEl.checked) {
      Object.assign(natural, stepAngles(natural, idealNat, maxSpeedNat));
    }
    Object.assign(prosthetic, stepAngles(prosthetic, idealPro, maxSpeedPro));

    ctx.clearRect(0, 0, W, H);

    drawLabels();
    if (!singleArmEl.checked) drawSplitLine();

    if (showIntentEl.checked) {
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.target;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.target;
      ctx.fill();
    }

    const proCaption =
      profile === "congenital"
        ? "Congenital motor profile — same device"
        : "Acquired (later life) profile — same device";

    if (!singleArmEl.checked) {
      drawArm("natural", natural.shoulder, natural.elbow, COLORS.natural, "Instant feedback path");
      drawArm(
        "prosthetic",
        prosthetic.shoulder,
        prosthetic.elbow,
        COLORS.prosthetic,
        `${proCaption} · decode → motor`
      );
    } else {
      drawArm(
        "prosthetic",
        prosthetic.shoulder,
        prosthetic.elbow,
        COLORS.prosthetic,
        `${proCaption}`
      );
    }

    requestAnimationFrame(tick);
  }

  function clientToCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  canvas.addEventListener("mousemove", (e) => {
    const p = clientToCanvas(e.clientX, e.clientY);
    mouse.x = clamp(p.x, 12, W - 12);
    mouse.y = clamp(p.y, 12, H - 12);
  });

  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const p = clientToCanvas(t.clientX, t.clientY);
      mouse.x = clamp(p.x, 12, W - 12);
      mouse.y = clamp(p.y, 12, H - 12);
    },
    { passive: false }
  );

  canvas.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    const p = clientToCanvas(t.clientX, t.clientY);
    mouse.x = clamp(p.x, 12, W - 12);
    mouse.y = clamp(p.y, 12, H - 12);
  });

  [
    lagSlider,
    noiseSlider,
    speedSlider,
    quantSlider,
  ].forEach((el) => el.addEventListener("input", updateSliderLabels));

  resetBtn.addEventListener("click", () => {
    natural.shoulder = 0.9;
    natural.elbow = 1.8;
    prosthetic.shoulder = 0.9;
    prosthetic.elbow = 1.8;
    filtX = mouse.x;
    filtY = mouse.y;
  });

  window.addEventListener("resize", resize);
  window.addEventListener("load", () => {
    resize();
    mouse = { x: W * 0.55, y: H * 0.42 };
    filtX = mouse.x;
    filtY = mouse.y;
  });

  resize();
  updateSliderLabels();
  requestAnimationFrame(tick);
})();

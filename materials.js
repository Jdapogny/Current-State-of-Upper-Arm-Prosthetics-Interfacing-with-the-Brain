/**
 * Illustrative material properties for educational comparison only.
 */
(function () {
  /** @type {typeof document.querySelector} */
  const $ = (sel) => document.querySelector(sel);

  const MATERIALS = [
    {
      id: "pla",
      name: "PLA — desktop 3D printing",
      strength: 28,
      brittle: true,
      costMin: 18,
      costMax: 28,
      typicalUse: "Experimental/cosmetic fingers, quick-fit prototypes",
      scienceNote: "Low temperature resistance; layer bonds are often the weak point.",
    },
    {
      id: "abs",
      name: "ABS — 3D printing / thermoforming",
      strength: 30,
      brittle: false,
      costMin: 16,
      costMax: 26,
      typicalUse: "Durable hobby prints; some socket liners use related polymers",
      scienceNote: "Tougher than PLA for impacts; still limited vs metals.",
    },
    {
      id: "petg",
      name: "PETG — 3D printing",
      strength: 34,
      brittle: false,
      costMin: 20,
      costMax: 30,
      typicalUse: "More ductile prints; moisture-resistant hobby components",
      scienceNote: "Often chosen when some flexibility and clarity matter.",
    },
    {
      id: "nylon",
      name: "Nylon (PA12) — SLS / selective laser sintering",
      strength: 52,
      brittle: false,
      costMin: 55,
      costMax: 120,
      typicalUse: "Functional test sockets and complex lightweight brackets",
      scienceNote: "Stronger and tougher than basic FDM plastics; powder process adds cost.",
    },
    {
      id: "al6061",
      name: "Aluminum 6061 — machined structural parts",
      strength: 74,
      brittle: false,
      costMin: 8,
      costMax: 18,
      typicalUse: "Terminal devices, adapters, pylons (machining & finishing add cost)",
      scienceNote: "High stiffness-to-weight; yields/plastically deforms before snapping.",
    },
    {
      id: "ti64",
      name: "Titanium Ti-6Al-4V — high-performance hardware",
      strength: 91,
      brittle: false,
      costMin: 85,
      costMax: 180,
      typicalUse: "Implant-grade fixtures, lightweight highly loaded connectors",
      scienceNote: "Excellent strength and corrosion resistance; expensive raw stock & machining.",
    },
    {
      id: "cfrp",
      name: "Carbon fiber epoxy composite — laminated layups",
      strength: 97,
      brittle: true,
      costMin: 120,
      costMax: 450,
      typicalUse: "High-end feet/pylons where stiffness and weight dominate",
      scienceNote: "Extremely direction-dependent; interlaminar shear can fail before fibers.",
    },
  ];

  const select = $("#matSelect");
  const statsEl = $("#matStats");
  const loadSlider = $("#loadSlider");
  const loadPct = $("#loadPct");
  const statusEl = $("#matStatus");
  const impactBtn = $("#impactBtn");
  const repairBtn = $("#repairBtn");
  const canvas = $("#beamCanvas");
  if (!canvas || !select) return;

  const ctx = canvas.getContext("2d");

  let broken = false;
  let impactBoost = 0;
  let ductileYield = false;
  let beamW = 0;
  let beamH = 0;

  function midCost(m) {
    return Math.round((m.costMin + m.costMax) / 2);
  }

  function populateSelect() {
    select.innerHTML = "";
    MATERIALS.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      select.appendChild(opt);
    });
  }

  function renderCostBars() {
    const host = $("#costBars");
    if (!host) return;
    const costs = MATERIALS.map((m) => ({ m, mid: midCost(m) }));
    const maxC = Math.max(...costs.map((c) => c.mid), 1);
    host.innerHTML = "";
    costs
      .sort((a, b) => a.mid - b.mid)
      .forEach(({ m, mid }) => {
        const row = document.createElement("div");
        row.className = "cost-row";
        const pct = Math.round((mid / maxC) * 100);
        row.innerHTML = `
          <span>${m.name.split(" — ")[0]}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
          <span class="price">~$${m.costMin}–${m.costMax}/kg</span>
        `;
        host.appendChild(row);
      });
  }

  function currentMat() {
    return MATERIALS.find((m) => m.id === select.value) || MATERIALS[0];
  }

  function updateStats() {
    const m = currentMat();
    statsEl.innerHTML = `
      <strong>Illustrative strength index:</strong> ${m.strength}/100 &nbsp;·&nbsp;
      <strong>Behavior:</strong> ${m.brittle ? "tends toward sudden fracture" : "more ductile deformation"}<br/>
      <strong>Typical roles:</strong> ${m.typicalUse}<br/>
      <em>${m.scienceNote}</em>
    `;
  }

  function beamSize() {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w < 4 || h < 4) return { w: beamW || 440, h: beamH || 200 };
    if (Math.abs(w - beamW) > 0.5 || Math.abs(h - beamH) > 0.5) {
      beamW = w;
      beamH = h;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { w: beamW, h: beamH };
  }

  function drawBeam(w, h, stressRatio, m) {
    ctx.clearRect(0, 0, w, h);

    const pad = 28;
    const y0 = h * 0.45;
    const x0 = pad;
    const x1 = w - pad;

    const bendMax = h * 0.22;
    const bend = bendMax * Math.min(stressRatio, m.brittle ? 1 : 1.35);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + 60);
    ctx.lineTo(x1, y0 + 60);
    ctx.stroke();

    ctx.fillStyle = "rgba(154,172,188,0.45)";
    ctx.font = "500 11px DM Sans, sans-serif";
    ctx.fillText("Wall anchor", x0 - 6, y0 + 74);
    ctx.fillText("Hand / payload load →", x1 - 130, y0 - 42);

    const fillGrad = ctx.createLinearGradient(x0, 0, x1, 0);
    fillGrad.addColorStop(0, m.brittle ? "#6b8cff" : "#5fd39a");
    fillGrad.addColorStop(1, m.brittle ? "#9fb4ff" : "#8aebc0");

    ctx.lineWidth = 12;
    ctx.lineCap = "round";

    if (broken && m.brittle) {
      const xm = (x0 + x1) / 2;
      const ym = y0 + bend * 0.5;
      ctx.strokeStyle = "rgba(232,238,244,0.35)";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(xm - 18, ym + 14, xm - 26, ym + 38);
      ctx.stroke();
      ctx.strokeStyle = "#ff6b6b";
      ctx.beginPath();
      ctx.moveTo(xm - 22, ym + 34);
      ctx.lineTo(xm + 10, ym + 22);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(xm + 22, ym + 18);
      ctx.quadraticCurveTo(xm + 55, ym - 10, x1 - 10, y0 + 8);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,107,107,0.35)";
      ctx.fillText("Fracture — brittle failure", xm - 52, ym + 62);
    } else if (broken && !m.brittle) {
      const xm = (x0 + x1) / 2 + 30;
      ctx.strokeStyle = "#ff9f43";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(xm, y0 + bend * 1.4, x1, y0 + bend * 1.3);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,159,67,0.6)";
      ctx.fillText("Plastic collapse / yield exceeded", x0 + 10, y0 + bend * 1.3 + 38);
    } else {
      ctx.strokeStyle = fillGrad;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2, y0 + bend, x1, y0 + bend * 0.35);
      ctx.stroke();

      ctx.fillStyle = "#e8a838";
      ctx.beginPath();
      ctx.arc(x1, y0 + bend * 0.35, 8, 0, Math.PI * 2);
      ctx.fill();

      const gaugeX = pad;
      const gaugeY = h - 36;
      const gaugeW = w - pad * 2;
      const gaugeH = 8;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(gaugeX, gaugeY, gaugeW, gaugeH);
      const gr = Math.min(stressRatio, 1.25);
      const hue = gr < 0.75 ? 160 : gr < 1 ? 42 : 8;
      ctx.fillStyle = `hsl(${hue}, 78%, 52%)`;
      ctx.fillRect(gaugeX, gaugeY, gaugeW * Math.min(gr, 1), gaugeH);

      ctx.fillStyle = "rgba(232,238,244,0.75)";
      ctx.font = "600 11px JetBrains Mono, monospace";
      ctx.fillText(`${Math.round(Math.min(stressRatio, 999) * 100)}% of illustrative strength`, gaugeX + gaugeW - 190, gaugeY - 8);
    }
  }

  function tick() {
    const m = currentMat();
    const baseLoad = Number(loadSlider.value);
    impactBoost *= 0.94;
    if (impactBoost < 0.3) impactBoost = 0;

    const totalLoad = baseLoad + impactBoost;
    const stressRatio = totalLoad / Math.max(m.strength, 1);

    loadPct.textContent = `${Math.round(baseLoad)}% slider + ${Math.round(impactBoost)}% spike`;

    if (!broken) {
      if (!m.brittle && stressRatio >= 0.92 && stressRatio < 1) {
        ductileYield = true;
        statusEl.className = "mat-status warn";
        statusEl.textContent =
          "Yield region — permanent bending can occur in metals / ductile polymers (simulated).";
      } else if (!ductileYield || stressRatio < 0.85) {
        ductileYield = false;
      }

      if (m.brittle && stressRatio >= 1) {
        broken = true;
        statusEl.className = "mat-status fail";
        statusEl.textContent =
          "Failure: brittle material exceeded illustrative strength — crack propagation (simulation).";
      } else if (!m.brittle && stressRatio >= 1.08) {
        broken = true;
        statusEl.className = "mat-status fail";
        statusEl.textContent =
          "Failure: plastic collapse / oversized bending beyond illustrative limit (simulation).";
      } else if (stressRatio < 0.55) {
        statusEl.className = "mat-status ok";
        statusEl.textContent = "Elastic-like bending range — reduce load to compare materials.";
      } else if (stressRatio < 1) {
        statusEl.className = "mat-status warn";
        statusEl.textContent = m.brittle
          ? "High stress — brittle materials risk sudden fracture."
          : "Approaching yield — ductile materials bend permanently before breaking.";
      }
    }

    const { w, h } = beamSize();
    drawBeam(w, h, broken ? 1.25 : stressRatio, m);
    requestAnimationFrame(tick);
  }

  select.addEventListener("change", () => {
    broken = false;
    ductileYield = false;
    impactBoost = 0;
    updateStats();
  });

  loadSlider.addEventListener("input", () => {
    if (!broken) {
      /* live updates in tick */
    }
  });

  impactBtn.addEventListener("click", () => {
    if (!broken) impactBoost += 38;
  });

  repairBtn.addEventListener("click", () => {
    broken = false;
    ductileYield = false;
    impactBoost = 0;
    loadSlider.value = "0";
  });

  window.addEventListener("resize", () => {
    beamW = 0;
    beamH = 0;
  });

  populateSelect();
  renderCostBars();
  updateStats();
  requestAnimationFrame(tick);
})();

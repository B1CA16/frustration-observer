// Demo wiring.
//
// The left of the page is an ordinary checkout screen with two controls that
// do nothing. The right is the inspector, which is the only part that knows
// this library exists.
//
// The gauges re-implement each detector's timing in miniature. That is
// deliberate: the library reports interactions, not progress towards them, and
// it should stay that way. Streaming internal state would be a bigger library
// for one page's benefit.

import {
  createInteractionObserver,
  type InteractionEvent,
  type InteractionObserverOptions,
  type InteractionType,
} from "interaction-observer";

import "./style.css";

const CONFIG = {
  rageClick: { clicks: 3, interval: 1000, radius: 30 },
  hesitation: { threshold: 2000 },
  // The inspector redraws itself constantly, and every change looks like the
  // page reacting to a click. Without this, no dead click could ever survive.
  deadClick: { timeout: 1000, ignore: "[data-io-ignore]" },
} satisfies InteractionObserverOptions;

const SIGNAL: Record<InteractionType, string> = {
  rageclick: "rage",
  hesitation: "hesitate",
  deadclick: "dead",
};

const TITLE: Record<InteractionType, string> = {
  rageclick: "Rage click",
  hesitation: "Hesitation",
  deadclick: "Dead click",
};

// Idle gauges double as the instructions: a visitor who has not touched
// anything yet still learns what each detector is looking for.
const IDLE = {
  rage: "click one thing 3 times, fast",
  hesitate: "hover anything for 2 seconds",
  dead: "press Apply, it is broken",
};

function need<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`demo: no element with id "${id}"`);
  return node as T;
}

const feed = need<HTMLOListElement>("feed");
const feedEmpty = need("feed-empty");
const tally = need("tally");

const rageDots = need("rage-dots");
const rageReadout = need("rage-readout");
const hesitateFill = need("hesitate-fill");
const hesitateReadout = need("hesitate-readout");
const deadFill = need("dead-fill");
const deadReadout = need("dead-readout");

const rageGauge = rageReadout.closest(".gauge") as HTMLElement;
const hesitateGauge = hesitateReadout.closest(".gauge") as HTMLElement;
const deadGauge = deadReadout.closest(".gauge") as HTMLElement;

const observed = [
  need("plan"),
  need("apply"),
  need("purchase"),
  need("save"),
  need("support"),
];

// ------------------------------------------------------------------- feed

let detected = 0;

function icon(type: InteractionType, className: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");

  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#icon-${SIGNAL[type]}`);
  svg.append(use);

  return svg;
}

function facts(event: InteractionEvent): string {
  switch (event.type) {
    case "rageclick":
      return `${event.clicks} clicks, ${event.duration}ms, ${Math.round(event.radius)}px`;
    case "hesitation":
      return `${(event.duration / 1000).toFixed(1)}s without acting`;
    case "deadclick":
      return `nothing changed in ${event.timeout}ms`;
  }
}

function record(event: InteractionEvent): void {
  feedEmpty.remove();

  const item = document.createElement("li");
  item.className = "event";
  item.dataset.signal = SIGNAL[event.type];

  const title = document.createElement("p");
  title.className = "event__title";
  title.append(TITLE[event.type]);

  const time = document.createElement("span");
  time.className = "event__time";
  time.textContent = new Date(event.timestamp).toLocaleTimeString();
  title.append(time);

  const detail = document.createElement("p");
  detail.className = "event__facts";

  const target = document.createElement("span");
  target.className = "event__target";
  target.textContent =
    event.target.getAttribute("data-label") ?? event.target.tagName;
  detail.append(target, `, ${facts(event)}`);

  item.append(icon(event.type, "event__icon"), title, detail);
  feed.prepend(item);

  // Three is enough to show a pattern, and keeps the inspector shorter than
  // the page it is watching, which is what lets it stay sticky.
  while (feed.children.length > 3) feed.lastElementChild?.remove();

  detected += 1;
  tally.textContent = `${detected} detected`;
}

function setState(gauge: HTMLElement, state: "live" | "hit" | null): void {
  if (state === null) delete gauge.dataset.state;
  else gauge.dataset.state = state;
}

// ---------------------------------------------------------------- library

const observer = createInteractionObserver(CONFIG);

observer.on("rageclick", (event) => {
  record(event);
  setState(rageGauge, "hit");
  rageReadout.textContent = `${event.clicks} clicks reported`;
  window.setTimeout(() => {
    setState(rageGauge, null);
    rageReadout.textContent = IDLE.rage;
  }, 2500);
});

observer.on("hesitation", (event) => {
  record(event);
  setState(hesitateGauge, "hit");
  hesitateReadout.textContent = `${(event.duration / 1000).toFixed(1)}s reported`;
});

observer.on("deadclick", (event) => {
  record(event);
  watching = null;
  deadFill.style.width = "100%";
  setState(deadGauge, "hit");
  deadReadout.textContent = "dead, nothing happened";
  window.setTimeout(restoreDeadGauge, 2500);
});

function restoreDeadGauge(): void {
  if (watching !== null) return;
  setState(deadGauge, null);
  deadFill.style.width = "0%";
  deadReadout.textContent = IDLE.dead;
}

for (const target of observed) observer.observe(target);

// ----------------------------------------------------------------- gauges

let frame = 0;

function schedule(): void {
  if (frame === 0) frame = requestAnimationFrame(tick);
}

/** Clicks per element, mirroring the detector's rolling window. */
const windows = new Map<Element, number[]>();
let lastClicked: Element | null = null;

for (let i = 0; i < CONFIG.rageClick.clicks; i += 1) {
  const dot = document.createElement("span");
  dot.className = "dot";
  rageDots.append(dot);
}

function drawRage(now: number): boolean {
  const clicks = (lastClicked && windows.get(lastClicked)) || [];
  const live = clicks.filter((time) => now - time <= CONFIG.rageClick.interval);
  if (lastClicked) windows.set(lastClicked, live);

  const lit = Math.min(live.length, CONFIG.rageClick.clicks);
  rageDots.childNodes.forEach((dot, index) => {
    if (dot instanceof HTMLElement) dot.dataset.lit = String(index < lit);
  });

  if (rageGauge.dataset.state !== "hit") {
    setState(rageGauge, live.length > 0 ? "live" : null);
    if (live.length === 0) {
      rageReadout.textContent = IDLE.rage;
    } else {
      rageReadout.textContent =
        live.length > CONFIG.rageClick.clicks
          ? `${live.length} clicks in the window`
          : `${live.length} of ${CONFIG.rageClick.clicks} clicks in the window`;
    }
  }

  return live.length > 0;
}

let dwellStart: number | null = null;

function endDwell(): void {
  dwellStart = null;
  setState(hesitateGauge, null);
  hesitateFill.style.width = "0%";
  hesitateReadout.textContent = IDLE.hesitate;
}

function drawHesitation(now: number): boolean {
  if (dwellStart === null) return false;

  const elapsed = now - dwellStart;
  hesitateFill.style.width = `${Math.min(elapsed / CONFIG.hesitation.threshold, 1) * 100}%`;

  if (hesitateGauge.dataset.state !== "hit") {
    setState(hesitateGauge, "live");
    hesitateReadout.textContent = `${(elapsed / 1000).toFixed(1)}s of ${(CONFIG.hesitation.threshold / 1000).toFixed(1)}s`;
  }

  // Runs slightly past the threshold so the detector reports first.
  return elapsed < CONFIG.hesitation.threshold + 200;
}

let watching: { start: number } | null = null;

function drawDead(now: number): boolean {
  if (watching === null) return false;

  const elapsed = now - watching.start;
  const capped = Math.min(elapsed, CONFIG.deadClick.timeout);
  deadFill.style.width = `${(capped / CONFIG.deadClick.timeout) * 100}%`;

  // The grace period matters: this loop and the detector's own timer expire in
  // the same millisecond, and guessing first would flash the wrong verdict.
  if (elapsed < CONFIG.deadClick.timeout + 200) {
    setState(deadGauge, "live");
    deadReadout.textContent = `watching, ${(capped / 1000).toFixed(1)}s`;
    return true;
  }

  // Still waiting after the timeout means the check was cancelled, which only
  // happens when something on the page actually changed.
  watching = null;
  setState(deadGauge, null);
  deadReadout.textContent = "the page changed, not dead";
  deadFill.style.width = "0%";
  window.setTimeout(restoreDeadGauge, 2500);
  return false;
}

function tick(): void {
  frame = 0;
  const now = performance.now();

  const rage = drawRage(now);
  const hesitation = drawHesitation(now);
  const dead = drawDead(now);

  if (rage || hesitation || dead) schedule();
}

// Every observed control feeds the gauges, so the inspector always describes
// whatever the visitor just touched.
for (const target of observed) {
  target.addEventListener("click", () => {
    lastClicked = target;
    const clicks = windows.get(target) ?? [];
    clicks.push(performance.now());
    windows.set(target, clicks);

    setState(rageGauge, null);
    setState(deadGauge, null);
    watching = { start: performance.now() };
    endDwell();
    schedule();
  });

  target.addEventListener("pointerenter", () => {
    dwellStart = performance.now();
    setState(hesitateGauge, null);
    schedule();
  });

  target.addEventListener("pointerleave", endDwell);
}

// --------------------------------------------------------- page behaviour

const saved = need("saved");

need("save").addEventListener("click", () => {
  // A real change to the page, outside the ignored inspector. This is what a
  // working control does, and why it is never reported as a dead click.
  saved.textContent = `Saved at ${new Date().toLocaleTimeString()}`;
});

const install = need("install");

install.addEventListener("click", () => {
  navigator.clipboard
    ?.writeText(install.textContent ?? "")
    .then(() => {
      install.dataset.copied = "true";
      window.setTimeout(() => delete install.dataset.copied, 1200);
    })
    .catch(() => {
      // Clipboard access can be refused. The command is still readable.
    });
});

endDwell();
drawRage(performance.now());

// Built from CONFIG so the page cannot document thresholds it is not using.
// Only numbers from that object are interpolated.
need("code").innerHTML = `<b>import</b> {
  createInteractionObserver,
} <b>from</b> "interaction-observer";

<b>const</b> observer = createInteractionObserver({
  rageClick: { clicks: <i>${CONFIG.rageClick.clicks}</i>, interval: <i>${CONFIG.rageClick.interval}</i> },
  hesitation: { threshold: <i>${CONFIG.hesitation.threshold}</i> },
  deadClick: {
    timeout: <i>${CONFIG.deadClick.timeout}</i>,
    ignore: "[data-io-ignore]",
  },
});

observer.on("rageclick", (event) =&gt; {
  console.log(event.clicks, event.duration);
});

observer.observe(purchaseButton);`;

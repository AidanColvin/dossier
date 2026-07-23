"use client";

// the home page orbit: nodes drifting through genuine 3d space, with
// connections that continuously break and re-form between whichever nodes
// are currently nearest - and the occasional node "firing," a slow flash
// that spreads along its live connections. the same idea the app is built
// on, made visible: a shifting web of relations, not a fixed diagram. no
// three.js, no canvas; a handful of svg elements whose attributes are
// written directly on every frame from real 3d coordinates.
//
// the shape itself is never rigid. each node has a fixed anchor point on a
// fibonacci sphere (the standard construction for spreading points evenly
// over a sphere's surface, so the cluster starts out as a solid cloud
// rather than a flat scatter), but every frame it also wanders away from
// that anchor along its own independent, out-of-phase path - a different
// speed and direction on every axis, so no two nodes move alike and the
// cluster's outline keeps deforming rather than repeating. a plain
// rotation would preserve every distance between every pair of points
// exactly (rotation cannot change the shape of a rigid body), which is
// why an earlier version's connections never actually changed even though
// they were recomputed every frame; the independent wander is what makes
// the nearest-neighbor graph genuinely different from moment to moment.
// the whole wandering cloud is then rotated around two axes for the
// tumble, and perspective-projected: nodes on the near side land larger
// and brighter, the far side shrinks and fades.

import { useEffect, useRef } from "react";

const NODE_COUNT = 30;
const MAX_LINES = 50;
const NEIGHBORS_PER_NODE = 3;
const RECONNECT_MS = 260;
const SIZE = 280;
const CENTER = SIZE / 2;
const SPHERE_RADIUS = 78;
const WANDER_AMPLITUDE = SPHERE_RADIUS * 0.55;
const FOCAL_LENGTH = 210;
const ROTATE_Y_SPEED = 0.1; // radians/second, the primary tumble
const ROTATE_X_SPEED = 0.045; // a slower cross-axis wobble, so the turn
                               // never repeats as a flat, predictable spin

interface Node {
  // fixed anchor on the sphere; the node wanders around this, it never
  // sits still on it.
  x0: number;
  y0: number;
  z0: number;
  // per-axis wander: independent speed and phase, so this node's drift
  // never lines up with any other node's.
  wSpeedX: number;
  wSpeedY: number;
  wSpeedZ: number;
  wPhaseX: number;
  wPhaseY: number;
  wPhaseZ: number;
  wAmplitude: number;
  baseSize: number;
  pulsePeriod: number;
  pulsePhase: number;
  // live, recomputed every frame: wandered-and-rotated 3d position and its
  // 2d projection.
  x: number;
  y: number;
  z: number;
  screenX: number;
  screenY: number;
  scale: number;
}

/**
 * given an index and the total node count
 * return one node anchored to a point on a fibonacci sphere, with its own
 * independent wander parameters - the standard sphere construction gives
 * an even starting cloud; the per-node speeds and phases (all derived from
 * the index, not random, so the layout is stable) are what keep every
 * node's path distinct from every other node's
 */
function makeNode(index: number, total: number): Node {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const y0 = 1 - (index / Math.max(total - 1, 1)) * 2;
  const ringRadius = Math.sqrt(Math.max(0, 1 - y0 * y0));
  const theta = goldenAngle * index;
  return {
    x0: Math.cos(theta) * ringRadius * SPHERE_RADIUS,
    y0: y0 * SPHERE_RADIUS,
    z0: Math.sin(theta) * ringRadius * SPHERE_RADIUS,
    wSpeedX: 0.16 + ((index * 11) % 13) * 0.02,
    wSpeedY: 0.13 + ((index * 7) % 11) * 0.02,
    wSpeedZ: 0.1 + ((index * 5) % 9) * 0.018,
    wPhaseX: index * 0.71,
    wPhaseY: index * 1.13 + 1.7,
    wPhaseZ: index * 1.47 + 3.1,
    wAmplitude: WANDER_AMPLITUDE * (0.75 + ((index * 3) % 5) * 0.1),
    baseSize: 2.6 + ((index * 7) % 5) * 0.5,
    pulsePeriod: 4.5 + (index % 6) * 1.4,
    pulsePhase: index * 0.53,
    x: 0,
    y: 0,
    z: 0,
    screenX: CENTER,
    screenY: CENTER,
    scale: 1,
  };
}

/**
 * given a node's fire-pulse timing and the elapsed seconds
 * return a value from 0 (quiet) to 1 (mid-flash). a moderate power keeps
 * the flash reading as a distinct event without either smearing into a
 * slow breathing glow or snapping on and off too fast to follow.
 */
function pulseAt(node: Node, elapsedSeconds: number): number {
  const phase = (elapsedSeconds / node.pulsePeriod) * Math.PI * 2 + node.pulsePhase;
  return Math.max(0, Math.sin(phase)) ** 4;
}

export function HomeOrbit() {
  const circleRefs = useRef<SVGCircleElement[]>([]);
  const lineRefs = useRef<SVGLineElement[]>([]);
  const nodesRef = useRef<Node[]>([]);

  useEffect(() => {
    nodesRef.current = Array.from({ length: NODE_COUNT }, (_, i) => makeNode(i, NODE_COUNT));

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const start = performance.now();
    let lastConnect = 0;
    let active: Array<[number, number]> = [];

    /**
     * given elapsed seconds, wander every node away from its anchor along
     * its own independent path, rotate the resulting (non-rigid) cloud,
     * and project it
     */
    function step(elapsedSeconds: number) {
      const angleY = elapsedSeconds * ROTATE_Y_SPEED;
      const angleX = Math.sin(elapsedSeconds * ROTATE_X_SPEED) * 0.6;
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);

      for (const node of nodesRef.current) {
        // each node drifts away from its sphere anchor on its own path;
        // no two nodes share a speed or phase, so the cloud's outline is
        // different every frame instead of holding a fixed shape.
        const wx = node.wAmplitude * Math.sin(elapsedSeconds * node.wSpeedX + node.wPhaseX);
        const wy = node.wAmplitude * Math.sin(elapsedSeconds * node.wSpeedY + node.wPhaseY);
        const wz = node.wAmplitude * Math.sin(elapsedSeconds * node.wSpeedZ + node.wPhaseZ);
        const wx0 = node.x0 + wx;
        const wy0 = node.y0 + wy;
        const wz0 = node.z0 + wz;

        // rotate the wandered point around the vertical axis first...
        const x1 = wx0 * cosY + wz0 * sinY;
        const z1 = -wx0 * sinY + wz0 * cosY;
        const y1 = wy0;
        // ...then tip that result around the horizontal axis, so the turn
        // is a real tumble rather than a flat carousel spin.
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;

        node.x = x1;
        node.y = y2;
        node.z = z2;

        const scale = FOCAL_LENGTH / (FOCAL_LENGTH + z2);
        node.scale = scale;
        node.screenX = CENTER + x1 * scale;
        node.screenY = CENTER + y2 * scale;
      }
    }

    /** recomputes which node pairs are currently nearest in rotated 3d space */
    function reconnect() {
      const nodes = nodesRef.current;
      const pairs = new Map<string, number>();
      for (let i = 0; i < nodes.length; i++) {
        const distances: Array<{ j: number; d: number }> = [];
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dz = nodes[i].z - nodes[j].z;
          distances.push({ j, d: Math.hypot(dx, dy, dz) });
        }
        distances.sort((a, b) => a.d - b.d);
        for (const { j } of distances.slice(0, NEIGHBORS_PER_NODE)) {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          pairs.set(key, 1);
        }
      }
      active = [...pairs.keys()].slice(0, MAX_LINES).map((key) => {
        const [a, b] = key.split("-").map(Number);
        return [a, b];
      });
    }

    /** writes every node's and line's current attributes to the dom */
    function paint(elapsedSeconds: number) {
      const nodes = nodesRef.current;
      const pulses = nodes.map((node) => pulseAt(node, elapsedSeconds));

      nodes.forEach((node, i) => {
        const circle = circleRefs.current[i];
        if (!circle) return;
        const depth = Math.max(0, Math.min(1, (node.scale - 0.55) / 0.9));
        const pulse = pulses[i];
        circle.setAttribute("cx", node.screenX.toFixed(1));
        circle.setAttribute("cy", node.screenY.toFixed(1));
        circle.setAttribute("r", (node.baseSize * node.scale * (1 + pulse * 0.9)).toFixed(1));
        circle.setAttribute("opacity", Math.min(1, 0.22 + depth * 0.62 + pulse * 0.5).toFixed(2));
      });

      lineRefs.current.forEach((line, i) => {
        const pair = active[i];
        if (!pair) {
          line.setAttribute("opacity", "0");
          return;
        }
        const [a, b] = pair;
        const na = nodes[a];
        const nb = nodes[b];
        line.setAttribute("x1", na.screenX.toFixed(1));
        line.setAttribute("y1", na.screenY.toFixed(1));
        line.setAttribute("x2", nb.screenX.toFixed(1));
        line.setAttribute("y2", nb.screenY.toFixed(1));
        const depth = Math.max(0, Math.min(1, ((na.scale + nb.scale) / 2 - 0.55) / 0.9));
        const firing = Math.max(pulses[a], pulses[b]);
        line.setAttribute("opacity", Math.min(0.85, 0.08 + depth * 0.3 + firing * 0.55).toFixed(2));
        line.setAttribute("stroke-width", (0.75 + firing * 1.5).toFixed(2));
      });
    }

    // a reader who asked the OS for less motion still sees the network -
    // just settled at one representative frame instead of animating.
    if (reduceMotion) {
      step(2.4);
      reconnect();
      paint(2.4);
      return;
    }

    function tick(now: number) {
      const elapsed = (now - start) / 1000;
      step(elapsed);
      if (now - lastConnect > RECONNECT_MS) {
        reconnect();
        lastConnect = now;
      }
      paint(elapsed);
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="home-orbit" aria-hidden>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        className="home-orbit__svg"
      >
        {Array.from({ length: MAX_LINES }, (_, i) => (
          <line
            key={i}
            ref={(el) => {
              if (el) lineRefs.current[i] = el;
            }}
            stroke="var(--accent)"
            strokeWidth="1"
            opacity="0"
          />
        ))}
        {Array.from({ length: NODE_COUNT }, (_, i) => (
          <circle
            key={i}
            ref={(el) => {
              if (el) circleRefs.current[i] = el;
            }}
            cx={CENTER}
            cy={CENTER}
            r={3}
            fill="var(--accent)"
            stroke="var(--accent)"
            strokeWidth="1"
            fillOpacity="0.55"
          />
        ))}
      </svg>
    </div>
  );
}

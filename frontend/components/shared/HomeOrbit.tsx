"use client";

// the home page orbit: a small network of nodes drifting through their own
// independent, ever-changing paths, with connections that continuously
// re-form between whichever nodes are currently nearest each other - the
// same idea the app is built on, made visible: a shifting web of relations,
// not a fixed diagram. no animation library, no webgl; a handful of svg
// elements whose attributes are written directly on every frame.
//
// each node's path is a lissajous curve (two out-of-phase sine waves at
// slightly different speeds), which never closes into a simple loop the
// way a circular orbit would - the shape keeps evolving instead of
// repeating on a short cycle. a third, independent oscillation drives
// depth: a node's scale and opacity rise and fall as it swings "toward"
// and "away from" the viewer, the classic parallax trick for suggesting
// three dimensions on a flat canvas.

import { useEffect, useRef } from "react";

const NODE_COUNT = 14;
const MAX_LINES = 18;
const CONNECT_RADIUS = 70;
const NEIGHBORS_PER_NODE = 2;
const RECONNECT_MS = 180;
const SIZE = 260;
const CENTER = SIZE / 2;

interface Node {
  // orbital parameters: independent per node, fixed for its lifetime.
  rx: number;
  ry: number;
  speedX: number;
  speedY: number;
  speedZ: number;
  phaseX: number;
  phaseY: number;
  phaseZ: number;
  baseSize: number;
  // live position, recomputed every frame.
  x: number;
  y: number;
  z: number;
}

/**
 * given an index and the total node count
 * return one node's fixed orbital parameters, spread deterministically
 * around the center so the initial layout is stable and every node's path
 * is shaped differently from its neighbors
 */
function makeNode(index: number, total: number): Node {
  const spread = (index / total) * Math.PI * 2;
  return {
    rx: 55 + ((index * 37) % 60),
    ry: 45 + ((index * 53) % 55),
    speedX: 0.18 + ((index * 0.07) % 0.14),
    speedY: 0.14 + ((index * 0.05) % 0.12),
    speedZ: 0.1 + ((index * 0.09) % 0.1),
    phaseX: spread,
    phaseY: spread * 1.7,
    phaseZ: spread * 2.3,
    baseSize: 3 + ((index * 7) % 4),
    x: CENTER,
    y: CENTER,
    z: 0,
  };
}

export function HomeOrbit() {
  const svgRef = useRef<SVGSVGElement>(null);
  const circleRefs = useRef<SVGCircleElement[]>([]);
  const lineRefs = useRef<SVGLineElement[]>([]);
  const nodesRef = useRef<Node[]>([]);

  useEffect(() => {
    nodesRef.current = Array.from({ length: NODE_COUNT }, (_, i) => makeNode(i, NODE_COUNT));

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let start = performance.now();
    let lastConnect = 0;
    let active: Array<[number, number]> = [];

    /** given elapsed seconds, advance every node along its lissajous path */
    function step(elapsedSeconds: number) {
      for (const node of nodesRef.current) {
        node.x = CENTER + node.rx * Math.sin(elapsedSeconds * node.speedX + node.phaseX);
        node.y = CENTER + node.ry * Math.sin(elapsedSeconds * node.speedY + node.phaseY);
        node.z = Math.sin(elapsedSeconds * node.speedZ + node.phaseZ);
      }
    }

    /** recomputes which node pairs are currently near enough to connect */
    function reconnect() {
      const nodes = nodesRef.current;
      const pairs = new Map<string, number>();
      for (let i = 0; i < nodes.length; i++) {
        const distances: Array<{ j: number; d: number }> = [];
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.hypot(dx, dy);
          if (d <= CONNECT_RADIUS) distances.push({ j, d });
        }
        distances.sort((a, b) => a.d - b.d);
        for (const { j, d } of distances.slice(0, NEIGHBORS_PER_NODE)) {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          pairs.set(key, d);
        }
      }
      active = [...pairs.keys()].slice(0, MAX_LINES).map((key) => {
        const [a, b] = key.split("-").map(Number);
        return [a, b];
      });
    }

    /** writes every node's and line's current attributes to the dom */
    function paint() {
      const nodes = nodesRef.current;
      nodes.forEach((node, i) => {
        const circle = circleRefs.current[i];
        if (!circle) return;
        const depth = (node.z + 1) / 2; // 0 (far) .. 1 (near)
        circle.setAttribute("cx", node.x.toFixed(1));
        circle.setAttribute("cy", node.y.toFixed(1));
        circle.setAttribute("r", (node.baseSize * (0.6 + depth * 0.8)).toFixed(1));
        circle.setAttribute("opacity", (0.35 + depth * 0.65).toFixed(2));
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
        line.setAttribute("x1", na.x.toFixed(1));
        line.setAttribute("y1", na.y.toFixed(1));
        line.setAttribute("x2", nb.x.toFixed(1));
        line.setAttribute("y2", nb.y.toFixed(1));
        const depth = ((na.z + nb.z) / 2 + 1) / 2;
        line.setAttribute("opacity", (0.15 + depth * 0.35).toFixed(2));
      });
    }

    // a reader who asked the OS for less motion still sees the network -
    // just settled at one representative frame instead of animating.
    if (reduceMotion) {
      step(2.4);
      reconnect();
      paint();
      return;
    }

    function tick(now: number) {
      const elapsed = (now - start) / 1000;
      step(elapsed);
      if (now - lastConnect > RECONNECT_MS) {
        reconnect();
        lastConnect = now;
      }
      paint();
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="home-orbit" aria-hidden>
      <svg
        ref={svgRef}
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
            fillOpacity="0.5"
          />
        ))}
      </svg>
    </div>
  );
}

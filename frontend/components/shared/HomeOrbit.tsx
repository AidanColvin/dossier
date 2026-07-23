// the home page orbit: a quiet animated node graph behind the search,
// echoing the brand mark (AppShell's LogoMark is the same center-and-nodes
// shape). pure svg with a css rotation, no animation library, no webgl -
// consistent with the rest of the app's dependency-free chart primitives.
// prefers-reduced-motion turns the spin off globally (see globals.css), so
// this needs no motion-query handling of its own.

const NODES = [
  { radius: 92, angle: 0, size: 5, duration: 46 },
  { radius: 92, angle: 72, size: 4, duration: 46 },
  { radius: 92, angle: 144, size: 6, duration: 46 },
  { radius: 92, angle: 216, size: 4, duration: 46 },
  { radius: 92, angle: 288, size: 5, duration: 46 },
  { radius: 60, angle: 40, size: 3.5, duration: 32 },
  { radius: 60, angle: 160, size: 3.5, duration: 32 },
  { radius: 60, angle: 280, size: 3.5, duration: 32 },
];

export function HomeOrbit() {
  const size = 240;
  const center = size / 2;

  return (
    <div className="home-orbit" aria-hidden>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="home-orbit__svg"
      >
        {NODES.map((node, index) => {
          const radians = (node.angle * Math.PI) / 180;
          const x = center + node.radius * Math.cos(radians);
          const y = center + node.radius * Math.sin(radians);
          return (
            <line
              key={`spoke-${index}`}
              x1={center} y1={center} x2={x} y2={y}
              stroke="var(--line-strong)" strokeWidth="1"
            />
          );
        })}
        <circle cx={center} cy={center} r={5} fill="var(--accent)" />
        {NODES.map((node, index) => (
          <g
            key={index}
            className="home-orbit__ring"
            style={{
              transformOrigin: `${center}px ${center}px`,
              animationDuration: `${node.duration}s`,
              animationDirection: index % 2 === 0 ? "normal" : "reverse",
            }}
          >
            <circle
              cx={center + node.radius * Math.cos((node.angle * Math.PI) / 180)}
              cy={center + node.radius * Math.sin((node.angle * Math.PI) / 180)}
              r={node.size}
              fill="var(--accent-tint)"
              stroke="var(--accent)"
              strokeWidth="1.5"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

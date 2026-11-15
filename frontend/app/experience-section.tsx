type Tone = "forest" | "ink" | "rust" | "salmon" | "coral" | "sage";

const TONE_BG: Record<Tone, string> = {
  forest: "bg-forest",
  ink: "bg-ink",
  rust: "bg-rust",
  salmon: "bg-salmon",
  coral: "bg-coral",
  sage: "bg-sage",
};

type Pill = {
  label: string;
  tone: Tone;
  rotate: number;
  top: string;
  left: string;
  width: string;
};

const DESKTOP_PILLS: Pill[] = [
  { label: "Keynote Sessions", tone: "forest", rotate: -20, top: "20%", left: "14%", width: "20%" },
  { label: "Innovation Showcase", tone: "ink", rotate: 0, top: "23%", left: "50%", width: "23%" },
  { label: "Panel Discussions", tone: "rust", rotate: -20, top: "20%", left: "86%", width: "20%" },
  { label: "Founder Spotlight", tone: "salmon", rotate: -70, top: "66%", left: "11%", width: "14%" },
  { label: "Career Conversations", tone: "coral", rotate: 0, top: "65%", left: "43%", width: "22%" },
  { label: "Networking", tone: "sage", rotate: -70, top: "66%", left: "76%", width: "14%" },
];

const DESKTOP_VIEWBOX_H = 36.09;
const DESKTOP_ARROWS = [
  "M50,4.7 C44,1.4 33,0.7 24,2.9",
  "M50,4.7 C56,1.4 68,0.7 78,2.9",
  "M15,20.9 C23,23.1 31,24.5 37,23.1",
  "M49,20.9 C57,19.5 65,18.8 70,20.2",
  "M77,18.8 C79,14.4 81,9.4 83,5.1",
];

const MOBILE_PILLS: Pill[] = [
  { label: "Keynote Sessions", tone: "forest", rotate: -8, top: "7%", left: "33%", width: "58%" },
  { label: "Innovation Showcase", tone: "ink", rotate: 6, top: "22%", left: "67%", width: "58%" },
  { label: "Panel Discussions", tone: "rust", rotate: -8, top: "37%", left: "33%", width: "58%" },
  { label: "Founder Spotlight", tone: "salmon", rotate: 6, top: "52%", left: "67%", width: "58%" },
  { label: "Career Conversations", tone: "coral", rotate: -8, top: "67%", left: "33%", width: "58%" },
  { label: "Networking", tone: "sage", rotate: 6, top: "82%", left: "67%", width: "58%" },
];

// Mobile diagram viewBox height (100 * 4/3), same reasoning as desktop.
const MOBILE_VIEWBOX_H = 133.33;
const MOBILE_ARROWS = [
  "M45,13.3 C58,18.7 58,24.0 58,26.7",
  "M58,34.7 C45,40.0 45,45.3 42,48.0",
  "M42,56.0 C58,61.3 58,66.7 58,69.3",
  "M58,77.3 C45,82.7 45,88.0 42,90.7",
  "M42,98.7 C58,104.0 58,109.3 58,109.3",
];

function ExperiencePill({ pill }: { pill: Pill }) {
  return (
    <div
      className={`absolute flex items-center justify-center rounded-full px-5 py-4 sm:px-7 sm:py-5 text-center font-bricolage font-semibold text-[clamp(0.75rem,3vw,1.05rem)] sm:text-[clamp(0.7rem,1.1vw,1.05rem)] whitespace-nowrap ${TONE_BG[pill.tone]} text-white`}
      style={{
        top: pill.top,
        left: pill.left,
        width: pill.width,
        transform: `translate(-50%, -50%) rotate(${pill.rotate}deg)`,
      }}
    >
      {pill.label}
    </div>
  );
}

function ExperienceArrows({ id, arrows, viewBoxHeight }: { id: string; arrows: string[]; viewBoxHeight: number }) {
  return (
    <svg viewBox={`0 0 100 ${viewBoxHeight}`} className="absolute inset-0 w-full h-full">
      <defs>
        <marker id={id} markerUnits="userSpaceOnUse" markerWidth="1.4" markerHeight="1.4" refX="1.2" refY="0.7" orient="auto">
          <path d="M0,0 L1.4,0.7 L0,1.4 Z" fill="var(--ink)" />
        </marker>
      </defs>
      {arrows.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="0.35"
          vectorEffect="non-scaling-stroke"
          markerEnd={`url(#${id})`}
        />
      ))}
    </svg>
  );
}

export function ExperienceSection() {
  return (
    <section className="bg-islamic-pattern pb-16 sm:pb-24">
      <div className="mx-auto px-4 sm:px-6 pt-16 sm:pt-24 text-center">
        <p className="font-plex text-lg lg:text-2xl font-normal leading-[48px] tracking-normal text-rust uppercase text-center mb-4">
          Summit Experience
        </p>
        <h2 className="font-sans text-xl log:text-[36px] font-normal leading-[1.2] sm:leading-[60px] tracking-normal text-black text-center">
          Step into conversations that challenge the way you think about finance, innovation, and
          opportunity. Explore powerful conversations, founder stories, career insights, and
          industry perspectives shaping the next generation of ethical finance and innovation.
        </h2>
      </div>

      <div className="relative w-full max-w-6xl mx-auto aspect-[1646/594] mt-14 hidden sm:block">
        <ExperienceArrows id="exp-arrowhead-desktop" arrows={DESKTOP_ARROWS} viewBoxHeight={DESKTOP_VIEWBOX_H} />
        {DESKTOP_PILLS.map((pill) => (
          <ExperiencePill key={pill.label} pill={pill} />
        ))}
      </div>

      <div className="relative w-full max-w-sm mx-auto aspect-[3/4] mt-12 px-2 sm:hidden">
        <ExperienceArrows id="exp-arrowhead-mobile" arrows={MOBILE_ARROWS} viewBoxHeight={MOBILE_VIEWBOX_H} />
        {MOBILE_PILLS.map((pill) => (
          <ExperiencePill key={pill.label} pill={pill} />
        ))}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

const flowSteps = [
  {
    number: "01",
    title: "Upload",
    description:
      "The provider uploads a dataset. Sirius encrypts it with AES-256-GCM, generates a Merkle tree, and pins it to IPFS.",
  },
  {
    number: "02",
    title: "Certify",
    description:
      "Boundless generates a ZK proof (RISC Zero) certifying dataset quality: entry count, duplicate rate, valid schema.",
  },
  {
    number: "03",
    title: "Tokenize",
    description:
      "A Multi-Purpose Token (XLS-33) is minted on XRPL with metadata: IPFS hash, ZK proof reference, quality score.",
  },
  {
    number: "04",
    title: "Vault",
    description:
      "The MPT is deposited into a Vault (XLS-65) — an on-chain lending pool. The provider sets a daily price in XRP.",
  },
  {
    number: "05",
    title: "Borrow",
    description:
      "A borrower browses the marketplace, picks a dataset, and pays in XRP for a chosen duration. Payment goes directly to the provider.",
  },
  {
    number: "06",
    title: "Access",
    description:
      "Sirius activates a temporary decryption key. The borrower receives a unique, watermarked copy — traceable if leaked.",
  },
  {
    number: "07",
    title: "Expire",
    description:
      "On expiration, the key is revoked automatically. The borrower can extend access by paying again. Data stays in the vault.",
  },
];

const xrplPrimitives = [
  { tag: "XLS-33", name: "MPT", description: "Tokenizes the dataset" },
  { tag: "XLS-65", name: "Vault", description: "Pools provider MPTs" },
  { tag: "XLS-66", name: "Lending", description: "On-chain loan management" },
  { tag: "XLS-70", name: "Credentials", description: "Provider & borrower certification" },
  { tag: "XLS-80", name: "Permissioned Domains", description: "Vault access control" },
  { tag: "Boundless", name: "ZK Proofs", description: "RISC Zero zkVM + on-chain Smart Escrow verification" },
];

function FlowPath({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const pathRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!pathRef.current || !containerRef.current) return;
    const lines = pathRef.current.querySelectorAll(".flow-line");
    lines.forEach((line) => {
      const path = line as SVGPathElement;
      const length = path.getTotalLength();
      gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
      gsap.to(path, {
        strokeDashoffset: 0,
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 100%",
          end: "bottom bottom",
          scrub: 0.6,
        },
      });
    });
  }, [containerRef]);

  const w = 1200;
  const h = 6000;
  const amp = 320;
  const cx = w / 2;

  // Seed-based pseudo-random for deterministic jitter
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed * 9301 + 4927) * 49297;
    return x - Math.floor(x);
  };

  const buildSinePath = (offset: number, jitterAmt: number) => {
    const points: string[] = [];
    const steps = 200;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = t * h;
      const jitter = (seededRandom(i * 31 + offset * 7) - 0.5) * jitterAmt;
      const x = cx + Math.sin(t * Math.PI * 7) * amp + offset + jitter;
      points.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
    }
    return points.join(" ");
  };

  const lines = [
    { offset: -24, opacity: 0.12, width: 1.5, jitter: 6 },
    { offset: -12, opacity: 0.18, width: 2, jitter: 4 },
    { offset: 0, opacity: 0.25, width: 2.5, jitter: 3 },
    { offset: 12, opacity: 0.18, width: 2, jitter: 5 },
    { offset: 24, opacity: 0.12, width: 1.5, jitter: 7 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0" style={{
      maskImage: "linear-gradient(to bottom, transparent 0%, white 20%, white 55%, transparent 70%)",
      WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, white 20%, white 55%, transparent 70%)",
    }}>
      <svg
        ref={pathRef}
        viewBox={`0 0 ${w} ${h}`}
        className="h-full w-full"
        preserveAspectRatio="none"
        fill="none"
      >
        {lines.map((l, i) => (
          <path
            key={i}
            className="flow-line"
            d={buildSinePath(l.offset, l.jitter)}
            stroke={`rgba(255,255,255,${l.opacity})`}
            strokeWidth={l.width}
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  );
}

function FlowSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    cardsRef.current.forEach((card, i) => {
      if (!card) return;
      const fromX = i % 2 === 0 ? -80 : 80;
      gsap.fromTo(
        card,
        { opacity: 0, x: fromX },
        {
          opacity: 1,
          x: 0,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: card,
            start: "top 85%",
            end: "top 55%",
            toggleActions: "play none none reverse",
          },
        }
      );
    });
  }, []);

  return (
    <section ref={sectionRef} className="relative z-10 overflow-hidden px-6 py-24 md:px-12 md:py-32">
      <h2 className="mb-4 text-center font-display text-4xl tracking-wider text-foreground md:text-5xl">
        How it works
      </h2>
      <p className="mx-auto mb-20 max-w-lg text-center text-sm tracking-wide text-muted md:mb-28 md:text-base">
        Seven steps from raw data to decentralized lending
      </p>

      <div className="relative mx-auto max-w-5xl">
        <div className="relative flex flex-col gap-16 md:gap-24">
          {flowSteps.map((step, i) => {
            const isLeft = i % 2 === 0;
            return (
              <div
                key={step.number}
                ref={(el) => { cardsRef.current[i] = el; }}
                className={`flex ${isLeft ? "md:justify-start" : "md:justify-end"} justify-center`}
              >
                <div className="group relative w-full max-w-md rounded-2xl border border-border bg-surface/60 p-6 backdrop-blur-md transition-colors hover:border-muted-foreground/40 md:p-8">
                  <div className="mb-3 flex items-center gap-4">
                    <span className="font-display text-3xl tracking-wider text-muted md:text-4xl">
                      {step.number}
                    </span>
                    <span className="font-display text-xl tracking-wider text-foreground md:text-2xl">
                      {step.title}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted md:text-base">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* XRPL Primitives */}
      <div className="mx-auto mt-32 max-w-4xl md:mt-40">
        <h3 className="mb-12 text-center font-display text-3xl tracking-wider text-foreground md:text-4xl">
          Built on XRPL
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {xrplPrimitives.map((p) => (
            <div
              key={p.tag}
              className="rounded-xl border border-border bg-surface/40 p-5 backdrop-blur-sm transition-colors hover:border-muted-foreground/30"
            >
              <span className="mb-1 block text-xs font-medium tracking-widest text-muted">
                {p.tag}
              </span>
              <span className="mb-2 block font-display text-lg tracking-wider text-foreground">
                {p.name}
              </span>
              <p className="text-sm leading-relaxed text-muted">{p.description}</p>
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}

const marqueeItems = [
  "Sirius Protocol",
  "Decentralized Data Lending",
  "Built on XRPL",
];

const MarqueeContent = () => (
  <>
    {Array.from({ length: 6 }).map((_, i) =>
      marqueeItems.map((item, j) => (
        <span key={`${i}-${j}`} className="flex items-center">
          <span>{item}</span>
          <span className="mx-8 inline-block h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      ))
    )}
  </>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

function AvatarCard({ name, image, imageStyle, x = "#", linkedin = "#", github = "#" }: {
  name: string;
  image: string;
  imageStyle: string;
  x?: string;
  linkedin?: string;
  github?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => setFlipped(false), 250);
  };

  const handleMouseEnter = () => {
    clearTimer();
    setFlipped(true);
  };

  useEffect(() => {
    return () => clearTimer();
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div
        className="h-[250px] w-[250px] cursor-pointer md:h-[300px] md:w-[300px] lg:h-[350px] lg:w-[350px]"
        style={{ perspective: "1000px" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className="relative h-full w-full transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <div
            className="absolute inset-0 overflow-hidden rounded-full"
            style={{ backfaceVisibility: "hidden" }}
          >
            <img src={image} alt={name} className={`h-full w-full object-cover ${imageStyle}`} />
          </div>

          <div
            className="absolute inset-0 overflow-hidden rounded-full"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <img src={image} alt={name} className={`h-full w-full object-cover ${imageStyle}`} style={{ transform: "scaleX(-1)" }} />
            <div className="absolute inset-0 flex items-center justify-center gap-8 bg-black/70">
            <a
              href={x}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white transition-all hover:scale-125"
              onClick={(e) => e.stopPropagation()}
            >
              <XIcon />
            </a>
            <a
              href={linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white transition-all hover:scale-125"
              onClick={(e) => e.stopPropagation()}
            >
              <LinkedInIcon />
            </a>
            <a
              href={github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white transition-all hover:scale-125"
              onClick={(e) => e.stopPropagation()}
            >
              <GitHubIcon />
            </a>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-6 text-center text-xl tracking-wider text-foreground md:text-2xl">
        {name}
      </p>
    </div>
  );
}

function PageBottom() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      <FlowPath containerRef={containerRef} />

      <FlowSection />

      <section className="relative z-10 min-h-screen px-8 py-16 md:px-16 md:py-24">
        <div className="flex items-start justify-between">
          <h2 className="text-4xl tracking-wider text-foreground md:text-5xl">
            About us :
          </h2>
          <a href="https://devinciblockchain.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3">
            <img src="/images/devinci-blockchain.png" alt="DeVinci Blockchain" className="h-12 w-auto md:h-14" />
            <span className="text-left text-sm leading-tight tracking-wider text-foreground md:text-base">
              DeVinci<br />Blockchain
            </span>
          </a>
        </div>

        <div className="mt-20 flex flex-col items-center justify-center gap-16 md:mt-28 md:flex-row md:gap-24 lg:gap-32">
          <AvatarCard name="Ali BEN YEZZA" image="/images/image_ali.png" imageStyle="" x="https://x.com/AliBENYEZZ13187" linkedin="https://www.linkedin.com/in/ali-ben-yezza/" github="https://github.com/alibenyezza" />
          <AvatarCard name="Noe WALES" image="/images/avatar-noe.png" imageStyle="object-[center_15%]" x="https://x.com/nooeeww" linkedin="https://www.linkedin.com/in/noé-w" github="https://github.com/CHAAIISE" />
        </div>
      </section>

      <footer className="relative z-10 border-t border-border px-4 py-4 text-center">
        <p className="text-[10px] tracking-widest text-muted-foreground">
          Built on XRPL — Paris Blockchain Week Hackathon 2026
        </p>
      </footer>
    </div>
  );
}

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const launchBtnRef = useRef<HTMLDivElement>(null);
  const uiOverlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;

    const lenis = new Lenis({
      duration: 1.4,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    lenis.stop();
    lenis.scrollTo(0, { immediate: true });
    lenis.start();

    lenis.on("scroll", ScrollTrigger.update);
    const rafFn = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(rafFn);
    gsap.ticker.lagSmoothing(0);

    const scrollProgressRef = { current: 0 };
    (window as unknown as Record<string, unknown>).__scrollProgress = scrollProgressRef;

    const trigger = ScrollTrigger.create({
      trigger: heroRef.current,
      start: "top top",
      end: "bottom bottom",
      pin: ".hero-pin",
      scrub: 0.8,
      onUpdate: (self) => {
        scrollProgressRef.current = self.progress;

        if (uiOverlayRef.current) {
          const raw = Math.min(1, Math.max(0, (self.progress - 0.03) / 0.77));
          const zoom = 1 + raw * raw * 8;
          uiOverlayRef.current.style.transform = `scale(${zoom})`;
        }

        if (launchBtnRef.current) {
          const btnProgress = Math.min(1, Math.max(0, (self.progress - 0.60) / 0.10));
          launchBtnRef.current.style.opacity = String(btnProgress);
          launchBtnRef.current.style.pointerEvents = self.progress >= 0.65 ? "auto" : "none";
        }
      },
    });

    return () => {
      lenis.stop();
      lenis.destroy();
      trigger.kill();
      ScrollTrigger.getAll().forEach(t => t.kill());
      ScrollTrigger.clearScrollMemory();
      ScrollTrigger.refresh();
      gsap.ticker.remove(rafFn);
      document.querySelectorAll(".pin-spacer").forEach(el => {
        const child = el.firstElementChild;
        if (child) el.parentNode?.replaceChild(child, el);
        else el.remove();
      });
      window.history.scrollRestoration = "auto";
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      delete (window as unknown as Record<string, unknown>).__scrollProgress;
    };
  }, []);

  return (
    <div>
      <div ref={heroRef} className="relative h-[700vh]">
        <div className="hero-pin pointer-events-none relative h-screen w-screen overflow-hidden">

          <div ref={uiOverlayRef} className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between" style={{ transformOrigin: "center center" }}>
            <div className="flex items-start justify-between p-8 md:p-12">
              <h1 className="font-display text-4xl tracking-wider text-foreground md:text-5xl">
                Sirius
              </h1>
            </div>

            <div className="w-full">
              <div className="overflow-hidden bg-white py-0.5">
                <div
                  className="flex whitespace-nowrap text-xs uppercase tracking-wider text-background md:text-sm"
                  style={{ animation: "marquee 20s linear infinite" }}
                >
                  <span className="flex shrink-0 items-center"><MarqueeContent /></span>
                  <span className="flex shrink-0 items-center"><MarqueeContent /></span>
                </div>
              </div>
            </div>
          </div>

          <div
            ref={launchBtnRef}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            style={{ opacity: 0 }}
          >
            <Link href="/dashboard" className="rounded-full border border-white/80 bg-white/5 px-10 py-4 text-lg tracking-wide text-white backdrop-blur-sm">
              Launch App
            </Link>
          </div>
        </div>
      </div>

      <PageBottom />
    </div>
  );
}

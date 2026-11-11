import Image from "next/image";
import { floor, gym, members, programs, reviews, timings } from "./content";
import { JoinForm } from "./join-form";
import { Arrow } from "./arrow";
import { Motion } from "./motion";
import { Pricing } from "./pricing";
import { getJoinPrograms } from "./lib/programs";

const h2 = "font-display text-6xl font-extrabold uppercase leading-[0.9] sm:text-8xl";
const section = "px-4 py-24 sm:px-10 sm:py-32";

// Where each floor photo sits before the collage collapses into a stack.
const scatter = [
  { left: "14%", top: "24%", rot: -9 },
  { left: "50%", top: "16%", rot: 4 },
  { left: "86%", top: "28%", rot: 10 },
  { left: "12%", top: "76%", rot: 7 },
  { left: "52%", top: "84%", rot: -5 },
  { left: "88%", top: "74%", rot: -11 },
];

// Statement stack, after Phive's ACTIVATE / YOUR / SENSES.
const stackWords = ["Train", "like a", "beast"];
const pill =
  "block overflow-hidden rounded-[2.4vw] px-[3vw] pb-[0.6vw] pt-[1.4vw] font-display text-[17vw] font-black uppercase leading-[0.82] sm:text-[12vw]";

const marquee = ["Be a part of elite", "House of beasts"];

function Plate() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
      <defs>
        <path id="ring" d="M100,100 m-70,0 a70,70 0 1,1 140,0 a70,70 0 1,1 -140,0" />
      </defs>
      <circle cx="100" cy="100" r="98" fill="#1d1a17" stroke="#b8913f" strokeWidth="4" />
      <circle cx="100" cy="100" r="56" fill="none" stroke="#2c2824" strokeWidth="10" />
      <circle cx="100" cy="100" r="18" fill="#b8913f" />
      <circle cx="100" cy="100" r="9" fill="#141210" />
      <text fill="#e6c77e" fontSize="17" fontWeight="800" letterSpacing="4" fontFamily="var(--font-big-shoulders)">
        <textPath href="#ring">GOLDEN HOUR · 25 KG · GOLDEN HOUR · 25 KG ·</textPath>
      </text>
    </svg>
  );
}

export default async function Home() {
  const joinPrograms = await getJoinPrograms();
  return (
    <>
      <Motion />
      <main>
        {/* Hero */}
        <section data-fx="hero" className="relative flex min-h-svh flex-col justify-end overflow-hidden px-4 pb-28 sm:px-10 sm:pb-32">
          <div data-fx="hero-img" className="absolute inset-0">
            <Image
              src="/images/floor-lamps.jpg"
              alt="The Golden Hour weights floor under brass pendant lamps"
              fill
              priority
              sizes="100vw"
              className="object-cover object-[50%_35%]"
            />
          </div>
          <div className="absolute inset-0 bg-linear-to-t from-matte via-matte/70 to-matte/10" />
          <div data-fx="hero-title" className="relative">
            <p className="max-w-md text-lg text-bone/80">
              {gym.fullName}, the house of beasts on Sagar Road, Saddar Cantt.
            </p>
            <h1 className="brass brass-sweep mt-4 font-display text-[22vw] font-black uppercase leading-[0.8] tracking-tight sm:text-[17vw]">
              Golden Hour
            </h1>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#join" className="btn-pair">
                <span className="btn btn-brass">Book a free visit</span>
                <span className="btn-pair-icon">
                  <Arrow size={18} />
                </span>
              </a>
              <a href={gym.whatsapp} className="btn btn-outline">
                WhatsApp us
              </a>
            </div>
          </div>
        </section>

        {/* Marquee: two rows that slide against each other with scroll */}
        <section aria-label={marquee.join(", ")} className="overflow-hidden border-y border-ash/30 py-6">
          {[0, 1].map((row) => (
            <div key={row} data-fx="marquee" aria-hidden className="flex w-max gap-10 whitespace-nowrap py-2">
              {Array.from({ length: 8 }, (_, i) => (
                <span
                  key={i}
                  className={`font-display text-7xl font-black uppercase sm:text-9xl ${row ? "outline-text" : "brass"}`}
                >
                  {marquee[(i + row) % 2]} ✦
                </span>
              ))}
            </div>
          ))}
        </section>

        {/* Proof: counters beside a wall of real members drifting in opposite directions */}
        <section data-fx="proof" className="grid items-center gap-12 overflow-hidden px-4 py-20 sm:px-10 md:h-[120svh] md:grid-cols-[2fr_3fr] md:py-0">
          <div className="flex flex-col gap-12">
            <a href={gym.mapsLink} className="group block">
              <p className="brass font-display text-[9rem] font-black leading-[0.8] sm:text-[12rem]">
                <span data-fx="count" data-to={gym.rating} data-decimals="1">{gym.rating}</span>
              </p>
              <p aria-label={`${gym.rating} out of 5 stars`} className="relative mt-4 inline-block text-3xl tracking-widest text-ash/40">
                ★★★★★
                <span className="absolute inset-y-0 left-0 overflow-hidden text-brass" style={{ width: `${(Number(gym.rating) / 5) * 100}%` }}>
                  ★★★★★
                </span>
              </p>
              <p className="mt-2 text-lg text-bone/75 group-hover:text-bone">
                From Google reviews
              </p>
            </a>
            <a href={gym.instagram} className="group block">
              <p className="font-display text-7xl font-black leading-none sm:text-8xl">
                <span data-fx="count" data-to="5.6" data-decimals="1">5.6</span>k
              </p>
              <p className="mt-2 text-lg text-bone/75 group-hover:text-bone">Following @golden_hour_21 on Instagram</p>
            </a>
            <p className="max-w-xs text-bone/60">Men and women train here, with certified coaches on the floor every session.</p>
          </div>

          <div className="grid h-[70svh] grid-cols-3 gap-3 overflow-hidden mask-[linear-gradient(transparent,black_12%,black_88%,transparent)] md:h-full" aria-label="Members and coaches at Golden Hour">
            {[0, 1, 2].map((c) => (
              <div key={c} data-fx="col" className="flex flex-col gap-3">
                {members.filter((_, i) => i % 3 === c).map((src) => (
                  <div key={src} className="relative aspect-4/5 shrink-0 overflow-hidden">
                    <Image src={src} alt="" fill sizes="(min-width: 768px) 20vw, 33vw" className="object-cover" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* Statement, after Phive's ACTIVATE / YOUR / SENSES: pills stack in, the first rolls away,
            a brush line writes across and a hand-drawn stroke sweeps the screen. */}
        <section
          data-fx="statement"
          aria-label="Train like a beast. Be a part of elite."
          className="relative flex h-svh items-center justify-center overflow-hidden px-4"
        >
          <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 800" preserveAspectRatio="none">
            <path
              data-fx="statement-line"
              d="M-20 640 C 180 720 260 300 520 250 S 880 560 1080 430 S 1330 110 1460 270"
              fill="none"
              stroke="var(--color-brass)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Blur + threshold: neighbouring pills melt into one shape with concave joins, like Phive's. */}
          <svg aria-hidden className="absolute size-0">
            <filter id="goo">
              <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
              <feColorMatrix in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo" />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </svg>

          <div data-fx="stack" aria-hidden className="relative">
            {/* Brass shapes (fused by the filter); text is transparent here, only used for sizing */}
            <div className="flex flex-col items-center filter-[url(#goo)]">
              {stackWords.map((w) => (
                <span key={w} data-fx="stack-bg" className={`${pill} bg-brass text-transparent`}>
                  {w}
                </span>
              ))}
            </div>
            {/* Crisp text on top, same layout */}
            <div className="absolute inset-0 flex flex-col items-center">
              {stackWords.map((w) => (
                <span key={w} data-fx="stack-word" className={`${pill} text-matte`}>
                  <span data-fx="stack-text" className="block">
                    {w}
                  </span>
                </span>
              ))}
            </div>
            <p
              data-fx="statement-script"
              className="absolute font-[family-name:var(--font-kaushan)] left-1/2 top-[42%] w-max -translate-x-1/2 -rotate-6 text-[7vw] leading-none text-bone drop-shadow-[0_4px_18px_rgb(0_0_0/0.5)] sm:text-[5vw]"
            >
              be a part of elite
            </p>
          </div>

          <p data-fx="statement-sub" className="absolute inset-x-4 bottom-[14vh] mx-auto max-w-md text-center text-xl text-brass-light">
            Strong people, a clean floor and coaches who compete themselves.
          </p>
        </section>

        {/* The floor: scattered photos collapse into one stack */}
        <section id="floor" data-fx="collage" className="relative h-svh overflow-hidden">
          <h2 className="brass absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-display text-[24vw] font-black uppercase leading-none">
            The floor
          </h2>
          {floor.map((p, i) => (
            <figure
              key={p.src}
              data-fx="collage-img"
              className="absolute h-[26vh] w-[34vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden shadow-2xl shadow-black/60 sm:h-[30vh] sm:w-[16vw]"
              style={{ left: scatter[i].left, top: scatter[i].top, transform: `rotate(${scatter[i].rot}deg)` }}
            >
              <Image src={p.src} alt={p.alt} fill sizes="(min-width: 640px) 20vw, 40vw" className="object-cover" />
            </figure>
          ))}
          <div data-fx="collage-cta" className="absolute inset-x-0 bottom-24 flex justify-center">
            <a href="#join" className="btn btn-brass btn-action">
              Come see it in person
              <span className="btn-icon">
                <Arrow />
              </span>
            </a>
          </div>
        </section>

        {/* Head coach. CONFIRM name and titles with the owner. */}
        <section id="coach" className={`${section} grid items-center gap-12 bg-matte-2 md:grid-cols-2`}>
          <div data-fx="reveal-img" className="relative aspect-square">
            <Image src="/images/coach.jpg" alt="Golden Hour head coach curling a barbell" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          </div>
          <div>
            <h2 data-fx="split" className={h2}>Coached by a champion</h2>
            <p className="mt-8 max-w-prose text-lg leading-relaxed text-bone/80">
              Our head coach doesn&apos;t just train people, he competes: Mr City Lahore, and Mr Pakistan in classic
              physique. The same eye that prepares him for stage checks your form on the floor.
            </p>
            <a href="#join" className="mt-8 inline-block border-b border-brass pb-1 font-display text-2xl font-bold text-brass-light hover:border-brass-light">
              Train with him
            </a>
          </div>
        </section>

        {/* Programs */}
        <section id="programs" className={section}>
          <h2 data-fx="split" className={h2}>Ways to train</h2>
          <ul className="mt-12">
            {programs.map((p) => (
              <li key={p.title} data-fx="row" className="rule grid gap-2 py-8 md:grid-cols-[1fr_1fr] md:gap-10">
                <h3 className="font-display text-4xl font-bold sm:text-5xl">{p.title}</h3>
                <p className="max-w-md self-center text-lg text-bone/75">{p.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* BEASTS: the floor shows through the letters, a plate rolls past */}
        <section data-fx="mask" aria-label="Beasts" className="relative overflow-hidden py-16">
          <p
            data-fx="mask-text"
            aria-hidden
            className="bg-cover bg-clip-text text-center font-display text-[34vw] font-black uppercase leading-[0.85] text-transparent"
            style={{ backgroundImage: "url(/images/main-hall.jpg)" }}
          >
            Beasts
          </p>
          <div data-fx="plate" className="absolute bottom-6 left-0 size-32 sm:size-48">
            <Plate />
          </div>
        </section>

        {/* Reviews */}
        <section className={`${section} bg-brass text-matte`}>
          <blockquote className="max-w-5xl">
            <p data-fx="words" className="font-display text-4xl font-bold leading-tight sm:text-6xl">
              &ldquo;{reviews[0].quote}&rdquo;
            </p>
            <footer className="mt-6 text-lg">{reviews[0].author}</footer>
          </blockquote>
          <div className="mt-16 grid gap-10 md:grid-cols-2">
            {reviews.slice(1).map((r) => (
              <blockquote key={r.quote}>
                <p className="text-xl leading-relaxed">&ldquo;{r.quote}&rdquo;</p>
                <footer className="mt-3 text-sm opacity-75">{r.author}</footer>
              </blockquote>
            ))}
          </div>
        </section>

        {/* Timings. CONFIRM with owner (see content.ts). */}
        <section id="timings" className={`${section} grid gap-12 md:grid-cols-2`}>
          <h2 data-fx="split" className={h2}>Timings</h2>
          <dl>
            {timings.map((t) => (
              <div key={t.who} data-fx="row" className="rule flex items-baseline justify-between gap-6 py-5">
                <dt className="text-lg text-bone/80">{t.who}</dt>
                <dd className="font-display text-3xl font-bold text-brass-light">{t.hours}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Pricing comes from Supabase (plans table), edited in the admin portal */}
        <Pricing />

        {/* Join + visit */}
        <section id="join" className={`${section} grid gap-16 bg-matte-2 lg:grid-cols-2`}>
          <div>
            <h2 data-fx="split" className={h2}>Your first visit is on us</h2>
            <p className="mt-6 max-w-md text-lg text-bone/75">
              Leave your number and we&apos;ll set a time to show you the floor and plan your first week.
            </p>
            <div className="mt-12">
              <JoinForm programs={joinPrograms} />
            </div>
          </div>
          <div className="flex flex-col gap-8">
            <address className="not-italic text-lg leading-relaxed">
              {gym.address}
              <br />
              <a href={`tel:${gym.phone.replace(/\s/g, "")}`} className="text-brass-light hover:underline">
                {gym.phone}
              </a>
            </address>
            <div className="flex flex-wrap gap-6 font-display text-2xl font-bold">
              <a href={gym.whatsapp} className="border-b border-brass pb-1 hover:text-brass-light">WhatsApp</a>
              <a href={gym.instagram} className="border-b border-brass pb-1 hover:text-brass-light">Instagram</a>
              <a href={gym.mapsLink} className="border-b border-brass pb-1 hover:text-brass-light">Directions</a>
            </div>
            <iframe
              title={`Map showing ${gym.fullName}`}
              src={gym.mapsEmbed}
              loading="lazy"
              className="aspect-4/3 w-full grayscale invert-[0.9] hue-rotate-180"
            />
          </div>
        </section>
      </main>

      <footer className="flex flex-wrap justify-between gap-4 px-4 pb-32 pt-10 text-sm text-ash sm:px-10">
        <span>{gym.fullName}</span>
        <span>{gym.tagline}.</span>
        <span>
          Built and maintained by{" "}
          <a href="https://www.techfinisolutions.com/" className="text-bone underline-offset-4 hover:text-brass-light hover:underline">
            Techfini Solutions
          </a>
        </span>
      </footer>

      {/* Floating nav, Phive-style, thumb reach on mobile */}
      <nav aria-label="Main" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-brass/40 bg-matte/90 p-1.5 backdrop-blur">
          <a href="#" aria-label="Back to top" className="shrink-0">
            <Image src="/images/logo.jpg" alt="" width={40} height={40} className="rounded-full" />
          </a>
          {[
            ["#floor", "Floor"],
            ["#coach", "Coach"],
            ["#programs", "Programs"],
            ["#timings", "Timings"],
            ["#pricing", "Pricing"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="hidden rounded-full px-4 py-2 font-display text-lg font-bold hover:text-brass-light md:block">
              {label}
            </a>
          ))}
          <a href={gym.whatsapp} className="rounded-full px-4 py-2 font-display text-lg font-bold hover:text-brass-light md:hidden">
            WhatsApp
          </a>
          <a href="#join" className="btn btn-brass btn-sm btn-action">
            Join
            <span className="btn-icon">
              <Arrow size={14} />
            </span>
          </a>
        </div>
      </nav>
    </>
  );
}

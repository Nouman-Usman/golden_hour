"use client";

import "lenis/dist/lenis.css";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);
// Phones: the address bar showing/hiding must not re-measure pinned sections mid-scroll.
ScrollTrigger.config({ ignoreMobileResize: true });

const all = (sel: string) => gsap.utils.toArray<HTMLElement>(sel);

// Phive-style scroll choreography. Markup opts in with data-fx="…" so page.tsx stays a server component.
export function Motion() {
  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const lenis = new Lenis({ anchors: true });
      lenis.on("scroll", ScrollTrigger.update);
      const raf = (t: number) => lenis.raf(t * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);

      // Hero: photo pushes in, brass title lifts away.
      const hero = { trigger: "[data-fx=hero]", start: "top top", end: "bottom top", scrub: true };
      gsap.to("[data-fx=hero-img]", { scale: 1.2, yPercent: 12, ease: "none", scrollTrigger: hero });
      gsap.to("[data-fx=hero-title]", { yPercent: -40, opacity: 0, ease: "none", scrollTrigger: hero });

      // Marquee rows slide in opposite directions with scroll.
      all("[data-fx=marquee]").forEach((row, i) => {
        gsap.fromTo(
          row,
          { xPercent: i % 2 ? -50 : 0 },
          {
            xPercent: i % 2 ? 0 : -50,
            ease: "none",
            scrollTrigger: { trigger: row, start: "top bottom", end: "bottom top", scrub: true },
          },
        );
      });

      // Proof: numbers count up once; member columns drift against each other.
      all("[data-fx=count]").forEach((el) => {
        const n = { v: 0 };
        const decimals = Number(el.dataset.decimals ?? 0);
        gsap.to(n, {
          v: Number(el.dataset.to),
          duration: 1.6,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
          onUpdate: () => (el.textContent = n.v.toFixed(decimals)),
        });
      });
      all("[data-fx=col]").forEach((col, i) => {
        gsap.fromTo(
          col,
          { yPercent: i % 2 ? -30 : 0 },
          {
            yPercent: i % 2 ? 0 : -30,
            ease: "none",
            scrollTrigger: { trigger: "[data-fx=proof]", start: "top bottom", end: "bottom top", scrub: true },
          },
        );
      });

      // Statement, Phive's ACTIVATE / YOUR / SENSES: pills stack in under the first word, the stack
      // recentres, the first word rolls away, the brush line writes itself, a stroke sweeps the screen.
      // Each pill is a brass shape (goo layer) plus a text twin on top; clip both together.
      const bgs = all("[data-fx=stack-bg]");
      const texts = all("[data-fx=stack-word]");
      const [w1, w2, w3] = bgs.map((bg, i) => [bg, texts[i]]);
      const [t1, t2, t3] = all("[data-fx=stack-text]");
      const open = "inset(0% 0% 0% 0% round 2.4vw)";
      const line = document.querySelector<SVGPathElement>("[data-fx=statement-line]");
      const len = line?.getTotalLength() ?? 0;
      gsap
        .timeline({
          scrollTrigger: {
            trigger: "[data-fx=statement]",
            start: "top top",
            end: "+=260%",
            scrub: 0.6,
            pin: true,
            invalidateOnRefresh: true,
          },
          defaults: { ease: "power3.inOut" },
        })
        .fromTo(line, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 4.4, ease: "none" }, 0)
        // first word alone, centred: opens from its middle
        .fromTo(w1, { clipPath: "inset(50% 50% 50% 50% round 2.4vw)" }, { clipPath: open, duration: 0.8 }, 0)
        .from(t1, { yPercent: 110, duration: 0.6 }, 0.3)
        .fromTo("[data-fx=stack]", { y: () => (w2[0].offsetHeight + w3[0].offsetHeight) / 2 }, { y: 0, duration: 1.6, ease: "none" }, 1)
        // next words grow down out of the one above
        .fromTo(w2, { clipPath: "inset(0% 0% 100% 0% round 2.4vw)" }, { clipPath: open, duration: 0.7 }, 1)
        .from(t2, { yPercent: 110, duration: 0.6 }, 1.15)
        .fromTo(w3, { clipPath: "inset(0% 0% 100% 0% round 2.4vw)" }, { clipPath: open, duration: 0.7 }, 1.8)
        .from(t3, { yPercent: 110, duration: 0.6 }, 1.95)
        // first word rolls up and away; stack slides up to stay centred
        .to(w1, { clipPath: "inset(0% 0% 100% 0% round 2.4vw)", duration: 0.7 }, 2.8)
        .to(t1, { yPercent: -110, duration: 0.6 }, 2.8)
        .to("[data-fx=stack]", { y: () => -w1[0].offsetHeight / 2, duration: 0.7 }, 2.8)
        // brush line writes left to right
        .fromTo(
          "[data-fx=statement-script]",
          { clipPath: "inset(-20% 100% -20% 0%)" },
          { clipPath: "inset(-20% 0% -20% 0%)", duration: 0.9, ease: "power1.inOut" },
          3.2,
        )
        .from("[data-fx=statement-sub]", { opacity: 0, y: 30, duration: 0.5 }, 3.7);

      // The floor: scattered photos collapse into a stack, then the CTA appears.
      const photos = all("[data-fx=collage-img]");
      gsap.timeline({
        scrollTrigger: { trigger: "[data-fx=collage]", start: "top top", end: "+=200%", scrub: 1, pin: true },
      })
        .to(photos, {
          left: "50%",
          top: "50%",
          rotate: (i) => (i % 2 ? 1 : -1) * (3 + i * 1.5),
          scale: 1.25,
          stagger: 0.08,
          ease: "power2.inOut",
        })
        .from("[data-fx=collage-cta]", { opacity: 0, y: 30 }, ">-0.1");

      // Coach: photo wipes open from the bottom.
      gsap.from("[data-fx=reveal-img]", {
        clipPath: "inset(100% 0% 0% 0%)",
        ease: "power3.inOut",
        duration: 1.4,
        scrollTrigger: { trigger: "[data-fx=reveal-img]", start: "top 75%" },
      });

      // BEASTS: the floor shows through the letters while a brass plate rolls across.
      const mask = { trigger: "[data-fx=mask]", start: "top bottom", end: "bottom top", scrub: true };
      gsap.fromTo("[data-fx=mask-text]", { backgroundPosition: "50% 0%", scale: 1.25 }, { backgroundPosition: "50% 100%", scale: 1, ease: "none", scrollTrigger: mask });
      gsap.fromTo("[data-fx=plate]", { x: "-30vw", rotate: 0 }, { x: "110vw", rotate: 900, ease: "none", scrollTrigger: mask });

      // Big headings: letters squash up out of a mask.
      all("[data-fx=split]").forEach((el) => {
        SplitText.create(el, {
          type: "words,chars", // words keep line breaks between whole words
          mask: "chars",
          autoSplit: true,
          onSplit: (s) =>
            gsap.from(s.chars, {
              yPercent: 110,
              scaleY: 1.8,
              transformOrigin: "50% 100%",
              stagger: 0.03,
              duration: 0.8,
              ease: "power4.out",
              scrollTrigger: { trigger: el, start: "top 85%" },
            }),
        });
      });

      // Rule-separated rows: the line draws, then the content rises.
      all("[data-fx=row]").forEach((row) => {
        gsap.timeline({ scrollTrigger: { trigger: row, start: "top 85%" } })
          .from(row, { "--rule": 0, duration: 0.8, ease: "power3.out" })
          .from(row.children, { y: 40, opacity: 0, stagger: 0.08, duration: 0.7, ease: "power3.out" }, 0.15);
      });

      // Lead review fills in word by word as you read.
      all("[data-fx=words]").forEach((el) => {
        const s = SplitText.create(el, { type: "words" });
        gsap.from(s.words, {
          opacity: 0.15,
          stagger: 0.1,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: true },
        });
      });

      return () => {
        gsap.ticker.remove(raf);
        lenis.destroy();
      };
    });
  });

  return null;
}

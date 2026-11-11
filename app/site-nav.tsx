"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Arrow } from "./arrow";

const links = [
  ["#floor", "Floor"],
  ["#coach", "Coach"],
  ["#programs", "Programs"],
  ["#timings", "Timings"],
  ["#pricing", "Pricing"],
] as const;

// Floating nav, Phive-style, in thumb reach. Phones get a menu sheet above the pill.
export function SiteNav({ whatsapp, instagram }: { whatsapp: string; instagram: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity md:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <nav aria-label="Main" className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4">
        <div
          id="site-menu"
          className={`pointer-events-auto w-full max-w-xs origin-bottom rounded-3xl border border-brass/40 bg-matte-2 p-2 transition duration-200 motion-reduce:transition-none md:hidden ${
            open ? "scale-100 opacity-100" : "pointer-events-none invisible scale-95 opacity-0"
          }`}
        >
          <ul>
            {links.map(([href, label]) => (
              <li key={href}>
                <a href={href} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 font-display text-2xl font-bold hover:bg-matte-3 hover:text-brass-light">
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-1 grid grid-cols-2 gap-2 border-t border-ash/20 pt-2">
            <a href={whatsapp} className="btn btn-outline btn-sm">
              WhatsApp
            </a>
            <a href={instagram} className="btn btn-outline btn-sm">
              Instagram
            </a>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-brass/40 bg-matte/90 p-1.5 backdrop-blur">
          <a href="#" aria-label="Back to top" className="shrink-0">
            <Image src="/images/logo.jpg" alt="" width={40} height={40} className="rounded-full" />
          </a>
          {links.map(([href, label]) => (
            <a key={href} href={href} className="hidden rounded-full px-4 py-2 font-display text-lg font-bold hover:text-brass-light md:block">
              {label}
            </a>
          ))}
          <button
            ref={button}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="site-menu"
            className="rounded-full px-4 py-2 font-display text-lg font-bold hover:text-brass-light md:hidden"
          >
            {open ? "Close" : "Menu"}
          </button>
          <a href="#join" onClick={() => setOpen(false)} className="btn btn-brass btn-sm btn-action">
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

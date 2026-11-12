import { useId } from "react";

/** The Sanay "Voice Line" mark, drawn inline so its tile follows the app's light/dark theme. */
export function Logo({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={className}>
      <defs>
        <radialGradient id={id} cx="50%" cy="72%" r="68%">
          <stop offset="0" stopColor="#b9c4ff" />
          <stop offset="0.55" stopColor="#5b5fe8" />
          <stop offset="1" stopColor="#16124f" />
        </radialGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="var(--logo-tile)" stroke="var(--logo-edge)" strokeWidth="8" />
      <circle cx="256" cy="256" r="156" fill={`url(#${id})`} />
      <path
        d="M86 256 C 146 256, 166 176, 216 176 S 286 336, 336 336 S 386 256, 426 256"
        fill="none"
        stroke="#fff"
        strokeWidth="30"
        strokeLinecap="round"
      />
    </svg>
  );
}

import type { ReactNode } from "react";

export function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="icon" title={label} aria-label={label} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      {children}
    </svg>
  );
}

export function BackIcon() {
  return (
    <Svg>
      <path d="M19 12H6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 6 6 12l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PlayIcon() {
  return (
    <Svg>
      <polygon points="8,5 19,12 8,19" fill="currentColor" />
    </Svg>
  );
}

export function PauseIcon() {
  return (
    <Svg>
      <rect x="6" y="5" width="4" height="14" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" fill="currentColor" />
    </Svg>
  );
}

export function UndoIcon() {
  return (
    <Svg>
      <path
        d="M9 7 4 12l5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 12h9a6 6 0 1 1 0 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ZeroIcon() {
  return (
    <Svg>
      <ellipse cx="12" cy="12" rx="6" ry="8" fill="none" stroke="currentColor" strokeWidth="2" />
    </Svg>
  );
}

export function ReplayIcon() {
  return (
    <Svg>
      <path
        d="M12 5a7 7 0 1 1-6.3 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <polygon points="5,3 9,8 4,9" fill="currentColor" />
    </Svg>
  );
}

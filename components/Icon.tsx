import type { CSSProperties } from "react";
const paths: Record<string, React.ReactNode> = {
  terminal: <><path d="m5 6 6 6-6 6M13 18h6"/></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  left: <path d="M20 12H4m6-6-6 6 6 6" />,
  image: <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/></>,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  arrow: <path d="M6 18 18 6M6 6h12v12" />,
  right: <path d="M4 12h16m-6-6 6 6-6 6" />,
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </>
  ),
  bookmark: <path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4Z" />,
  github: (
    <>
      <path
        d="M9 19c-5 1-5-3-7-3m14 6v-4a3.5 3.5 0 0 0-1-2.7c3.3-.4 6.7-1.6 6.7-7.3A5.7 5.7 0 0 0 20 4a5.2 5.2 0 0 0-.1-4S18.6-.4 16 1.6a14.3 14.3 0 0 0-8 0C5.4-.4 4.1 0 4.1 0A5.2 5.2 0 0 0 4 4a5.7 5.7 0 0 0-1.7 4c0 5.7 3.4 6.9 6.7 7.3A3.5 3.5 0 0 0 8 18v4"
        transform="translate(1 2) scale(.9)"
      />
    </>
  ),
  linkedin: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M7 10v7m0-10v.1M11 17v-7m0 3c0-4 6-4 6 0v4" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  pin: (
    <>
      <path d="m9 3 6 0 1 6 3 3v2H5v-2l3-3zM12 14v7" />
    </>
  ),
  location: (
    <>
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  spark: <path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  share: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
};
export default function Icon({
  name,
  size = 20,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name] ?? paths.spark}
    </svg>
  );
}

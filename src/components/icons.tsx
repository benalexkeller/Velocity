// Thin line icons matching the mocks (1.6–1.8 stroke, rounded).
const P = (d: string, extra?: React.ReactNode) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} />
    {extra}
  </svg>
);

export const Icons = {
  home: () => P("M3 11.5 12 4l9 7.5M5.5 10v10h13V10", <path d="M10 20v-6h4v6" />),
  calendar: () => P("M4 6h16v14H4zM4 10h16M8 3v4M16 3v4"),
  bars: () => P("M5 20V11M12 20V5M19 20v-8"),
  fork: () => P("M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 1-3 4-3 7h3v11"),
  trend: () => P("M3 17l6-6 4 4 8-8M15 7h6v6"),
  calc: () => P("M6 3h12v18H6zM9 7h6M9 12h1M12 12h1M15 12h1M9 16h1M12 16h1M15 16h1"),
  store: () => P("M4 8h16l-1 12H5zM8 8V6a4 4 0 0 1 8 0v2"),
  swim: () => P("M2 17c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0M2 21c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0M8 12l4-5 4 3", <circle cx="17.5" cy="6" r="1.8" />),
  bike: () => P("M5.5 17.5 10 10h4.5l4 7.5M10 10 8.5 7.5H13M10 10l3 7.5", <><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /></>),
  run: () => P("M14.5 7.5 10 11l3 3.5-2.5 5M13 14.5l4 3 1.5 3M10 11l4.5-1 4 2.5M9.5 13.5 5.5 15", <circle cx="15.5" cy="4.5" r="2" />),
  strength: () => P("M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"),
  rest: () => P("M3 18V9h18v9M3 13h18M6 9V6h5v3"),
  hike: () => P("M2 19.5h20M4.5 19.5 10 9l3.2 5.5M11.5 12.5l3-4.5 5 11.5", <circle cx="7" cy="4.5" r="1.6" />),
  plus: () => P("M12 5v14M5 12h14"),
  arrow: () => P("M5 12h14M13 6l6 6-6 6"),
  chevron: () => P("M9 6l6 6-6 6"),
  back: () => P("M15 6l-6 6 6 6"),
  sun: () => P("M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4", <circle cx="12" cy="12" r="4" />),
  spark: () => P("M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"),
  search: () => P("M20 20l-4.2-4.2", <circle cx="10.5" cy="10.5" r="6.5" />),
  filter: () => P("M4 6h16M7 12h10M10 18h4"),
  close: () => P("M6 6l12 12M18 6 6 18"),
  expand: () => P("M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"),
  note: () => P("M6 3h12v18H6zM9 8h6M9 12h6M9 16h4"),
  more: () => P("M5 12h.01M12 12h.01M19 12h.01"),
  check: () => P("M5 12l4.5 4.5L19 7"),
};

export type IconName = keyof typeof Icons;
export function Icon({ name }: { name: IconName }) {
  const C = Icons[name];
  return <C />;
}

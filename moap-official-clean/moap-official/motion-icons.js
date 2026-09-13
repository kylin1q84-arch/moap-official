const ICON_PATHS = Object.freeze({
  trophy: '<path d="M8 4h8v3.4a4 4 0 0 1-8 0V4Z"/><path d="M8 5H5.5a2 2 0 0 0 0 4H8M16 5h2.5a2 2 0 0 1 0 4H16M12 11.5V16M8.5 20h7M10 16h4"/>',
  'trend-up': '<path d="M3 16 9 10l4 4 7-8"/><path d="M15 6h5v5"/>',
  'trend-down': '<path d="m3 8 6 6 4-4 7 8"/><path d="M15 18h5v-5"/>',
  'check-circle': '<circle cx="12" cy="12" r="8.5"/><path d="m8 12 2.6 2.6L16.5 9"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h8V4M8 20v-6h8v6"/>',
  shield: '<path d="M12 3 19 6v5c0 4.6-2.8 8.1-7 10-4.2-1.9-7-5.4-7-10V6z"/><path d="m9 12 2 2 4-4"/>',
  'audit-check': '<path d="m5 12 4 4L19 6"/>',
  download: '<path data-icon-part="arrow" d="M12 3v11"/><path data-icon-part="arrow" d="m7 10 5 5 5-5"/><path d="M5 20h14"/>'
});

export function iconSvg(name,className="",attributes=""){
  const paths=ICON_PATHS[name];
  if(!paths)return "";
  const classes=["semantic-icon",className].filter(Boolean).join(" ");
  return `<svg class="${classes}" data-motion-icon="${name}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" pointer-events="none" ${attributes}>${paths}</svg>`;
}

export const semanticIconNames=Object.freeze(Object.keys(ICON_PATHS));


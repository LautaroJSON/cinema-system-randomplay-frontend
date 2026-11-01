import type { Metadata } from "next";

// Next reemplaza `openGraph` entero en cada página en lugar de combinarlo con el del layout,
// así que cada página parte de esta base.
export const openGraphBase = {
  siteName: "RandomPlay",
  locale: "es_AR",
} satisfies NonNullable<Metadata["openGraph"]>;

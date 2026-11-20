/**
 * Casete VHS de trazo, con los carretes vacíos. Decorativo: el significado va en el texto de al
 * lado. Trazo de 2 px y esquinas rectas (DESIGN.md §9); el tamaño lo da `className`.
 */
export function Casete({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 150"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <rect x="10" y="10" width="220" height="120" />
      <rect x="40" y="26" width="160" height="44" />
      <circle cx="85" cy="48" r="13" />
      <circle cx="155" cy="48" r="13" />
      <path d="M85 41v14M78 48h14M155 41v14M148 48h14" />
      <path d="M62 130l12-26h92l12 26" />
    </svg>
  );
}

/**
 * PontiScore design tokens (post-rebrand).
 * Mirrors the CSS custom properties defined in `src/styles/global.css`.
 */
export const theme = {
  color: {
    surface: "#FFFFFF",
    surfaceSecondary: "#F8FAFC",
    surfaceTertiary: "#E2E8F0",
    surfaceInverse: "#0F172A",
    onSurface: "#0F172A",
    onSurfaceSecondary: "#475569",
    onSurfaceInverse: "#FFFFFF",
    onBrand: "#FFFFFF",
    brand: "#1B3A8B",
    brandStrong: "#142C6A",
    brandSoft: "#EEF2FA",
    brandAccent: "#5AA8E0",
    cta: "#16A34A",
    ctaStrong: "#15803D",
    ctaSoft: "#DCFCE7",
    orange: "#F17E1A",
    orangeSoft: "#FEF3E7",
    warning: "#F17E1A",
    error: "#DC2626",
    border: "#E2E8F0",
    borderStrong: "#CBD5E1",
  },
} as const;

export type ThemeColor = keyof typeof theme.color;

/**
 * Zentrale Bänder und Schwellen für das App-weite Scoring.
 * 0–14 ruhig · 15–34 aufmerksam · 35–59 markant · 60–79 kritisch · 80–100 hochkritisch
 */

import type { AlertSeverity } from "../types";

export type Band = "ruhig" | "aufmerksam" | "markant" | "kritisch" | "hochkritisch";

export const BAND_ORDER: Band[] = ["ruhig", "aufmerksam", "markant", "kritisch", "hochkritisch"];

export function bandFromScore(value: number): Band {
  const v = Math.max(0, Math.min(100, value));
  if (v >= 80) return "hochkritisch";
  if (v >= 60) return "kritisch";
  if (v >= 35) return "markant";
  if (v >= 15) return "aufmerksam";
  return "ruhig";
}

export function bandLabel(b: Band): string {
  return b.charAt(0).toUpperCase() + b.slice(1);
}

/** Farbklasse aus warn-Tokens. */
export function bandColorClass(b: Band): {
  bg: string;
  text: string;
  border: string;
  soft: string;
} {
  switch (b) {
    case "hochkritisch":
      return {
        bg: "bg-warn-extreme",
        text: "text-warn-extreme-fg",
        border: "border-warn-extreme",
        soft: "bg-warn-extreme/15",
      };
    case "kritisch":
      return {
        bg: "bg-warn-severe",
        text: "text-warn-severe-fg",
        border: "border-warn-severe",
        soft: "bg-warn-severe/15",
      };
    case "markant":
      return {
        bg: "bg-warn-moderate",
        text: "text-warn-moderate-fg",
        border: "border-warn-moderate",
        soft: "bg-warn-moderate/15",
      };
    case "aufmerksam":
      return {
        bg: "bg-warn-minor",
        text: "text-warn-minor-fg",
        border: "border-warn-minor",
        soft: "bg-warn-minor/15",
      };
    default:
      return { bg: "bg-muted", text: "text-foreground", border: "border-border", soft: "bg-muted" };
  }
}

/** Brücke zur bestehenden AlertSeverity (für ältere Komponenten). */
export function bandToSeverity(b: Band): AlertSeverity | "none" {
  switch (b) {
    case "hochkritisch":
      return "extreme";
    case "kritisch":
      return "severe";
    case "markant":
      return "moderate";
    case "aufmerksam":
      return "minor";
    default:
      return "none";
  }
}

/** Bändert eine Confidence in eine Kurzbezeichnung. */
export function confidenceLabel(value: number): "niedrig" | "mittel" | "hoch" {
  if (value >= 75) return "hoch";
  if (value >= 45) return "mittel";
  return "niedrig";
}

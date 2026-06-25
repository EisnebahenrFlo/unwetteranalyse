/* eslint-disable @typescript-eslint/no-explicit-any */
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true, // GeoServer-Präfixe robust ignorieren
});

/**
 * Liest aus WMS-GetCapabilities-XML die time-Dimension des Layers mit exakt
 * diesem <Name>. Durchläuft den (ggf. verschachtelten) Layer-Baum statt per
 * Regex blind das nächste <Dimension name="time"> zu greifen → keine
 * Cross-Layer-Verwechslung. Fällt auf <Extent name="time"> zurück (WMS 1.1.1).
 */
export function parseWmsTimeDimension(xml: string, layerName: string): string | null {
  let root: any;
  try {
    root = parser.parse(xml);
  } catch {
    return null;
  }
  const cap = root?.WMS_Capabilities ?? root?.WMT_MS_Capabilities;
  const top = cap?.Capability?.Layer;
  if (!top) return null;

  const layer = findLayer(top, layerName);
  if (!layer) return null;

  const raw = readTime(layer.Dimension) ?? readTime(layer.Extent);
  const trimmed = typeof raw === "string" ? raw.trim() : null;
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function readTime(node: any): string | null {
  for (const d of asArray(node)) {
    if (d == null) continue;
    const name = (typeof d === "object" ? d["@_name"] : null) ?? "";
    if (String(name).toLowerCase() !== "time") continue;
    return typeof d === "string" ? d : (d["#text"] ?? null);
  }
  return null;
}

function findLayer(node: any, name: string): any | null {
  for (const layer of asArray(node)) {
    if (!layer || typeof layer !== "object") continue;
    const n = layer.Name;
    if ((typeof n === "string" ? n : n?.["#text"]) === name) return layer;
    const child = findLayer(layer.Layer, name);
    if (child) return child;
  }
  return null;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

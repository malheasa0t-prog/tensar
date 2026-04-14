import { ImageResponse } from "next/og";
import { getSiteSettings } from "@/lib/siteSettings";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

/**
 * Generates the default Open Graph image for shared links.
 *
 * @returns {Promise<ImageResponse>}
 */
export default async function OpenGraphImage() {
  const siteSettings = await getSiteSettings();
  const configuredBrandName = String(siteSettings.company?.name || "").trim();
  const brandName = /^[\x00-\x7F]+$/.test(configuredBrandName) && configuredBrandName
    ? configuredBrandName
    : "TechZone";
  const slogan = "Computers, repairs, and accessories";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #050a14 0%, #08111f 55%, #0b1a2e 100%)",
          color: "#f8fafc",
          padding: "72px",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            padding: "14px 24px",
            borderRadius: "999px",
            border: "1px solid rgba(45, 212, 191, 0.5)",
            background: "rgba(8, 145, 178, 0.16)",
            fontSize: 28,
          }}
        >
          TECHZONE
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 84, fontWeight: 800 }}>{brandName}</div>
          <div style={{ fontSize: 34, color: "#cbd5e1", maxWidth: 860 }}>{slogan}</div>
        </div>
        <div style={{ display: "flex", gap: 16, color: "#5eead4", fontSize: 28 }}>
          <div>Products</div>
          <div>Repairs</div>
          <div>Accessories</div>
        </div>
      </div>
    ),
    size
  );
}

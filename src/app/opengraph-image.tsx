import { ImageResponse } from "next/og";

export const alt = "no-way.dev — AI API Pricing Reference";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          backgroundColor: "#faf8f5",
          color: "#1c1917",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, color: "#b45309", marginBottom: 16 }}>AI API pricing reference</div>
        <div style={{ display: "flex", fontSize: 84, fontWeight: 700, letterSpacing: "-0.02em" }}>
          no-way<span style={{ color: "#b45309" }}>.dev</span>
        </div>
        <div style={{ fontSize: 32, color: "#57534e", marginTop: 24 }}>
          Prices per 1M tokens · cost calculator · verified sources
        </div>
      </div>
    ),
    size,
  );
}

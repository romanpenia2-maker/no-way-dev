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
          backgroundColor: "#e7e8e2",
          color: "#1b1b16",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, color: "#63635a", marginBottom: 16 }}>AI API pricing reference · e-ink</div>
        <div style={{ display: "flex", fontSize: 84, fontWeight: 800, letterSpacing: "-0.03em", textTransform: "uppercase" }}>
          no-way.dev
        </div>
        <div style={{ fontSize: 32, color: "#63635a", marginTop: 24 }}>
          Prices per 1M tokens · cost calculator · verified sources · sponsored none
        </div>
      </div>
    ),
    size,
  );
}

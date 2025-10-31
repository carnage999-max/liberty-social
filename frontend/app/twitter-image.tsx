import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #0B3D91 0%, #6C5CE7 50%, #FF4D4F 100%)",
          color: "white",
          fontFamily: "Inter, system-ui, Arial",
          fontSize: 56,
          fontWeight: 800,
        }}
      >
        Liberty Social
      </div>
    ),
    { ...size }
  );
}
    
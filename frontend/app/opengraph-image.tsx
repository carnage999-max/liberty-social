import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background:
            "linear-gradient(135deg, #0B3D91 0%, #6C5CE7 50%, #FF4D4F 100%)",
          color: "white",
          fontFamily: "Inter, system-ui, Arial",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 24,
            alignItems: "center",
            padding: 32,
            backgroundColor: "rgba(255,255,255,0.08)",
            borderRadius: 20,
          }}
        >
          <img src={`${process.env.NEXT_PUBLIC_SITE_URL || "https://mylibertysocial.com"}/images/logo.jpeg`} width={96} height={96} style={{ borderRadius: 16 }} />
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.1 }}>
            Liberty Social
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            fontSize: 28,
            opacity: 0.95,
            textAlign: "center",
            maxWidth: 880,
          }}
        >
          A new kind of social experience.
        </div>
      </div>
    ),
    { ...size }
  );
}

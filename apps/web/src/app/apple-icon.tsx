import { ImageResponse } from "next/og";

// Icône écran d'accueil iOS (iOS arrondit lui-même les coins).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2346c8",
          color: "#ffffff",
          fontSize: 100,
          fontWeight: 700,
        }}
      >
        S
      </div>
    ),
    size,
  );
}

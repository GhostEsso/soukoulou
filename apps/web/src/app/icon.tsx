import { ImageResponse } from "next/og";

// Icône de l'app (même « S » que le composant Logo), servie en /icon/192 et /icon/512.
export function generateImageMetadata() {
  return [192, 512].map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id);
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
          fontSize: size * 0.55,
          fontWeight: 700,
        }}
      >
        S
      </div>
    ),
    { width: size, height: size },
  );
}

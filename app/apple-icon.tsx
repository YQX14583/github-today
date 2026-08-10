import { ImageResponse } from "next/og";

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
          background: "#24292f",
          color: "white",
          fontFamily: "Arial, sans-serif",
          fontSize: 72,
          fontWeight: 700,
          letterSpacing: -6
        }}
      >
        GT
      </div>
    ),
    size
  );
}

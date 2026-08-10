import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 210,
          fontWeight: 700,
          letterSpacing: -18
        }}
      >
        GT
      </div>
    ),
    size
  );
}

import { CSSProperties } from "react";
import "./Skeleton.css";

interface SkeletonProps {
  width?: number;
  height?: number;
  style?: CSSProperties;
}

export default function Skeleton({ width, height = 18, style }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{
        width: width ? `${width}px` : "100%",
        height: `${height}px`,
        borderRadius: 6,
        ...style,
      }}
    />
  );
}

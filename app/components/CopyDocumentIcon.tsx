"use client";

interface CopyDocumentIconProps {
  size?: number;
  className?: string;
}

export default function CopyDocumentIcon({
  size = 16,
  className = "",
}: CopyDocumentIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
    >
      <rect
        x="2"
        y="4"
        width="9"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="5"
        y="2"
        width="9"
        height="10"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
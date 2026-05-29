import React from 'react';

interface LandmarkDotsProps {
  visible?: boolean;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[];
}

export default function LandmarkDots({
  visible = false,
  width = 280,
  height = 370,
  points,
}: LandmarkDotsProps) {
  return null;
}

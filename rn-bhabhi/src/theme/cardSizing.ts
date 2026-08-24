import { PixelRatio } from 'react-native';

export type CardMetrics = { width: number; height: number; radius: number; spacing: number };

export function getCardMetrics(screenWidth: number, screenHeight: number): CardMetrics {
  const usableWidth = Math.max(screenWidth, screenHeight);
  const width = PixelRatio.roundToNearestPixel(Math.min(78, Math.max(58, usableWidth * 0.105)));
  return { width, height: PixelRatio.roundToNearestPixel(width * 1.45), radius: 11, spacing: Math.max(2, Math.round(width * 0.045)) };
}
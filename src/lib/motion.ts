const duration = {
  fast: 120,
  base: 180,
  slow: 240,
} as const;

const easing = {
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  easeInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

export type MotionSpeed = keyof typeof duration;
export type MotionEase = keyof typeof easing;

export const buildTransition = (
  properties: string[],
  speed: MotionSpeed = "base",
  curve: MotionEase = "easeOut"
) =>
  properties
    .map(
      (prop) => `${prop} ${duration[speed]}ms ${easing[curve]}`
    )
    .join(", ");

export const motion = {
  duration,
  easing,
  buildTransition,
};

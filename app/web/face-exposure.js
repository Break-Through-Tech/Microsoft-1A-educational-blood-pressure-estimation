
export function createExposureCheck() {
  let previous;
  let holdUntil = -Infinity;
  return (time, light) => {
    if (previous !== undefined && Math.abs(light - previous) > Math.max(9, previous * 0.23)) {
      holdUntil = time + 0.45;
    }
    previous = light;
    return time < holdUntil;
  };
}

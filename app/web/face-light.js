
export function readLighting(data) {
  const light = [];
  let clipped = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [red, green, blue] = [data[i], data[i + 1], data[i + 2]];
    light.push(0.2126 * red + 0.7152 * green + 0.0722 * blue);
    if (Math.max(red, green, blue) >= 253) clipped++;
  }
  light.sort((a, b) => a - b);
  return {
    middle: light[Math.floor(light.length * 0.5)],
    upper: light[Math.floor(light.length * 0.9)],
    clipped: clipped / light.length,
  };
}

export function lightingIssue({ middle, upper, clipped }) {
  if (middle < 18 && upper < 28) return "dark";
  if (clipped > 0.28) return "glare";
  return null;
}

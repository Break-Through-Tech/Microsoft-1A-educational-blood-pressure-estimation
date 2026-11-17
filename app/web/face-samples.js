
import { lightingIssue, readLighting } from "./face-light.js";
import { faceRegions } from "./face-regions.js";

export function createFaceSampler() {
  const canvas = document.createElement("canvas");
  const size = 12;
  canvas.width = canvas.height = size;
  const pixels = canvas.getContext("2d", { willReadFrequently: true });
  return (video, tracked) => {
    const regions = tracked.face ? faceRegions(tracked.face) : {};
    if (tracked.issue) return { issue: tracked.issue, colors: {}, regions };
    const { videoWidth: width, videoHeight: height } = video;
    const samples = Object.entries(regions).map(([name, region]) => {
      pixels.drawImage(video, region.left * width, region.top * height,
        region.width * width, region.height * height, 0, 0, size, size);
      const data = pixels.getImageData(0, 0, size, size).data;
      return { name, rgb: averageColors(data), light: readLighting(data) };
    });
    return { ...assessRegions(samples), regions };
  };
}

function averageColors(data) {
  const rgb = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    for (let channel = 0; channel < rgb.length; channel++) rgb[channel] += data[i + channel];
  }
  return rgb.map(sum => sum / (data.length / 4));
}

export function assessRegions(samples) {
  const checked = samples.map(sample => ({ ...sample, issue: lightingIssue(sample.light) }));
  const usable = checked.filter(sample => !sample.issue);
  if (!usable.length) {
    const onlyGlare = checked.length && checked.every(sample => sample.issue === "glare");
    return { issue: onlyGlare ? "glare" : "dark", colors: {} };
  }
  const light = Math.max(...usable.map(sample => sample.light.middle));
  const colors = Object.fromEntries(usable.map(sample => [sample.name, sample.rgb]));
  return { issue: null, light, colors };
}

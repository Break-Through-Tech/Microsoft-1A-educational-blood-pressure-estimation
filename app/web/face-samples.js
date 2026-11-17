
import { readLighting } from "./face-light.js";
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
    return { samples, regions };
  };
}

function averageColors(data) {
  const rgb = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) {
    for (let channel = 0; channel < rgb.length; channel++) rgb[channel] += data[i + channel];
  }
  return rgb.map(sum => sum / (data.length / 4));
}

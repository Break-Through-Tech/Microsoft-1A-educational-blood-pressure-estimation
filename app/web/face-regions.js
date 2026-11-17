
export function normalizedFace(detection, width, height) {
  if (!detection?.boundingBox || !(width > 0 && height > 0)) return null;
  const bounds = detection.boundingBox;
  const box = {
    left: bounds.originX / width,
    top: bounds.originY / height,
    width: bounds.width / width,
    height: bounds.height / height,
  };
  if (!Object.values(box).every(Number.isFinite) || box.width <= 0 || box.height <= 0) return null;
  const [first, second, nose] = detection.keypoints ?? [];
  const eyes = first && second ? [first, second].sort((a, b) => a.x - b.x) : [];
  return { box, eyes, nose };
}

export function insideFrame(box) {
  return box.left >= 0 && box.top >= 0 && box.left + box.width <= 1 && box.top + box.height <= 1;
}

export function foreheadRegion(face) {
  const { box, eyes } = face;
  const eyeHeight = eyes.length === 2 ? (eyes[0].y + eyes[1].y) / 2 : box.top + box.height * 0.40;
  const bottom = Math.min(box.top + box.height * 0.34, eyeHeight - box.height * 0.07);
  const height = box.height * 0.11;
  return {
    left: box.left + box.width * 0.31,
    top: Math.max(box.top + box.height * 0.04, bottom - height),
    width: box.width * 0.38,
    height,
  };
}

export function faceRegions(face) {
  const { box, nose } = face;
  const width = box.width * 0.18;
  const height = box.height * 0.14;
  const top = box.top + box.height * 0.58;
  const center = box.left + box.width * 0.5;
  const turn = nose ? (nose.x - center) / box.width : 0;
  const regions = { forehead: foreheadRegion(face) };
  if (turn > -0.15) regions.leftCheek = { left: box.left + box.width * 0.13, top, width, height };
  if (turn < 0.15) regions.rightCheek = { left: box.left + box.width * 0.69, top, width, height };
  return Object.fromEntries(Object.entries(regions).filter(([, region]) => insideFrame(region)));
}

export function positionIssue(face) {
  if (!face) return "missing";
  const { box } = face;
  if (box.width < 0.18 || box.height < 0.23) return "small";
  if (box.left < -0.03 || box.top < -0.03 ||
      box.left + box.width > 1.03 || box.top + box.height > 1.03) return "edge";
  return null;
}

export const manualFace = {
  box: { left: 0.25, top: 0.12, width: 0.5, height: 0.76 },
  eyes: [],
};

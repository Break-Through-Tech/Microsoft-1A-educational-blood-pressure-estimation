
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

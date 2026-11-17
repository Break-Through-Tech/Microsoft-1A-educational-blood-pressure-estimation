
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


export function createFaceOverlay(container) {
  const boxes = Array.from(container.children);
  return (regions, colors) => {
    for (const box of boxes) {
      const name = box.dataset.area;
      const area = regions[name];
      box.hidden = !area;
      if (!area) continue;

      // The preview is mirrored for the user. The camera samples are not.
      box.style.left = `${(1 - area.left - area.width) * 100}%`;
      box.style.top = `${area.top * 100}%`;
      box.style.width = `${area.width * 100}%`;
      box.style.height = `${area.height * 100}%`;
      box.classList.toggle("lit", Boolean(colors[name]));
    }
  };
}

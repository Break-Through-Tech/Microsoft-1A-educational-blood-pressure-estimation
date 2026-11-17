
export function drawWaveform(canvas, waveform) {
  const context = canvas.getContext("2d");
  const { width, height } = canvas;
  const center = height / 2;
  context.clearRect(0, 0, width, height);
  context.strokeStyle = "#b9d6cc";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, center);
  context.lineTo(width, center);
  context.stroke();

  // Show about seven seconds at the end of the rolling signal.
  const visible = waveform.slice(-175);
  if (visible.length < 2) return;
  const peak = Math.max(...visible.map(Math.abs));
  if (!peak) return;
  context.strokeStyle = "#08745a";
  context.lineWidth = 3;
  context.lineJoin = "round";
  context.beginPath();
  visible.forEach((value, i) => {
    const x = i * width / (visible.length - 1);
    const y = center - value / peak * height * 0.37;
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
}

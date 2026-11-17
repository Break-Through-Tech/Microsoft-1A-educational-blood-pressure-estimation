
export function captureFrames(video, track, signal, duration, sample) {
  return new Promise((resolve, reject) => {
    let frame;
    let firstTime;
    const timeout = setTimeout(() => finish(new Error("The camera stopped delivering frames. Try again.")), (duration + 8) * 1000);

    function finish(error) {
      clearTimeout(timeout);
      if (frame !== undefined) video.cancelVideoFrameCallback(frame);
      signal.removeEventListener("abort", cancel);
      track.removeEventListener("ended", cameraEnded);
      if (error) reject(error);
      else resolve();
    }

    const cancel = () => finish(signal.reason);
    const cameraEnded = () => finish(new Error("The camera closed. Try again."));
    if (signal.aborted) return cancel();
    if (track.readyState === "ended") return cameraEnded();
    signal.addEventListener("abort", cancel, { once: true });
    track.addEventListener("ended", cameraEnded, { once: true });

    function readFrame(now, metadata) {
      try {
        firstTime ??= metadata.mediaTime;
        const elapsed = metadata.mediaTime - firstTime;
        const finished = sample(elapsed, now);
        if (finished === true || elapsed >= duration) finish();
        else frame = video.requestVideoFrameCallback(readFrame);
      } catch (error) {
        finish(error);
      }
    }

    frame = video.requestVideoFrameCallback(readFrame);
  });
}

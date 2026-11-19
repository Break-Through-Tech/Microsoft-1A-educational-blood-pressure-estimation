
export function estimateFacePressure(samples, signal) {
  return new Promise((resolve, reject) => {
    const worker = new Worker("/local-bp/worker.js");
    const timeout = setTimeout(() => finish(new Error("Model loading took too long. Please retry.")), 180000);
    function finish(error, result) {
      clearTimeout(timeout);
      signal.removeEventListener("abort", cancel);
      worker.terminate();
      if (error) reject(error);
      else resolve(result);
    }
    const cancel = () => finish(new DOMException("Stopped", "AbortError"));
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) return cancel();
    worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.result);
    worker.onerror = () => finish(new Error("The local BP model could not load. Please retry."));
    worker.postMessage({ samples });
  });
}

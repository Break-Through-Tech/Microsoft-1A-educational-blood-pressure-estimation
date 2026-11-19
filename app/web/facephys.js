
export async function loadFacePhys(signal) {
  const worker = new Worker("/facephys/worker.js");
  let pending;
  let fatal;
  let closed = false;
  let previousTime;
  const fail = error => {
    fatal = error;
    pending?.reject(error);
    pending = undefined;
  };
  worker.onmessage = ({ data }) => {
    if (data.type === "error") return fail(new Error(data.msg));
    if (data.type !== "initDone" && data.type !== "result") return;
    pending?.resolve(data.payload);
    pending = undefined;
  };
  worker.onerror = () => fail(new Error("FacePhys could not run. Refresh and try again."));
  const close = () => {
    if (closed) return;
    closed = true;
    signal.removeEventListener("abort", close);
    fail(new DOMException("Capture stopped", "AbortError"));
    worker.terminate();
  };
  signal.addEventListener("abort", close, { once: true });
  function request(type, payload) {
    if (closed) return Promise.reject(new DOMException("Capture stopped", "AbortError"));
    if (fatal) return Promise.reject(fatal);
    return new Promise((resolve, reject) => {
      pending = { resolve, reject };
      worker.postMessage({ type, payload });
    });
  }
  try {
    signal.throwIfAborted();
    const assets = await Promise.all(["model.tflite", "proj.tflite", "state.gz"].map(async name => {
      const reply = await fetch("/facephys/" + name, { signal });
      if (!reply.ok) throw new Error("FacePhys download failed. Refresh to retry.");
      return reply;
    }));
    const [modelBuffer, projBuffer, stateJson] = await Promise.all([
      assets[0].arrayBuffer(), assets[1].arrayBuffer(),
      new Response(assets[2].body.pipeThrough(new DecompressionStream("gzip"))).json(),
    ]);
    const initialization = request("init", { modelBuffer, projBuffer, stateJson });
    const timer = setTimeout(() => fail(new Error("FacePhys took too long to load. Refresh to retry.")), 60000);
    try { await initialization; } finally { clearTimeout(timer); }
    return {
      close,
      async sample(image, time) {
        const dtVal = previousTime === undefined ? 1 / 30 : time - previousTime;
        previousTime = time;
        const result = await request("run", { imgData: image, dtVal, timestamp: time });
        if (!Number.isFinite(result.value)) throw new Error("FacePhys returned an invalid sample.");
        return result.value;
      },
    };
  } catch (error) {
    close();
    throw error;
  }
}

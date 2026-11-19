
importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js");
let setup;
async function initialize() {
  const runtime = await loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/" });
  await runtime.loadPackage(["numpy", "pandas", "scipy"]);
  for (const name of ["features.py", "predict.py"]) {
    const reply = await fetch("/local-bp/" + name);
    if (!reply.ok) throw new Error("Could not load BP features.");
    await runtime.runPythonAsync(await reply.text());
  }
  const reply = await fetch("/local-bp/trees.json.gz");
  if (!reply.ok) throw new Error("Could not load BP models.");
  const text = await new Response(reply.body.pipeThrough(new DecompressionStream("gzip"))).text();
  runtime.globals.set("exported_json", text);
  runtime.runPython("exported = json.loads(exported_json)");
  return runtime;
}
self.onmessage = async ({ data }) => {
  try {
    setup ??= initialize();
    const runtime = await setup;
    runtime.globals.set("samples_json", JSON.stringify(data.samples));
    const result = runtime.runPython("local_pressure(json.loads(samples_json), exported)");
    self.postMessage({ result: JSON.parse(result) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};

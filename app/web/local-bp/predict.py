
# Runs in Pyodide on the visitor's device.
def local_pressure(samples, exported):
    samples = np.asarray(samples, dtype=np.float32)
    if samples.shape != (751,) or not np.isfinite(samples).all():
        raise ValueError("Please capture a full face scan.")
    spread = float(np.percentile(samples, 95) - np.percentile(samples, 5))
    if spread <= 1e-8:
        raise ValueError("The camera did not capture a pulse. Try another scan.")
    # FacePhys returns a relative BVP, so use a documented fixed optical scale.
    # This adapter is experimental and does not calibrate camera PPG to clinical PPG.
    normalized = 0.5 + 0.1 * (samples - np.median(samples)) / spread
    raw = np.interp(np.arange(3750) / 125, np.arange(751) / 25, normalized).astype(np.float32)
    frame = extract_inputs(raw, globals())
    values = frame[exported["columns"]].to_numpy(dtype=np.float32)[0]
    if not np.isfinite(values).all():
        raise ValueError("Please try a clearer scan.")
    results = []
    for model in exported["models"]:
        score = np.float32(model["base"])
        for tree in model["trees"]:
            node = 0
            while tree["left_children"][node] != -1:
                feature = tree["split_indices"][node]
                threshold = np.float32(tree["split_conditions"][node])
                node = tree["left_children"][node] if values[feature] < threshold else tree["right_children"][node]
            score = np.float32(score + np.float32(tree["split_conditions"][node]))
        results.append(round(float(score)))
    if results[0] <= results[1]:
        raise ValueError("Please try another scan.")
    return json.dumps({"sbp": results[0], "dbp": results[1]})

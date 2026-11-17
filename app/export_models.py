"""Prepare the notebook's training data and export both XGBoost regressors."""

import ast
import json

from server import APP, MODEL_DIR


def main():
    path = APP.parent / "notebooks/final.ipynb"
    notebook = json.loads(path.read_text(encoding="utf-8"))
    scope = {}
    for cell in notebook["cells"]:
        if cell["id"] == "smoothing-functions":
            break
        if cell["cell_type"] == "code":
            exec(compile("".join(cell["source"]), cell["id"], "exec"), scope)

    # Read the estimator settings from the checked-in notebook.
    model_cell = next(c for c in notebook["cells"] if c["id"] == "model-code")
    tree = ast.parse("".join(model_cell["source"]))
    constructor = next(
        node for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
        and node.func.id == "XGBRegressor"
    )
    settings = {
        item.arg: scope["threads"] if item.arg == "n_jobs" else ast.literal_eval(item.value)
        for item in constructor.keywords
    }

    from xgboost import XGBRegressor

    frame, features = scope["frame"], scope["feature_names"]
    train, validation = (frame.loc[frame.split.eq(s)] for s in ("train", "validation"))
    x_train, x_val = [part[features].to_numpy(dtype="float32") for part in (train, validation)]
    MODEL_DIR.mkdir(exist_ok=True)
    for target in ("sbp", "dbp"):
        model = XGBRegressor(**settings)
        model.fit(x_train, train[target], eval_set=[(x_val, validation[target])], verbose=250)
        model.save_model(MODEL_DIR / f"{target}.ubj")
    (MODEL_DIR / "features.json").write_text(json.dumps(features), encoding="utf-8")


if __name__ == "__main__":
    main()

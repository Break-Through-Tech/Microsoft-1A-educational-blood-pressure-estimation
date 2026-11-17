"""Package the browser demo and trained models for upload to Replit."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


APP = Path(__file__).resolve().parent
REPO = APP.parent


def main():
    files = [
        "app/server.py", "app/requirements.txt",
        "app/web/index.html", "app/web/capture.js", "app/web/style.css",
        "app/models/features.json", "app/models/sbp.ubj", "app/models/dbp.ubj",
        "notebooks/final.ipynb",
    ]
    missing = [name for name in files if not (REPO / name).is_file()]
    if missing:
        raise SystemExit("Missing deployment files. Run python app/export_models.py if models are missing.\n"
                         + "\n".join(missing))
    output = APP / "dist" / "Pulse2BP-Replit.zip"
    output.parent.mkdir(exist_ok=True)
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        archive.write(APP / "replit.toml", ".replit")
        for name in files:
            archive.write(REPO / name, name)
    print(output)


if __name__ == "__main__":
    main()

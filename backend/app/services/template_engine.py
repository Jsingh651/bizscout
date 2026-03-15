"""
Template engine for demo website generation.
Reads HTML/CSS/JS from app/templates/<name>/ and replaces {{variable}} placeholders.
Returns a single HTML string with inlined styles and scripts for iframe preview.
"""
import json
from pathlib import Path
from typing import Optional

APP_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = APP_DIR / "templates"


def _read(path: Path) -> str:
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8")


def _replace_variables(content: str, variables: dict) -> str:
    for key, value in variables.items():
        placeholder = "{{" + key + "}}"
        content = content.replace(placeholder, str(value))
    return content


def get_template_root(template_name: str) -> Optional[Path]:
    """Resolve template folder: app/templates/<template_name>/."""
    candidate = TEMPLATES_DIR / template_name
    if (candidate / "index.html").is_file():
        return candidate
    return None


def render_template(template_name: str, variables: dict) -> str:
    """
    Render a template with the given variables.
    - Reads index.html, style.css, script.js from the template folder.
    - Replaces all {{key}} with variables[key] in each file.
    - Inlines CSS and JS into the HTML and returns one HTML string.
    """
    root = get_template_root(template_name)
    if not root:
        raise FileNotFoundError(f"Template not found: {template_name}")

    html = _read(root / "index.html")
    css = _read(root / "style.css")
    js = _read(root / "script.js")

    html = _replace_variables(html, variables)
    css = _replace_variables(css, variables)
    js = _replace_variables(js, variables)

    # Inline CSS: replace <link rel="stylesheet" href="style.css"> with <style>...</style>
    link_tag = '<link rel="stylesheet" href="style.css">'
    style_block = f"<style>\n{css}\n</style>"
    html = html.replace(link_tag, style_block)

    # Inline JS: replace <script src="script.js"></script> with <script>...</script>
    script_tag = '<script src="script.js"></script>'
    script_block = f"<script>\n{js}\n</script>"
    html = html.replace(script_tag, script_block)

    return html


def list_templates() -> list[dict]:
    """List available templates (each subdir of app/templates/ that has index.html)."""
    result = []
    if not TEMPLATES_DIR.is_dir():
        return result
    for path in sorted(TEMPLATES_DIR.iterdir()):
        if path.is_dir() and (path / "index.html").is_file():
            config = {}
            config_path = path / "config.json"
            if config_path.is_file():
                try:
                    config = json.loads(config_path.read_text(encoding="utf-8"))
                except Exception:
                    pass
            result.append({"name": path.name, "config": config})
    return result

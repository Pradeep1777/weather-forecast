import ast
import io
import json
import os
import re
import sys
import tokenize


def strip_code(src: str) -> str:
    lines = src.split("\n")

    # Docstrings: a plain string as the first statement of a module/function/class
    drop = set()
    for node in ast.walk(ast.parse(src)):
        if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            body = node.body
            if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant) \
                    and isinstance(body[0].value.value, str):
                drop.update(range(body[0].lineno - 1, body[0].end_lineno))

    # Comments: only real COMMENT tokens, so a "#" inside a string is kept
    cuts = {}
    for tok in tokenize.generate_tokens(io.StringIO(src).readline):
        if tok.type == tokenize.COMMENT:
            cuts[tok.start[0] - 1] = tok.start[1]

    out = []
    for i, line in enumerate(lines):
        if i in drop:
            continue
        if i in cuts:
            line = line[:cuts[i]].rstrip()
            if not line.strip():
                continue
        out.append(line)

    return re.sub(r"\n{3,}", "\n\n", "\n".join(out).strip("\n"))


def strip_notebook(src_path: str, dst_path: str) -> None:
    with open(src_path, encoding="utf-8") as f:
        nb = json.load(f)

    cells = []
    for cell in nb["cells"]:
        src = "".join(cell["source"]) if isinstance(cell["source"], list) else cell["source"]
        if cell["cell_type"] == "code":
            code = strip_code(src)
            if code:
                cells.append({"cell_type": "code", "execution_count": None,
                              "metadata": {}, "outputs": [], "source": code})
        elif cell["cell_type"] == "markdown":
            headings = [line for line in src.splitlines() if line.startswith("#")]
            if headings:
                cells.append({"cell_type": "markdown", "metadata": {}, "source": "\n".join(headings)})

    # A heading with nothing after it (e.g. "Summary") is dropped
    while cells and cells[-1]["cell_type"] == "markdown":
        cells.pop()

    clean = {"cells": cells, "metadata": nb["metadata"],
             "nbformat": nb["nbformat"], "nbformat_minor": nb["nbformat_minor"]}
    with open(dst_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(clean, f, indent=1, ensure_ascii=False)
        f.write("\n")


def execute_notebook(nb_path: str, run_dir: str) -> None:
    import nbformat
    from nbclient import NotebookClient

    nb = nbformat.read(nb_path, as_version=4)
    NotebookClient(nb, timeout=900, kernel_name="python3",
                   resources={"metadata": {"path": run_dir}}).execute()
    with open(nb_path, "w", encoding="utf-8", newline="\n") as f:
        nbformat.write(nb, f)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--execute"]
    if len(args) != 2:
        sys.exit("usage: python tools/strip_notebook.py <explained.ipynb> <clean.ipynb> [--execute]")
    src_path, dst_path = args
    strip_notebook(src_path, dst_path)
    if "--execute" in sys.argv:
        execute_notebook(dst_path, os.path.dirname(os.path.abspath(src_path)))
        print(f"{dst_path} written (comment-free copy of {src_path}, with outputs)")
    else:
        print(f"{dst_path} written (comment-free copy of {src_path})")

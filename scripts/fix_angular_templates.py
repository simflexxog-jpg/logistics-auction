from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent / 'src'
html_files = sorted(root.rglob('*.html'))

IF_RE = re.compile(r'@if\s*\(([^)]*)\)\s*\{')
FOR_RE = re.compile(r'@for\s*\(([^)]*)\)\s*\{')
ELSE_IF_RE = re.compile(r'\}\s*@else\s*if\s*\(([^)]*)\)\s*\{')
ELSE_RE = re.compile(r'\}\s*@else\s*\{')
TRACK_RE = re.compile(r'track\s+[^;\n]+')
INDEX_RE = re.compile(r'\$index')


def convert_for(expr: str) -> str:
    parts = [part.strip() for part in expr.split(';') if part.strip()]
    if not parts:
        return '<ng-container *ngFor="let item of []">'

    loop_expr = parts[0]
    if not loop_expr.startswith('let '):
        loop_expr = 'let ' + loop_expr

    extras = []
    for part in parts[1:]:
        part = TRACK_RE.sub('', part).strip()
        if not part:
            continue
        part = INDEX_RE.sub('index', part)
        extras.append(part)

    directive = f'*ngFor="{loop_expr}'
    if extras:
        directive += '; ' + '; '.join(extras)
    directive += '"'
    return f'<ng-container {directive}>'


INLINE_IF_RE = re.compile(r'^(\s*)@if\s*\(([^)]*)\)\s*\{\s*(.*)\s*\}\s*$', re.DOTALL)
INLINE_FOR_RE = re.compile(r'^(\s*)@for\s*\(([^)]*)\)\s*\{\s*(.*)\s*\}\s*$', re.DOTALL)
ELSE_IF_LINE_RE = re.compile(r'^(\s*)\}\s*@else\s*if\s*\(([^)]*)\)\s*\{\s*$')
ELSE_LINE_RE = re.compile(r'^(\s*)\}\s*@else\s*\{\s*$')
IF_OPEN_LINE_RE = re.compile(r'^(\s*)@if\s*\(([^)]*)\)\s*\{\s*$')
FOR_OPEN_LINE_RE = re.compile(r'^(\s*)@for\s*\(([^)]*)\)\s*\{\s*$')
CLOSE_LINE_RE = re.compile(r'^(\s*)\}\s*$')


def convert_for(expr: str) -> str:
    parts = [part.strip() for part in expr.split(';') if part.strip()]
    if not parts:
        return '*ngFor="let item of []"'

    loop_expr = parts[0]
    if not loop_expr.startswith('let '):
        loop_expr = 'let ' + loop_expr

    extras = []
    for part in parts[1:]:
        if part.startswith('track '):
            continue
        part = INDEX_RE.sub('index', part)
        extras.append(part)

    directive = f'*ngFor="{loop_expr}'
    if extras:
        directive += '; ' + '; '.join(extras)
    directive += '"'
    return directive


def transform_text(text: str) -> str:
    lines = []
    for line in text.splitlines():
        inline_if = INLINE_IF_RE.match(line)
        if inline_if:
            indent, condition, content = inline_if.groups()
            content = content.strip()
            lines.append(f'{indent}<ng-container *ngIf="{condition}">{content}</ng-container>')
            continue

        inline_for = INLINE_FOR_RE.match(line)
        if inline_for:
            indent, expr, content = inline_for.groups()
            content = content.strip()
            lines.append(f'{indent}<ng-container {convert_for(expr)}>{content}</ng-container>')
            continue

        if m := ELSE_IF_LINE_RE.match(line):
            indent, condition = m.groups()
            lines.append(f'{indent}</ng-container><ng-container *ngIf="{condition}">')
            continue

        if m := ELSE_LINE_RE.match(line):
            lines.append(f'{m.group(1)}</ng-container><ng-container *ngIf="true">')
            continue

        if m := IF_OPEN_LINE_RE.match(line):
            indent, condition = m.groups()
            lines.append(f'{indent}<ng-container *ngIf="{condition}">')
            continue

        if m := FOR_OPEN_LINE_RE.match(line):
            indent, expr = m.groups()
            lines.append(f'{indent}{convert_for(expr)}')
            continue

        if m := CLOSE_LINE_RE.match(line):
            indent = m.group(1)
            lines.append(f'{indent}</ng-container>')
            continue

        lines.append(line)

    result = '\n'.join(lines)
    result = re.sub(r'\{\{\s*(.*?)\s*</ng-container>\s*\}\}', r'{{ \1 }}', result)
    result = re.sub(r'</ng-container>\s*<ng-container \*ngIf="!\(false\)"\s*>', '', result)
    result = re.sub(r'\*ngFor="([^"]*)track\s+[^"]*"', r'*ngFor="\1"', result)
    return result


for path in html_files:
    text = path.read_text(encoding='utf-8')
    if '@if' not in text and '@for' not in text:
        continue

    new_text = transform_text(text)
    if new_text != text:
        path.write_text(new_text, encoding='utf-8')
        print(f'Updated {path.relative_to(root)}')

print('Done')

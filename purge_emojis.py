import os

REPLACEMENTS = {
    '\u2013': '-',
    '\u2014': '-',
    '\u2026': '...',
    '\u2192': '->',
    '\u2500': '-',
    '\u2502': '|',
    '\u2514': '\\',
    '\u251c': '|',
    '\u2550': '=',
    '\u2551': '|',
    '\u2554': '+',
    '\u2557': '+',
    '\u255a': '+',
    '\u255d': '+',
    '\u25b8': '>',
    '\u25bc': 'V',
    '\u2018': "'",
    '\u2019': "'",
    '\u201c': '"',
    '\u201d': '"',
    '\u00b7': '.',
}

src_dir = '/home/mersel/Documents/Projects/VS_Extension/src'

for fname in sorted(os.listdir(src_dir)):
    if not fname.endswith('.ts'):
        continue
    fpath = os.path.join(src_dir, fname)
    content = open(fpath, 'r', encoding='utf-8').read()
    original = content
    for old, new in REPLACEMENTS.items():
        content = content.replace(old, new)
    if content != original:
        open(fpath, 'w', encoding='utf-8').write(content)
        print(f'Modified: {fname}')

print('\nDone. Checking remaining non-ASCII:')
for fname in sorted(os.listdir(src_dir)):
    if not fname.endswith('.ts'):
        continue
    fpath = os.path.join(src_dir, fname)
    content = open(fpath, 'r', encoding='utf-8').read()

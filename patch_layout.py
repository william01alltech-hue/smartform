import sys

with open("admin-web/src/App.tsx", "r") as f:
    content = f.read()

target = "<main style={{ flex: 1, padding: '24px 30px', display: 'grid', gridTemplateColumns: [(showAuth || showConfig) ? 'minmax(0, 1.2fr)' : '', showPreview ? 'minmax(0, 1.5fr)' : '', showAppUI ? 'minmax(0, 0.8fr)' : ''].filter(Boolean).join(' '), gap: '24px', boxSizing: 'border-box' }}>"
replacement = "<main className=\"main-layout\" style={{ gridTemplateColumns: [(showAuth || showConfig) ? 'minmax(0, 1.2fr)' : '', showPreview ? 'minmax(0, 1.5fr)' : '', showAppUI ? 'minmax(0, 0.8fr)' : ''].filter(Boolean).join(' ') }}>"

content = content.replace(target, replacement)

with open("admin-web/src/App.tsx", "w") as f:
    f.write(content)

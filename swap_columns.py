import sys

with open("admin-web/src/App.tsx", "r") as f:
    lines = f.readlines()

preview_start = -1
preview_end = -1
config_start = -1
config_end = -1
main_start = -1
main_end = -1

for i, line in enumerate(lines):
    if "{/* Main dashboard content */}" in line:
        main_start = i
    elif "{/* Column 1 (Right): Excel visual layout preview & cell click */}" in line:
        preview_start = i
    elif "{/* Column 2 (Left): File Upload & Configuration parameters mapping grid */}" in line:
        preview_end = i
        config_start = i
    elif "{/* Right column: Simulated mobile App form UI rendering preview */}" in line:
        config_end = i
    elif "</main>" in line:
        main_end = i

print(f"preview_start: {preview_start}")
print(f"preview_end: {preview_end}")
print(f"config_start: {config_start}")
print(f"config_end: {config_end}")

if preview_start != -1 and preview_end != -1 and config_start != -1 and config_end != -1:
    # swap gridTemplateColumns order
    old_grid = "[showPreview ? 'minmax(0, 1.5fr)' : '', (showAuth || showConfig) ? 'minmax(0, 1.2fr)' : '', showAppUI ? 'minmax(0, 0.8fr)' : '']"
    new_grid = "[(showAuth || showConfig) ? 'minmax(0, 1.2fr)' : '', showPreview ? 'minmax(0, 1.5fr)' : '', showAppUI ? 'minmax(0, 0.8fr)' : '']"
    for i in range(main_start, preview_start):
        if old_grid in lines[i]:
            lines[i] = lines[i].replace(old_grid, new_grid)

    preview_block = lines[preview_start:preview_end]
    config_block = lines[config_start:config_end]

    new_lines = lines[:preview_start] + config_block + preview_block + lines[config_end:]

    with open("admin-web/src/App.tsx", "w") as f:
        f.writelines(new_lines)
    print("Swapped successfully")

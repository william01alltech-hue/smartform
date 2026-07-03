import sys

with open("admin-web/src/App.tsx", "r") as f:
    lines = f.readlines()

top_controls_start = -1
top_controls_end = -1
lang_switcher_idx = -1

for i, line in enumerate(lines):
    if "{/* Top Header Controls */}" in line:
        top_controls_start = i
    if line.strip() == "{/* Main dashboard content */}":
        top_controls_end = i - 1 # up to the empty line before it
    if line.strip() == "{/* Language Switcher dropdown */}":
        lang_switcher_idx = i

if top_controls_start != -1 and top_controls_end != -1 and lang_switcher_idx != -1:
    # Extract the block
    top_controls_block = lines[top_controls_start:top_controls_end]
    
    # Remove it from the original position
    del lines[top_controls_start:top_controls_end]
    
    # Find the new position for lang_switcher after removing top controls (if it was after, but it's not)
    
    # Change the margin and alignItems
    for i, line in enumerate(top_controls_block):
        if "margin: '16px 30px 0'" in line:
            top_controls_block[i] = line.replace("margin: '16px 30px 0', display: 'flex', gap: '24px'", "margin: '0 30px', flex: 1, alignItems: 'stretch', display: 'flex', gap: '24px'")
            break

    # Insert it before the Language Switcher
    lines[lang_switcher_idx:lang_switcher_idx] = top_controls_block
    
    with open("admin-web/src/App.tsx", "w") as f:
        f.writelines(lines)
    print("Successfully moved Top Header Controls into the Header.")
else:
    print(f"Could not find required anchors. start={top_controls_start} end={top_controls_end} lang={lang_switcher_idx}")


import sys

with open("admin-web/src/App.tsx", "r") as f:
    lines = f.readlines()

main_start = -1
col_auth_start = -1
col_app_start = -1
col_excel_start = -1
main_end = -1

for i, line in enumerate(lines):
    if "{/* Main dashboard content */}" in line:
        main_start = i
    elif "{/* Column 2 (Left): File Upload & Configuration parameters mapping grid */}" in line:
        col_auth_start = i
    elif "{/* Right column: Simulated mobile App form UI rendering preview */}" in line:
        col_app_start = i
    elif "{/* Column 1 (Right): Excel visual layout preview & cell click */}" in line:
        col_excel_start = i
    elif line.strip() == "</main>":
        main_end = i
        
if main_start != -1 and col_auth_start != -1 and col_app_start != -1 and col_excel_start != -1 and main_end != -1:
    # Validate the order
    if not (main_start < col_auth_start < col_app_start < col_excel_start < main_end):
        print("Order of anchors is unexpected.")
        sys.exit(1)
        
    # Extract the blocks
    auth_block = lines[col_auth_start:col_app_start]
    app_block = lines[col_app_start:col_excel_start]
    excel_block = lines[col_excel_start:main_end]
    
    # We also need to change the gridTemplateColumns
    # Let's find the <main style={{...}}> tag right after main_start
    main_tag_idx = -1
    for i in range(main_start, col_auth_start):
        if "<main " in lines[i]:
            main_tag_idx = i
            break
            
    if main_tag_idx != -1:
        # replace gridTemplateColumns
        lines[main_tag_idx] = lines[main_tag_idx].replace(
            "gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)'", 
            "gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1.2fr) minmax(0, 0.8fr)'"
        )
    
    # Reassemble in the new order: Excel -> Auth -> App
    new_lines = lines[:col_auth_start] + excel_block + auth_block + app_block + lines[main_end:]
    
    with open("admin-web/src/App.tsx", "w") as f:
        f.writelines(new_lines)
    print("Successfully reordered columns.")
else:
    print("Could not find all required anchors.")

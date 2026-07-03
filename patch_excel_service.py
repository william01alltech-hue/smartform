import sys

with open("backend-api/src/services/excelService.ts", "r") as f:
    content = f.read()

# 1. Update signature
content = content.replace("imageBuffers: Record<string, Buffer>,", "imageBuffers: Record<string, Buffer[]>,")

# 2. Update image logic
# It iterates: `for (const name of Object.keys(imageBuffers)) {`
# Inside: `const fileBuffer = imageBuffers[name];` -> wait, I used `files[name]` earlier? Ah, it maps `imageBuffers` to `files`.

old_img_start = """
      // Handle images (Wait for worksheet.addImage, etc.)
      const files = imageBuffers;
      for (const name of Object.keys(files)) {
        const fieldConfig = customFields
          ? customFields.find((f) => f.name === name)
          : undefined;

        if (fieldConfig) {
          const parsedRange = parseRangeString(fieldConfig.rangeStr);
          if (!parsedRange) continue;

          const sheetName = parsedRange.sheetName || workbook.worksheets[0].name;
          const worksheet = workbook.getWorksheet(sheetName);
          if (!worksheet) continue;

          const fileBuffer = files[name];
          if (fileBuffer) {
"""

new_img_start = """
      // Handle images (Wait for worksheet.addImage, etc.)
      const files = imageBuffers;
      for (const name of Object.keys(files)) {
        const fieldConfig = customFields
          ? customFields.find((f) => f.name === name)
          : undefined;

        if (fieldConfig) {
          const parsedRange = parseRangeString(fieldConfig.rangeStr);
          if (!parsedRange) continue;

          const sheetName = parsedRange.sheetName || workbook.worksheets[0].name;
          const worksheet = workbook.getWorksheet(sheetName);
          if (!worksheet) continue;

          const fileBuffers = files[name];
          if (fileBuffers && fileBuffers.length > 0) {
"""
content = content.replace(old_img_start, new_img_start)

# We need to replace the core logic to loop through `fileBuffers`
# The original logic has:
old_core = """
          const fileBuffer = files[name];
          if (fileBuffer) {
            // Add image to workbook
            const imageId = workbook.addImage({
              buffer: fileBuffer as any,
              extension: 'jpeg', // Or detect extension
            });

            const mode = (fieldConfig as any)?.imageSizeMode || 'fill';
            
            // Check if this cell is part of a merge range
            let effectiveStartCol = parsedRange.startCol;
            let effectiveEndCol = parsedRange.endCol;
            let effectiveStartRow = parsedRange.startRow;
            let effectiveEndRow = parsedRange.endRow;

            const merges = worksheet.model.merges || [];
            for (const mergeRange of merges) {
              const [tl, br] = mergeRange.split(':');
              const decodedTl = parseRangeString(`${parsedRange.sheetName}!${tl}`);
              const decodedBr = parseRangeString(`${parsedRange.sheetName}!${br || tl}`);
              if (
                decodedTl && decodedBr &&
                parsedRange.startCol >= decodedTl.startCol &&
                parsedRange.startCol <= decodedBr.endCol &&
                parsedRange.startRow >= decodedTl.startRow &&
                parsedRange.startRow <= decodedBr.endRow
              ) {
                effectiveStartCol = decodedTl.startCol;
                effectiveEndCol = decodedBr.endCol;
                effectiveStartRow = decodedTl.startRow;
                effectiveEndRow = decodedBr.endRow;
                break;
              }
            }
            
            if (mode === 'fill') {
              // Place the image precisely in the range (Stretches)
              worksheet.addImage(imageId, {
                tl: { col: effectiveStartCol - 1, row: effectiveStartRow - 1 } as any,
                br: { col: effectiveEndCol, row: effectiveEndRow } as any,
                editAs: 'oneCell'
              });
            } else {
              // Calculate cell pixel dimensions based on effective merged bounds
              let rangeWidthPx = 0;
              for (let c = effectiveStartCol; c <= effectiveEndCol; c++) {
                const w = worksheet.getColumn(c).width;
                rangeWidthPx += Math.round((w !== undefined && w > 0 ? w : 9) * 8); // approx 8 px per character
              }
              let rangeHeightPx = 0;
              for (let r = effectiveStartRow; r <= effectiveEndRow; r++) {
                const h = worksheet.getRow(r).height;
                rangeHeightPx += Math.round((h !== undefined && h > 0 ? h : 15) * 1.3333); // approx 1.33 px per point
              }

              let extWidthPx = rangeWidthPx;
              let extHeightPx = rangeHeightPx;
              let offsetX_Px = 0;
              let offsetY_Px = 0;

              if (mode === 'padding10') {
                const paddingPx = 13; // ~10pt
                extWidthPx = Math.max(10, rangeWidthPx - 2 * paddingPx);
                extHeightPx = Math.max(10, rangeHeightPx - 2 * paddingPx);
                offsetX_Px = paddingPx;
                offsetY_Px = paddingPx;
              } else if (mode === 'contain') {
                const imgAspect = fieldConfig?.aspectRatio || 1.3333;
                const cellAspect = rangeWidthPx / rangeHeightPx;

                if (cellAspect > imgAspect) {
                  // Cell is wider than image. Height dictates scale.
                  extHeightPx = rangeHeightPx;
                  extWidthPx = Math.round(extHeightPx * imgAspect);
                  offsetX_Px = Math.round((rangeWidthPx - extWidthPx) / 2);
                } else {
                  // Cell is taller than image. Width dictates scale.
                  extWidthPx = rangeWidthPx;
                  extHeightPx = Math.round(extWidthPx / imgAspect);
                  offsetY_Px = Math.round((rangeHeightPx - extHeightPx) / 2);
                }
              }

              // Calculate fractional offset based on the FIRST column/row of the MERGED cell
              const firstColW = worksheet.getColumn(effectiveStartCol).width || 9;
              const firstColPx = Math.round(firstColW * 8);
              const colFraction = firstColPx > 0 ? (offsetX_Px / firstColPx) : 0;

              const firstRowH = worksheet.getRow(effectiveStartRow).height || 15;
              const firstRowPx = Math.round(firstRowH * 1.3333);
              const rowFraction = firstRowPx > 0 ? (offsetY_Px / firstRowPx) : 0;

              worksheet.addImage(imageId, {
                tl: { 
                  col: (effectiveStartCol - 1) + colFraction, 
                  row: (effectiveStartRow - 1) + rowFraction 
                } as any,
                ext: { width: extWidthPx, height: extHeightPx },
                editAs: 'oneCell'
              });
            }
          }
"""

new_core = """
          const fileBuffers = files[name];
          if (fileBuffers && fileBuffers.length > 0) {
            
            // Check if this cell is part of a merge range
            let effectiveStartCol = parsedRange.startCol;
            let effectiveEndCol = parsedRange.endCol;
            let effectiveStartRow = parsedRange.startRow;
            let effectiveEndRow = parsedRange.endRow;

            const merges = worksheet.model.merges || [];
            for (const mergeRange of merges) {
              const [tl, br] = mergeRange.split(':');
              const decodedTl = parseRangeString(`${parsedRange.sheetName}!${tl}`);
              const decodedBr = parseRangeString(`${parsedRange.sheetName}!${br || tl}`);
              if (
                decodedTl && decodedBr &&
                parsedRange.startCol >= decodedTl.startCol &&
                parsedRange.startCol <= decodedBr.endCol &&
                parsedRange.startRow >= decodedTl.startRow &&
                parsedRange.startRow <= decodedBr.endRow
              ) {
                effectiveStartCol = decodedTl.startCol;
                effectiveEndCol = decodedBr.endCol;
                effectiveStartRow = decodedTl.startRow;
                effectiveEndRow = decodedBr.endRow;
                break;
              }
            }

            const mode = (fieldConfig as any)?.imageSizeMode || 'fill';
            const count = fileBuffers.length;

            // Calculate cell pixel dimensions based on effective merged bounds
            let rangeWidthPx = 0;
            for (let c = effectiveStartCol; c <= effectiveEndCol; c++) {
              const w = worksheet.getColumn(c).width;
              rangeWidthPx += Math.round((w !== undefined && w > 0 ? w : 9) * 8);
            }
            let rangeHeightPx = 0;
            for (let r = effectiveStartRow; r <= effectiveEndRow; r++) {
              const h = worksheet.getRow(r).height;
              rangeHeightPx += Math.round((h !== undefined && h > 0 ? h : 15) * 1.3333);
            }

            const firstColW = worksheet.getColumn(effectiveStartCol).width || 9;
            const firstColPx = Math.round(firstColW * 8);
            const firstRowH = worksheet.getRow(effectiveStartRow).height || 15;
            const firstRowPx = Math.round(firstRowH * 1.3333);

            // Determine grid
            let cols = 1;
            let rows = 1;
            if (count === 2) {
              if (rangeWidthPx > rangeHeightPx) {
                cols = 2; rows = 1;
              } else {
                cols = 1; rows = 2;
              }
            } else if (count >= 3) {
              cols = 2; rows = 2;
            }

            const cellWidthPx = rangeWidthPx / cols;
            const cellHeightPx = rangeHeightPx / rows;

            fileBuffers.slice(0, 4).forEach((fileBuffer, idx) => {
              const imageId = workbook.addImage({
                buffer: fileBuffer as any,
                extension: 'jpeg',
              });

              const gridCol = idx % cols;
              const gridRow = Math.floor(idx / cols);

              const gridOffsetX = gridCol * cellWidthPx;
              const gridOffsetY = gridRow * cellHeightPx;

              if (mode === 'fill') {
                // Approximate tl and br using fractions
                worksheet.addImage(imageId, {
                  tl: { 
                    col: (effectiveStartCol - 1) + ((gridOffsetX) / firstColPx), 
                    row: (effectiveStartRow - 1) + ((gridOffsetY) / firstRowPx) 
                  } as any,
                  ext: { width: cellWidthPx, height: cellHeightPx },
                  editAs: 'oneCell'
                });
              } else {
                let extWidthPx = cellWidthPx;
                let extHeightPx = cellHeightPx;
                let offsetX_Px = 0;
                let offsetY_Px = 0;

                if (mode === 'padding10') {
                  const paddingPx = count > 1 ? 5 : 13;
                  extWidthPx = Math.max(10, cellWidthPx - 2 * paddingPx);
                  extHeightPx = Math.max(10, cellHeightPx - 2 * paddingPx);
                  offsetX_Px = paddingPx;
                  offsetY_Px = paddingPx;
                } else if (mode === 'contain') {
                  const imgAspect = fieldConfig?.aspectRatio || 1.3333;
                  const cellAspect = cellWidthPx / cellHeightPx;

                  if (cellAspect > imgAspect) {
                    extHeightPx = cellHeightPx;
                    extWidthPx = Math.round(extHeightPx * imgAspect);
                    offsetX_Px = Math.round((cellWidthPx - extWidthPx) / 2);
                  } else {
                    extWidthPx = cellWidthPx;
                    extHeightPx = Math.round(extWidthPx / imgAspect);
                    offsetY_Px = Math.round((cellHeightPx - extHeightPx) / 2);
                  }
                }

                const finalOffsetX = gridOffsetX + offsetX_Px;
                const finalOffsetY = gridOffsetY + offsetY_Px;

                const colFraction = firstColPx > 0 ? (finalOffsetX / firstColPx) : 0;
                const rowFraction = firstRowPx > 0 ? (finalOffsetY / firstRowPx) : 0;

                worksheet.addImage(imageId, {
                  tl: { 
                    col: (effectiveStartCol - 1) + colFraction, 
                    row: (effectiveStartRow - 1) + rowFraction 
                  } as any,
                  ext: { width: extWidthPx, height: extHeightPx },
                  editAs: 'oneCell'
                });
              }
            });
          }
"""
content = content.replace(old_core, new_core)

with open("backend-api/src/services/excelService.ts", "w") as f:
    f.write(content)


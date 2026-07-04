import ExcelJS from 'exceljs';

export interface FormField {
  name: string;
  type: 'text' | 'image';
  label: string; // The parsed display label
  sheetName: string;
  rangeStr: string;
  widthPx: number;
  heightPx: number;
  aspectRatio: number;
  resolutionTag: 'small' | 'medium' | 'large';
}

export interface VisualCell {
  address: string;
  value: string;
  row: number;
  col: number;
  isMerged: boolean;
  masterAddress?: string;
  rowSpan?: number;
  colSpan?: number;
  isSlave?: boolean;
  style?: {
    backgroundColor?: string;
    color?: string;
    fontWeight?: string;
    fontStyle?: string;
    fontSize?: string;
    textAlign?: string;
    verticalAlign?: string;
    borderTop?: string;
    borderLeft?: string;
    borderBottom?: string;
    borderRight?: string;
    textDecoration?: string;
    wrapText?: boolean;
  };
}

export interface VisualSheet {
  name: string;
  rows: VisualCell[][];
  columnWidths: number[];
  rowHeights: number[];
}

export interface FormConfig {
  fields: FormField[];
  visualSheets?: VisualSheet[];
}

// Convert Excel column letters (A, B, C...) to 1-based index numbers
function colLetterToNumber(col: string): number {
  let num = 0;
  for (let i = 0; i < col.length; i++) {
    num = num * 26 + (col.toUpperCase().charCodeAt(i) - 64);
  }
  return num;
}

// Convert 1-based index to Excel column letters (A, B, C...)
function colNumberToLetter(num: number): string {
  let temp;
  let letter = '';
  while (num > 0) {
    temp = (num - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    num = (num - temp - 1) / 26;
  }
  return letter;
}

// Parse Excel range address like 'Sheet1'!$A$1:$B$2 or Sheet1!$A$1
interface ParsedRange {
  sheetName: string;
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
}

function parseRangeString(rangeStr: string): ParsedRange | null {
  // Regex to extract sheet name and start/end coordinates
  // Matches: 'Sheet Name'!$A$1:$B$2 or Sheet1!A1
  const regex = /^(?:'([^']+)'|([^!]+))!\$?([A-Za-z]+)\$?([0-9]+)(?::\$?([A-Za-z]+)\$?([0-9]+))?$/;
  const match = rangeStr.match(regex);
  if (!match) return null;

  const sheetName = match[1] || match[2];
  const startColStr = match[3];
  const startRowStr = match[4];
  const endColStr = match[5] || startColStr;
  const endRowStr = match[6] || startRowStr;

  return {
    sheetName,
    startCol: colLetterToNumber(startColStr),
    startRow: parseInt(startRowStr, 10),
    endCol: colLetterToNumber(endColStr),
    endRow: parseInt(endRowStr, 10)
  };
}

export class ExcelService {
  /**
   * Parses an Excel template from buffer and extracts form configuration
   */
  public static async parseTemplate(buffer: Buffer): Promise<FormConfig> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const fields: FormField[] = [];

    // exceljs definedNames model is an array of DefinedNamesRanges
    const definedNames = workbook.definedNames.model;
    
    definedNames.forEach((definedName) => {
      const name = definedName.name;
      // Get the first range address associated with this name
      const ranges = definedName.ranges;
      if (!ranges || ranges.length === 0) return;

      const rangeStr = ranges[0];
      const parsedRange = parseRangeString(rangeStr);
      if (!parsedRange) return;

      const worksheet = workbook.getWorksheet(parsedRange.sheetName);
      if (!worksheet) return;

      // Calculate total width and height of the range
      let totalWidthChars = 0;
      for (let c = parsedRange.startCol; c <= parsedRange.endCol; c++) {
        const col = worksheet.getColumn(c);
        // Default column width is roughly 9.14 chars in Calibri 11
        totalWidthChars += (col.width !== undefined && col.width > 0) ? col.width : 9.14;
      }

      let totalHeightPts = 0;
      for (let r = parsedRange.startRow; r <= parsedRange.endRow; r++) {
        const row = worksheet.getRow(r);
        // Default row height is roughly 15pt
        totalHeightPts += (row.height !== undefined && row.height > 0) ? row.height : 15;
      }

      // Convert characters and points to Pixels
      const baseWidthPx = totalWidthChars * 8;
      const baseHeightPx = totalHeightPts * 1.333;
      
      const widthPx = Math.round(baseWidthPx * 3);
      const heightPx = Math.round(baseHeightPx * 3);
      
      const aspectRatio = parseFloat((widthPx / heightPx).toFixed(4));

      // Determine resolution tag based on long side
      const longSide = Math.max(widthPx, heightPx);
      let resolutionTag: 'small' | 'medium' | 'large' = 'medium';
      if (longSide < 800) {
        resolutionTag = 'small';
      } else if (longSide > 1280) {
        resolutionTag = 'large';
      }

      // Type auto-detection based on the name (e.g. Photo, Image, Pic)
      const isImage = /photo|image|pic|img/i.test(name);
      const type = isImage ? 'image' : 'text';

      fields.push({
        name,
        type,
        label: name.replace(/_/g, ' '), // Prettify name as label
        sheetName: parsedRange.sheetName,
        rangeStr,
        widthPx,
        heightPx,
        aspectRatio,
        resolutionTag
      });
    });

    // Extract the visual grid preview for each worksheet with custom styles & merges
    const visualSheets: VisualSheet[] = [];
    workbook.worksheets.forEach((worksheet) => {
      // Map of cell address to merge details
      const mergeInfo: Record<string, { master: string; rowSpan: number; colSpan: number; isSlave: boolean }> = {};
      const merges = worksheet.model.merges || [];
      merges.forEach((mergeRange) => {
        const parts = mergeRange.split(':');
        if (parts.length === 2) {
          const parsed = parseRangeString(`${worksheet.name}!${mergeRange}`);
          if (parsed) {
            const rowSpan = parsed.endRow - parsed.startRow + 1;
            const colSpan = parsed.endCol - parsed.startCol + 1;
            const masterColLetter = colNumberToLetter(parsed.startCol);
            const masterAddress = `${worksheet.name}!$${masterColLetter}$${parsed.startRow}`;
            
            for (let rNum = parsed.startRow; rNum <= parsed.endRow; rNum++) {
              for (let cNum = parsed.startCol; cNum <= parsed.endCol; cNum++) {
                const cLetter = colNumberToLetter(cNum);
                const cellAddr = `${worksheet.name}!$${cLetter}$${rNum}`;
                const isMaster = (rNum === parsed.startRow && cNum === parsed.startCol);
                mergeInfo[cellAddr] = {
                  master: masterAddress,
                  rowSpan,
                  colSpan,
                  isSlave: !isMaster
                };
              }
            }
          }
        }
      });

      // Dynamically calculate actual content boundaries
      let maxRows = 15; // minimum rows to display
      let maxCols = 8;  // minimum cols to display (A to H)

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber > maxRows) maxRows = rowNumber;
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          if (colNumber > maxCols) maxCols = colNumber;
        });
      });

      // Also include merges in boundary checks
      merges.forEach((mergeRange) => {
        const parsed = parseRangeString(`${worksheet.name}!${mergeRange}`);
        if (parsed) {
          if (parsed.endRow > maxRows) maxRows = parsed.endRow;
          if (parsed.endCol > maxCols) maxCols = parsed.endCol;
        }
      });

      // Limit/cap size to prevent memory or layout issues (A-Z columns, 100 rows)
      maxRows = Math.min(maxRows + 1, 100); // Add 1 padding row
      maxCols = Math.min(maxCols + 1, 26);  // Add 1 padding col

      // Extract column widths (in pixels)
      const columnWidths: number[] = [];
      for (let c = 1; c <= maxCols; c++) {
        const col = worksheet.getColumn(c);
        // Average pixel conversion: character width * 8 pixels, default to 90px if undefined
        const width = (col.width !== undefined && col.width > 0) ? Math.round(col.width * 8) : 90;
        columnWidths.push(width);
      }

      // Extract row heights (in pixels)
      const rowHeights: number[] = [];
      for (let r = 1; r <= maxRows; r++) {
        const row = worksheet.getRow(r);
        // Average pixel conversion: point height * 1.333 pixels, default to 26px if undefined
        const height = (row.height !== undefined && row.height > 0) ? Math.round(row.height * 1.333) : 26;
        rowHeights.push(height);
      }

      const rows: VisualCell[][] = [];

      for (let r = 1; r <= maxRows; r++) {
        const rowData: VisualCell[] = [];
        const row = worksheet.getRow(r);
        for (let c = 1; c <= maxCols; c++) {
          const cell = row.getCell(c);
          
          let valStr = '';
          if (cell.value !== null && cell.value !== undefined) {
            if (typeof cell.value === 'object') {
              const obj = cell.value as any;
              valStr = obj.result !== undefined 
                ? obj.result.toString() 
                : (obj.richText ? obj.richText.map((rt: any) => rt.text).join('') : '');
            } else {
              valStr = cell.value.toString();
            }
          }

          const colLetter = colNumberToLetter(c);
          const cellAddr = `${colLetter}${r}`;
          const formattedAddr = `${worksheet.name}!$${colLetter}$${r}`;
          const mergeCellDetails = mergeInfo[formattedAddr];

          // Parse background and font styles from Excel cell definition
          let bgColor: string | undefined;
          let color: string | undefined;
          
          if (cell.fill && cell.fill.type === 'pattern' && cell.fill.pattern === 'solid') {
            const fgColor = cell.fill.fgColor;
            if (fgColor && fgColor.argb) {
              bgColor = '#' + (fgColor.argb.length === 8 ? fgColor.argb.substring(2) : fgColor.argb);
            }
          }
          
          if (cell.font) {
            const fontColor = cell.font.color;
            if (fontColor && fontColor.argb) {
              color = '#' + (fontColor.argb.length === 8 ? fontColor.argb.substring(2) : fontColor.argb);
            }
          }

          let textAlign: string | undefined;
          let verticalAlign: string | undefined;
          let wrapText: boolean = false;
          if (cell.alignment) {
            textAlign = cell.alignment.horizontal || 'left';
            verticalAlign = cell.alignment.vertical || 'middle';
            wrapText = cell.alignment.wrapText || false;
          }

          // Parse borders
          const mapBorder = (border: any): string | undefined => {
            if (!border || !border.style) return undefined;
            let cssStyle = 'solid';
            let cssWidth = '1px';
            
            switch (border.style) {
              case 'hair':
              case 'thin':
                cssWidth = '1px';
                cssStyle = 'solid';
                break;
              case 'medium':
                cssWidth = '2px';
                cssStyle = 'solid';
                break;
              case 'thick':
                cssWidth = '3px';
                cssStyle = 'solid';
                break;
              case 'double':
                cssWidth = '3px';
                cssStyle = 'double';
                break;
              case 'dotted':
                cssWidth = '1px';
                cssStyle = 'dotted';
                break;
              case 'dashed':
                cssWidth = '1px';
                cssStyle = 'dashed';
                break;
              case 'mediumDashed':
                cssWidth = '2px';
                cssStyle = 'dashed';
                break;
              default:
                cssWidth = '1px';
                cssStyle = 'solid';
            }
            
            let borderHex = '#cbd5e1'; // light-gray default
            if (border.color && border.color.argb) {
              const argb = border.color.argb;
              borderHex = '#' + (argb.length === 8 ? argb.substring(2) : argb);
            }
            return `${cssWidth} ${cssStyle} ${borderHex}`;
          };

          let borderTop: string | undefined;
          let borderLeft: string | undefined;
          let borderBottom: string | undefined;
          let borderRight: string | undefined;

          if (cell.border) {
            borderTop = mapBorder(cell.border.top);
            borderLeft = mapBorder(cell.border.left);
            borderBottom = mapBorder(cell.border.bottom);
            borderRight = mapBorder(cell.border.right);
          }

          let textDecoration: string | undefined;
          if (cell.font) {
            if (cell.font.underline) {
              textDecoration = 'underline';
            }
            if (cell.font.strike) {
              textDecoration = textDecoration ? `${textDecoration} line-through` : 'line-through';
            }
          }

          const style = {
            backgroundColor: bgColor,
            color,
            fontWeight: cell.font && cell.font.bold ? 'bold' : 'normal',
            fontStyle: cell.font && cell.font.italic ? 'italic' : 'normal',
            fontSize: cell.font && cell.font.size ? `${cell.font.size}pt` : undefined,
            textAlign,
            verticalAlign,
            borderTop,
            borderLeft,
            borderBottom,
            borderRight,
            textDecoration,
            wrapText
          };

          rowData.push({
            address: formattedAddr,
            value: valStr,
            row: r,
            col: c,
            isMerged: cell.isMerged,
            masterAddress: mergeCellDetails?.master,
            rowSpan: mergeCellDetails?.rowSpan,
            colSpan: mergeCellDetails?.colSpan,
            isSlave: mergeCellDetails?.isSlave,
            style
          });
        }
        rows.push(rowData);
      }

      visualSheets.push({
        name: worksheet.name,
        rows,
        columnWidths,
        rowHeights
      });
    });

    return { fields, visualSheets };
  }

  /**
   * Fills data and images into the original Excel template buffer and returns the compiled file buffer
   */
  public static async fillTemplate(
    templateBuffer: Buffer,
    data: Record<string, string>,
    imageBuffers: Record<string, Buffer[]>,
    customFields?: Array<{ name: string; rangeStr: string; type?: string }>
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer as any);

    const elementsToProcess: Array<{ name: string; rangeStr: string; fieldConfig?: any }> = [];

    if (customFields && customFields.length > 0) {
      customFields.forEach(f => {
        elementsToProcess.push({
          name: f.name,
          rangeStr: f.rangeStr,
          fieldConfig: f
        });
      });
    } else {
      workbook.definedNames.model.forEach((definedName) => {
        if (definedName.ranges && definedName.ranges.length > 0) {
          elementsToProcess.push({
            name: definedName.name,
            rangeStr: definedName.ranges[0],
            fieldConfig: undefined
          });
        }
      });
    }

    elementsToProcess.forEach(({ name, rangeStr, fieldConfig }) => {
      const parsedRange = parseRangeString(rangeStr);
      if (!parsedRange) return;

      const worksheet = workbook.getWorksheet(parsedRange.sheetName);
      if (!worksheet) return;

      const isImage = fieldConfig 
        ? (fieldConfig.type === 'image' || fieldConfig.type === 'signature') 
        : /photo|image|pic|img/i.test(name);

      if (isImage) {
        // Multi-photo support: imageBuffers[name] is Buffer[]
        const fileBuffers = imageBuffers[name];
        if (fileBuffers && fileBuffers.length > 0) {

          // Detect merge range
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

          const count = fileBuffers.length;

          // Build column pixel widths array
          const colWidths: number[] = [];
          for (let c = effectiveStartCol; c <= effectiveEndCol; c++) {
            const w = worksheet.getColumn(c).width;
            colWidths.push(Math.round((w !== undefined && w > 0 ? w : 9) * 8));
          }
          const totalWidthPx = colWidths.reduce((a, b) => a + b, 0);

          // Build row pixel heights array
          const rowHeights: number[] = [];
          for (let r = effectiveStartRow; r <= effectiveEndRow; r++) {
            const h = worksheet.getRow(r).height;
            rowHeights.push(Math.round((h !== undefined && h > 0 ? h : 15) * 1.3333));
          }
          const totalHeightPx = rowHeights.reduce((a, b) => a + b, 0);

          // Helper: convert pixel offset to { colIndex (0-based), fraction }
          const pxToColFrac = (px: number): number => {
            let accumulated = 0;
            for (let i = 0; i < colWidths.length; i++) {
              if (accumulated + colWidths[i] >= px) {
                const remainder = px - accumulated;
                const fraction = colWidths[i] > 0 ? remainder / colWidths[i] : 0;
                return (effectiveStartCol - 1 + i) + Math.min(fraction, 0.99);
              }
              accumulated += colWidths[i];
            }
            return effectiveEndCol; // clamp to end
          };

          const pxToRowFrac = (px: number): number => {
            let accumulated = 0;
            for (let i = 0; i < rowHeights.length; i++) {
              if (accumulated + rowHeights[i] >= px) {
                const remainder = px - accumulated;
                const fraction = rowHeights[i] > 0 ? remainder / rowHeights[i] : 0;
                return (effectiveStartRow - 1 + i) + Math.min(fraction, 0.99);
              }
              accumulated += rowHeights[i];
            }
            return effectiveEndRow; // clamp to end
          };

          // Determine grid layout based on count
          let gridCols = 1, gridRows = 1;
          if (count === 2) {
            if (totalWidthPx >= totalHeightPx) { gridCols = 2; gridRows = 1; }
            else { gridCols = 1; gridRows = 2; }
          } else if (count >= 3) {
            gridCols = 2; gridRows = 2;
          }

          const cellW = totalWidthPx / gridCols;
          const cellH = totalHeightPx / gridRows;
          const padding = count > 1 ? 2 : 0; // small padding between grid items

          fileBuffers.slice(0, 4).forEach((fileBuffer, idx) => {
            const imageId = workbook.addImage({
              buffer: fileBuffer as any,
              extension: 'jpeg',
            });

            const gc = idx % gridCols;
            const gr = Math.floor(idx / gridCols);

            const x1 = gc * cellW + padding;
            const y1 = gr * cellH + padding;
            const x2 = (gc + 1) * cellW - padding;
            const y2 = (gr + 1) * cellH - padding;

            worksheet.addImage(imageId, {
              tl: { col: pxToColFrac(x1), row: pxToRowFrac(y1) } as any,
              br: { col: pxToColFrac(x2), row: pxToRowFrac(y2) } as any,
              editAs: 'oneCell'
            });
          });
        }
      } else {
        // Text/Date/Number/Checkbox field: Fill value into the top-left cell of the named range
        const val = data[name];
        if (val !== undefined) {
          const cell = worksheet.getCell(parsedRange.startRow, parsedRange.startCol);
          if (fieldConfig?.type === 'checkbox') {
            // Write standard checkmark "V" if checked
            cell.value = (val === 'true' || val === 'yes' || val === 'checked' || val === '1') ? 'V' : '';
          } else if (fieldConfig?.type === 'number') {
            const num = Number(val);
            cell.value = (isNaN(num) || val.trim() === '') ? val : num;
          } else {
            cell.value = val;
          }

          // Apply output style presets (about 30 types)
          const preset = (fieldConfig as any)?.stylePreset || 'default';
          if (preset !== 'default') {
            let fontName = 'Microsoft JhengHei';
            let fontSize = 11;
            let bold = false;
            let italic = false;
            let fontColor = 'FF000000'; // ARGB Black
            let fillBg: string | undefined = undefined;
            let horizontalAlign: 'left' | 'center' | 'right' = 'left';
            let verticalAlign: 'top' | 'middle' | 'bottom' = 'middle';
            let doubleBorder = false;

            switch (preset) {
              case 'bold_black':
                bold = true;
                break;
              case 'italic_gray':
                italic = true;
                fontColor = 'FF64748B';
                break;
              case 'classic_blue':
                fontColor = 'FF1E3A8A';
                break;
              case 'classic_blue_bold':
                bold = true;
                fontColor = 'FF1E3A8A';
                fillBg = 'FFE0F2FE';
                break;
              case 'royal_blue_header':
                bold = true;
                fontColor = 'FFFFFFFF';
                fillBg = 'FF1E40AF';
                horizontalAlign = 'center';
                break;
              case 'modern_indigo':
                fontColor = 'FF4F46E5';
                horizontalAlign = 'center';
                break;
              case 'navy_white':
                bold = true;
                fontColor = 'FFFFFFFF';
                fillBg = 'FF0F172A';
                horizontalAlign = 'center';
                break;
              case 'success_green':
                fontColor = 'FF15803D';
                break;
              case 'success_green_bg':
                bold = true;
                fontColor = 'FF14532D';
                fillBg = 'FFDCFCE7';
                break;
              case 'danger_red':
                fontColor = 'FFB91C1C';
                bold = true;
                break;
              case 'danger_red_bg':
                bold = true;
                fontColor = 'FF7F1D1D';
                fillBg = 'FFFEE2E2';
                break;
              case 'warning_amber':
                fontColor = 'FFB45309';
                break;
              case 'warning_yellow_bg':
                bold = true;
                fontColor = 'FF78350F';
                fillBg = 'FEFEF08A';
                break;
              case 'soft_gray':
                fontColor = 'FF475569';
                fillBg = 'FFF1F5F9';
                break;
              case 'elegant_teal':
                fontColor = 'FF0F766E';
                horizontalAlign = 'center';
                break;
              case 'large_title':
                fontSize = 16;
                bold = true;
                horizontalAlign = 'center';
                break;
              case 'subtitle_italic':
                fontSize = 12;
                italic = true;
                fontColor = 'FF475569';
                break;
              case 'monospaced_code':
                fontName = 'Courier New';
                fontSize = 10;
                horizontalAlign = 'center';
                break;
              case 'serif_classic':
                fontName = 'Times New Roman';
                bold = true;
                break;
              case 'purple_lux':
                fontColor = 'FF6D28D9';
                bold = true;
                break;
              case 'purple_lux_bg':
                bold = true;
                fontColor = 'FF4C1D95';
                fillBg = 'FFF3E8FF';
                break;
              case 'orange_sunset':
                fontColor = 'FFEA580C';
                bold = true;
                break;
              case 'mint_fresh':
                fontColor = 'FF059669';
                horizontalAlign = 'center';
                break;
              case 'gold_elegant':
                fontColor = 'FFCA8A04';
                bold = true;
                break;
              case 'charcoal_minimal':
                fontColor = 'FFFFFFFF';
                fillBg = 'FF334155';
                horizontalAlign = 'center';
                break;
              case 'sky_active':
                fontColor = 'FF0284C7';
                bold = true;
                break;
              case 'double_border_bold':
                bold = true;
                doubleBorder = true;
                break;
              case 'highlight_yellow':
                fillBg = 'FFFFFF00';
                break;
              case 'numeric_currency':
                horizontalAlign = 'right';
                bold = true;
                break;
            }

            cell.font = { name: fontName, size: fontSize, bold, italic, color: { argb: fontColor } };
            if (fillBg) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: fillBg }
              };
            }
            cell.alignment = { horizontal: horizontalAlign, vertical: verticalAlign };
            if (doubleBorder) {
              cell.border = {
                bottom: { style: 'double', color: { argb: 'FF000000' } }
              };
            }
          }
        }
      }
    });

    // Set all worksheets to A4 full page
    workbook.eachSheet((worksheet) => {
      worksheet.pageSetup = {
        ...worksheet.pageSetup,
        paperSize: 9, // A4
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0, // 0 = auto height, fit width only
        horizontalCentered: true,
        verticalCentered: false,
        margins: {
          left: 0.2,
          right: 0.2,
          top: 0.3,
          bottom: 0.3,
          header: 0.1,
          footer: 0.1
        }
      };
    });

    const outputBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(outputBuffer as any);
  }
}

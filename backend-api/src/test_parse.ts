import fs from 'fs';
import { ExcelService } from './services/excelService';

async function test() {
  try {
    const fileBuffer = fs.readFileSync('/Users/william/Desktop/個人資料.xlsx');
    console.log('File read successfully. Buffer size:', fileBuffer.length);
    const formConfig = await ExcelService.parseTemplate(fileBuffer);
    console.log('Parsed successfully!');
    console.log('Fields count:', formConfig.fields.length);
    console.log('Visual sheets count:', formConfig.visualSheets?.length);
    if (formConfig.visualSheets) {
      formConfig.visualSheets.forEach((s) => {
        console.log(`Sheet name: "${s.name}"`);
        console.log(`Rows: ${s.rows.length}, Columns: ${s.columnWidths.length}`);
        if (s.rows.length > 0) {
          console.log('First row cell details:', s.rows[0].map(c => ({ address: c.address, value: c.value })));
        }
      });
    }
  } catch (err) {
    console.error('Error during test parse:', err);
  }
}

test();

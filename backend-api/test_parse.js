const fs = require('fs');
const ExcelJS = require('exceljs');

async function test() {
  const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
  const template = Object.values(db.templates).find(t => t.title === '工地表單檢驗');
  if (!template) {
    console.log('Template not found');
    return;
  }
  const buffer = Buffer.from(template.excelBase64, 'base64');
  console.log('Buffer length:', buffer.length);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
    console.log('Successfully loaded workbook!');
  } catch (e) {
    console.error('Error loading workbook:', e);
  }
}
test();

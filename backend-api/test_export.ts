import { db } from './src/db';
import { ExcelService } from './src/services/excelService';
import * as fs from 'fs';

async function run() {
  const templateId = 'c80bd79b-6fc7-41fe-9ffe-4d2c7bcf8048';
  const template = db.getTemplate(templateId);
  const templateBuffer = Buffer.from(template.excelBase64, 'base64');
  const out = await ExcelService.fillTemplate(templateBuffer, {}, {}, template.config.fields);
  fs.writeFileSync('/tmp/out.xlsx', out);
}
run();

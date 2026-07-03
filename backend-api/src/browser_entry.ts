import { Buffer } from 'buffer';
import { ExcelService } from './services/excelService';

// Setup Buffer for browser environment
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  
  // Expose ExcelService methods to window for Dart JS Interop
  (window as any).ExcelWorker = {
    parseTemplate: async (base64String: string) => {
      const buffer = Buffer.from(base64String, 'base64');
      const result = await ExcelService.parseTemplate(buffer);
      return JSON.stringify(result);
    },
    fillTemplate: async (templateBase64: string, dataJson: string, filesBase64Json: string, customFieldsJson?: string) => {
      const templateBuffer = Buffer.from(templateBase64, 'base64');
      const data = JSON.parse(dataJson || '{}');
      
      const filesBase64: Record<string, string> = JSON.parse(filesBase64Json || '{}');
      const imageBuffers: Record<string, Buffer[]> = {};
      
      for (const [key, b64] of Object.entries(filesBase64)) {
        const baseName = key.replace(/_\d+$/, '');
        if (!imageBuffers[baseName]) imageBuffers[baseName] = [];
        imageBuffers[baseName].push(Buffer.from(b64, 'base64'));
      }
      
      let customFields = undefined;
      if (customFieldsJson) {
        customFields = JSON.parse(customFieldsJson);
      }
      
      const outputBuffer = await ExcelService.fillTemplate(templateBuffer, data, imageBuffers, customFields);
      return outputBuffer.toString('base64');
    }
  };
}

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { ExcelService } from './services/excelService';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { verifyToken } from './middleware/auth';
import { z } from 'zod';
import { db } from './db';
import puppeteer from 'puppeteer';

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
}));
app.use(cors());
app.use(express.json());

// Setup memory storage for multer since we process files directly in memory
const upload = multer({ storage: multer.memoryStorage() });

// --- Authentication & Token Routing ---

// 1. Verify token and return user role information
app.post('/api/auth/verify-token', verifyToken(), (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  res.json({
    success: true,
    token: tokenInfo.token,
    role: tokenInfo.role,
    masterToken: tokenInfo.masterToken
  });
});

// 2. Generate a member (sub-account) token under a master token
app.post('/api/auth/generate-member-token', verifyToken('master'), (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  
  // 檢查是否為企業/團隊訂閱
  const masterInfo = db.getToken(tokenInfo.token);
  const isSuperAdmin = tokenInfo.token === 'william_master_token';
  
  if (!isSuperAdmin && (!masterInfo || !masterInfo.subscriptionPlan?.startsWith('enterprise'))) {
    res.status(403).json({ error: 'Only enterprise subscriptions can generate sub-accounts. Please upgrade your plan.' });
    return;
  }

  // 檢查訂閱是否過期
  const exp = new Date(masterInfo?.subscriptionExpiresAt || 0);
  if (!isSuperAdmin && exp <= new Date()) {
    res.status(403).json({ error: 'Your team/enterprise subscription has expired.' });
    return;
  }

  // Generate new member token
  const memberToken = `member_${uuidv4().substring(0, 8)}`;
  const tokenInfoObj = db.createToken(memberToken, 'member', tokenInfo.token);
  // Default to undefined (all access). We will allow modifying it later.

  res.json({
    success: true,
    memberToken,
    allowedFolders: tokenInfoObj.allowedFolders
  });
});

// 2.1 Get all member tokens for a master token
app.get('/api/auth/member-tokens', verifyToken('master'), (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  const members = db.getMemberTokens(tokenInfo.token);
  res.json({
    success: true,
    members: members.map(m => ({
      token: m.token,
      allowedFolders: m.allowedFolders
    }))
  });
});

// 2.2 Update member token folders
app.put('/api/auth/member-tokens/:token', verifyToken('master'), (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  const memberToken = req.params.token;
  
  // Verify that this member token belongs to the master
  const memberInfo = db.getToken(memberToken);
  if (!memberInfo || memberInfo.masterToken !== tokenInfo.token) {
    res.status(404).json({ error: 'Member token not found or unauthorized' });
    return;
  }

  const { allowedFolders } = req.body;
  
  // if allowedFolders is passed as null or undefined, we treat it as undefined (all access)
  // if it's an array, we save it.
  const foldersToSave = Array.isArray(allowedFolders) ? allowedFolders : undefined;
  
  const success = db.updateTokenFolders(memberToken, foldersToSave);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to update token' });
  }
});

// 2.3 Delete member token
app.delete('/api/auth/member-tokens/:token', verifyToken('master'), (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  const memberToken = req.params.token;
  
  // Verify that this member token belongs to the master
  const memberInfo = db.getToken(memberToken);
  if (!memberInfo || memberInfo.masterToken !== tokenInfo.token) {
    res.status(404).json({ error: 'Member token not found or unauthorized' });
    return;
  }

  const success = db.deleteToken(memberToken);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to delete token' });
  }
});


// --- Points & Economy Routing ---

app.get('/api/points/status', verifyToken(), (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  const pts = db.getValidPoints(tokenInfo.token);
  
  // Refresh tokenInfo to get latest ad watch count
  const updatedToken = db.getToken(tokenInfo.token);
  
  res.json({
    success: true,
    points: pts,
    dailyAdWatchCount: updatedToken?.dailyAdWatchCount || 0,
    subscriptionPlan: updatedToken?.subscriptionPlan || 'personal_ad'
  });
});

app.get('/api/points/ledger', verifyToken(), (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  const updatedToken = db.getToken(tokenInfo.token);
  
  if (!updatedToken) {
    res.status(404).json({ success: false, error: 'Token not found' });
    return;
  }

  res.json({
    success: true,
    ledger: updatedToken.pointLedger || [],
    subscription: {
      plan: updatedToken.subscriptionPlan || 'personal_ad',
      createdAt: updatedToken.subscriptionCreatedAt,
      expiresAt: updatedToken.subscriptionExpiresAt,
      trialExpiresAt: updatedToken.trialExpiresAt
    }
  });
});

app.post('/api/points/reward', verifyToken(), (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  const result = db.updateAdWatchCount(tokenInfo.token);
  
  if (result.success) {
    res.json({ success: true, rewardPoints: result.rewardPoints });
  } else {
    res.status(403).json({ 
      success: false, 
      error: result.limitReached ? 'Daily ad limit reached (10/10)' : 'Free points limit reached (300/300)' 
    });
  }
});

app.post('/api/points/purchase', verifyToken(), (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  const schema = z.object({ amount: z.number().int().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid amount' });
    return;
  }
  
  const success = db.purchasePoints(tokenInfo.token, parsed.data.amount);
  res.json({ success });
});

app.post('/api/points/consume', verifyToken(), (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  const schema = z.object({ amount: z.number().int().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid amount' });
    return;
  }
  
  const success = db.consumePoints(tokenInfo.token, parsed.data.amount);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(403).json({ success: false, error: 'Insufficient points' });
  }
});

// --- Template Synchronization Routing ---

// 3. Save / publish configured Excel template from Web Admin
app.post(
  '/api/templates/save',
  verifyToken('master'),
  upload.single('template'),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const schema = z.object({
        token: z.string(),
        title: z.string().optional(),
        config: z.string(),
        folder: z.string().optional(),
        pages: z.string().optional()
      });
      const parsed = schema.parse(req.body);
      const { token, title, config, folder, pages } = parsed;

      const tokenInfo = (req as any).tokenInfo;

      // Check capacity limit
      const limit = db.getCapacityLimit(tokenInfo.token);
      const currentCount = db.getTemplatesForToken(tokenInfo.token).length;
      
      // If this is an existing template update, we don't count it as a new one for capacity check
      // Wait, /save currently always creates a new template ID. Let's just check if they are at limit.
      if (currentCount >= limit) {
        res.status(403).json({ error: `Storage capacity reached. Limit: ${limit}. Please purchase an add-on or upgrade your plan.` });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No template Excel file provided.' });
        return;
      }

      let parsedConfig;
      try {
        parsedConfig = JSON.parse(config);
      } catch {
        res.status(400).json({ error: 'Invalid JSON string provided in "config".' });
        return;
      }

      const parsedPages = pages ? parseInt(pages, 10) : 1;

      const templateId = uuidv4();
      const saved = db.saveTemplate(
        tokenInfo.token,
        templateId,
        title || '未命名範本',
        parsedConfig,
        req.file.buffer,
        folder || '',
        parsedPages
      );

      res.json({ success: true, templateId: saved.id });
    } catch (err: any) {
      console.error('Error saving template:', err);
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid request body', details: err.errors });
        return;
      }
      res.status(500).json({ error: 'Failed to save template.', details: err.message });
    }
  }
);

// 4. List all active templates accessible by the user's token (master or member)
app.get('/api/templates', (req: express.Request, res: express.Response) => {
  const token = req.query.token as string;
  if (!token) {
    res.status(400).json({ error: 'Token is required' });
    return;
  }

  const templates = db.getTemplatesForToken(token);
  // Map templates to return without base64 binary to keep response light
  const list = templates.map(t => ({
    id: t.id,
    title: t.title,
    config: t.config,
    folder: t.folder || '',
    pages: t.pages || 1,
    updatedAt: t.updatedAt
  }));

  res.json(list);
});

// 4.1 Delete template
app.delete('/api/templates/:id', (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const token = req.headers.authorization || req.body.token;

  if (!token) {
    res.status(401).json({ error: 'Token required' });
    return;
  }
  
  const tokenInfo = db.getToken(token);
  if (!tokenInfo || tokenInfo.role !== 'master') {
    res.status(403).json({ error: 'Only master can delete templates' });
    return;
  }

  const success = db.deleteTemplate(id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Template not found' });
  }
});

// 4.2 Rename/Move template
app.put('/api/templates/:id', (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const { title, folder, token } = req.body;
  const authToken = req.headers.authorization || token;

  if (!authToken) {
    res.status(401).json({ error: 'Token required' });
    return;
  }
  
  const tokenInfo = db.getToken(authToken);
  if (!tokenInfo || tokenInfo.role !== 'master') {
    res.status(403).json({ error: 'Only master can edit templates' });
    return;
  }

  if (title === undefined && folder === undefined) {
    res.status(400).json({ error: 'Title or folder is required' });
    return;
  }

  const updates: any = {};
  if (title !== undefined) updates.title = title;
  if (folder !== undefined) updates.folder = folder;
  
  const success = db.updateTemplate(id, updates);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Template not found' });
  }
});

// 5. Download original Excel file for a specific template
app.get('/api/templates/:id/excel', (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const template = db.getTemplate(id);
  
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  const excelBuffer = Buffer.from(template.excelBase64, 'base64');

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(template.title)}.xlsx"`
  );
  res.send(excelBuffer);
});

// --- Existing Parsing & Export Routes ---

// 6. Upload and parse Excel template to generate dynamic form JSON config (Legacy Web Admin flow)
app.post(
  '/api/templates/upload',
  upload.single('template'),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No template file uploaded. Please upload an Excel file.' });
        return;
      }

      const formConfig = await ExcelService.parseTemplate(req.file.buffer);
      res.json(formConfig);
    } catch (err: any) {
      console.error('Error parsing template:', err);
      res.status(500).json({ error: 'Failed to parse Excel template.', details: err.message });
    }
  }
);

// 7. Fill text data and images back into Excel template and download
app.post(
  '/api/templates/export',
  // Support template file and multiple images. Multer will parse everything.
  upload.any(),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[] || [];
      
      // Find template file
      const templateFile = files.find(f => f.fieldname === 'template');
      if (!templateFile) {
        res.status(400).json({ error: 'No Excel template file provided.' });
        return;
      }

      // Parse JSON data payload (expects a JSON string in req.body.data)
      let data: Record<string, string> = {};
      if (req.body.data) {
        try {
          data = JSON.parse(req.body.data);
        } catch {
          res.status(400).json({ error: 'Invalid JSON string provided in "data" field.' });
          return;
        }
      }

      // Extract image buffers map (excluding the template file itself)
      // Group by base field name for multi-photo support
      const imageBuffers: Record<string, Buffer[]> = {};
      files.forEach((file) => {
        if (file.fieldname !== 'template') {
          const baseName = file.fieldname.replace(/_\d+$/, '');
          if (!imageBuffers[baseName]) {
            imageBuffers[baseName] = [];
          }
          imageBuffers[baseName].push(file.buffer);
        }
      });

      // Parse custom fields configuration (defined names generated online)
      let customFields: Array<{ name: string; rangeStr: string }> | undefined;
      if (req.body.fields) {
        try {
          customFields = JSON.parse(req.body.fields);
        } catch {
          res.status(400).json({ error: 'Invalid JSON string provided in "fields" field.' });
          return;
        }
      }

      // Fill data into Excel template
      const outputBuffer = await ExcelService.fillTemplate(
        templateFile.buffer,
        data,
        imageBuffers,
        customFields
      );

      // Set headers for download
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=compiled_report.xlsx'
      );
      res.send(outputBuffer);
    } catch (err: any) {
      console.error('Error exporting template:', err);
      res.status(500).json({ error: 'Failed to generate Excel report.', details: err.message });
    }
  }
);

// 8. Web Export: Fill text data and images using a server-side template
app.post(
  '/api/templates/:id/export',
  upload.any(),
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid token' });
        return;
      }
      const token = authHeader.split(' ')[1];
      const tokenInfo = db.getToken(token);
      
      if (!tokenInfo) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      const templateId = req.params.id;
      const template = db.getTemplate(templateId);
      if (!template) {
        res.status(404).json({ error: 'Template not found on server' });
        return;
      }

      // Check if user has unlimited access (either their own subscription, or their master's)
      let isUnlimited = false;
      const now = new Date();

      // Master token is always unlimited
      if (tokenInfo.role === 'master') {
        isUnlimited = true;
      }

      // Check trial period
      if (!isUnlimited && tokenInfo.trialExpiresAt) {
        const trialExp = new Date(tokenInfo.trialExpiresAt);
        if (trialExp > now) isUnlimited = true;
      }

      if (!isUnlimited && tokenInfo.subscriptionPlan && tokenInfo.subscriptionPlan !== 'personal_ad') {
        const exp = new Date(tokenInfo.subscriptionExpiresAt || 0);
        if (exp > now) isUnlimited = true;
      }

      if (!isUnlimited && tokenInfo.role === 'member' && tokenInfo.masterToken) {
        const masterInfo = db.getToken(tokenInfo.masterToken);
        if (masterInfo) {
          // Master is always unlimited; member inherits
          if (masterInfo.role === 'master') isUnlimited = true;
          else if (masterInfo.subscriptionPlan && masterInfo.subscriptionPlan !== 'personal_ad') {
            const mExp = new Date(masterInfo.subscriptionExpiresAt || 0);
            if (mExp > now) isUnlimited = true;
          }
        }
      }

      // 如果沒有吃到飽權限 (個人未訂閱，或企業主帳號已過期)，則依據頁數扣除自己的點數
      if (!isUnlimited) {
        const requiredPoints = template.pages || 1;
        const success = db.consumePoints(token, requiredPoints);
        if (!success) {
          res.status(402).json({ error: 'Insufficient points', requiredPoints });
          return;
        }
      }
      
      const templateBuffer = Buffer.from(template.excelBase64, 'base64');
      const files = req.files as Express.Multer.File[] || [];

      // Parse JSON data payload
      let data: Record<string, string> = {};
      if (req.body.data) {
        try {
          data = JSON.parse(req.body.data);
        } catch {
          res.status(400).json({ error: 'Invalid JSON string in "data" field.' });
          return;
        }
      }

      // Extract image buffers (group by base field name for multi-photo support)
      const imageBuffers: Record<string, Buffer[]> = {};
      files.forEach((file) => {
        const baseName = file.fieldname.replace(/_\d+$/, '');
        if (!imageBuffers[baseName]) imageBuffers[baseName] = [];
        imageBuffers[baseName].push(file.buffer);
      });

      // Check requested format
      const format = req.query.format === 'pdf' ? 'pdf' : 'excel';
      const targetFolderId = req.body.folderId || null;
      const targetFilename = req.body.filename || `compiled_${templateId}`;
      let generatedBase64 = '';

      if (format === 'pdf') {
        // Generate a beautiful HTML report and convert to PDF using Puppeteer
        let htmlContent = `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #333; }
            h1 { text-align: center; color: #1E293B; border-bottom: 2px solid #6366F1; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #CBD5E1; padding: 12px; text-align: left; }
            th { background-color: #F8FAFC; width: 30%; color: #475569; font-weight: bold; }
            td { width: 70%; }
            .image-container { text-align: center; margin-top: 10px; }
            .image-container img { max-width: 100%; max-height: 300px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          </style>
        </head>
        <body>
          <h1>${template.title || '檢驗表單報表'}</h1>
          <table>
            <tbody>`;

        // Add text fields to HTML
        template.config.fields.forEach((field: any) => {
          if (field.type !== 'image' && field.type !== 'signature') {
            const val = data[field.name] || '無';
            htmlContent += `<tr><th>${field.label || field.name}</th><td>${val}</td></tr>`;
          }
        });
        
        // Add images and signatures to HTML
        template.config.fields.forEach((field: any) => {
          if ((field.type === 'image' || field.type === 'signature') && imageBuffers[field.name] && imageBuffers[field.name].length > 0) {
            const mimeType = field.type === 'signature' ? 'image/png' : 'image/jpeg';
            const imgTags = imageBuffers[field.name].map(buf => {
              const base64Img = buf.toString('base64');
              return `<img src="data:${mimeType};base64,${base64Img}" alt="${field.name}" style="flex: 1; max-width: calc(50% - 8px); margin: 4px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); object-fit: contain;" />`;
            }).join('');
            
            htmlContent += `<tr><th>${field.label || field.name}</th><td>
              <div class="image-container" style="display: flex; flex-wrap: wrap; justify-content: center;">
                ${imgTags}
              </div>
            </td></tr>`;
          }
        });

        htmlContent += `
            </tbody>
          </table>
          <p style="text-align: right; margin-top: 40px; color: #94A3B8; font-size: 12px;">系統自動生成 - ${new Date().toLocaleString('zh-TW')}</p>
        </body>
        </html>`;

        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
        
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
        });
        
        await browser.close();

        generatedBase64 = Buffer.from(pdfBuffer).toString('base64');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(targetFilename)}.pdf"`);
        res.send(pdfBuffer);
      } else {
        // Default Excel format
        const outputBuffer = await ExcelService.fillTemplate(
          templateBuffer,
          data,
          imageBuffers,
          template.config.fields
        );

        generatedBase64 = outputBuffer.toString('base64');
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${encodeURIComponent(targetFilename)}.xlsx"`
        );
        res.send(outputBuffer);
      }

      // Save to ExportedFiles if folderId is provided
      if (targetFolderId) {
        const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const masterToken = tokenInfo.role === 'master' ? tokenInfo.token : (tokenInfo.masterToken || '');
        db.saveExportedFile(fileId, masterToken, targetFolderId, targetFilename, format, generatedBase64);
      }
    } catch (err: any) {
      console.error('Error exporting web template:', err);
      res.status(500).json({ error: 'Failed to generate report.', details: err.message });
    }
  }
);

app.listen(port, () => {
  console.log(`本地端 macOS 伺服器啟動於 http://localhost:${port}`);
});


// 9. Export Folders Management
app.get('/api/export-folders', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid token' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const tokenInfo = db.getToken(token);
    if (!tokenInfo) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const masterToken = tokenInfo.role === 'master' ? tokenInfo.token : (tokenInfo.masterToken || '');
    const folders = db.getExportFolders(masterToken);
    res.json(folders);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/export-folders', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid token' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const tokenInfo = db.getToken(token);
    if (!tokenInfo) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const masterToken = tokenInfo.role === 'master' ? tokenInfo.token : (tokenInfo.masterToken || '');
    const { name, parentId } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const id = `ef_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const folder = db.createExportFolder(id, masterToken, name, parentId || null);
    res.json(folder);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/export-folders/:id', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid token' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const tokenInfo = db.getToken(token);
    if (!tokenInfo || tokenInfo.role !== 'master') {
      res.status(403).json({ error: 'Only master account can delete folders' });
      return;
    }
    db.deleteExportFolder(req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/exported-files/:folderId', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid token' });
      return;
    }
    const token = authHeader.split(' ')[1];
    if (!db.getToken(token)) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const files = db.getExportedFiles(req.params.folderId);
    res.json(files);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/exported-files/download/:id', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid token' });
      return;
    }
    const token = authHeader.split(' ')[1];
    if (!db.getToken(token)) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const file = db.getExportedFileById(req.params.id);
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const buffer = Buffer.from(file.dataBase64, 'base64');
    res.setHeader('Content-Type', file.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}.${file.format}"`);
    res.send(buffer);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


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
import path from 'path';
import { isS3Configured, uploadToS3, getPresignedDownloadUrl, getS3ObjectBuffer } from './s3';

// --- Utility Functions ---
function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const app = express();

// Trust Vercel's reverse proxy for express-rate-limit
app.set('trust proxy', 1);

const port = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use((req, res, next) => {
  if (process.env.DISABLE_RATE_LIMIT === 'true') {
    return next();
  }
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.'
  })(req, res, next);
});
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['*'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Setup memory storage for multer since we process files directly in memory
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 限制最大單檔 10MB
    files: 20 // 最多上傳 20 個檔案，防止大量的檔案耗盡記憶體 (DoS 防禦)
  }
});

// --- Authentication & Token Routing ---

// 1. Verify token and return user role information
// Accepts token from either Authorization header OR JSON body { token: "..." }
app.post('/api/auth/verify-token', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    let token: string | undefined;

    // Try Authorization header first
    const authHeader = req.headers.authorization as string | undefined;
    if (authHeader) {
      token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    }

    // Fallback: try JSON body
    if (!token && req.body && req.body.token) {
      token = req.body.token as string;
    }

    if (!token) {
      res.status(401).json({ error: 'Token required' });
      return;
    }

    await db.ensureInit();
    const tokenInfo = await db.getToken(token);
    if (!tokenInfo) {
      res.status(404).json({ error: 'Invalid token' });
      return;
    }

    res.json({
      success: true,
      token: tokenInfo.token,
      role: tokenInfo.role,
      masterToken: tokenInfo.masterToken
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Generate a member (sub-account) token under a master token
app.post('/api/auth/generate-member-token', verifyToken('master'), async (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  
  // 檢查是否為企業/團隊訂閱
  const masterInfo = await db.getToken(tokenInfo.token);
  const defaultMasterToken = process.env.MASTER_TOKEN || 'william_master_token';
  const isSuperAdmin = tokenInfo.token === defaultMasterToken;
  
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

  const { memberId, memberName } = req.body;

  // Generate new member token
  const memberToken = `member_${uuidv4().substring(0, 8)}`;
  const tokenInfoObj = await db.createToken(memberToken, 'member', tokenInfo.token);
  
  if (memberId || memberName) {
    await db.updateMemberMetadata(memberToken, memberId || '', memberName || '');
  }

  res.json({
    success: true,
    memberToken,
    memberId: tokenInfoObj.memberId,
    memberName: tokenInfoObj.memberName,
    allowedFolders: tokenInfoObj.allowedFolders
  });
});

// 2.1 Get all member tokens for a master token
app.get('/api/auth/member-tokens', verifyToken('master'), async (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  const members = await db.getMemberTokens(tokenInfo.token);
  res.json({
    success: true,
    members: members.map(m => ({
      token: m.token,
      memberId: m.memberId || '',
      memberName: m.memberName || '',
      allowedFolders: m.allowedFolders
    }))
  });
});

// 2.2 Update member token folders
app.put('/api/auth/member-tokens/:token', verifyToken('master'), async (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  const memberToken = req.params.token;
  
  // Verify that this member token belongs to the master
  const memberInfo = await db.getToken(memberToken);
  if (!memberInfo || memberInfo.masterToken !== tokenInfo.token) {
    res.status(404).json({ error: 'Member token not found or unauthorized' });
    return;
  }

  const { allowedFolders, memberId, memberName } = req.body;
  
  // if allowedFolders is passed as null or undefined, we treat it as undefined (all access)
  // if it's an array, we save it.
  const foldersToSave = Array.isArray(allowedFolders) ? allowedFolders : undefined;
  
  let success = true;
  if (allowedFolders !== undefined) {
    success = await db.updateTokenFolders(memberToken, foldersToSave);
  }
  
  if (success && (memberId !== undefined || memberName !== undefined)) {
    // Keep existing metadata if not explicitly provided
    const currentInfo = await db.getToken(memberToken);
    const newId = memberId !== undefined ? memberId : currentInfo?.memberId;
    const newName = memberName !== undefined ? memberName : currentInfo?.memberName;
    success = await db.updateMemberMetadata(memberToken, newId, newName);
  }
  
  if (success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to update token' });
  }
});

// 2.3 Delete member token
app.delete('/api/auth/member-tokens/:token', verifyToken('master'), async (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  const memberToken = req.params.token;
  
  // Verify that this member token belongs to the master
  const memberInfo = await db.getToken(memberToken);
  if (!memberInfo || memberInfo.masterToken !== tokenInfo.token) {
    res.status(404).json({ error: 'Member token not found or unauthorized' });
    return;
  }

  const success = await db.deleteToken(memberToken);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to delete token' });
  }
});


// --- Points & Economy Routing ---

app.get('/api/points/status', verifyToken(), async (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  const pts = await db.getValidPoints(tokenInfo.token);
  
  // Refresh tokenInfo to get latest ad watch count
  const updatedToken = await db.getToken(tokenInfo.token);
  
  res.json({
    success: true,
    points: pts,
    dailyAdWatchCount: updatedToken?.dailyAdWatchCount || 0,
    subscriptionPlan: updatedToken?.subscriptionPlan || 'personal_ad'
  });
});

app.get('/api/points/ledger', verifyToken(), async (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  const updatedToken = await db.getToken(tokenInfo.token);
  
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

app.post('/api/points/reward', verifyToken(), async (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  
  // 安全漏洞防護：Web 端不支援 AdMob Rewarded 廣告，檢查 tokenInfo 的來源
  // 如果是來自 Web 模擬（比如 tokenRole 為 master 且前端環境），或沒有有效的行動裝置特徵，直接拒絕。
  const userAgent = req.headers['user-agent'] || '';
  const isMobile = /android|iphone|ipad|ipod/i.test(userAgent);
  if (!isMobile) {
    res.status(403).json({ success: false, error: 'Rewarded Ads are only supported on iOS and Android devices.' });
    return;
  }

  const result = await db.updateAdWatchCount(tokenInfo.token);
  
  if (result.success) {
    res.json({ success: true, rewardPoints: result.rewardPoints });
  } else {
    res.status(403).json({ 
      success: false, 
      error: result.limitReached ? 'Daily ad limit reached (10/10)' : 'Free points limit reached (300/300)' 
    });
  }
});

app.post('/api/points/purchase', verifyToken(), async (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  const schema = z.object({
    receiptData: z.string().min(10),
    source: z.enum(['ios', 'android'])
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid receipt verification data' });
    return;
  }
  
  const result = await db.purchasePoints(tokenInfo.token, parsed.data.receiptData, parsed.data.source);
  res.json(result);
});

app.post('/api/points/consume', verifyToken(), async (req: express.Request, res: express.Response) => {
  const tokenInfo = (req as any).tokenInfo;
  const schema = z.object({ amount: z.number().int().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid amount' });
    return;
  }
  
  const success = await db.consumePoints(tokenInfo.token, parsed.data.amount);
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
      const limit = await db.getCapacityLimit(tokenInfo.token);
      const templatesForToken = await db.getTemplatesForToken(tokenInfo.token);
      const currentCount = templatesForToken.length;
      
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
      let s3Key: string | undefined = undefined;
      let excelBase64: Buffer | undefined = req.file.buffer;

      if (isS3Configured) {
        try {
          s3Key = `templates/${tokenInfo.masterToken || 'master'}/${templateId}.xlsx`;
          await uploadToS3(s3Key, req.file.buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          excelBase64 = undefined; // Do not store in SQLite if we have S3
        } catch (s3Err) {
          console.warn('S3 upload failed, falling back to SQLite database storage:', s3Err);
          s3Key = undefined;
          excelBase64 = req.file.buffer;
        }
      }

      const saved = await db.saveTemplate(
        tokenInfo.token,
        templateId,
        title || '未命名範本',
        parsedConfig,
        excelBase64,
        folder || '',
        parsedPages,
        s3Key
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
app.get('/api/templates', async (req: express.Request, res: express.Response) => {
  // Accept token from query string OR Authorization header
  let token = req.query.token as string | undefined;
  if (!token) {
    const authHeader = req.headers.authorization as string | undefined;
    if (authHeader) {
      token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    }
  }
  if (!token) {
    res.status(400).json({ error: 'Token is required' });
    return;
  }

  const templates = await db.getTemplatesForToken(token);
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
app.delete('/api/templates/:id', async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const token = req.headers.authorization || req.body.token;

  if (!token) {
    res.status(401).json({ error: 'Token required' });
    return;
  }
  
  const tokenInfo = await db.getToken(token);
  if (!tokenInfo || tokenInfo.role !== 'master') {
    res.status(403).json({ error: 'Only master can delete templates' });
    return;
  }

  const success = await db.deleteTemplate(id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Template not found' });
  }
});

// 4.2 Rename/Move template
app.put('/api/templates/:id', async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const { title, folder, token } = req.body;
  const authToken = req.headers.authorization || token;

  if (!authToken) {
    res.status(401).json({ error: 'Token required' });
    return;
  }
  
  const tokenInfo = await db.getToken(authToken);
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
  
  const success = await db.updateTemplate(id, updates);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Template not found' });
  }
});

// 5. Download original Excel file for a specific template (Secured)
app.get('/api/templates/:id/excel', verifyToken(), async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const tokenInfo = (req as any).tokenInfo;
  const template = await db.getTemplate(id);
  
  if (!template) {
    res.status(404).json({ error: 'Template not found' });
    return;
  }

  // 權限檢查：驗證模板是否屬於該 token 的 master/本身
  const targetMaster = tokenInfo.role === 'master' ? tokenInfo.token : (tokenInfo.masterToken || '');
  if (template.masterToken !== targetMaster) {
    res.status(403).json({ error: 'Unauthorized to download this template' });
    return;
  }

  // 如果是 Member，需要進一步確認該模板的 folder 是否在其 allowedFolders 清單內
  if (tokenInfo.role === 'member' && tokenInfo.allowedFolders !== undefined) {
    const isAllowed = template.folder && tokenInfo.allowedFolders.includes(template.folder);
    if (!isAllowed) {
      res.status(403).json({ error: 'Access denied: folder not allowed for this sub-account' });
      return;
    }
  }

  let excelBuffer: Buffer;
  if (template.s3Key && isS3Configured) {
    excelBuffer = await getS3ObjectBuffer(template.s3Key);
  } else {
    excelBuffer = Buffer.from(template.excelBase64 || '', 'base64');
  }

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
  verifyToken(),
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
  verifyToken(),
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
      const tokenInfo = await db.getToken(token);
      
      if (!tokenInfo) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      const templateId = req.params.id;
      const template = await db.getTemplate(templateId);
      if (!template) {
        res.status(404).json({ error: 'Template not found on server' });
        return;
      }

      // 權限防護校驗
      const targetMaster = tokenInfo.role === 'master' ? tokenInfo.token : (tokenInfo.masterToken || '');
      if (template.masterToken !== targetMaster) {
        res.status(403).json({ error: 'Access denied: You are not authorized to export from this template' });
        return;
      }

      // 如果是 Member，驗證 allowedFolders 是否能存取該範本的資料夾
      if (tokenInfo.role === 'member' && tokenInfo.allowedFolders !== undefined) {
        const isAllowed = template.folder && tokenInfo.allowedFolders.includes(template.folder);
        if (!isAllowed) {
          res.status(403).json({ error: 'Access denied: folder not allowed for this sub-account' });
          return;
        }
      }

      // Check if user has unlimited access (either their own subscription, or their master's)
      let isUnlimited = false;
      const now = new Date();
      const superAdminToken = process.env.MASTER_TOKEN;

      // Master 帳號本身：超級管理員無上限，其他 Master 需有有效訂閱嘗試
      if (tokenInfo.role === 'master') {
        if (superAdminToken && tokenInfo.token === superAdminToken) {
          // 超級管理員總是吸到飽
          isUnlimited = true;
        } else {
          // 一般 Master：檢查試用期
          if (tokenInfo.trialExpiresAt && new Date(tokenInfo.trialExpiresAt) > now) {
            isUnlimited = true;
          }
          // 一般 Master：檢查有效付費訂閱
          if (!isUnlimited && tokenInfo.subscriptionPlan && tokenInfo.subscriptionPlan !== 'personal_ad') {
            const exp = new Date(tokenInfo.subscriptionExpiresAt || 0);
            if (exp > now) isUnlimited = true;
          }
        }
      }

      // Member 帳號：繼承 Master 的有效訂閱（#74 修復：不再因為 role==='master' 就無標準赦予吸到飽）
      if (!isUnlimited && tokenInfo.role === 'member' && tokenInfo.masterToken) {
        const masterInfo = await db.getToken(tokenInfo.masterToken);
        if (masterInfo) {
          if (superAdminToken && tokenInfo.masterToken === superAdminToken) {
            // 超級管理員的子帳號總是吸到飽
            isUnlimited = true;
          } else {
            // 檢查 Master 的試用期是否仍有效
            if (masterInfo.trialExpiresAt && new Date(masterInfo.trialExpiresAt) > now) {
              isUnlimited = true;
            }
            // 檢查 Master 是否有有效的付費方案（非免費方案）
            if (!isUnlimited && masterInfo.subscriptionPlan && masterInfo.subscriptionPlan !== 'personal_ad') {
              const mExp = new Date(masterInfo.subscriptionExpiresAt || 0);
              if (mExp > now) isUnlimited = true;
            }
          }
        }
      }

      // 如果沒有吸到飽權限，先檢查點數餘額
      const requiredPoints = template.pages || 1;
      if (!isUnlimited) {
        const pts = await db.getValidPoints(token);
        if (pts.total < requiredPoints) {
          res.status(402).json({ error: 'Insufficient points', requiredPoints });
          return;
        }
      }
      
      let templateBuffer: Buffer;
      if (template.s3Key && isS3Configured) {
        templateBuffer = await getS3ObjectBuffer(template.s3Key);
      } else {
        templateBuffer = Buffer.from(template.excelBase64 || '', 'base64');
      }

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
      const format = req.query.format === 'pdf' ? 'pdf' : 'xlsx';
      const targetFolderId = req.body.folderId || null;
      const targetFilename = req.body.filename || `compiled_${templateId}`;
      let generatedBase64 = '';
      let finalBuffer: Buffer;

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
          <h1>${escapeHtml(template.title || '檢驗表單報表')}</h1>
          <table>
            <tbody>`;

        // Add text fields to HTML
        template.config.fields.forEach((field: any) => {
          if (field.type !== 'image' && field.type !== 'signature') {
            const val = data[field.name] || '無';
            htmlContent += `<tr><th>${escapeHtml(field.label || field.name)}</th><td>${escapeHtml(String(val))}</td></tr>`;
          }
        });
        
        // Add images and signatures to HTML
        template.config.fields.forEach((field: any) => {
          if ((field.type === 'image' || field.type === 'signature') && imageBuffers[field.name] && imageBuffers[field.name].length > 0) {
            const mimeType = field.type === 'signature' ? 'image/png' : 'image/jpeg';
            const imgTags = imageBuffers[field.name].map(buf => {
              const base64Img = buf.toString('base64');
              return `<img src="data:${mimeType};base64,${base64Img}" alt="${escapeHtml(field.name)}" style="flex: 1; max-width: calc(50% - 8px); margin: 4px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); object-fit: contain;" />`;
            }).join('');
            
            htmlContent += `<tr><th>${escapeHtml(field.label || field.name)}</th><td>
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

        let browser: any;
        try {
          browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });
          const page = await browser.newPage();
          page.setDefaultNavigationTimeout(30000);
          await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout: 30000 });
          
          finalBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
            timeout: 30000
          });

          generatedBase64 = Buffer.from(finalBuffer).toString('base64');
          
          // 扣除點數 (確保在傳送檔案前扣除成功)
          if (!isUnlimited) {
            const success = await db.consumePoints(token, requiredPoints);
            if (!success) {
              res.status(402).json({ error: 'Insufficient points (consumed by concurrent request)' });
              return;
            }
          }

          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(targetFilename)}.pdf"`);
          res.send(finalBuffer);
        } finally {
          if (browser) {
            await browser.close().catch((err: any) => console.error('Error closing Puppeteer browser:', err));
          }
        }
      } else {
        // Default Excel format
        finalBuffer = await ExcelService.fillTemplate(
          templateBuffer,
          data,
          imageBuffers,
          template.config.fields
        );

        generatedBase64 = finalBuffer.toString('base64');
        
        // 扣除點數 (確保在傳送檔案前扣除成功)
        if (!isUnlimited) {
          const success = await db.consumePoints(token, requiredPoints);
          if (!success) {
            res.status(402).json({ error: 'Insufficient points (consumed by concurrent request)' });
            return;
          }
        }

        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${encodeURIComponent(targetFilename)}.xlsx"`
        );
        res.send(finalBuffer);
      }

      // Save to ExportedFiles if folderId is provided
      if (targetFolderId) {
        const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const masterToken = tokenInfo.role === 'master' ? tokenInfo.token : (tokenInfo.masterToken || '');
        let s3Key: string | undefined = undefined;
        let base64ToSave: string | undefined = generatedBase64;
        
        if (isS3Configured && finalBuffer) {
          try {
            s3Key = `exports/${masterToken || 'master'}/${fileId}.${format}`;
            const mime = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            await uploadToS3(s3Key, finalBuffer, mime);
            base64ToSave = undefined; // Do not store in SQLite if uploaded to S3
          } catch (s3Err) {
            console.warn('S3 upload of exported file failed, falling back to SQLite database:', s3Err);
            s3Key = undefined;
            base64ToSave = generatedBase64;
          }
        }
        
        await db.saveExportedFile(fileId, masterToken, targetFolderId, targetFilename, format, base64ToSave, s3Key);
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
    const tokenInfo = await db.getToken(token);
    if (!tokenInfo) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const masterToken = tokenInfo.role === 'master' ? tokenInfo.token : (tokenInfo.masterToken || '');
    const folders = await db.getExportFolders(masterToken);
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
    const tokenInfo = await db.getToken(token);
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
    const folder = await db.createExportFolder(id, masterToken, name, parentId || null);
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
    const tokenInfo = await db.getToken(token);
    if (!tokenInfo || tokenInfo.role !== 'master') {
      res.status(403).json({ error: 'Only master account can delete folders' });
      return;
    }
    await db.deleteExportFolder(req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/exported-files/preview/:id', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid token' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const tokenInfo = await db.getToken(token);
    if (!tokenInfo) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const file = await db.getExportedFileById(req.params.id);
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    if (file.format === 'xlsx') {
      let buffer: Buffer;
      if (file.s3Key && isS3Configured) {
        buffer = await getS3ObjectBuffer(file.s3Key);
      } else if (file.dataBase64) {
        buffer = Buffer.from(file.dataBase64, 'base64');
      } else {
        res.status(404).json({ error: 'File content missing' });
        return;
      }
      
      const parsed = await ExcelService.parseTemplate(buffer);
      res.json({ visualSheets: parsed.visualSheets });
    } else {
      res.status(400).json({ error: 'Only Excel files can be previewed as grid JSON' });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/exported-files/download/:id', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const tokenStr = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : (req.query.token as string);
      
    if (!tokenStr) {
      res.status(401).json({ error: 'Missing or invalid token' });
      return;
    }
    
    const tokenInfo = await db.getToken(tokenStr);
    if (!tokenInfo) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const file = await db.getExportedFileById(req.params.id);
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    if (file.s3Key && isS3Configured) {
      const buffer = await getS3ObjectBuffer(file.s3Key);
      res.setHeader('Content-Type', file.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}.${file.format}"`);
      res.send(buffer);
      return;
    } else if (file.dataBase64) {
      const buffer = Buffer.from(file.dataBase64, 'base64');
      res.setHeader('Content-Type', file.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}.${file.format}"`);
      res.send(buffer);
    } else {
      res.status(404).json({ error: 'File content missing' });
    }
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
    const tokenInfo = await db.getToken(token);
    if (!tokenInfo) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const folderId = req.params.folderId;
    
    // 取得資料夾資訊以驗證擁有權
    const folders = await db.getExportFolders(tokenInfo.role === 'master' ? tokenInfo.token : (tokenInfo.masterToken || ''));
    const targetFolder = folders.find(f => f.id === folderId);
    
    if (!targetFolder && tokenInfo.token !== process.env.MASTER_TOKEN) {
      // 找不到資料夾，或是該資料夾不屬於這個 Master (除了超級管理員)
      res.status(404).json({ error: 'Folder not found' });
      return;
    }

    if (tokenInfo.role === 'member') {
      const allowed = tokenInfo.allowedFolders || [];
      if (!allowed.includes(folderId)) {
        res.status(403).json({ error: 'Access denied to this folder' });
        return;
      }
    }

    const files = await db.getExportedFiles(folderId);
    res.json(files);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/exported-files/:id', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid token' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const tokenInfo = await db.getToken(token);
    if (!tokenInfo || tokenInfo.role !== 'master') {
      res.status(403).json({ error: 'Only master account can delete files' });
      return;
    }
    await db.deleteExportedFile(req.params.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Serve admin-web frontend
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global error handling middleware (Catch Multer file size errors gracefully)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File size limit exceeded. Max allowed size is 10MB.' });
      return;
    }
  }
  res.status(500).json({ error: 'Internal Server Error', details: err.message || err });
});

module.exports = app;

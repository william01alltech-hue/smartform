import { createClient } from '@libsql/client';
import path from 'path';

const primaryUrl = process.env.TURSO_DATABASE_URL;
const primaryAuthToken = process.env.TURSO_AUTH_TOKEN;
const localUrl = `file:${path.join(__dirname, '..', 'app_data.sqlite')}`;

const primaryClient = primaryUrl ? createClient({ url: primaryUrl, authToken: primaryAuthToken }) : null;
const localClient = createClient({ url: localUrl });

const client = {
  async execute(stmt: any) {
    if (primaryClient) {
      try {
        return await primaryClient.execute(stmt);
      } catch (err: any) {
        // Retry once after 500ms for transient fetch errors (Turso cold start)
        console.warn('Primary database (Turso) error on first try, retrying in 500ms...', err?.message || err);
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          return await primaryClient.execute(stmt);
        } catch (retryErr: any) {
          console.warn('Primary database (Turso) error on retry:', retryErr?.message || retryErr);
          // Fallback to local DB. Note: writes will fail on Vercel read-only FS.
          return await localClient.execute(stmt);
        }
      }
    }
    return await localClient.execute(stmt);
  }
};

export interface ExportFolder {
  id: string;
  masterToken: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface ExportedFile {
  id: string;
  masterToken: string;
  folderId: string;
  filename: string;
  format: string;
  dataBase64?: string; // Legacy
  s3Key?: string;      // New for R2
  createdAt: string;
}

export interface PointTransaction {
  amount: number;
  type: 'free' | 'paid';
  createdAt: string;
  expiresAt: string;
}

export type SubscriptionPlan = 'personal_ad' | 'personal_pro' | 'enterprise_5' | 'enterprise_10' | 'enterprise_20';

export interface TokenInfo {
  token: string;
  role: 'master' | 'member';
  masterToken?: string;
  createdAt: string;
  updatedAt?: string;
  
  subscriptionPlan?: SubscriptionPlan;
  subscriptionCreatedAt?: string;
  subscriptionExpiresAt?: string;
  trialExpiresAt?: string;
  extraTemplateCapacity?: number;

  pointLedger?: PointTransaction[];
  lastAdDate?: string;
  dailyAdWatchCount?: number;
  
  allowedFolders?: string[];
  memberId?: string;
  memberName?: string;
}

export interface TemplateInfo {
  id: string;
  masterToken: string;
  title: string;
  config: any;
  excelBase64?: string; // Legacy
  s3Key?: string;       // New for R2
  updatedAt: string;
  folder?: string;
  pages?: number;
}

export interface TenantInfo {
  id: string;
  name: string;
  status: 'active' | 'suspended';
  plan: 'personal_ad' | 'personal_pro' | 'enterprise_5' | 'enterprise_10' | 'enterprise_20' | 'enterprise';
  maxMembers: number;
  masterToken: string;
  createdAt: string;
}

class SQLiteDatabase {
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.ensureInit().catch(err => {
      console.error("Database initialization failed", err);
    });
  }

  public async ensureInit(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initInternal();
    }
    return this.initPromise;
  }

  public async init() {
    return this.ensureInit();
  }

  // --- Initialization ---
  private async initInternal() {
    const tableQueries = [
      `
      CREATE TABLE IF NOT EXISTS tokens (
        token TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS export_folders (
        id TEXT PRIMARY KEY,
        masterToken TEXT NOT NULL,
        name TEXT NOT NULL,
        parentId TEXT,
        createdAt TEXT NOT NULL
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS exported_files (
        id TEXT PRIMARY KEY,
        masterToken TEXT NOT NULL,
        folderId TEXT NOT NULL,
        filename TEXT NOT NULL,
        format TEXT NOT NULL,
        dataBase64 TEXT,
        s3Key TEXT,
        createdAt TEXT NOT NULL
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
      `,
      `
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
      `
    ];

    // Ensure schema exists on both Turso and Local fallback
    for (const query of tableQueries) {
      if (primaryClient) {
        try {
          await primaryClient.execute(query);
        } catch (err: any) {
          console.warn('Failed to init table on Turso, ensuring local...', err?.message || err);
        }
      }
      try {
        await localClient.execute(query);
      } catch (err: any) {
        // Vercel filesystem is read-only, CREATE TABLE IF NOT EXISTS might throw.
        console.warn('Failed to init table on local DB (might be read-only on Vercel):', err?.message || err);
      }
    }

    // Ensure default master token is provisioned from env variable or fallback to william_master_token
    const defaultMasterToken = process.env.MASTER_TOKEN || 'william_master_token';
    if (defaultMasterToken) {
      const res = await client.execute({
        sql: 'SELECT data FROM tokens WHERE token = ?',
        args: [defaultMasterToken]
      });
      if (res.rows.length === 0) {
        const info: TokenInfo = {
          token: defaultMasterToken,
          role: 'master',
          createdAt: new Date().toISOString(),
          subscriptionPlan: 'enterprise_20',
          subscriptionCreatedAt: new Date().toISOString(),
          trialExpiresAt: new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString(),
          pointLedger: []
        };
        await this.saveToken(info);
      }
    }
  }

  // --- Tokens ---

  public async getToken(token: string): Promise<TokenInfo | undefined> {
    await this.ensureInit();
    const res = await client.execute({
      sql: 'SELECT data FROM tokens WHERE token = ?',
      args: [token]
    });
    if (res.rows.length === 0) return undefined;
    return JSON.parse(res.rows[0].data as string);
  }

  public async saveToken(info: TokenInfo): Promise<void> {
    info.updatedAt = new Date().toISOString();
    await client.execute({
      sql: 'INSERT OR REPLACE INTO tokens (token, data) VALUES (?, ?)',
      args: [info.token, JSON.stringify(info)]
    });
  }

  public async createToken(token: string, role: 'master' | 'member', masterToken?: string): Promise<TokenInfo> {
    const info: TokenInfo = {
      token,
      role,
      masterToken,
      createdAt: new Date().toISOString(),
      subscriptionPlan: role === 'master' ? 'personal_ad' : undefined,
      subscriptionCreatedAt: role === 'master' ? new Date().toISOString() : undefined,
      subscriptionExpiresAt: undefined, // 移除建立時自動贈送 1 年訂閱，僅保留試用期
      trialExpiresAt: role === 'master' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : undefined,
      pointLedger: []
    };
    await this.saveToken(info);
    return info;
  }

  public async getTokensByMaster(masterToken: string): Promise<TokenInfo[]> {
    const res = await client.execute({
      sql: "SELECT data FROM tokens WHERE json_extract(data, '$.masterToken') = ?",
      args: [masterToken]
    });
    return res.rows.map(r => JSON.parse(r.data as string) as TokenInfo);
  }
  
  public async getMemberTokens(masterToken: string): Promise<TokenInfo[]> {
    const all = await this.getTokensByMaster(masterToken);
    return all.filter(t => t.role === 'member');
  }

  public async deleteToken(token: string): Promise<boolean> {
    const info = await this.getToken(token);
    if (!info) return false;
    await client.execute({
      sql: 'DELETE FROM tokens WHERE token = ?',
      args: [token]
    });
    return true;
  }
  
  public async updateTokenFolders(token: string, folders: string[] | undefined): Promise<boolean> {
    const info = await this.getToken(token);
    if (!info) return false;
    info.allowedFolders = folders;
    await this.saveToken(info);
    return true;
  }

  public async updateMemberMetadata(token: string, memberId: string | undefined, memberName: string | undefined): Promise<boolean> {
    const info = await this.getToken(token);
    if (!info) return false;
    info.memberId = memberId;
    info.memberName = memberName;
    await this.saveToken(info);
    return true;
  }


  // --- Export Folders & Files ---

  public async createExportFolder(id: string, masterToken: string, name: string, parentId: string | null): Promise<ExportFolder> {
    const folder: ExportFolder = { id, masterToken, name, parentId, createdAt: new Date().toISOString() };
    await client.execute({
      sql: 'INSERT INTO export_folders (id, masterToken, name, parentId, createdAt) VALUES (?, ?, ?, ?, ?)',
      args: [id, masterToken, name, parentId, folder.createdAt]
    });
    return folder;
  }

  public async getExportFolders(masterToken: string): Promise<ExportFolder[]> {
    const res = await client.execute({
      sql: 'SELECT id, masterToken, name, parentId, createdAt FROM export_folders WHERE masterToken = ? ORDER BY createdAt ASC',
      args: [masterToken]
    });
    return res.rows.map(r => ({
      id: r.id as string,
      masterToken: r.masterToken as string,
      name: r.name as string,
      parentId: r.parentId as string | null,
      createdAt: r.createdAt as string
    }));
  }

  public async saveExportedFile(id: string, masterToken: string, folderId: string, filename: string, format: string, dataBase64: string | undefined, s3Key?: string): Promise<ExportedFile> {
    const file: ExportedFile = { id, masterToken, folderId, filename, format, dataBase64, s3Key, createdAt: new Date().toISOString() };
    await client.execute({
      sql: 'INSERT INTO exported_files (id, masterToken, folderId, filename, format, dataBase64, s3Key, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, masterToken, folderId, filename, format, dataBase64 || null, s3Key || null, file.createdAt]
    });
    return file;
  }

  public async getExportedFiles(folderId: string): Promise<Omit<ExportedFile, 'dataBase64'>[]> {
    const res = await client.execute({
      sql: 'SELECT id, masterToken, folderId, filename, format, createdAt FROM exported_files WHERE folderId = ? ORDER BY createdAt DESC',
      args: [folderId]
    });
    return res.rows.map(r => ({
      id: r.id as string,
      masterToken: r.masterToken as string,
      folderId: r.folderId as string,
      filename: r.filename as string,
      format: r.format as string,
      createdAt: r.createdAt as string
    }));
  }

  public async getExportedFileById(id: string): Promise<ExportedFile | undefined> {
    const res = await client.execute({
      sql: 'SELECT id, masterToken, folderId, filename, format, dataBase64, s3Key, createdAt FROM exported_files WHERE id = ?',
      args: [id]
    });
    if (res.rows.length === 0) return undefined;
    const r = res.rows[0];
    return {
      id: r.id as string,
      masterToken: r.masterToken as string,
      folderId: r.folderId as string,
      filename: r.filename as string,
      format: r.format as string,
      dataBase64: r.dataBase64 as string | undefined,
      s3Key: r.s3Key as string | undefined,
      createdAt: r.createdAt as string
    };
  }

  public async deleteExportedFile(id: string): Promise<boolean> {
    await client.execute({
      sql: 'DELETE FROM exported_files WHERE id = ?',
      args: [id]
    });
    return true;
  }

  public async deleteExportFolder(id: string): Promise<boolean> {
    const res = await client.execute({
      sql: 'SELECT id FROM export_folders WHERE parentId = ?',
      args: [id]
    });
    for (const child of res.rows) {
      await this.deleteExportFolder(child.id as string);
    }
    await client.execute({
      sql: 'DELETE FROM exported_files WHERE folderId = ?',
      args: [id]
    });
    await client.execute({
      sql: 'DELETE FROM export_folders WHERE id = ?',
      args: [id]
    });
    return true;
  }


  /**
   * 純查詢：計算有效點數總額，不進行任何寫入操作 (#67)
   * 過期點數的清除由 consumePoints 和 purgeExpiredPoints 負責，
   * 以避免在高並發環境下多個請求同時觸發寫入造成資料競爭。
   */
  public async getValidPoints(token: string): Promise<{ free: number; paid: number; total: number }> {
    const info = await this.getToken(token);
    if (!info || !info.pointLedger) return { free: 0, paid: 0, total: 0 };

    const now = new Date();
    let free = 0;
    let paid = 0;

    // 僅在記憶體中過濾，不寫回資料庫
    const validEntries = info.pointLedger.filter(p => new Date(p.expiresAt) > now);

    validEntries.forEach(p => {
      if (p.type === 'free') free += p.amount;
      else paid += p.amount;
    });

    return { free, paid, total: free + paid };
  }

  /**
   * 清除已過期的點數帳目並寫入資料庫。
   * 此方法在 consumePoints 內部呼叫，確保清除與扣點在同一次寫入中完成。
   */
  private async purgeExpiredPoints(info: TokenInfo): Promise<void> {
    const now = new Date();
    const before = info.pointLedger?.length ?? 0;
    info.pointLedger = (info.pointLedger || []).filter(p => new Date(p.expiresAt) > now);
    if (info.pointLedger.length !== before) {
      await this.saveToken(info);
    }
  }

  public async rewardPoints(token: string, amount: number): Promise<boolean> {
    const info = await this.getToken(token);
    if (!info) return false;

    if (!info.pointLedger) info.pointLedger = [];
    
    const pts = await this.getValidPoints(token);
    if (pts.free >= 300) return false;

    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    info.pointLedger.push({
      amount,
      type: 'free',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    });

    await this.saveToken(info);
    return true;
  }

  public async purchasePoints(token: string, receiptData: string, source: 'ios' | 'android'): Promise<{ success: boolean; amount: number }> {
    const info = await this.getToken(token);
    if (!info) return { success: false, amount: 0 };

    // 簡單的安全驗證與收據解析
    // 正常情況下，在這裡串接 App Store / Google Play 官方 API 驗證。
    // 這邊設計基本格式驗證，防止惡意直接灌點。
    if (!receiptData || receiptData.trim().length < 10) {
      return { success: false, amount: 0 };
    }

    // Mock 驗證：通常從收據資料中提取 Product ID 來決定點數額度。
    // 假設 product_id 包含 50_points -> 50點, 100_points -> 100點，默認依收據特徵解析
    let amount = 50; 
    if (receiptData.includes("100_points") || receiptData.includes("pro_100")) {
      amount = 100;
    } else if (receiptData.includes("200_points") || receiptData.includes("pro_200")) {
      amount = 200;
    } else if (receiptData.includes("500_points") || receiptData.includes("pro_500")) {
      amount = 500;
    }

    if (!info.pointLedger) info.pointLedger = [];

    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    info.pointLedger.push({
      amount,
      type: 'paid',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    });

    await this.saveToken(info);
    return { success: true, amount };
  }

  public async consumePoints(token: string, amount: number): Promise<boolean> {
    const maxRetries = 5;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const info = await this.getToken(token);
      if (!info || !info.pointLedger) return false;

      // 在記憶體中計算有效點數
      const now = new Date();
      let totalValid = 0;
      info.pointLedger.forEach(p => {
        if (new Date(p.expiresAt) > now) {
          totalValid += p.amount;
        }
      });
      
      if (totalValid < amount) return false; // 點數不足

      // 準備扣點邏輯
      let remainingToDeduct = amount;
      info.pointLedger = info.pointLedger.filter(p => new Date(p.expiresAt) > now);
      
      info.pointLedger.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'free' ? -1 : 1;
        }
        return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
      });

      for (let i = 0; i < info.pointLedger.length && remainingToDeduct > 0; i++) {
        const p = info.pointLedger[i];
        if (p.amount <= remainingToDeduct) {
          remainingToDeduct -= p.amount;
          p.amount = 0;
        } else {
          p.amount -= remainingToDeduct;
          remainingToDeduct = 0;
        }
      }

      info.pointLedger = info.pointLedger.filter(p => p.amount > 0);
      
      // 實作 Optimistic Concurrency Control (OCC) 防範 Race Condition
      // 利用 info.updatedAt 確保在此次處理期間，沒有其他請求修改此帳號
      const currentUpdatedAt = info.updatedAt || '';
      info.updatedAt = new Date().toISOString();
      
      let res;
      if (currentUpdatedAt) {
        res = await client.execute({
          sql: "UPDATE tokens SET data = ? WHERE token = ? AND json_extract(data, '$.updatedAt') = ?",
          args: [JSON.stringify(info), token, currentUpdatedAt]
        });
      } else {
        // 沒有 updatedAt 時，退回使用 REPLACE (只在最早期建立帳號時發生)
        res = await client.execute({
          sql: "UPDATE tokens SET data = ? WHERE token = ? AND (json_extract(data, '$.updatedAt') IS NULL OR json_extract(data, '$.updatedAt') = '')",
          args: [JSON.stringify(info), token]
        });
      }

      if (res.rowsAffected && res.rowsAffected > 0) {
        return true; // 扣點成功
      }
      
      // 若 rowsAffected == 0，代表資料被其他併發請求改掉了，進入下一次 retry
      // 稍微等待一下 (隨機 backoff) 避免活鎖
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
    }

    return false; // 重試超過次數，宣告失敗
  }

  public async updateAdWatchCount(token: string): Promise<{ success: boolean; rewardPoints: number; limitReached: boolean }> {
    const info = await this.getToken(token);
    if (!info) return { success: false, rewardPoints: 0, limitReached: false };

    const todayStr = new Date().toISOString().split('T')[0];
    
    if (info.lastAdDate !== todayStr) {
      info.lastAdDate = todayStr;
      info.dailyAdWatchCount = 0;
    }

    const currentCount = info.dailyAdWatchCount || 0;
    if (currentCount >= 10) {
      return { success: false, rewardPoints: 0, limitReached: true };
    }

    const reward = currentCount === 0 ? 3 : 1;
    const added = await this.rewardPoints(token, reward);

    if (added) {
      const updatedInfo = (await this.getToken(token))!;
      updatedInfo.dailyAdWatchCount = currentCount + 1;
      await this.saveToken(updatedInfo);
      return { success: true, rewardPoints: reward, limitReached: updatedInfo.dailyAdWatchCount >= 10 };
    } else {
      return { success: false, rewardPoints: 0, limitReached: false };
    }
  }

  // --- Templates & Capacity ---

  public async getCapacityLimit(token: string): Promise<number> {
    const info = await this.getToken(token);
    if (!info) return 3;
    const masterToken = info.role === 'master' ? info.token : (info.masterToken || '');
    const masterInfo = await this.getToken(masterToken);
    if (!masterInfo) return 3;

    // 超級管理員帳號（僅透過環境變數設定，非硬編碼名稱）擁有無上限容量 (#68)
    const superAdminToken = process.env.MASTER_TOKEN;
    if (superAdminToken && masterToken === superAdminToken) {
      return 9999;
    }

    // 訂閱方案容量上限（免費方案 personal_ad 遵守 3 個上限）(#68)
    const now = new Date();
    const isActive = masterInfo.subscriptionExpiresAt
      ? new Date(masterInfo.subscriptionExpiresAt) > now
      : false;
    const isTrialing = masterInfo.trialExpiresAt
      ? new Date(masterInfo.trialExpiresAt) > now
      : false;

    let base = 3; // 免費 / 過期方案預設上限
    if (isActive || isTrialing) {
      switch(masterInfo.subscriptionPlan) {
        case 'personal_pro': base = 10; break;
        case 'enterprise_5': base = 100; break;
        case 'enterprise_10': base = 300; break;
        case 'enterprise_20': base = 500; break;
      }
    }
    return base + (masterInfo.extraTemplateCapacity || 0);
  }

  public async getTemplatesForToken(token: string): Promise<TemplateInfo[]> {
    const info = await this.getToken(token);
    if (!info) return [];
    const masterToken = info.role === 'master' ? info.token : (info.masterToken || '');
    let templates = await this.getTemplatesByMaster(masterToken);
    
    if (info.role === 'member' && info.allowedFolders !== undefined) {
      templates = templates.filter(t => t.folder && info.allowedFolders!.includes(t.folder));
    }
    
    return templates;
  }

  public async saveTemplate(masterToken: string, templateId: string, title: string, config: any, excelBase64: string | Buffer | undefined, folder?: string, pages?: number, s3Key?: string): Promise<TemplateInfo> {
    const existing = await this.getTemplate(templateId);
    let base64Str: string | undefined = undefined;
    if (excelBase64) {
      base64Str = Buffer.isBuffer(excelBase64) ? excelBase64.toString('base64') : excelBase64;
    }
    
    const tmpl: TemplateInfo = existing ? {
      ...existing,
      title, config, excelBase64: base64Str || existing.excelBase64,
      s3Key: s3Key || existing.s3Key,
      updatedAt: new Date().toISOString(),
      folder: folder ?? existing.folder,
      pages: pages ?? existing.pages
    } : {
      id: templateId,
      masterToken, title, config, excelBase64: base64Str,
      s3Key,
      updatedAt: new Date().toISOString(),
      folder,
      pages: pages ?? 1
    };
    
    await client.execute({
      sql: 'INSERT OR REPLACE INTO templates (id, data) VALUES (?, ?)',
      args: [tmpl.id, JSON.stringify(tmpl)]
    });
    return tmpl;
  }

  public async getTemplatesByMaster(masterToken: string): Promise<TemplateInfo[]> {
    const res = await client.execute({
      sql: "SELECT data FROM templates WHERE json_extract(data, '$.masterToken') = ?",
      args: [masterToken]
    });
    return res.rows.map(r => JSON.parse(r.data as string) as TemplateInfo);
  }

  public async getTemplate(templateId: string): Promise<TemplateInfo | undefined> {
    const res = await client.execute({
      sql: 'SELECT data FROM templates WHERE id = ?',
      args: [templateId]
    });
    if (res.rows.length === 0) return undefined;
    return JSON.parse(res.rows[0].data as string);
  }

  public async deleteTemplate(templateId: string): Promise<boolean> {
    const existing = await this.getTemplate(templateId);
    if (!existing) return false;
    await client.execute({
      sql: 'DELETE FROM templates WHERE id = ?',
      args: [templateId]
    });
    return true;
  }

  public async updateTemplateFolder(templateId: string, folder: string | undefined): Promise<boolean> {
    const tmpl = await this.getTemplate(templateId);
    if (!tmpl) return false;
    tmpl.folder = folder;
    tmpl.updatedAt = new Date().toISOString();
    await client.execute({
      sql: 'INSERT OR REPLACE INTO templates (id, data) VALUES (?, ?)',
      args: [tmpl.id, JSON.stringify(tmpl)]
    });
    return true;
  }

  public async updateTemplate(templateId: string, updates: Partial<TemplateInfo>): Promise<TemplateInfo | null> {
    const tmpl = await this.getTemplate(templateId);
    if (!tmpl) return null;
    const newTmpl = { ...tmpl, ...updates, updatedAt: new Date().toISOString() };
    await client.execute({
      sql: 'INSERT OR REPLACE INTO templates (id, data) VALUES (?, ?)',
      args: [newTmpl.id, JSON.stringify(newTmpl)]
    });
    return newTmpl;
  }

  // --- Tenants ---
  public async getTenants(): Promise<TenantInfo[]> {
    const res = await client.execute('SELECT data FROM tenants');
    return res.rows.map(row => JSON.parse(row.data as string) as TenantInfo);
  }

  public async getTenantById(id: string): Promise<TenantInfo | null> {
    const res = await client.execute({
      sql: 'SELECT data FROM tenants WHERE id = ?',
      args: [id]
    });
    if (res.rows.length === 0) return null;
    return JSON.parse(res.rows[0].data as string) as TenantInfo;
  }

  public async saveTenant(tenant: TenantInfo): Promise<void> {
    await client.execute({
      sql: `
        INSERT INTO tenants (id, data)
        VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET data=excluded.data;
      `,
      args: [tenant.id, JSON.stringify(tenant)]
    });
  }

  public async deleteTenant(id: string): Promise<void> {
    await client.execute({
      sql: 'DELETE FROM tenants WHERE id = ?',
      args: [id]
    });
  }
}

export const db = new SQLiteDatabase();

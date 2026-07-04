import { createClient } from '@libsql/client';
import path from 'path';

const url = process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, '..', 'app_data.sqlite')}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({
  url,
  authToken
});

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
  dataBase64: string;
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

interface TemplateInfo {
  id: string;
  masterToken: string;
  title: string;
  config: any;
  excelBase64: string;
  updatedAt: string;
  folder?: string;
  pages?: number;
}

class SQLiteDatabase {
  constructor() {
    this.init().catch(err => {
      console.error("Database initialization failed", err);
    });
  }

  // --- Initialization ---
  public async init() {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS tokens (
        token TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS export_folders (
        id TEXT PRIMARY KEY,
        masterToken TEXT NOT NULL,
        name TEXT NOT NULL,
        parentId TEXT,
        createdAt TEXT NOT NULL
      );
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS exported_files (
        id TEXT PRIMARY KEY,
        masterToken TEXT NOT NULL,
        folderId TEXT NOT NULL,
        filename TEXT NOT NULL,
        format TEXT NOT NULL,
        dataBase64 TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
    `);

    // Ensure default master token
    const masterToken = await this.getToken('william_master_token');
    if (!masterToken) {
      await this.createToken('william_master_token', 'master');
    }
  }

  // --- Tokens ---

  public async getToken(token: string): Promise<TokenInfo | undefined> {
    const res = await client.execute({
      sql: 'SELECT data FROM tokens WHERE token = ?',
      args: [token]
    });
    if (res.rows.length === 0) return undefined;
    return JSON.parse(res.rows[0].data as string);
  }

  private async saveToken(info: TokenInfo): Promise<void> {
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
      subscriptionExpiresAt: role === 'master' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : undefined,
      trialExpiresAt: role === 'master' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : undefined,
      pointLedger: []
    };
    await this.saveToken(info);
    return info;
  }

  public async getTokensByMaster(masterToken: string): Promise<TokenInfo[]> {
    const res = await client.execute('SELECT data FROM tokens');
    const all = res.rows.map(r => JSON.parse(r.data as string) as TokenInfo);
    return all.filter(t => t.masterToken === masterToken);
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

  public async saveExportedFile(id: string, masterToken: string, folderId: string, filename: string, format: string, dataBase64: string): Promise<ExportedFile> {
    const file: ExportedFile = { id, masterToken, folderId, filename, format, dataBase64, createdAt: new Date().toISOString() };
    await client.execute({
      sql: 'INSERT INTO exported_files (id, masterToken, folderId, filename, format, dataBase64, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [id, masterToken, folderId, filename, format, dataBase64, file.createdAt]
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
      sql: 'SELECT * FROM exported_files WHERE id = ?',
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
      dataBase64: r.dataBase64 as string,
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


  public async getValidPoints(token: string): Promise<{ free: number; paid: number; total: number }> {
    const info = await this.getToken(token);
    if (!info || !info.pointLedger) return { free: 0, paid: 0, total: 0 };

    const now = new Date();
    let free = 0;
    let paid = 0;

    info.pointLedger = info.pointLedger.filter(p => new Date(p.expiresAt) > now);

    info.pointLedger.forEach(p => {
      if (p.type === 'free') free += p.amount;
      else paid += p.amount;
    });

    await this.saveToken(info);
    return { free, paid, total: free + paid };
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

  public async purchasePoints(token: string, amount: number): Promise<boolean> {
    const info = await this.getToken(token);
    if (!info) return false;

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
    return true;
  }

  public async consumePoints(token: string, amount: number): Promise<boolean> {
    const info = await this.getToken(token);
    if (!info || !info.pointLedger) return false;

    const pts = await this.getValidPoints(token);
    if (pts.total < amount) return false;

    const now = new Date();
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
    await this.saveToken(info);
    return true;
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

    if (masterInfo.role === 'master' || masterToken === 'william_master_token') {
      return 9999;
    }

    let base = 3;
    switch(masterInfo.subscriptionPlan) {
      case 'personal_pro': base = 10; break;
      case 'enterprise_5': base = 100; break;
      case 'enterprise_10': base = 300; break;
      case 'enterprise_20': base = 500; break;
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

  public async saveTemplate(masterToken: string, templateId: string, title: string, config: any, excelBase64: string | Buffer, folder?: string, pages?: number): Promise<TemplateInfo> {
    const existing = await this.getTemplate(templateId);
    const base64Str = Buffer.isBuffer(excelBase64) ? excelBase64.toString('base64') : excelBase64;
    
    const tmpl: TemplateInfo = existing ? {
      ...existing,
      title, config, excelBase64: base64Str,
      updatedAt: new Date().toISOString(),
      folder: folder ?? existing.folder,
      pages: pages ?? existing.pages
    } : {
      id: templateId,
      masterToken, title, config, excelBase64: base64Str,
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
    const res = await client.execute('SELECT data FROM templates');
    const all = res.rows.map(r => JSON.parse(r.data as string) as TemplateInfo);
    return all.filter(t => t.masterToken === masterToken);
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
}

export const db = new SQLiteDatabase();

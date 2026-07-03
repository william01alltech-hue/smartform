import Database from 'better-sqlite3';
import path from 'path';

const DB_FILE = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'app_data.sqlite');
const dbInstance = new Database(DB_FILE);

// Initialize tables
dbInstance.pragma('journal_mode = WAL'); // Better concurrency
dbInstance.exec(`
  CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS export_folders (
    id TEXT PRIMARY KEY,
    masterToken TEXT NOT NULL,
    name TEXT NOT NULL,
    parentId TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS exported_files (
    id TEXT PRIMARY KEY,
    masterToken TEXT NOT NULL,
    folderId TEXT NOT NULL,
    filename TEXT NOT NULL,
    format TEXT NOT NULL,
    dataBase64 TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  
  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL
  );
`);


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
  
  allowedFolders?: string[]; // null/undefined/empty array all handled: if empty, no access. If undefined, all access (backward compatibility, but going forward new tokens might have it). Wait, the rule is "empty means no access, full check means all access". Let's say undefined means all access for backward compatibility, but in UI we treat it appropriately.
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
  private stmtGetToken = dbInstance.prepare('SELECT data FROM tokens WHERE token = ?');
  private stmtInsertToken = dbInstance.prepare('INSERT OR REPLACE INTO tokens (token, data) VALUES (?, ?)');
  private stmtDeleteToken = dbInstance.prepare('DELETE FROM tokens WHERE token = ?');
  private stmtGetAllTokens = dbInstance.prepare('SELECT data FROM tokens');

  private stmtGetTemplate = dbInstance.prepare('SELECT data FROM templates WHERE id = ?');
  private stmtInsertTemplate = dbInstance.prepare('INSERT OR REPLACE INTO templates (id, data) VALUES (?, ?)');
  private stmtDeleteTemplate = dbInstance.prepare('DELETE FROM templates WHERE id = ?');
  private stmtGetAllTemplates = dbInstance.prepare('SELECT data FROM templates');

  constructor() {
    // Ensure default master token
    if (!this.getToken('william_master_token')) {
      this.createToken('william_master_token', 'master');
    }
  }

  // --- Tokens ---

  public getToken(token: string): TokenInfo | undefined {
    const row = this.stmtGetToken.get(token) as { data: string } | undefined;
    if (!row) return undefined;
    return JSON.parse(row.data);
  }

  private saveToken(info: TokenInfo) {
    this.stmtInsertToken.run(info.token, JSON.stringify(info));
  }

  public createToken(token: string, role: 'master' | 'member', masterToken?: string): TokenInfo {
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
    this.saveToken(info);
    return info;
  }

  public getTokensByMaster(masterToken: string): TokenInfo[] {
    const rows = this.stmtGetAllTokens.all() as { data: string }[];
    const all = rows.map(r => JSON.parse(r.data) as TokenInfo);
    return all.filter(t => t.masterToken === masterToken);
  }
  
  public getMemberTokens(masterToken: string): TokenInfo[] {
    return this.getTokensByMaster(masterToken).filter(t => t.role === 'member');
  }

  public deleteToken(token: string): boolean {
    const info = this.getToken(token);
    if (!info) return false;
    this.stmtDeleteToken.run(token);
    return true;
  }
  
  public updateTokenFolders(token: string, folders: string[] | undefined): boolean {
    const info = this.getToken(token);
    if (!info) return false;
    info.allowedFolders = folders;
    this.saveToken(info);
    return true;
  }


  // --- Export Folders & Files ---

  public createExportFolder(id: string, masterToken: string, name: string, parentId: string | null): ExportFolder {
    const folder: ExportFolder = { id, masterToken, name, parentId, createdAt: new Date().toISOString() };
    dbInstance.prepare('INSERT INTO export_folders (id, masterToken, name, parentId, createdAt) VALUES (?, ?, ?, ?, ?)').run(id, masterToken, name, parentId, folder.createdAt);
    return folder;
  }

  public getExportFolders(masterToken: string): ExportFolder[] {
    return dbInstance.prepare('SELECT * FROM export_folders WHERE masterToken = ? ORDER BY createdAt ASC').all(masterToken) as ExportFolder[];
  }

  public saveExportedFile(id: string, masterToken: string, folderId: string, filename: string, format: string, dataBase64: string): ExportedFile {
    const file: ExportedFile = { id, masterToken, folderId, filename, format, dataBase64, createdAt: new Date().toISOString() };
    dbInstance.prepare('INSERT INTO exported_files (id, masterToken, folderId, filename, format, dataBase64, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, masterToken, folderId, filename, format, dataBase64, file.createdAt);
    return file;
  }

  public getExportedFiles(folderId: string): Omit<ExportedFile, 'dataBase64'>[] {
    // Return without base64 data to save bandwidth
    return dbInstance.prepare('SELECT id, masterToken, folderId, filename, format, createdAt FROM exported_files WHERE folderId = ? ORDER BY createdAt DESC').all(folderId) as any[];
  }

  public getExportedFileById(id: string): ExportedFile | undefined {
    return dbInstance.prepare('SELECT * FROM exported_files WHERE id = ?').get(id) as ExportedFile | undefined;
  }

  // --- 點數系統 ---

  public getValidPoints(token: string): { free: number; paid: number; total: number } {
    const info = this.getToken(token);
    if (!info || !info.pointLedger) return { free: 0, paid: 0, total: 0 };

    const now = new Date();
    let free = 0;
    let paid = 0;

    info.pointLedger = info.pointLedger.filter(p => new Date(p.expiresAt) > now);

    info.pointLedger.forEach(p => {
      if (p.type === 'free') free += p.amount;
      else paid += p.amount;
    });

    this.saveToken(info);
    return { free, paid, total: free + paid };
  }

  public rewardPoints(token: string, amount: number): boolean {
    const info = this.getToken(token);
    if (!info) return false;

    if (!info.pointLedger) info.pointLedger = [];
    
    const pts = this.getValidPoints(token);
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

    this.saveToken(info);
    return true;
  }

  public purchasePoints(token: string, amount: number): boolean {
    const info = this.getToken(token);
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

    this.saveToken(info);
    return true;
  }

  public consumePoints(token: string, amount: number): boolean {
    const info = this.getToken(token);
    if (!info || !info.pointLedger) return false;

    const pts = this.getValidPoints(token);
    if (pts.total < amount) return false;

    const now = new Date();
    let remainingToDeduct = amount;

    info.pointLedger = info.pointLedger.filter(p => new Date(p.expiresAt) > now);
    
    // Sort: free first, then paid. Inside type, sort by expiration (earliest first)
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
    this.saveToken(info);
    return true;
  }

  public updateAdWatchCount(token: string): { success: boolean; rewardPoints: number; limitReached: boolean } {
    const info = this.getToken(token);
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
    // Note: since we refetched info, we can just call rewardPoints which will fetch it again and save it.
    // We then re-fetch it here to update the watch count!
    const added = this.rewardPoints(token, reward);

    if (added) {
      const updatedInfo = this.getToken(token)!;
      updatedInfo.dailyAdWatchCount = currentCount + 1;
      this.saveToken(updatedInfo);
      return { success: true, rewardPoints: reward, limitReached: updatedInfo.dailyAdWatchCount >= 10 };
    } else {
      return { success: false, rewardPoints: 0, limitReached: false };
    }
  }

  // --- Templates & Capacity ---

  public getCapacityLimit(token: string): number {
    const info = this.getToken(token);
    if (!info) return 3;
    const masterToken = info.role === 'master' ? info.token : (info.masterToken || '');
    const masterInfo = this.getToken(masterToken);
    if (!masterInfo) return 3;

    let base = 3;
    switch(masterInfo.subscriptionPlan) {
      case 'personal_pro': base = 10; break;
      case 'enterprise_5': base = 100; break;
      case 'enterprise_10': base = 300; break;
      case 'enterprise_20': base = 500; break;
    }
    return base + (masterInfo.extraTemplateCapacity || 0);
  }

  public getTemplatesForToken(token: string): TemplateInfo[] {
    const info = this.getToken(token);
    if (!info) return [];
    const masterToken = info.role === 'master' ? info.token : (info.masterToken || '');
    let templates = this.getTemplatesByMaster(masterToken);
    
    // 如果是 member 且有設定 allowedFolders
    // 注意邏輯：如果 allowedFolders 存在 (哪怕是空陣列 []), 就不讓他看不在陣列裡的表單
    // 所以空陣列代表什麼都看不到 (完全符合需求)
    // 如果 allowedFolders 是 undefined (以前產生的 key 或全選)，才給看全部。
    if (info.role === 'member' && info.allowedFolders !== undefined) {
      templates = templates.filter(t => t.folder && info.allowedFolders!.includes(t.folder));
    }
    
    return templates;
  }

  public saveTemplate(masterToken: string, templateId: string, title: string, config: any, excelBase64: string | Buffer, folder?: string, pages?: number): TemplateInfo {
    const existing = this.getTemplate(templateId);
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
    
    this.stmtInsertTemplate.run(tmpl.id, JSON.stringify(tmpl));
    return tmpl;
  }

  public getTemplatesByMaster(masterToken: string): TemplateInfo[] {
    const rows = this.stmtGetAllTemplates.all() as { data: string }[];
    const all = rows.map(r => JSON.parse(r.data) as TemplateInfo);
    return all.filter(t => t.masterToken === masterToken);
  }

  public getTemplate(templateId: string): TemplateInfo | undefined {
    const row = this.stmtGetTemplate.get(templateId) as { data: string } | undefined;
    if (!row) return undefined;
    return JSON.parse(row.data);
  }

  public deleteTemplate(templateId: string): boolean {
    const existing = this.getTemplate(templateId);
    if (!existing) return false;
    this.stmtDeleteTemplate.run(templateId);
    return true;
  }

  public updateTemplateFolder(templateId: string, folder: string | undefined): boolean {
    const tmpl = this.getTemplate(templateId);
    if (!tmpl) return false;
    tmpl.folder = folder;
    tmpl.updatedAt = new Date().toISOString();
    this.stmtInsertTemplate.run(tmpl.id, JSON.stringify(tmpl));
    return true;
  }

  public updateTemplate(templateId: string, updates: Partial<TemplateInfo>): TemplateInfo | null {
    const tmpl = this.getTemplate(templateId);
    if (!tmpl) return null;
    const newTmpl = { ...tmpl, ...updates, updatedAt: new Date().toISOString() };
    this.stmtInsertTemplate.run(newTmpl.id, JSON.stringify(newTmpl));
    return newTmpl;
  }
}

export const db = new SQLiteDatabase();

import sys
import re

with open("backend-api/src/db.ts", "r") as f:
    content = f.read()

# 1. Update SQLite CREATE TABLE
tables = """
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
"""

content = content.replace("  );", "  );" + tables, 1)

# 2. Add Types
types = """
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
"""
content = content.replace("export interface PointTransaction", types + "\nexport interface PointTransaction")

# 3. Add methods to SQLiteDatabase
methods = """
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
"""

content = content.replace("  // --- 點數系統 ---", methods + "\n  // --- 點數系統 ---")

with open("backend-api/src/db.ts", "w") as f:
    f.write(content)

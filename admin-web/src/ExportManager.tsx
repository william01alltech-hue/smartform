import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const MASTER_TOKEN = import.meta.env.VITE_MASTER_TOKEN || 'william_master_token';

export const ExportManager: React.FC = () => {
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<any | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [newFolderName, setNewFolderName] = useState('');

  const fetchFolders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/export-folders`, {
        headers: { 'Authorization': `Bearer ${MASTER_TOKEN}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setFolders(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFiles = async (folderId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/exported-files/${folderId}`, {
        headers: { 'Authorization': `Bearer ${MASTER_TOKEN}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setFiles(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  useEffect(() => {
    if (selectedFolder) {
      fetchFiles(selectedFolder.id);
    } else {
      setFiles([]);
    }
  }, [selectedFolder]);

  const handleCreateFolder = async (e: React.FormEvent, parentId: string | null = null) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await fetch(`${API_BASE}/api/export-folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MASTER_TOKEN}` },
        body: JSON.stringify({ name: newFolderName, parentId })
      });
      setNewFolderName('');
      fetchFolders();
    } catch (e) {
      console.error(e);
    }
  };

  const downloadFile = (fileId: string, filename: string, format: string) => {
    // We can fetch the file as a blob
    fetch(`${API_BASE}/api/exported-files/download/${fileId}`, {
      headers: { 'Authorization': `Bearer ${MASTER_TOKEN}` }
    })
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${format}`;
        a.click();
      });
  };

  const handleDeleteFolder = async (folder: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`確定要刪除「${folder.name}」？此動作會同時刪除所有子資料夾與其中的檔案，無法復原。`)) return;
    try {
      await fetch(`${API_BASE}/api/export-folders/${folder.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${MASTER_TOKEN}` }
      });
      if (selectedFolder?.id === folder.id) setSelectedFolder(null);
      fetchFolders();
    } catch (e) {
      console.error(e);
    }
  };

  // Build tree
  const rootFolders = folders.filter(f => !f.parentId);
  const getChildren = (parentId: string) => folders.filter(f => f.parentId === parentId);

  const FolderTree = ({ folderList, depth = 0 }: { folderList: any[], depth?: number }) => {
    return (
      <div style={{ paddingLeft: depth === 0 ? 0 : '16px', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: depth === 0 ? 0 : '8px' }}>
        {folderList.map(folder => (
          <div key={folder.id}>
            <div 
              onClick={() => setSelectedFolder(folder)}
              style={{ padding: '8px 12px', background: selectedFolder?.id === folder.id ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer', border: selectedFolder?.id === folder.id ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span>📁</span>
              <span style={{ color: '#fff', fontSize: '14px', flex: 1 }}>{folder.name}</span>
              <button
                onClick={(e) => handleDeleteFolder(folder, e)}
                title="刪除此資料夾"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '14px', padding: '2px 4px', borderRadius: '4px', opacity: 0.6, lineHeight: 1 }}
              >🗑️</button>
            </div>
            {getChildren(folder.id).length > 0 && (
              <FolderTree folderList={getChildren(folder.id)} depth={depth + 1} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', gap: '24px', height: '100%', minHeight: '400px', boxSizing: 'border-box' }}>
      
      {/* Left: Folders */}
      <div style={{ flex: 1, minWidth: '250px', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>🗄️</span>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#fafafa' }}>匯出資料夾管理</h2>
        </div>

        <form onSubmit={(e) => handleCreateFolder(e, null)} style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="新增主資料夾名稱..."
            style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '13px', outline: 'none' }}
          />
          <button type="submit" style={{ padding: '8px 12px', borderRadius: '8px', background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>新增</button>
        </form>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {rootFolders.length === 0 ? (
            <div style={{ color: '#71717a', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>尚未建立任何資料夾</div>
          ) : (
            <FolderTree folderList={rootFolders} />
          )}
        </div>
      </div>

      {/* Right: Files */}
      <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {selectedFolder ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '16px' }}>📂 {selectedFolder.name} - 檔案列表</h3>
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#a1a1aa' }}>在此建立子資料夾:</span>
                <form onSubmit={(e) => handleCreateFolder(e, selectedFolder.id)} style={{ display: 'flex', gap: '4px' }}>
                  <input 
                    type="text" 
                    placeholder="子資料夾名稱..."
                    id="subfolder-input"
                    style={{ width: '120px', padding: '6px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', outline: 'none' }}
                  />
                  <button type="button" onClick={(e) => {
                    const input = document.getElementById('subfolder-input') as HTMLInputElement;
                    setNewFolderName(input.value);
                    setTimeout(() => handleCreateFolder(e, selectedFolder.id), 0);
                  }} style={{ padding: '6px 10px', borderRadius: '6px', background: '#8b5cf6', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>新增</button>
                </form>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
              {files.length === 0 ? (
                <div style={{ color: '#71717a', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>此資料夾中尚無匯出的表單檔案</div>
              ) : (
                files.map(file => (
                  <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '20px' }}>{file.format === 'pdf' ? '📄' : '📊'}</span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>{file.filename}.{file.format}</span>
                        <span style={{ color: '#a1a1aa', fontSize: '11px' }}>匯出時間: {new Date(file.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => downloadFile(file.id, file.filename, file.format)}
                      style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                    >
                      下載檔案
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, color: '#a1a1aa', fontSize: '14px' }}>
            👈 請從左側選擇一個資料夾以查看或下載檔案
          </div>
        )}
      </div>
    </div>
  );
};

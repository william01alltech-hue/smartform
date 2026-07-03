import sys

with open("admin-web/src/ClientMode.tsx", "r") as f:
    content = f.read()

# Add useEffect and states
states_str = """
  const [exportFolders, setExportFolders] = useState<any[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<string>('');
  const [targetFilename, setTargetFilename] = useState<string>('');

  React.useEffect(() => {
    fetch(`${API_BASE}/api/export-folders`, { headers: { 'Authorization': `Bearer ${MASTER_TOKEN}` } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setExportFolders(data);
      })
      .catch(console.error);
  }, []);
"""

content = content.replace("  const [isExporting, setIsExporting] = useState(false);\n", "  const [isExporting, setIsExporting] = useState(false);\n" + states_str)

# Add form UI before submit button
ui_str = """
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginTop: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ color: '#fff', fontSize: '16px', margin: 0 }}>💾 儲存與匯出設定</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 500 }}>設定匯出檔名</label>
          <input 
            type="text" 
            value={targetFilename}
            onChange={(e) => setTargetFilename(e.target.value)}
            placeholder={`例如: ${clientTemplate?.title}_20260703`}
            style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '16px', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 500 }}>選擇雲端儲存資料夾 (選填)</label>
          <select 
            value={targetFolderId}
            onChange={(e) => setTargetFolderId(e.target.value)}
            style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '16px', outline: 'none' }}
          >
            <option value="">不儲存至雲端，僅下載至設備</option>
            {exportFolders.map(f => (
              <option key={f.id} value={f.id}>
                {exportFolders.find(p => p.id === f.parentId)?.name ? `${exportFolders.find(p => p.id === f.parentId)?.name} > ` : ''}{f.name}
              </option>
            ))}
          </select>
        </div>
      </div>
"""

content = content.replace("      <div style={{ position: 'fixed', bottom: 0,", ui_str + "\n      <div style={{ position: 'fixed', bottom: 0,")

# Update formData append
form_data_str = """
              const formData = new FormData();
              formData.append('data', JSON.stringify(clientFormData));
              if (targetFolderId) formData.append('folderId', targetFolderId);
              if (targetFilename) formData.append('filename', targetFilename);
"""

content = content.replace("              const formData = new FormData();\n              formData.append('data', JSON.stringify(clientFormData));", form_data_str)

with open("admin-web/src/ClientMode.tsx", "w") as f:
    f.write(content)


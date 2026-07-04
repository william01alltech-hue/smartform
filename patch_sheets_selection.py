import sys

with open("admin-web/src/App.tsx", "r") as f:
    content = f.read()

# 1. Add state variable
old_state = "const [visualSheets, setVisualSheets] = useState<VisualSheet[]>([]);"
new_state = """const [visualSheets, setVisualSheets] = useState<VisualSheet[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState<string>('');"""

content = content.replace(old_state, new_state)

# 2. Update handleFileUpload to set default selectedSheetName
old_upload = """      setFields(fieldsWithRequired);
      setVisualSheets(config.visualSheets || []);
      setActiveSheetIndex(0);
      setHasUploaded(true);"""

new_upload = """      setFields(fieldsWithRequired);
      const sheets = config.visualSheets || [];
      setVisualSheets(sheets);
      if (sheets.length > 0) {
        setSelectedSheetName(sheets[0].name);
        setActiveSheetIndex(0);
      }
      setHasUploaded(true);"""

content = content.replace(old_upload, new_upload)

# 3. Add Dropdown UI in Configuration panel (next to Form Title and Folder Name)
old_ui_block = """            <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <label style={{ fontSize: '13px', color: '#a1a1aa', fontWeight: 500 }}>表單標題 (Form Title):</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.1)', border: '1px solid #18181b', color: '#fff', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <label style={{ fontSize: '13px', color: '#a1a1aa', fontWeight: 500 }}>資料夾名稱 (Folder):</label>
                <input
                  type="text"
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  placeholder="未分類"
                  style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.1)', border: '1px solid #18181b', color: '#fff', outline: 'none' }}
                />
              </div>
            </div>"""

new_ui_block = """            <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <label style={{ fontSize: '13px', color: '#a1a1aa', fontWeight: 500 }}>表單標題 (Form Title):</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.1)', border: '1px solid #18181b', color: '#fff', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <label style={{ fontSize: '13px', color: '#a1a1aa', fontWeight: 500 }}>資料夾名稱 (Folder):</label>
                <input
                  type="text"
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  placeholder="未分類"
                  style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.1)', border: '1px solid #18181b', color: '#fff', outline: 'none' }}
                />
              </div>
            </div>

            {visualSheets.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px', padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                <label style={{ fontSize: '13px', color: '#c084fc', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚠️ 偵測到多個分頁，請選擇要作為填寫表單的分頁：</span>
                </label>
                <select
                  value={selectedSheetName}
                  onChange={(e) => {
                    const sheetName = e.target.value;
                    setSelectedSheetName(sheetName);
                    const idx = visualSheets.findIndex(s => s.name === sheetName);
                    if (idx !== -1) setActiveSheetIndex(idx);
                  }}
                  style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#000', border: '1px solid #c084fc', color: '#fff', fontSize: '13px', cursor: 'pointer' }}
                >
                  {visualSheets.map((s, i) => (
                    <option key={i} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}"""

content = content.replace(old_ui_block, new_ui_block)

# 4. Modify publishToCloud to filter fields by selectedSheetName
old_publish = """    const configPayload = {
      title,
      fields: fields.map((f, i) => ({ ...f, name: (i + 1).toString() }))
    };"""

new_publish = """    const configPayload = {
      title,
      selectedSheetName,
      fields: fields
        .filter(f => !selectedSheetName || parseRangeForUI(f.rangeStr).sheet === selectedSheetName)
        .map((f, i) => ({ ...f, name: (i + 1).toString() }))
    };"""

content = content.replace(old_publish, new_publish)

with open("admin-web/src/App.tsx", "w") as f:
    f.write(content)


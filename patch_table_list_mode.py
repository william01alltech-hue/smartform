import sys

with open("admin-web/src/App.tsx", "r") as f:
    content = f.read()

# 1. Add states for table list config and generator modal
old_states = """  const [cloudTemplates, setCloudTemplates] = useState<any[]>([]);"""
new_states = """  const [cloudTemplates, setCloudTemplates] = useState<any[]>([]);

  // Table List Mode configurations
  interface TableListConfig {
    startRow: number;
    endRow: number;
    columns: Array<{ col: string; label: string; type: string; maxPhotos?: number }>;
  }
  const [tableListConfig, setTableListConfig] = useState<TableListConfig | null>(null);
  const [showTableGenerator, setShowTableGenerator] = useState(false);

  // Generator modal states
  const [genStartRow, setGenStartRow] = useState<number>(3);
  const [genEndRow, setGenEndRow] = useState<number>(16);
  const [genCols, setGenCols] = useState<Array<{ col: string; label: string; type: string; maxPhotos?: number }>>([
    { col: 'B', label: '項目', type: 'text' },
    { col: 'C', label: '數量', type: 'number' },
    { col: 'D', label: '相片', type: 'image', maxPhotos: 4 }
  ]);"""

content = content.replace(old_states, new_states)

# 2. Add generator button next to "+ 欄位"
old_btn = """                <button className="btn-primary" style={{ background: '#14b8a6', boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.4)', padding: '6px 12px', fontSize: '12px' }} onClick={addNewField}>
                  + 欄位
                </button>"""

new_btn = """                <button className="btn-primary" style={{ background: '#14b8a6', boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.4)', padding: '6px 12px', fontSize: '12px' }} onClick={addNewField}>
                  + 欄位
                </button>
                <button className="btn-primary" style={{ background: '#d97706', boxShadow: '0 4px 14px 0 rgba(217, 119, 6, 0.4)', padding: '6px 12px', fontSize: '12px' }} onClick={() => setShowTableGenerator(true)}>
                  ⚡ 快速生成表格清單
                </button>"""

content = content.replace(old_btn, new_btn)

# 3. Add tableListConfig in publish payload
old_payload = """    const configPayload = {
      title,
      selectedSheetName,
      fields: fields
        .filter(f => !selectedSheetName || parseRangeForUI(f.rangeStr).sheet === selectedSheetName)
        .map((f, i) => ({ ...f, name: (i + 1).toString() }))
    };"""

new_payload = """    const configPayload = {
      title,
      selectedSheetName,
      tableListConfig,
      fields: fields
        .filter(f => !selectedSheetName || parseRangeForUI(f.rangeStr).sheet === selectedSheetName)
        .map((f, i) => ({ ...f, name: (i + 1).toString() }))
    };"""

content = content.replace(old_payload, new_payload)

# 4. Insert generateTableListFields handler and generator modal UI at end of App.tsx
old_end = """      {editingToken && ("""
new_end = """      {/* Table List Mode Automatic Generator Modal */}
      {showTableGenerator && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="glass-panel" style={{ padding: '24px', width: '450px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>⚡ 快速生成表格清單</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#a1a1aa' }}>
              輸入表格的列數範圍，並設定每一列的欄位，系統會自動在下方的表單中批量生成對應。
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#a1a1aa' }}>起始列號 (例如: 3)</label>
                <input 
                  type="number"
                  value={genStartRow}
                  onChange={(e) => setGenStartRow(parseInt(e.target.value, 10) || 1)}
                  style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#a1a1aa' }}>結束列號 (例如: 16)</label>
                <input 
                  type="number"
                  value={genEndRow}
                  onChange={(e) => setGenEndRow(parseInt(e.target.value, 10) || 1)}
                  style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 'bold' }}>欄位設定 (Columns):</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {genCols.map((c, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input 
                      type="text"
                      placeholder="欄代號 (B)"
                      value={c.col}
                      onChange={(e) => {
                        const newCols = [...genCols];
                        newCols[idx].col = e.target.value;
                        setGenCols(newCols);
                      }}
                      style={{ width: '60px', padding: '6px 8px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '12px', textAlign: 'center' }}
                    />
                    <input 
                      type="text"
                      placeholder="名稱 (項目)"
                      value={c.label}
                      onChange={(e) => {
                        const newCols = [...genCols];
                        newCols[idx].label = e.target.value;
                        setGenCols(newCols);
                      }}
                      style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '12px' }}
                    />
                    <select
                      value={c.type}
                      onChange={(e) => {
                        const newCols = [...genCols];
                        newCols[idx].type = e.target.value;
                        setGenCols(newCols);
                      }}
                      style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '12px' }}
                    >
                      <option value="text">純文字</option>
                      <option value="number">數值</option>
                      <option value="image">相片</option>
                      <option value="checkbox">勾選</option>
                      <option value="date">日期</option>
                    </select>
                    <button
                      onClick={() => {
                        const newCols = genCols.filter((_, i) => i !== idx);
                        setGenCols(newCols);
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '16px', cursor: 'pointer' }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setGenCols([...genCols, { col: '', label: '', type: 'text' }])}
                style={{ padding: '6px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', border: '1px dashed rgba(255,255,255,0.2)', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}
              >
                + 新增欄
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button 
                onClick={() => setShowTableGenerator(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', background: '#27272a', color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                取消
              </button>
              <button 
                onClick={() => {
                  const generatedFields: FieldConfig[] = [];
                  const sheetName = selectedSheetName || (visualSheets[activeSheetIndex]?.name || 'Sheet1');

                  for (let r = genStartRow; r <= genEndRow; r++) {
                    genCols.forEach(colInfo => {
                      const colLetter = colInfo.col.toUpperCase().trim();
                      if (!colLetter) return;
                      
                      const rangeStr = `'${sheetName}'!$${colLetter}$${r}`;
                      const name = `row_${r}_col_${colLetter}`;
                      const label = `項次 ${r - genStartRow + 1} - ${colInfo.label}`;
                      
                      generatedFields.push({
                        name,
                        label,
                        type: colInfo.type,
                        sheetName,
                        rangeStr,
                        widthPx: 100,
                        heightPx: 30,
                        required: true,
                        stylePreset: 'default',
                        maxPhotos: colInfo.maxPhotos || 4,
                        imageSizeMode: 'fill',
                        resolutionTag: 'medium'
                      });
                    });
                  }

                  setTableListConfig({
                    startRow: genStartRow,
                    endRow: genEndRow,
                    columns: genCols.map(c => ({ col: c.col, label: c.label, type: c.type, maxPhotos: c.maxPhotos }))
                  });

                  setFields(prev => [...prev, ...generatedFields]);
                  setHasUploaded(true);
                  setShowTableGenerator(false);
                }}
                className="btn-primary"
                style={{ padding: '8px 16px', borderRadius: '6px', background: '#8b5cf6' }}
              >
                確認生成
              </button>
            </div>
          </div>
        </div>
      )}

      {editingToken && ("""

content = content.replace(old_end, new_end)

with open("admin-web/src/App.tsx", "w") as f:
    f.write(content)


import sys

with open("admin-web/src/ClientMode.tsx", "r") as f:
    content = f.read()

# Add expandedRow state at top of ClientMode
old_states = "  const [targetFilename, setTargetFilename] = useState<string>('');"
new_states = """  const [targetFilename, setTargetFilename] = useState<string>('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);"""

content = content.replace(old_states, new_states)

# Replace the field rendering logic with grouped rendering
old_render = """      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {clientTemplate?.config.fields.map((field: any, idx: number) => (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 500 }}>
              {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
            
            {field.type === 'text' && (
              <input 
                type="text" 
                value={clientFormData[field.name] || ''}
                onChange={(e) => setClientFormData({...clientFormData, [field.name]: e.target.value})}
                placeholder="請輸入內容"
                style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '16px', outline: 'none' }}
              />
            )}
            
            {field.type === 'dropdown' && (
              <select 
                value={clientFormData[field.name] || ''}
                onChange={(e) => setClientFormData({...clientFormData, [field.name]: e.target.value})}
                style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '16px', outline: 'none' }}
              >
                <option value="">請選擇</option>
                {(field.dropdownOptions || '').split('\n').filter(Boolean).map((opt: string, i: number) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            )}
            
            {field.type === 'checkbox' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={clientFormData[field.name] === 'true'}
                  onChange={(e) => setClientFormData({...clientFormData, [field.name]: e.target.checked ? 'true' : 'false'})}
                  style={{ width: '20px', height: '20px', accentColor: '#10b981' }}
                />
                <span style={{ color: '#fff', fontSize: '16px' }}>確認勾選</span>
              </label>
            )}
            
            {(field.type === 'image' || field.type === 'signature') && (
              <div style={{ padding: '16px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {(clientFileData[field.name] || []).map((file: File, fIdx: number) => (
                      <div key={fIdx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                        <img src={URL.createObjectURL(file)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div 
                          onClick={() => {
                            const newArr = [...(clientFileData[field.name] || [])];
                            newArr.splice(fIdx, 1);
                            setClientFileData({...clientFileData, [field.name]: newArr});
                          }}
                          style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px' }}>
                          ✕
                        </div>
                      </div>
                    ))}
                    
                    {(!clientFileData[field.name] || clientFileData[field.name].length < (field.maxPhotos || 1)) && (
                      <label style={{ width: '80px', height: '80px', borderRadius: '8px', border: '1px dashed #10b981', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(16, 185, 129, 0.05)' }}>
                        <span style={{ fontSize: '24px' }}>{field.type === 'image' ? '📷' : '✍️'}</span>
                        <span style={{ fontSize: '10px', color: '#10b981', marginTop: '4px' }}>
                          上傳 ({clientFileData[field.name]?.length || 0}/{field.maxPhotos || 1})
                        </span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          multiple={field.maxPhotos && field.maxPhotos > 1}
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              const limit = field.maxPhotos || 1;
                              const currentArr = clientFileData[field.name] || [];
                              const newFiles = Array.from(e.target.files);
                              const combined = [...currentArr, ...newFiles].slice(0, limit);
                              setClientFileData({...clientFileData, [field.name]: combined});
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>"""

new_render = """      {/* Helper function to parse range details */}
      {(() => {
        const parseRangeDetails = (rangeStr: string) => {
          const parts = rangeStr.split('!');
          if (parts.length !== 2) return null;
          const sheet = parts[0].replace(/^'|'$/g, '');
          const cell = parts[1].replace(/\\$/g, '');
          const match = cell.match(/^([A-Z]+)(\\d+)$/i);
          if (!match) return null;
          return {
            sheet,
            col: match[1].toUpperCase(),
            row: parseInt(match[2], 10)
          };
        };

        const renderFieldInput = (field: any, customLabel?: string) => {
          const cleanLabel = customLabel || field.label.replace(/^項次 \\d+ - /, '');
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
              <label style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 500 }}>
                {cleanLabel} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
              </label>
              
              {field.type === 'text' && (
                <input 
                  type="text" 
                  value={clientFormData[field.name] || ''}
                  onChange={(e) => setClientFormData({...clientFormData, [field.name]: e.target.value})}
                  placeholder="請輸入內容"
                  style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '16px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                />
              )}

              {field.type === 'number' && (
                <input 
                  type="number" 
                  value={clientFormData[field.name] || ''}
                  onChange={(e) => setClientFormData({...clientFormData, [field.name]: e.target.value})}
                  placeholder="請輸入數值"
                  style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '16px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                />
              )}
              
              {field.type === 'dropdown' && (
                <select 
                  value={clientFormData[field.name] || ''}
                  onChange={(e) => setClientFormData({...clientFormData, [field.name]: e.target.value})}
                  style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '16px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="">請選擇</option>
                  {(field.dropdownOptions || '').split('\\n').filter(Boolean).map((opt: string, i: number) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
              
              {field.type === 'checkbox' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={clientFormData[field.name] === 'true'}
                    onChange={(e) => setClientFormData({...clientFormData, [field.name]: e.target.checked ? 'true' : 'false'})}
                    style={{ width: '20px', height: '20px', accentColor: '#10b981' }}
                  />
                  <span style={{ color: '#fff', fontSize: '16px' }}>確認勾選</span>
                </label>
              )}
              
              {(field.type === 'image' || field.type === 'signature') && (
                <div style={{ padding: '16px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)', width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(clientFileData[field.name] || []).map((file: File, fIdx: number) => (
                        <div key={fIdx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                          <img src={URL.createObjectURL(file)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div 
                            onClick={() => {
                              const newArr = [...(clientFileData[field.name] || [])];
                              newArr.splice(fIdx, 1);
                              setClientFileData({...clientFileData, [field.name]: newArr});
                            }}
                            style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px' }}>
                            ✕
                          </div>
                        </div>
                      ))}
                      
                      {(!clientFileData[field.name] || clientFileData[field.name].length < (field.maxPhotos || 1)) && (
                        <label style={{ width: '80px', height: '80px', borderRadius: '8px', border: '1px dashed #10b981', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(16, 185, 129, 0.05)' }}>
                          <span style={{ fontSize: '24px' }}>{field.type === 'image' ? '📷' : '✍️'}</span>
                          <span style={{ fontSize: '10px', color: '#10b981', marginTop: '4px' }}>
                            上傳 ({clientFileData[field.name]?.length || 0}/{field.maxPhotos || 1})
                          </span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            multiple={field.maxPhotos && field.maxPhotos > 1}
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                const limit = field.maxPhotos || 1;
                                const currentArr = clientFileData[field.name] || [];
                                const newFiles = Array.from(e.target.files);
                                const combined = [...currentArr, ...newFiles].slice(0, limit);
                                setClientFileData({...clientFileData, [field.name]: combined});
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        };

        const tableConfig = clientTemplate?.config.tableListConfig;
        const fieldsList = clientTemplate?.config.fields || [];

        const generalFields: any[] = [];
        const tableRows: Record<number, any[]> = {};

        fieldsList.forEach((field: any) => {
          const details = parseRangeDetails(field.rangeStr);
          if (tableConfig && details && details.row >= tableConfig.startRow && details.row <= tableConfig.endRow) {
            if (!tableRows[details.row]) {
              tableRows[details.row] = [];
            }
            tableRows[details.row].push(field);
          } else {
            generalFields.push(field);
          }
        });

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 1. General Fields */}
            {generalFields.map((field, idx) => (
              <div key={idx} style={{ width: '100%' }}>
                {renderFieldInput(field, field.label)}
              </div>
            ))}

            {/* 2. Grouped Table List Section */}
            {tableConfig && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                <h3 style={{ color: '#8b5cf6', fontSize: '16px', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📋 表格清單明細</span>
                  <span style={{ fontSize: '12px', padding: '2px 8px', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', borderRadius: '12px' }}>
                    共 {tableConfig.endRow - tableConfig.startRow + 1} 項
                  </span>
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Array.from({ length: tableConfig.endRow - tableConfig.startRow + 1 }).map((_, i) => {
                    const rowIdx = tableConfig.startRow + i;
                    const rowFields = tableRows[rowIdx] || [];
                    if (rowFields.length === 0) return null;

                    const isExpanded = expandedRow === rowIdx;

                    // Compute summary of filled values for this row
                    const filledSummary = rowFields
                      .filter(f => f.type !== 'image' && f.type !== 'signature')
                      .map(f => {
                        const val = clientFormData[f.name];
                        const cleanLabel = f.label.replace(/^項次 \\d+ - /, '');
                        return val ? `${cleanLabel}: ${val}` : null;
                      })
                      .filter(Boolean)
                      .join(' | ');

                    const photosCount = rowFields
                      .filter(f => f.type === 'image')
                      .reduce((sum, f) => sum + (clientFileData[f.name]?.length || 0), 0);

                    return (
                      <div 
                        key={rowIdx} 
                        style={{ 
                          border: isExpanded ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '12px', 
                          background: isExpanded ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255,255,255,0.02)',
                          overflow: 'hidden',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* Row Header / Toggle Accordion */}
                        <div 
                          onClick={() => setExpandedRow(isExpanded ? null : rowIdx)}
                          style={{ 
                            padding: '16px', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            cursor: 'pointer' 
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ color: '#fff', fontSize: '15px', fontWeight: 'bold' }}>
                              項次 {i + 1}
                            </div>
                            {(filledSummary || photosCount > 0) ? (
                              <div style={{ fontSize: '11px', color: '#a1a1aa' }}>
                                {filledSummary || '已填寫部分資料'} {photosCount > 0 && `(📸 相片 x${photosCount})`}
                              </div>
                            ) : (
                              <div style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic' }}>
                                尚未填寫
                              </div>
                            )}
                          </div>
                          <span style={{ color: '#8b5cf6', fontSize: '18px' }}>
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        </div>

                        {/* Expanded Inputs */}
                        {isExpanded && (
                          <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.2)' }}>
                            {rowFields.map((field, fIdx) => (
                              <div key={fIdx}>
                                {renderFieldInput(field)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}"""

content = content.replace(old_render, new_render)

with open("admin-web/src/ClientMode.tsx", "w") as f:
    f.write(content)


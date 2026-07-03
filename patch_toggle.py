import sys

with open("admin-web/src/App.tsx", "r") as f:
    content = f.read()

# 1. Add states
state_insertion = """  const [highlightedRangeStr, setHighlightedRangeStr] = useState<string | null>(null);
  
  const [showAuth, setShowAuth] = useState(true);
  const [showConfig, setShowConfig] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [showAppUI, setShowAppUI] = useState(true);
"""
content = content.replace("  const [highlightedRangeStr, setHighlightedRangeStr] = useState<string | null>(null);", state_insertion)

# 2. Update grid template
grid_str = "gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1.2fr) minmax(0, 0.8fr)'"
new_grid = "gridTemplateColumns: [showPreview ? 'minmax(0, 1.5fr)' : '', (showAuth || showConfig) ? 'minmax(0, 1.2fr)' : '', showAppUI ? 'minmax(0, 0.8fr)' : ''].filter(Boolean).join(' ')"
content = content.replace(grid_str, new_grid)

# 3. Update buttons
btn_old = """          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <button onClick={() => document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' })} style={{ padding: '12px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#cbd5e1', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>1. 主副帳號授權管理</button>
            <button onClick={() => document.getElementById('config-section')?.scrollIntoView({ behavior: 'smooth' })} style={{ padding: '12px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#cbd5e1', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>2. 具名範圍欄位對應與解析</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <button onClick={() => document.getElementById('preview-section')?.scrollIntoView({ behavior: 'smooth' })} style={{ padding: '12px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#cbd5e1', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>3. Excel 樣板表格預覽</button>
            <button onClick={() => alert('此功能即將推出')} style={{ padding: '12px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#cbd5e1', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>4. 模擬填寫端 App UI 渲染</button>
          </div>"""

btn_new = """          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <button onClick={() => setShowAuth(!showAuth)} style={{ padding: '12px 16px', background: showAuth ? '#1e293b' : 'transparent', border: showAuth ? '1px solid #6366f1' : '1px dashed #334155', borderRadius: '8px', color: showAuth ? '#cbd5e1' : '#64748b', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s' }}>1. 主副帳號授權管理</button>
            <button onClick={() => setShowConfig(!showConfig)} style={{ padding: '12px 16px', background: showConfig ? '#1e293b' : 'transparent', border: showConfig ? '1px solid #6366f1' : '1px dashed #334155', borderRadius: '8px', color: showConfig ? '#cbd5e1' : '#64748b', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s' }}>2. 具名範圍欄位對應與解析</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <button onClick={() => setShowPreview(!showPreview)} style={{ padding: '12px 16px', background: showPreview ? '#1e293b' : 'transparent', border: showPreview ? '1px solid #6366f1' : '1px dashed #334155', borderRadius: '8px', color: showPreview ? '#cbd5e1' : '#64748b', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s' }}>3. Excel 樣板表格預覽</button>
            <button onClick={() => setShowAppUI(!showAppUI)} style={{ padding: '12px 16px', background: showAppUI ? '#1e293b' : 'transparent', border: showAppUI ? '1px solid #6366f1' : '1px dashed #334155', borderRadius: '8px', color: showAppUI ? '#cbd5e1' : '#64748b', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s' }}>4. 模擬填寫端 App UI 渲染</button>
          </div>"""
content = content.replace(btn_old, btn_new)

# 4. Wrap sections
content = content.replace(
    """{/* Column 1 (Right): Excel visual layout preview & cell click */}
        <div id="preview-section" """,
    """{/* Column 1 (Right): Excel visual layout preview & cell click */}
        {showPreview && (
        <div id="preview-section" """
)
# End of preview section happens just before Column 2
content = content.replace(
    """          )}
        </div>

        {/* Column 2 (Left): File Upload & Configuration parameters mapping grid */}""",
    """          )}
        </div>
        )}

        {/* Column 2 (Left): File Upload & Configuration parameters mapping grid */}"""
)

# Start of Column 2
content = content.replace(
    """        {/* Column 2 (Left): File Upload & Configuration parameters mapping grid */}
        <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', maxHeight: `${Math.max(previewHeight + 80, 500)}px`, paddingRight: '8px' }}>
          
          {/* Master/Sub Account Settings Panel */}""",
    """        {/* Column 2 (Left): File Upload & Configuration parameters mapping grid */}
        {(showAuth || showConfig) && (
        <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', maxHeight: `${Math.max(previewHeight + 80, 500)}px`, paddingRight: '8px' }}>
          
          {/* Master/Sub Account Settings Panel */}"""
)

# Auth section
content = content.replace(
    """<div id="auth-section" className="glass-panel" """,
    """{showAuth && (
          <div id="auth-section" className="glass-panel" """
)
content = content.replace(
    """          </div>


          {/* Configuration Grid */}""",
    """          </div>
          )}


          {/* Configuration Grid */}"""
)

# Config section
content = content.replace(
    """<div id="config-section" className="glass-panel" """,
    """{showConfig && (
          <div id="config-section" className="glass-panel" """
)
content = content.replace(
    """              </div>
            </div>
          ) : (
            <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8', textAlign: 'center', gap: '16px' }}>

            </div>
          )}
        </div>

        {/* Right column: Simulated mobile App form UI rendering preview */}""",
    """              </div>
            </div>
          ) : (
            <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8', textAlign: 'center', gap: '16px' }}>

            </div>
          )}
        </div>
        )}
        </div>
        )}

        {/* Right column: Simulated mobile App form UI rendering preview */}"""
)

# App UI section
content = content.replace(
    """        {/* Right column: Simulated mobile App form UI rendering preview */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>""",
    """        {/* Right column: Simulated mobile App form UI rendering preview */}
        {showAppUI && (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>"""
)
content = content.replace(
    """              ))}
            </div>
          )}
        </div>

      </main>""",
    """              ))}
            </div>
          )}
        </div>
        )}

      </main>"""
)

with open("admin-web/src/App.tsx", "w") as f:
    f.write(content)

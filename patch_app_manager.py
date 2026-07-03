import sys

with open("admin-web/src/App.tsx", "r") as f:
    content = f.read()

# Add import
content = content.replace("import { ClientMode } from './ClientMode';", "import { ClientMode } from './ClientMode';\nimport { ExportManager } from './ExportManager';")

# Add state
content = content.replace("const [showAppUI, setShowAppUI] = useState(true);", "const [showAppUI, setShowAppUI] = useState(true);\n  const [showExportManager, setShowExportManager] = useState(false);")

# Add button
btn_str = """
            <button onClick={() => { setShowExportManager(!showExportManager); setShowAuth(false); setShowConfig(false); setShowPreview(false); setShowAppUI(false); }} style={{ padding: '12px 16px', background: showExportManager ? 'rgba(255,255,255,0.15)' : 'transparent', border: showExportManager ? '1px solid rgba(255,255,255,0.5)' : '1px dashed rgba(255,255,255,0.2)', borderRadius: '8px', color: showExportManager ? '#e4e4e7' : '#71717a', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s', marginTop: '12px' }}>5. 匯出資料夾管理</button>
"""
content = content.replace("            <button onClick={() => setShowAppUI(!showAppUI)", "            <button onClick={() => setShowAppUI(!showAppUI)")
# I will append the button to the second column of buttons
content = content.replace("</button>\n          </div>\n        </div>", "</button>\n            " + btn_str.strip() + "\n          </div>\n        </div>")

# Render
render_str = """
        {/* Export Manager */}
        {showExportManager && (
          <div style={{ padding: '0 30px' }}>
            <ExportManager />
          </div>
        )}
"""

content = content.replace("{/* Column 2 (Left): File Upload & Configuration parameters mapping grid */}", render_str + "\n        {/* Column 2 (Left): File Upload & Configuration parameters mapping grid */}")

with open("admin-web/src/App.tsx", "w") as f:
    f.write(content)


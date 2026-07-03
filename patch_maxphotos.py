import sys

with open("admin-web/src/App.tsx", "r") as f:
    content = f.read()

# Locate image configuration UI in App.tsx
# In the field configuration map (lines ~1000)
# We will search for field.type === 'image' || field.type === 'signature' configuration block

target_block = """
                  {(field.type === 'image' || field.type === 'signature') && (
                    <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid #27272a', display: 'flex', gap: '12px', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
"""

replacement_block = """
                  {(field.type === 'image' || field.type === 'signature') && (
                    <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid #27272a', display: 'flex', gap: '12px', flexDirection: 'column' }}>
                      
                      {field.type === 'image' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '13px', color: '#a1a1aa', width: '70px' }}>張數上限</span>
                          <select
                            value={field.maxPhotos || 1}
                            onChange={(e) => updateField(field.id, 'maxPhotos', parseInt(e.target.value, 10))}
                            style={{ padding: '6px 10px', borderRadius: '6px', background: '#000', border: '1px solid #3f3f46', color: '#fff', fontSize: '13px', flex: 1 }}
                          >
                            <option value={1}>最多 1 張 (單圖)</option>
                            <option value={2}>最多 2 張 (並排)</option>
                            <option value={3}>最多 3 張 (九宮格)</option>
                            <option value={4}>最多 4 張 (九宮格)</option>
                          </select>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
"""

content = content.replace(target_block, replacement_block)

with open("admin-web/src/App.tsx", "w") as f:
    f.write(content)


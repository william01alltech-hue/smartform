import sys

with open("admin-web/src/App.tsx", "r") as f:
    content = f.read()

# 1. Update FieldConfig
content = content.replace(
    "imageSizeMode?: 'fill' | 'padding10' | 'contain';",
    "imageSizeMode?: 'fill' | 'padding10' | 'contain';\n  dropdownOptions?: string;"
)

# 2. Add dropdown to select options
select_options = """<option value="text">純文字</option>
                              <option value="dropdown">下拉選單</option>
                              <option value="image">相片</option>"""
content = content.replace(
    '<option value="text">純文字</option>\n                              <option value="image">相片</option>',
    select_options
)

# 3. Add textarea next to the select for dropdownOptions
select_block = """</select>
                          </td>"""
textarea_block = """</select>
                            {field.type === 'dropdown' && (
                              <textarea
                                value={field.dropdownOptions || ''}
                                onChange={(e) => updateField(idx, 'dropdownOptions', e.target.value)}
                                placeholder="選項1\n選項2\n選項3"
                                style={{ marginTop: '4px', width: '80px', height: '40px', padding: '4px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '10px', resize: 'none' }}
                              />
                            )}
                          </td>"""
content = content.replace(select_block, textarea_block, 1) # Only first occurrence which is the 'type' select

# 4. Add to App UI rendering
text_ui = """{field.type === 'text' && ("""
dropdown_ui = """{field.type === 'dropdown' && (
                    <select
                      disabled
                      style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.2)', border: 'none', color: '#71717a', fontSize: '12px', appearance: 'none' }}
                    >
                      <option value="">請選擇...</option>
                      {(field.dropdownOptions || '').split('\\n').filter(Boolean).map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                  {field.type === 'text' && ("""
content = content.replace(text_ui, dropdown_ui)

with open("admin-web/src/App.tsx", "w") as f:
    f.write(content)

print("Dropdown added")

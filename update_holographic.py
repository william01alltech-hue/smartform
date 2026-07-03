import sys

with open("admin-web/src/App.tsx", "r") as f:
    content = f.read()

# Replace hardcoded button backgrounds (active state)
content = content.replace("showAuth ? '#18181b' : 'transparent'", "showAuth ? 'rgba(255,255,255,0.15)' : 'transparent'")
content = content.replace("showConfig ? '#18181b' : 'transparent'", "showConfig ? 'rgba(255,255,255,0.15)' : 'transparent'")
content = content.replace("showPreview ? '#18181b' : 'transparent'", "showPreview ? 'rgba(255,255,255,0.15)' : 'transparent'")
content = content.replace("showAppUI ? '#18181b' : 'transparent'", "showAppUI ? 'rgba(255,255,255,0.15)' : 'transparent'")

# Replace button borders
content = content.replace("showAuth ? '1px solid #8b5cf6' : '1px dashed #27272a'", "showAuth ? '1px solid rgba(255,255,255,0.5)' : '1px dashed rgba(255,255,255,0.2)'")
content = content.replace("showConfig ? '1px solid #8b5cf6' : '1px dashed #27272a'", "showConfig ? '1px solid rgba(255,255,255,0.5)' : '1px dashed rgba(255,255,255,0.2)'")
content = content.replace("showPreview ? '1px solid #8b5cf6' : '1px dashed #27272a'", "showPreview ? '1px solid rgba(255,255,255,0.5)' : '1px dashed rgba(255,255,255,0.2)'")
content = content.replace("showAppUI ? '1px solid #8b5cf6' : '1px dashed #27272a'", "showAppUI ? '1px solid rgba(255,255,255,0.5)' : '1px dashed rgba(255,255,255,0.2)'")

# Replace header top section
content = content.replace("backgroundColor: '#09090b'", "backgroundColor: 'rgba(0,0,0,0.1)'")

# Inputs
content = content.replace("backgroundColor: '#18181b'", "backgroundColor: 'rgba(0,0,0,0.2)'")
content = content.replace("border: '1px solid #27272a'", "border: '1px solid rgba(255,255,255,0.15)'")
content = content.replace("backgroundColor: '#27272a'", "backgroundColor: 'rgba(255,255,255,0.1)'")

# Smart phone frame
content = content.replace("border: '8px solid #18181b'", "border: '8px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)'")

# Empty Excel state
content = content.replace("background: 'rgba(9, 9, 11, 0.3)'", "background: 'rgba(255, 255, 255, 0.05)'")
content = content.replace("border: '1px dashed #27272a'", "border: '1px dashed rgba(255, 255, 255, 0.3)'")
content = content.replace("color: '#27272a'", "color: 'rgba(255,255,255,0.3)'") # wait, where is #27272a used for color?
content = content.replace("color: '#27272a'", "color: 'rgba(255, 255, 255, 0.3)'")

# Upload zone
content = content.replace("border: '2px dashed #27272a'", "border: '2px dashed rgba(255,255,255,0.3)'")
content = content.replace("background: '#09090b'", "background: 'rgba(0,0,0,0.2)'")

with open("admin-web/src/App.tsx", "w") as f:
    f.write(content)

print("Holographic theme applied to App.tsx")

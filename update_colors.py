import sys

def replace_colors(filename):
    with open(filename, "r") as f:
        content = f.read()

    # Slate to Zinc
    content = content.replace("#0f172a", "#09090b") # slate 900 -> zinc 950 (darker bg)
    content = content.replace("#1e293b", "#18181b") # slate 800 -> zinc 900 (panel bg)
    content = content.replace("#334155", "#27272a") # slate 700 -> zinc 800 (borders)
    
    # Indigo to Violet/Purple
    content = content.replace("#6366f1", "#8b5cf6") # indigo 500 -> purple 500 (primary)
    
    # Text colors
    content = content.replace("#cbd5e1", "#e4e4e7") # slate 300 -> zinc 200
    content = content.replace("#64748b", "#71717a") # slate 500 -> zinc 500
    content = content.replace("#94a3b8", "#a1a1aa") # slate 400 -> zinc 400
    content = content.replace("#f1f5f9", "#fafafa") # slate 100 -> zinc 50
    
    # Success/Green
    content = content.replace("#10b981", "#14b8a6") # emerald 500 -> teal 500
    
    with open(filename, "w") as f:
        f.write(content)

replace_colors("admin-web/src/App.tsx")

with open("admin-web/src/index.css", "r") as f:
    css_content = f.read()

css_content = css_content.replace("#0b0f19", "#000000") # black background for extreme contrast
css_content = css_content.replace("rgba(30, 41, 59, 0.45)", "rgba(24, 24, 27, 0.45)") # zinc 900 with opacity
css_content = css_content.replace("rgba(99, 102, 241", "rgba(139, 92, 246") # indigo -> purple rgb

with open("admin-web/src/index.css", "w") as f:
    f.write(css_content)

print("Colors updated")

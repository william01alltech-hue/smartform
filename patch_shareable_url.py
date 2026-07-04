import sys

# 1. Patch App.tsx
with open("admin-web/src/App.tsx", "r") as f:
    app_content = f.read()

# Read urlToken at top of Dashboard or file
app_content = app_content.replace(
    "const Dashboard: React.FC = () => {",
    """const queryParams = new URLSearchParams(window.location.search);
const urlToken = queryParams.get('token');
const activeToken = urlToken || MASTER_TOKEN;

const Dashboard: React.FC = () => {"""
)

# Use activeToken instead of MASTER_TOKEN in fetchTemplates
app_content = app_content.replace(
    "const response = await fetch(`${API_BASE}/api/templates?token=${MASTER_TOKEN}`);",
    "const response = await fetch(`${API_BASE}/api/templates?token=${activeToken}`);"
)

# Update isClientMode default state
app_content = app_content.replace(
    "const [isClientMode, setIsClientMode] = useState(window.innerWidth <= 768);",
    "const [isClientMode, setIsClientMode] = useState(urlToken ? urlToken.startsWith('member_') : window.innerWidth <= 768);"
)

# Pass token to ClientMode component
app_content = app_content.replace(
    "<ClientMode cloudTemplates={cloudTemplates} />",
    "<ClientMode cloudTemplates={cloudTemplates} token={activeToken} />"
)

# Add "Copy URL" button to the member tokens list
old_btn = """                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(t.token);
                            alert(`成員金鑰 ${t.token} 已複製！`);
                          }}
                          style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
                        >
                          複製
                        </button>"""

new_btn = """                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(t.token);
                            alert(`成員金鑰 ${t.token} 已複製！`);
                          }}
                          style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
                        >
                          複製金鑰
                        </button>
                        <button
                          onClick={() => {
                            const link = `${window.location.origin}/?token=${t.token}`;
                            navigator.clipboard.writeText(link);
                            alert(`成員連結已複製！\\n${link}`);
                          }}
                          style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: '#10b981', border: 'none', color: '#fff', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          複製專屬連結
                        </button>"""

app_content = app_content.replace(old_btn, new_btn)

with open("admin-web/src/App.tsx", "w") as f:
    f.write(app_content)


# 2. Patch ClientMode.tsx
with open("admin-web/src/ClientMode.tsx", "r") as f:
    client_content = f.read()

# Update props interface
client_content = client_content.replace(
    """interface ClientModeProps {
  cloudTemplates: any[];
}""",
    """interface ClientModeProps {
  cloudTemplates: any[];
  token: string;
}"""
)

# Update ClientMode definition
client_content = client_content.replace(
    "export const ClientMode: React.FC<ClientModeProps> = ({ cloudTemplates }) => {",
    "export const ClientMode: React.FC<ClientModeProps> = ({ cloudTemplates, token }) => {"
)

# Replace MASTER_TOKEN with token in ClientMode fetch calls
client_content = client_content.replace(
    "fetch(`${API_BASE}/api/export-folders`, { headers: { 'Authorization': `Bearer ${MASTER_TOKEN}` } })",
    "fetch(`${API_BASE}/api/export-folders`, { headers: { 'Authorization': `Bearer ${token}` } })"
)

client_content = client_content.replace(
    "const res = await fetch(`${API_BASE}/api/templates/${clientTemplate.id}/export`, {\\n                 method: 'POST',\\n                 headers: { 'Authorization': `Bearer ${MASTER_TOKEN}` },",
    "const res = await fetch(`${API_BASE}/api/templates/${clientTemplate.id}/export`, {\\n                 method: 'POST',\\n                 headers: { 'Authorization': `Bearer ${token}` },"
)

with open("admin-web/src/ClientMode.tsx", "w") as f:
    f.write(client_content)


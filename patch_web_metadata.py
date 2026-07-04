import sys

with open("admin-web/src/App.tsx", "r") as f:
    content = f.read()

# 1. Update MemberTokenData interface and add state variables
old_interface = """  interface MemberTokenData {
    token: string;
    allowedFolders?: string[];
  }
  const [memberTokens, setMemberTokens] = useState<MemberTokenData[]>([]);
  const [editingToken, setEditingToken] = useState<string | null>(null);"""

new_interface = """  interface MemberTokenData {
    token: string;
    allowedFolders?: string[];
    memberId?: string;
    memberName?: string;
  }
  const [memberTokens, setMemberTokens] = useState<MemberTokenData[]>([]);
  const [editingToken, setEditingToken] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string>('');
  const [editingMemberName, setEditingMemberName] = useState<string>('');"""

content = content.replace(old_interface, new_interface)

# 2. Update generateMemberToken function to ask for id and name
old_generate = """  const generateMemberToken = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/generate-member-token`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': MASTER_TOKEN
        },
        body: JSON.stringify({ token: MASTER_TOKEN })
      });
      const data = await response.json();
      if (data.success) {
        setMemberTokens(prev => [...prev, { token: data.memberToken, allowedFolders: data.allowedFolders }]);
      } else {"""

new_generate = """  const generateMemberToken = async () => {
    const memberId = window.prompt('請輸入成員編號/工號 (選填)：') || '';
    const memberName = window.prompt('請輸入成員姓名 (選填)：') || '';

    try {
      const response = await fetch(`${API_BASE}/api/auth/generate-member-token`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': MASTER_TOKEN
        },
        body: JSON.stringify({ token: MASTER_TOKEN, memberId, memberName })
      });
      const data = await response.json();
      if (data.success) {
        setMemberTokens(prev => [...prev, { 
          token: data.memberToken, 
          memberId: data.memberId,
          memberName: data.memberName,
          allowedFolders: data.allowedFolders 
        }]);
      } else {"""

content = content.replace(old_generate, new_generate)

# 3. Update the memberTokens.map list to display metadata and setup states on edit click
old_list_item = """                        <button
                          onClick={() => {
                            setEditingToken(t.token);
                            setEditingFolders(new Set(t.allowedFolders || [])); // If undefined, we could treat it as "empty" in UI, but wait: if undefined, the user had "all access" implicitly before. Let's just initialize it empty for simplicity or with all available. If it's undefined, let's pre-check all.
                            if (t.allowedFolders === undefined) {
                              const allFolders = Array.from(new Set(cloudTemplates.map(tmpl => tmpl.folder).filter(f => f)));
                              setEditingFolders(new Set(allFolders));
                            }
                          }}
                          style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: '#eab308', border: 'none', color: '#000', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          權限設定
                        </button>"""

new_list_item = """                        <button
                          onClick={() => {
                            setEditingToken(t.token);
                            setEditingMemberId(t.memberId || '');
                            setEditingMemberName(t.memberName || '');
                            setEditingFolders(new Set(t.allowedFolders || []));
                            if (t.allowedFolders === undefined) {
                              const allFolders = Array.from(new Set(cloudTemplates.map(tmpl => tmpl.folder).filter(f => f)));
                              setEditingFolders(new Set(allFolders));
                            }
                          }}
                          style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: '#eab308', border: 'none', color: '#000', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          權限設定
                        </button>"""

content = content.replace(old_list_item, new_list_item)

# 4. Display Member Metadata right under the token in the list
old_display = """                      <div style={{ fontSize: '10px', color: '#71717a', paddingLeft: '4px' }}>
                        授權專案："""

new_display = """                      <div style={{ fontSize: '11px', color: '#a1a1aa', paddingLeft: '4px', display: 'flex', gap: '12px' }}>
                        <span>🆔 編號: <span style={{ color: '#fff', fontWeight: 'bold' }}>{t.memberId || '未設定'}</span></span>
                        <span>👤 姓名: <span style={{ color: '#fff', fontWeight: 'bold' }}>{t.memberName || '未設定'}</span></span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#71717a', paddingLeft: '4px' }}>
                        授權專案："""

content = content.replace(old_display, new_display)

# 5. Update Permissions dialog layout to add metadata input fields
old_dialog_top = """            <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>設定專案權限</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#a1a1aa' }}>
              設定金鑰 <span style={{ color: '#14b8a6' }}>{editingToken}</span> 的可見資料夾。<br/>
              <b>提醒：若要給予所有專案與未分類表單的權限，請點擊「全部權限」。</b>
            </p>"""

new_dialog_top = """            <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>設定成員資料與權限</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#a1a1aa' }}>
              設定金鑰 <span style={{ color: '#14b8a6' }}>{editingToken}</span> 的成員資訊與可見資料夾。
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <label style={{ fontSize: '11px', color: '#a1a1aa' }}>成員編號 / 工號</label>
                <input 
                  type="text"
                  placeholder="例如: 001"
                  value={editingMemberId}
                  onChange={(e) => setEditingMemberId(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '12px', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <label style={{ fontSize: '11px', color: '#a1a1aa' }}>成員姓名</label>
                <input 
                  type="text"
                  placeholder="例如: 王小明"
                  value={editingMemberName}
                  onChange={(e) => setEditingMemberName(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '12px', outline: 'none' }}
                />
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: '#a1a1aa' }}>
              <b>提醒：若要給予所有專案與未分類表單的權限，請點擊「全部權限」。</b>
            </p>"""

content = content.replace(old_dialog_top, new_dialog_top)

# 6. Update dialog save buttons in App.tsx to send memberId/memberName
old_save_all = """                  onClick={async () => {
                    // 全局存取權：發送 undefined
                    const res = await fetch(`${API_BASE}/api/auth/member-tokens/${editingToken}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', 'Authorization': MASTER_TOKEN },
                      body: JSON.stringify({ allowedFolders: undefined })
                    });
                    if (res.ok) {
                      setMemberTokens(prev => prev.map(t => t.token === editingToken ? { ...t, allowedFolders: undefined } : t));
                      setEditingToken(null);
                    } else alert('權限更新失敗');
                  }}"""

new_save_all = """                  onClick={async () => {
                    // 全局存取權：發送 undefined
                    const res = await fetch(`${API_BASE}/api/auth/member-tokens/${editingToken}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', 'Authorization': MASTER_TOKEN },
                      body: JSON.stringify({ allowedFolders: undefined, memberId: editingMemberId, memberName: editingMemberName })
                    });
                    if (res.ok) {
                      setMemberTokens(prev => prev.map(t => t.token === editingToken ? { ...t, allowedFolders: undefined, memberId: editingMemberId, memberName: editingMemberName } : t));
                      setEditingToken(null);
                    } else alert('更新失敗');
                  }}"""

content = content.replace(old_save_all, new_save_all)

old_save_checked = """                  onClick={async () => {
                    // 儲存特定勾選：發送陣列 (即使是空陣列也代表無權限)
                    const payloadFolders = Array.from(editingFolders);
                    const res = await fetch(`${API_BASE}/api/auth/member-tokens/${editingToken}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', 'Authorization': MASTER_TOKEN },
                      body: JSON.stringify({ allowedFolders: payloadFolders })
                    });
                    if (res.ok) {
                      setMemberTokens(prev => prev.map(t => t.token === editingToken ? { ...t, allowedFolders: payloadFolders } : t));
                      setEditingToken(null);
                    } else alert('權限更新失敗');
                  }}"""

new_save_checked = """                  onClick={async () => {
                    // 儲存特定勾選：發送陣列 (即使是空陣列也代表無權限)
                    const payloadFolders = Array.from(editingFolders);
                    const res = await fetch(`${API_BASE}/api/auth/member-tokens/${editingToken}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', 'Authorization': MASTER_TOKEN },
                      body: JSON.stringify({ allowedFolders: payloadFolders, memberId: editingMemberId, memberName: editingMemberName })
                    });
                    if (res.ok) {
                      setMemberTokens(prev => prev.map(t => t.token === editingToken ? { ...t, allowedFolders: payloadFolders, memberId: editingMemberId, memberName: editingMemberName } : t));
                      setEditingToken(null);
                    } else alert('更新失敗');
                  }}"""

content = content.replace(old_save_checked, new_save_checked)

with open("admin-web/src/App.tsx", "w") as f:
    f.write(content)


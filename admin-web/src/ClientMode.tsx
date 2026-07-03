import React, { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const MASTER_TOKEN = import.meta.env.VITE_MASTER_TOKEN || 'william_master_token';

interface ClientModeProps {
  cloudTemplates: any[];
}

export const ClientMode: React.FC<ClientModeProps> = ({ cloudTemplates }) => {
  const [clientFolder, setClientFolder] = useState<string | null>(null);
  const [clientTemplate, setClientTemplate] = useState<any | null>(null);
  const [clientFormData, setClientFormData] = useState<Record<string, string>>({});
  const [clientFileData, setClientFileData] = useState<Record<string, File>>({});
  const [isExporting, setIsExporting] = useState(false);

  if (!clientFolder && !clientTemplate) {
    return (
      <div style={{ flex: 1, padding: '20px', maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
        <h2 style={{ color: '#fff', marginBottom: '24px' }}>📁 選擇表單資料夾</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px' }}>
          {Array.from(new Set(cloudTemplates.map(t => t.folder).filter(Boolean))).map((f: any, idx) => (
            <div key={idx} onClick={() => setClientFolder(f)} style={{ background: 'rgba(255,255,255,0.05)', padding: '24px 16px', borderRadius: '16px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', transition: 'all 0.2s ease' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
              <div style={{ color: '#fff', fontWeight: 500 }}>{f}</div>
            </div>
          ))}
          {cloudTemplates.filter(t => !t.folder).length > 0 && (
            <div onClick={() => setClientFolder('uncategorized')} style={{ background: 'rgba(255,255,255,0.05)', padding: '24px 16px', borderRadius: '16px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
              <div style={{ color: '#fff', fontWeight: 500 }}>未分類表單</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (clientFolder && !clientTemplate) {
    return (
      <div style={{ flex: 1, padding: '20px', maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
        <button onClick={() => setClientFolder(null)} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', marginBottom: '16px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>←</span> 返回資料夾清單
        </button>
        <h2 style={{ color: '#fff', marginBottom: '24px' }}>{clientFolder === 'uncategorized' ? '未分類表單' : `📂 ${clientFolder}`}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {cloudTemplates.filter(t => clientFolder === 'uncategorized' ? !t.folder : t.folder === clientFolder).map((t: any) => (
            <div key={t.id} onClick={() => {
              setClientTemplate(t);
              setClientFormData({});
              setClientFileData({});
            }} style={{ background: 'rgba(255,255,255,0.05)', padding: '16px 20px', borderRadius: '12px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: '#fff', fontSize: '16px', fontWeight: 500 }}>{t.title}</div>
              <div style={{ color: '#10b981', fontSize: '14px' }}>開始填寫 →</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, padding: '20px', maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowY: 'auto', paddingBottom: '100px' }}>
      <button onClick={() => setClientTemplate(null)} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', marginBottom: '16px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span>←</span> 返回表單列表
      </button>
      <h2 style={{ color: '#fff', marginBottom: '24px' }}>📝 {clientTemplate?.title}</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
              <div style={{ padding: '16px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.3)', textAlign: 'center', background: 'rgba(255,255,255,0.05)' }}>
                <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{field.type === 'image' ? '📷' : '✍️'}</span>
                  <span style={{ fontSize: '14px', color: '#10b981', fontWeight: 'bold' }}>點擊上傳圖片</span>
                  {clientFileData[field.name] && (
                    <span style={{ fontSize: '12px', color: '#a1a1aa', marginTop: '4px' }}>已選擇: {clientFileData[field.name].name}</span>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setClientFileData({...clientFileData, [field.name]: e.target.files[0]});
                      }
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px', background: 'rgba(24, 24, 27, 0.9)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '12px', zIndex: 100 }}>
        <button 
          onClick={async () => {
            setIsExporting(true);
            try {
              const formData = new FormData();
              formData.append('data', JSON.stringify(clientFormData));
              
              Object.keys(clientFileData).forEach((key) => {
                formData.append(key, clientFileData[key]);
              });

              const res = await fetch(`${API_BASE}/api/templates/${clientTemplate.id}/export`, {
                method: 'POST',
                headers: { 'Authorization': MASTER_TOKEN },
                body: formData
              });
              
              if (!res.ok) {
                const err = await res.json();
                alert('匯出失敗: ' + (err.error || '未知錯誤'));
                return;
              }
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${clientTemplate.title}_${new Date().getTime()}.xlsx`;
              a.click();
              alert('✅ 表單已成功送出並下載！');
              setClientTemplate(null);
            } catch (e) {
              console.error(e);
              alert('匯出發生錯誤');
            } finally {
              setIsExporting(false);
            }
          }}
          disabled={isExporting}
          style={{ flex: 1, padding: '14px', borderRadius: '12px', background: isExporting ? '#6b7280' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: isExporting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
        >
          {isExporting ? '🔄 處理中...' : '送出並下載'}
        </button>
      </div>
    </div>
  );
};

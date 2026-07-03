import React, { useState, useEffect } from 'react';
const API_BASE = import.meta.env.VITE_API_BASE_URL;
const MASTER_TOKEN = import.meta.env.VITE_MASTER_TOKEN || 'william_master_token';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import type { Language } from './context/LanguageContext';
import { ClientMode } from './ClientMode';
import { ExportManager } from './ExportManager';

interface FieldConfig {
  name: string;
  type: string;
  label: string;
  sheetName?: string;
  rangeStr: string;
  widthPx: number;
  heightPx: number;
  aspectRatio?: number;
  resolutionTag?: string;
  required?: boolean;
  stylePreset?: string;
  imageSizeMode?: 'fill' | 'padding10' | 'contain';
  dropdownOptions?: string;
  maxPhotos?: number;
}

const parseRangeForUI = (rangeStr: string) => {
  const parts = rangeStr.split('!');
  if (parts.length === 2) {
    const sheet = parts[0].replace(/^'|'$/g, '');
    return { sheet, cell: parts[1].replace(/\$/g, '') };
  }
  return { sheet: '', cell: rangeStr.replace(/\$/g, '') };
};


const STYLE_PRESETS = [
  { id: 'default', name: '預設' },
  { id: 'bold_black', name: '粗體黑色' },
  { id: 'italic_gray', name: '斜體灰色' },
  { id: 'classic_blue', name: '經典藍' },
  { id: 'classic_blue_bold', name: '經典藍粗體' },
  { id: 'royal_blue_header', name: '皇家藍標頭' },
  { id: 'modern_indigo', name: '現代靛藍' },
  { id: 'navy_white', name: '海軍藍底白字' },
  { id: 'success_green', name: '成功綠' },
  { id: 'success_green_bg', name: '成功綠背景' },
  { id: 'danger_red', name: '警示紅' },
  { id: 'danger_red_bg', name: '警示紅背景' },
  { id: 'warning_amber', name: '警告琥珀色' },
  { id: 'warning_yellow_bg', name: '警告黃背景' },
  { id: 'soft_gray', name: '柔和灰' },
  { id: 'elegant_teal', name: '高雅藍綠' },
  { id: 'large_title', name: '放大標題' },
  { id: 'subtitle_italic', name: '副標題斜體' },
  { id: 'monospaced_code', name: '等寬字體' },
  { id: 'serif_classic', name: '經典襯線體' },
  { id: 'purple_lux', name: '奢華紫' },
  { id: 'purple_lux_bg', name: '奢華紫背景' },
  { id: 'orange_sunset', name: '日落橘' },
  { id: 'mint_fresh', name: '薄荷綠' },
  { id: 'gold_elegant', name: '高雅金' },
  { id: 'charcoal_minimal', name: '炭黑極簡' },
  { id: 'sky_active', name: '天空藍活力' },
  { id: 'double_border_bold', name: '雙底線粗體' },
  { id: 'highlight_yellow', name: '黃色螢光筆' },
  { id: 'numeric_currency', name: '貨幣/數值靠右' }
];

interface VisualCell {
  address: string;
  value: string;
  row: number;
  col: number;
  isMerged: boolean;
  masterAddress?: string;
  rowSpan?: number;
  colSpan?: number;
  isSlave?: boolean;
  style?: {
    backgroundColor?: string;
    color?: string;
    fontWeight?: string;
    fontStyle?: string;
    fontSize?: string;
    textAlign?: string;
    verticalAlign?: string;
    borderTop?: string;
    borderLeft?: string;
    borderBottom?: string;
    borderRight?: string;
    textDecoration?: string;
    wrapText?: boolean;
  };
}

interface VisualSheet {
  name: string;
  rows: VisualCell[][];
  columnWidths: number[];
  rowHeights: number[];
}

const Dashboard: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [visualSheets, setVisualSheets] = useState<VisualSheet[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('工地表單檢驗');
  const [folder, setFolder] = useState(''); // Default to empty (Uncategorized)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hasUploaded, setHasUploaded] = useState(false);
  const [highlightedRangeStr, setHighlightedRangeStr] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(true);
  const [showConfig, setShowConfig] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [showAppUI, setShowAppUI] = useState(true);
  const [showExportManager, setShowExportManager] = useState(false);
  const [isClientMode, setIsClientMode] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsClientMode(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // UX enhancements
  const [pickingLabelIdx, setPickingLabelIdx] = useState<number | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(0.67);
  const [previewHeight, setPreviewHeight] = useState(550);

  // The modal state has been removed as the table is fully inline editable

  // Master/Sub-account Token States
  interface MemberTokenData {
    token: string;
    allowedFolders?: string[];
  }
  const [memberTokens, setMemberTokens] = useState<MemberTokenData[]>([]);
  const [editingToken, setEditingToken] = useState<string | null>(null);
  const [editingFolders, setEditingFolders] = useState<Set<string>>(new Set());
  const [publishStatus, setPublishStatus] = useState<string>('');
  
  // Cloud Templates State
  const [cloudTemplates, setCloudTemplates] = useState<any[]>([]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/templates?token=${MASTER_TOKEN}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setCloudTemplates(data);
      }
    } catch (e) {
      console.error('Error fetching templates:', e);
    }
  };

  const fetchMemberTokens = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/member-tokens`, {
        headers: { 'Authorization': MASTER_TOKEN }
      });
      const data = await res.json();
      if (data.success) {
        setMemberTokens(data.members);
      }
    } catch (e) {
      console.error('Error fetching member tokens:', e);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchMemberTokens();
  }, []);

  const generateMemberToken = async () => {
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
      } else {
        alert('無法產生成員金鑰: ' + data.error);
      }
    } catch (e) {
      console.error(e);
      alert('無法連線至後端伺服器');
    }
  };

  const deleteMemberToken = async (tokenToDelete: string) => {
    if (!window.confirm(`確定要刪除金鑰 ${tokenToDelete} 嗎？此操作將使該員工無法登入。`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/auth/member-tokens/${tokenToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': MASTER_TOKEN }
      });
      if (res.ok) {
        setMemberTokens(prev => prev.filter(t => t.token !== tokenToDelete));
      } else {
        alert('刪除失敗');
      }
    } catch (e) {
      console.error(e);
      alert('無法連線至後端伺服器');
    }
  };



  const publishToCloud = async () => {
    if (!selectedFile) {
      alert('請先上傳 Excel 樣板檔案！');
      return;
    }
    setPublishStatus('publishing...');
    const formData = new FormData();
    formData.append('template', selectedFile);
    formData.append('token', MASTER_TOKEN);
    formData.append('title', title);
    if (folder.trim()) {
      formData.append('folder', folder.trim());
    }
    
    const configPayload = {
      title,
      fields: fields.map((f, i) => ({ ...f, name: (i + 1).toString() }))
    };
    formData.append('config', JSON.stringify(configPayload));

    try {
      const response = await fetch(`${API_BASE}/api/templates/save`, {
        method: 'POST',
        headers: {
          'Authorization': MASTER_TOKEN
        },
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        setPublishStatus('success');
        alert('🎉 順利將範本及設定發布至雲端範本庫！副帳號（手機端）可隨時同步使用。');
        fetchTemplates(); // Refresh template list
      } else {
        setPublishStatus('error');
        alert('發布失敗: ' + data.error);
      }
    } catch (e) {
      console.error(e);
      setPublishStatus('error');
      alert('無法連線至後端伺服器，請確認後端已啟動！');
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!window.confirm('確定要刪除這個範本嗎？')) return;
    try {
      const res = await fetch(`${API_BASE}/api/templates/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': MASTER_TOKEN }
      });
      if (res.ok) {
        fetchTemplates();
      } else {
        alert('刪除失敗');
      }
    } catch (e) {
      console.error(e);
      alert('無法連線至伺服器');
    }
  };

  const renameTemplate = async (id: string, currentTitle: string, currentFolder: string) => {
    const newTitle = window.prompt('請輸入新的範本名稱：', currentTitle);
    if (newTitle === null) return;
    
    const newFolder = window.prompt('請輸入資料夾名稱 (若無則留空)：', currentFolder);
    if (newFolder === null) return;

    if (newTitle === currentTitle && newFolder === currentFolder) return;

    try {
      const res = await fetch(`${API_BASE}/api/templates/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': MASTER_TOKEN
        },
        body: JSON.stringify({ title: newTitle, folder: newFolder })
      });
      if (res.ok) {
        fetchTemplates();
      } else {
        alert('重新命名/移動失敗');
      }
    } catch (e) {
      console.error(e);
      alert('無法連線至伺服器');
    }
  };


  // Handle template file upload and parse named ranges from Node backend
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    setLoading(true);

    const formData = new FormData();
    formData.append('template', file);

    try {
      const response = await fetch(`${API_BASE}/api/templates/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('解析失敗');
      
      const config = await response.json();
      const fieldsWithRequired = (config.fields || []).map((f: Partial<FieldConfig>) => ({
        ...f,
        required: true, // Default to required
      }));
      setFields(fieldsWithRequired);
      setVisualSheets(config.visualSheets || []);
      setActiveSheetIndex(0);
      setHasUploaded(true);
    } catch (error) {
      console.error(error);
      alert('無法連線至本地端伺服器 (http://localhost:3000)，請確認後端已啟動！');
    } finally {
      setLoading(false);
    }
  };

  // Modify individual field config parameters
  const updateField = (index: number, key: keyof FieldConfig, value: FieldConfig[keyof FieldConfig]) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: value };
    setFields(updated);
  };

  const addNewField = () => {
    const newField: FieldConfig = {
      name: `Custom_Field_${fields.length + 1}`,
      type: 'text',
      label: `新欄位 ${fields.length + 1}`,
      sheetName: 'Sheet1',
      rangeStr: 'Sheet1!$B$3',
      widthPx: 120 * 3,
      heightPx: 20 * 3,
      aspectRatio: 1.3333,
      resolutionTag: 'medium',
      required: true,
    };
    setFields([...fields, newField]);
    setHasUploaded(true);
  };

  const deleteField = (index: number) => {
    const updated = fields.filter((_, idx) => idx !== index);
    setFields(updated);
  };

  const handleCellClick = (cell: VisualCell) => {
    // If in "Pick Label" mode
    if (pickingLabelIdx !== null) {
      if (cell.value) {
        const updated = [...fields];
        updated[pickingLabelIdx].label = cell.value.toString();
        setFields(updated);
      }
      setPickingLabelIdx(null);
      return;
    }

    const existingIndex = fields.findIndex(f => f.rangeStr === cell.address);
    if (existingIndex !== -1) {
      setHighlightedRangeStr(cell.address);
    } else {
      const cleanName = cell.value 
        ? cell.value.replace(/[^a-zA-Z0-9_]/g, '_') 
        : `Field_${cell.address.split('!$')[1]?.replace('$', '_') || 'Cell'}`;
      
      const newField: FieldConfig = {
        name: cleanName,
        type: 'text',
        label: cell.value || `欄位 ${cell.address.split('!$')[1] || ''}`,
        sheetName: visualSheets[activeSheetIndex].name,
        rangeStr: cell.address,
        widthPx: 120 * 3,
        heightPx: 20 * 3,
        aspectRatio: 1.3333,
        resolutionTag: 'medium',
        required: true,
        stylePreset: 'default',
        imageSizeMode: 'fill',
      };
      
      setFields([...fields, newField]);
      setHighlightedRangeStr(cell.address);
    }
  };

  // Download the configuration file for dynamic rendering
  const exportConfigJson = () => {
    const payload = {
      title,
      fields: fields.map((f, i) => ({ ...f, name: (i + 1).toString() })),
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `form_config_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'transparent', color: '#e2e8f0' }}>
      {/* Header bar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 40px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid #18181b' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#8b5cf6', boxShadow: '0 0 12px #8b5cf6' }} />
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, letterSpacing: '0.5px' }}>{isClientMode ? '表單自動化管理' : t('adminTitle')}</h1>
          </div>
          {/* Language Switcher dropdown */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', outline: 'none', width: 'fit-content', fontSize: '13px' }}
          >
            <option value="zh-TW">繁體中文 (zh-TW)</option>
            <option value="en-US">English (en-US)</option>
            <option value="zh-CN">简体中文 (zh-CN)</option>
            <option value="vi-VN">Tiếng Việt (vi-VN)</option>
            <option value="id-ID">Bahasa Indonesia (id-ID)</option>
            <option value="th-TH">ไทย (th-TH)</option>
            <option value="ja-JP">日本語 (ja-JP)</option>
            <option value="ko-KR">한국어 (ko-KR)</option>
            <option value="es-ES">Español (es-ES)</option>
            <option value="fr-FR">Français (fr-FR)</option>
            <option value="de-DE">Deutsch (de-DE)</option>
            <option value="pt-BR">Português (pt-BR)</option>
            <option value="ru-RU">Русский (ru-RU)</option>
            <option value="ar-SA">العربية (ar-SA)</option>
          </select>
          {/* Upload Button (Left) */}
          {!isClientMode && (
          <div className="glass-panel" style={{ padding: '12px', minWidth: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <label className="btn-primary" style={{ padding: '6px 12px', cursor: 'pointer', background: '#3b82f6', color: 'white', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              📁 選擇 Excel 樣板 (.xlsx)
              <input type="file" accept=".xlsx" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
            {selectedFile && (
              <span style={{ fontSize: '12px', color: '#a1a1aa' }}>
                已選取: {selectedFile.name}
              </span>
            )}
          </div>
          )}
        </div>
      {/* Top Header Controls */}
      {!isClientMode && (
      <div style={{ margin: '0 30px', flex: 1, alignItems: 'stretch', display: 'flex', gap: '24px' }}>
        
        <div style={{ display: 'flex', gap: '16px', minWidth: '400px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <button onClick={() => setShowAuth(!showAuth)} style={{ padding: '12px 16px', background: showAuth ? 'rgba(255,255,255,0.15)' : 'transparent', border: showAuth ? '1px solid rgba(255,255,255,0.5)' : '1px dashed rgba(255,255,255,0.2)', borderRadius: '8px', color: showAuth ? '#e4e4e7' : '#71717a', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s' }}>1. 主副帳號授權管理</button>
            <button onClick={() => setShowConfig(!showConfig)} style={{ padding: '12px 16px', background: showConfig ? 'rgba(255,255,255,0.15)' : 'transparent', border: showConfig ? '1px solid rgba(255,255,255,0.5)' : '1px dashed rgba(255,255,255,0.2)', borderRadius: '8px', color: showConfig ? '#e4e4e7' : '#71717a', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s' }}>2. 具名範圍欄位對應與解析</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <button onClick={() => setShowPreview(!showPreview)} style={{ padding: '12px 16px', background: showPreview ? 'rgba(255,255,255,0.15)' : 'transparent', border: showPreview ? '1px solid rgba(255,255,255,0.5)' : '1px dashed rgba(255,255,255,0.2)', borderRadius: '8px', color: showPreview ? '#e4e4e7' : '#71717a', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s' }}>3. Excel 樣板表格預覽</button>
            <button onClick={() => setShowAppUI(!showAppUI)} style={{ padding: '12px 16px', background: showAppUI ? 'rgba(255,255,255,0.15)' : 'transparent', border: showAppUI ? '1px solid rgba(255,255,255,0.5)' : '1px dashed rgba(255,255,255,0.2)', borderRadius: '8px', color: showAppUI ? '#e4e4e7' : '#71717a', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s' }}>4. 模擬填寫端 App UI 渲染</button>
            <button onClick={() => { setShowExportManager(!showExportManager); setShowAuth(false); setShowConfig(false); setShowPreview(false); setShowAppUI(false); }} style={{ padding: '12px 16px', background: showExportManager ? 'rgba(255,255,255,0.15)' : 'transparent', border: showExportManager ? '1px solid rgba(255,255,255,0.5)' : '1px dashed rgba(255,255,255,0.2)', borderRadius: '8px', color: showExportManager ? '#e4e4e7' : '#71717a', textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s', marginTop: '12px' }}>5. 匯出資料夾管理</button>
          </div>
        </div>



        {/* Cloud Templates Library (Right) */}
        <section style={{ marginLeft: 'auto', padding: '12px 20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid #18181b', minWidth: '400px', maxWidth: '600px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <span style={{ fontSize: '14px' }}>☁️</span>
          <h2 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#fafafa' }}>雲端範本庫 (已發布的表單)</h2>
        </div>
        
        {cloudTemplates.length === 0 ? (
          <div style={{ padding: '10px', textAlign: 'center', color: '#71717a', fontSize: '13px' }}>
            目前沒有已發布的範本。請在下方上傳並發布。
          </div>
        ) : (
          <div className="custom-scrollbar" style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
            {cloudTemplates.map((tpl) => (
              <div key={tpl.id} style={{ minWidth: '220px', display: 'flex', flexDirection: 'column', padding: '12px', background: '#18181b', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', gap: '10px' }}>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ padding: '2px 6px', background: '#27272a', color: '#e4e4e7', fontSize: '11px', borderRadius: '4px' }}>
                      📁 {tpl.folder || '未分類'}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#f8fafc', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {tpl.title}
                  </div>
                  <div style={{ fontSize: '11px', color: '#a1a1aa', marginTop: '4px' }}>
                    更新: {new Date(tpl.updatedAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginTop: 'auto' }}>
                  <button
                    onClick={() => renameTemplate(tpl.id, tpl.title, tpl.folder || '未分類')}
                    style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', flex: 1 }}
                  >
                    ✏️ 編輯
                  </button>
                  <button
                    onClick={() => deleteTemplate(tpl.id)}
                    style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', flex: 1 }}
                  >
                    🗑️ 刪除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        </section>
      </div>
      )}

      </header>


      {/* Main dashboard content */}
      {isClientMode ? (
        <ClientMode cloudTemplates={cloudTemplates} />
      ) : (
      <main className="main-layout" style={{ gridTemplateColumns: [(showAuth || showConfig) ? 'minmax(0, 1.2fr)' : '', showPreview ? 'minmax(0, 1.5fr)' : '', showAppUI ? 'minmax(0, 0.8fr)' : ''].filter(Boolean).join(' ') }}>
        
        
        {/* Export Manager */}
        {showExportManager && (
          <div style={{ padding: '0 30px' }}>
            <ExportManager />
          </div>
        )}

        {/* Column 2 (Left): File Upload & Configuration parameters mapping grid */}
        {(showAuth || showConfig) && (
        <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', maxHeight: `${Math.max(previewHeight + 80, 500)}px`, paddingRight: '8px' }}>
          
          {/* Master/Sub Account Settings Panel */}
          {showAuth && (
          <div id="auth-section" className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🔑</span>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#fafafa' }}>主副帳號授權管理</h2>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: '#a1a1aa' }}>管理端主帳號金鑰 (ADMIN_TOKEN)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={MASTER_TOKEN}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#a1a1aa', fontSize: '12px' }}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(MASTER_TOKEN);
                    alert('已複製主帳號金鑰！可貼於手機 App 綁定。');
                  }}
                  style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '12px', cursor: 'pointer' }}
                >
                  複製
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', color: '#a1a1aa' }}>產生的副帳號金鑰 (MEMBER_TOKEN)</label>
                <button
                  onClick={generateMemberToken}
                  style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: '#8b5cf6', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  + 生成成員金鑰
                </button>
              </div>
              
              {memberTokens.length === 0 ? (
                <span style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic' }}>尚未產生成員金鑰，點擊上方按鈕以新增。</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {memberTokens.map((t, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '8px', border: '1px solid #18181b' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          readOnly
                          value={t.token}
                          style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', backgroundColor: '#000', border: 'none', color: '#14b8a6', fontSize: '11px' }}
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(t.token);
                            alert(`成員金鑰 ${t.token} 已複製！`);
                          }}
                          style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
                        >
                          複製
                        </button>
                        <button
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
                        </button>
                        <button
                          onClick={() => deleteMemberToken(t.token)}
                          style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: '#ef4444', border: 'none', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
                        >
                          刪除
                        </button>
                      </div>
                      <div style={{ fontSize: '10px', color: '#71717a', paddingLeft: '4px' }}>
                        授權專案：
                        {t.allowedFolders === undefined ? (
                          <span style={{ color: '#14b8a6' }}>全部允許 (全選)</span>
                        ) : t.allowedFolders.length === 0 ? (
                          <span style={{ color: '#ef4444' }}>無權限 (全部未勾選)</span>
                        ) : (
                          <span style={{ color: '#38bdf8' }}>{t.allowedFolders.join(', ')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}


          {/* Configuration Grid */}
          {showConfig && (
          <div id="config-section" className="glass-panel" style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#fafafa' }}>具名範圍欄位對應與解析</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-primary" style={{ background: '#14b8a6', boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.4)', padding: '6px 12px', fontSize: '12px' }} onClick={addNewField}>
                  + 欄位
                </button>
                {fields.length > 0 && (
                  <>
                    <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={exportConfigJson}>
                      {t('exportJson')}
                    </button>
                    <button
                      className="btn-primary"
                      style={{ background: '#a855f7', boxShadow: '0 4px 14px 0 rgba(168, 85, 247, 0.4)', padding: '6px 12px', fontSize: '12px' }}
                      onClick={publishToCloud}
                    >
                      {publishStatus === 'publishing...' ? '發布中...' : '☁️ 發布至雲端'}
                    </button>
                  </>
                )}
              </div>
            </div>


            <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <label style={{ fontSize: '13px', color: '#a1a1aa', fontWeight: 500 }}>表單標題 (Form Title):</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.1)', border: '1px solid #18181b', color: '#fff', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <label style={{ fontSize: '13px', color: '#a1a1aa', fontWeight: 500 }}>資料夾名稱 (Folder):</label>
                <input
                  type="text"
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  placeholder="未分類"
                  style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.1)', border: '1px solid #18181b', color: '#fff', outline: 'none' }}
                />
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                <p style={{ color: '#8b5cf6', fontWeight: 500 }}>{t('loading')}</p>
              </div>
            ) : fields.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, color: '#a1a1aa', textAlign: 'center', gap: '12px', padding: '20px' }}>
                <p style={{ margin: 0, fontWeight: 500 }}>
                  {hasUploaded 
                    ? '⚠️ 檔案上傳成功，但在此 Excel 中找不到任何「具名範圍 (Named Ranges)」。' 
                    : t('emptyConfig')}
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: '#71717a', maxWidth: '350px' }}>
                  請點擊左側 Excel 預覽畫面中的格子來直接新增對應欄位。
                </p>
              </div>
            ) : (
              <div className="custom-scrollbar" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #18181b', color: '#a1a1aa', textAlign: 'left' }}>
                      <th style={{ padding: '12px 8px' }}>
                        <div>欄位代號 (ID)</div>
                      </th>
                      <th style={{ padding: '12px 8px' }}>Excel 位置 (Range)</th>
                      <th style={{ padding: '12px 8px' }}>
                        <div>顯示標籤 (Label)</div>
                      </th>
                      <th style={{ padding: '12px 8px' }}>{t('fieldType')}</th>
                      <th style={{ padding: '12px 8px' }}>相片填入模式</th>
                      <th style={{ padding: '12px 8px' }}>張數上限</th>
                      <th style={{ padding: '12px 8px' }}>{t('resolution')}</th>
                      <th style={{ padding: '12px 8px' }}>{t('isRequired')}</th>
                      <th style={{ padding: '12px 8px' }}>輸出風格</th>
                      <th style={{ padding: '12px 8px' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, idx) => {
                      const isHighlighted = field.rangeStr === highlightedRangeStr;
                      const isPickingThis = pickingLabelIdx === idx;
                      return (
                        <tr 
                          key={field.name + idx} // Force key to handle reordering 
                          draggable
                          onDragStart={(e) => {
                            setDraggedIdx(idx);
                            e.dataTransfer.effectAllowed = 'move';
                            // Ghost image transparency fix
                            if (e.target instanceof HTMLElement) {
                              e.target.style.opacity = '0.5';
                            }
                          }}
                          onDragEnd={(e) => {
                            setDraggedIdx(null);
                            if (e.target instanceof HTMLElement) {
                              e.target.style.opacity = '1';
                            }
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedIdx === null || draggedIdx === idx) return;
                            const newFields = [...fields];
                            const [removed] = newFields.splice(draggedIdx, 1);
                            newFields.splice(idx, 0, removed);
                            setFields(newFields);
                            setDraggedIdx(null);
                          }}
                          style={{ 
                            borderBottom: '1px solid #18181b',
                            backgroundColor: isHighlighted ? 'rgba(99, 102, 241, 0.12)' : (isPickingThis ? 'rgba(16, 185, 129, 0.15)' : 'transparent'),
                            transition: 'background-color 0.4s ease',
                            cursor: draggedIdx !== null ? 'grabbing' : 'grab'
                          }}
                        >
                          <td style={{ padding: '8px 4px' }}>
                            <input
                              type="text"
                              value={(idx + 1).toString()}
                              disabled
                              title="欄位代號自動依照順序產生，作為系統識別用途"
                              style={{ padding: '6px 8px', width: '60px', textAlign: 'center', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)', color: '#a1a1aa', cursor: 'not-allowed' }}
                            />
                          </td>
                          <td style={{ padding: '8px 4px' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <select
                                value={parseRangeForUI(field.rangeStr).sheet}
                                disabled
                                title="Excel 位置無法手動更改，請刪除此欄位後重新在左方圖表點選"
                                style={{ padding: '6px 4px', width: '70px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)', color: '#a1a1aa', fontSize: '11px', cursor: 'not-allowed' }}
                              >
                                {visualSheets.map((s, i) => (
                                  <option key={i} value={s.name}>{s.name}</option>
                                ))}
                                {!visualSheets.some(s => s.name === parseRangeForUI(field.rangeStr).sheet) && (
                                  <option value={parseRangeForUI(field.rangeStr).sheet}>{parseRangeForUI(field.rangeStr).sheet}</option>
                                )}
                              </select>
                              <input
                                type="text"
                                value={parseRangeForUI(field.rangeStr).cell}
                                disabled
                                title="Excel 位置無法手動更改，請刪除此欄位後重新在左方圖表點選"
                                style={{ padding: '6px 4px', width: '45px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)', color: '#a1a1aa', fontSize: '12px', cursor: 'not-allowed', textAlign: 'center' }}
                              />
                            </div>
                          </td>
                          <td style={{ padding: '8px 4px' }}>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => updateField(idx, 'label', e.target.value)}
                                onFocus={() => setPickingLabelIdx(idx)}
                                placeholder="點圖表或手動輸入"
                                style={{ 
                                  padding: '6px 8px', 
                                  width: '90px', 
                                  borderRadius: '6px', 
                                  backgroundColor: isPickingThis ? 'rgba(20, 184, 166, 0.15)' : 'rgba(0,0,0,0.1)', 
                                  border: isPickingThis ? '1px solid #14b8a6' : '1px solid #18181b', 
                                  color: '#fff',
                                  outline: 'none',
                                  transition: 'all 0.2s ease'
                                }}
                              />
                              <button
                                onClick={() => setPickingLabelIdx(isPickingThis ? null : idx)}
                                title="點擊圖表儲存格來自動填入標籤"
                                style={{ 
                                  padding: '4px', 
                                  borderRadius: '6px', 
                                  border: 'none', 
                                  backgroundColor: isPickingThis ? '#14b8a6' : '#27272a', 
                                  color: '#fff', 
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                🎯
                              </button>
                            </div>
                          </td>
                           <td style={{ padding: '8px 4px' }}>
                            <select
                              value={field.type}
                              onChange={(e) => updateField(idx, 'type', e.target.value)}
                              style={{ padding: '6px 4px', width: '90px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.1)', border: '1px solid #18181b', color: '#fff', fontSize: '12px' }}
                            >
                              <option value="text">純文字</option>
                              <option value="dropdown">下拉選單</option>
                              <option value="image">相片</option>
                              <option value="date">日期</option>
                              <option value="number">數值</option>
                              <option value="checkbox">勾選框</option>
                              <option value="signature">手寫簽名</option>
                              <option value="mobile">手機號碼</option>
                              <option value="tel">市內電話</option>
                            </select>
                            {field.type === 'dropdown' && (
                              <textarea
                                value={field.dropdownOptions || ''}
                                onChange={(e) => updateField(idx, 'dropdownOptions', e.target.value)}
                                placeholder="選項1
選項2
選項3"
                                style={{ marginTop: '4px', width: '80px', height: '40px', padding: '4px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '10px', resize: 'none' }}
                              />
                            )}
                          </td>
                          <td style={{ padding: '8px 4px' }}>
                            <select
                              value={field.imageSizeMode || 'fill'}
                              onChange={(e) => updateField(idx, 'imageSizeMode', e.target.value)}
                              disabled={field.type !== 'image'}
                              style={{ padding: '6px 4px', width: '85px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.1)', border: '1px solid #18181b', color: '#fff', fontSize: '12px', opacity: (field.type !== 'image') ? 0.5 : 1 }}
                              title="填滿：忽略長寬比完全填滿；邊框10：相片四周距離儲存格10pt；原比例：相片保持比例置中"
                            >
                              <option value="fill">填滿</option>
                              <option value="padding10">邊框10</option>
                              <option value="contain">原比例</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px 4px' }}>
                            <select
                              value={field.maxPhotos || 1}
                              onChange={(e) => updateField(idx, 'maxPhotos', parseInt(e.target.value, 10))}
                              disabled={field.type !== 'image'}
                              style={{ padding: '6px 4px', width: '80px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.1)', border: '1px solid #18181b', color: '#fff', fontSize: '12px', opacity: field.type !== 'image' ? 0.5 : 1 }}
                              title="最多可上傳幾張照片"
                            >
                              <option value={1}>1 張</option>
                              <option value={2}>2 張</option>
                              <option value={3}>3 張</option>
                              <option value={4}>4 張</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px 4px' }}>
                            <select
                              value={field.resolutionTag}
                              onChange={(e) => updateField(idx, 'resolutionTag', e.target.value)}
                              disabled={field.type !== 'image' && field.type !== 'signature'}
                              style={{ padding: '6px 4px', width: '115px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.1)', border: '1px solid #18181b', color: '#fff', fontSize: '12px', opacity: (field.type !== 'image' && field.type !== 'signature') ? 0.5 : 1 }}
                            >
                              <option value="small">小 (&lt;800px)</option>
                              <option value="medium">中 (800~1280px)</option>
                              <option value="large">大 (&gt;1280px)</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateField(idx, 'required', e.target.checked)}
                            />
                          </td>
                          <td style={{ padding: '8px 4px' }}>
                            <select
                              value={field.stylePreset || 'default'}
                              onChange={(e) => updateField(idx, 'stylePreset', e.target.value)}
                              style={{ padding: '6px 4px', width: '100px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.1)', border: '1px solid #18181b', color: '#fff', fontSize: '12px' }}
                            >
                              {STYLE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '8px 4px' }}>
                            <button
                              onClick={() => deleteField(idx)}
                              style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer' }}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}
        </div>
        )}

        {/* Column 1 (Right): Excel visual layout preview & cell click */}
        {showPreview && (
        <div id="preview-section" className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', minHeight: '580px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>📊</span>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#fafafa' }}>Excel 樣板表格預覽</h2>
          </div>
          
          {visualSheets.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#a1a1aa' }}>💡 點擊下方表格格子即可直接設定對應</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {visualSheets.map((sheet, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveSheetIndex(index)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: activeSheetIndex === index ? '#8b5cf6' : '#18181b',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                    >
                      {sheet.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="custom-scrollbar" style={{ overflowX: 'scroll', height: `${previewHeight}px`, overflowY: 'auto', border: '1px solid #e4e4e7', borderRadius: '12px', background: '#ffffff' }}>
                <table style={{ borderCollapse: 'collapse', fontSize: '12px', color: '#18181b', tableLayout: 'fixed', width: 'max-content', minWidth: '100%', zoom: zoomLevel } as React.CSSProperties}>
                  <colgroup>
                    <col style={{ width: '45px' }} />
                    {(visualSheets[activeSheetIndex].columnWidths || []).map((w, idx) => (
                      <col key={idx} style={{ width: `${w}px` }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                      <th style={{ width: '45px', border: '1px solid #e4e4e7', padding: '6px', textAlign: 'center', color: '#71717a', fontWeight: 'bold' }}></th>
                      {(visualSheets[activeSheetIndex].columnWidths || []).map((_, cIdx) => (
                        <th key={cIdx} style={{ border: '1px solid #e4e4e7', padding: '6px', textAlign: 'center', color: '#71717a', fontWeight: 'bold' }}>
                          {String.fromCharCode(65 + cIdx)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visualSheets[activeSheetIndex].rows.map((row, rIdx) => {
                      const rowHeight = visualSheets[activeSheetIndex].rowHeights?.[rIdx] || 26;
                      return (
                        <tr key={rIdx} style={{ height: `${rowHeight}px` }}>
                          <td style={{
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e4e4e7',
                            padding: '4px',
                            textAlign: 'center',
                            color: '#71717a',
                            fontWeight: 'normal',
                            height: `${rowHeight}px`,
                            userSelect: 'none'
                          }}>
                            {rIdx + 1}
                          </td>
                          {row.map((cell, cIdx) => {
                            const existingField = fields.find((f) => f.rangeStr === cell.address);
                            const isMapped = !!existingField;
                            const isHighlighted = cell.address === highlightedRangeStr;

                            if (cell.isSlave) return null;

                            // Compute alignment values
                            let flexAlignItems = 'center';
                            if (cell.style?.verticalAlign === 'top') flexAlignItems = 'flex-start';
                            else if (cell.style?.verticalAlign === 'bottom') flexAlignItems = 'flex-end';

                            let flexJustifyContent = 'flex-start';
                            if (cell.style?.textAlign === 'center') flexJustifyContent = 'center';
                            else if (cell.style?.textAlign === 'right') flexJustifyContent = 'flex-end';

                            return (
                              <td
                                key={cIdx}
                                onClick={() => handleCellClick(cell)}
                                rowSpan={cell.rowSpan}
                                colSpan={cell.colSpan}
                                style={{
                                  padding: '6px 8px',
                                  textOverflow: 'ellipsis',
                                  overflow: 'hidden',
                                  whiteSpace: cell.style?.wrapText ? 'normal' : 'nowrap',
                                  wordBreak: cell.style?.wrapText ? 'break-word' : 'normal',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  backgroundColor: isHighlighted 
                                    ? 'rgba(99, 102, 241, 0.4)' 
                                    : (cell.style?.backgroundColor || (isMapped 
                                    ? (existingField.type === 'image' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.18)')
                                    : 'transparent')),
                                  color: cell.style?.color || '#18181b',
                                  fontWeight: (cell.style?.fontWeight as React.CSSProperties['fontWeight']) || 'normal',
                                  fontStyle: (cell.style?.fontStyle as React.CSSProperties['fontStyle']) || 'normal',
                                  fontSize: cell.style?.fontSize || '10pt',
                                  textAlign: (cell.style?.textAlign as React.CSSProperties['textAlign']) || 'left',
                                  textDecoration: cell.style?.textDecoration || 'none',
                                  
                                  // Border settings: use custom borders, fallback to default grid lines, override if mapped
                                  borderTop: isMapped
                                    ? `3px solid ${existingField.type === 'image' ? '#14b8a6' : '#8b5cf6'}`
                                    : (cell.style?.borderTop || '1px solid #e4e4e7'),
                                  borderLeft: isMapped
                                    ? `3px solid ${existingField.type === 'image' ? '#14b8a6' : '#8b5cf6'}`
                                    : (cell.style?.borderLeft || '1px solid #e4e4e7'),
                                  borderBottom: isMapped
                                    ? `3px solid ${existingField.type === 'image' ? '#14b8a6' : '#8b5cf6'}`
                                    : (cell.style?.borderBottom || '1px solid #e4e4e7'),
                                  borderRight: isMapped
                                    ? `3px solid ${existingField.type === 'image' ? '#14b8a6' : '#8b5cf6'}`
                                    : (cell.style?.borderRight || '1px solid #e4e4e7'),
                                }}
                                title={cell.address}
                                onMouseEnter={(e) => {
                                  if (!isMapped && !isHighlighted) e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isMapped && !isHighlighted) e.currentTarget.style.backgroundColor = cell.style?.backgroundColor || 'transparent';
                                }}
                              >
                                <div style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: flexJustifyContent,
                                  alignItems: flexAlignItems,
                                  height: '100%',
                                  width: '100%',
                                  gap: '2px'
                                }}>
                                  {isMapped ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                                      <span style={{ fontWeight: 'bold', fontSize: '9px', color: existingField.type === 'image' ? '#14b8a6' : (existingField.type === 'signature' ? '#fbbf24' : '#818cf8'), letterSpacing: '0.2px' }}>
                                        {existingField.type === 'image' && '📷 '}
                                        {existingField.type === 'signature' && '✍️ '}
                                        {existingField.type === 'text' && '✏️ '}
                                        {existingField.type === 'dropdown' && '🔽 '}
                                        {existingField.type === 'date' && '📅 '}
                                        {existingField.type === 'number' && '🔢 '}
                                        {existingField.type === 'checkbox' && '☑️ '}
                                        {existingField.type === 'mobile' && '📱 '}
                                        {existingField.type === 'tel' && '☎️ '}
                                        {existingField.name}
                                      </span>
                                      <span style={{ fontSize: '11px', color: cell.style?.color || '#18181b' }}>{cell.value || existingField.label}</span>
                                    </div>
                                  ) : (
                                    cell.value || ''
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', padding: '4px 8px 0', flexWrap: 'wrap' }}>
                 <span style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 500 }}>↕️ 預覽高度</span>
                 <input 
                   type="range" 
                   min="300" 
                   max="1500" 
                   step="50" 
                   value={previewHeight} 
                   onChange={(e) => setPreviewHeight(parseInt(e.target.value))} 
                   style={{ width: '100px', accentColor: '#14b8a6', cursor: 'pointer' }} 
                   title={`目前高度: ${previewHeight}px`}
                 />
                 <span style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 500, marginLeft: '12px' }}>🔍 縮放比例 ({Math.round(zoomLevel * 100)}%)</span>
                 <input 
                   type="range" 
                   min="0.3" 
                   max="2.0" 
                   step="0.05" 
                   value={zoomLevel} 
                   onChange={(e) => setZoomLevel(parseFloat(e.target.value))} 
                   style={{ width: '150px', accentColor: '#8b5cf6', cursor: 'pointer' }} 
                 />
              </div>
            </div>
          ) : (
            <div style={{ padding: '40px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#a1a1aa', textAlign: 'center', gap: '16px' }}>

            </div>
          )}
        </div>
        )}

        {/* Right column: Simulated mobile App form UI rendering preview */}
        {showAppUI && (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#fafafa' }}>{t('previewApp')}</h2>

          {/* Smartphone Frame Simulator */}
          <div className="custom-scrollbar" style={{ width: '100%', flex: 1, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '24px', border: '8px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: `${Math.max(previewHeight, 400)}px`, overflowY: 'auto' }}>
            
            {/* Simulated App Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #18181b', paddingBottom: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{title}</span>
              <span style={{ fontSize: '11px', color: '#14b8a6', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '8px' }}>
                Online
              </span>
            </div>

            {/* Simulated Fields */}
            {fields.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#475569', fontSize: '13px' }}>
                No fields loaded
              </div>
            ) : (
              fields.map((field, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1aa' }}>
                    {field.name.replace(/_/g, ' ')} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  
                  {field.type === 'dropdown' && (
                    <select
                      disabled
                      style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.2)', border: 'none', color: '#71717a', fontSize: '12px', appearance: 'none' }}
                    >
                      <option value="">請選擇...</option>
                      {(field.dropdownOptions || '').split('\n').filter(Boolean).map((opt, i) => (
                        <option key={i} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                  {field.type === 'text' && (
                    <input
                      type="text"
                      disabled
                      placeholder={`請輸入 ${field.label || field.name}...`}
                      style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.2)', border: 'none', color: '#71717a', fontSize: '12px' }}
                    />
                  )}
                  {field.type === 'number' && (
                    <input
                      type="text"
                      disabled
                      placeholder={`請輸入數字 ${field.label || field.name}...`}
                      style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.2)', border: 'none', color: '#71717a', fontSize: '12px' }}
                    />
                  )}
                  {field.type === 'mobile' && (
                    <input
                      type="text"
                      disabled
                      placeholder="請輸入手機 (格式: xxxx-xxxxxx)"
                      style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.2)', border: 'none', color: '#71717a', fontSize: '12px' }}
                    />
                  )}
                  {field.type === 'tel' && (
                    <input
                      type="text"
                      disabled
                      placeholder="請輸入電話 (格式: (xx)xxxxxxxx)"
                      style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.2)', border: 'none', color: '#71717a', fontSize: '12px' }}
                    />
                  )}
                  {field.type === 'date' && (
                    <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#71717a', fontSize: '12px', cursor: 'not-allowed' }}>
                      <span>選擇日期...</span>
                      <span>📅</span>
                    </div>
                  )}
                  {field.type === 'checkbox' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                      <input type="checkbox" disabled style={{ cursor: 'not-allowed' }} />
                      <span style={{ fontSize: '12px', color: '#a1a1aa' }}>勾選即代表確認</span>
                    </div>
                  )}
                  {field.type === 'image' && (
                    <div style={{ height: '100px', borderRadius: '8px', border: '1px dashed #8b5cf6', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '4px', color: '#8b5cf6', background: 'rgba(99, 102, 241, 0.03)', cursor: 'not-allowed' }}>
                      <span style={{ fontSize: '16px' }}>📷</span>
                      <span style={{ fontSize: '10px' }}>比例: {field.aspectRatio === 1.3333 ? '4:3' : field.aspectRatio === 1.7778 ? '16:9' : '1:1'} ({field.resolutionTag})</span>
                    </div>
                  )}
                  {field.type === 'signature' && (
                    <div style={{ height: '100px', borderRadius: '8px', border: '1px dashed #fbbf24', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '4px', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.03)', cursor: 'not-allowed' }}>
                      <span style={{ fontSize: '16px' }}>✍️</span>
                      <span style={{ fontSize: '10px' }}>手寫簽名區域</span>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Simulated Actions */}
            {fields.length > 0 && (
              <div style={{ marginTop: 'auto', display: 'flex', gap: '12px', paddingTop: '16px' }}>
                <button style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #8b5cf6', backgroundColor: 'transparent', color: '#8b5cf6', fontSize: '12px', fontWeight: 'bold' }}>
                  Save Draft
                </button>
                <button style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#8b5cf6', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>
                  Submit Form
                </button>
              </div>
            )}
          </div>
        </div>
        )}
      </main>
      )}

      {/* Editing Permissions Modal */}
      {editingToken && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="glass-panel" style={{ padding: '24px', width: '400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>設定專案權限</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#a1a1aa' }}>
              設定金鑰 <span style={{ color: '#14b8a6' }}>{editingToken}</span> 的可見資料夾。<br/>
              <b>提醒：若要給予所有專案與未分類表單的權限，請點擊「全部權限」。</b>
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', backgroundColor: 'rgba(0,0,0,0.1)', padding: '12px', borderRadius: '8px' }}>
              {Array.from(new Set(cloudTemplates.map(t => t.folder).filter(f => f))).length === 0 ? (
                <div style={{ color: '#71717a', fontSize: '12px', textAlign: 'center' }}>目前沒有任何具名專案資料夾。<br/>若要讓員工看見未分類表單，請使用「全部權限」。</div>
              ) : (
                Array.from(new Set(cloudTemplates.map(t => t.folder).filter(f => f))).map((f, idx) => (
                  <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', fontSize: '14px', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={editingFolders.has(f)}
                      onChange={(e) => {
                        const newSet = new Set(editingFolders);
                        if (e.target.checked) newSet.add(f);
                        else newSet.delete(f);
                        setEditingFolders(newSet);
                      }}
                      style={{ accentColor: '#8b5cf6', width: '16px', height: '16px' }}
                    />
                    📁 {f}
                  </label>
                ))
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', marginTop: '8px' }}>
              <div>
                <button 
                  onClick={() => {
                    const all = Array.from(new Set(cloudTemplates.map(t => t.folder).filter(f => f)));
                    setEditingFolders(new Set(all));
                  }}
                  style={{ padding: '6px 12px', borderRadius: '6px', background: '#27272a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', marginRight: '8px' }}
                >
                  全選
                </button>
                <button 
                  onClick={() => setEditingFolders(new Set())}
                  style={{ padding: '6px 12px', borderRadius: '6px', background: '#27272a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px' }}
                >
                  全不選 (無權限)
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => setEditingToken(null)}
                  style={{ padding: '8px 16px', borderRadius: '6px', background: '#27272a', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  取消
                </button>
                <button 
                  onClick={async () => {
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
                  }}
                  style={{ padding: '8px 16px', borderRadius: '6px', background: '#8b5cf6', color: '#fff', border: 'none', cursor: 'pointer' }}
                >
                  全部權限
                </button>
                <button 
                  onClick={async () => {
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
                  }}
                  className="btn-primary"
                  style={{ padding: '8px 16px', borderRadius: '6px' }}
                >
                  儲存勾選
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <Dashboard />
    </LanguageProvider>
  );
};

export default App;

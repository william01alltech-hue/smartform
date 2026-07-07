import React, { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const MASTER_TOKEN = import.meta.env.VITE_MASTER_TOKEN || 'william_master_token';

interface ClientModeProps {
  cloudTemplates: any[];
  token: string;
}

const translations = {
  zh: {
    selectFolder: '📁 選擇表單資料夾',
    uncategorized: '未分類表單',
    backToFolders: '返回資料夾清單',
    backToTemplates: '返回表單列表',
    startFilling: '開始填寫 →',
    inputPlaceholderText: '請輸入內容',
    inputPlaceholderNumber: '請輸入數值',
    selectPlaceholder: '請選擇',
    confirmCheck: '確認勾選',
    upload: '上傳',
    tableListDetail: '📋 表格清單明細',
    itemCount: '共 {count} 項',
    itemNum: '項次 {num}',
    notFilled: '尚未填寫',
    saveAndExportSetting: '💾 儲存與匯出設定',
    setFilename: '設定匯出檔名',
    example: '例如',
    chooseCloudFolder: '選擇雲端儲存資料夾 (選填)',
    doNotSaveToCloud: '不儲存至雲端，僅下載至設備',
    fail: '匯出失敗',
    success: '✅ 表單已成功送出並下載！',
    errorOccurred: '匯出發生錯誤',
    submitting: '🔄 處理中...',
    submitAndDownload: '送出並下載'
  },
  vi: {
    selectFolder: '📁 Chọn thư mục biểu mẫu',
    uncategorized: 'Biểu mẫu chưa phân loại',
    backToFolders: 'Quay lại danh sách thư mục',
    backToTemplates: 'Quay lại danh sách biểu mẫu',
    startFilling: 'Bắt đầu điền →',
    inputPlaceholderText: 'Vui lòng nhập nội dung',
    inputPlaceholderNumber: 'Vui lòng nhập số',
    selectPlaceholder: 'Vui lòng chọn',
    confirmCheck: 'Xác nhận chọn',
    upload: 'Tải lên',
    tableListDetail: '📋 Danh sách chi tiết',
    itemCount: 'Tổng cộng {count} mục',
    itemNum: 'Mục {num}',
    notFilled: 'Chưa điền',
    saveAndExportSetting: '💾 Cài đặt lưu và xuất',
    setFilename: 'Đặt tên tệp xuất',
    example: 'Ví dụ',
    chooseCloudFolder: 'Chọn thư mục đám mây (Tùy chọn)',
    doNotSaveToCloud: 'Không lưu trên đám mây, chỉ tải về thiết bị',
    fail: 'Xuất thất bại',
    success: '✅ Gửi biểu mẫu và tải xuống thành công!',
    errorOccurred: 'Có lỗi xảy ra khi xuất',
    submitting: '🔄 Đang xử lý...',
    submitAndDownload: 'Gửi và tải xuống'
  },
  id: {
    selectFolder: '📁 Pilih Folder Formulir',
    uncategorized: 'Formulir Tanpa Kategori',
    backToFolders: 'Kembali ke Daftar Folder',
    backToTemplates: 'Kembali ke Daftar Formulir',
    startFilling: 'Mulai Mengisi →',
    inputPlaceholderText: 'Silakan masukkan konten',
    inputPlaceholderNumber: 'Silakan masukkan angka',
    selectPlaceholder: 'Silakan pilih',
    confirmCheck: 'Konfirmasi centang',
    upload: 'Unggah',
    tableListDetail: '📋 Rincian Daftar Tabel',
    itemCount: 'Total {count} item',
    itemNum: 'Item {num}',
    notFilled: 'Belum diisi',
    saveAndExportSetting: '💾 Pengaturan Simpan & Ekspor',
    setFilename: 'Atur nama file ekspor',
    example: 'Contoh',
    chooseCloudFolder: 'Pilih folder cloud (Opsional)',
    doNotSaveToCloud: 'Jangan simpan ke cloud, hanya unduh ke perangkat',
    fail: 'Ekspor gagal',
    success: '✅ Formulir berhasil dikirim dan diunduh!',
    errorOccurred: 'Terjadi kesalahan saat ekspor',
    submitting: '🔄 Memproses...',
    submitAndDownload: 'Kirim dan Unduh'
  },
  en: {
    selectFolder: '📁 Select Form Folder',
    uncategorized: 'Uncategorized Forms',
    backToFolders: 'Back to Folder List',
    backToTemplates: 'Back to Form List',
    startFilling: 'Start Filling →',
    inputPlaceholderText: 'Please enter content',
    inputPlaceholderNumber: 'Please enter number',
    selectPlaceholder: 'Please select',
    confirmCheck: 'Confirm check',
    upload: 'Upload',
    tableListDetail: '📋 Table List Detail',
    itemCount: '{count} items total',
    itemNum: 'Item {num}',
    notFilled: 'Not filled yet',
    saveAndExportSetting: '💾 Save & Export Settings',
    setFilename: 'Set export filename',
    example: 'e.g.',
    chooseCloudFolder: 'Select cloud folder (Optional)',
    doNotSaveToCloud: 'Do not save to cloud, download to device only',
    fail: 'Export failed',
    success: '✅ Form submitted and downloaded successfully!',
    errorOccurred: 'Error occurred during export',
    submitting: '🔄 Processing...',
    submitAndDownload: 'Submit and Download'
  }
};

export const ClientMode: React.FC<ClientModeProps> = ({ cloudTemplates, token }) => {
  const [lang, setLang] = useState<'zh' | 'vi' | 'id' | 'en'>(() => {
    const saved = localStorage.getItem('pwa_selected_lang');
    if (saved === 'zh' || saved === 'vi' || saved === 'id' || saved === 'en') return saved;
    // Auto detect browser language
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('vi')) return 'vi';
    if (browserLang.startsWith('id') || browserLang.startsWith('in')) return 'id';
    if (browserLang.startsWith('en')) return 'en';
    return 'zh';
  });

  const t = translations[lang];

  const handleLangChange = (newLang: 'zh' | 'vi' | 'id' | 'en') => {
    setLang(newLang);
    localStorage.setItem('pwa_selected_lang', newLang);
  };

  const [clientFolder, setClientFolder] = useState<string | null>(null);
  const [clientTemplate, setClientTemplate] = useState<any | null>(null);
  const [clientFormData, setClientFormData] = useState<Record<string, string>>({});
  const [clientFileData, setClientFileData] = useState<Record<string, File[]>>({});
  const [isExporting, setIsExporting] = useState(false);

  const [exportFolders, setExportFolders] = useState<any[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<string>('');
  const [targetFilename, setTargetFilename] = useState<string>('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  React.useEffect(() => {
    fetch(`${API_BASE}/api/export-folders`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setExportFolders(data);
      })
      .catch(console.error);
  }, []);

  // Dynamically calculate formula values
  React.useEffect(() => {
    if (!clientTemplate) return;
    const fieldsList = clientTemplate.config.fields || [];
    const formulaFields = fieldsList.filter((f: any) => f.type === 'formula');
    if (formulaFields.length === 0) return;

    let hasChanges = false;
    const newFormData = { ...clientFormData };

    const parseRange = (rangeStr: string) => {
      const parts = rangeStr.split('!');
      if (parts.length !== 2) return null;
      const cell = parts[1].replace(/\$/g, '');
      const match = cell.match(/^([A-Z]+)(\d+)$/i);
      if (!match) return null;
      return { col: match[1].toUpperCase(), row: parseInt(match[2], 10) };
    };

    formulaFields.forEach((f: any) => {
      const expr = f.formulaExpression;
      if (!expr) return;

      const fDetails = parseRange(f.rangeStr);
      const isTableRow = fDetails && clientTemplate.config.tableListConfig && 
                         fDetails.row >= clientTemplate.config.tableListConfig.startRow && 
                         fDetails.row <= clientTemplate.config.tableListConfig.endRow;

      // Find placeholders e.g., {長度}
      const matches = expr.match(/\{[^{}]+\}/g);
      let evaluatedExpr = expr;

      if (matches) {
        matches.forEach((m: string) => {
          const varLabel = m.slice(1, -1).trim(); // Remove { and }
          
          // Find the source field that matches this label
          const sourceField = fieldsList.find((sf: any) => {
            const sfDetails = parseRange(sf.rangeStr);
            const sfIsTableRow = sfDetails && clientTemplate.config.tableListConfig && 
                                 sfDetails.row >= clientTemplate.config.tableListConfig.startRow && 
                                 sfDetails.row <= clientTemplate.config.tableListConfig.endRow;

            const sfCleanLabel = sf.label.replace(/^項次 \d+ - /, '').trim();
            const labelMatches = sfCleanLabel === varLabel || sf.label.trim() === varLabel;

            if (isTableRow && sfIsTableRow) {
              // Both are in the table: MUST match same row index
              return labelMatches && sfDetails.row === fDetails.row;
            } else {
              // Otherwise, just match global label
              return labelMatches;
            }
          });

          const val = sourceField ? parseFloat(clientFormData[sourceField.name] || '0') : 0;
          evaluatedExpr = evaluatedExpr.replace(m, isNaN(val) ? '0' : String(val));
        });
      }

      // Safely evaluate math expression
      let result = 0;
      try {
        const sanitized = evaluatedExpr.replace(/[^0-9+\-*/().\s]/g, '');
        result = sanitized ? new Function(`return (${sanitized})`)() : 0;
      } catch (e) {
        result = 0;
      }

      if (isNaN(result) || !isFinite(result)) {
        result = 0;
      }

      // Format result (round to 4 decimal places)
      const formattedResult = String(Math.round(result * 10000) / 10000);

      if (clientFormData[f.name] !== formattedResult) {
        newFormData[f.name] = formattedResult;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setClientFormData(newFormData);
    }
  }, [clientFormData, clientTemplate]);

  const parseRangeDetails = (rangeStr: string) => {
    const parts = rangeStr.split('!');
    if (parts.length !== 2) return null;
    const sheet = parts[0].replace(/^'|'$/g, '');
    const cell = parts[1].replace(/\$/g, '');
    const match = cell.match(/^([A-Z]+)(\d+)$/i);
    if (!match) return null;
    return {
      sheet,
      col: match[1].toUpperCase(),
      row: parseInt(match[2], 10)
    };
  };

  const renderFieldInput = (field: any, customLabel?: string) => {
    const cleanLabel = customLabel || field.label.replace(/^項次 \d+ - /, '');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
        <label style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 500 }}>
          {cleanLabel} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
        
        {field.type === 'text' && (
          <input 
            type="text" 
            value={clientFormData[field.name] || ''}
            onChange={(e) => setClientFormData({...clientFormData, [field.name]: e.target.value})}
            placeholder={t.inputPlaceholderText}
            style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '16px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
          />
        )}

        {field.type === 'number' && (
          <input 
            type="number" 
            value={clientFormData[field.name] || ''}
            onChange={(e) => setClientFormData({...clientFormData, [field.name]: e.target.value})}
            placeholder={t.inputPlaceholderNumber}
            style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '16px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
          />
        )}
        
        {field.type === 'dropdown' && (
          <select 
            value={clientFormData[field.name] || ''}
            onChange={(e) => setClientFormData({...clientFormData, [field.name]: e.target.value})}
            style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '16px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
          >
            <option value="">{t.selectPlaceholder}</option>
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
            <span style={{ color: '#fff', fontSize: '16px' }}>{t.confirmCheck}</span>
          </label>
        )}
        
        {field.type === 'formula' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
            <input 
              type="text" 
              readOnly
              value={clientFormData[field.name] || '0'}
              style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#a78bfa', fontSize: '16px', fontWeight: 'bold', outline: 'none', flex: 1, boxSizing: 'border-box', cursor: 'not-allowed' }}
            />
            {field.formulaUnit && (
              <span style={{ color: '#a78bfa', fontSize: '15px', fontWeight: 'bold', background: 'rgba(139, 92, 246, 0.1)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                {field.formulaUnit}
              </span>
            )}
          </div>
        )}
        
        {(field.type === 'image' || field.type === 'signature') && (
          <div style={{ padding: '16px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {(clientFileData[field.name] || []).map((file: File, fIdx: number) => (
                  <div key={fIdx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                    <img src={URL.createObjectURL(file)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div 
                      onClick={() => {
                        const newArr = [...(clientFileData[field.name] || [])];
                        newArr.splice(fIdx, 1);
                        setClientFileData({...clientFileData, [field.name]: newArr});
                      }}
                      style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px' }}>
                      ✕
                    </div>
                  </div>
                ))}
                
                {(!clientFileData[field.name] || clientFileData[field.name].length < (field.maxPhotos || 1)) && (
                  <label style={{ width: '80px', height: '80px', borderRadius: '8px', border: '1px dashed #10b981', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(16, 185, 129, 0.05)' }}>
                    <span style={{ fontSize: '24px' }}>{field.type === 'image' ? '📷' : '✍️'}</span>
                    <span style={{ fontSize: '10px', color: '#10b981', marginTop: '4px' }}>
                      {t.upload} ({clientFileData[field.name]?.length || 0}/{field.maxPhotos || 1})
                    </span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple={field.maxPhotos && field.maxPhotos > 1}
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const limit = field.maxPhotos || 1;
                          const currentArr = clientFileData[field.name] || [];
                          const newFiles = Array.from(e.target.files);
                          const combined = [...currentArr, ...newFiles].slice(0, limit);
                          setClientFileData({...clientFileData, [field.name]: combined});
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMainContent = () => {
    if (!clientFolder && !clientTemplate) {
      return (
        <div style={{ flex: 1, padding: '20px', maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <h2 style={{ color: '#fff', marginBottom: '24px' }}>{t.selectFolder}</h2>
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
                <div style={{ color: '#fff', fontWeight: 500 }}>{t.uncategorized}</div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (clientFolder && !clientTemplate) {
      return (
        <div style={{ flex: 1, padding: '20px', maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <button onClick={() => setClientFolder(null)} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', marginBottom: '16px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>←</span> {t.backToFolders}
          </button>
          <h2 style={{ color: '#fff', marginBottom: '24px' }}>{clientFolder === 'uncategorized' ? t.uncategorized : `📂 ${clientFolder}`}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {cloudTemplates.filter(t => clientFolder === 'uncategorized' ? !t.folder : t.folder === clientFolder).map((t: any) => (
              <div key={t.id} onClick={() => {
                setClientTemplate(t);
                setClientFormData({});
                setClientFileData({});
              }} style={{ background: 'rgba(255,255,255,0.05)', padding: '16px 20px', borderRadius: '12px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#fff', fontSize: '16px', fontWeight: 500 }}>{t.title}</div>
                <div style={{ color: '#10b981', fontSize: '14px' }}>{t.startFilling}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const tableConfig = clientTemplate?.config.tableListConfig;
    const fieldsList = clientTemplate?.config.fields || [];

    const generalFields: any[] = [];
    const tableRows: Record<number, any[]> = {};

    fieldsList.forEach((field: any) => {
      const details = parseRangeDetails(field.rangeStr);
      if (tableConfig && details && details.row >= tableConfig.startRow && details.row <= tableConfig.endRow) {
        if (!tableRows[details.row]) {
          tableRows[details.row] = [];
        }
        tableRows[details.row].push(field);
      } else {
        generalFields.push(field);
      }
    });

    return (
      <div style={{ flex: 1, padding: '20px', maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box', paddingBottom: '100px' }}>
        <button onClick={() => setClientTemplate(null)} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', marginBottom: '16px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>←</span> {t.backToTemplates}
        </button>
        <h2 style={{ color: '#fff', marginBottom: '24px' }}>📝 {clientTemplate?.title}</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {generalFields.map((field, idx) => (
            <div key={idx} style={{ width: '100%' }}>
              {renderFieldInput(field, field.label)}
            </div>
          ))}

          {tableConfig && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
              <h3 style={{ color: '#8b5cf6', fontSize: '16px', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{t.tableListDetail}</span>
                <span style={{ fontSize: '12px', padding: '2px 8px', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', borderRadius: '12px' }}>
                  {t.itemCount.replace('{count}', (tableConfig.endRow - tableConfig.startRow + 1).toString())}
                </span>
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Array.from({ length: tableConfig.endRow - tableConfig.startRow + 1 }).map((_, i) => {
                  const rowIdx = tableConfig.startRow + i;
                  const rowFields = tableRows[rowIdx] || [];
                  if (rowFields.length === 0) return null;

                  const isExpanded = expandedRow === rowIdx;

                  const filledSummary = rowFields
                    .filter(f => f.type !== 'image' && f.type !== 'signature')
                    .map(f => {
                      const val = clientFormData[f.name];
                      const cleanLabel = f.label.replace(/^項次 \d+ - /, '');
                      return val ? `${cleanLabel}: ${val}` : null;
                    })
                    .filter(Boolean)
                    .join(' | ');

                  const photosCount = rowFields
                    .filter(f => f.type === 'image')
                    .reduce((sum, f) => sum + (clientFileData[f.name]?.length || 0), 0);

                  return (
                    <div 
                      key={rowIdx} 
                      style={{ 
                        border: isExpanded ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '12px', 
                        background: isExpanded ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255,255,255,0.02)',
                        overflow: 'hidden',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div 
                        onClick={() => setExpandedRow(isExpanded ? null : rowIdx)}
                        style={{ 
                          padding: '16px', 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          cursor: 'pointer' 
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ color: '#fff', fontSize: '15px', fontWeight: 'bold' }}>
                            {t.itemNum.replace('{num}', (i + 1).toString())}
                          </div>
                          {(filledSummary || photosCount > 0) ? (
                            <div style={{ fontSize: '11px', color: '#a1a1aa' }}>
                              {filledSummary} {photosCount > 0 && `(📸 x${photosCount})`}
                            </div>
                          ) : (
                            <div style={{ fontSize: '11px', color: '#475569', fontStyle: 'italic' }}>
                              {t.notFilled}
                            </div>
                          )}
                        </div>
                        <span style={{ color: '#8b5cf6', fontSize: '18px' }}>
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      </div>

                      {isExpanded && (
                        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.2)' }}>
                          {rowFields.map((field, fIdx) => (
                            <div key={fIdx}>
                              {renderFieldInput(field)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginTop: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <h3 style={{ color: '#fff', fontSize: '16px', margin: 0 }}>{t.saveAndExportSetting}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 500 }}>{t.setFilename}</label>
            <input 
              type="text" 
              value={targetFilename}
              onChange={(e) => setTargetFilename(e.target.value)}
              placeholder={`${t.example}: ${clientTemplate?.title}_20260703`}
              style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '16px', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: 500 }}>{t.chooseCloudFolder}</label>
            <select 
              value={targetFolderId}
              onChange={(e) => setTargetFolderId(e.target.value)}
              style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '16px', outline: 'none' }}
            >
              <option value="">{t.doNotSaveToCloud}</option>
              {exportFolders.map(f => (
                <option key={f.id} value={f.id}>
                  {exportFolders.find(p => p.id === f.parentId)?.name ? `${exportFolders.find(p => p.id === f.parentId)?.name} > ` : ''}{f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px', background: 'rgba(24, 24, 27, 0.9)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '12px', zIndex: 100 }}>
          <button 
            onClick={async () => {
              setIsExporting(true);
              try {
                const formData = new FormData();
                formData.append('data', JSON.stringify(clientFormData));
                if (targetFolderId) formData.append('folderId', targetFolderId);
                if (targetFilename) formData.append('filename', targetFilename);

                Object.keys(clientFileData).forEach((key) => {
                  const files = clientFileData[key];
                  if (Array.isArray(files)) {
                    files.forEach((file, idx) => {
                      formData.append(`${key}_${idx}`, file);
                    });
                  }
                });

                const res = await fetch(`${API_BASE}/api/templates/${clientTemplate.id}/export`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${MASTER_TOKEN}` },
                  body: formData
                });
                
                if (!res.ok) {
                  const err = await res.json();
                  alert(t.fail + ': ' + (err.error || ''));
                  return;
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${targetFilename || clientTemplate.title}.xlsx`;
                a.click();
                alert(t.success);
                setClientTemplate(null);
              } catch (e) {
                console.error(e);
                alert(t.errorOccurred);
              } finally {
                setIsExporting(false);
              }
            }}
            disabled={isExporting}
            style={{ flex: 1, padding: '14px', borderRadius: '12px', background: isExporting ? '#6b7280' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: isExporting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
          >
            {isExporting ? t.submitting : t.submitAndDownload}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Header with Language Selector */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#a1a1aa', fontSize: '13px' }}>🌐 Language:</span>
          <select 
            value={lang} 
            onChange={(e) => handleLangChange(e.target.value as any)}
            style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', outline: 'none' }}
          >
            <option value="zh">繁體中文</option>
            <option value="vi">Tiếng Việt</option>
            <option value="id">Bahasa Indonesia</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
      
      {/* Render Main Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {renderMainContent()}
      </div>
    </div>
  );
};

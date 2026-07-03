import sys

with open("admin-web/src/ClientMode.tsx", "r") as f:
    content = f.read()

# 1. Update state type
content = content.replace("useState<Record<string, File>>({});", "useState<Record<string, File[]>>({});")

# 2. Update Image UI
old_img_ui = """
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
"""

new_img_ui = """
            {(field.type === 'image' || field.type === 'signature') && (
              <div style={{ padding: '16px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)' }}>
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
                          上傳 ({clientFileData[field.name]?.length || 0}/{field.maxPhotos || 1})
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
"""

content = content.replace(old_img_ui, new_img_ui)

# 3. Update formData.append
old_append = """
              Object.keys(clientFileData).forEach((key) => {
                formData.append(key, clientFileData[key]);
              });
"""

new_append = """
              Object.keys(clientFileData).forEach((key) => {
                const files = clientFileData[key];
                if (Array.isArray(files)) {
                  files.forEach((file, idx) => {
                    formData.append(`${key}_${idx}`, file);
                  });
                }
              });
"""

content = content.replace(old_append, new_append)

with open("admin-web/src/ClientMode.tsx", "w") as f:
    f.write(content)


import sys

with open("backend-api/src/app.ts", "r") as f:
    content = f.read()

endpoints = """
// 9. Export Folders Management
app.get('/api/export-folders', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid token' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const tokenInfo = db.getToken(token);
    if (!tokenInfo) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const masterToken = tokenInfo.role === 'master' ? tokenInfo.token : (tokenInfo.masterToken || '');
    const folders = db.getExportFolders(masterToken);
    res.json(folders);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/export-folders', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid token' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const tokenInfo = db.getToken(token);
    if (!tokenInfo) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const masterToken = tokenInfo.role === 'master' ? tokenInfo.token : (tokenInfo.masterToken || '');
    const { name, parentId } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const id = `ef_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const folder = db.createExportFolder(id, masterToken, name, parentId || null);
    res.json(folder);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/exported-files/:folderId', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid token' });
      return;
    }
    const token = authHeader.split(' ')[1];
    if (!db.getToken(token)) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const files = db.getExportedFiles(req.params.folderId);
    res.json(files);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/exported-files/download/:id', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid token' });
      return;
    }
    const token = authHeader.split(' ')[1];
    if (!db.getToken(token)) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const file = db.getExportedFileById(req.params.id);
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const buffer = Buffer.from(file.dataBase64, 'base64');
    res.setHeader('Content-Type', file.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}.${file.format}"`);
    res.send(buffer);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

"""

# modify /export to save to DB
old_export_part_1 = """
      const format = req.query.format === 'pdf' ? 'pdf' : 'excel';

      if (format === 'pdf') {
"""

new_export_part_1 = """
      const format = req.query.format === 'pdf' ? 'pdf' : 'excel';
      const targetFolderId = req.body.folderId || null;
      const targetFilename = req.body.filename || `compiled_${templateId}`;
      let generatedBase64 = '';

      if (format === 'pdf') {
"""

old_export_part_2 = """
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="compiled_${templateId}.pdf"`);
        res.send(pdfBuffer);
      } else {
"""

new_export_part_2 = """
        generatedBase64 = pdfBuffer.toString('base64');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(targetFilename)}.pdf"`);
        res.send(pdfBuffer);
      } else {
"""

old_export_part_3 = """
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="compiled_${templateId}.xlsx"`
        );
        res.send(outputBuffer);
      }
"""

new_export_part_3 = """
        generatedBase64 = outputBuffer.toString('base64');
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${encodeURIComponent(targetFilename)}.xlsx"`
        );
        res.send(outputBuffer);
      }

      // Save to ExportedFiles if folderId is provided
      if (targetFolderId) {
        const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const masterToken = tokenInfo.role === 'master' ? tokenInfo.token : (tokenInfo.masterToken || '');
        db.saveExportedFile(fileId, masterToken, targetFolderId, targetFilename, format, generatedBase64);
      }
"""

content = content.replace(old_export_part_1, new_export_part_1)
content = content.replace(old_export_part_2, new_export_part_2)
content = content.replace(old_export_part_3, new_export_part_3)
content += "\n" + endpoints

with open("backend-api/src/app.ts", "w") as f:
    f.write(content)


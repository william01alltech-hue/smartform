import sys

with open("backend-api/src/app.ts", "r") as f:
    content = f.read()

# 1. Update imageBuffers type and grouping logic for local export
old_group_1 = """
      // Extract image buffers map (excluding the template file itself)
      const imageBuffers: Record<string, Buffer> = {};
      files.forEach((file) => {
        if (file.fieldname !== 'template') {
          imageBuffers[file.fieldname] = file.buffer;
        }
      });
"""

new_group_1 = """
      // Extract image buffers map (excluding the template file itself)
      // Group by base field name for multi-photo support
      const imageBuffers: Record<string, Buffer[]> = {};
      files.forEach((file) => {
        if (file.fieldname !== 'template') {
          const baseName = file.fieldname.replace(/_\d+$/, '');
          if (!imageBuffers[baseName]) {
            imageBuffers[baseName] = [];
          }
          imageBuffers[baseName].push(file.buffer);
        }
      });
"""
content = content.replace(old_group_1, new_group_1)


# 2. Update imageBuffers type and grouping logic for cloud export
old_group_2 = """
      // Extract image buffers map
      const imageBuffers: Record<string, Buffer> = {};
      files.forEach((file) => {
        imageBuffers[file.fieldname] = file.buffer;
      });
"""

new_group_2 = """
      // Extract image buffers map
      const imageBuffers: Record<string, Buffer[]> = {};
      files.forEach((file) => {
        const baseName = file.fieldname.replace(/_\d+$/, '');
        if (!imageBuffers[baseName]) {
          imageBuffers[baseName] = [];
        }
        imageBuffers[baseName].push(file.buffer);
      });
"""
content = content.replace(old_group_2, new_group_2)


# 3. Update HTML Generator for cloud export
old_html_gen = """
        // Add images and signatures to HTML
        template.config.fields.forEach((field: any) => {
          if ((field.type === 'image' || field.type === 'signature') && imageBuffers[field.name]) {
            const base64Img = imageBuffers[field.name].toString('base64');
            const mimeType = field.type === 'signature' ? 'image/png' : 'image/jpeg';
            htmlContent += `<tr><th>${field.label || field.name}</th><td>
              <div class="image-container">
                <img src="data:${mimeType};base64,${base64Img}" alt="${field.name}" />
              </div>
            </td></tr>`;
          }
        });
"""

new_html_gen = """
        // Add images and signatures to HTML
        template.config.fields.forEach((field: any) => {
          if ((field.type === 'image' || field.type === 'signature') && imageBuffers[field.name] && imageBuffers[field.name].length > 0) {
            const mimeType = field.type === 'signature' ? 'image/png' : 'image/jpeg';
            const imgTags = imageBuffers[field.name].map(buf => {
              const base64Img = buf.toString('base64');
              return `<img src="data:${mimeType};base64,${base64Img}" alt="${field.name}" style="flex: 1; max-width: calc(50% - 8px); margin: 4px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); object-fit: contain;" />`;
            }).join('');
            
            htmlContent += `<tr><th>${field.label || field.name}</th><td>
              <div class="image-container" style="display: flex; flex-wrap: wrap; justify-content: center;">
                ${imgTags}
              </div>
            </td></tr>`;
          }
        });
"""
content = content.replace(old_html_gen, new_html_gen)

with open("backend-api/src/app.ts", "w") as f:
    f.write(content)


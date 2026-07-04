import sys

with open("backend-api/src/app.ts", "r") as f:
    content = f.read()

# 1. Update generate-member-token POST endpoint
old_post = """  // Generate new member token
  const memberToken = `member_${uuidv4().substring(0, 8)}`;
  const tokenInfoObj = db.createToken(memberToken, 'member', tokenInfo.token);
  // Default to undefined (all access). We will allow modifying it later.

  res.json({
    success: true,
    memberToken,
    allowedFolders: tokenInfoObj.allowedFolders
  });"""

new_post = """  const { memberId, memberName } = req.body;

  // Generate new member token
  const memberToken = `member_${uuidv4().substring(0, 8)}`;
  const tokenInfoObj = db.createToken(memberToken, 'member', tokenInfo.token);
  
  if (memberId || memberName) {
    db.updateMemberMetadata(memberToken, memberId || '', memberName || '');
  }

  res.json({
    success: true,
    memberToken,
    memberId: tokenInfoObj.memberId,
    memberName: tokenInfoObj.memberName,
    allowedFolders: tokenInfoObj.allowedFolders
  });"""

content = content.replace(old_post, new_post)

# 2. Update member-tokens GET endpoint
old_get = """    members: members.map(m => ({
      token: m.token,
      allowedFolders: m.allowedFolders
    }))"""

new_get = """    members: members.map(m => ({
      token: m.token,
      memberId: m.memberId || '',
      memberName: m.memberName || '',
      allowedFolders: m.allowedFolders
    }))"""

content = content.replace(old_get, new_get)

# 3. Update member-tokens PUT endpoint
old_put = """  const { allowedFolders } = req.body;
  
  // if allowedFolders is passed as null or undefined, we treat it as undefined (all access)
  // if it's an array, we save it.
  const foldersToSave = Array.isArray(allowedFolders) ? allowedFolders : undefined;
  
  const success = db.updateTokenFolders(memberToken, foldersToSave);
  if (success) {
    res.json({ success: true });
  } else {"""

new_put = """  const { allowedFolders, memberId, memberName } = req.body;
  
  // if allowedFolders is passed as null or undefined, we treat it as undefined (all access)
  // if it's an array, we save it.
  const foldersToSave = Array.isArray(allowedFolders) ? allowedFolders : undefined;
  
  let success = true;
  if (allowedFolders !== undefined) {
    success = db.updateTokenFolders(memberToken, foldersToSave);
  }
  
  if (success && (memberId !== undefined || memberName !== undefined)) {
    // Keep existing metadata if not explicitly provided
    const currentInfo = db.getToken(memberToken);
    const newId = memberId !== undefined ? memberId : currentInfo?.memberId;
    const newName = memberName !== undefined ? memberName : currentInfo?.memberName;
    success = db.updateMemberMetadata(memberToken, newId, newName);
  }
  
  if (success) {
    res.json({ success: true });
  } else {"""

content = content.replace(old_put, new_put)

with open("backend-api/src/app.ts", "w") as f:
    f.write(content)


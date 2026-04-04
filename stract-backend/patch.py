import os

h_path = 'internal/features/tasks/handlers.go'
w_path = 'internal/features/tasks/workspace_handlers.go'

with open(h_path, 'r') as f:
    h = f.read()

# 1. Add Creator to Task struct
h = h.replace('CreatorID   string    json:"creator_id"\n', 'CreatorID   string    json:"creator_id"\n\tCreator     *Assignee json:"creator"\n')

# 2. Update taskScanFull vars
h = h.replace('var aID, aEmail, aName, aAvatar *string\n', 'var aID, aEmail, aName, aAvatar *string\n\tvar cID, cEmail, cName, cAvatar *string\n')

# 3. Update taskScanFull scan
h = h.replace('&aID, &aEmail, &aName, &aAvatar,', '&aID, &aEmail, &aName, &aAvatar,\n\t\t&cID, &cEmail, &cName, &cAvatar,')

# 4. Update taskScanFull assign
creator_block = '''
if err == nil && cID != nil && cEmail != nil {
t.Creator = &Assignee{
ID:        *cID,
Email:     *cEmail,
Name:      cName,
AvatarURL: cAvatar,
}
}
'''
h = h.replace('AvatarURL: aAvatar,\n\t\t}\n\t}\n\treturn err', 'AvatarURL: aAvatar,\n\t\t}\n\t}' + creator_block + '\n\treturn err')

# 5. Update fullTaskSelect
h = h.replace("u.id, u.email, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'avatar_url',\n", "u.id, u.email, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'avatar_url',\n       c.id, c.email, c.raw_user_meta_data->>'full_name', c.raw_user_meta_data->>'avatar_url',\n")

# 6. Update LEFT JOINs in handlers.go
h = h.replace('LEFT JOIN auth.users u ON u.id = t.assignee_id\n', 'LEFT JOIN auth.users u ON u.id = t.assignee_id\n\t\t LEFT JOIN auth.users c ON c.id = t.creator_id\n')

with open(h_path, 'w') as f:
    f.write(h)

with open(w_path, 'r') as f:
    w = f.read()

# Update LEFT JOINs in workspace_handlers.go
w = w.replace('LEFT JOIN auth.users u ON u.id = t.assignee_id\n', 'LEFT JOIN auth.users u ON u.id = t.assignee_id\n\t\t LEFT JOIN auth.users c ON c.id = t.creator_id\n')

with open(w_path, 'w') as f:
    f.write(w)

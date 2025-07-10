# Google Drive Minimal Scanner

A simple, focused Google Apps Script to scan specific Google Drive folders for empty directories. Perfect for quick cleanup tasks when you need to identify unused folders in shared drives or specific directories.

## 🎯 Use Cases

- **Quick folder cleanup** - Scan 1-2 specific folders for empty directories
- **Shared drive maintenance** - Find unused folders in shared "with me" directories  
- **Simple reporting** - Get a clean spreadsheet of empty folders with full metadata
- **Time-constrained tasks** - Need results fast without complex setup

## ✨ Features

- **Single file solution** - Just one `.gs` file to copy and run
- **Large folder support** - Automatically handles timeouts with background continuation
- **Full metadata reporting** - Folder name, ID, path, owner, dates, and clickable links
- **Built-in diagnostics** - Test folder access before scanning
- **Progress tracking** - See real-time progress updates
- **Error recovery** - Continues even if some folders have access issues

## 🚀 Quick Start (5 minutes)

### 1. Setup
1. Open your Google Sheet
2. Go to **Extensions** → **Apps Script**
3. Delete any existing code
4. Copy and paste the entire contents of [`MinimalEmptyFolderScanner.gs`](MinimalEmptyFolderScanner.gs)

### 2. Configure
Find these lines at the top and add your folder IDs:
```javascript
const FOLDER_1_ID = "your-folder-id-here";
const FOLDER_2_ID = "your-other-folder-id-here";
```

**How to get folder IDs:**
- Open folder in Google Drive
- Look at URL: `https://drive.google.com/drive/folders/THE-ID-IS-HERE`
- Copy everything after `/folders/`

### 3. Test Access
- Save the file (Ctrl+S)
- Run → **`testFolderAccess()`**
- Fix any permission issues shown

### 4. Scan
- Run → **`scanForEmptyFolders()`**
- Authorize when prompted
- Watch progress in your spreadsheet

## 📊 Output

The scanner creates two tabs in your spreadsheet:

### "Empty Folders" Tab
Contains all empty folders found with these columns:
- **Folder Name** - Name of the empty folder
- **Folder ID** - Google Drive ID
- **Link** - Clickable link to open in Drive
- **Path** - Full path showing folder hierarchy
- **Drive Type** - "Shared with me", "My Drive", etc.
- **Drive Name** - Name of the parent drive
- **Parent Folder** - Immediate parent folder name
- **Last Modified** - When folder was last updated
- **Owner** - Email of folder owner
- **Delete?** - Checkbox column (folders in "Shared with me" cannot be deleted)
- **Drive ID** - Technical ID for shared drives

### "Debug Log" Tab
Shows real-time progress and any issues:
```
2024-01-09 10:15:00 | Starting new scan...
2024-01-09 10:15:01 | Successfully accessed "My Project Files" (1ABC123...)
2024-01-09 10:15:15 | Scanned 100 folders, found 5 empty folders so far...
```

## 🛠️ Available Functions

| Function | Purpose |
|----------|---------|
| `scanForEmptyFolders()` | Main scanning function |
| `testFolderAccess()` | Test if you can access your folders |
| `checkScanStatus()` | See current progress |
| `resetScan()` | Stop and reset everything |

## ⏱️ Performance

- **Small folders** (<500 subfolders): 5-10 minutes
- **Medium folders** (500-2000): 10-20 minutes  
- **Large folders** (2000+): 20-40 minutes with automatic continuation

For large folders, the scanner automatically pauses every 4 minutes and schedules itself to continue, preventing timeouts.

## 🔧 Troubleshooting

### Common Issues

**"No item with the given ID could be found"**
- Folder ID is incorrect
- Folder isn't shared with your account  
- You don't have permission to access it

**"Unexpected error while getting the method or property getFolderById"**
- Invalid folder ID format
- Check for extra quotes, spaces, or characters

**"Found 0 empty folders out of 0 total"**
- No folders were accessible
- Run `testFolderAccess()` to diagnose

### Getting Help

1. **Run `testFolderAccess()`** first to see specific issues
2. **Check the Debug Log tab** for detailed error messages
3. **Verify folder permissions** in Google Drive
4. **Try opening the folders manually** in Drive first

## 📋 Requirements

- **Google Account** with access to Google Sheets and Apps Script
- **Folder permissions** - At least "Viewer" access to folders you want to scan
- **Modern browser** - Chrome, Firefox, Safari, or Edge

## 🆚 Differences from Full Scanner

This minimal scanner is focused on simplicity. For enterprise features, see the [full Google Drive Empty Folder Scanner](https://github.com/solracnyc/google-drive-empty-folder-scanner):

| Feature | Minimal Scanner | Full Scanner |
|---------|----------------|--------------|
| **Setup** | 1 file, 5 minutes | Multiple files, configuration |
| **Folders** | 2 specific folders | My Drive, Shared Drives, Shared with me |
| **Filtering** | None | Owner, parent folder, advanced filters |
| **UI** | None | Custom menu system |
| **Deletion** | Manual only | Built-in deletion with safety checks |
| **Use Case** | Quick tasks | Enterprise environments |

## 📄 License

MIT License - feel free to modify and use for your needs.

## 🤝 Contributing

This is a minimal, focused tool. For feature requests or complex needs, consider the [full scanner](https://github.com/solracnyc/google-drive-empty-folder-scanner).

## ⭐ Found this helpful?

If this tool saved you time, please star the repository to help others find it!
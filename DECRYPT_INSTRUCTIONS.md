# Extract Instructions for cm.jar.zip

The `cm.jar.zip` file is a password-protected compressed archive containing the CodeMaat JAR file.

## File Details
- **Encryption:** Standard ZIP password protection
- **Password:** `GitAnalyzer2024`
- **File Size:** 35 MB (compressed)
- **Original Size:** 38 MB (cm.jar)
- **Compatibility:** Works natively on Windows, macOS, Linux

---

## Extraction Instructions

### On Windows (Built-in - No Extra Tools Needed!)

**Method 1: Using Windows Explorer (Easiest)**
1. Right-click on `cm.jar.zip`
2. Select "Extract All..."
3. Choose destination folder
4. When prompted, enter password: `GitAnalyzer2024`
5. Click "Extract"

**Method 2: Using PowerShell**
```powershell
# Extract with password
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory("cm.jar.zip", ".")

# Or use 7-Zip if installed
7z x cm.jar.zip -pGitAnalyzer2024
```

**Method 3: Using Command Prompt with tar (Windows 10+)**
```cmd
tar -xf cm.jar.zip
# Enter password when prompted: GitAnalyzer2024
```

---

### On macOS

**Method 1: Using Finder (Easiest)**
1. Double-click `cm.jar.zip`
2. Enter password when prompted: `GitAnalyzer2024`

**Method 2: Using Terminal**
```bash
unzip cm.jar.zip
# Enter password when prompted: GitAnalyzer2024
```

---

### On Linux

```bash
unzip cm.jar.zip
# Enter password when prompted: GitAnalyzer2024
```

**Or with 7-Zip:**
```bash
7z x cm.jar.zip -pGitAnalyzer2024
```

---

## Final Location

After decryption and extraction, the file should be at:
```
./tools/cm.jar
```

Verify the file size is approximately **38 MB**.

---

## Security Note

⚠️ **Password:** The password `GitAnalyzer2024` is included here for convenience. 

For production use with sensitive tools:
- Use a stronger password
- Share password via secure channel (not in repository)
- Consider using environment variables or key management systems

---

## Troubleshooting

### Error: "Wrong password" or "incorrect password"
- Check password is exactly: `GitAnalyzer2024` (case-sensitive)
- No extra spaces before or after the password
- Try typing it manually instead of copy-pasting

### Error: "Cannot open file" or "Archive is corrupted"
- Ensure you downloaded the complete file (should be ~35 MB)
- Try downloading again
- Verify file integrity

### Windows: "The Compressed (zipped) Folder is invalid"
- Use 7-Zip or WinRAR instead of built-in Windows extractor
- Or use PowerShell/Command Prompt method

### File not extracting to correct location
- Verify extraction destination
- Check that `tools/` directory exists
- Expected final location: `./tools/cm.jar`

---

## Quick Start

**Windows (Easiest):**
```
1. Right-click cm.jar.zip
2. Extract All
3. Enter password: GitAnalyzer2024
4. Done!
```

**Command Line (All Platforms):**
```bash
# Extract
unzip cm.jar.zip
# Enter password: GitAnalyzer2024

# Verify
ls -lh tools/cm.jar

# Clean up (optional)
rm cm.jar.zip
```

Done! The CodeMaat JAR is ready to use at `./tools/cm.jar`


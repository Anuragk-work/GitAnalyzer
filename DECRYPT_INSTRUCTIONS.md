# Decryption Instructions for cm.jar.zip.enc

The `cm.jar.zip.enc` file is an encrypted, compressed archive containing the CodeMaat JAR file.

## Encryption Details
- **Algorithm:** AES-256-CBC
- **Password:** `GitAnalyzer2024`
- **File Size:** 35 MB (encrypted)
- **Original Size:** 38 MB (cm.jar)

---

## Decryption Instructions

### On Windows (PowerShell or Command Prompt)

**Prerequisites:** Install OpenSSL for Windows
- Download from: https://slproweb.com/products/Win32OpenSSL.html
- Or use Git Bash (includes OpenSSL)

**Decrypt the file:**
```powershell
openssl enc -aes-256-cbc -d -in cm.jar.zip.enc -out cm.jar.zip -k "GitAnalyzer2024" -pbkdf2
```

**Extract the ZIP:**
```powershell
Expand-Archive -Path cm.jar.zip -DestinationPath .
```

**Or using right-click:**
```
Right-click cm.jar.zip -> Extract All -> Choose destination
```

---

### On macOS/Linux

**Decrypt the file:**
```bash
openssl enc -aes-256-cbc -d -in cm.jar.zip.enc -out cm.jar.zip -k "GitAnalyzer2024" -pbkdf2
```

**Extract the ZIP:**
```bash
unzip cm.jar.zip
```

---

## Alternative: Using Git Bash on Windows

If you have Git installed on Windows, you can use Git Bash:

```bash
# Decrypt
openssl enc -aes-256-cbc -d -in cm.jar.zip.enc -out cm.jar.zip -k "GitAnalyzer2024" -pbkdf2

# Extract
unzip cm.jar.zip
```

---

## One-Line Command (All Platforms)

**Decrypt and extract in one step:**
```bash
openssl enc -aes-256-cbc -d -in cm.jar.zip.enc -k "GitAnalyzer2024" -pbkdf2 | funzip > tools/cm.jar
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

### Error: "bad decrypt"
- Check password is exactly: `GitAnalyzer2024` (case-sensitive)
- Ensure you're using the correct file: `cm.jar.zip.enc`

### Error: "openssl: command not found"
- Install OpenSSL (see prerequisites above)
- On Windows: Use Git Bash or install OpenSSL separately

### File not extracting
- Verify cm.jar.zip was successfully decrypted (should be ~35 MB)
- Use `unzip -l cm.jar.zip` to test the archive

---

## Quick Start

**Complete workflow:**
```bash
# 1. Decrypt
openssl enc -aes-256-cbc -d -in cm.jar.zip.enc -out cm.jar.zip -k "GitAnalyzer2024" -pbkdf2

# 2. Extract
unzip cm.jar.zip

# 3. Verify
ls -lh tools/cm.jar

# 4. Clean up (optional)
rm cm.jar.zip
```

Done! The CodeMaat JAR is ready to use.


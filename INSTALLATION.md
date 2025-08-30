# AutoVFX Installation Guide

## Quick Setup

### 1. Copy Extension Files
Copy the entire `autovfx` folder to your Adobe CEP extensions directory:

**macOS:**
```
/Library/Application Support/Adobe/CEP/extensions/autovfx/
```

**Windows:**
```
C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\autovfx\
```

### 2. Enable Development Mode

**macOS Terminal:**
```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

**Windows Registry:**
- Open Registry Editor (regedit)
- Navigate to: `HKEY_CURRENT_USER\Software\Adobe\CSXS.11`
- Create new String: `PlayerDebugMode` with value `1`

### 3. Get API Key
1. Sign up at [AI/ML API](https://aimlapi.com/) or [useapi.net](https://useapi.net/)
2. Get your Runway API key
3. Add it to the extension config

### 4. Configure API Key

**Option A: Edit config file**
Edit `config/config.json`:
```json
{
  "runway": {
    "apiKey": "your-api-key-here"
  }
}
```

**Option B: Browser console (for testing)**
1. Open extension in Premiere Pro
2. Press F12 to open Developer Tools
3. Run in console:
```javascript
localStorage.setItem('autovfx-config', JSON.stringify({
  apiKey: 'your-api-key-here'
}));
```
4. Reload extension

### 5. Restart Premiere Pro

The extension should now appear under:
`Window > Extensions > AutoVFX`

## Troubleshooting

**Extension not showing?**
- Verify files are in correct CEP directory
- Check that development mode is enabled
- Restart Premiere Pro completely

**Export not working?**
- Set In/Out points on timeline (I and O keys)
- Make sure you have an active sequence

**API errors?**
- Verify your API key in config
- Check internet connection
- Ensure you have API credits

## Support

For issues, check the main README.md or create an issue on GitHub. 
# AutoVFX - Premiere Pro Extension

AutoVFX is a powerful Premiere Pro extension that integrates AI video generation directly into your editing workflow. Export timeline segments, generate AI-enhanced videos using Runway ML, and import the results back into your project seamlessly.

![AutoVFX Interface](docs/autovfx-interface.png)

## Features

- **Timeline Integration**: Export In/Out point segments directly from Premiere Pro
- **AI Video Generation**: Powered by Runway ML's Gen-4 Turbo model
- **Dual Export Methods**: Native Premiere Pro export with FFmpeg fallback
- **Seamless Workflow**: Import generated videos back into your timeline
- **Progress Tracking**: Real-time progress indicators for export and generation
- **Modern UI**: Clean, dark interface that matches Premiere Pro's aesthetic
- **Cross-Platform**: Works on macOS and Windows with automatic FFmpeg setup

## Requirements

- Adobe Premiere Pro CC 2020 or later
- Runway ML API key (from [AI/ML API](https://aimlapi.com/) or [useapi.net](https://useapi.net/))
- AutoVFX subscription (managed via Apstle Subscriptions on Shopify)
- Internet connection for API calls

## Installation

### Method 1: Manual Installation

1. **Download the Extension**
   - Clone or download this repository
   - Extract to a temporary location

2. **Install to CEP Extensions Directory**
   
   Copy the entire `autovfx` folder to your CEP extensions directory:
   
   **macOS:**
   ```
   /Library/Application Support/Adobe/CEP/extensions/
   ```
   
   **Windows:**
   ```
   C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\
   ```

3. **Enable Unsigned Extensions** (Development Mode)
   
   **macOS:**
   ```bash
   defaults write com.adobe.CSXS.11 PlayerDebugMode 1
   ```
   
   **Windows (Registry Editor):**
   ```
   HKEY_CURRENT_USER/Software/Adobe/CSXS.11
   Add key: PlayerDebugMode (String) = "1"
   ```

4. **Restart Premiere Pro**

### Method 2: ZXP Installation

1. Download the `.zxp` file from the releases page
2. Use Adobe Extension Manager or [ZXP Installer](https://adobeexchange.com/creativecloud/pluginsandextensions.html)
3. Install the extension
4. Restart Premiere Pro

## Setup

### 1. Subscription & API Key Configuration

You'll need:

1. **AutoVFX Subscription**: Subscribe to one of our tiers for credits
2. **Runway ML API Key** from one of these providers:
   - **AI/ML API**: [Get API Key](https://aimlapi.com/)
   - **useapi.net**: [Get API Key](https://useapi.net/)

### 2. Configure the Extension

1. Open Premiere Pro
2. Go to `Window > Extensions > AutoVFX`
3. The extension panel will open
4. Add your API key to the configuration:

   **Method A: Edit config file**
   ```json
   {
     "runway": {
       "apiKey": "your-api-key-here",
       "baseUrl": "https://api.aimlapi.com/v1"
     },
     "ffmpeg": {
       "enabled": true,
       "autoDownload": true
     }
   }
   ```

   **Method B: Local Storage (for development)**
   ```javascript
   localStorage.setItem('autovfx-config', JSON.stringify({
     apiKey: 'your-api-key-here'
   }));
   ```

## Usage

### Basic Workflow

1. **Set In/Out Points**
   - In your Premiere Pro timeline, set In and Out points around the segment you want to process
   - Use `I` and `O` keys or the timeline markers

2. **Export Video Segment**
   - Click the "Export" button in the AutoVFX panel
   - The extension will export your In/Out point selection
   - Progress will be shown in real-time

3. **Generate AI Video**
   - Enter a descriptive prompt for what you want to create
   - Click "Generate video"
   - Wait for the AI processing to complete (typically 10-30 seconds)

4. **Review and Import**
   - Preview the generated video in the result panel
   - Click "Import" to add it to your timeline
   - Or click "Reset" to start over

### Tips for Best Results

- **Set Clear In/Out Points**: Make sure your selection is precise
- **Write Detailed Prompts**: Be specific about what you want to achieve
- **Use High-Quality Source**: Better input footage leads to better results
- **Experiment**: Try different prompts to explore creative possibilities

### Export Methods

The extension supports two export methods:

1. **Premiere Pro Native** (Primary): Uses Premiere Pro's built-in export functionality
2. **FFmpeg Fallback** (Automatic): If Premiere Pro export fails, automatically uses FFmpeg

FFmpeg will be downloaded and configured automatically on first use.

## 🔑 **API Configuration**

### ✅ **Pre-configured for Runway Gen-4 Aleph**

The extension is now pre-configured with your API key and the latest **Runway Gen-4 Aleph** model:

- **API Key**: `key_a33ec5...` (pre-configured)
- **Model**: `gen4_aleph` (latest Runway model)
- **Endpoint**: Official Runway API (`https://api.dev.runwayml.com/v1`)
- **API Version**: `2024-11-06`

### 🎬 **Aleph Model Features**

The Gen-4 Aleph model provides:
- **Enhanced video-to-video generation**
- **Superior consistency and motion**
- **Advanced prompt adherence** 
- **Professional-grade quality**
- **Physics simulation**
- **Character consistency**

### 🚀 **Ready to Use**

No console commands needed! The extension is ready for:

1. **Export** your timeline clips (5s around playhead or In/Out points)
2. **Generate** AI video with text prompts
3. **Import** generated videos back to timeline

### 🛠 **Testing Commands** (Optional)

Open browser console (F12) for testing:
```javascript
// Test FFmpeg
testFFmpeg()

// Test Runway API connection  
window.autoVFX.runwayAPI.testConnection()

// Check system info
showFFmpegInfo()
```

### 📝 **Example Prompts for Aleph**

Try these prompts for best results:
- "Transform into a vintage film noir style"
- "Add dramatic lighting and shadows"
- "Make it look like an anime sequence"
- "Convert to cyberpunk aesthetic"
- "Add magical sparkles and glowing effects"

## API Configuration

### Supported Services

The extension works with multiple Runway API providers:

#### AI/ML API
```json
{
  "baseUrl": "https://api.aimlapi.com/v1",
  "model": "gen4_turbo"
}
```

#### useapi.net
```json
{
  "baseUrl": "https://useapi.net/v1",
  "model": "runway/gen4turbo"
}
```

### Configuration Options

Edit `config/config.json` to customize:

```json
{
  "runway": {
    "apiKey": "your-api-key",
    "baseUrl": "https://api.aimlapi.com/v1",
    "defaultModel": "gen4_turbo",
    "defaultDuration": 10,
    "defaultRatio": "16:9",
    "watermark": false
  },
  "export": {
    "defaultFormat": "mp4",
    "defaultPreset": "YouTube 1080p HD",
    "outputDirectory": "Desktop"
  }
}
```

## Troubleshooting

### Common Issues

**Extension doesn't appear in Premiere Pro**
- Ensure you've enabled unsigned extensions (development mode)
- Check that the extension is in the correct CEP directory
- Restart Premiere Pro completely

**Export fails**
- Make sure you have In and Out points set on the timeline
- Check that you have an active sequence
- Verify export permissions and disk space

**API errors**
- Verify your API key is correct and active
- Check your internet connection
- Ensure you have sufficient API credits

**Import fails**
- Check that the generated video file exists
- Verify Premiere Pro has permission to access the file
- Make sure the timeline is active

### Debug Mode

Enable debug logging in `config/config.json`:

```json
{
  "debug": {
    "enableLogging": true,
    "logLevel": "debug"
  }
}
```

View logs in:
- **macOS**: Console.app
- **Windows**: Event Viewer
- **Browser**: Developer Tools Console (F12)

## Development

### Building from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/autovfx-premiere-extension.git
   cd autovfx-premiere-extension
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

### Project Structure

```
autovfx/
├── CSXS/
│   └── manifest.xml          # Extension manifest
├── css/
│   └── styles.css           # UI styles
├── js/
│   ├── CSInterface.js       # Adobe CEP interface
│   ├── main.js             # Main application logic
│   └── runway-api.js       # Runway API integration
├── jsx/
│   └── autovfx.jsx         # ExtendScript for Premiere Pro
├── config/
│   └── config.json         # Configuration file
├── index.html              # Main UI
└── README.md
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with Premiere Pro
5. Submit a pull request

## API Costs

Video generation costs vary by provider:

- **AI/ML API**: ~$0.10-0.30 per 10-second video
- **useapi.net**: ~$0.15-0.25 per 10-second video

Check with your provider for current pricing.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/autovfx-premiere-extension/issues)
- **Documentation**: [Wiki](https://github.com/yourusername/autovfx-premiere-extension/wiki)
- **Community**: [Discord](https://discord.gg/autovfx)

## Changelog

### v1.0.0
- Initial release
- Runway Gen-4 Turbo integration
- Timeline export/import
- Modern UI with progress tracking

---

**Made with ❤️ for video creators** 
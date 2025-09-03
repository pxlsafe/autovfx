# AutoVFX - Premiere Pro Extension

AutoVFX is a powerful Premiere Pro extension that integrates AI video generation directly into your editing workflow. Export timeline segments, generate AI-enhanced videos using Runway ML, and import the results back into your project seamlessly.

![AutoVFX Interface](docs/autovfx-interface.png)

## Requirements

- Adobe Premiere Pro CC 2020 or later
- Runway ML API key (from [AI/ML API](https://aimlapi.com/) or [useapi.net](https://useapi.net/))
- AutoVFX subscription (managed via Apstle Subscriptions on Shopify)
- Internet connection for API calls

## Installation

### Method 1: ZXP Installation

1. Download the `.zxp` file from the releases page
2. Use Adobe Extension Manager or [ZXP Installer](https://adobeexchange.com/creativecloud/pluginsandextensions.html)
3. Install the extension
4. Restart Premiere Pro

### Method 2: Manual Installation

1. **Download the Extension**

- Unzip the downloaded zip file

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

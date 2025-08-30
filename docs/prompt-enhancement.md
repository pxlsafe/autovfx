# Prompt Enhancement Feature

The AutoVFX extension now includes an AI-powered prompt enhancement feature that helps you write better prompts for Runway ML's Gen-4 Aleph model.

## Overview

The enhance button (✨) appears in the top-right corner of the prompt input field. It uses OpenAI's GPT-5 model to improve your basic prompts according to Runway ML's best practices.

## Setup

### 1. Get an OpenAI API Key

1. Visit [OpenAI API](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key (starts with `sk-...`)

### 2. Configure the Extension

Open the extension in Premiere Pro and press F12 to open Developer Tools. In the console, run:

```javascript
setOpenAIApiKey("your-openai-api-key-here")
```

## Usage

1. **Enter a basic prompt** in the text area, such as:
   - "add water"
   - "make it winter"
   - "remove the car"
   - "change lighting"

2. **Click the ✨ enhance button** in the top-right corner of the prompt input

3. **Your prompt will be enhanced** based on Runway ML best practices:
   - Adds action verbs (add, remove, change, replace, re-light, re-style)
   - Makes descriptions more specific
   - Adds preservation phrases when needed
   - Optimizes for Runway's video generation capabilities

## Examples

| Original Prompt | Enhanced Prompt |
|----------------|----------------|
| "add water" | "Add water to the scene while keeping the background and lighting unchanged" |
| "make it winter" | "Change the season in the original video to winter. Add snow and ice on the ground" |
| "remove cars" | "Remove the cars from the scene while preserving the background and overall composition" |
| "dark lighting" | "Re-light the scene with dramatic dark lighting and high contrast shadows" |

## Runway ML Prompting Best Practices

The enhancement follows these guidelines:

1. **Start with action verbs**: add, remove, change, replace, re-light, re-style
2. **Be specific**: Describe exactly what transformation you want
3. **Add preservation phrases**: "keep the lighting the same", "background stays unchanged"
4. **Focus on visual elements**: Colors, lighting, objects, movements, effects
5. **Keep it concise**: Under 100 words, clear and actionable

## Testing Functions

Use these console commands to test the feature:

```javascript
// Test with sample text
testEnhancePrompt("add rain")

// Enhance whatever is currently in the input field
enhanceCurrentPrompt()

// Fill input with a test prompt
testEnhancePrompt()
```

## Troubleshooting

### Button not working?
- Make sure you've configured an OpenAI API key with `setOpenAIApiKey()`
- Check the browser console for error messages
- Verify your API key has sufficient credits

### Enhancement not helpful?
- Try being more specific in your original prompt
- The AI works best with basic descriptions of transformations
- You can always edit the enhanced prompt manually

### API Errors?
- Check your OpenAI API key is correct
- Verify you have sufficient API credits
- Ensure you have internet connectivity

## Cost Considerations

- Each enhancement uses ~150-300 tokens
- Cost is typically $0.001-0.002 per enhancement
- The feature uses GPT-5 for enhanced accuracy and capabilities
- Consider your OpenAI usage limits

## Technical Details

- **Model**: GPT-5 (with responses API)
- **Max output tokens**: 300
- **Temperature**: 1.0 (default, only supported value)
- **System prompt**: Specialized for Runway ML video generation
- **Storage**: API key stored in localStorage securely 
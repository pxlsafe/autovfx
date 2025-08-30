/**
 * OpenAI API Integration for Prompt Enhancement
 * Enhances user prompts based on Runway ML best practices
 */

class OpenAIAPI {
    constructor(config = {}) {
        this.apiKey = config.apiKey || null;
        this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
        this.model = config.model || 'gpt-5';
        this.maxTokens = config.maxTokens || 300;
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    /**
     * Extracts text content from the Responses API output structure.
     */
    extractTextFromResponsesOutput(output) {
        if (!Array.isArray(output)) {
            return '';
        }
        const collectedTexts = [];
        for (const item of output) {
            // Direct text node
            if (item && item.type === 'text' && typeof item.text === 'string') {
                collectedTexts.push(item.text);
                continue;
            }
            // Message node with content blocks
            if (item && item.type === 'message' && Array.isArray(item.content)) {
                for (const block of item.content) {
                    if (!block) continue;
                    // Newer schema
                    if ((block.type === 'output_text' || block.type === 'text') && typeof block.text === 'string') {
                        collectedTexts.push(block.text);
                    }
                    // Fallbacks just in case
                    if (typeof block === 'string') {
                        collectedTexts.push(block);
                    }
                    if (block.value && typeof block.value === 'string') {
                        collectedTexts.push(block.value);
                    }
                }
            }
        }
        return collectedTexts.join(' ').trim();
    }

    /**
     * Polls a Responses API result until it is completed or timeout occurs.
     */
    async pollResponsesResult(responseId, { intervalMs = 600, timeoutMs = 10000 } = {}) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const res = await fetch(`${this.baseUrl}/responses/${responseId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(`OpenAI Responses API poll error: ${res.status} - ${err.error?.message || 'Unknown error'}`);
            }
            const data = await res.json();
            console.log('⏳ Poll Responses API:', { status: data.status });
            if (data.status === 'completed') {
                return data;
            }
            if (data.status === 'failed' || data.status === 'cancelled') {
                throw new Error(`Responses API returned terminal status: ${data.status}`);
            }
            await new Promise(r => setTimeout(r, intervalMs));
        }
        throw new Error('Responses API polling timed out');
    }

    /**
     * Enhance a user prompt using GPT-5's responses API
     */
    async enhancePromptWithResponses(userPrompt) {
        if (!this.apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        if (!userPrompt || userPrompt.trim().length === 0) {
            throw new Error('No prompt provided to enhance');
        }

        const input = `You are a professional video editing prompt enhancer specializing in Runway ML's Gen-4 Aleph model. Your job is to take basic user prompts and enhance them following Runway's best practices.

Key Runway prompting guidelines:
1. Start with an action verb (add, remove, change, replace, re-light, re-style)
2. Be specific about the desired transformation
3. ALWAYS include explicit preservation instructions for existing scene elements
4. Keep prompts clear and concise
5. Focus on visual elements and transformations

Examples of good Runway prompts with proper preservation:
- "Change the video so it's underwater, keeping all characters and objects in their original positions"
- "Add rain to the scene while preserving the existing lighting and background"
- "Change the season in the original video to winter with snow and ice, keeping all people and objects unchanged"
- "Remove the cars from the scene while maintaining everything else exactly as it appears"
- "Change the lighting so the left side of his face is lit with orange light, keeping all other elements unchanged"
- "Add ice that starts spreading over the hand, preserving the person's position and background"

Take the user's basic prompt and enhance it to be more effective for Runway ML video generation.

CRITICAL Output rules:
- Return ONE concise prompt (20–35 words) in the form: Action verb + specific transformation + explicit preservation instruction.
- MANDATORY: Every enhanced prompt MUST explicitly state that all other elements in the scene remain unchanged, preserved, or stay exactly as they appear.
- Use phrases like: "keeping everything else unchanged", "preserving all other elements", "maintaining the existing [background/people/objects]", "while all other aspects remain identical"
- Do NOT invent spatial constraints or camera directions unless the user explicitly asked for them.
- If the user mentions an image, explicitly specify how the image and video interact (e.g., color/lighting/style from the image). If no image is mentioned, do NOT mention an image.
- Do NOT return quotes, explanations, or multiple options. Return only the prompt text.

Enhance this prompt for Runway ML video generation: "${userPrompt}"`;

        try {
            const response = await fetch(`${this.baseUrl}/responses`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    input: input,
                    max_output_tokens: this.maxTokens
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`OpenAI Responses API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
            }

            const initial = await response.json();
            console.log('🔍 GPT-5 Responses API Response:', initial);
            console.log('🔍 Response status:', initial.status);
            console.log('🔍 Response output:', initial.output);

            let data = initial;
            if (initial.status === 'incomplete' && initial.id) {
                try {
                    data = await this.pollResponsesResult(initial.id, { intervalMs: 700, timeoutMs: 12000 });
                    console.log('✅ Responses API completed via polling');
                } catch (pollErr) {
                    console.warn('⚠️ Responses polling failed:', pollErr.message);
                    // Try to extract partial text if any in the initial payload
                    const partialText = this.extractTextFromResponsesOutput(initial.output);
                    if (partialText) {
                        const cleanedPartial = partialText.replace(/^["']|["']$/g, '');
                        return { success: true, original: userPrompt, enhanced: cleanedPartial, usage: initial.usage || null };
                    }
                    throw pollErr;
                }
            }

            if (!data.output_text && !data.output) {
                throw new Error('Invalid response format from OpenAI Responses API');
            }

            let enhancedPrompt = '';
            if (data.output_text) {
                enhancedPrompt = data.output_text.trim();
            } else if (data.output) {
                enhancedPrompt = this.extractTextFromResponsesOutput(data.output);
            }

            if (!enhancedPrompt) {
                throw new Error('No text output found in response');
            }

            const cleanedPrompt = enhancedPrompt.replace(/^["']|["']$/g, '');
            
            return {
                success: true,
                original: userPrompt,
                enhanced: cleanedPrompt,
                usage: data.usage
            };

        } catch (error) {
            console.error('OpenAI Responses API Enhancement Error:', error);
            return {
                success: false,
                error: error.message,
                original: userPrompt
            };
        }
    }

    /**
     * Enhance a user prompt based on Runway ML prompting best practices
     * Tries GPT-5 responses API first, falls back to chat completions
     */
    async enhancePrompt(userPrompt) {
        if (!this.apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        if (!userPrompt || userPrompt.trim().length === 0) {
            throw new Error('No prompt provided to enhance');
        }

        // Try GPT-5 responses API first if using GPT-5
        if (this.model === 'gpt-5') {
            try {
                console.log('🔍 Trying GPT-5 responses API...');
                const result = await this.enhancePromptWithResponses(userPrompt);
                if (result.success && result.enhanced && result.enhanced.trim().length > 0) {
                    return result;
                }
                console.log('🔄 GPT-5 responses API returned empty, falling back to chat completions...');
            } catch (error) {
                console.log('🔄 GPT-5 responses API failed, falling back to chat completions:', error.message);
            }
        }

        const systemPrompt = `You are a professional video editing prompt enhancer specializing in Runway ML's Gen-4 Aleph model. Your job is to take basic user prompts and enhance them following Runway's best practices.

Key Runway prompting guidelines:
1. Start with an action verb (add, remove, change, replace, re-light, re-style)
2. Be specific about the desired transformation
3. ALWAYS include explicit preservation instructions for existing scene elements
4. Keep prompts clear and concise
5. Focus on visual elements and transformations

Examples of good Runway prompts with proper preservation:
- "Change the video so it's underwater, keeping all characters and objects in their original positions"
- "Add rain to the scene while preserving the existing lighting and background"
- "Change the season in the original video to winter with snow and ice, keeping all people and objects unchanged"
- "Remove the cars from the scene while maintaining everything else exactly as it appears"
- "Change the lighting so the left side of his face is lit with orange light, keeping all other elements unchanged"
- "Add ice that starts spreading over the hand, preserving the person's position and background"

Take the user's basic prompt and enhance it to be more effective for Runway ML video generation.

CRITICAL Output rules:
- Return ONE concise prompt (20–35 words) in the form: Action verb + specific transformation + explicit preservation instruction.
- MANDATORY: Every enhanced prompt MUST explicitly state that all other elements in the scene remain unchanged, preserved, or stay exactly as they appear.
- Use phrases like: "keeping everything else unchanged", "preserving all other elements", "maintaining the existing [background/people/objects]", "while all other aspects remain identical"
- Do NOT invent spatial constraints or camera directions unless the user explicitly asked for them.
- If the user mentions an image, explicitly specify how the image and video interact (e.g., color/lighting/style from the image). If no image is mentioned, do NOT mention an image.
- Do NOT return quotes, explanations, or multiple options. Return only the prompt text.`;

        const userMessage = `Enhance this prompt for Runway ML video generation: "${userPrompt}"`;

        try {
            // Use a reliable chat model for fallback when gpt-5 returns empty
            const modelForChat = this.model === 'gpt-5' ? 'gpt-4o' : this.model;
            console.log('💬 Falling back to chat completions with model:', modelForChat);

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: modelForChat,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    max_completion_tokens: this.model === 'gpt-5' ? 500 : this.maxTokens
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            
            // Debug logging for GPT-5 response
            console.log('🔍 OpenAI API Response:', data);
            console.log('🔍 Choices array:', data.choices);
            console.log('🔍 First choice:', data.choices[0]);
            console.log('🔍 Message:', data.choices[0]?.message);
            console.log('🔍 Content:', data.choices[0]?.message?.content);
            
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('Invalid response format from OpenAI API');
            }

            const enhancedPrompt = (data.choices[0].message.content || '').trim();
            console.log('🎨 Raw enhanced prompt:', enhancedPrompt);
            
            // If still empty, hard fail for caller to handle
            if (!enhancedPrompt) {
                throw new Error('Empty content from chat completions');
            }

            // Remove quotes if the response is quoted
            const cleanedPrompt = enhancedPrompt.replace(/^["']|["']$/g, '');
            
            return {
                success: true,
                original: userPrompt,
                enhanced: cleanedPrompt,
                usage: data.usage
            };

        } catch (error) {
            console.error('OpenAI API Enhancement Error:', error);
            return {
                success: false,
                error: error.message,
                original: userPrompt
            };
        }
    }

    /**
     * Test the OpenAI API connection
     */
    async testConnection() {
        if (!this.apiKey) {
            return {
                success: false,
                error: 'No API key configured'
            };
        }

        try {
            const result = await this.enhancePrompt('test prompt');
            return {
                success: result.success,
                error: result.error || null
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Make it available globally if needed
if (typeof window !== 'undefined') {
    window.OpenAIAPI = OpenAIAPI;
} 
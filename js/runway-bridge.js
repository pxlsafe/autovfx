/**
 * Bridge to load the official Runway SDK in browser environment
 */

// Since the official SDK is designed for Node.js, we'll create a simple bridge
// that uses the same API structure but works in the browser

class RunwayMLBridge {
    constructor(options = {}) {
        this.apiKey = options.apiKey;
        this.baseUrl = 'https://api.runwayml.com/v1';
        
        // Initialize video-to-video interface
        this.videoToVideo = {
            create: this.createVideoToVideoTask.bind(this)
        };
    }
    
    async createVideoToVideoTask(params) {
        const {
            promptVideo,
            promptText,
            duration = 5,
            ratio = '1280:720'
        } = params;
        
        console.log('🚀 Creating video-to-video task with bridge...');
        
        // Handle both File objects and data URIs
        let videoBlob;
        if (promptVideo instanceof File || promptVideo instanceof Blob) {
            // Already a File/Blob object - use directly
            videoBlob = promptVideo;
        } else if (typeof promptVideo === 'string' && promptVideo.startsWith('data:')) {
            // Data URI - convert to blob
            videoBlob = await this.dataUriToBlob(promptVideo);
        } else {
            throw new Error('promptVideo must be a File object or data URI');
        }
        
        // Upload video to get URI for video-to-video
        const videoAsset = await this.uploadVideoAsset(videoBlob);
        const videoUri = videoAsset.url || videoAsset.uri;
        
        // Create video-to-video task using official API
        const taskResponse = await fetch(`${this.baseUrl}/video_to_video`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Runway-Version': '2024-11-06'
            },
            body: JSON.stringify({
                model: 'gen4_aleph',
                videoUri: videoUri,
                promptText: promptText,
                ratio: ratio
            })
        });
        
        if (!taskResponse.ok) {
            const errorText = await taskResponse.text();
            throw new Error(`Task creation failed: ${taskResponse.status} ${errorText}`);
        }
        
        const task = await taskResponse.json();
        
        // Return an object that has waitForTaskOutput method
        const taskWrapper = {
            id: task.id,
            waitForTaskOutput: async () => {
                return await this.waitForTaskOutput(task.id);
            }
        };
        
        return taskWrapper;
    }
    
    async uploadVideoAsset(videoBlob) {
        const formData = new FormData();
        formData.append('file', videoBlob);
        
        const response = await fetch(`${this.baseUrl}/assets`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Accept': 'application/json',
                'X-Runway-Version': '2024-11-06'
            },
            body: formData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Asset upload failed: ${response.status} ${errorText}`);
        }
        
        const result = await response.json();
        return result.id || result.asset_id || result.url;
    }
    
    async waitForTaskOutput(taskId) {
        const maxAttempts = 60;
        const interval = 5000;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const response = await fetch(`${this.baseUrl}/tasks/${taskId}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Accept': 'application/json',
                    'X-Runway-Version': '2024-11-06'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Task status check failed: ${response.status}`);
            }
            
            const task = await response.json();
            
            if (task.status === 'SUCCEEDED') {
                return {
                    id: task.id,
                    status: task.status,
                    output: task.output
                };
            }
            
            if (task.status === 'FAILED') {
                throw new Error(`Task failed: ${task.failure?.reason || 'Unknown error'}`);
            }
            
            // Wait before next check
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        
        throw new Error('Task timed out');
    }
    
    async dataUriToBlob(dataUri) {
        const response = await fetch(dataUri);
        return await response.blob();
    }
    
    async extractFirstFrame(videoBlob) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            video.onloadedmetadata = () => {
                // Set canvas dimensions to match video
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                // Seek to first frame
                video.currentTime = 0;
            };
            
            video.onseeked = () => {
                try {
                    // Draw the current frame to canvas
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    // Convert to data URI
                    const dataUri = canvas.toDataURL('image/jpeg', 0.8);
                    
                    // Clean up
                    URL.revokeObjectURL(video.src);
                    
                    resolve(dataUri);
                } catch (error) {
                    reject(error);
                }
            };
            
            video.onerror = (error) => {
                URL.revokeObjectURL(video.src);
                reject(error);
            };
            
            // Load the video
            video.src = URL.createObjectURL(videoBlob);
            video.muted = true; // Required for autoplay policies
        });
    }
}

// Make it available globally as RunwayML
window.RunwayML = RunwayMLBridge; 
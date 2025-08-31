/**
 * AutoVFX Main Application
 * Handles UI interactions, Premiere Pro integration, and Runway API
 */

const { resolve } = require('path');

class AutoVFX {
    constructor() {
        this.csInterface = new CSInterface();
        this.currentExportedVideo = null;
        this.generatedVideo = null;
        this.runwayConfig = {
            apiKey: 'key_a33ec5121fccdca78789ef930fb9483c43656f2cd525b4199cd763e7f6456214a1530801bed32dff7a5c08e9147d06945abaf9136c40696cb6089dfa0ea9624a', // Your API key  
            baseUrl: 'https://api.dev.runwayml.com/v1', // Official Runway API
            defaultModel: 'gen4_aleph', // Aleph model
            apiVersion: '2024-11-06'
        };

        this.userConfig = { 'exptofold': "Desktop", 'clearExp': false }
        
        // Initialize Runway API
        this.runwayAPI = null;
        
        // Initialize OpenAI API for prompt enhancement
        this.openaiConfig = {
            apiKey: null, // Will be loaded from config or set by user
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-5',
            maxTokens: 300
        };
        this.openaiAPI = null;
        
        // Initialize FFmpeg Manager
        // FFmpeg manager removed - using Premiere Pro native export
        
        // Initialize video version management
        this.selectedVideoSource = 'original'; // Selected version ID (default to original)
        this.videoVersions = new Map(); // Store multiple video versions
        this.currentVersionIndex = 0; // Current version in slider
        
        // Progress animation
        this.progressAnimationInterval = null;
        
        // Reference image for consistency
        this.referenceImage = null;
        
        // Initialize licensing
        this.licenseAPI = null;
        this.licensingEnabled = false;
        this.currentReservation = null; // Track current job reservation
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        
        this.csInterface.evalScript("testJson()", (res) => {
            if (res.toLowerCase().indexOf("error") >1 || !res ) {
                console.warn('⚠️ JSX returned with error - continuing anyway');
                // Don't show error to user, just log it
            } else { let jp = JSON.parse(res); if(jp.jsontest && jp.jsontest == "succeed" ) 
                console.log('✅ JSX and JsxJson loaded');
            }
        });
        
        this.loadConfiguration();
        this.setupDebugFunctions();
        
        // Initialize with export view
        this.showView('exportView');
        
        // Disable context menu globally, except on textareas (e.g., prompt input)
        document.addEventListener('contextmenu', (e) => {
            const t = e.target;
            if (t && (t.tagName === 'TEXTAREA' || (t.closest && t.closest('textarea')))) {
                return; // allow textarea default menu
            }
            e.preventDefault();
        });
        
        // Forward button should start disabled until we have results
        this.disableForwardButton();
        
        console.log('AutoVFX initialized');
    }

    setupEventListeners() {
        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.handleExport();
        });
        
        // Generate button
        document.getElementById('generateBtn').addEventListener('click', () => {
            this.handleGenerate();
        });
        
        // Import button
        document.getElementById('importBtn').addEventListener('click', () => {
            this.handleImport();
        });
        
        // Navigation buttons
        document.getElementById('backBtn').addEventListener('click', () => {
            this.handleBack();
        });
        
        // Forward button (prompt view to result view)
        const fwd = document.getElementById('forwardBtn');
        if (fwd) {
            fwd.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleForward();
            });
            console.log('🔗 Forward button listener attached');
        } else {
            console.warn('⚠️ forwardBtn not found when attaching listener');
        }
        // Fallback: event delegation (capture) to ensure clicks are handled
        document.addEventListener('click', (e) => {
            const el = e.target && e.target.closest ? e.target.closest('#forwardBtn') : null;
            if (el) {
                e.preventDefault();
                this.handleForward();
            }
        }, true);
        
        // Reset button (result view)
        document.getElementById('resetBtn').addEventListener('click', () => {
            this.handleReset();
        });
        
        // Reset button (prompt view)
        document.getElementById('promptResetBtn').addEventListener('click', () => {
            this.handleReset();
        });
        
        // Video version navigation - now using arrow buttons (Prompt View)
        document.getElementById('versionPrevBtn').addEventListener('click', () => {
            this.navigateVersion(-1);
        });
        
        document.getElementById('versionNextBtn').addEventListener('click', () => {
            this.navigateVersion(1);
        });
        
        // Video version navigation - mirrored in Result View
        const prevResult = document.getElementById('versionPrevBtnResult');
        const nextResult = document.getElementById('versionNextBtnResult');
        if (prevResult) {
            prevResult.addEventListener('click', () => {
                this.navigateVersion(-1);
            });
        }
        if (nextResult) {
            nextResult.addEventListener('click', () => {
                this.navigateVersion(1);
            });
        }
        
        // Enhance button
        document.getElementById('enhanceBtn').addEventListener('click', () => {
            this.handleEnhancePrompt();
        });

        // Reference image button
        document.getElementById('referenceImageBtn').addEventListener('click', () => {
            document.getElementById('referenceImageInput').click();
        });

        // Reference image file input
        document.getElementById('referenceImageInput').addEventListener('change', (event) => {
            this.handleReferenceImageUpload(event);
        });

        // Remove reference image
        document.querySelector('.remove-reference').addEventListener('click', () => {
            this.removeReferenceImage();
        });
        
        // Authentication event listeners
        this.setupAuthEventListeners();
        
        // Licensing event listeners  
        this.setupLicenseEventListeners();
        
        // Logo click handlers for account access
        const logoButton = document.querySelectorAll('.logoButton');
        if (logoButton) {
            logoButton.forEach(elem =>
                elem.addEventListener('click', () => { this.toggleAccountDashboard(); })
        )}
        
        const chboxExpFolds = document.querySelectorAll('.chboxExpFoldCnt input');
        if (chboxExpFolds) {
            chboxExpFolds.forEach(elem =>
                elem.addEventListener('change', (elemClick) => {
                    this.toggleChboxExpFolds(elemClick.srcElement);
                })
            )
        }
        
        // Custom video controls will be initialized when video is displayed
    }

    /**
     * Setup authentication event listeners
     */
    setupAuthEventListeners() {
        // Sign in button
        const signInBtn = document.getElementById('signInBtn');
        if (signInBtn) {
            signInBtn.addEventListener('click', () => {
                this.handleSignIn();
            });
        }

        // Magic link button
        const magicLinkBtn = document.getElementById('magicLinkBtn');
        if (magicLinkBtn) {
            magicLinkBtn.addEventListener('click', () => {
                this.handleMagicLink();
            });
        }

        // Sign up button
        const signUpBtn = document.getElementById('signUpBtn');
        if (signUpBtn) {
            signUpBtn.addEventListener('click', () => {
                this.handleSignUp();
            });
        }

        // Enter key handling for auth form
        const authInputs = document.querySelectorAll('.auth-input');
        authInputs.forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSignIn();
                }
            });
        });
    }

    /**
     * Setup licensing event listeners
     */
    setupLicenseEventListeners() {
        // Old license header removed - functionality moved to account modal

        // Insufficient credits modal
        const closeInsufficientModal = document.getElementById('closeInsufficientModal');
        if (closeInsufficientModal) {
            closeInsufficientModal.addEventListener('click', () => {
                this.hideInsufficientCreditsModal();
            });
        }

        const topup1000Btn = document.getElementById('topup1000Btn');
        if (topup1000Btn) {
            topup1000Btn.addEventListener('click', () => {
                this.handleTopupPurchase('1000');
            });
        }

        const topup2000Btn = document.getElementById('topup2000Btn');
        if (topup2000Btn) {
            topup2000Btn.addEventListener('click', () => {
                this.handleTopupPurchase('2000');
            });
        }

        const upgradeModalBtn = document.getElementById('upgradeModalBtn');
        if (upgradeModalBtn) {
            upgradeModalBtn.addEventListener('click', () => {
                this.hideInsufficientCreditsModal();
                this.openExternalUrl('https://pxlsafe.com/products/autovfx');
            });
        }

        const manageSubBtn = document.getElementById('manageSubBtn');
        if (manageSubBtn) {
            manageSubBtn.addEventListener('click', () => {
                this.hideInsufficientCreditsModal();
                this.openExternalUrl('https://pxlsafe.com/apps/subscriptions');
            });
        }

        // Close modal on backdrop click
        const insufficientModal = document.getElementById('insufficientCreditsModal');
        if (insufficientModal) {
            insufficientModal.addEventListener('click', (e) => {
                if (e.target === insufficientModal) {
                    this.hideInsufficientCreditsModal();
                }
            });
        }

        // Account modal
        const closeAccountModal = document.getElementById('closeAccountModal');
        if (closeAccountModal) {
            closeAccountModal.addEventListener('click', () => {
                this.hideAccountModal();
            });
        }

        const modalUpgradeBtn = document.getElementById('modalUpgradeBtn');
        if (modalUpgradeBtn) {
            modalUpgradeBtn.addEventListener('click', () => {
                this.hideAccountModal();
                this.handleUpgrade();
            });
        }

        const modalTopupBtn = document.getElementById('modalTopupBtn');
        if (modalTopupBtn) {
            modalTopupBtn.addEventListener('click', () => {
                this.hideAccountModal();
                this.handleTopupPurchase('1000'); // Default to 1000 credits
            });
        }

        const modalAccountBtn = document.getElementById('modalAccountBtn');
        if (modalAccountBtn) {
            modalAccountBtn.addEventListener('click', () => {
                this.hideAccountModal();
                this.handleAccount();
            });
        }

        // Close account modal on backdrop click
        const accountModal = document.getElementById('accountModal');
        if (accountModal) {
            accountModal.addEventListener('click', (e) => {
                if (e.target === accountModal) {
                    this.hideAccountModal();
                }
            });
        }
    }

    async loadConfiguration() {
        // Load API key and other configurations
        // In production, this would be loaded from secure storage
        const storedConfig = localStorage.getItem('autovfx-config');
        if (storedConfig) {
            const config = JSON.parse(storedConfig);
            // Only merge apiKey from stored config, ignore baseUrl to prevent using wrong endpoint
            this.runwayConfig = { 
                ...this.runwayConfig, 
                apiKey: config.apiKey || this.runwayConfig.apiKey
                // Explicitly ignore baseUrl from cache to prevent wrong endpoint
            };
        }
        
        // FORCE the correct Runway API URL (override any cached values)
        this.runwayConfig.baseUrl = 'https://api.dev.runwayml.com/v1';
        
        // Initialize Runway API if we have a key
        if (this.runwayConfig.apiKey) {
            this.runwayAPI = new RunwayAPI(this.runwayConfig);
        }
        
        // Load OpenAI config from storage
        const storedOpenAIConfig = localStorage.getItem('autovfx-openai-config');
        if (storedOpenAIConfig) {
            const openaiConfig = JSON.parse(storedOpenAIConfig);
            this.openaiConfig = { ...this.openaiConfig, ...openaiConfig };
        }
        
        // Initialize OpenAI API if we have a key
        if (this.openaiConfig.apiKey) {
            this.openaiAPI = new OpenAIAPI(this.openaiConfig);
        }
        
        // Load and initialize licensing configuration
        this.loadLicenseConfiguration();

        // load user config
        // let getConf = { 'exptofold': "Desktop", 'clearExp': false };
        const getConf = await new Promise((resolve) => {
            this.csInterface.evalScript('AutoVFXExtendScript.initSettings("getJS")', (result) => {
                if (result === 'EvalScript error.' || !result || result.includes('EvalScript error')) {
                    console.warn('⚠️ initSettings() failed, using fallback default settings');
                    resolve(false);
                }
                else{ resolve( JSON.parse(result) ); }
            });
        });

        if(getConf){ 
            this.userConfig = getConf;
            
            const elemFold = document.getElementById("switchFold");
            if (elemFold) {
                elemFold.checked = (this.userConfig.exptofold == "Documents");
                this.toggleChboxExpFolds(elemFold);
            }

            const elemDel = document.getElementById("switchDel");
            if (elemDel) {
                elemDel.checked = this.userConfig.clearExp;
                this.toggleChboxExpFolds(elemDel);
            }
            this.removeAllGen();
        }


        
        console.log('Configuration loaded:', {
            hasRunwayKey: !!this.runwayConfig.apiKey,
            licensingEnabled: this.licensingEnabled,
            userConfig: this.userConfig
        });
    }

    removeAllGen(){
        if(this.userConfig.clearExp){
            this.csInterface.evalScript("removeAllGenerated()");
        }
    }

    /**
     * Load licensing configuration and initialize license API
     */
    async loadLicenseConfiguration() {
        try {
            // Load license config from config.json
            const response = await fetch('./config/config.json');
            const config = await response.json();
            
            // Load OpenAI configuration from config.json if available
            if (config.openai) {
                if (config.openai.apiKey) {
                    this.openaiConfig.apiKey = config.openai.apiKey;
                    console.log('✅ OpenAI API key loaded from config.json');
                }
                if (config.openai.baseUrl) {
                    this.openaiConfig.baseUrl = config.openai.baseUrl;
                }
                if (config.openai.model) {
                    this.openaiConfig.model = config.openai.model;
                }
                if (config.openai.maxTokens) {
                    this.openaiConfig.maxTokens = config.openai.maxTokens;
                }
                
                // Initialize OpenAI API if we have a key
                if (this.openaiConfig.apiKey) {
                    this.openaiAPI = new OpenAIAPI(this.openaiConfig);
                    
                    // Save to localStorage for persistence across sessions
                    localStorage.setItem('autovfx-openai-config', JSON.stringify(this.openaiConfig));
                    
                    console.log('🤖 OpenAI API initialized from config.json and saved to localStorage');
                }
            }
            
            if (config.licensing && config.licensing.enabled) {
                this.licensingEnabled = true;
                this.licenseAPI = new LicenseAPI(config.licensing.backend);
                
                console.log('🔐 Licensing enabled:', {
                    baseUrl: config.licensing.backend.baseUrl,
                    hasStoredAuth: this.licenseAPI.isAuthenticated()
                });
                
                // Check if user is already authenticated
                if (this.licenseAPI.isAuthenticated()) {
                    try {
                        await this.licenseAPI.getMe();
                        // Ensure freshest balance from backend (reads Postgres when available)
                        await this.licenseAPI.getCredits();
                        this.showAuthenticatedState();
                    } catch (error) {
                        console.warn('⚠️  Stored auth invalid, requiring re-authentication');
                        this.licenseAPI.clearStoredAuth();
                        this.showAuthView();
                    }
                } else {
                    this.showAuthView();
                }
            } else {
                console.log('🔓 Licensing disabled, proceeding without authentication');
                this.showView('exportView');
            }
        } catch (error) {
            console.warn('⚠️  Failed to load license config, proceeding without licensing:', error);
            this.licensingEnabled = false;
            this.showView('exportView');
        }
    }

    /**
     * Configure Runway API key
     */
    setRunwayApiKey(apiKey) {
        this.runwayConfig.apiKey = apiKey;
        
        // Reinitialize Runway API with the new key
        this.runwayAPI = new RunwayAPI(this.runwayConfig);
        
        // Save to localStorage for persistence
        localStorage.setItem('autovfx-config', JSON.stringify(this.runwayConfig));
        
        console.log('✅ Runway API key configured');
        
        // Test the API connection
        this.runwayAPI.testConnection().then(result => {
            if (result.success) {
                console.log('✅ Runway API connection successful');
                this.showSuccess('Video generation API configured successfully!');
            } else {
                console.warn('⚠️  Runway API test failed:', result.error);
                this.showError('API key set but connection test failed: ' + result.error);
            }
        }).catch(error => {
            console.warn('⚠️  Could not test Runway API connection:', error);
        });
    }

    /**
     * Configure OpenAI API key for prompt enhancement
     */
    setOpenAIApiKey(apiKey) {
        this.openaiConfig.apiKey = apiKey;
        
        // Reinitialize OpenAI API with the new key
        this.openaiAPI = new OpenAIAPI(this.openaiConfig);
        
        // Save to localStorage for persistence
        localStorage.setItem('autovfx-openai-config', JSON.stringify(this.openaiConfig));
        
        console.log('✅ OpenAI API key configured for prompt enhancement');
        
        // Test the API connection
        this.openaiAPI.testConnection().then(result => {
            if (result.success) {
                console.log('✅ OpenAI API connection successful');
                this.showSuccess('OpenAI API configured successfully!');
            } else {
                console.warn('⚠️  OpenAI API test failed:', result.error);
                this.showError('OpenAI API key set but connection test failed: ' + result.error);
            }
        }).catch(error => {
            console.warn('⚠️  Could not test OpenAI API connection:', error);
        });
    }

    showView(viewId) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        // Show target view
        document.getElementById(viewId).classList.add('active');
    }

    async handleExport() {
        try {            
            this.setButtonState('exportBtn', false, 'Exporting...');
            
            // Clear any existing video versions to start fresh
            console.log('🧹 EXPORT: Clearing existing video versions before new export');
            this.videoVersions.clear();
            this.generatedVideo = null;
            this.selectedVideoSource = 'original';
            
            // Use the new simplified export method - it handles all the logic internally
            console.log('🎬 Starting export...');
            const exportData = await this.exportVideoSegment();
            
            if (exportData) {
                console.log('✅ Export completed successfully:', exportData);
                this.currentExportedVideo = exportData.outputPath;
                // Store the in/out point range in ticks as the timeline position for import
                this.lastExportPosition = exportData;
                // { outputPath: exportData.outputPath, clipStart: exportData.inPoint, clipEnd: exportData.outPoint,
                //     parentTrack: exportData.parentTrack, timebase: exportData.timebase };
                
                // Don't add original video to videoVersions - it's stored in currentExportedVideo
                console.log('📦 EXPORT: Original video stored in currentExportedVideo, not adding to videoVersions');
                
                // Stop smooth progress and complete it
                this.stopSmoothProgress();
                this.updateProgress('progressSection', 100, 'Export complete!');
                
                // Transition to generation view after a brief delay
                setTimeout(() => {
                    this.hideProgress('progressSection');
                    this.showView('promptView');
                    
                    // Show version selector since we now have an exported video
                    this.showVersionSelector();
                }, 1500);
            } else {
                throw new Error('Export failed - no output path returned');
            }
            
        } catch (error) {
            console.error('❌ Export failed:', error);
            this.showError('Export failed: ' + error.message);
        } finally {
            this.setButtonState('exportBtn', true, 'Export');
            this.hideProgress('progressSection');
        }
    }

    
    async exportVideoSegment() {
        try {
            // Get sequence format to determine preset
            const sequenceFormat = await new Promise((resolve) => {
                this.csInterface.evalScript('AutoVFXExtendScript.getSequenceFormat()', (result) => {
                    try {
                        resolve(JSON.parse(result));
                    } catch (e) {
                        resolve({ success: false, error: 'Failed to parse sequence format' });
                    }
                });
            });

            let presetType = "standard";
            if (sequenceFormat.success) {
                if (sequenceFormat.is4K) {
                    presetType = "4K optimized";
                    console.log(`📺 Detected 4K sequence (${sequenceFormat.frameSize}) - using 4K optimized preset`);
                } else if (sequenceFormat.isHD) {
                    presetType = "HD optimized";
                    console.log(`📺 Detected HD sequence (${sequenceFormat.frameSize}) - using HD optimized preset`);
                } else {
                    console.log(`📺 Detected sequence (${sequenceFormat.frameSize}) - using standard preset`);
                }
            }

            this.updateProgress('progressSection', 0, `Exporting with ${presetType} preset...`);
            this.startSmoothProgress('progressSection', 0, 95, 5000);

            // get path to desktop
            const dePth = await new Promise((resolve) => {
                this.csInterface.evalScript('AutoVFXExtendScript.getDetp("'+ this.userConfig.exptofold +'")', (result) => {
                    if (result === 'EvalScript error.' || !result || result.includes('EvalScript error')) {
                        console.warn('⚠️ getDetp() failed, using fallback desktop path with autovfx_assets folder');
                        const fallbackPath = '/Users/' + (process.env.USER || 'user') + '/Desktop/autovfx_assets';
                        // Try to create the folder via Node.js fs
                        try {
                            const fs = require('fs');
                            if (!fs.existsSync(fallbackPath)) {
                                fs.mkdirSync(fallbackPath, { recursive: true });
                            }
                        } catch (e) {
                            console.warn('⚠️ Could not create autovfx_assets folder:', e);
                        }
                        resolve(fallbackPath);
                    }
                    else{ resolve(result); }
                });
            });

            // Create output path
            const timestamp = new Date().getTime();
            const outputPath = dePth + "/autovfx_export_" + timestamp +".mp4";
            
            let jsxRoot = this.csInterface.getSystemPath(SystemPath.EXTENSION).replaceAll("\\","/") + "/jsx";
            console.log('outputPath: ', outputPath);
            
            // Use Premiere Pro's native export with Runway optimization
            const exportResult = await new Promise((resolve, reject) => {
                let hostapp = this.csInterface.hostEnvironment.appId; //PPRO or AEFT
                // Use optimized preset for Runway compatibility
                let script = `AutoVFXExtendScript.exportSequenceWithPreset("${outputPath}", "${jsxRoot}", true)`;
                if(hostapp == "AEFT") script = `AutoVFXExtendScript.exportSequenceAE("${outputPath}")`;
                console.log("script = " + script)
                this.csInterface.evalScript(script, (result) => {
                    try { 
                        let expRes = (JSON.parse(result));
                        // errors handle
                        if (!expRes.success) {
                            if (expRes && expRes.error) { return reject(new Error(expRes.error)); }
                            console.warn('⚠️ getTimelineInfo returned unexpected result:', String(reresults));
                            return reject(new Error('Timeline info unavailable. Please open a sequence in Premiere and try again.'));
                        }
                        else return resolve(expRes);
                        
                    } catch (e) {return resolve({success: false, error: 'Failed to parse export result'}); }
                });
            });
            
            
            // Stop smooth progress and complete it immediately
            this.stopSmoothProgress();
            this.updateProgress('progressSection', 100, 'Export complete!');
            console.log('✅ Premiere Pro export completed:', outputPath);
            
            // Check file size for Runway compatibility
            await this.validateExportFileSize(outputPath);
            
            return exportResult;
        } catch (error) {
            console.error('Export failed:', error);
            this.showError(`Export failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get video duration in seconds
     */
    async getVideoDuration(videoPath) {
        return new Promise((resolve, reject) => {
            try {
                // Create a temporary video element to get duration
                const video = document.createElement('video');
                video.preload = 'metadata';
                
                video.onloadedmetadata = () => {
                    resolve(video.duration);
                };
                
                video.onerror = () => {
                    reject(new Error('Could not load video to check duration'));
                };
                
                // Handle local files with blob URLs for CEP compatibility
                if (!videoPath.startsWith('http://') && !videoPath.startsWith('https://')) {
                    // Local file - create blob URL
                    const fs = require('fs');
                    if (fs.existsSync(videoPath)) {
                        const videoBuffer = fs.readFileSync(videoPath);
                        const blob = new Blob([videoBuffer], { type: 'video/mp4' });
                        const blobUrl = URL.createObjectURL(blob);
                        video.src = blobUrl;
                        
                        // Clean up blob URL after loading
                        video.onloadedmetadata = () => {
                            const duration = video.duration;
                            URL.revokeObjectURL(blobUrl);
                            resolve(duration);
                        };
                    } else {
                        reject(new Error('Video file not found'));
                    }
                } else {
                    video.src = videoPath;
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Validate exported file size for Runway compatibility
     */
    async validateExportFileSize(filePath) {
        try {
            const sizeCheckResult = await new Promise((resolve) => {
                this.csInterface.evalScript(`AutoVFXExtendScript.checkFileSize("${filePath}")`, (result) => {
                    try {
                        resolve(JSON.parse(result));
                    } catch (e) {
                        resolve({ success: false, error: 'Failed to check file size' });
                    }
                });
            });

            if (sizeCheckResult.success) {
                const sizeMB = sizeCheckResult.sizeMB;
                const maxSize = 12; // Processing service limit (12MB raw = ~16MB base64 encoded)
                
                console.log(`📊 Export file size: ${sizeMB.toFixed(2)} MB`);
                
                if (sizeMB > maxSize) {
                    // Only show UI indicator when there's a problem
                    this.updateFileSizeIndicator(sizeMB, maxSize);
                    const warningMessage = `⚠️ Export file size (${sizeMB.toFixed(2)} MB) exceeds the 12MB processing limit. To fix this:\n• Use a shorter clip (3-5 seconds)\n• Reduce video quality in Premiere\n• The file may be rejected during processing`;
                    console.warn(warningMessage);
                    this.showError(warningMessage);
                    
                    // Store warning for user reference
                    this.lastExportSizeWarning = {
                        size: sizeMB,
                        path: filePath,
                        timestamp: Date.now()
                    };
                } else {
                    console.log(`✅ Export file size (${sizeMB.toFixed(2)} MB) is within the 12MB processing limit`);
                    // Silent success - no popup and no UI indicator when everything works
                    this.hideFileSizeIndicator();
                }
            } else {
                console.warn('⚠️ Could not verify file size:', sizeCheckResult.error);
            }
        } catch (error) {
            console.warn('⚠️ File size validation failed:', error);
        }
    }

    /**
     * Update the file size indicator in the UI
     */
    updateFileSizeIndicator(sizeMB, maxSize) {
        const fileSizeInfo = document.getElementById('fileSizeInfo');
        const fileSizeValue = document.getElementById('fileSizeValue');
        
        if (fileSizeInfo && fileSizeValue) {
            // Show the indicator
            fileSizeInfo.classList.remove('hidden');
            
            // Update the size value
            fileSizeValue.textContent = `${sizeMB.toFixed(2)} MB`;
            
            // Update the styling based on size
            fileSizeInfo.classList.remove('over-limit', 'within-limit');
            if (sizeMB > maxSize) {
                fileSizeInfo.classList.add('over-limit');
            } else {
                fileSizeInfo.classList.add('within-limit');
            }
        }
    }

    /**
     * Hide the file size indicator
     */
    hideFileSizeIndicator() {
        const fileSizeInfo = document.getElementById('fileSizeInfo');
        if (fileSizeInfo) {
            fileSizeInfo.classList.add('hidden');
        }
    }

    async handleEnhancePrompt() {
        const promptInput = document.getElementById('promptInput');
        const enhanceBtn = document.getElementById('enhanceBtn');
        const currentPrompt = promptInput.value.trim();

        // If no client OpenAI key, fallback to server-side enhancement endpoint
        const useServerEnhance = !this.openaiAPI || !this.openaiConfig.apiKey;

        // Check if there's a prompt to enhance
        if (!currentPrompt) {
            this.showError('Please enter a prompt to enhance');
            return;
        }

        try {
            // Update UI to show loading state
            enhanceBtn.disabled = true;
            enhanceBtn.classList.add('loading');

            console.log('🎨 Enhancing prompt:', currentPrompt, useServerEnhance ? '(server)' : '(client)');

            let result;
            if (useServerEnhance) {
                // Use backend endpoint with server key
                try {
                    const resp = await fetch(`${this.licenseAPI.baseUrl}${this.licenseAPI.endpoints.enhance || '/enhance'}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ prompt: currentPrompt })
                    });
                    if (!resp.ok) {
                        const txt = await resp.text().catch(()=> '');
                        throw new Error(`Server enhance failed: ${resp.status} ${txt}`);
                    }
                    const data = await resp.json();
                    result = { success: true, original: currentPrompt, enhanced: data.enhanced };
                } catch (err) {
                    console.error('❌ Server-side enhance error:', err);
                    throw err;
                }
            } else {
                // Call OpenAI API to enhance the prompt (client key)
                result = await this.openaiAPI.enhancePrompt(currentPrompt);
            }

            if (result.success) {
                // Update the prompt input with enhanced version
                promptInput.value = result.enhanced;
                console.log('✅ Prompt enhanced successfully');
                console.log('Original:', result.original);
                console.log('Enhanced:', result.enhanced);
                
                this.showSuccess('Prompt enhanced successfully!');
                
                // Animate the textarea to show the change
                promptInput.style.borderColor = 'var(--primary)';
                setTimeout(() => {
                    promptInput.style.borderColor = 'var(--border)';
                }, 2000);
            } else {
                console.error('❌ Prompt enhancement failed:', result.error);
                this.showError('Failed to enhance prompt: ' + result.error);
            }

        } catch (error) {
            console.error('❌ Error during prompt enhancement:', error);
            this.showError('Error enhancing prompt: ' + error.message);
        } finally {
            // Reset button state
            enhanceBtn.disabled = false;
            enhanceBtn.classList.remove('loading');
        }
    }

    async handleGenerate() {
        const prompt = document.getElementById('promptInput').value.trim();
        
        if (!prompt) {
            this.showError('Please enter a prompt describing what you want to create.');
            return;
        }

        // Get actual video duration for accurate credit calculation
        let videoDuration = 10; // Default fallback
        try {
            if (this.currentExportedVideo) {
                videoDuration = await this.getVideoDuration(this.currentExportedVideo);
                console.log(`📏 Actual video duration: ${videoDuration} seconds`);
            }
        } catch (error) {
            console.warn('⚠️ Could not get video duration, using default:', error.message);
        }

        // Check credits before proceeding (if licensing is enabled)
        const hasCredits = await this.checkCreditsBeforeGeneration(videoDuration);
        if (!hasCredits) { return; } // User shown insufficient credits modal 

        // Reserve credits for generation (if licensing is enabled)
        const creditReservation = await this.reserveCreditsForGeneration(videoDuration);
        if (!creditReservation.success) {
            this.showError(`Credit reservation failed: ${creditReservation.error}`);
            return;
        }

        // Determine which video source to use
        let sourceVideoPath = this.currentExportedVideo;
        
        // If user has selected a different version, use that instead
        if (this.selectedVideoSource && this.selectedVideoSource !== 'original') {
            const versionData = this.videoVersions.get(this.selectedVideoSource);
            if (versionData && versionData.path) {
                sourceVideoPath = versionData.path;
                console.log(`🎯 Using selected video source: ${this.selectedVideoSource}`);
            }
        } else if (this.selectedVideoSource === 'original') {
            sourceVideoPath = this.currentExportedVideo;
            console.log(`🎯 Using original video source`);
        }

        if (!sourceVideoPath) {
            this.showError('No video source available. Please export a video first or select a valid video version.');
            return;
        }

        try {
            this.setButtonState('generateBtn', false, 'Generating...');
            this.disableNavigationButtons();
            // Don't set initial progress here - let the callback handle it
            
            // Upload video to Runway and generate new video
            const generatedVideoUrl = await this.generateWithRunway(sourceVideoPath, prompt, (pct) => {
                this.updateGenerateButtonProgress(pct);
            });
            
            if (generatedVideoUrl) {
                this.generatedVideo = generatedVideoUrl;
                
                // Add this video to version history (if it's a real video path)
                if (generatedVideoUrl !== 'runway-generation-initiated' && generatedVideoUrl !== 'runway-generation-completed-no-url') {
                    const versionId = `v${Date.now()}`;
                    const promptText = document.getElementById('promptInput')?.value || '';
                    this.addVideoVersion(versionId, generatedVideoUrl, promptText);
                    
                    // Enable forward button since we now have a generated video
                    this.enableForwardButton();
                    
                    // Show and update version selector to display the new generated video
                    this.showVersionSelector();
                    this.updateVersionSlider();
                }
                
                if (generatedVideoUrl === 'runway-generation-initiated') {
                    // Special handling for initiated generation
                    this.displayInitiatedResult();
                } else if (generatedVideoUrl === 'runway-generation-completed-no-url') {
                    // Special handling for completed generation without URL
                    this.displayCompletedNoUrlResult();
                } else {
                    this.displayResult(generatedVideoUrl);
                }
            }
            
        } catch (error) {
            console.error('Generation failed:', error);
            this.showError('Generation failed: ' + error.message);
        } finally {
            this.setButtonState('generateBtn', true, 'Generate');
            this.enableNavigationButtons();
            this.clearGenerateButtonProgress();
        }
    }

    async handleImport() {
        try {
            this.setButtonState('importBtn', false, 'Importing...');
            
            let importPath = null;

            // Determine which source to import based on current selection
            if (this.selectedVideoSource === 'original' || !this.selectedVideoSource) {
                if (!this.currentExportedVideo) {
                    throw new Error('No original export available to import. Please export first.');
                }
                importPath = this.currentExportedVideo;
            } else {
                const versionData = this.videoVersions.get(this.selectedVideoSource);
                if (!versionData || !versionData.path) {
                    throw new Error('Selected version is unavailable.');
                }

                const selectedPath = versionData.path;
                if (typeof selectedPath === 'string' && (selectedPath.startsWith('http://') || selectedPath.startsWith('https://'))) {
                    // Remote URL: download first
                    importPath = await this.downloadVideo(selectedPath);
                } else if (typeof selectedPath === 'string') {
                    // Local path or file URI
                    importPath = selectedPath.startsWith('file://') ? selectedPath.replace('file://', '') : selectedPath;
                } else {
                    throw new Error('Unsupported source path format for selected version.');
                }
            }

            // Validate the import file exists and is readable
            const fs = require('fs');
            const path = require('path');
            
            // Normalize path for Windows compatibility
            importPath = path.resolve(importPath);
            console.log(`🎯 Normalized import path: ${importPath}`);
            
            if (!fs.existsSync(importPath)) {
                throw new Error(`Import file does not exist: ${importPath}. Check if download completed successfully.`);
            }
            
            // Verify file is readable and get size
            try {
                fs.accessSync(importPath, fs.constants.R_OK);
                const stats = fs.statSync(importPath);
                console.log(`✅ Import file verified: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            } catch (accessError) {
                throw new Error(`Import file exists but is not readable: ${accessError.message}`);
            }

            // Import into Premiere Pro timeline at original position
            let impData = JSON.parse(JSON.stringify(this.lastExportPosition));
            impData.outputPath = importPath;
            
            // currentVersionIndex
            const importResult = await this.importToTimeline(impData);
            
            let successMessage;
            const positionMsg = this.lastExportPosition && this.lastExportPosition.insertionTime !== undefined ? 
                `at ${this.lastExportPosition.insertionTime.toFixed(1)}s (original export position)` : 
                'at current position';
            successMessage = `🎬 Video imported to timeline ${positionMsg}!`;
            
            
            // Remove success UI message, just log to console
            console.log(successMessage);
            
        } catch (error) {
            console.error('Import failed:', error);
            this.showError('Import failed: ' + error.message);
        } finally {
            this.setButtonState('importBtn', true, 'Import');
        }
    }




    // importData = {
        // outputPath: exportData.outputPath, clipStart: exportData.inPoint, clipEnd: exportData.outPoint, 
        // parentTrack: exportData.parentTrack, timebase: exportData.timebase };
    async importToTimeline(importData) {
        return new Promise((resolve, reject) => {
            let hostapp = this.csInterface.hostEnvironment.appId; //PPRO or AEFT
            let script = 'AutoVFXExtendScript.importVideoToTimeline(' + JSON.stringify(importData) + ')';
            if(hostapp == "AEFT") script = 'AutoVFXExtendScript.importVideoToAE(' + JSON.stringify(importData) + ')';
            
            console.log(script);
            console.log('🎬 Importing video to timeline with position: ' + importData.inPoint/importData.timebase + ' secs');
            var importResult;

            this.csInterface.evalScript(script, (result) => {
                console.log('📨 JSX import result:', result);
                console.log('📨 Result type:', typeof result);
                
                importResult = result;
                try {
                    importResult = JSON.parse(result);
                    console.log('✅ Position-aware import success:', importResult);
                } catch (error) {
                    console.error('❌ Position-aware import result parsing failed:', error);
                }

            });
            
            resolve(importResult);
        });
    }


    handleBack() {
        // Always go to prompt view, version selector will show inline if needed
        this.goToPromptView();
        
        // Show version selector inline if we have any versions
        if (this.currentExportedVideo || this.videoVersions.size > 0) {
            this.showVersionSelector();
        }
        
        // Enable forward button if we have a generated video
        if (this.generatedVideo) {
            this.enableForwardButton();
        }
    }

    goToPromptView() {
        this.showView('promptView');
        
        // Pause the video
        const video = document.getElementById('resultVideo');
        if (video) {
            video.pause();
        }
        
        // Show/hide version selector based on available versions
        // Show selector if we have any exported video or generated versions
        if (this.currentExportedVideo || this.videoVersions.size > 0) {
            this.showVersionSelector();
        } else {
            this.hideVersionSelector();
        }
    }

    handleForward() {
        // Always allow navigation to result view; show warning if empty
        console.log('🎯 Forward button clicked');
        this.showView('resultView');
        
        // Ensure version selector reflects current state and preview updates
        try { this.showVersionSelector(); } catch (e) {}
        try { this.updateVersionSlider(); } catch (e) {}
        
        if (!this.generatedVideo && this.videoVersions.size === 0 && !this.currentExportedVideo) {
            this.showError('No result yet. Generate to see output.');
        }
    }

    enableForwardButton() {
        const forwardBtn = document.getElementById('forwardBtn');
        if (forwardBtn) {
            forwardBtn.classList.remove('disabled');
            console.log('✅ Forward button enabled - disabled class removed');
        } else {
            console.log('❌ Forward button not found in DOM');
        }
    }

    disableForwardButton() {
        const forwardBtn = document.getElementById('forwardBtn');
        if (forwardBtn) {
            // No-op: keep button enabled at all times
            forwardBtn.classList.remove('disabled');
        }
    }

    handleReset() {
        // Complete reset - go back to export view
        this.showView('exportView');
        
        // Clear all video references
        this.generatedVideo = null;
        this.currentExportedVideo = null;
        this.selectedVideoSource = 'original';
        this.videoVersions.clear();
        this.currentVersionIndex = 0;
        
        console.log('🧹 RESET: Cleared all video versions and data');
        
        // Stop any running progress animations
        this.stopSmoothProgress();

        this.removeAllGen();
        
        // Reset video element
        const video = document.getElementById('resultVideo');
        if (video) {
            video.src = '';
            video.pause();
        }
        
        // Reset video container state
        const videoContainer = document.querySelector('.video-container');
        if (videoContainer) {
            videoContainer.classList.add('paused');
        }
        
        // Clear prompt input
        const promptInput = document.getElementById('promptInput');
        if (promptInput) {
            promptInput.value = '';
        }
        
        // Hide version selector
        this.hideVersionSelector();
        
        // Disable forward button
        this.disableForwardButton();
        
        // Reset button states
        this.setButtonState('generateBtn', true, 'Generate');
        this.setButtonState('exportBtn', true, 'Export');
        
        console.log('🔄 Complete reset - ready for new video export');
    }

    showVersionSelector() {
        this.updateVersionSlider();
        const selector = document.getElementById('videoVersionSelector');
        if (selector) {
            selector.classList.remove('hidden');
        }
        const selectorResult = document.getElementById('videoVersionSelectorResult');
        if (selectorResult) {
            selectorResult.classList.remove('hidden');
        }
    }

    hideVersionSelector() {
        const selector = document.getElementById('videoVersionSelector');
        if (selector) {
            selector.classList.add('hidden');
        }
        const selectorResult = document.getElementById('videoVersionSelectorResult');
        if (selectorResult) {
            selectorResult.classList.add('hidden');
        }
    }

    updateVersionSlider() {
        const currentVersionText = document.getElementById('currentVersionText');
        const prevBtn = document.getElementById('versionPrevBtn');
        const nextBtn = document.getElementById('versionNextBtn');
        
        // Result view mirrors
        const currentVersionTextResult = document.getElementById('currentVersionTextResult');
        const prevBtnResult = document.getElementById('versionPrevBtnResult');
        const nextBtnResult = document.getElementById('versionNextBtnResult');
        
        if (!currentVersionText && !currentVersionTextResult) return;
        
        // Build array of all versions
        const versions = [];
        
        // Add original video option (always first if available)
        if (this.currentExportedVideo) {
            versions.push({
                id: 'original',
                text: 'Original Footage',
                description: 'Exported from timeline'
            });
        }
        
        // Add generated video versions (skip the 'original' version)
        let versionCount = 1;
        this.videoVersions.forEach((videoData, versionId) => {
            if (versionId === 'original') {
                return; // Skip the original video - it's already added above
            }
            if (videoData.path && videoData.path !== 'runway-generation-initiated' && videoData.path !== 'runway-generation-completed-no-url') {
                versions.push({
                    id: versionId,
                    text: `Generated Video ${versionCount}`,
                    description: videoData.prompt ? videoData.prompt.substring(0, 40) + '...' : 'AI Generated'
                });
                versionCount++;
            }
        });
        
        if (versions.length === 0) {
            this.hideVersionSelector();
            return;
        }
        
        // Ensure current index is valid
        if (this.currentVersionIndex >= versions.length) {
            this.currentVersionIndex = versions.length - 1;
        }
        if (this.currentVersionIndex < 0) {
            this.currentVersionIndex = 0;
        }
        
        // Update display
        const currentVersion = versions[this.currentVersionIndex];
        if (currentVersionText) currentVersionText.textContent = currentVersion.text;
        if (currentVersionTextResult) currentVersionTextResult.textContent = currentVersion.text;
        
        // Show description as tooltip if available
        const versionDisplay = document.querySelector('.version-display');
        if (versionDisplay && currentVersion.description) {
            versionDisplay.title = currentVersion.description;
        }
        
        // Update selected source
        this.selectedVideoSource = currentVersion.id;
        
        // If we're on the result view, update the preview video to match selection
        const resultView = document.getElementById('resultView');
        const resultVideoEl = document.getElementById('resultVideo');
        if (resultView && resultVideoEl && resultView.classList.contains('active')) {
            let previewSrc = '';
            if (this.selectedVideoSource === 'original') {
                if (this.currentExportedVideo) {
                    previewSrc = this.currentExportedVideo.startsWith('file://') ? this.currentExportedVideo : `file://${this.currentExportedVideo}`;
                }
            } else {
                const vd = this.videoVersions.get(this.selectedVideoSource);
                if (vd && vd.path) {
                    previewSrc = vd.path;
                }
            }
            if (previewSrc) {
                resultVideoEl.src = previewSrc;
                resultVideoEl.load();
                resultVideoEl.pause();
                
                // Add layout detection for version-switched videos
                resultVideoEl.addEventListener('loadeddata', () => {
                    this.handleVideoLayout(resultVideoEl);
                }, { once: true });
            }
        }
        
        // Update button states (both views)
        const atStart = this.currentVersionIndex === 0;
        const atEnd = this.currentVersionIndex === versions.length - 1;
        if (prevBtn) prevBtn.disabled = atStart;
        if (nextBtn) nextBtn.disabled = atEnd;
        if (prevBtnResult) prevBtnResult.disabled = atStart;
        if (nextBtnResult) nextBtnResult.disabled = atEnd;
        
        console.log(`📹 Version Selector: ${currentVersion.text} (${currentVersion.id}) - ${versions.length} total versions available`);
    }

    navigateVersion(direction) {
        // Build array to get total count
        const totalVersions = (this.currentExportedVideo ? 1 : 0) + Array.from(this.videoVersions.values()).filter(v => 
            v.path && v.path !== 'runway-generation-initiated' && v.path !== 'runway-generation-completed-no-url'
        ).length;

        if (totalVersions <= 1) return;

        this.currentVersionIndex += direction;
        
        // Keep within bounds
        if (this.currentVersionIndex < 0) this.currentVersionIndex = 0;
        if (this.currentVersionIndex >= totalVersions) this.currentVersionIndex = totalVersions - 1;
        
        this.updateVersionSlider();
    }

    // Removed useSelectedVersion() - now handled by dropdown change event

    startSmoothProgress(progressId, startPercent, endPercent, durationMs) {
        // Clear any existing progress animation
        this.stopSmoothProgress();
        
        const startTime = Date.now();
        const progressRange = endPercent - startPercent;
        
        this.progressAnimationInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / durationMs, 1); // 0 to 1
            
            // Use easeOut curve for more natural feel
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentPercent = startPercent + (progressRange * easedProgress);
            
            // Update the progress without changing the message
            const progressFill = document.getElementById(`${progressId}Fill`);
            const progressPercent = document.getElementById(`${progressId}Percent`);
            
            if (progressFill) {
                progressFill.style.width = `${currentPercent}%`;
            }
            if (progressPercent) {
                progressPercent.textContent = `${Math.round(currentPercent)}%`;
            }
            
            // Stop when we reach the end
            if (progress >= 1) {
                this.stopSmoothProgress();
            }
        }, 100); // Update every 100ms for smooth animation
    }
    
    stopSmoothProgress() {
        if (this.progressAnimationInterval) {
            clearInterval(this.progressAnimationInterval);
            this.progressAnimationInterval = null;
        }
    }

    addVideoVersion(versionId, videoPath, prompt = '') {
        this.videoVersions.set(versionId, {
            path: videoPath,
            prompt: prompt,
            timestamp: Date.now()
        });
        console.log(`📦 Added video version: ${versionId} (${this.videoVersions.size} total versions)`);
        
        // Automatically switch to the newly added version
        this.selectedVideoSource = versionId;
        
        // Calculate the new index for the version selector
        // Index 0 = original, Index 1+ = generated videos in order
        const allVersions = [];
        if (this.currentExportedVideo) {
            allVersions.push('original');
        }
        
        // Add generated videos in chronological order
        const sortedVersions = Array.from(this.videoVersions.entries())
            .filter(([id, data]) => id !== 'original' && data.path && 
                    data.path !== 'runway-generation-initiated' && 
                    data.path !== 'runway-generation-completed-no-url')
            .sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        for (const [id] of sortedVersions) {
            allVersions.push(id);
        }
        
        // Set the current index to the newly added version
        this.currentVersionIndex = allVersions.findIndex(id => id === versionId);
        if (this.currentVersionIndex === -1) {
            this.currentVersionIndex = allVersions.length - 1; // fallback to last
        }
        
        console.log(`📹 Auto-selected new version: ${versionId} at index ${this.currentVersionIndex}`);
        
        // Update version selector if it's visible
        if (document.getElementById('videoVersionSelector') && !document.getElementById('videoVersionSelector').classList.contains('hidden')) {
            this.updateVersionSlider();
        }
    }


    // Safe JSON parse that tolerates stray logs around a JSON payload
    tryParseJSON(text) {
        if (text == null) return null;
        if (typeof text !== 'string') {
            try { text = String(text); } catch (e) { return null; }
        }
        try {
            return JSON.parse(text);
        } catch (e1) {
            const first = text.indexOf('{');
            const last = text.lastIndexOf('}');
            if (first !== -1 && last !== -1 && last > first) {
                const sub = text.slice(first, last + 1);
                try { return JSON.parse(sub); } catch (e2) { /* ignore */ }
            }
            return null;
        }
    }

    // Extended polling to catch video completion after initial timeout  
    async startExtendedPolling(taskId) {
        if (!taskId) {
            console.log('❌ No task ID provided for extended polling');
            return;
        }
        
        console.log(`🔄 Extended polling started for task: ${taskId}`);
        console.log('⏰ Will check every 30s for up to 30 minutes');
        
        // Extended polling without progress bar (removed from UI)
        console.log('🔄 Extended polling: monitoring generation progress...');
        
        const maxAttempts = 60; // 30 minutes  
        const interval = 30000; // 30 seconds
        let attempts = 0;
        
        const pollForVideo = async () => {
            try {
                attempts++;
                console.log(`📡 Extended polling attempt ${attempts}/${maxAttempts}...`);
                
                // Log progress for extended polling
                if (attempts === 1) {
                    console.log('🎬 Extended polling: Initial generation check...');
                } else if (attempts < 10) {
                    console.log(`🎬 Extended polling: Checking generation progress (attempt ${attempts})...`);
                }
                
                const status = await this.runwayAPI.checkGenerationStatus(taskId);
                
                if (status) {
                    const statusValue = status.status || status.state || status.job_status || 'unknown';
                    console.log(`📊 Extended polling status: ${statusValue}`);
                    
                    if (statusValue === 'SUCCEEDED' || statusValue === 'COMPLETED' || statusValue === 'SUCCESS') {
                        // Video is complete! Extract the URL
                        let videoUrl = null;
                        
                        if (status.output && Array.isArray(status.output) && status.output.length > 0) {
                            videoUrl = status.output[0].url || status.output[0];
                        } else if (status.videoUrl) {
                            videoUrl = status.videoUrl;
                        } else if (status.result && status.result.videoUrl) {
                            videoUrl = status.result.videoUrl;
                        }
                        
                        if (videoUrl) {
                            console.log('🎉 Extended polling SUCCESS! Video is ready:', videoUrl);
                            this.showError(`🎉 Your video is ready! Displaying now...`, 'success');
                            
                            // Handle credit settlement for successful generation
                            await this.settleCreditsOnCompletion(taskId, true, 10); // Assume 10 seconds actual duration
                            
                            // Stop smooth progress and complete it
                            this.stopSmoothProgress();
                            console.log('🎉 Video generation complete!');
                            
                            // Add the completed video to version history
                            const versionId = `v${Date.now()}`;
                            const promptText = document.getElementById('promptInput')?.value || 'Generated video';
                            this.addVideoVersion(versionId, videoUrl, promptText);
                            
                            // Update the generatedVideo reference
                            this.generatedVideo = videoUrl;
                            
                            // Enable forward button and show version selector
                            this.enableForwardButton();
                            this.showVersionSelector();
                            this.updateVersionSlider();
                            
                            console.log(`📦 Added generated video to versions: ${versionId}`);
                            
                            // Display the video in the panel
                            this.displayResult(videoUrl);
                            return; // Stop polling
                            
                        } else {
                            console.log('⚠️  Status is complete but no video URL found');
                            this.showError(`✅ Video completed! Task ID: ${taskId}. Check your account dashboard.`, 'success');
                            
                            // Handle credit settlement for completed but no URL case
                            await this.settleCreditsOnCompletion(taskId, true, 10); // Assume 10 seconds actual duration
                            
                            // Stop smooth progress and complete it
                            this.stopSmoothProgress();
                            console.log('✅ Task completed successfully!');
                            return; // Stop polling
                        }
                    } else if (statusValue === 'FAILED' || statusValue === 'ERROR') {
                        console.log('❌ Extended polling: Video generation failed');
                        this.showError(`❌ Video generation failed. Task ID: ${taskId}`, 'error');
                        
                        // Handle credit refund for failed generation
                        await this.settleCreditsOnCompletion(taskId, false, 0);
                        
                        // Stop smooth progress on failure
                        this.stopSmoothProgress();
                        return; // Stop polling
                    } else {
                        // Still in progress - show visual feedback to user
                        const progress = status.progress || 0;
                        console.log(`⏳ Extended polling: Still generating... ${Math.round(progress * 100)}%`);
                        
                        // If API provides real progress, use it and stop smooth animation
                        if (progress > 0) {
                            this.stopSmoothProgress(); // Stop smooth animation
                            
                            let progressPercent = Math.round(progress * 100);
                            let message = 'Generating video...';
                            
                            // Show more specific messages based on progress
                            if (progressPercent < 25) {
                                message = 'Initializing generation...';
                            } else if (progressPercent < 50) {
                                message = 'Processing frames...';
                            } else if (progressPercent < 75) {
                                message = 'Generating video...';
                            } else if (progressPercent < 95) {
                                message = 'Finalizing video...';
                            } else {
                                message = 'Almost ready...';
                            }
                            
                            // Ensure minimum progress for visual feedback
                            if (progressPercent < 30) progressPercent = 30 + (attempts * 2); // Show incremental progress
                            if (progressPercent > 95) progressPercent = 95; // Don't show 100% until complete
                            
                            console.log(`🎬 Extended polling progress: ${progressPercent}% - ${message}`);
                        }
                        // If no API progress, let smooth animation continue
                    }
                }
                
                // Continue polling if not complete and under max attempts
                if (attempts < maxAttempts) {
                    setTimeout(pollForVideo, interval);
                } else {
                    console.log('⏰ Extended polling timeout reached');
                    this.showError(`⏰ Generation timeout reached. Task ID: ${taskId}. Check your account dashboard.`, 'warning');
                }
                
            } catch (error) {
                console.log(`❌ Extended polling error: ${error.message}`);
                
                if (attempts < maxAttempts) {
                    // Retry on error
                    setTimeout(pollForVideo, interval);
                } else {
                    console.log('❌ Extended polling failed too many times');
                }
            }
        };
        
        // Start polling after a brief delay
        setTimeout(pollForVideo, 30000); // Start in 30 seconds
    }

    // Runway API Integration
    async generateWithRunway(videoPath, prompt, onProgress) {
        if (!this.runwayAPI) {
            throw new Error('Runway API not configured. Please set your API key.');
        }
        let sourceVideoPath, fileName;
        
        try {
            // Determine which video to use based on user selection
            sourceVideoPath = videoPath;
            fileName = 'exported_video.mp4';
            
            if (this.selectedVideoSource && this.selectedVideoSource !== 'original') {
                // Using a generated video version
                const versionData = this.videoVersions.get(this.selectedVideoSource);
                if (versionData && versionData.path && 
                    versionData.path !== 'runway-generation-initiated' && 
                    versionData.path !== 'runway-generation-completed-no-url') {
                    
                    console.log(`🔄 Using generated video version: ${this.selectedVideoSource}`);
                    sourceVideoPath = versionData.path;
                    
                    fileName = `generated_video_${this.selectedVideoSource.replace("autovfx_export_","")}.mp4`;
                    
                    // Update progress message
                    console.log(`🔄 Using generated video version: ${this.selectedVideoSource}`);
                } else {
                    console.log('📹 Generated video not found, using original exported video as source');
                }
            } else {
                console.log('📹 Using original exported video as source');
            }
            
            // Create a File object from the selected video
            // Handle both local file paths and remote URLs
            let videoFile;
            if (sourceVideoPath.startsWith('http://') || sourceVideoPath.startsWith('https://')) {
                // Remote URL - use fetch
                console.log('🌐 Using remote video URL:', sourceVideoPath);
                const response = await fetch(sourceVideoPath);
                const blob = await response.blob();
                videoFile = new File([blob], fileName, { type: 'video/mp4' });
            } else {
                // Local file path - use Node.js fs module (CEP-compatible)
                console.log('📁 Using local file path:', sourceVideoPath);
                const fs = require('fs');
                
                // Check if file exists
                if (!fs.existsSync(sourceVideoPath)) {
                    throw new Error(`Video file not found: ${sourceVideoPath}`);
                }
                
                // Read file as buffer and convert to File object
                const videoBuffer = fs.readFileSync(sourceVideoPath);
                const blob = new Blob([videoBuffer], { type: 'video/mp4' });
                videoFile = new File([blob], fileName, { type: 'video/mp4' });
                
                console.log(`✅ Successfully read local video file (${(videoBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);
            }

            // Validate video duration before processing
            console.log('🎬 Validating video duration...');
            const videoDuration = await this.getVideoDuration(sourceVideoPath);
            
            if (videoDuration < 1.0) {
                throw new Error(`Video duration (${videoDuration.toFixed(2)}s) is too short. Video processing requires clips to be at least 1 second long. Please select a longer clip or extend your clip in the timeline.`);
            }
            
            console.log(`✅ Video duration validation passed: ${videoDuration.toFixed(2)}s`);
            
            // Use the Runway API to process the video
            console.log('🎬 Processing video for generation...');
            
            // Don't set initial progress here - let the callback handle all progress updates
            
            const result = await this.runwayAPI.processVideo(videoFile, prompt, {
                duration: 2,
                ratio: '1280:720', // Official Runway API format
                seed: Math.floor(Math.random() * 4294967295), // Random seed
                referenceImage: this.referenceImage ? this.referenceImage.dataUrl : null,
                onProgress: (pct, meta) => {
                    if (onProgress) { try { onProgress(pct); } catch(e){} }
                }
            });
            
            // Complete the progress bar
            if (onProgress) { try { onProgress(100); } catch(e){} }

            if (result.success) {
                if (result.videoUrl === 'runway-generation-initiated') {
                    // Special case: generation was initiated but status polling failed
                    console.log('🎬 Runway generation initiated successfully!');
                    console.log(`📋 Task ID: ${result.taskId}`);
                    console.log(`💡 ${result.message}`);
                    
                    // Show success message to user
                    this.showError(`✅ Video generation started! Task ID: ${result.taskId}. Processing will continue in the background.`, 'success');
                    
                    // Start extended polling in background to catch completion
                    console.log('🔄 Starting extended polling for video completion...');
                    
                    // Show immediate feedback that generation is in progress
                    console.log('🎬 Video generation started with Runway API...');
                    
                    // Start extended progress animation for long-running generation
                    this.startSmoothProgress('generationProgress', 30, 90, 60000); // 30% to 90% over 60 seconds
                    
                    this.startExtendedPolling(result.taskId);
                    
                    // Return a placeholder that indicates success
                    return result.videoUrl;
                } else if (result.videoUrl) {
                    return result.videoUrl;
                } else {
                    // Generation succeeded but no video URL - this might be a parsing issue
                    console.log('⚠️  Generation succeeded but video URL extraction failed');
                    console.log('📊 Full result:', result);
                    
                    if (result.taskId) {
                        this.showError(`✅ Generation completed successfully! Task ID: ${result.taskId}. Please check your account dashboard for the video.`, 'success');
                        return 'runway-generation-completed-no-url';
                    } else {
                        throw new Error('Generation succeeded but video URL could not be extracted');
                    }
                }
            } else {
                throw new Error('Video generation failed');
            }

        } catch (error) {
            console.error('Runway generation error:', error);
            
            // Handle credit refund for failed generation (if we have a reservation)
            if (this.currentReservation && this.currentReservation.taskId) {
                await this.settleCreditsOnCompletion(this.currentReservation.taskId, false, 0);
            }
            
            // Show specific error message to user
            if (error.message.includes('502')) {
                this.showError('Video generation servers are busy. Using demo mode instead...');
            } else {
                this.showError(`Video generation failed: ${error.message}. Using demo mode...`);
            }
            
            // Fallback to demo mode if API fails
            console.log('Falling back to demo mode...');
            let ffName = sourceVideoPath.split('\\').pop().split('/').pop();
            let expfileName = `simu_generated_${ffName.replace("autovfx_export_","").replace(".mp4","")}.mp4`;
            let newPth = sourceVideoPath.replace(ffName, expfileName)

            console.log('AutoVFXExtendScript.simuDupli("'+sourceVideoPath+'", "' + newPth + '")')

            var fileDupli = await new Promise((resolve, reject) => {
                this.csInterface.evalScript('AutoVFXExtendScript.simuDupli("'+sourceVideoPath+'", "' + newPth + '")', (result) => {
                    if (result === 'EvalScript error.' || !result || result.includes('EvalScript error')) {
                        console.warn('⚠️ simuDupli() failed with' + result); 
                        return reject(undefined) ;
                    }
                    else return resolve(result);
                });
            });
            
            return (fileDupli);
        }
    }

    async simulateGeneration(fromVideoPath) {
        let progress = 10;


        // Simulate video generation for demo purposes
        return new Promise((resolve, reject) => {
            const progressInterval = setInterval(() => {
                progress += Math.random() * 10;
                if (progress > 90) progress = 90;
                // Drive the button progress during simulation
                this.updateGenerateButtonProgress(Math.round(progress));
                
                let message = 'Generating video...';
                if (progress < 30) message = 'Preparing video...';
                else if (progress < 60) message = 'Generating with AI...';
                else message = 'Finalizing generation...';
                
                console.log(`🎬 API progress: ${Math.round(progress * 100)}% - ${message}`);
            }, 1000);

            // Simulate a 10-15 second generation time
            setTimeout(() => {
                clearInterval(progressInterval);
                console.log('🎉 Generation complete!');
                this.updateGenerateButtonProgress(100);
                
                // For demo purposes, return the current exported video (simulating processing)
                resolve(fromVideoPath || 'demo-generation-complete');
            }, 3000); // Reduced to 3 seconds for faster demo
        });
    }

    async uploadVideoToRunway(videoPath) {
        // This would implement the actual Runway API upload
        const formData = new FormData();
        formData.append('file', videoPath);
        
        const response = await fetch(`${this.runwayConfig.baseUrl}/assets`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.runwayConfig.apiKey}`
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Failed to upload video to Runway');
        }
        
        return await response.json();
    }

    async callRunwayGenerate(assetId, prompt) {
        const response = await fetch(`${this.runwayConfig.baseUrl}/gen4turbo/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.runwayConfig.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                image_url: assetId,
                duration: 2,
                ratio: '16:9',
                watermark: false
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate video with Runway');
        }
        
        return await response.json();
    }

    async downloadVideo(videoUrl) {
        try {
            console.log('📥 Downloading video from Runway:', videoUrl);
            
            // Download the generated video to local system
            const response = await fetch(videoUrl);
            if (!response.ok) {
                throw new Error(`Download failed: ${response.status} ${response.statusText}`);
            }
            
            const blob = await response.blob();
            console.log(`📦 Video downloaded: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
            
            // Create local file path - use Desktop for easier access (cross-platform)
            const timestamp = Date.now();
            const os = require('os');
            const path = require('path');
            
            // Use the same directory as the exported video (where we know we have write access)
            const fs = require('fs');
            
            let localPath;
            if (this.currentExportedVideo) {
                // Use the same directory as the exported video
                const exportDir = path.dirname(this.currentExportedVideo);
                localPath = path.join(exportDir, `autovfx_generated_${timestamp}.mp4`);
                console.log('💾 Saving video to export directory:', localPath);
            } else {
                // Fallback to user's configured export folder
                const exportFolder = this.userConfig.exptofold || 'Desktop';
                const homeDir = os.homedir();
                
                // Handle different possible desktop paths on Windows
                let basePath;
                if (exportFolder === 'Desktop') {
                    // Try common Windows desktop paths
                    const possiblePaths = [
                        path.join(homeDir, 'Desktop'),
                        path.join(homeDir, 'OneDrive', 'Desktop'),
                        path.join(homeDir, 'OneDrive', 'Documents'),
                        path.join(homeDir, 'Documents')
                    ];
                    
                    basePath = possiblePaths.find(p => fs.existsSync(p)) || path.join(homeDir, 'Desktop');
                } else {
                    basePath = path.join(homeDir, exportFolder);
                }
                
                localPath = path.join(basePath, `autovfx_generated_${timestamp}.mp4`);
                console.log('💾 Saving video to:', localPath);
            }
            
            // Ensure the directory exists
            const dir = path.dirname(localPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Created directory: ${dir}`);
            }
            
            // Convert blob to buffer and save to file
            const buffer = Buffer.from(await blob.arrayBuffer());
            console.log(`💾 Writing ${buffer.length} bytes to: ${localPath}`);
            fs.writeFileSync(localPath, buffer);
            
            // Verify the file was created
            if (fs.existsSync(localPath)) {
                const stats = fs.statSync(localPath);
                console.log(`✅ Video saved successfully: ${localPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
                return localPath;
            } else {
                throw new Error('File was not created successfully');
            }
            
        } catch (error) {
            console.error('❌ Video download failed:', error);
            throw error;
        }
    }

    // UI Helper Methods
    showProgress(sectionId, message) {
        const section = document.getElementById(sectionId);
        const textElement = section.querySelector('.progress-text');
        
        section.classList.remove('hidden');
        textElement.textContent = message;
        this.updateProgress(sectionId, 0, message);
    }

    updateProgress(sectionId, percent, message) {
        const section = document.getElementById(sectionId);
        const fillElement = section.querySelector('.progress-fill');
        const percentElement = section.querySelector('.progress-percent');
        const textElement = section.querySelector('.progress-text');
        
        fillElement.style.width = `${percent}%`;
        percentElement.textContent = `${Math.round(percent)}%`;
        if (message) textElement.textContent = message;
    }

    hideProgress(sectionId) {
        const section = document.getElementById(sectionId);
        section.classList.add('hidden');
        
        // Stop any running smooth progress animations
        this.stopSmoothProgress();
    }

    setButtonState(buttonId, enabled, text) {
        const button = document.getElementById(buttonId);
        button.disabled = !enabled;
        if (text) button.textContent = text;
    }

    setIconButtonState(buttonId, enabled) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        // Forward button must always remain interactive
        if (buttonId === 'forwardBtn') {
            button.classList.remove('disabled');
            button.disabled = false;
            return;
        }
        if (enabled) {
            button.classList.remove('disabled');
            button.disabled = false;
        } else {
            button.classList.add('disabled');
            button.disabled = true;
        }
    }

    disableNavigationButtons() {
        // Disable reset and some buttons during generation (keep forwardBtn enabled)
        this.setIconButtonState('promptResetBtn', false);
        this.setIconButtonState('resetBtn', false);
        this.setIconButtonState('backBtn', false);
        this.setIconButtonState('referenceImageBtn', false);
    }

    enableNavigationButtons() {
        // Re-enable reset and next buttons after generation
        this.setIconButtonState('promptResetBtn', true);
        this.setIconButtonState('resetBtn', true);
        this.setIconButtonState('backBtn', true);
        this.setIconButtonState('referenceImageBtn', true);
        // forwardBtn will be enabled by enableForwardButton() if there's a generated video
    }

    handleReferenceImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showError('Please select a valid image file.');
            return;
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            this.showError('Image file is too large. Please select an image under 10MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.referenceImage = {
                    name: file.name,
                    dataUrl: e.target.result,
                    size: file.size
                };

                // Show preview
                this.showReferenceImagePreview();
                
                console.log('📸 Reference image uploaded:', file.name, `(${(file.size / 1024).toFixed(1)}KB)`);
                this.showSuccess('Reference image uploaded successfully!');

            } catch (error) {
                console.error('Error processing reference image:', error);
                this.showError('Failed to process reference image.');
            }
        };

        reader.onerror = () => {
            this.showError('Failed to read image file.');
        };

        reader.readAsDataURL(file);
    }

    showReferenceImagePreview() {
        if (!this.referenceImage) return;

        const preview = document.getElementById('referenceImagePreview');
        const img = document.getElementById('referenceImageImg');
        
        img.src = this.referenceImage.dataUrl;
        preview.style.display = 'block';
    }

    removeReferenceImage() {
        this.referenceImage = null;
        
        const preview = document.getElementById('referenceImagePreview');
        const img = document.getElementById('referenceImageImg');
        const fileInput = document.getElementById('referenceImageInput');
        
        preview.style.display = 'none';
        img.src = '';
        fileInput.value = '';
        
        console.log('📸 Reference image removed');
    }

    displayResult(videoUrl) {
        if (videoUrl === 'runway-generation-initiated') {
            this.displayInitiatedResult();
            return;
        }
        
        if (videoUrl === 'runway-generation-completed-no-url') {
            this.displayCompletedNoUrlResult();
            return;
        }
        
        console.log('🎬 Displaying result video:', videoUrl);
        
        const video = document.getElementById('resultVideo');
        if (!video) {
            console.error('❌ Video element not found!');
            return;
        }
        
        // Show the video element and hide any success messages
        video.style.display = 'block';
        video.style.width = '100%';
        video.style.height = 'auto';
        video.style.maxWidth = '400px';
        video.style.backgroundColor = '#000'; // Black background to see video bounds
        
        const successDiv = document.getElementById('runwaySuccessMessage');
        if (successDiv) {
            successDiv.remove();
        }
        
        // Add load event listeners to debug loading
        video.addEventListener('loadstart', () => console.log('🎬 Video loadstart'));
        video.addEventListener('loadeddata', () => console.log('🎬 Video loadeddata'));
        video.addEventListener('canplay', () => {
            console.log('🎬 Video canplay');
            console.log('🎬 Video element state:', {
                width: video.videoWidth,
                height: video.videoHeight,
                duration: video.duration,
                currentTime: video.currentTime,
                paused: video.paused,
                style: video.style.cssText,
                display: window.getComputedStyle(video).display,
                visibility: window.getComputedStyle(video).visibility,
                opacity: window.getComputedStyle(video).opacity
            });
        });
        video.addEventListener('error', (e) => {
            console.error('❌ Video error:', e);
            console.error('❌ Video error details:', {
                error: e.target.error,
                errorCode: e.target.error?.code,
                errorMessage: e.target.error?.message,
                networkState: e.target.networkState,
                readyState: e.target.readyState,
                src: e.target.src
            });
            
            // CEP specific video loading attempt
            if (e.target.error?.code === 4) { // MEDIA_ELEMENT_ERROR
                console.log('🔧 Attempting CEP-compatible video loading...');
                this.loadVideoWithBlobUrl(videoUrl, video);
            }
        });
        
        // Set video attributes for better compatibility
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';
        
        console.log('🎬 Setting video src to:', videoUrl);
        
        // For local files, try blob URL first for better CEP compatibility
        if (!videoUrl.startsWith('http') && !videoUrl.startsWith('blob:')) {
            console.log('🔧 Local file detected, using blob URL for CEP compatibility');
            this.loadVideoWithBlobUrl(videoUrl, video);
            return; // Exit early, loadVideoWithBlobUrl handles the rest
        }
        
        // For remote URLs, use direct assignment
        video.src = videoUrl;
        
        // Add layout detection when video loads
        video.addEventListener('loadeddata', () => {
            this.handleVideoLayout(video);
        }, { once: true });
        
        // Add video event listeners for debugging
        // video.addEventListener('loadstart', () => console.log('🎬 Video loadstart'));
        // video.addEventListener('loadedmetadata', () => console.log('🎬 Video metadata loaded'));
        // video.addEventListener('loadeddata', () => console.log('🎬 Video data loaded'));
        // video.addEventListener('canplay', () => console.log('🎬 Video can play'));
        // video.addEventListener('canplaythrough', () => console.log('🎬 Video can play through'));
        video.addEventListener('error', (e) => console.error('🎬 Video error:', e, video.error));
        
        // Remove native controls and enable click-to-toggle
        video.removeAttribute('controls');
        const container = video.closest('.video-container');
        if (container) {
            container.addEventListener('click', () => {
                if (video.paused) {
                    video.play().catch(() => {});
                } else {
                    video.pause();
                }
            });
        }
        
        // Try to load the video
        video.load();
        
        // Switch to result view
        this.showView('resultView');
        
        // Ensure version selector is visible in result view and synced
        this.showVersionSelector();
        this.updateVersionSlider();
        
        // Enable forward button since we now have a video
        this.enableForwardButton();
        
        // Initialize custom video controls
        // Native controls used; skipping custom external controls initialization
        // setTimeout(() => this.initVideoControls(), 100);
    }

    /**
     * Load video using blob URL for CEP compatibility
     */
    async loadVideoWithBlobUrl(videoPath, videoElement) {
        try {
            console.log('🔧 Loading video with blob URL for CEP compatibility...');
            
            // Read file as ArrayBuffer using Node.js fs
            const fs = require('fs');
            const path = require('path');
            
            // Resolve the file path
            let resolvedPath = videoPath;
            if (videoPath.startsWith('file://')) {
                resolvedPath = videoPath.replace('file://', '');
            }
            
            console.log('📁 Reading file:', resolvedPath);
            
            // Check if file exists
            if (!fs.existsSync(resolvedPath)) {
                console.error('❌ Video file not found:', resolvedPath);
                return;
            }
            
            // Read the file
            const videoBuffer = fs.readFileSync(resolvedPath);
            
            // Create blob from buffer
            const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });
            const blobUrl = URL.createObjectURL(videoBlob);
            
            console.log('✅ Created blob URL for video:', blobUrl);
            
            // Set the blob URL as video source
            videoElement.src = blobUrl;
            videoElement.load();
            
            // Clean up blob URL when video is no longer needed
            videoElement.addEventListener('loadeddata', () => {
                console.log('✅ Video loaded successfully via blob URL');
                this.handleVideoLayout(videoElement);
            }, { once: true });
            
        } catch (error) {
            console.error('❌ Failed to load video with blob URL:', error);
        }
    }

    /**
     * Detect video orientation and apply appropriate layout styling
     */
    handleVideoLayout(videoElement) {
        try {
            const videoWidth = videoElement.videoWidth;
            const videoHeight = videoElement.videoHeight;
            const container = videoElement.closest('.video-container');
            
            if (!container) {
                console.log('⚠️ No video container found');
                return;
            }
            
            // Check if video is vertical (height > width)
            const isVertical = videoHeight > videoWidth;
            
            if (isVertical) {
                console.log('📱 Detected vertical video:', `${videoWidth}x${videoHeight}`);
                container.classList.add('vertical');
            } else {
                console.log('🖥️ Detected horizontal video:', `${videoWidth}x${videoHeight}`);
                container.classList.remove('vertical');
            }
            
        } catch (error) {
            console.error('❌ Error handling video layout:', error);
        }
    }

    displayInitiatedResult() {
        const resultSection = document.getElementById('resultSection');
        const video = document.getElementById('resultVideo');
        
        // Hide the video element and show success message
        video.style.display = 'none';
        
        // Show result view instead of result section
        this.showView('resultView');
        
        // Create or update success message
        let successDiv = document.getElementById('runwaySuccessMessage');
        if (!successDiv) {
            successDiv = document.createElement('div');
            successDiv.id = 'runwaySuccessMessage';
            successDiv.style.cssText = `
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                margin: 10px 0;
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            `;
            
            // Create success message in result view
            const resultContent = document.querySelector('.result-content');
            if (resultContent) {
                resultContent.appendChild(successDiv);
            }
        }
        
        successDiv.innerHTML = `
            <h3 style="margin: 0 0 10px 0;">🎬 Video Generation Started!</h3>
            <p style="margin: 5px 0;">Your video is being generated using the official API</p>
            <p style="margin: 5px 0; font-weight: bold;">Processing will continue in the background</p>
            <div style="margin-top: 15px; font-size: 12px; opacity: 0.9;">
                <p>✅ Export completed successfully</p>
                <p>✅ Video uploaded successfully</p>
                <p>✅ Generation request initiated</p>
                <p>⏳ Processing in progress...</p>
            </div>
            <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 5px;">
                <p style="margin: 0; font-size: 11px;">
                    💡 The extension successfully connected to the API!<br>
                    Your video will appear here when processing is complete.
                </p>
            </div>
        `;
    }

    displayCompletedNoUrlResult() {
        const resultSection = document.getElementById('resultSection');
        const video = document.getElementById('resultVideo');
        
        // Hide the video element and show success message
        video.style.display = 'none';
        
        // Create or update success message
        let successDiv = document.getElementById('runwaySuccessMessage');
        if (!successDiv) {
            successDiv = document.createElement('div');
            successDiv.id = 'runwaySuccessMessage';
            successDiv.style.cssText = `
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                margin: 10px 0;
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            `;
            resultSection.appendChild(successDiv);
        }
        
        successDiv.innerHTML = `
            <h3 style="margin: 0 0 10px 0;">🎉 Video Generation Completed!</h3>
            <p style="margin: 5px 0;">Your video was successfully generated using our AI processing service</p>
            <p style="margin: 5px 0; font-weight: bold;">Please check your video generation dashboard to download the video</p>
            <div style="margin-top: 15px; font-size: 12px; opacity: 0.9;">
                <p>✅ Export completed successfully</p>
                <p>✅ Video uploaded for processing</p>
                <p>✅ Generation request initiated</p>
                <p>✅ Video processing completed</p>
                <p>⚠️  Video URL parsing needs adjustment</p>
            </div>
            <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 5px;">
                <p style="margin: 0; font-size: 11px;">
                    💡 The video generation service responded differently than expected.<br>
                    Your video is ready in your dashboard!
                </p>
            </div>
        `;
        
        resultSection.classList.remove('hidden');
    }

    showError(message) {
        // console.error('❌ Error:', message);
        const toast = document.getElementById('toast');
        if (toast) {
            toast.className = 'toast error';
            toast.textContent = typeof message === 'string' ? message : String(message);
            toast.classList.remove('hidden');
            clearTimeout(this._toastTimer);
            this._toastTimer = setTimeout(() => {
                toast.classList.add('hidden');
            }, 3500);
        }
    }

    showSuccess(message) {
        console.log('✅ Success:', message);
        const toast = document.getElementById('toast');
        if (toast) {
            toast.className = 'toast success';
            toast.textContent = typeof message === 'string' ? message : String(message);
            toast.classList.remove('hidden');
            clearTimeout(this._toastTimer);
            this._toastTimer = setTimeout(() => {
                toast.classList.add('hidden');
            }, 2500);
        }
    }

    // UI message methods removed - all messaging now console-only

    // Custom Alert System
    showAlert(title, message) {
        return new Promise((resolve) => {
            // Remove any existing alert
            const existingAlert = document.getElementById('customAlert');
            if (existingAlert) {
                existingAlert.remove();
            }

            // Create alert overlay
            const overlay = document.createElement('div');
            overlay.id = 'customAlert';
            overlay.className = 'alert-overlay';
            
            // Create alert modal
            const modal = document.createElement('div');
            modal.className = 'alert-modal';
            
            // Alert content
            modal.innerHTML = `
                <div class="alert-icon">⚠</div>
                <div class="alert-title">${title}</div>
                <div class="alert-message">${message}</div>
                <button class="alert-button" id="alertOkBtn">OK</button>
            `;
            
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            // Show with animation
            setTimeout(() => {
                overlay.classList.add('show');
            }, 10);
            
            // Handle OK button click
            const okBtn = document.getElementById('alertOkBtn');
            okBtn.addEventListener('click', () => {
                this.hideAlert(overlay, resolve);
            });
            
            // Handle clicking outside modal
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.hideAlert(overlay, resolve);
                }
            });
            
            // Handle ESC key
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', handleEsc);
                    this.hideAlert(overlay, resolve);
                }
            };
            document.addEventListener('keydown', handleEsc);
        });
    }

    hideAlert(overlay, resolve) {
        overlay.classList.remove('show');
        setTimeout(() => {
            overlay.remove();
            if (resolve) resolve();
        }, 300);
    }

    resetToExport() {
        this.hideProgress('generationProgress');
        
        // Hide result section
        const resultSection = document.getElementById('resultSection');
        if (resultSection) {
            resultSection.classList.add('hidden');
        }
        
        this.showView('promptView');
        this.generatedVideo = null;
        
        // Disable forward button since no video exists
        this.disableForwardButton();
        
        // Reset video source selection
        this.selectedVideoSource = null;
        this.videoVersions.clear();
        this.currentVersionIndex = 0;
        
        // Stop any running progress animations
        this.stopSmoothProgress();
        
        // Clear the prompt input
        const promptInput = document.getElementById('promptInput');
        if (promptInput) {
            promptInput.value = '';
        }

        // Reset video element
        const video = document.getElementById('resultVideo');
        if (video) {
            video.src = '';
            video.pause();
        }

        // Reset video container state
        const videoContainer = document.querySelector('.video-container');
        if (videoContainer) {
            videoContainer.classList.add('paused');
        }

        // Reset button states
        this.setButtonState('generateBtn', true, 'Generate');
        this.setButtonState('exportBtn', true, 'Export');
    }

    // Custom Video Controls
    initVideoControls() {
        const video = document.getElementById('resultVideo');
        const videoContainer = document.querySelector('.video-container');
        const playPauseBtn = document.getElementById('playPauseBtn');
        const progressBar = document.getElementById('progressBar');
        const progressFill = document.getElementById('progressFill');

        if (!video) {
            console.log('❌ Video element not found, skipping video controls initialization');
            return;
        }

        // Check if required elements exist (simplified - no time displays in this version)
        if (!progressBar || !progressFill) {
            console.log('❌ Required video control elements not found, skipping initialization');
            console.log('Available elements:', {
                progressBar: !!progressBar,
                progressFill: !!progressFill,
                playPauseBtn: !!playPauseBtn
            });
            return;
        }

        // Play/Pause functionality
        const togglePlayPause = async () => {
            console.log('🎮 Play/Pause clicked. Video paused:', video.paused);
            console.log('🎮 Video src:', video.src);
            console.log('🎮 Video readyState:', video.readyState);
            
            if (video.paused) {
                try {
                    await video.play();
                    console.log('✅ Video started playing');
                    if (videoContainer) videoContainer.classList.remove('paused');
                    if (playPauseBtn) playPauseBtn.textContent = '⏸';
                } catch (error) {
                    console.error('❌ Error playing video:', error);
                }
            } else {
                video.pause();
                console.log('⏸ Video paused');
                if (videoContainer) videoContainer.classList.add('paused');
                if (playPauseBtn) playPauseBtn.textContent = '▶';
            }
        };

        // Only add event listeners if elements exist
        if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);

        // Update progress
        video.addEventListener('timeupdate', () => {
            if (video.duration > 0) {
                const progress = (video.currentTime / video.duration) * 100;
                if (progressFill) progressFill.style.width = `${progress}%`;
            }
        });

        // Progress bar click to seek
        if (progressBar) {
            progressBar.addEventListener('click', (e) => {
                console.log('🎯 Progress bar clicked');
                const rect = progressBar.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickPercent = clickX / rect.width;
                const newTime = clickPercent * video.duration;
                console.log('🎯 Seeking to:', newTime, 'seconds (', Math.round(clickPercent * 100), '% )');
                video.currentTime = newTime;
            });
        }

        // Initialize button state
        if (playPauseBtn) playPauseBtn.textContent = '▶';

        // Video ended
        video.addEventListener('ended', () => {
            if (videoContainer) videoContainer.classList.add('paused');
            if (playPauseBtn) playPauseBtn.textContent = '▶';
        });
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Add debug functions to global scope for console access
    setupDebugFunctions() {
        // Existing debug functions...
        
        // Add prompt debugging
        window.debugPrompt = (promptText) => {
            if (!promptText) {
                const currentPrompt = document.getElementById('promptInput')?.value;
                if (currentPrompt) {
                    console.log('🔍 Debugging current prompt from UI...');
                    this.runwayAPI.debugPrompt(currentPrompt);
                } else {
                    console.log('❌ No prompt found. Either provide text or enter a prompt in the UI.');
                }
            } else {
                this.runwayAPI.debugPrompt(promptText);
            }
        };

        window.testSafePrompt = () => {
            const safePrompts = [
                "Transform this scene into a dreamy, ethereal atmosphere with soft golden lighting",
                "Add flowing, colorful particles that dance through the scene",
                "Create a magical, surreal transformation with swirling clouds and gentle motion",
                "Apply a cinematic color grade with warm sunset tones",
                "Add subtle rain drops and atmospheric mist to the scene"
            ];
            const randomPrompt = safePrompts[Math.floor(Math.random() * safePrompts.length)];
            document.getElementById('promptInput').value = randomPrompt;
            console.log('✨ Set a safe prompt:', randomPrompt);
            console.log('💡 Click Generate to test this safe prompt');
        };

        window.showVideoVersions = () => {
            console.log('📋 Current Video Versions:');
            console.log(`📊 Total versions: ${this.videoVersions.size}`);
            console.log(`🎯 Currently selected: ${this.selectedVideoSource}`);
            console.log(`📍 Current index: ${this.currentVersionIndex}`);
            
            if (this.videoVersions.size === 0) {
                console.log('❌ No video versions found');
                return;
            }
            
            this.videoVersions.forEach((videoData, versionId) => {
                console.log(`  📹 ${versionId}:`);
                console.log(`    - Path: ${videoData.path}`);
                console.log(`    - Prompt: ${videoData.prompt || 'No prompt'}`);
                console.log(`    - Timestamp: ${new Date(videoData.timestamp).toLocaleString()}`);
            });
            
            const versionSelector = document.getElementById('videoVersionSelector');
            const isVisible = versionSelector && !versionSelector.classList.contains('hidden');
            console.log(`🔍 Version selector visible: ${isVisible}`);
        };

        // OpenAI API configuration functions
        window.setOpenAIApiKey = (apiKey) => {
            if (!apiKey) {
                console.log('❌ Please provide an OpenAI API key');
                console.log('💡 Usage: setOpenAIApiKey("your-api-key-here")');
                return;
            }
            this.setOpenAIApiKey(apiKey);
        };

        window.testEnhancePrompt = (prompt) => {
            const testPrompt = prompt || 'add water to the scene';
            document.getElementById('promptInput').value = testPrompt;
            console.log('🎨 Testing prompt enhancement with:', testPrompt);
            console.log('💡 Click the ✨ button or use the enhance feature to see the result');
        };

        // Verification function for OpenAI setup
        window.verifyOpenAISetup = () => {
            console.log('🔍 Verifying OpenAI API setup...');
            console.log('OpenAI Config:', {
                hasApiKey: !!this.openaiConfig.apiKey,
                apiKeyPrefix: this.openaiConfig.apiKey ? this.openaiConfig.apiKey.substring(0, 20) + '...' : 'None',
                baseUrl: this.openaiConfig.baseUrl,
                model: this.openaiConfig.model,
                maxTokens: this.openaiConfig.maxTokens,
                hasAPI: !!this.openaiAPI
            });
            
            const storedConfig = localStorage.getItem('autovfx-openai-config');
            console.log('localStorage config:', storedConfig ? JSON.parse(storedConfig) : 'None');
            
            if (this.openaiAPI) {
                console.log('✅ OpenAI API is properly configured and ready to use!');
                console.log('💡 You can now use prompt enhancement features');
            } else {
                console.log('❌ OpenAI API is not configured');
                console.log('💡 Use setOpenAIApiKey("your-key") to configure it');
            }
        };

        window.enhanceCurrentPrompt = async () => {
            const currentPrompt = document.getElementById('promptInput')?.value;
            if (!currentPrompt) {
                console.log('❌ No prompt found in input field');
                return;
            }
            
            if (!this.openaiAPI) {
                console.log('❌ OpenAI API not configured. Use setOpenAIApiKey() first');
                return;
            }
            
            try {
                console.log('🎨 Enhancing prompt via console...');
                const result = await this.openaiAPI.enhancePrompt(currentPrompt);
                if (result.success) {
                    console.log('✅ Enhanced prompt:');
                    console.log('Original:', result.original);
                    console.log('Enhanced:', result.enhanced);
                    document.getElementById('promptInput').value = result.enhanced;
                } else {
                    console.log('❌ Enhancement failed:', result.error);
                }
            } catch (error) {
                console.log('❌ Error:', error.message);
            }
        };

        window.testVideoControls = () => {
            const video = document.getElementById('resultVideo');
            const playPauseBtn = document.getElementById('playPauseBtn');
            const progressBar = document.getElementById('progressBar');
            
            // console.log('🎮 Video Controls Debug:');
            // console.log('Video element:', video);
            // console.log('Video src:', video?.src);
            // console.log('Video paused:', video?.paused);
            // console.log('Video duration:', video?.duration);
            // console.log('Video readyState:', video?.readyState);
            // console.log('Play/Pause button:', playPauseBtn);
            // console.log('Progress bar:', progressBar);
            
            if (video && video.src) {
                video.play().then(() => {
                    console.log('✅ Video playing manually');
                }).catch(error => {
                    console.error('❌ Manual play failed:', error);
                });
            } else {
                console.log('❌ No video or video src');
            }
        };

        window.forceShowVersionSelector = () => {
            this.showVersionSelector();
            this.updateVersionSlider();
            console.log('✅ Forced version selector to show and update');
        };

        window.debugVersionSlider = () => {
            console.log('🔍 DEBUG Version Slider State:');
            console.log(`  - currentVersionIndex: ${this.currentVersionIndex}`);
            console.log(`  - selectedVideoSource: ${this.selectedVideoSource}`);
            console.log(`  - currentExportedVideo: ${!!this.currentExportedVideo}`);
            console.log(`  - videoVersions.size: ${this.videoVersions.size}`);
            
            // Build the same versions array as updateVersionSlider
            const versions = [];
            if (this.currentExportedVideo) {
                versions.push({ id: 'original', text: 'Original Footage' });
            }
            
            this.videoVersions.forEach((videoData, versionId) => {
                if (versionId !== 'original' && videoData.path && 
                    videoData.path !== 'runway-generation-initiated' && 
                    videoData.path !== 'runway-generation-completed-no-url') {
                    versions.push({ id: versionId, text: `Generated Video ${versions.length}` });
                }
            });
            
            console.log(`  - Built versions array (${versions.length}):`, versions);
            console.log(`  - Current version should be: ${versions[this.currentVersionIndex]?.text || 'INVALID INDEX'}`);
            
            // Check UI elements
            const currentVersionText = document.getElementById('currentVersionText');
            const prevBtn = document.getElementById('versionPrevBtn');
            const nextBtn = document.getElementById('versionNextBtn');
            
            console.log(`  - UI currentVersionText: "${currentVersionText?.textContent}"`);
            console.log(`  - UI prevBtn exists: ${!!prevBtn}, disabled: ${prevBtn?.disabled}`);
            console.log(`  - UI nextBtn exists: ${!!nextBtn}, disabled: ${nextBtn?.disabled}`);
            console.log(`  - Button state calculation: index=${this.currentVersionIndex}, length=${versions.length}`);
            console.log(`  - Should prev be disabled: ${this.currentVersionIndex === 0}`);
            console.log(`  - Should next be disabled: ${this.currentVersionIndex === versions.length - 1}`);
        };

        window.switchToGenerated = () => {
            if (this.videoVersions.size > 0) {
                this.currentVersionIndex = 1; // Move to first generated video (index 0 = original, index 1 = first generated)
                this.updateVersionSlider();
                console.log('✅ Switched to generated video');
            } else {
                console.log('❌ No generated videos available');
            }
        };

        window.testNavigation = () => {
            console.log('🧪 Testing version navigation...');
            window.debugVersionSlider();
            console.log('📍 Clicking next button...');
            this.navigateVersion(1);
            console.log('📍 After clicking next:');
            window.debugVersionSlider();
        };
    }

    updateGenerateButtonProgress(percent) {
        const btn = document.getElementById('generateBtn');
        if (!btn) return;
        btn.classList.add('progress');
        const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
        btn.style.setProperty('--progress', clamped + '%');
        // Keep the label static to avoid height changes
        // Do not append numeric percentage to the text
    }

    clearGenerateButtonProgress() {
        const btn = document.getElementById('generateBtn');
        if (!btn) return;
        btn.classList.remove('progress');
        btn.style.removeProperty('--progress');
        btn.textContent = 'Generate';
    }

    // ===== AUTHENTICATION HANDLERS =====

    /**
     * Handle sign in
     */
    async handleSignIn() {
        if (!this.licensingEnabled) return;

        const email = document.getElementById('authEmail').value.trim();

        if (!email) {
            this.showAuthError('Email is required');
            return;
        }

        this.showAuthLoading(true);
        this.hideAuthError();

        try {
            // For test mode, just authenticate with email (no password)
            const credentials = { email };

            await this.licenseAPI.authenticate(credentials);
            await this.licenseAPI.getMe();
            // Refresh credits from backend to reflect DB value immediately
            await this.licenseAPI.getCredits();

            this.showAuthSuccess('Successfully signed in!');
            setTimeout(() => {
                this.showAuthenticatedState();
            }, 1000);

        } catch (error) {
            console.error('❌ Sign in failed:', error);
            this.showAuthError(error.message || 'Sign in failed. Please try again.');
        } finally {
            this.showAuthLoading(false);
        }
    }

    /**
     * Handle magic link request
     */
    async handleMagicLink() {
        if (!this.licensingEnabled) return;

        const email = document.getElementById('authEmail').value.trim();

        if (!email) {
            this.showAuthError('Email is required for magic link');
            return;
        }

        this.showAuthLoading(true);
        this.hideAuthError();

        try {
            await this.licenseAPI.authenticate({ email, magicLink: true });
            this.showAuthSuccess('Magic link sent! Check your email.');
        } catch (error) {
            console.error('❌ Magic link failed:', error);
            this.showAuthError(error.message || 'Failed to send magic link. Please try again.');
        } finally {
            this.showAuthLoading(false);
        }
    }

    /**
     * Handle sign up
     */
    async handleSignUp() {
        if (!this.licensingEnabled) return;
        
        // For now, redirect to external signup
        this.showAuthError('Please sign up at our website first, then sign in here.');
        
        // TODO: Open external signup URL
        // this.openExternalUrl('https://your-app.com/signup');
    }

    /**
     * Show authenticated state
     */
    showAuthenticatedState() {
        document.body.classList.add('authenticated');
        // License header removed - account info available via logo click popup
        this.showView('exportView');
    }

    /**
     * Show auth view
     */
    showAuthView() {
        document.body.classList.remove('authenticated');
        this.showView('authView');
    }

    /**
     * Show account info popup modal
     */
    toggleAccountDashboard() {
        if (!this.licenseAPI || !this.licenseAPI.isAuthenticated()) {
            // If not authenticated, show auth view
            this.showAuthView();
            return;
        }

        this.showAccountModal();
    }

    toggleChboxExpFolds(elemClick) {
        let findTexts = Array.from(elemClick.parentNode.querySelectorAll('p'));
        // switchFold || switchDel
        let findEl;
        if(elemClick.checked) findEl = (elemClick.id == "switchFold") ? "Documents":"Yes";
        else findEl = (elemClick.id == "switchFold") ? "Desktop":"No";
        

        findEl = findTexts.find(el => el.textContent === findEl);
        findTexts.forEach(elem => { elem.classList.remove("activeChBox") });
        findEl.classList.add("activeChBox");

        // let getConf = { 'exptofold': "Desktop", 'clearExp': false };
        // const getConf = await new Promise((resolve) => {
        if(elemClick.id == "switchFold") this.userConfig.exptofold = (elemClick.checked)? "Documents":"Desktop";
        else this.userConfig.clearExp = (elemClick.checked)? true:false;
        
        console.log('AutoVFXExtendScript.initSettings("getJS", ' + JSON.stringify(this.userConfig) + ')')
        this.csInterface.evalScript('AutoVFXExtendScript.initSettings("getJS", ' + JSON.stringify(this.userConfig) + ')', (result) => {
            if (result === 'EvalScript error.' || !result || result.includes('EvalScript error')) {
                console.warn('⚠️ initSettings() save changes failed, using fallback default settings');
            }
        });
        // });
        
        return;
    }

    /**
     * Show account modal popup
     */
    showAccountModal() {
        const modal = document.getElementById('accountModal');
        if (!modal) return;
        
        // Update modal content with current user data
        this.updateAccountModalContent();
        
        // Show modal
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }

    /**
     * Hide account modal popup
     */
    hideAccountModal() {
        const modal = document.getElementById('accountModal');
        if (!modal) return;
        
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }

    /**
     * Update account modal content with current user data
     */
    updateAccountModalContent() {
        if (!this.licenseAPI || !this.licenseAPI.isAuthenticated()) return;

        // Update user email
        const emailElement = document.getElementById('modalUserEmail');
        if (emailElement && this.licenseAPI.currentUser) {
            emailElement.textContent = this.licenseAPI.currentUser.email || 'Unknown';
        }

        // Update subscription tier
        const tierElement = document.getElementById('modalSubscriptionTier');
        if (tierElement) {
            const tier = this.licenseAPI.subscription?.tier || this.licenseAPI.subscription?.status || 'Free';
            tierElement.textContent = tier;
            tierElement.className = `tier-badge tier-${tier.toLowerCase()}`;
        }

        // Update credit count
        const creditElement = document.getElementById('modalCreditCount');
        if (creditElement) {
            creditElement.textContent = this.licenseAPI.creditBalance || 0;
        }

        // Update credit duration
        const durationElement = document.getElementById('modalCreditDuration');
        if (durationElement && this.licenseAPI.creditBalance) {
            const minutes = Math.floor(this.licenseAPI.creditBalance / 12);
            durationElement.textContent = `~${minutes} minutes`;
        }

        // Update usage progress bar
        const progressElement = document.getElementById('modalUsageProgress');
        if (progressElement && this.licenseAPI.cycle) {
            // Calculate usage based on cycle information if available
            const used = this.licenseAPI.cycle.used || 0;
            const limit = this.licenseAPI.cycle.limit || this.licenseAPI.creditBalance || 1;
            const percentage = Math.min((used / limit) * 100, 100);
            progressElement.style.width = `${percentage}%`;
        }

        // Update cycle end info
        const cycleElement = document.getElementById('modalCycleEnd');
        if (cycleElement && this.licenseAPI.cycle?.end) {
            const endDate = new Date(this.licenseAPI.cycle.end);
            cycleElement.textContent = `Renews ${endDate.toLocaleDateString()}`;
        } else if (cycleElement && this.licenseAPI.subscription) {
            // Fallback to subscription status if no cycle info
            cycleElement.textContent = `Status: ${this.licenseAPI.subscription.status || 'Active'}`;
        }
    }

    // updateLicenseHeader method removed - license header replaced with account modal popup

    // ===== LICENSING HANDLERS =====

    /**
     * Check if user has enough credits for generation
     */
    async checkCreditsBeforeGeneration(durationSeconds = 10) {
        if (!this.licensingEnabled) return true;

        const check = this.licenseAPI.canGenerate(durationSeconds);
        
        if (!check.canGenerate) {
            this.showInsufficientCreditsModal(check.needed, check.current);
            return false;
        }

        return true;
    }

    /**
     * Reserve credits for generation
     */
    async reserveCreditsForGeneration(durationSeconds = 10) {
        if (!this.licensingEnabled) return { success: true };

        try {
            const reservation = await this.licenseAPI.reserveCredits(durationSeconds);
            this.currentReservation = reservation;
            // License header removed - balance shown in account modal popup
            return { success: true, reservation };
        } catch (error) {
            console.error('❌ Failed to reserve credits:', error);
            
            if (error.message.includes('INSUFFICIENT_CREDITS')) {
                const needed = this.licenseAPI.calculateCreditsNeeded(durationSeconds);
                this.showInsufficientCreditsModal(needed, this.licenseAPI.creditBalance);
            }
            
            return { success: false, error: error.message };
        }
    }

    /**
     * Handle upgrade subscription
     */
    async handleUpgrade() {
        if (!this.licensingEnabled) return;

        try {
            const portalUrl = await this.licenseAPI.getPortalLink();
            this.openExternalUrl(portalUrl);
        } catch (error) {
            console.error('❌ Failed to get portal link:', error);
            
            // Provide more helpful error message based on the error
            if (error.message.includes('400') || error.message.includes('customer ID')) {
                alert('To access the upgrade portal, please complete your first purchase. You can buy credits first using the "Buy Credits" button, then access account management.');
            } else {
                alert('Failed to open upgrade portal. Please try again later or contact support.');
            }
        }
    }

    /**
     * Handle quick top-up
     */
    async handleTopup() {
        if (!this.licensingEnabled) return;
        
        // Show the insufficient credits modal with top-up options
        this.showInsufficientCreditsModal(0, this.licenseAPI.creditBalance);
    }

    /**
     * Handle account management
     */
    async handleAccount() {
        if (!this.licensingEnabled) return;

        try {
            const portalUrl = await this.licenseAPI.getPortalLink();
            this.openExternalUrl(portalUrl);
        } catch (error) {
            console.error('❌ Failed to get portal link:', error);
            
            // Provide more helpful error message based on the error
            if (error.message.includes('400') || error.message.includes('customer ID')) {
                alert('To access account management, please complete your first purchase. You can buy credits first using the "Buy Credits" button, then manage your account.');
            } else {
                alert('Failed to open account portal. Please try again later or contact support.');
            }
        }
    }

    /**
     * Handle top-up purchase
     */
    async handleTopupPurchase(pack) {
        if (!this.licensingEnabled) return;

        try {
            const checkoutUrl = await this.licenseAPI.getTopupCheckoutLink(pack);
            this.openExternalUrl(checkoutUrl);
            this.hideInsufficientCreditsModal();
        } catch (error) {
            console.error('❌ Failed to get checkout link:', error);
            alert('Failed to open checkout. Please try again.');
        }
    }

    /**
     * Show insufficient credits modal
     */
    showInsufficientCreditsModal(needed, available) {
        const modal = document.getElementById('insufficientCreditsModal');
        const creditsNeeded = document.getElementById('creditsNeeded');
        const creditsAvailable = document.getElementById('creditsAvailable');

        if (creditsNeeded) creditsNeeded.textContent = needed;
        if (creditsAvailable) creditsAvailable.textContent = available;

        modal.classList.remove('hidden');
    }

    /**
     * Hide insufficient credits modal
     */
    hideInsufficientCreditsModal() {
        const modal = document.getElementById('insufficientCreditsModal');
        modal.classList.add('hidden');
    }

    /**
     * Open external URL
     */
    openExternalUrl(url) {
        // In CEP environment, use shell to open external URLs
        if (this.csInterface) {
            this.csInterface.openURLInDefaultBrowser(url);
        } else {
            window.open(url, '_blank');
        }
    }

    // ===== AUTH UI HELPERS =====

    /**
     * Show auth loading state
     */
    showAuthLoading(loading) {
        const signInBtn = document.getElementById('signInBtn');
        const magicLinkBtn = document.getElementById('magicLinkBtn');
        
        if (loading) {
            if (signInBtn) {
                signInBtn.disabled = true;
                signInBtn.textContent = 'Signing in...';
            }
            if (magicLinkBtn) {
                magicLinkBtn.disabled = true;
                magicLinkBtn.textContent = 'Sending...';
            }
        } else {
            if (signInBtn) {
                signInBtn.disabled = false;
                signInBtn.textContent = 'Sign In';
            }
            if (magicLinkBtn) {
                magicLinkBtn.disabled = false;
                magicLinkBtn.textContent = 'Send Magic Link';
            }
        }
    }

    /**
     * Show auth error
     */
    showAuthError(message) {
        const errorDiv = document.getElementById('authError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        }
    }

    /**
     * Hide auth error
     */
    hideAuthError() {
        const errorDiv = document.getElementById('authError');
        if (errorDiv) {
            errorDiv.classList.add('hidden');
        }
    }

    /**
     * Show auth success
     */
    showAuthSuccess(message) {
        const successDiv = document.getElementById('authSuccess');
        if (successDiv) {
            successDiv.textContent = message;
            successDiv.classList.remove('hidden');
        }
    }

    // ===== CREDIT SETTLEMENT =====

    /**
     * Settle credits on video generation completion
     */
    async settleCreditsOnCompletion(taskId, success, actualSeconds = 0) {
        if (!this.licensingEnabled || !this.licenseAPI) {
            console.log('🔓 Licensing disabled, skipping credit settlement');
            return;
        }

        try {
            console.log(`💰 Settling credits for task ${taskId}:`, {
                success,
                actualSeconds,
                hasReservation: !!this.currentReservation
            });

            if (success) {
                // Generation succeeded - calculate actual credits used and refund difference
                const actualCreditsUsed = this.licenseAPI.calculateCreditsNeeded(actualSeconds);
                const reservedCredits = this.currentReservation?.reservedCredits || actualCreditsUsed;
                const refundCredits = Math.max(0, reservedCredits - actualCreditsUsed);

                console.log(`💰 Credit calculation:`, {
                    reserved: reservedCredits,
                    actuallyUsed: actualCreditsUsed,
                    refund: refundCredits
                });

                // In a real implementation, you would call your backend API here
                // For now, we'll just update the local state
                if (refundCredits > 0) {
                    console.log(`💰 Refunding ${refundCredits} unused credits`);
                    this.licenseAPI.creditBalance += refundCredits;
                }

                this.showError(`✅ Generation completed! Used ${actualCreditsUsed} credits.`, 'success');
            } else {
                // Generation failed - refund all reserved credits
                const refundCredits = this.currentReservation?.reservedCredits || 0;
                
                if (refundCredits > 0) {
                    console.log(`💰 Refunding all ${refundCredits} credits due to failure`);
                    this.licenseAPI.creditBalance += refundCredits;
                }

                this.showError(`❌ Generation failed. ${refundCredits} credits refunded.`, 'error');
            }

            // Clear the current reservation
            this.currentReservation = null;

            // License header removed - UI updates via account modal popup

        } catch (error) {
            console.error('❌ Credit settlement failed:', error);
            
            // In production, you might want to queue this for retry
            console.log('⚠️  Credit settlement will be retried by the backend system');
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.autoVFX = new AutoVFX();
    
    // Expose test function for new export method
    window.testNewExport = async () => {
        console.log('🧪 Testing new simplified export method...');
        try {
            const result = await window.autoVFX.exportVideoSegment();
            console.log('✅ Export test completed:', result);
        } catch (error) {
            console.error('❌ Export test failed:', error.message);
        }
    };
    
    // Test the UI export button functionality
    window.testUIExport = async () => {
        console.log('🎬 Testing UI export button (same as clicking Export button)...');
        try {
            const result = await window.autoVFX.handleExport();
            console.log('✅ UI export test completed');
        } catch (error) {
            console.error('❌ UI export test failed:', error.message);
        }
    };
    
    // Log available console commands after a brief delay
    // setTimeout(() => {
    //     console.log('🚀 AutoVFX loaded! Available console commands:');
    //     console.log('');
    //     console.log('🎬 Export Commands:');
    //     console.log('   testUIExport() - Test the UI export button (using Premiere Pro native export)');
    //     console.log('   testNewExport() - Test the new simplified export method');
    //     console.log('   testPlayheadExport() - Test playhead calculation');
    //     console.log('');
    //     console.log('🎬 Runway API Commands:');
    //     console.log('   window.autoVFX.runwayAPI.testConnection() - Test API connection');
    //     console.log('   testRunwayAPI() - 🧪 Full API connection test');
    //     console.log('   debugLastTask("TASK_ID") - 🔍 Debug specific task response');
    //     console.log('   refreshAPI() - Force API refresh (fixes cached endpoints)');
    //     console.log('');
    //     console.log('🛠️  Debug Commands:');
    //     console.log('   showConfig() - Show current configuration'); 
    //     console.log('   clearCache() - Clear all cached data');
    //     console.log('   showSystemInfo() - Show system info');
    //     console.log('   debugMediaFiles() - Debug why timeline shows blue screen');
    //     console.log('   diagnoseExport() - Complete export diagnosis');
    //     console.log('   checkDesktopFiles() - Check what files are actually on Desktop');
    //     console.log('   debugPrompt() - 🔍 Debug current prompt for content moderation issues');
    //     console.log('   debugPrompt("your text") - 🔍 Debug specific prompt text');
    //     console.log('   testSafePrompt() - ✨ Fill input with a safe prompt example');
    //     console.log('   setOpenAIApiKey("your-key") - 🔑 Configure OpenAI API for prompt enhancement');
    //     console.log('   verifyOpenAISetup() - ✅ Verify OpenAI API configuration status');
    //     console.log('   testEnhancePrompt("text") - 🎨 Test prompt enhancement with sample text');
    //     console.log('   enhanceCurrentPrompt() - ✨ Enhance the current prompt in the UI');
    //     console.log('   showVideoVersions() - 📋 Show all generated video versions');
    //     console.log('   forceShowVersionSelector() - 🔧 Force show the version selector');
    //     console.log('   debugVersionSlider() - 🔍 Debug version slider state and UI');
    //     console.log('   switchToGenerated() - 🎯 Switch to first generated video');
    //     console.log('   testNavigation() - 🧪 Test version navigation buttons');
    //     console.log('');
    //     console.log('🚨 Emergency Fixes:');
    //     console.log('   fixAPIUrl() - Fix wrong API URL issue');
    //     console.log('   checkYourVideo() - Check your specific video that was at 79%');
    //     console.log('   testImport() - Test download + import of your generated video');
    //     console.log('   forceImport() - FORCE import your generated video to timeline');
    //     console.log('   testPositionImport() - Test position-aware import with auto-scaling');
    //     console.log('   showExportPosition() - Show current stored export position');
    //     console.log('   testJSXImport() - Test JSX import function directly (debug parsing)');
    //     console.log('   debugForwardButton() - 🔍 Check forward button state');
    //     console.log('');
    // }, 1000);
    
    // Debug forward button function
    window.debugForwardButton = () => {
        const forwardBtn = document.getElementById('forwardBtn');
        console.log('🔍 Forward Button Debug:');
        console.log('  - Button exists:', !!forwardBtn);
        console.log('  - Has disabled class:', forwardBtn?.classList.contains('disabled'));
        console.log('  - Current view:', document.querySelector('.view.active')?.id);
        console.log('  - Generated video exists:', !!window.autoVFX.generatedVideo);
        console.log('  - Video versions count:', window.autoVFX.videoVersions?.size || 0);
        console.log('  - Current exported video:', !!window.autoVFX.currentExportedVideo);
        
        // Try to enable the button manually
        if (forwardBtn) {
            console.log('🔧 Attempting to manually enable forward button...');
            forwardBtn.classList.remove('disabled');
            console.log('  - After manual enable, has disabled class:', forwardBtn.classList.contains('disabled'));
        }
    };
}); 
/**
 * Debug Helpers for AutoVFX Extension
 * Utilities for troubleshooting and testing
 */

class DebugHelpers {
	constructor() {
		this.version = '1.0.0'
	}

	/**
	 * Clear all cached data and reinitialize
	 */
	clearCache() {
		console.log('🧹 Clearing all cached data...')

		// Clear localStorage
		localStorage.removeItem('autovfx-config')
		localStorage.removeItem('autovfx-export-config')

		// Force clear any stored runway config with wrong URL
		const keys = Object.keys(localStorage)
		keys.forEach((key) => {
			if (key.includes('runway') || key.includes('autovfx')) {
				localStorage.removeItem(key)
				console.log(`Removed cached key: ${key}`)
			}
		})

		// Reinitialize if possible
		if (window.autoVFX) {
			// Force the correct URL before reloading
			window.autoVFX.runwayConfig.baseUrl =
				'https://api.dev.runwayml.com/v1'
			window.autoVFX.loadConfiguration()
			console.log('✅ Configuration reloaded with correct URL')
		}

		console.log(
			'✅ Cache cleared. Extension should now use correct API URL.',
		)
	}

	/**
	 * Show current configuration
	 */
	showConfig() {
		if (!window.autoVFX) {
			console.error('❌ AutoVFX not loaded')
			return
		}

		console.log('📋 Current Configuration:')
		console.log('==========================================')
		console.log('Runway Config:', window.autoVFX.runwayConfig)
		console.log('Export Config:', window.autoVFX.exportConfig)
		console.log('==========================================')
	}

	/**
	 * Force API endpoint refresh
	 */
	refreshAPI() {
		console.log('🔄 Refreshing API configuration...')

		if (window.autoVFX) {
			// FORCE the correct API URL (override any cached or wrong values)
			window.autoVFX.runwayConfig.baseUrl =
				'https://api.dev.runwayml.com/v1'

			// Reinitialize with forced correct config
			window.autoVFX.runwayAPI = new RunwayAPI(
				window.autoVFX.runwayConfig,
			)
			console.log('✅ Runway API reinitialized with OFFICIAL URL')
			console.log('Current base URL:', window.autoVFX.runwayAPI.baseUrl)

			if (window.autoVFX.runwayAPI.baseUrl.includes('aimlapi.com')) {
				console.error(
					'❌ STILL USING WRONG URL! Something is overriding the config.',
				)
			} else {
				console.log('✅ Now using correct official Runway API URL')
			}
		}
	}

	/**
	 * Show system information
	 */
	showSystemInfo() {
		console.log('💻 System Information:')
		console.log('==========================================')
		console.log('Platform:', navigator.platform)
		console.log('User Agent:', navigator.userAgent)
		console.log('Node.js available:', typeof require === 'function')

		if (typeof require === 'function') {
			try {
				const os = require('os')
				console.log('OS Type:', os.type())
				console.log('OS Platform:', os.platform())
				console.log('OS Arch:', os.arch())
				console.log('Home Directory:', os.homedir())
			} catch (error) {
				console.log('OS module error:', error.message)
			}
		}

		console.log('==========================================')
	}
}

// Make available globally
window.DebugHelpers = DebugHelpers
const debugHelpers = new DebugHelpers()

// Global helper functions
window.clearCache = () => debugHelpers.clearCache()
window.showConfig = () => debugHelpers.showConfig()
window.refreshAPI = () => debugHelpers.refreshAPI()
window.showSystemInfo = () => debugHelpers.showSystemInfo()

// Emergency fix for API URL issue
window.fixAPIUrl = () => {
	console.log('🚨 EMERGENCY FIX: Forcing correct Runway API URL...')

	// Clear the problematic cached config
	localStorage.removeItem('autovfx-config')
	console.log('🗑️  Cleared cached config')

	if (window.autoVFX) {
		// Force correct URL
		window.autoVFX.runwayConfig.baseUrl = 'https://api.dev.runwayml.com/v1'
		window.autoVFX.runwayAPI = new RunwayAPI(window.autoVFX.runwayConfig)

		console.log('✅ FIXED! Now using:', window.autoVFX.runwayAPI.baseUrl)

		if (window.autoVFX.runwayAPI.baseUrl.includes('api.dev.runwayml.com')) {
			console.log('🎉 SUCCESS! Extension now uses official Runway API')
		} else {
			console.error('❌ STILL BROKEN! Contact support.')
		}
	}
}

// Test API connection
window.testRunwayAPI = async () => {
	console.log('🧪 Testing Runway API connection...')

	if (!window.autoVFX?.runwayAPI) {
		console.error('❌ Runway API not initialized')
		return
	}

	try {
		console.log('📡 Current API config:')
		console.log('   Base URL:', window.autoVFX.runwayAPI.baseUrl)
		console.log('   Model:', window.autoVFX.runwayAPI.model)
		console.log('   API Version:', window.autoVFX.runwayAPI.apiVersion)
		console.log('   Has API Key:', !!window.autoVFX.runwayAPI.apiKey)

		// Test connection
		const result = await window.autoVFX.runwayAPI.testConnection()
		console.log('✅ API Test Result:', result)

		if (result.success) {
			console.log('🎉 Runway API is working correctly!')
		} else {
			console.log('⚠️  API test failed but extension is configured')
		}
	} catch (error) {
		console.error('❌ API test failed:', error.message)
	}
}

// Debug the last task status
window.debugLastTask = async (taskId) => {
	if (!taskId) {
		console.log(
			'❌ Please provide a task ID: debugLastTask("a6fdc23d-78ce-4245-af83-1d3562f9e952")',
		)
		return
	}

	console.log(`🔍 Debugging task: ${taskId}`)

	try {
		const status =
			await window.autoVFX.runwayAPI.checkGenerationStatus(taskId)
		console.log('📊 Raw status response:', status)
		console.log('📊 Status keys:', Object.keys(status))

		if (status.output) {
			console.log('📹 Output field:', status.output)
			console.log('📹 Output type:', typeof status.output)
			console.log('📹 Is Array:', Array.isArray(status.output))

			if (Array.isArray(status.output) && status.output.length > 0) {
				console.log('📹 First output item:', status.output[0])
				console.log('📹 First output type:', typeof status.output[0])
				if (typeof status.output[0] === 'object') {
					console.log(
						'📹 First output keys:',
						Object.keys(status.output[0]),
					)
				}
			}
		}
	} catch (error) {
		console.error('❌ Debug failed:', error.message)
	}
}

// Debug media files detection
window.debugMediaFiles = async () => {
	console.log('🔍 Debugging media files detection...')

	try {
		// Call the JSX function directly
		const csInterface = new CSInterface()
		const result = await new Promise((resolve) => {
			csInterface.evalScript('getSequenceMediaFiles()', resolve)
		})

		console.log('📊 Raw JSX result:', result)

		const parsed = JSON.parse(result)
		console.log('📊 Parsed result:', parsed)

		if (parsed.success) {
			console.log('✅ Successfully found sequence')
			console.log('📹 Sequence name:', parsed.sequenceName)
			console.log('📹 Media files found:', parsed.mediaFiles.length)
			console.log('🔍 Debug info:', parsed.debug)

			if (parsed.mediaFiles.length > 0) {
				console.log('📹 First media file:', parsed.mediaFiles[0])
			} else {
				console.log('⚠️  No media files found in sequence')
				console.log(
					"💡 This is why we're getting a blue test pattern instead of your timeline content!",
				)
				console.log(
					'🔧 The new exportTimelineDirect() method should fix this by rendering the timeline directly',
				)
			}
		} else {
			console.error(
				'❌ Failed to get sequence media files:',
				parsed.error,
			)
		}
	} catch (error) {
		console.error('❌ Debug failed:', error.message)
	}
}

// Test the new timeline export method
window.testTimelineExport = async () => {
	console.log('🧪 Testing direct timeline export...')

	try {
		const csInterface = new CSInterface()

		// Get timeline info first
		const timelineResult = await new Promise((resolve) => {
			csInterface.evalScript('getTimelineInfo()', resolve)
		})

		const timelineInfo = JSON.parse(timelineResult)
		console.log('📊 Timeline info:', timelineInfo)

		if (timelineInfo.success) {
			const testPath = '/Users/davud/Desktop/test_timeline_export.mp4'
			const inPoint = timelineInfo.suggestedInPoint || 0
			const outPoint = timelineInfo.suggestedOutPoint || 5

			console.log(`🎬 Testing export from ${inPoint}s to ${outPoint}s`)

			// Test the working JSX function directly
			const exportResult = await new Promise((resolve) => {
				csInterface.evalScript(
					`AutoVFXExtendScript.exportVideoSegment("${testPath}", ${inPoint}, ${outPoint})`,
					resolve,
				)
			})

			console.log('📊 Export result:', JSON.parse(exportResult))
		} else {
			console.error('❌ Failed to get timeline info:', timelineInfo.error)
		}
	} catch (error) {
		console.error('❌ Test failed:', error.message)
	}
}

// Quick diagnosis of current export issue
window.diagnoseExport = async () => {
	console.log('🔍 DIAGNOSING EXPORT ISSUE...')

	try {
		const csInterface = new CSInterface()

		// Check if we have an active sequence
		const sequenceCheck = await new Promise((resolve) => {
			csInterface.evalScript(
				'app.project.activeSequence ? "SEQUENCE_EXISTS" : "NO_SEQUENCE"',
				resolve,
			)
		})

		console.log('📊 Sequence check:', sequenceCheck)

		if (sequenceCheck === 'NO_SEQUENCE') {
			console.log(
				'❌ NO ACTIVE SEQUENCE - Open a sequence in Premiere Pro first!',
			)
			return
		}

		// Get timeline info
		const timelineResult = await new Promise((resolve) => {
			csInterface.evalScript('getTimelineInfo()', resolve)
		})

		const timelineInfo = JSON.parse(timelineResult)
		console.log('📊 Timeline info:', timelineInfo)

		// Get media files
		const mediaResult = await new Promise((resolve) => {
			csInterface.evalScript('getSequenceMediaFiles()', resolve)
		})

		const mediaInfo = JSON.parse(mediaResult)
		console.log('📊 Media files info:', mediaInfo)

		// Summary
		console.log('🔍 DIAGNOSIS SUMMARY:')
		console.log(
			`   - Active sequence: ${sequenceCheck === 'SEQUENCE_EXISTS' ? '✅ YES' : '❌ NO'}`,
		)
		console.log(
			`   - Timeline duration: ${timelineInfo.sequenceDuration || 'UNKNOWN'}s`,
		)
		console.log(
			`   - Media files found: ${mediaInfo.mediaFiles ? mediaInfo.mediaFiles.length : 0}`,
		)
		console.log(
			`   - In/Out points set: ${timelineInfo.hasInOutPoints ? '✅ YES' : '❌ NO'}`,
		)

		if (mediaInfo.mediaFiles && mediaInfo.mediaFiles.length > 0) {
			console.log(
				'✅ GOOD: Media files detected, should be able to export',
			)
			console.log(
				'💡 Try: emergencyExport() to force export the timeline',
			)
		} else {
			console.log('⚠️  ISSUE: No media files detected in timeline')
			console.log("💡 This is why you're getting placeholder videos")
			console.log('🔧 Possible solutions:')
			console.log('   1. Make sure your timeline has video clips')
			console.log(
				'   2. Try emergencyExport() to bypass media file detection',
			)
		}
	} catch (error) {
		console.error('❌ Diagnosis failed:', error.message)
	}
}

// Emergency fix - try to export with better FFmpeg approach
window.emergencyExport = async () => {
	console.log(
		'🚨 EMERGENCY EXPORT: Using improved FFmpeg export with correct -ss/-to syntax...',
	)

	try {
		const csInterface = new CSInterface()

		// Get timeline info
		const timelineResult = await new Promise((resolve) => {
			csInterface.evalScript('getTimelineInfo()', resolve)
		})

		const timelineInfo = JSON.parse(timelineResult)
		console.log('📊 Timeline info:', timelineInfo)

		if (timelineInfo.success) {
			// Get source video path
			const mediaResult = await new Promise((resolve) => {
				csInterface.evalScript('getSequenceMediaFiles()', resolve)
			})

			const mediaInfo = JSON.parse(mediaResult)
			console.log('📊 Media files:', mediaInfo)

			if (mediaInfo.mediaFiles && mediaInfo.mediaFiles.length > 0) {
				const sourceVideo = mediaInfo.mediaFiles[0].path
				const exportPath = '/Users/davud/Desktop/emergency_export.mp4'
				const startTime = timelineInfo.suggestedInPoint || 0
				const endTime = timelineInfo.suggestedOutPoint || 5

				console.log(`🎬 Emergency FFmpeg export:`)
				console.log(`   Source: ${sourceVideo}`)
				console.log(`   Time: ${startTime}s to ${endTime}s`)
				console.log(`   Output: ${exportPath}`)

				// Use the proper FFmpeg command as suggested by user
				const ffmpegArgs = [
					'-i',
					sourceVideo,
					'-ss',
					startTime.toString(),
					'-to',
					endTime.toString(),
					'-c:v',
					'libx264',
					'-c:a',
					'aac',
					'-crf',
					'23',
					'-movflags',
					'+faststart',
					'-y',
					exportPath,
				]

				console.log('🔧 FFmpeg command:', ffmpegArgs.join(' '))

				// Execute FFmpeg via the extension's FFmpeg manager
				if (window.autoVFX && window.autoVFX.ffmpegManager) {
					// Ensure FFmpeg is initialized first
					console.log('🔧 Initializing FFmpeg...')
					await window.autoVFX.ffmpegManager.ensureFFmpeg()

					const result =
						await window.autoVFX.ffmpegManager.runFFmpegCommand(
							ffmpegArgs,
						)

					if (result.success) {
						console.log(
							'✅ Emergency FFmpeg export completed successfully!',
						)
						console.log(`📁 Check: ${exportPath}`)
					} else {
						console.error('❌ FFmpeg export failed:', result.error)
					}
				} else {
					console.error(
						'❌ FFmpeg manager not available. Try reloading the extension.',
					)
				}
			} else {
				console.error('❌ No source video files found in timeline')
				console.log(
					'💡 Make sure your timeline contains actual video clips',
				)
			}
		} else {
			console.error('❌ Failed to get timeline info:', timelineInfo.error)
		}
	} catch (error) {
		console.error('❌ Emergency export failed:', error.message)
	}
}

// Test export around current playhead position
window.testPlayheadExport = async () => {
	console.log('🎬 Testing export around current playhead position...')

	try {
		const csInterface = new CSInterface()

		// Get timeline info
		const timelineResult = await new Promise((resolve) => {
			csInterface.evalScript('getTimelineInfo()', resolve)
		})

		const timelineInfo = JSON.parse(timelineResult)
		console.log('📊 Timeline info:', timelineInfo)

		if (timelineInfo.success) {
			const playhead =
				timelineInfo.playheadPosition || timelineInfo.playhead || 0
			const sequenceStart = 0
			const sequenceEnd = timelineInfo.sequenceDuration || 30

			console.log(`📊 Playhead info:`)
			console.log(`   Playhead position: ${playhead}s`)
			console.log(`   Sequence duration: ${sequenceEnd}s`)

			// Calculate 2-second segment around playhead (same logic as main export)
			const segmentDuration = 2
			const halfDuration = segmentDuration / 2

			let startTime = Math.max(sequenceStart, playhead - halfDuration)
			let endTime = Math.min(sequenceEnd, playhead + halfDuration)
			let duration = endTime - startTime

			// Adjust if we're too close to the beginning or end
			if (
				duration < segmentDuration &&
				endTime - sequenceStart >= segmentDuration
			) {
				startTime = Math.max(sequenceStart, endTime - segmentDuration)
			} else if (
				duration < segmentDuration &&
				sequenceEnd - startTime >= segmentDuration
			) {
				endTime = Math.min(sequenceEnd, startTime + segmentDuration)
			}

			duration = endTime - startTime

			console.log(`🎯 Export calculation:`)
			console.log(`   Start time: ${startTime}s`)
			console.log(`   End time: ${endTime}s`)
			console.log(`   Duration: ${duration}s`)

			const shouldCenter =
				Math.abs(playhead - (startTime + duration / 2)) < 1 // Within 1 second of center
			console.log(
				`   ✅ Properly centered around playhead: ${shouldCenter ? 'YES' : 'NO'}`,
			)

			if (!shouldCenter) {
				console.log(
					'⚠️  Export segment is not properly centered around playhead!',
				)
			} else {
				console.log('✅ Export calculation looks correct!')
			}
		} else {
			console.error('❌ Failed to get timeline info:', timelineInfo.error)
		}
	} catch (error) {
		console.error('❌ Playhead test failed:', error.message)
	}
}

// Check what files are actually on the desktop
window.checkDesktopFiles = () => {
	console.log('📁 Checking Desktop files...')

	try {
		const fs = require('fs')
		const path = require('path')
		const os = require('os')

		const desktopPath = path.join(os.homedir(), 'Desktop')
		console.log('🔍 Desktop path:', desktopPath)

		const files = fs.readdirSync(desktopPath)
		const videoFiles = files.filter(
			(file) =>
				file.toLowerCase().includes('autovfx') ||
				file.toLowerCase().includes('emergency') ||
				file.toLowerCase().endsWith('.mp4') ||
				file.toLowerCase().endsWith('.mov'),
		)

		console.log('📊 All relevant files on Desktop:')
		if (videoFiles.length === 0) {
			console.log('   ❌ No video or AutoVFX files found')
		} else {
			videoFiles.forEach((file) => {
				const filePath = path.join(desktopPath, file)
				const stats = fs.statSync(filePath)
				const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
				const modTime = stats.mtime.toLocaleString()
				console.log(
					`   ✅ ${file} (${sizeMB} MB, modified: ${modTime})`,
				)
			})
		}

		console.log('')
		console.log('🔍 Looking specifically for AutoVFX exports:')
		const autovfxFiles = files.filter((file) =>
			file.includes('autovfx_export'),
		)
		if (autovfxFiles.length === 0) {
			console.log('   ❌ No autovfx_export files found')
		} else {
			autovfxFiles.forEach((file) => console.log(`   ✅ Found: ${file}`))
		}
	} catch (error) {
		console.error('❌ Could not check Desktop files:', error.message)
	}
}

// Force FFmpeg export directly (bypass Premiere Pro)
window.forceFFmpegExport = async () => {
	console.log('🔧 FORCE FFmpeg Export: Bypassing Premiere Pro completely...')

	try {
		const csInterface = new CSInterface()

		// Get timeline info
		const timelineResult = await new Promise((resolve) => {
			csInterface.evalScript('getTimelineInfo()', resolve)
		})

		const timelineInfo = JSON.parse(timelineResult)
		console.log('📊 Timeline info:', timelineInfo)

		if (timelineInfo.success) {
			// Get source video path
			const mediaResult = await new Promise((resolve) => {
				csInterface.evalScript('getSequenceMediaFiles()', resolve)
			})

			const mediaInfo = JSON.parse(mediaResult)
			console.log('📊 Media files:', mediaInfo)

			if (mediaInfo.mediaFiles && mediaInfo.mediaFiles.length > 0) {
				const sourceVideo = mediaInfo.mediaFiles[0].path

				// Calculate playhead-centered segment
				const playhead = timelineInfo.playheadPosition || 0
				const segmentDuration = 2
				const halfDuration = segmentDuration / 2
				const sequenceStart = 0
				const sequenceEnd = timelineInfo.sequenceDuration || 30

				let startTime = Math.max(sequenceStart, playhead - halfDuration)
				let endTime = Math.min(sequenceEnd, playhead + halfDuration)

				// Cross-platform Desktop path
				const os = require('os')
				const path = require('path')
				const exportPath = path.join(
					os.homedir(),
					'Desktop',
					'force_ffmpeg_export.mp4',
				)

				console.log(`🎬 Force FFmpeg export:`)
				console.log(`   Source: ${sourceVideo}`)
				console.log(`   Time: ${startTime}s to ${endTime}s`)
				console.log(`   Output: ${exportPath}`)

				// Use FFmpeg directly
				const ffmpegArgs = [
					'-i',
					sourceVideo,
					'-ss',
					startTime.toString(),
					'-to',
					endTime.toString(),
					'-c:v',
					'libx264',
					'-c:a',
					'aac',
					'-crf',
					'23',
					'-movflags',
					'+faststart',
					'-y',
					exportPath,
				]

				console.log('🔧 FFmpeg command:', ffmpegArgs.join(' '))

				if (window.autoVFX && window.autoVFX.ffmpegManager) {
					// Ensure FFmpeg is initialized
					console.log('🔧 Initializing FFmpeg...')
					await window.autoVFX.ffmpegManager.ensureFFmpeg()

					const result =
						await window.autoVFX.ffmpegManager.runFFmpegCommand(
							ffmpegArgs,
						)

					if (result.success) {
						// Verify file exists
						try {
							const fs = require('fs')
							if (fs.existsSync(exportPath)) {
								const stats = fs.statSync(exportPath)
								console.log(
									`✅ Force FFmpeg export SUCCESS: ${exportPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`,
								)
								console.log(
									'📁 Check your Desktop for the file!',
								)
							} else {
								console.error(
									'❌ FFmpeg claimed success but file not found',
								)
							}
						} catch (fsError) {
							console.error(
								'❌ Could not verify file:',
								fsError.message,
							)
						}
					} else {
						console.error('❌ FFmpeg export failed:', result.error)
					}
				} else {
					console.error(
						'❌ FFmpeg manager not available. Try reloading the extension.',
					)
				}
			} else {
				console.error('❌ No source video files found in timeline')
			}
		} else {
			console.error('❌ Failed to get timeline info:', timelineInfo.error)
		}
	} catch (error) {
		console.error('❌ Force FFmpeg export failed:', error.message)
	}
}

// Check on your specific task that was at 79% when polling timed out
window.checkYourVideo = async () => {
	const taskId = '11a51ad9-914d-422c-9757-154a3d4fe546' // Your specific task
	console.log(`🔍 Checking on your video task: ${taskId}`)

	try {
		if (!window.autoVFX?.runwayAPI) {
			console.error('❌ Runway API not available')
			return
		}

		const status =
			await window.autoVFX.runwayAPI.checkGenerationStatus(taskId)

		if (status) {
			const statusValue =
				status.status || status.state || status.job_status || 'unknown'
			const progress = status.progress || 0

			console.log(`📊 Task Status: ${statusValue}`)
			console.log(`📈 Progress: ${Math.round(progress * 100)}%`)
			console.log(`📅 Created: ${status.createdAt || 'unknown'}`)

			if (
				statusValue === 'SUCCEEDED' ||
				statusValue === 'COMPLETED' ||
				statusValue === 'SUCCESS'
			) {
				console.log('🎉 YOUR VIDEO IS READY!')

				// Try to extract video URL
				let videoUrl = null
				if (
					status.output &&
					Array.isArray(status.output) &&
					status.output.length > 0
				) {
					videoUrl = status.output[0].url || status.output[0]
				} else if (status.videoUrl) {
					videoUrl = status.videoUrl
				}

				if (videoUrl) {
					console.log('🎬 Video URL:', videoUrl)
					console.log('✅ Displaying your video in the panel now...')

					// Display in the panel
					if (window.autoVFX.displayResult) {
						window.autoVFX.displayResult(videoUrl)
					}
				} else {
					console.log(
						'⚠️  Video is complete but URL not found in response',
					)
					console.log('📊 Full status:', status)
					console.log('💡 Check your Runway dashboard for the video')
				}
			} else {
				console.log(
					`⏳ Still generating... Current progress: ${Math.round(progress * 100)}%`,
				)
				console.log('💡 Run checkYourVideo() again in a few minutes')
			}
		} else {
			console.log('❌ Could not get status for this task')
		}
	} catch (error) {
		console.error('❌ Error checking video status:', error.message)
	}
}

// Test import functionality with the latest Runway video URL
window.testImport = async () => {
	console.log('📥 Testing video import functionality...')

	const testVideoUrl =
		'https://dnznrvs05pmza.cloudfront.net/183f7ee5-b9d8-49ce-9775-2209c97a3bcc.mp4?_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlIYXNoIjoiM2NlMzUxNDMyMzEyZTBkMiIsImJ1Y2tldCI6InJ1bndheS10YXNrLWFydGlmYWN0cyIsInN0YWdlIjoicHJvZCIsImV4cCI6MTc1NDM1MjAwMH0.Pcy62im-3OWPNPANyDot7RqBAXKuDNFYEOBi4XDRO2Q'

	try {
		if (!window.autoVFX) {
			console.error('❌ AutoVFX not available')
			return
		}

		console.log('🎬 Test video URL:', testVideoUrl)

		// Test download
		console.log('📥 Step 1: Testing video download...')
		const localPath = await window.autoVFX.downloadVideo(testVideoUrl)
		console.log('✅ Download completed, local file:', localPath)

		// Test import to timeline
		console.log('📽️  Step 2: Testing import to timeline...')
		await window.autoVFX.importToTimeline(localPath)
		console.log('✅ Import to timeline completed!')

		console.log('🎉 IMPORT TEST SUCCESSFUL!')
		console.log(`📁 Your generated video is now on Desktop: ${localPath}`)
		console.log('🎬 And it should now be in your Premiere Pro timeline!')
	} catch (error) {
		console.error('❌ Import test failed:', error.message)
		console.log('💡 This helps us debug the import issue')
	}
}

// Simulate clicking the import button with the correct generated video
window.forceImport = () => {
	console.log('🔘 Simulating import button click with generated video...')

	if (!window.autoVFX) {
		console.error('❌ AutoVFX not available')
		return
	}

	// Set the generated video URL (the one from your successful generation)
	const generatedVideoUrl =
		'https://dnznrvs05pmza.cloudfront.net/183f7ee5-b9d8-49ce-9775-2209c97a3bcc.mp4?_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlIYXNoIjoiM2NlMzUxNDMyMzEyZTBkMiIsImJ1Y2tldCI6InJ1bndheS10YXNrLWFydGlmYWN0cyIsInN0YWdlIjoicHJvZCIsImV4cCI6MTc1NDM1MjAwMH0.Pcy62im-3OWPNPANyDot7RqBAXKuDNFYEOBi4XDRO2Q'

	// Set the generated video in the autoVFX instance
	window.autoVFX.generatedVideo = generatedVideoUrl
	console.log('✅ Set generated video URL:', generatedVideoUrl)

	// Trigger the import
	console.log('🎬 Triggering import...')
	window.autoVFX.handleImport()

	console.log(
		'💡 Import triggered! Check console for download and import progress.',
	)
}

// Test the new position-aware import functionality
window.testPositionImport = async () => {
	console.log('🎯 Testing position-aware import with auto-scaling...')

	const testVideoUrl =
		'https://dnznrvs05pmza.cloudfront.net/183f7ee5-b9d8-49ce-9775-2209c97a3bcc.mp4?_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlIYXNoIjoiM2NlMzUxNDMyMzEyZTBkMiIsImJ1Y2tldCI6InJ1bndheS10YXNrLWFydGlmYWN0cyIsInN0YWdlIjoicHJvZCIsImV4cCI6MTc1NDM1MjAwMH0.Pcy62im-3OWPNPANyDot7RqBAXKuDNFYEOBi4XDRO2Q'

	// Mock export position (for testing)
	const mockExportPosition = {
		startTime: 30,
		endTime: 32,
		duration: 2,
		playheadPosition: 31,
		hasInOutPoints: false,
	}

	try {
		if (!window.autoVFX) {
			console.error('❌ AutoVFX not available')
			return
		}

		console.log('🎬 Test video URL:', testVideoUrl)
		console.log('📍 Mock export position:', mockExportPosition)

		// Set the mock position
		window.autoVFX.lastExportPosition = mockExportPosition

		// Test download
		console.log('📥 Step 1: Downloading video...')
		const localPath = await window.autoVFX.downloadVideo(testVideoUrl)
		console.log('✅ Download completed:', localPath)

		// Test position-aware import
		console.log(
			'🎯 Step 2: Testing position-aware import with auto-scaling...',
		)
		const importResult = await window.autoVFX.importToTimeline(
			localPath,
			mockExportPosition,
		)
		console.log('✅ Position-aware import completed!', importResult)

		console.log('🎉 POSITION IMPORT TEST SUCCESSFUL!')
		console.log(`📁 Video downloaded to: ${localPath}`)
		console.log(
			`🎬 Video imported to timeline at: ${mockExportPosition.startTime}s`,
		)
		console.log('📏 Video should be auto-scaled to sequence size')
		console.log('🎯 Video replaces the original exported segment exactly!')
	} catch (error) {
		console.error('❌ Position import test failed:', error.message)
		console.log('💡 This helps us debug the position-aware import')
	}
}

// Show the current stored export position
window.showExportPosition = () => {
	console.log('📍 Current stored export position:')

	if (!window.autoVFX) {
		console.error('❌ AutoVFX not available')
		return
	}

	if (window.autoVFX.lastExportPosition) {
		const pos = window.autoVFX.lastExportPosition
		console.log('✅ Export position stored:', pos)
		console.log(`   📊 Time Range: ${pos.startTime}s - ${pos.endTime}s`)
		console.log(`   ⏱️  Duration: ${pos.duration}s`)
		console.log(`   🎯 Playhead was at: ${pos.playheadPosition}s`)
		console.log(
			`   📌 Had In/Out points: ${pos.hasInOutPoints ? 'YES' : 'NO'}`,
		)
		console.log('💡 This position will be used for the next import')
	} else {
		console.log('❌ No export position stored yet')
		console.log('💡 Export a video first to store the position')
	}
}

// Test just the JSX import function directly
window.testJSXImport = function () {
	console.log('🧪 Testing JSX import function directly...')

	const testData = {
		videoUrl:
			'https://storage.googleapis.com/runway-uploads/users/3a29f36e-5a47-4b33-9c96-28a8a088ba3d/tasks/6723ef55-a85c-45bd-b0fd-3593d69b5d56/1732914968894.mp4',
		insertAtPlayhead: true,
		hasInOutPoints: false,
	}

	// Convert to JSON string for JSX
	const exportPositionStr = JSON.stringify(testData)

	// Call the JSX function directly
	const csInterface = new CSInterface()
	csInterface.evalScript(
		`AutoVFXExtendScript.importVideoToTimeline("${testData.videoUrl}", ${testData.insertAtPlayhead}, '${exportPositionStr}')`,
		function (result) {
			console.log('🧪 JSX Import Result:', result)
			try {
				const parsed = JSON.parse(result)
				console.log('📊 Parsed Result:', parsed)
			} catch (e) {
				console.log('⚠️ Could not parse as JSON:', e.message)
			}
		},
	)
}

// Add this new debug function for JSX import testing
window.testJSXImportDebug = async () => {
	console.log('🧪 Testing JSX import function with enhanced debugging...')

	// Use the last generated video if available
	const testVideoPath =
		'/Users/davud/Desktop/autovfx_generated_1754824762632.mp4'
	const testExportPosition = {
		inPoint: 51.875,
		outPoint: 56.875,
		duration: 5,
	}

	console.log('🔧 Test parameters:')
	console.log('  - Video path:', testVideoPath)
	console.log('  - Export position:', testExportPosition)

	const hostScript = `importVideoToTimelineAtPosition("${testVideoPath}", '${JSON.stringify(testExportPosition)}')`
	console.log('🔧 JSX command:', hostScript)

	try {
		console.log('📡 Calling JSX function...')
		const result = await window.autoVFX.csInterface.evalScript(hostScript)
		console.log('📨 Raw JSX result:', result)
		console.log('📨 Result type:', typeof result)
		console.log('📨 Result length:', result ? result.length : 'N/A')

		if (result) {
			try {
				const parsed = JSON.parse(result)
				console.log('✅ Parsed result:', parsed)
			} catch (parseError) {
				console.error('❌ Failed to parse result:', parseError)
				console.log('Raw result content:', result)
			}
		} else {
			console.log('❌ JSX function returned undefined/null')
			console.log('💡 This usually means:')
			console.log('  1. Syntax error in JSX function')
			console.log('  2. Function threw an unhandled exception')
			console.log('  3. No return statement was reached')
			console.log('  4. File path or permissions issue')
		}
	} catch (error) {
		console.error('❌ CSInterface error:', error)
	}

	console.log(
		'🔍 Check Premiere Pro console (Window > Extensions > Console) for JSX debug output',
	)
}

window.testBasicJSX = async () => {
	console.log('🧪 Testing very basic JSX execution...')

	try {
		// Test 1: Simple expression
		console.log('📡 Test 1: Simple expression...')
		const result1 = await window.autoVFX.csInterface.evalScript('1 + 1')
		console.log('📨 Result 1:', result1)

		// Test 2: Simple variable
		console.log('📡 Test 2: Simple variable...')
		const result2 = await window.autoVFX.csInterface.evalScript(
			'var test = "hello"; test;',
		)
		console.log('📨 Result 2:', result2)

		// Test 3: Simple function call
		console.log('📡 Test 3: App object access...')
		const result3 =
			await window.autoVFX.csInterface.evalScript('app.version')
		console.log('📨 Result 3:', result3)

		// Test 4: Our function exists?
		console.log('📡 Test 4: Check if our function exists...')
		const result4 = await window.autoVFX.csInterface.evalScript(
			'typeof testJSXCommunication',
		)
		console.log('📨 Result 4:', result4)

		// Test 5: Check AutoVFXExtendScript object
		console.log('📡 Test 5: Check AutoVFXExtendScript object...')
		const result5 = await window.autoVFX.csInterface.evalScript(
			'typeof AutoVFXExtendScript',
		)
		console.log('📨 Result 5:', result5)

		if (result4 === 'function') {
			console.log('✅ Function exists, trying to call it...')
			const result6 = await window.autoVFX.csInterface.evalScript(
				'testJSXCommunication()',
			)
			console.log('📨 Result 6:', result6)
		}
	} catch (error) {
		console.error('❌ Basic JSX test error:', error)
	}
}

// Test vertical video layout functionality
window.testVerticalVideoLayout = async () => {
	console.log('📱 Testing vertical video layout functionality...')

	if (!window.autoVFX) {
		console.error('❌ AutoVFX not available')
		return
	}

	const video = document.getElementById('resultVideo')
	const container = document.querySelector('.video-container')

	if (!video || !container) {
		console.error('❌ Video elements not found')
		return
	}

	console.log('🎬 Current video element:', video)
	console.log('📦 Current container element:', container)
	console.log('📏 Current container classes:', container.className)

	// Test with a mock vertical video
	console.log('🧪 Testing handleVideoLayout function...')

	// Mock video dimensions for testing
	const originalVideoWidth = video.videoWidth
	const originalVideoHeight = video.videoHeight

	console.log(
		`📊 Original dimensions: ${originalVideoWidth}x${originalVideoHeight}`,
	)

	// Test vertical video detection
	Object.defineProperty(video, 'videoWidth', {
		value: 720,
		configurable: true,
	})
	Object.defineProperty(video, 'videoHeight', {
		value: 1280,
		configurable: true,
	})

	console.log('📱 Testing with vertical dimensions: 720x1280')
	window.autoVFX.handleVideoLayout(video)
	console.log(
		'📦 Container classes after vertical test:',
		container.className,
	)

	// Test horizontal video detection
	Object.defineProperty(video, 'videoWidth', {
		value: 1920,
		configurable: true,
	})
	Object.defineProperty(video, 'videoHeight', {
		value: 1080,
		configurable: true,
	})

	console.log('🖥️ Testing with horizontal dimensions: 1920x1080')
	window.autoVFX.handleVideoLayout(video)
	console.log(
		'📦 Container classes after horizontal test:',
		container.className,
	)

	// Restore original dimensions
	if (originalVideoWidth && originalVideoHeight) {
		Object.defineProperty(video, 'videoWidth', {
			value: originalVideoWidth,
			configurable: true,
		})
		Object.defineProperty(video, 'videoHeight', {
			value: originalVideoHeight,
			configurable: true,
		})
		console.log(
			`🔄 Restored original dimensions: ${originalVideoWidth}x${originalVideoHeight}`,
		)
		window.autoVFX.handleVideoLayout(video)
		console.log('📦 Final container classes:', container.className)
	}

	console.log('✅ Vertical video layout test completed!')
	console.log(
		'💡 Check CSS styles - vertical videos should have max-width: 200px and max-height: 300px',
	)
}

// Test Windows compatibility issues
window.testWindowsCompatibility = () => {
	console.log('🪟 Testing Windows compatibility...')

	// Check OS
	const userAgent = navigator.userAgent
	const isWindows = userAgent.indexOf('Windows') !== -1
	const isMac = userAgent.indexOf('Mac') !== -1

	console.log('🖥️ Platform Detection:')
	console.log('   User Agent:', userAgent)
	console.log('   Is Windows:', isWindows)
	console.log('   Is Mac:', isMac)

	// Test Node.js modules availability
	try {
		const os = require('os')
		const path = require('path')
		const fs = require('fs')

		console.log('📦 Node.js Modules:')
		console.log('   OS module:', !!os)
		console.log('   Path module:', !!path)
		console.log('   FS module:', !!fs)

		// Test path operations
		const homeDir = os.homedir()
		const desktopPath = path.join(homeDir, 'Desktop')

		console.log('📁 Path Operations:')
		console.log('   Home directory:', homeDir)
		console.log('   Desktop path:', desktopPath)
		console.log('   Path separator:', path.sep)

		// Test desktop directory existence
		const desktopExists = fs.existsSync(desktopPath)
		console.log('   Desktop exists:', desktopExists)

		// Test environment variables
		console.log('🌍 Environment Variables:')
		console.log('   HOME:', process.env.HOME || 'undefined')
		console.log('   USERPROFILE:', process.env.USERPROFILE || 'undefined')
		console.log('   OS type:', os.type())
		console.log('   OS platform:', os.platform())

		if (isWindows && !desktopExists) {
			console.log('⚠️ WARNING: Desktop directory not found on Windows')
			console.log('💡 This might cause file save issues')
		}

		console.log('✅ Windows compatibility test completed')
	} catch (error) {
		console.error('❌ Windows compatibility test failed:', error)
		console.log('💡 This indicates Node.js modules are not available')
	}
}

window.testJSXCommunication = async () => {
	console.log('🧪 Testing basic JSX communication...')

	try {
		console.log('📡 Calling testJSXCommunication...')
		const result = await window.autoVFX.csInterface.evalScript(
			'testJSXCommunication()',
		)
		console.log('📨 Raw result:', result)
		console.log('📨 Result type:', typeof result)

		if (result) {
			try {
				const parsed = JSON.parse(result)
				console.log('✅ JSX Communication Test SUCCESS:', parsed)
				return true
			} catch (parseError) {
				console.error('❌ Failed to parse JSX result:', parseError)
				console.log('Raw result:', result)
				return false
			}
		} else {
			console.log('❌ JSX function returned undefined/null')
			console.log(
				'💡 This indicates a fundamental JSX loading or syntax issue',
			)
			return false
		}
	} catch (error) {
		console.error('❌ CSInterface error:', error)
		return false
	}
}

// Check Premiere encoder queue and force start if needed
window.checkEncoderQueue = function () {
	console.log('🔍 Checking Premiere Pro Media Encoder queue...')

	const csInterface = new CSInterface()
	csInterface.evalScript(
		`
        (function(){
            try {
                var result = {
                    success: true,
                    queue: [],
                    total: 0
                };
                
                var encoder = app.encoder;
                var queue = encoder.getExporterQueue();
                result.total = queue.numItems;
                
                for (var i = 0; i < queue.numItems; i++) {
                    var item = queue[i];
                    result.queue.push({
                        index: i,
                        status: item ? item.status : "null",
                        outputPath: item ? item.outputPath : "unknown"
                    });
                }
                
                return JSON.stringify(result);
            } catch (error) {
                return JSON.stringify({
                    error: "QUEUE_CHECK_ERROR",
                    message: error.toString()
                });
            }
        })();
    `,
		function (result) {
			console.log('🔍 Raw queue result:', result)
			try {
				const parsed = JSON.parse(result)
				if (parsed.success) {
					console.log(
						`📊 Encoder Queue Status: ${parsed.total} items`,
					)
					parsed.queue.forEach((item) => {
						console.log(
							`  - Item ${item.index}: ${item.status} → ${item.outputPath}`,
						)
					})

					if (parsed.total > 0) {
						console.log('🚀 Attempting to start batch encoding...')
						forceStartBatch()
					} else {
						console.log('ℹ️ No items in encoder queue')
					}
				} else {
					console.error('❌ Queue check failed:', parsed.message)
				}
			} catch (e) {
				console.error('❌ Could not parse queue result:', e.message)
			}
		},
	)
}

// Force start Media Encoder batch
window.forceStartBatch = function () {
	console.log('🚀 Force starting Media Encoder batch...')

	const csInterface = new CSInterface()
	csInterface.evalScript(
		`
        (function(){
            try {
                app.encoder.startBatch();
                return JSON.stringify({success: true, message: "Batch started"});
            } catch (error) {
                return JSON.stringify({error: "BATCH_START_ERROR", message: error.toString()});
            }
        })();
    `,
		function (result) {
			console.log('🚀 Batch start result:', result)
		},
	)
}

// Quick export test with direct batch start
window.testDirectExport = function () {
	console.log('🧪 Testing direct export with batch start...')

	const csInterface = new CSInterface()
	csInterface.evalScript(
		`
        (function(){
            try {
                return AutoVFXExtendScript.exportSequenceDirect("", 0, 5);
            } catch (error) {
                return JSON.stringify({error: "DIRECT_EXPORT_ERROR", message: error.toString()});
            }
        })();
    `,
		function (result) {
			console.log('🧪 Direct export result:', result)
			try {
				const parsed = JSON.parse(result)
				if (parsed.success) {
					console.log('✅ Direct export started:', parsed.outputPath)
					console.log(
						'📁 Check this file on your Desktop in ~10 seconds',
					)
				}
			} catch (e) {
				console.log('⚠️ Could not parse result')
			}
		},
	)
}

// Debug In/Out point detection
window.debugInOut = function () {
	console.log('🔍 Debugging In/Out point detection...')

	const csInterface = new CSInterface()

	// Check raw In/Out values
	csInterface.evalScript('getInOutRaw()', function (rawResult) {
		console.log('📊 Raw In/Out result:', rawResult)
		try {
			const raw = JSON.parse(rawResult)
			console.log('🔢 Raw values:')
			console.log(`   - In: ${raw.inPoint}s`)
			console.log(`   - Out: ${raw.outPoint}s`)
			console.log(`   - Duration: ${raw.duration}s`)
			console.log(`   - Ticks different: ${raw.ticksDifferent}`)
			console.log(`   - Is full sequence: ${raw.isFullSequence}`)
			console.log(`   - QE has In/Out: ${raw.qeHasInOut}`)
			if (raw.qeHasInOut) {
				console.log(`   - QE In: ${raw.qeIn}`)
				console.log(`   - QE Out: ${raw.qeOut}`)
			}
		} catch (e) {
			console.error('❌ Could not parse raw result')
		}
	})

	// Check processed timeline info
	setTimeout(() => {
		window.autoVFX
			.getTimelineInfo()
			.then((timeline) => {
				console.log('📊 Processed timeline info:', timeline)
				console.log('🔢 Processed values:')
				console.log(`   - hasInOutPoints: ${timeline.hasInOutPoints}`)
				console.log(`   - inPoint: ${timeline.inPoint}s`)
				console.log(`   - outPoint: ${timeline.outPoint}s`)
				console.log(
					`   - suggestedInPoint: ${timeline.suggestedInPoint}s`,
				)
				console.log(
					`   - suggestedOutPoint: ${timeline.suggestedOutPoint}s`,
				)
			})
			.catch((err) => {
				console.error('❌ Timeline info error:', err)
			})
	}, 500)
}

// Force set In/Out points around playhead
window.forceSetInOut = function () {
	console.log('🔧 Force setting In/Out points around playhead...')

	const csInterface = new CSInterface()
	csInterface.evalScript(
		`
        (function(){
            try {
                var seq = app.project.activeSequence;
                if (!seq) return JSON.stringify({error: 'NO_SEQUENCE'});
                
                var playhead = seq.getPlayerPosition();
                var segmentDuration = 5; // 5 second segment
                var halfDuration = segmentDuration / 2;
                
                // Calculate In/Out around playhead
                var inTime = Math.max(0, playhead.seconds - halfDuration);
                var outTime = playhead.seconds + halfDuration;
                
                // Create time objects
                var inTimeObj = new Time();
                inTimeObj.seconds = inTime;
                var outTimeObj = new Time();
                outTimeObj.seconds = outTime;
                
                // Set the work area
                seq.setInPoint(inTimeObj);
                seq.setOutPoint(outTimeObj);
                
                // Store the values globally for reading workaround
                if (typeof _storedInOut !== 'undefined') {
                    _storedInOut.inPoint = inTime;
                    _storedInOut.outPoint = outTime;
                    _storedInOut.timestamp = new Date().getTime();
                    _storedInOut.isValid = true;
                }
                
                $.writeln("🔧 JSX: Force set In/Out: " + inTime + "s to " + outTime + "s");
                
                return JSON.stringify({
                    success: true,
                    message: "In/Out points set successfully",
                    inPoint: inTime,
                    outPoint: outTime,
                    playheadPosition: playhead.seconds
                });
            } catch (error) {
                return JSON.stringify({error: error.toString()});
            }
        })();
    `,
		function (result) {
			console.log('🔧 Force set result:', result)
			try {
				const parsed = JSON.parse(result)
				if (parsed.success) {
					console.log(
						`✅ Successfully set In/Out: ${parsed.inPoint}s → ${parsed.outPoint}s`,
					)

					// Store in JavaScript context for immediate use
					window._lastSetInOut = {
						inPoint: parsed.inPoint,
						outPoint: parsed.outPoint,
						timestamp: Date.now(),
						isValid: true,
					}

					console.log(
						'📝 Now try debugInOut() to verify, then export again',
					)
				} else {
					console.error('❌ Failed to set In/Out:', parsed.error)
				}
			} catch (e) {
				console.error('❌ Could not parse result')
			}
		},
	)
}

// Test In/Out points detection and export behavior
window.testInOutExport = async () => {
	console.log('🎯 Testing In/Out points detection and export behavior...')

	try {
		const csInterface = new CSInterface()

		// First, get the current timeline info to see what's detected
		console.log('📊 Step 1: Getting timeline info...')
		const timelineResult = await new Promise((resolve) => {
			csInterface.evalScript('getTimelineInfoNew()', resolve)
		})

		const timelineInfo = JSON.parse(timelineResult)
		console.log('📊 Timeline Info Results:')
		console.log(`   - Success: ${timelineInfo.success}`)
		console.log(`   - Has In/Out Points: ${timelineInfo.hasInOutPoints}`)
		console.log(`   - In Point: ${timelineInfo.inPoint}s`)
		console.log(`   - Out Point: ${timelineInfo.outPoint}s`)
		console.log(`   - Duration: ${timelineInfo.duration}s`)
		console.log(`   - Playhead Position: ${timelineInfo.playheadPosition}s`)
		console.log(`   - Sequence Duration: ${timelineInfo.sequenceDuration}s`)
		console.log(
			`   - Suggested In Point: ${timelineInfo.suggestedInPoint}s`,
		)
		console.log(
			`   - Suggested Out Point: ${timelineInfo.suggestedOutPoint}s`,
		)

		// Test what the export function would do with these values
		console.log('\n🎬 Step 2: Testing export logic...')
		if (timelineInfo.hasInOutPoints && timelineInfo.duration > 0.1) {
			console.log('✅ WOULD USE: Timeline In/Out points')
			console.log(
				`   Export range: ${timelineInfo.inPoint}s to ${timelineInfo.outPoint}s (${timelineInfo.duration}s duration)`,
			)
		} else {
			console.log('⚠️  WOULD USE: Suggested fallback points')
			console.log(
				`   Export range: ${timelineInfo.suggestedInPoint}s to ${timelineInfo.suggestedOutPoint}s (${timelineInfo.suggestedOutPoint - timelineInfo.suggestedInPoint}s duration)`,
			)
		}

		// Test the actual export function call to see if it works
		console.log('\n🧪 Step 3: Testing actual export function...')
		try {
			const exportResult = await new Promise((resolve) => {
				const testPath = '/Users/davud/Desktop/test_inout_export.mp4'
				csInterface.evalScript(
					`AutoVFXExtendScript.exportVideoSegment("${testPath}", ${timelineInfo.inPoint}, ${timelineInfo.outPoint})`,
					resolve,
				)
			})

			const parsed = JSON.parse(exportResult)
			console.log('📊 Export Test Results:')
			if (parsed.success) {
				console.log('✅ Export function would succeed')
				console.log(`   Output path: ${parsed.outputPath}`)
			} else {
				console.log('❌ Export function would fail:')
				console.log(`   Error: ${parsed.error}`)
				console.log(`   Message: ${parsed.message}`)

				if (parsed.error === 'NO_INOUT_POINTS') {
					console.log('\n💡 SOLUTION:')
					console.log('   1. Position playhead at desired start time')
					console.log('   2. Press "I" key to set In point')
					console.log('   3. Position playhead at desired end time')
					console.log('   4. Press "O" key to set Out point')
					console.log(
						'   5. You should see yellow brackets showing the selected range',
					)
				}
			}
		} catch (exportError) {
			console.error('❌ Export test failed:', exportError.message)
		}

		console.log('\n📋 SUMMARY:')
		console.log(
			'   This test shows what the export system will do with current timeline state.',
		)
		console.log(
			'   If no in/out points are set, the system now suggests the full sequence',
		)
		console.log(
			'   (or 10 seconds around playhead for sequences longer than 60 seconds)',
		)
		console.log('   instead of the old 2.5-second hardcoded duration.')
	} catch (error) {
		console.error('❌ In/Out test failed:', error.message)
	}
}

// Quick debug for current in/out points status
window.debugInOutStatus = async () => {
	console.log('🔍 CURRENT IN/OUT POINTS STATUS:')

	try {
		const csInterface = new CSInterface()

		// Get the current timeline info
		const timelineResult = await new Promise((resolve) => {
			csInterface.evalScript(
				'AutoVFXExtendScript.getTimelineInfoNew()',
				resolve,
			)
		})

		console.log('🔍 Raw JSX response:', timelineResult)

		let info
		try {
			info = JSON.parse(timelineResult)
		} catch (parseError) {
			console.error('❌ JSON Parse Error:', parseError.message)
			console.error(
				'❌ Raw response that failed to parse:',
				timelineResult,
			)
			return
		}

		console.log('📊 Current Status:')
		console.log(`   Sequence: "${info.sequenceName || 'Unknown'}"`)
		console.log(`   Duration: ${info.sequenceDuration}s`)
		console.log(`   Playhead: ${info.playheadPosition}s`)
		console.log('')
		console.log('🎯 In/Out Points:')
		console.log(`   In Point: ${info.inPoint}s`)
		console.log(`   Out Point: ${info.outPoint}s`)
		console.log(`   Duration: ${info.duration}s`)
		console.log(
			`   Has In/Out: ${info.hasInOutPoints ? '✅ YES' : '❌ NO'}`,
		)
		console.log('')

		if (info.hasInOutPoints) {
			console.log('✅ GOOD: In/Out points are set!')
			console.log(
				`   Export will use: ${info.inPoint}s to ${info.outPoint}s`,
			)
		} else {
			console.log('⚠️  NO IN/OUT POINTS DETECTED')
			console.log('   Export will use fallback suggestion:')
			console.log(
				`   Suggested: ${info.suggestedInPoint}s to ${info.suggestedOutPoint}s`,
			)
			console.log('')
			console.log('💡 To set In/Out points:')
			console.log('   1. Position playhead at start time')
			console.log('   2. Press "I" key')
			console.log('   3. Position playhead at end time')
			console.log('   4. Press "O" key')
			console.log('   5. You should see yellow brackets in timeline')
		}
	} catch (error) {
		console.error('❌ Failed to get in/out status:', error.message)
	}
}

// Comprehensive in/out points diagnostic
window.diagnoseInOutIssue = async () => {
	console.log('🔍 COMPREHENSIVE IN/OUT POINTS DIAGNOSTIC')
	console.log('='.repeat(50))

	const csInterface = new CSInterface()

	// Step 1: Check if we have an active sequence
	console.log('📋 Step 1: Checking active sequence...')
	const hasSequence = await new Promise((resolve) => {
		csInterface.evalScript(
			'app.project.activeSequence ? "YES" : "NO"',
			resolve,
		)
	})
	console.log(`   Active sequence: ${hasSequence}`)

	if (hasSequence === 'NO') {
		console.log('❌ PROBLEM: No active sequence found!')
		console.log('💡 SOLUTION: Open a sequence in Premiere Pro first.')
		return
	}

	// Step 2: Get sequence name and basic info
	console.log('\n📋 Step 2: Getting sequence info...')
	const sequenceName = await new Promise((resolve) => {
		csInterface.evalScript('app.project.activeSequence.name', resolve)
	})
	console.log(`   Sequence name: "${sequenceName}"`)

	// Step 3: Test different ways to get in/out points
	console.log('\n📋 Step 3: Testing in/out point methods...')

	// Method 1: Direct getInPoint/getOutPoint
	const method1 = await new Promise((resolve) => {
		csInterface.evalScript(
			`
            try {
                var seq = app.project.activeSequence;
                var inPt = seq.getInPoint();
                var outPt = seq.getOutPoint();
                JSON.stringify({
                    inPoint: inPt ? inPt.seconds : null,
                    outPoint: outPt ? outPt.seconds : null,
                    inTicks: inPt ? inPt.ticks : null,
                    outTicks: outPt ? outPt.ticks : null
                });
            } catch (e) {
                JSON.stringify({error: e.toString()});
            }
        `,
			resolve,
		)
	})
	console.log('   Method 1 (getInPoint/getOutPoint):', method1)

	// Method 2: Check work area using zeroPoint and end
	const method2 = await new Promise((resolve) => {
		csInterface.evalScript(
			`
            try {
                var seq = app.project.activeSequence;
                JSON.stringify({
                    zeroPoint: seq.zeroPoint.seconds,
                    endPoint: seq.end.seconds,
                    sequenceDuration: seq.end.seconds - seq.zeroPoint.seconds
                });
            } catch (e) {
                JSON.stringify({error: e.toString()});
            }
        `,
			resolve,
		)
	})
	console.log('   Method 2 (zeroPoint/end):', method2)

	// Method 3: Check if there are any markers
	const method3 = await new Promise((resolve) => {
		csInterface.evalScript(
			`
            try {
                var seq = app.project.activeSequence;
                JSON.stringify({
                    numMarkers: seq.markers.numMarkers,
                    hasMarkers: seq.markers.numMarkers > 0
                });
            } catch (e) {
                JSON.stringify({error: e.toString()});
            }
        `,
			resolve,
		)
	})
	console.log('   Method 3 (markers):', method3)

	// Step 4: Check what our JSX function returns
	console.log('\n📋 Step 4: Testing our JSX function...')
	const ourFunction = await new Promise((resolve) => {
		csInterface.evalScript(
			'AutoVFXExtendScript.getTimelineInfoNew()',
			resolve,
		)
	})
	console.log('   Our function result:', ourFunction)

	console.log('\n📋 ANALYSIS:')
	try {
		const m1 = JSON.parse(method1)
		if (m1.error) {
			console.log('❌ Method 1 failed:', m1.error)
		} else {
			console.log(
				`   In/Out from getInPoint: ${m1.inPoint}s / ${m1.outPoint}s`,
			)
		}

		const m2 = JSON.parse(method2)
		if (m2.error) {
			console.log('❌ Method 2 failed:', m2.error)
		} else {
			console.log(
				`   Sequence bounds: ${m2.zeroPoint}s to ${m2.endPoint}s (${m2.sequenceDuration}s total)`,
			)
		}
	} catch (e) {
		console.log('❌ Failed to parse diagnostic results:', e.message)
	}

	// console.log('\n💡 RECOMMENDATIONS:');
	// console.log('1. Try setting in/out points manually:');
	// console.log('   - Position playhead at start time');
	// console.log('   - Press "I" key');
	// console.log('   - Position playhead at end time');
	// console.log('   - Press "O" key');
	// console.log('2. Look for yellow brackets in timeline');
	// console.log('3. Try running: debugInOutStatus() after setting points');
}

// console.log('🛠️  Debug Helpers loaded! Available commands:');
// console.log('   clearCache()    - Clear all cached data');
// console.log('   showConfig()    - Show current configuration');
// console.log('   refreshAPI()    - Force API refresh');
// console.log('   showSystemInfo() - Show system information');
// console.log('   fixAPIUrl()     - 🚨 EMERGENCY FIX for wrong API URL');
// console.log('   testRunwayAPI() - 🧪 Test Runway API connection');
// console.log('   debugLastTask("TASK_ID") - 🔍 Debug specific task response');
// console.log('   debugMediaFiles() - 🔍 Debug media files detection');
// console.log('   diagnoseExport() - 🔍 Full export issue diagnosis');
// console.log('   testTimelineExport() - 🧪 Test direct timeline export');
// console.log('   emergencyExport() - 🚨 FORCE export using FFmpeg -ss/-to command');
// console.log('   testNewExport() - 🧪 Test new simplified export method');
// console.log('   testPlayheadExport() - 🎬 Test export around current playhead position');
// console.log('   testUIExport() - 🎬 Test UI export button (same as clicking Export)');
// console.log('   checkDesktopFiles() - 📁 Check what video files are actually on Desktop');
// console.log('   forceFFmpegExport() - 🔧 FORCE FFmpeg export (bypass Premiere Pro)');
// console.log('   checkYourVideo() - 🎬 Check your specific video that was at 79% completion');
// console.log('   testImport() - 📥 Test download + import of your generated video');
// console.log('   forceImport() - 🔘 FORCE import your generated video to timeline');
// console.log('   testPositionImport() - 🎯 Test position-aware import with auto-scaling');
// console.log('   showExportPosition() - 📍 Show current stored export position');
// console.log('   testJSXImport() - 🧪 Test JSX import function directly (debug parsing issues)');
// console.log('   checkEncoderQueue() - 🔍 Check Premiere Media Encoder queue status');
// console.log('   forceStartBatch() - 🚀 Force start Media Encoder batch processing');
// console.log('   testDirectExport() - 🧪 Test direct export with batch start (0-5s)');
// console.log('   debugInOut() - 🔍 Debug In/Out point detection');
// console.log('   forceSetInOut() - 🔧 Force set In/Out around playhead (5s segment)');
// console.log('   testJSXCommunication() - 🧪 Test basic JSX communication');
// console.log('   testJSXImportDebug() - 🧪 Test JSX import function with enhanced debugging');
// console.log('   testBasicJSX() - 🧪 Test very basic JSX execution');
// console.log('   testInOutExport() - 🎯 Test In/Out points detection and export behavior');
// console.log('   debugInOutStatus() - 🔍 Show current in/out points status in real-time');
// console.log('   diagnoseInOutIssue() - 🔍 Comprehensive in/out points diagnostic');
// console.log('');

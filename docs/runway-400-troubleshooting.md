# Runway 400 Error Troubleshooting Guide

## Overview

This guide helps troubleshoot the common 400 errors users experience when using the Runway API integration. The enhanced error handling system now provides detailed diagnostics to help identify and resolve these issues.

## Recent Improvements

### 1. Comprehensive Asset Validation
- **File size validation**: Checks both original file and base64-encoded size
- **Format validation**: Ensures video format is supported (MP4, MOV, AVI, WebM)
- **Dimension validation**: Checks for 8000px maximum dimension limit
- **Aspect ratio validation**: Warns about unusual aspect ratios
- **Data URI validation**: Ensures proper base64 encoding

### 2. Enhanced Error Logging
When a 400 error occurs, the system now logs:
- Exact error message and field causing the issue
- Request body size and structure
- Specific error analysis based on Runway documentation
- Asset validation results
- Request timing information

### 3. Request Throttling
- **Concurrent request limiting**: Max 3 simultaneous requests
- **Rate limiting**: 1-second minimum interval between requests  
- **Request queuing**: Automatic queuing when limits are reached
- **Smart retry mechanism**: Exponential backoff for transient errors

## Common 400 Error Causes & Solutions

### 1. Asset-Related Errors

#### "Invalid data URI"
**Cause**: Video file is corrupted or improperly encoded
**Solutions**:
- Re-export video from After Effects
- Try a different video format (MP4 recommended)
- Check if file is corrupted

#### "Unsupported asset type"
**Cause**: Video format not supported by Runway
**Solutions**:
- Use supported formats: MP4, MOV, AVI, WebM
- Re-export with H.264 codec for MP4

#### "Asset size exceeds 16MB"
**Cause**: Video file too large (including base64 expansion)
**Solutions**:
- Reduce video length
- Lower video quality/bitrate
- Use smaller resolution
- Compress video before processing

#### "Invalid asset dimensions"
**Cause**: Video resolution exceeds 8000px on either side
**Solutions**:
- Scale down video resolution
- Use standard resolutions (1080p, 720p, etc.)

#### "Invalid asset aspect ratio"
**Cause**: Aspect ratio outside acceptable range
**Solutions**:
- Use standard aspect ratios (16:9, 4:3, 1:1)
- Crop or letterbox unusual aspect ratios

### 2. Server/Network Errors

#### "Failed to fetch asset"
**Cause**: Runway's servers couldn't download the asset
**Solutions**:
- Wait and retry (often temporary server issues)
- Check internet connection
- Try again during off-peak hours

#### "Timeout while fetching asset"
**Cause**: Asset download took longer than 10 seconds
**Solutions**:
- Reduce file size
- Check internet connection speed
- Retry during better network conditions

### 3. Request Overload Errors

#### Multiple concurrent requests
**Cause**: Too many requests sent simultaneously
**Solutions**:
- The system now automatically throttles requests
- Wait for current generation to complete before starting new ones
- Avoid rapid-fire submissions

## Debugging Steps

### 1. Check Console Logs
When a 400 error occurs, check the browser console for detailed error analysis:
```
🚨 400 Error Debug Info:
🔍 Error Analysis:
Field with error: videoUri
Error message: Invalid data URI format
```

### 2. Asset Validation Results
Look for asset validation warnings:
```
⚠️ Asset validation warnings: 
- Video type "video/avi" may not be supported. Recommended: MP4, MOV, AVI, WebM
- Unusual aspect ratio (3.56), may be rejected by Runway
```

### 3. Request Throttling Logs
Monitor request management:
```
⏳ Request generate-123 queued (3/3 active)
🚀 Executing request generate-123 (2/3 active)
```

### 4. Retry Mechanism
Watch for automatic retries:
```
⏳ Attempt 1 failed, retrying in 2000ms...
Error: API request failed: 400 - Failed to fetch asset
```

## Prevention Best Practices

### 1. Video Preparation
- **Format**: Use MP4 with H.264 codec
- **Size**: Keep under 12MB raw file size
- **Resolution**: Use standard resolutions (max 4K)
- **Aspect Ratio**: Stick to common ratios (16:9, 4:3, 1:1)
- **Duration**: Shorter clips work more reliably

### 2. Usage Patterns
- **Single requests**: Wait for completion before new requests
- **Off-peak usage**: Use during less busy times when possible
- **Stable connection**: Ensure reliable internet connection

### 3. Error Handling
- **Check logs**: Always review console output for specific errors
- **Retry logic**: The system automatically retries transient errors
- **Asset validation**: Pay attention to validation warnings

## Technical Details

### Request Throttling Configuration
```javascript
maxConcurrentRequests: 3,     // Maximum simultaneous requests
minRequestInterval: 1000,     // 1 second between requests
```

### Retry Configuration
```javascript
maxRetries: 3,               // Maximum retry attempts
baseDelay: 2000,            // Initial retry delay (2 seconds)
// Exponential backoff: 2s, 4s, 8s
```

### Validation Limits
- **File size**: 16MB maximum
- **Dimensions**: 8000px maximum per side
- **Aspect ratio**: 0.1 to 10.0 range (with warnings)
- **Formats**: MP4, MOV, AVI, WebM

## When to Contact Support

Contact support if you experience:
- Consistent 400 errors with valid assets
- Errors that persist after following troubleshooting steps
- Unusual error messages not covered in this guide
- Performance issues despite following best practices

## Monitoring & Analytics

The enhanced logging system now tracks:
- Error frequency and patterns
- Asset validation failure rates
- Request throttling effectiveness
- Retry success rates

This data helps identify systemic issues and improve the integration over time.

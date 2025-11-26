# Expo CLI Network Error - Troubleshooting Guide

## Problem
Network error while Expo CLI fetches native module versions.

## Common Causes & Solutions

### 1. **Clear Expo Cache**
The cache might be corrupted. Clear it and try again:

```bash
cd mobile
npx expo start --clear
```

Or manually clear the cache:
```bash
rm -rf node_modules/.cache
rm -rf .expo
npx expo start --clear
```

### 2. **Check Network Connectivity**
Verify your internet connection:
```bash
ping expo.io
ping registry.npmjs.org
```

### 3. **Use Offline Mode (Skip Version Checks)**
If you're in a restricted network environment, you can skip version checks:

```bash
npx expo start --offline
```

Or set environment variable:
```bash
EXPO_OFFLINE=1 npx expo start
```

### 4. **Check Firewall/Proxy Settings**
If you're behind a corporate firewall or proxy:

- Configure npm proxy:
```bash
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080
```

- Or use environment variables:
```bash
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080
```

### 5. **Disable VPN**
If you're using a VPN, try disabling it temporarily as it might interfere with DNS resolution.

### 6. **Update Expo CLI**
Ensure you're using the latest version:

```bash
npm install -g expo-cli@latest
# Or use npx (recommended)
npx expo-cli@latest start
```

### 7. **Check DNS Resolution**
Try using a different DNS server (e.g., Google DNS: 8.8.8.8, 8.8.4.4):

```bash
# Linux - Edit /etc/resolv.conf or use systemd-resolved
# Or temporarily:
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
```

### 8. **Use Local Package Registry**
If you have a local npm registry or mirror:

```bash
npm config set registry https://your-registry-url
```

### 9. **Check Package Versions Manually**
Verify your package versions are compatible with Expo SDK 54:

```bash
cd mobile
npm list expo
npm list react-native
```

### 10. **Reinstall Dependencies**
Sometimes corrupted node_modules can cause issues:

```bash
cd mobile
rm -rf node_modules package-lock.json
npm install
```

### 11. **Set Expo Environment Variables**
Try setting these environment variables to help with debugging:

```bash
export EXPO_DEBUG=true
export EXPO_NO_DOTENV=1
npx expo start
```

### 12. **Check Expo Status**
Verify Expo services are operational:
- Visit: https://status.expo.dev/
- Check: https://expo.io/status

### 13. **Use Specific Expo SDK Version**
If you need to pin to a specific version, you can specify it in your `app.json`:

```json
{
  "expo": {
    "sdkVersion": "54.0.0"
  }
}
```

### 14. **Bypass Version Check (Advanced)**
If you're certain about your native module versions, you can modify the Expo CLI behavior by setting:

```bash
export EXPO_SKIP_NATIVE_VERSION_CHECK=1
npx expo start
```

### 15. **Check for Conflicting Packages**
Some packages might conflict with Expo's version checking:

```bash
cd mobile
npm outdated
```

## Quick Fix Commands (Try in Order)

1. **Quick cache clear:**
   ```bash
   cd mobile
   npx expo start --clear
   ```

2. **Full reset:**
   ```bash
   cd mobile
   rm -rf node_modules .expo
   npm install
   npx expo start --clear
   ```

3. **Offline mode:**
   ```bash
   cd mobile
   EXPO_OFFLINE=1 npx expo start
   ```

4. **Skip version check:**
   ```bash
   cd mobile
   EXPO_SKIP_NATIVE_VERSION_CHECK=1 npx expo start
   ```

## Still Having Issues?

If none of the above work:

1. **Check Expo CLI logs:**
   - Look for specific error messages in the terminal
   - Check if it's a timeout, DNS error, or connection refused

2. **Try different network:**
   - Switch to a different WiFi network
   - Use mobile hotspot
   - Test from a different location

3. **Report the issue:**
   - Check Expo GitHub issues: https://github.com/expo/expo/issues
   - Include your Expo SDK version, Node version, and full error message

## Your Current Configuration

- **Expo SDK:** 54.0.25
- **React Native:** 0.81.5
- **Node:** Check with `node --version`
- **npm:** Check with `npm --version`

## Recommended Next Steps

1. Start with solution #1 (clear cache)
2. If that fails, try solution #3 (offline mode)
3. If you need version checks, try solution #6 (update CLI)
4. For persistent issues, try solution #10 (reinstall dependencies)


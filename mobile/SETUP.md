# Liberty Social Mobile App - Setup Guide

## Initial Setup

1. **Navigate to mobile directory**:
```bash
cd mobile
```

2. **Install dependencies**:
```bash
npm install
```

3. **Install Expo CLI globally** (if not already installed):
```bash
npm install -g expo-cli
```

4. **Configure API endpoint**:
   - Edit `constants/API.ts`
   - Update the API_BASE URL:
     - **iOS Simulator**: Use `localhost:8000` or your machine's IP
     - **Android Emulator**: Use `10.0.2.2:8000` (maps to host machine's localhost)
     - **Physical Device**: Use your computer's IP address (e.g., `192.168.1.100:8000`)
   
   To find your IP:
   - Windows: `ipconfig` → Look for IPv4 Address
   - Mac/Linux: `ifconfig` or `ip addr` → Look for inet address

5. **Create placeholder assets**:
   The app expects these files in `assets/`:
   - `icon.png` (1024x1024)
   - `splash.png` (2048x2048)
   - `adaptive-icon.png` (1024x1024)
   - `favicon.png` (48x48)

   You can copy the icon from `../frontend/public/icon.png` or create temporary placeholders.

6. **Start the development server**:
```bash
npx expo start
```

## Running the App

- **iOS Simulator**: Press `i` in the terminal
- **Android Emulator**: Press `a` in the terminal
- **Physical Device**: Scan the QR code with Expo Go app (iOS) or Expo Go app (Android)

## Features Implemented

✅ **Authentication**
- Login with username/email/phone
- Registration with full profile
- JWT token storage (expo-secure-store)
- Automatic token refresh

✅ **Theme System**
- Light mode
- Dark mode
- System theme (auto)
- Settings toggle

✅ **Navigation**
- Bottom tab bar (Instagram-style)
- Feed, Notifications, Friends, Profile, Settings tabs

✅ **Feed**
- Post list with infinite scroll
- Post reactions (like button)
- Comment count
- Media attachments
- Post detail screen

✅ **Post Detail**
- Full post view
- Comments list
- Nested replies
- Comment submission

✅ **Notifications**
- Notification list
- Unread indicators
- Notification actions

✅ **Friends**
- Friends list
- Friend requests (ready for implementation)

✅ **Profile**
- User profile view
- Stats (posts, friends)
- Recent posts grid

✅ **Settings**
- Dark/Light mode switcher
- Logout
- Account settings (ready for implementation)

## API Endpoints Used

The app connects to these endpoints:
- `POST /api/auth/login/` - Login
- `POST /api/auth/register/` - Register
- `GET /api/auth/user/{id}/` - Get user profile
- `GET /api/feed/` - Get news feed
- `GET /api/posts/{id}/` - Get post detail
- `GET /api/notifications/` - Get notifications
- `GET /api/auth/friends/` - Get friends list
- `POST /api/comments/` - Create comment
- `POST /api/reactions/` - Create reaction
- And more...

## Development Tips

1. **Hot Reload**: The app supports hot reload. Changes reflect immediately.

2. **Debugging**: Use React Native Debugger or Chrome DevTools (expo start in web mode)

3. **API Testing**: Ensure your backend CORS settings allow requests from the mobile app.

4. **Token Refresh**: The app automatically refreshes tokens when expired.

5. **Network Issues**: 
   - Ensure mobile device/emulator can reach your backend
   - Check firewall settings
   - For emulators, use correct localhost mapping

## Next Steps

To add more features:
1. Friend requests screen
2. User profile detail screen
3. Create post screen
4. Edit post/comment screens
5. Bookmarked posts screen
6. Image upload functionality

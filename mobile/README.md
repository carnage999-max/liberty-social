# Liberty Social Mobile App

React Native mobile application for Liberty Social built with Expo.

## Features

- 🔐 **Authentication**: JWT tokens stored securely with `expo-secure-store`
- 🌙 **Dark/Light Mode**: Full theme support with system theme detection
- 📱 **Bottom Navigation**: Instagram-style tab navigation
- 📰 **Feed**: Posts with reactions, comments, and nested replies
- 👥 **Friends**: Friend management and requests
- 🔔 **Notifications**: Real-time notifications
- ⚙️ **Settings**: Theme switcher and account settings
- 🎨 **Theme**: Matches website theme (Cobalt Blue #0B3D91, Red #FF4D4F)

## Setup

1. **Install dependencies**:
```bash
cd mobile
npm install
```

2. **Configure API endpoint**:
   - Update `constants/API.ts` with your backend URL
   - For local development:
     - iOS Simulator: Use `localhost:8000` or your machine's IP
     - Android Emulator: Use `10.0.2.2:8000` instead of localhost
     - Physical device: Use your machine's IP address

3. **Start development server**:
```bash
npx expo start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on physical device

## Project Structure

```
mobile/
├── app/                    # Expo Router app directory
│   ├── (auth)/             # Authentication screens
│   │   ├── login.tsx       # Login screen
│   │   └── register.tsx    # Registration screen
│   └── (tabs)/             # Main app tabs
│       ├── feed.tsx        # Feed screen
│       ├── feed/[id].tsx   # Post detail with comments
│       ├── notifications.tsx
│       ├── friends.tsx
│       ├── profile.tsx
│       └── settings.tsx    # Settings with theme switcher
├── contexts/               # React contexts
│   ├── AuthContext.tsx     # Authentication state
│   └── ThemeContext.tsx    # Theme (dark/light) state
├── constants/              # App constants
│   ├── Theme.ts            # Theme colors and styling
│   └── API.ts              # API base URL configuration
├── types/                  # TypeScript types
│   └── index.ts            # Shared types matching API
├── utils/                  # Utilities
│   ├── api.ts              # API client with interceptors
│   └── storage.ts          # expo-secure-store wrapper
└── package.json
```

## Theme

The app strictly follows the website theme:
- **Primary**: `#0B3D91` (Deep Cobalt Blue)
- **Secondary**: `#FF4D4F` (Vibrant Red)
- **Background**: `#F6F7FB` (Light mode) / `#0B0C0E` (Dark mode)

## Authentication

Uses `expo-secure-store` to securely store:
- Access token
- Refresh token
- User ID

Tokens are automatically included in API requests and refreshed when expired.

## Navigation

Bottom tabs (Instagram-style):
1. **Feed** - Main feed with posts
2. **Notifications** - User notifications
3. **Friends** - Friends list
4. **Profile** - User profile
5. **Settings** - App settings with dark/light mode switcher

## API Integration

The mobile app uses the same Django REST Framework API as the website:
- Base URL: `http://localhost:8000/api` (development)
- Authentication: JWT Bearer tokens
- All endpoints match the website API structure

## Development Notes

- The app uses Expo Router for file-based routing
- Theme system supports light, dark, and auto (system) modes
- All API calls are handled through the centralized `apiClient`
- Secure storage is used for sensitive authentication data

## Troubleshooting

### API Connection Issues

If you can't connect to the API:
1. Ensure your backend server is running
2. For Android emulator, use `10.0.2.2` instead of `localhost`
3. For physical devices, use your computer's IP address (find with `ipconfig` or `ifconfig`)
4. Ensure both mobile app and backend are on the same network

### Theme Not Switching

- Check Settings screen for theme toggle
- System theme follows device settings
- Manual theme override available in Settings

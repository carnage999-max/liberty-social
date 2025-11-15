# Feed Filtering System - Quick Start Guide

## 🎯 What Users Can Do

### In Settings (Profile → Settings → Feed Preferences)
Users can customize their feed with:

1. **Content Type Selection**
   - ☑️ Show posts from friends (toggle on/off)
   - ☑️ Show posts from pages (toggle on/off)

2. **Category Preferences**
   - Select one or more categories they're interested in:
     - 📰 News
     - 🍽️ Restaurant
     - 🎬 Entertainment
     - 🎯 Hobbies
     - 💼 Work
     - 👥 Associates
     - ⚽ Sports
     - 🎵 Music
     - 🎨 Art
     - 💻 Technology
     - 🛍️ Lifestyle
     - 📚 Education
     - ❤️ Health & Wellness
     - ✈️ Travel
     - 🍳 Food & Cooking
     - 👗 Fashion
     - 🎮 Games
     - 🏢 Business
     - 👥 Community
     - 🏷️ Brand
     - 📌 Other

3. **Fallback Behavior**
   - Show posts from other categories when preferred categories are exhausted

### In Feed (Home → Your Feed)
Users see:

1. **Feed Filter Header** (sticky, always visible)
   - 👥 Friends toggle
   - 📄 Pages toggle
   - 🏷️ Category dropdown
   - ⚠️ Filters active badge

2. **Filtered Feed**
   - Posts matching their preferences
   - All existing features preserved (reactions, comments, shares, etc.)

## 🔄 Data Flow

```
User: "I want tech and news posts only"
        ↓
Settings: Select "Technology" and "News" categories
        ↓
API: Save preferences to /feed-preferences/me/
        ↓
Backend: Store in UserFeedPreference model
        ↓
Feed: Query /feed/ endpoint
        ↓
Backend: Apply filtering:
  - Only show page posts with category in ["tech", "news"]
  - Respect friend/page toggle
        ↓
Display: Filtered feed with relevant posts
```

## 🚀 Features

### Smart Defaults
- ✅ New users get all 21 categories enabled
- ✅ Existing users automatically upgraded
- ✅ Friends posts and page posts enabled by default

### Intelligent Fallback
- If user selects only "tech" posts but runs out
- Show "other category" posts as fallback (configurable)
- Smooth browsing experience

### Server-Side Filtering
- ✅ Fast - filtering at database level
- ✅ Secure - can't be bypassed via client
- ✅ Scalable - works with large feed volumes

### User Control
- ✅ Can change preferences anytime
- ✅ Changes apply immediately
- ✅ Quick toggle in feed header
- ✅ Detailed settings in profile

## 📱 UI Components

### FeedPreferencesSection (Settings Page)
```
┌─────────────────────────────────────┐
│ Feed Preferences                    │
│ Customize what posts appear...      │
├─────────────────────────────────────┤
│                                     │
│ Show posts from:                    │
│ ☑ Friends' posts                   │
│ ☑ Page posts                       │
│                                     │
│ Interested categories:              │
│ ┌─────┐ ┌─────┐ ┌─────┐          │
│ │ ☑ News │ ☑ Tech │ ☑ Food │      │
│ └─────┘ └─────┘ └─────┘          │
│ ... (more categories)              │
│                                     │
│ ☑ Show posts from other categories │
│   (when preferred categories done)  │
│                                     │
│ [Save preferences] ⚠️ Unsaved       │
│                                     │
└─────────────────────────────────────┘
```

### FeedFilters (Feed Page Header)
```
┌──────────────────────────────────────────────────────┐
│ 👥 Friends  📄 Pages  | 🏷️ All Categories  ⚠ Filters |
│                       ↓ (Dropdown on click)         │
│                    [All Categories]                  │
│                    [News]                            │
│                    [Tech]                            │
│                    [Food]                            │
│                    [...]                             │
└──────────────────────────────────────────────────────┘
```

## 🔌 API Integration

### Fetch User Preferences
```typescript
const { preferences, loading, updatePreferences } = useFeedPreferences();

// Returns:
{
  id: 1,
  show_friend_posts: true,
  show_page_posts: true,
  preferred_categories: ["tech", "news"],
  show_other_categories: true,
  category_choices: [
    ["business", "Business"],
    ["news", "News"],
    ...
  ]
}
```

### Save Preferences
```typescript
await updatePreferences({
  show_friend_posts: true,
  show_page_posts: false,
  preferred_categories: ["tech", "news", "entertainment"],
  show_other_categories: true
});
```

## 🎨 Design System

### Colors & States
- **Active Toggle**: Blue (friend/page/category selected)
- **Inactive Toggle**: Gray (not selected)
- **Unsaved Changes**: Amber warning badge
- **Hover State**: Opacity change, border highlight

### Responsive Design
- Mobile: Single column, stacked controls
- Tablet: 2-column grid for categories
- Desktop: 3-column grid for categories

## 📊 Example Scenarios

### Scenario 1: Tech Professional
- Enable: Friends, Pages
- Categories: Technology, Work, Business
- Other categories: Yes (to discover new interests)
- Result: Sees tech/work posts + occasional other topics

### Scenario 2: Food Enthusiast
- Enable: Friends, Pages
- Categories: Food & Cooking, Restaurant, Lifestyle
- Other categories: No (focus mode)
- Result: Only sees food-related posts from friends and pages

### Scenario 3: Community Builder
- Enable: Friends, Pages
- Categories: Community, Business, News
- Other categories: Yes
- Result: Sees community posts + some diversity

## 🔒 Security & Privacy

- ✅ User can only access their own preferences
- ✅ Filtering happens server-side (secure)
- ✅ All existing privacy controls respected
- ✅ Blocked users still blocked even with preferences
- ✅ Friend visibility rules still enforced

## ⚡ Performance

- One-to-one relationship (fast lookups)
- Filtering at database level
- Cached API responses
- No N+1 queries
- Efficient JSON storage

## 🐛 Troubleshooting

**Q: Not seeing expected posts?**
- Check Settings → Feed Preferences
- Verify categories are selected
- Check friend/page toggles
- Verify "Show other categories" if needed

**Q: Feed looks empty?**
- Possible all content filtered out
- Enable "Show other categories"
- Add more categories
- Check privacy settings

**Q: Changes not applying?**
- Refresh page
- Check for unsaved changes warning
- Verify save succeeded

---

**Version**: 1.0
**Last Updated**: November 15, 2025
**Status**: Production Ready ✅

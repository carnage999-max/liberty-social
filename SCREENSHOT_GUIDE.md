# 📸 Google Play Store Screenshot Guide

This guide will help you prepare Liberty Social for professional Google Play Store screenshots.

## 🚀 Quick Setup (5 Minutes)

### Step 1: Run the Demo Data Script

```bash
cd backend
python manage.py setup_demo_data
```

This will create:
- ✅ 5 demo users with professional profiles
- ✅ 8 engaging feed posts
- ✅ 3 message conversations
- ✅ 3 business pages
- ✅ 5 marketplace listings
- ✅ 5 animal marketplace listings
- ✅ Friend connections between all users

### Step 2: (Optional) Add Profile Images

For the best screenshots, you can add profile images manually through the Django admin or app:

1. Login to Django Admin: `http://localhost:8000/admin`
2. Go to Users
3. Upload profile images for the demo accounts

**Demo Accounts (All use password: `Demo@123`):**
- sarah.johnson@demo.com - Digital Marketing Strategist
- michael.chen@demo.com - Software Engineer
- emma.williams@demo.com - Baker & Small Business Owner
- james.davis@demo.com - Fitness Coach
- olivia.martinez@demo.com - Travel Photographer

---

## 📱 Screenshot Checklist

### 1️⃣ Feed + Personalization
**Login as:** Any demo account
**Navigate to:** Home Feed
**Show:** 
- Posts from friends
- Background/Filter buttons at top
- Reactions and comments
- "People you may know" section

**Headline:** "Your Feed, Your Rules."
**Subtext:** Control exactly what appears in your feed.

---

### 2️⃣ Marketplace
**Login as:** Any demo account
**Navigate to:** Marketplace tab
**Show:**
- MacBook Pro listing
- Camera listing
- Peloton bike
- Standing desk
- Categories and filters

**Headline:** "Buy & Sell Anything — Fast & Local."
**Subtext:** A smarter marketplace built into your social app.

---

### 3️⃣ Business Pages
**Login as:** Sarah, Emma, or James (page owners)
**Navigate to:** Pages section
**Show:**
- Sweet Emma's Bakery
- FitLife Coaching
- Digital Growth Agency
- Followers count
- Contact info

**Headline:** "Powerful Business Pages for Everyone."
**Subtext:** Create, promote, and grow — all in one place.

---

### 4️⃣ Animal Marketplace
**Login as:** Any demo account
**Navigate to:** Animal Marketplace
**Show:**
- Golden Retriever puppies
- Quarter Horse mare
- Scottish Fold kittens
- Cockatiels
- Miniature pig
- Detailed listing info

**Headline:** "A Dedicated Marketplace for Pets & Animals."
**Subtext:** Unique listings you won't find anywhere else.

---

### 5️⃣ Messaging (Built-in)
**Login as:** Sarah, Michael, or Emma
**Navigate to:** Messages tab
**Show:**
- Conversation list
- Active chat with messages
- Real-time messaging interface
- Clean, modern UI

**Headline:** "Messaging Integrated — No Extra App Needed."
**Subtext:** Chat, share, and connect instantly.

---

### 6️⃣ Custom Backgrounds for Feed
**Login as:** Any demo account
**Navigate to:** Feed → Click Background button
**Show:**
- Background selection modal
- Animated backgrounds (American, Christmas, etc.)
- Image backgrounds
- Apply and see change

**Headline:** "Customize Your Social Experience."
**Subtext:** Change your feed background to your style.

---

### 7️⃣ Explore / People You May Know
**Login as:** Any demo account
**Navigate to:** Feed or Explore
**Show:**
- "People you may know" carousel
- User suggestions with bios
- Friend request buttons
- Profile previews

**Headline:** "Easily Find New Friends & Communities."

---

### 8️⃣ Profile
**Login as:** Any demo account (preferably with profile image)
**Navigate to:** Profile tab
**Show:**
- Profile header with image
- Bio and location
- Friend count
- Recent posts
- Modern layout

**Headline:** "Express Yourself with a Modern Profile."

---

### 9️⃣ Welcome Screen (Unauthenticated)
**Login as:** Logged out
**Navigate to:** App entry point
**Show:**
- Liberty Social logo
- Metallic gradient buttons (Get Started, I already have an account)
- Clean, inviting first impression
- Gradient background

**Headline:** "Welcome to Liberty Social."
**Subtext:** Your social network, your way.

---

## 🎨 Screenshot Tips

### Device Settings
- **Resolution:** 1080x1920 (or higher)
- **Device:** Use a modern device frame (Pixel, Samsung S-series)
- **Status Bar:** Show battery, signal, time
- **Time:** Set to something neutral (10:30 AM)
- **Battery:** Show 80-100%

### App Settings
- **Theme:** Use Light mode for screenshots (better contrast)
- **Background:** For Feed screenshot, use an appealing background like "Clouds" or "Sunset"
- **Language:** English
- **Notifications:** Clear notification badges before screenshots

### Photography Tips
1. **Clean UI:** Close any modals or overlays unless they're the focus
2. **Good Lighting:** Take screenshots in well-lit environment
3. **Consistent Framing:** Keep all screenshots at same zoom level
4. **Real Content:** Demo data provides realistic, professional content
5. **Action States:** Show interactive elements (buttons, tabs) in active state

---

## 🔄 Refresh Demo Data

If you need to reset or update the demo data:

```bash
# Clean existing demo data and recreate
python manage.py setup_demo_data --clean
```

---

## 📊 Demo Data Summary

**Users:** 5 professional accounts
- Digital marketer
- Software engineer  
- Baker/small business owner
- Fitness coach
- Travel photographer

**Posts:** 8 engaging posts with emojis and hashtags
**Messages:** 3 realistic conversations
**Business Pages:** 3 diverse businesses
**Marketplace:** 5 general items ($299-$2,199)
**Animal Listings:** 5 animals ($250-$5,500)
**Connections:** Everyone is friends with everyone

---

## 🎯 Google Play Requirements

### Technical Requirements
- **Minimum:** 2 screenshots
- **Maximum:** 8 screenshots
- **Resolution:** 1080x1920 minimum (16:9 or 9:16 aspect ratio)
- **Format:** PNG or JPEG
- **File Size:** Max 8MB each

### Best Practices
- Show core features first
- Use consistent styling
- Include text overlays with headlines
- Show actual app content (not mockups)
- Highlight unique features

---

## 🆘 Troubleshooting

### "No posts showing"
- Make sure you're logged in as one of the demo accounts
- Check that friend connections were created
- Refresh the feed

### "No marketplace listings"
- Navigate to Marketplace tab (bottom navigation)
- Check filter settings
- Try different categories

### "Messages not showing"
- Login as Sarah, Michael, or Emma (they have conversations)
- Go to Messages tab
- Select a conversation

### "Need more variety"
- You can manually create additional posts/listings
- Edit existing content through Django admin
- Use different demo accounts for different screenshots

---

## 📞 Support

If you need help or want to customize the demo data further, the management command is fully editable in:
`backend/main/management/commands/setup_demo_data.py`

You can:
- Add more users
- Create different types of posts
- Add more marketplace categories
- Customize business pages
- Add more message conversations

---

## ✅ Final Checklist Before Screenshots

- [ ] Demo data created successfully
- [ ] Profile images uploaded (optional but recommended)
- [ ] App running smoothly
- [ ] Device in good state (battery, time, etc.)
- [ ] Logged in with appropriate demo account
- [ ] Content looks professional
- [ ] UI is clean and uncluttered
- [ ] Background selected (if taking feed screenshot)
- [ ] Ready to capture!

---

**Good luck with your Google Play Store launch! 🚀**

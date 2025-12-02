# Demo Data Management

This document explains how to manage demo data for Liberty Social app screenshots.

## Overview

The demo data system provides professional content for taking Google Play Store screenshots. It includes:
- 5 demo user accounts with diverse profiles
- Sample posts, messages, and conversations
- Business pages and marketplace listings
- Friend connections between all users

## Commands

### Setup Demo Data

Creates all demo data from scratch. Automatically cleans existing demo data first.

**Linux/Mac:**
```bash
./setup_demo_data.sh
```

**Windows:**
```bash
setup_demo_data.bat
```

**Direct command:**
```bash
cd backend
python manage.py setup_demo_data
```

**Options:**
- `--skip-cleanup`: Don't clean existing data before creating new data (adds to existing)

**Example:**
```bash
# Add more demo data without removing existing
python manage.py setup_demo_data --skip-cleanup
```

### Cleanup Demo Data

Removes all demo data from the database. This permanently deletes:
- All 5 demo users
- All posts created by demo users
- All conversations involving demo users
- All messages in those conversations
- All business pages owned by demo users
- All marketplace listings (general + animal) created by demo users
- All friendships involving demo users

**Linux/Mac:**
```bash
./cleanup_demo_data.sh
```

**Windows:**
```bash
cleanup_demo_data.bat
```

**Direct command:**
```bash
cd backend
python manage.py cleanup_demo_data
```

**Options:**
- `--confirm`: Skip the confirmation prompt and delete immediately

**Example:**
```bash
# Cleanup without confirmation prompt
python manage.py cleanup_demo_data --confirm
```

## Demo Accounts

All demo accounts use the password: **Demo@123**

1. **sarah.johnson@demo.com**
   - Digital Marketing Strategist
   - San Francisco, CA

2. **michael.chen@demo.com**
   - Software Engineer
   - Seattle, WA

3. **emma.williams@demo.com**
   - Baker & Business Owner
   - Portland, OR

4. **james.davis@demo.com**
   - Fitness Coach
   - Austin, TX

5. **olivia.martinez@demo.com**
   - Travel Photographer
   - Miami, FL

## Typical Workflow

### For Screenshot Session

1. **Setup demo data:**
   ```bash
   ./setup_demo_data.sh
   ```

2. **(Optional) Add profile images** via Django admin or mobile app

3. **Take screenshots** following SCREENSHOT_GUIDE.md

4. **Cleanup when done:**
   ```bash
   ./cleanup_demo_data.sh
   ```

### For Testing/Development

1. **Create demo data for testing:**
   ```bash
   python manage.py setup_demo_data
   ```

2. **Test your features** with realistic data

3. **Clean up when done:**
   ```bash
   python manage.py cleanup_demo_data --confirm
   ```

## Safety Features

### Cleanup Command Safety

The cleanup command includes several safety features:

1. **Preview before deletion**: Shows counts of what will be deleted
2. **Confirmation prompt**: Requires typing "yes" to confirm
3. **Targeted deletion**: Only removes data associated with demo user emails
4. **Proper cascade**: Deletes in correct order to respect foreign key constraints

### What Gets Deleted

Only data directly associated with demo user accounts:
- Users with emails ending in `@demo.com` (5 specific accounts)
- Posts authored by demo users
- Conversations where demo users are participants
- Messages in those conversations
- Business pages owned by demo users
- Marketplace listings created by demo users
- Friend connections involving demo users

### What Stays Safe

Everything else in your database remains untouched:
- Real user accounts
- Real user posts and content
- Other marketplace listings
- Other business pages
- System data and configurations

## Best Practices

1. **Always cleanup after screenshots**: Don't leave demo data in production
2. **Use --confirm for automation**: Skip prompts in scripts/CI
3. **Refresh data regularly**: Run cleanup + setup for fresh data
4. **Add profile images**: Makes screenshots more professional
5. **Test before production**: Try commands on development database first

## Troubleshooting

### "No demo data found"
This means the database is already clean. You can run setup to create new demo data.

### "Demo users already exist"
Run cleanup first, then setup:
```bash
python manage.py cleanup_demo_data --confirm
python manage.py setup_demo_data
```

### "Foreign key constraint errors"
The cleanup command handles deletion order automatically. If you see this error:
1. Check your database for custom constraints
2. Try running cleanup with `--confirm` flag
3. Check Django logs for specific constraint violations

### "Permission denied" on scripts
Make scripts executable:
```bash
chmod +x setup_demo_data.sh cleanup_demo_data.sh
```

## Technical Details

### Demo User Identification

Demo users are identified by these exact emails:
- sarah.johnson@demo.com
- michael.chen@demo.com
- emma.williams@demo.com
- james.davis@demo.com
- olivia.martinez@demo.com

### Deletion Order

The cleanup command deletes in this order to respect foreign key constraints:

1. Messages (no foreign keys to them)
2. Conversations (after messages deleted)
3. Posts (CASCADE deletes likes, comments)
4. Animal listings
5. Marketplace listings
6. Business pages
7. Users (CASCADE deletes friendships)

### Database Impact

- **Setup**: Creates ~50-70 database records
- **Cleanup**: Removes all demo-related records
- **Performance**: Both operations complete in <5 seconds
- **Transactions**: All operations are atomic (all or nothing)

## See Also

- **SCREENSHOT_GUIDE.md**: Detailed instructions for taking screenshots
- **backend/main/management/commands/setup_demo_data.py**: Setup command source
- **backend/main/management/commands/cleanup_demo_data.py**: Cleanup command source

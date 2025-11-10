# Custom Alert Migration Guide

This guide shows how to migrate from React Native's `Alert.alert()` to the custom themed alert system.

## Setup

The `AlertProvider` is already added to the root layout. You just need to use the `useAlert` hook in your components.

## Basic Usage

### Import the hook

```typescript
import { useAlert } from '../../contexts/AlertContext';
```

### In your component

```typescript
const { showError, showSuccess, showInfo, showWarning, showConfirm } = useAlert();
```

## Migration Examples

### Simple Alerts

**Before:**
```typescript
Alert.alert('Error', 'Failed to load user profile');
```

**After:**
```typescript
showError('Failed to load user profile');
// or with custom title:
showError('Failed to load user profile', 'Error');
```

**Before:**
```typescript
Alert.alert('Success', 'Profile updated successfully!');
```

**After:**
```typescript
showSuccess('Profile updated successfully!');
```

**Before:**
```typescript
Alert.alert('Sign in required', 'Please log in to react to posts.');
```

**After:**
```typescript
showInfo('Please log in to react to posts.', 'Sign in required');
```

### Alerts with Buttons

**Before:**
```typescript
Alert.alert('Success', 'Your post has been published!', [
  {
    text: 'View feed',
    onPress: () => router.push('/(tabs)/feed'),
  },
]);
```

**After:**
```typescript
showAlert({
  title: 'Success',
  message: 'Your post has been published!',
  type: 'success',
  buttons: [
    {
      text: 'View feed',
      onPress: () => router.push('/(tabs)/feed'),
    },
  ],
});
```

### Confirmation Dialogs

**Before:**
```typescript
Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
  {
    text: 'Cancel',
    style: 'cancel',
  },
  {
    text: 'Delete',
    style: 'destructive',
    onPress: () => handleDelete(),
  },
]);
```

**After:**
```typescript
showConfirm(
  'Are you sure you want to delete this post?',
  () => handleDelete(),
  undefined,
  'Delete Post'
);
```

### Custom Alert with Multiple Buttons

**Before:**
```typescript
Alert.alert('Unblock User', `Are you sure you want to unblock ${username}?`, [
  {
    text: 'Cancel',
    style: 'cancel',
  },
  {
    text: 'Unblock',
    onPress: () => handleUnblock(),
  },
]);
```

**After:**
```typescript
showAlert({
  title: 'Unblock User',
  message: `Are you sure you want to unblock ${username}?`,
  type: 'confirm',
  buttons: [
    {
      text: 'Cancel',
      style: 'cancel',
    },
    {
      text: 'Unblock',
      style: 'default',
      onPress: () => handleUnblock(),
    },
  ],
});
```

## Available Methods

- `showError(message, title?)` - Shows an error alert (red icon)
- `showSuccess(message, title?)` - Shows a success alert (green icon)
- `showInfo(message, title?)` - Shows an info alert (blue icon)
- `showWarning(message, title?)` - Shows a warning alert (amber icon)
- `showConfirm(message, onConfirm, onCancel?, title?)` - Shows a confirmation dialog
- `showAlert(options)` - Shows a custom alert with full control

## Button Styles

- `'default'` - Primary button (uses primary color)
- `'cancel'` - Cancel button (subtle background)
- `'destructive'` - Destructive button (red background)

## Benefits

1. **Theme-aware**: Automatically adapts to light/dark mode
2. **Consistent design**: Matches your app's design system
3. **Better UX**: Smooth animations and modern UI
4. **Type-safe**: Full TypeScript support
5. **Customizable**: Easy to extend with new alert types


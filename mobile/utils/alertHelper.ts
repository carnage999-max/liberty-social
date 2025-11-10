/**
 * Helper utility to migrate from Alert.alert() to custom alerts
 * 
 * Migration examples:
 * 
 * Alert.alert('Error', 'Failed to load') 
 * -> showError('Failed to load')
 * 
 * Alert.alert('Success', 'Profile updated')
 * -> showSuccess('Profile updated')
 * 
 * Alert.alert('Title', 'Message', [{ text: 'OK' }, { text: 'Cancel' }])
 * -> showAlert({ title: 'Title', message: 'Message', buttons: [...] })
 * 
 * Alert.alert('Delete', 'Are you sure?', [
 *   { text: 'Cancel', style: 'cancel' },
 *   { text: 'Delete', style: 'destructive', onPress: () => {} }
 * ])
 * -> showConfirm('Are you sure?', () => {}, undefined, 'Delete')
 */

export {};


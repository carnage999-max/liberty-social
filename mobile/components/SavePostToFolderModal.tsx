import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { apiClient } from '../utils/api';

interface SaveFolder {
  id: number;
  name: string;
  item_count: number;
}

interface SavePostToFolderModalProps {
  visible: boolean;
  postId: number;
  onClose: () => void;
  onSaved?: (folder: SaveFolder) => void;
}

export default function SavePostToFolderModal({
  visible,
  postId,
  onClose,
  onSaved,
}: SavePostToFolderModalProps) {
  const { colors, isDark } = useTheme();
  const { showSuccess, showError } = useToast();

  const [folders, setFolders] = useState<SaveFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    if (visible) {
      loadFolders();
    }
  }, [visible]);

  const loadFolders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<{ results: SaveFolder[] }>('/save-folders/');
      const folderList = Array.isArray(response) ? response : response.results || [];
      setFolders(folderList);
    } catch (err) {
      console.error('Failed to load folders:', err);
      showError('Failed to load folders');
    } finally {
      setLoading(false);
    }
  }, []);

  const createFolder = useCallback(async () => {
    if (!newFolderName.trim() && newFolderName.trim() === '') {
      // Allow unnamed folders
    }

    setCreatingFolder(true);
    try {
      const folderName = newFolderName.trim() || undefined;
      const created = await apiClient.post<SaveFolder>('/save-folders/', {
        ...(folderName && { name: folderName }),
      });

      setFolders([...folders, created]);
      setNewFolderName('');
      setShowCreateInput(false);
      setSelectedFolderId(created.id);
      showSuccess(`Folder "${created.name}" created`);
    } catch (err) {
      console.error('Failed to create folder:', err);
      showError('Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  }, [newFolderName, folders]);

  const savePostToFolder = useCallback(async () => {
    if (!selectedFolderId) {
      showError('Please select a folder');
      return;
    }

    setSaving(true);
    try {
      const result = await apiClient.post<SaveFolder>(
        `/save-folders/${selectedFolderId}/add_post/`,
        { post: postId }
      );

      showSuccess(`Post saved to "${result.name}"`);
      onSaved?.(result);
      onClose();
    } catch (err) {
      console.error('Failed to save post:', err);
      showError('Failed to save post to folder');
    } finally {
      setSaving(false);
    }
  }, [selectedFolderId, postId, onSaved, onClose]);

  const deleteFolder = useCallback(async (folderId: number) => {
    try {
      await apiClient.delete(`/save-folders/${folderId}/`);
      setFolders(folders.filter(f => f.id !== folderId));
      if (selectedFolderId === folderId) {
        setSelectedFolderId(null);
      }
      showSuccess('Folder deleted');
    } catch (err) {
      console.error('Failed to delete folder:', err);
      showError('Failed to delete folder');
    }
  }, [folders, selectedFolderId]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: colors.background },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Save post to folder</Text>
          <TouchableOpacity onPress={onClose} disabled={saving}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Create new folder section */}
          {!showCreateInput ? (
            <TouchableOpacity
              style={[
                styles.createFolderButton,
                { borderColor: colors.primary },
              ]}
              onPress={() => setShowCreateInput(true)}
              disabled={loading || saving}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={[styles.createFolderText, { color: colors.primary }]}>
                Create new folder
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.createInputContainer, { backgroundColor: colors.backgroundSecondary }]}>
              <TextInput
                style={[
                  styles.folderInput,
                  {
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Folder name (optional)"
                placeholderTextColor={colors.textSecondary}
                value={newFolderName}
                onChangeText={setNewFolderName}
                editable={!creatingFolder}
                autoFocus
              />
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                Leave empty to create "Unnamed Folder"
              </Text>
              <View style={styles.createActions}>
                <TouchableOpacity
                  style={[styles.createButton, { backgroundColor: colors.primary }]}
                  onPress={createFolder}
                  disabled={creatingFolder}
                >
                  {creatingFolder ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.createButtonText}>Create</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => {
                    setShowCreateInput(false);
                    setNewFolderName('');
                  }}
                  disabled={creatingFolder}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Folders list */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : folders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No folders yet. Create one to get started.
              </Text>
            </View>
          ) : (
            <View style={styles.foldersContainer}>
              {folders.map((folder) => (
                <TouchableOpacity
                  key={folder.id}
                  style={[
                    styles.folderItem,
                    {
                      borderColor:
                        selectedFolderId === folder.id ? colors.primary : colors.border,
                      backgroundColor:
                        selectedFolderId === folder.id
                          ? colors.primary + '15'
                          : 'transparent',
                    },
                  ]}
                  onPress={() => setSelectedFolderId(folder.id)}
                >
                  <View style={styles.folderItemContent}>
                    <View style={styles.folderItemText}>
                      <Text style={[styles.folderName, { color: colors.text }]}>
                        {folder.name}
                      </Text>
                      <Text style={[styles.folderCount, { color: colors.textSecondary }]}>
                        {folder.item_count} {folder.item_count === 1 ? 'post' : 'posts'}
                      </Text>
                    </View>
                    {selectedFolderId === folder.id && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    )}
                  </View>

                  {/* Delete button */}
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => {
                      if (confirm(`Delete "${folder.name}"?`)) {
                        deleteFolder(folder.id);
                      }
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#E74C3C" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Action buttons */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.border }]}
            onPress={onClose}
            disabled={saving}
          >
            <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.saveBtn,
              {
                backgroundColor: colors.primary,
                opacity: saving || !selectedFolderId ? 0.6 : 1,
              },
            ]}
            onPress={savePostToFolder}
            disabled={saving || !selectedFolderId}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save to folder</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  createFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  createFolderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  createInputContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  folderInput: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
    fontSize: 14,
  },
  helperText: {
    fontSize: 12,
    marginBottom: 12,
  },
  createActions: {
    flexDirection: 'row',
    gap: 8,
  },
  createButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  foldersContainer: {
    gap: 8,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  folderItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  folderItemText: {
    flex: 1,
  },
  folderName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  folderCount: {
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

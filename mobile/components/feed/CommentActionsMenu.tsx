import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../utils/api';
import { useAlert } from '../../contexts/AlertContext';
import { useToast } from '../../contexts/ToastContext';
import type { Comment } from '../../types';

export interface CommentActionsMenuProps {
  comment: Comment;
  currentUserId: string | null;
  onCommentUpdated: (comment: Comment) => void;
  onCommentDeleted: (commentId: number) => void;
}

const CommentActionsMenu: React.FC<CommentActionsMenuProps> = ({
  comment,
  currentUserId,
  onCommentUpdated,
  onCommentDeleted,
}) => {
  const { showError, showConfirm } = useAlert();
  const { showSuccess } = useToast();
  const [menuVisible, setMenuVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [editContent, setEditContent] = useState(comment.content || '');
  const translateYRef = useRef(new Animated.Value(0));
  const translateY = translateYRef.current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 12,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldDismiss = gesture.dy > 140 || gesture.vy > 1.2;
        if (shouldDismiss) {
          Animated.spring(translateY, {
            toValue: 400,
            useNativeDriver: true,
            damping: 20,
            stiffness: 160,
          }).start(({ finished }) => {
            if (finished) setMenuVisible(false);
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 14,
            stiffness: 120,
          }).start();
        }
      },
    })
  ).current;

  const isOwner = useMemo(() => {
    if (!currentUserId) return false;
    if (!comment.author?.id) return false;
    return String(comment.author.id) === String(currentUserId);
  }, [currentUserId, comment.author?.id]);

  const toggleMenu = (next: boolean) => {
    if (next) {
      setMenuVisible(true);
      translateY.setValue(300);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 14,
        stiffness: 120,
      }).start();
    } else {
      setMenuVisible(false);
      translateY.setValue(0);
    }
  };

  const closeAll = () => {
    setMenuVisible(false);
    setEditVisible(false);
  };

  const handleDelete = async () => {
    toggleMenu(false);
    const isReply = !!comment.parent;
    showConfirm(
      isReply ? 'Are you sure you want to delete this reply?' : 'Are you sure you want to delete this comment?',
      async () => {
        setPending(true);
        try {
          await apiClient.delete(`/comments/${comment.id}/`);
          onCommentDeleted(comment.id);
          showSuccess(isReply ? 'Reply deleted' : 'Comment deleted');
        } catch (error) {
          console.error('Error deleting comment:', error);
          showError('Unable to delete. Please try again later.');
        } finally {
          setPending(false);
        }
      },
      undefined,
      isReply ? 'Delete Reply' : 'Delete Comment',
      true // destructive action
    );
  };

  const handleEditSubmit = async () => {
    const trimmed = editContent.trim();
    if (!trimmed) {
      showError(
        comment.parent ? 'Reply content cannot be empty.' : 'Comment content cannot be empty.',
        comment.parent ? 'Edit Reply' : 'Edit Comment'
      );
      return;
    }

    setPending(true);
    try {
      const updated = await apiClient.patch<Comment>(`/comments/${comment.id}/`, {
        content: trimmed,
      });
      onCommentUpdated({ ...comment, ...updated, content: trimmed });
      closeAll();
      showSuccess(comment.parent ? 'Reply updated' : 'Comment updated');
    } catch (error) {
      console.error('Error updating comment:', error);
      showError('Unable to update comment. Please try again later.');
    } finally {
      setPending(false);
    }
  };

  if (!isOwner) return null; // Only show menu for own comments

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Open comment actions"
        onPress={() => toggleMenu(true)}
        style={styles.triggerButton}
        disabled={pending}
      >
        <Ionicons
          name="ellipsis-horizontal"
          size={18}
          color="rgba(120,120,130,0.9)"
        />
      </TouchableOpacity>

      <Modal
        transparent
        visible={menuVisible}
        animationType="fade"
        onRequestClose={() => toggleMenu(false)}
      >
        <TouchableWithoutFeedback onPress={() => toggleMenu(false)}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }]}
          accessibilityViewIsModal
          {...panResponder.panHandlers}
        >
          <TouchableOpacity
            style={styles.sheetHandle}
            activeOpacity={0.8}
            onPress={() => toggleMenu(false)}
          />
          <View style={styles.sheetContent}>
            <Text style={styles.sheetTitle}>
              {comment.parent ? 'Reply options' : 'Comment options'}
            </Text>

            <TouchableOpacity
              style={styles.sheetAction}
              onPress={() => {
                toggleMenu(false);
                setEditContent(comment.content || '');
                setEditVisible(true);
              }}
              disabled={pending}
            >
              <Ionicons name="create-outline" size={18} color="#9FA8FF" />
              <Text style={styles.sheetActionText}>
                {comment.parent ? 'Edit reply' : 'Edit comment'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetAction, styles.destructiveAction]}
              onPress={handleDelete}
              disabled={pending}
            >
              <Ionicons name="trash-outline" size={18} color="#FF7B7B" />
              <Text style={[styles.sheetActionText, styles.destructiveText]}>
                {comment.parent ? 'Delete reply' : 'Delete comment'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>

      <Modal
        transparent
        visible={editVisible}
        animationType="fade"
        onRequestClose={closeAll}
      >
        <TouchableWithoutFeedback onPress={closeAll}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.editModal}>
          <Text style={styles.editTitle}>
            {comment.parent ? 'Edit reply' : 'Edit comment'}
          </Text>
          <TextInput
            style={styles.editInput}
            multiline
            value={editContent}
            onChangeText={setEditContent}
            placeholder="Update your comment..."
            placeholderTextColor="rgba(90,90,110,0.6)"
          />
          <View style={styles.editActions}>
            <TouchableOpacity
              style={[styles.editButton, styles.editCancel]}
              onPress={closeAll}
              disabled={pending}
            >
              <Text style={styles.editCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editButton, styles.editSave]}
              onPress={handleEditSubmit}
              disabled={pending}
            >
              {pending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.editSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  triggerButton: {
    padding: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 10, 30, 0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F1324',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 26,
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(159,168,255,0.2)',
  },
  sheetHandle: {
    width: 50,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(159,168,255,0.35)',
    alignSelf: 'center',
    marginVertical: 12,
  },
  sheetContent: {
    gap: 10,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E3E7FF',
    marginBottom: 10,
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  sheetActionText: {
    fontSize: 15,
    color: '#EAEFFF',
    fontWeight: '600',
  },
  destructiveAction: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 123, 123, 0.2)',
    marginTop: 6,
    paddingTop: 18,
  },
  destructiveText: {
    color: '#FF7B7B',
  },
  editModal: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '25%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  editTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C28',
    marginBottom: 12,
  },
  editInput: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(120,120,140,0.2)',
    padding: 14,
    fontSize: 15,
    color: '#1E1E2F',
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  editButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  editCancel: {
    backgroundColor: 'rgba(120, 120, 140, 0.1)',
  },
  editCancelText: {
    color: '#545466',
    fontWeight: '600',
  },
  editSave: {
    backgroundColor: '#3949AB',
  },
  editSaveText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default CommentActionsMenu;


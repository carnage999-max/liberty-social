"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import type { SaveFolder, SaveFolderItem } from "@/lib/types";

interface SavePostToFolderModalProps {
  open: boolean;
  postId: number;
  accessToken: string | null;
  onClose: () => void;
  onSaved?: (folder: SaveFolder) => void;
}

export function SavePostToFolderModal({
  open,
  postId,
  accessToken,
  onClose,
  onSaved,
}: SavePostToFolderModalProps) {
  const toast = useToast();
  const [folders, setFolders] = useState<SaveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Load folders when modal opens
  useEffect(() => {
    if (!open || !accessToken) return;
    
    loadFolders();
  }, [open, accessToken]);

  const loadFolders = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const response = await apiGet("/save-folders/", {
        token: accessToken,
        cache: "no-store",
      });
      const data = Array.isArray(response) ? response : response.results || [];
      setFolders(data);
    } catch (err) {
      console.error("Failed to load save folders:", err);
      toast.show("Failed to load folders", "error");
    } finally {
      setLoading(false);
    }
  }, [accessToken, toast]);

  const createFolder = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setCreatingFolder(true);
    try {
      // If empty, use undefined to trigger backend default behavior
      const folderName = newFolderName.trim() || undefined;

      const created = await apiPost(
        "/save-folders/",
        { ...(folderName && { name: folderName }) },
        {
          token: accessToken,
          cache: "no-store",
        }
      );
      
      setFolders([...folders, created as SaveFolder]);
      setNewFolderName("");
      setShowCreateInput(false);
      setSelectedFolderId((created as SaveFolder).id);
      toast.show(`Folder "${(created as SaveFolder).name}" created`, "success");
    } catch (err) {
      console.error("Failed to create folder:", err);
      toast.show("Failed to create folder", "error");
    } finally {
      setCreatingFolder(false);
    }
  }, [accessToken, newFolderName, folders, toast]);

  const savePostToFolder = useCallback(async () => {
    if (!accessToken || !selectedFolderId) {
      toast.show("Please select a folder", "error");
      return;
    }

    setSaving(true);
    try {
      const result = await apiPost(
        `/save-folders/${selectedFolderId}/add_post/`,
        { post: postId },
        {
          token: accessToken,
          cache: "no-store",
        }
      );

      const updatedFolder = result as SaveFolder;
      
      // Update the folders list with the updated folder
      setFolders(folders.map(f => f.id === updatedFolder.id ? updatedFolder : f));
      
      const folderName = updatedFolder.name || "Unnamed Folder";
      toast.show(`Post saved to "${folderName}"`, "success");
      onSaved?.(updatedFolder);
      onClose();
    } catch (err) {
      console.error("Failed to save post to folder:", err);
      toast.show("Failed to save post", "error");
    } finally {
      setSaving(false);
    }
  }, [accessToken, selectedFolderId, postId, folders, toast, onSaved, onClose]);

  const deleteFolder = useCallback(
    async (folderId: number) => {
      if (!accessToken) return;
      
      try {
        await apiDelete(`/save-folders/${folderId}/`, {
          token: accessToken,
          cache: "no-store",
        });
        
        setFolders(folders.filter(f => f.id !== folderId));
        if (selectedFolderId === folderId) {
          setSelectedFolderId(null);
        }
        
        toast.show("Folder deleted", "success");
      } catch (err) {
        console.error("Failed to delete folder:", err);
        toast.show("Failed to delete folder", "error");
      }
    },
    [accessToken, folders, selectedFolderId, toast]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Save post to folder</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full bg-gray-100 p-2 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 disabled:opacity-60"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Create new folder section */}
        {!showCreateInput ? (
          <button
            type="button"
            onClick={() => setShowCreateInput(true)}
            disabled={loading || saving}
            className="mb-4 w-full rounded-lg border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-600 transition hover:bg-blue-100 disabled:opacity-60"
          >
            + Create new folder
          </button>
        ) : (
          <div className="mb-4 space-y-2">
            <div>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name (leave empty for 'Unnamed Folder')..."
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    createFolder();
                  } else if (e.key === "Escape") {
                    setShowCreateInput(false);
                    setNewFolderName("");
                  }
                }}
                disabled={creatingFolder}
                autoFocus
              />
              <p className="mt-1 text-xs text-gray-500">
                Leave empty to create an "Unnamed Folder" (auto-numbered)
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={createFolder}
                disabled={creatingFolder}
                className="flex-1 rounded-lg btn-primary px-3 py-2 text-sm font-semibold text-white shadow-metallic transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingFolder ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateInput(false);
                  setNewFolderName("");
                }}
                disabled={creatingFolder}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Folders list */}
        <div className="mb-4 max-h-64 overflow-y-auto space-y-2">
          {loading ? (
            <p className="text-center text-sm text-gray-500 py-4">Loading folders...</p>
          ) : folders.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-4">
              No folders yet. Create one to get started.
            </p>
          ) : (
            folders.map((folder) => (
              <div
                key={folder.id}
                className={`flex items-center gap-3 rounded-lg border p-3 transition cursor-pointer ${
                  selectedFolderId === folder.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
                onClick={() => setSelectedFolderId(folder.id)}
              >
                <input
                  type="radio"
                  name="folder"
                  value={folder.id}
                  checked={selectedFolderId === folder.id}
                  onChange={() => setSelectedFolderId(folder.id)}
                  className="h-4 w-4 cursor-pointer rounded-full border-gray-300 text-blue-600 focus:ring-2"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{folder.name}</p>
                  <p className="text-xs text-gray-500">
                    {folder.item_count} {folder.item_count === 1 ? "post" : "posts"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${folder.name}"?`)) {
                      deleteFolder(folder.id);
                    }
                  }}
                  className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                  title="Delete folder"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 7h14M10 11v6M14 11v6M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={savePostToFolder}
            disabled={saving || !selectedFolderId || loading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save to folder"}
          </button>
        </div>
      </div>
    </div>
  );
}

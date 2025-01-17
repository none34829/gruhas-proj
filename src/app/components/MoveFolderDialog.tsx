import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, TextField, Alert } from '@mui/material';

interface DriveFolder {
  id: string;
  name: string;
}

interface MoveFolderDialogProps {
  open: boolean;
  onClose: () => void;
  onMove: (destinationId: string) => Promise<void>;
  currentFolderId: string;
  currentFolderName: string;
  accessToken: string;
}

export const MoveFolderDialog = ({ 
  open, 
  onClose, 
  onMove, 
  currentFolderId,
  currentFolderName,
  accessToken
}: MoveFolderDialogProps) => {
  const [destinationFolderId, setDestinationFolderId] = useState('');
  const [existingFolders, setExistingFolders] = useState<DriveFolder[]>([]);
  const [isFetchingFolders, setIsFetchingFolders] = useState(false);
  const [error, setError] = useState('');

  const fetchFolders = useCallback(async () => {
    try {
      setIsFetchingFolders(true);
      const response = await fetch(
        'https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fvnd.google-apps.folder%27%20and%20trashed%3Dfalse&fields=files(id%2Cname)',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch folders');
      }

      const data = await response.json();
      // Filter out the current folder from the list
      const filteredFolders = (data.files || []).filter(
        (folder: DriveFolder) => folder.id !== currentFolderId
      );
      setExistingFolders(filteredFolders);
    } catch (err) {
      setError('Failed to fetch folders');
      console.error(err);
    } finally {
      setIsFetchingFolders(false);
    }
  }, [accessToken, currentFolderId]);

  useEffect(() => {
    if (open) {
      fetchFolders();
    }
  }, [open, fetchFolders, accessToken]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Move &quot;{currentFolderName}&quot; to Another Folder</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <TextField
            select
            fullWidth
            label="Select Destination Folder"
            value={destinationFolderId}
            onChange={(e) => setDestinationFolderId(e.target.value)}
            disabled={isFetchingFolders}
            SelectProps={{
              native: true,
            }}
          >
            <option value="">Select a folder</option>
            {existingFolders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </TextField>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!destinationFolderId}
          onClick={() => onMove(destinationFolderId)}
        >
          Move
        </Button>
      </DialogActions>
    </Dialog>
  );
};

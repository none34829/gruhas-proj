import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Alert } from '@mui/material';
import axios from 'axios';

const EmailProcessor = ({ accessToken }) => {
  const [companyName, setCompanyName] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const processEmails = async () => {
    try {
      setStatus('Processing...');
      setError('');

      // Get emails with attachments from the specified company
      const gmail = window.gapi.client.gmail.users.messages;
      const query = `from:${companyName} has:attachment`;
      
      const response = await gmail.list({
        userId: 'me',
        q: query
      });

      const messages = response.result.messages || [];
      
      for (const message of messages) {
        const email = await gmail.get({
          userId: 'me',
          id: message.id
        });

        const attachments = email.result.payload.parts.filter(
          part => part.filename && part.filename.length > 0
        );

        for (const attachment of attachments) {
          // Get attachment data
          const attachmentData = await gmail.attachments.get({
            userId: 'me',
            messageId: message.id,
            id: attachment.body.attachmentId
          });

          // Create folder in Google Drive
          const folderMetadata = {
            name: companyName,
            mimeType: 'application/vnd.google-apps.folder'
          };

          const drive = window.gapi.client.drive;
          const folder = await drive.files.create({
            resource: folderMetadata,
            fields: 'id'
          });

          // Upload file to the created folder
          const fileMetadata = {
            name: attachment.filename,
            parents: [folder.result.id]
          };

          await drive.files.create({
            resource: fileMetadata,
            media: {
              body: attachmentData.result.data
            }
          });
        }
      }

      setStatus('Successfully processed emails and transferred attachments!');
    } catch (err) {
      setError(err.message);
      setStatus('');
    }
  };

  return (
    <Box sx={{ mt: 4 }}>
      <TextField
        fullWidth
        label="Company Name"
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        margin="normal"
      />
      
      <Button
        variant="contained"
        onClick={processEmails}
        disabled={!companyName}
        sx={{ mt: 2 }}
      >
        Process Emails
      </Button>

      {status && (
        <Typography sx={{ mt: 2 }} color="primary">
          {status}
        </Typography>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default EmailProcessor;

'use client';

import { useState } from 'react';
import { TextField, Button, Alert, CircularProgress, Box } from '@mui/material';

interface EmailProcessorProps {
  accessToken: string;
}

interface Attachment {
  filename: string;
  attachmentId: string;
  messageId: string;
}

interface GmailHeader {
  name: string;
  value: string;
}

export default function EmailProcessor({ accessToken }: EmailProcessorProps) {
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const getDomain = (input: string): string => {
    if (input.includes('.')) {
      return input.toLowerCase();
    }
    return input.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      + '.com';
  };

  const validateInput = (input: string) => {
    const domainPattern = /^[a-zA-Z0-9]+([-.][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;
    const companyPattern = /^[a-zA-Z0-9]+(?:[ -][a-zA-Z0-9]+)*$/;
    return domainPattern.test(input) || companyPattern.test(input);
  };

  const formatDateToIST = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const dayOfWeek = new Intl.DateTimeFormat('en-IN', { weekday: 'long' }).format(date);
      return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(date).replace(',', ` (${dayOfWeek}),`);
    } catch (err) {
      console.error('Error formatting date:', err);
      return dateStr;
    }
  };

  const getAttachmentLink = (messageId: string, attachmentId: string, filename: string) => {
    const baseUrl = 'https://www.googleapis.com/gmail/v1/users/me/messages';
    return `${baseUrl}/${messageId}/attachments/${attachmentId}`;
  };

  const downloadAttachment = async (messageId: string, attachmentId: string, filename: string) => {
    try {
      const response = await fetch(
        getAttachmentLink(messageId, attachmentId, filename),
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch attachment');
      }

      const data = await response.json();
      const binaryData = atob(data.data.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading attachment:', err);
      setError('Failed to download attachment. Please try again.');
    }
  };

  const processEmails = async () => {
    if (!validateInput(companyName)) {
      setError('Please enter a valid company name (e.g., "Gruhas") or domain (e.g., "gruhas.com")');
      return;
    }

    setLoading(true);
    setError('');
    setStatus('');

    try {
      const domain = getDomain(companyName);
      const searchQuery = encodeURIComponent(`has:attachment from:*@${domain}`);
      console.log('Search query:', decodeURIComponent(searchQuery));

      let allMessages = [];
      let pageToken = undefined;
      
      do {
        const url = `https://www.googleapis.com/gmail/v1/users/me/messages?q=${searchQuery}${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch emails');
        }

        const data = await response.json();
        if (data.messages) {
          allMessages = allMessages.concat(data.messages);
        }
        pageToken = data.nextPageToken;
      } while (pageToken);

      if (allMessages.length === 0) {
        setStatus(`No emails found with attachments from ${domain}`);
        return;
      }

      setStatus(`Found ${allMessages.length} emails with attachments from ${domain}`);
      
      const emailDetails = await Promise.all(
        allMessages.map(async (msg: any) => {
          const emailResponse = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });
          
          if (emailResponse.ok) {
            const emailData = await emailResponse.json();
            const headers = emailData.payload.headers;
            const dateStr = headers.find((h: GmailHeader) => h.name === 'Date')?.value || 'Unknown date';
            
            const attachments: Attachment[] = [];
            const processPayloadParts = (parts: any[]) => {
              if (!parts) return;
              parts.forEach(part => {
                if (part.filename && part.filename.length > 0) {
                  attachments.push({
                    filename: part.filename,
                    attachmentId: part.body.attachmentId,
                    messageId: msg.id
                  });
                }
                if (part.parts) {
                  processPayloadParts(part.parts);
                }
              });
            };

            if (emailData.payload.parts) {
              processPayloadParts(emailData.payload.parts);
            }

            return {
              subject: headers.find((h: GmailHeader) => h.name === 'Subject')?.value || 'No subject',
              from: headers.find((h: GmailHeader) => h.name === 'From')?.value || 'Unknown sender',
              fromName: headers.find((h: GmailHeader) => h.name === 'From')?.value.split('<')[0].trim() || 'Unknown sender',
              fromEmail: headers.find((h: GmailHeader) => h.name === 'From')?.value.match(/<(.+?)>/)?.[1] || '',
              date: dateStr,
              dateForSort: new Date(dateStr).getTime(),
              formattedDate: formatDateToIST(dateStr),
              attachments
            };
          }
          return null;
        })
      );

      const validDetails = emailDetails.filter(detail => detail !== null);
      
      if (validDetails.length > 0) {
        validDetails.sort((a, b) => b.dateForSort - a.dateForSort);
        
        const emailContent = `
          <div style="font-family: Arial, sans-serif;">
            <h3 style="color: #2e7d32; margin-bottom: 20px;">Found ${validDetails.length} emails with attachments from ${domain}</h3>
            ${validDetails.map((detail, i) => `
              <div style="background: #f5f5f5; padding: 15px; margin-bottom: 15px; border-radius: 4px;">
                <div style="font-size: 16px; margin-bottom: 8px;">
                  <strong>${i + 1}. From:</strong> ${detail.fromName} 
                  ${detail.fromEmail ? `<span style="color: #666;">&lt;${detail.fromEmail}&gt;</span>` : ''}
                </div>
                <div style="color: #666; margin-bottom: 8px;">
                  <strong>Date:</strong> ${detail.formattedDate} (IST)
                </div>
                <div style="margin-bottom: 8px;">
                  <strong>Subject:</strong> ${detail.subject}
                </div>
                <div>
                  <strong>Attachments:</strong> 
                  ${detail.attachments.length > 0 ? `
                    <div style="margin-left: 20px; margin-top: 5px;">
                      ${detail.attachments.map((att, index) => `
                        <div style="margin-bottom: 4px;">
                          ${index + 1}. <a 
                            href="#" 
                            onclick="downloadAttachment('${att.messageId}', '${att.attachmentId}', '${att.filename}'); return false;"
                            style="color: #1976d2; text-decoration: underline;"
                          >${att.filename}</a>
                        </div>
                      `).join('')}
                    </div>
                  ` : 'No attachments'}
                </div>
              </div>
            `).join('')}
          </div>
        `;

        setStatus(emailContent);
        // Add the download function to window for the onclick handlers
        (window as any).downloadAttachment = downloadAttachment;
      }

    } catch (err) {
      console.error('Error processing emails:', err);
      setError('Failed to process emails. Please check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TextField
            fullWidth
            label="Company Name or Domain"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            margin="normal"
            variant="outlined"
            placeholder="e.g., Gruhas"
            helperText="Enter domain (e.g., 'gruhas.com') or company name will be converted to domain format"
            error={!!error}
          />
          
          <Button
            fullWidth
            variant="contained"
            onClick={processEmails}
            disabled={!companyName}
            sx={{ mt: 3, mb: 2 }}
          >
            Process Emails
          </Button>
        </>
      )}

      {status && (
        <Box sx={{ mt: 2 }}>
          <Alert 
            severity="success"
            sx={{
              '& .MuiAlert-message': {
                width: '100%'
              }
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: status }} />
          </Alert>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}

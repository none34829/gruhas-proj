'use client';

import { useState, useEffect, useRef } from 'react';
import { TextField, Button, Alert, CircularProgress, Box } from '@mui/material';
import ChatAnalyzer from './ChatAnalyzer';
import { Dialog, DialogTitle, DialogContent, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

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
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [emailDetails, setEmailDetails] = useState<any[]>([]);
  const [folderName, setFolderName] = useState('');
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<{ id: string; name: string } | null>(null);
  const [moveProgress, setMoveProgress] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [showOrganizeDialog, setShowOrganizeDialog] = useState(false);
  const [tempFolderName, setTempFolderName] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [viewAttachment, setViewAttachment] = useState<{
    messageId: string;
    attachmentId: string;
    filename: string;
    content: string;
    type: 'document' | 'excel';
  } | null>(null);
  const chatAnalyzerRef = useRef<any>(null);
  const handleViewAttachment = async (messageId: string, attachmentId: string, filename: string) => {
    try {
      const response = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
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
      const base64Data = data.data.replace(/-/g, '+').replace(/_/g, '/');
      const fileExtension = filename.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'xlsx' || fileExtension === 'xls' || fileExtension === 'docx' || fileExtension === 'doc') {
        // First create the file metadata
        const metadataResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: filename,
            mimeType: fileExtension === 'xlsx' || fileExtension === 'xls' 
              ? 'application/vnd.google-apps.spreadsheet'
              : 'application/vnd.google-apps.document'
          })
        });
  
        if (!metadataResponse.ok) {
          throw new Error('Failed to create file metadata');
        }
  
        const { id: fileId } = await metadataResponse.json();
  
        // Then upload the file content
        const uploadResponse = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, 
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': fileExtension === 'xlsx' || fileExtension === 'xls'
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            },
            body: Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
          }
        );
  
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file content');
        }
  
        // Use appropriate viewer URL
        const viewerUrl = fileExtension === 'xlsx' || fileExtension === 'xls'
          ? `https://docs.google.com/spreadsheets/d/${fileId}/preview`
          : `https://docs.google.com/document/d/${fileId}/preview`;
        
        setViewAttachment({
          messageId,
          attachmentId,
          filename,
          content: viewerUrl,
          type: 'document'  // Keep type as 'document' for consistent UI
        });
      } else {
        // For other files (PDF, images, etc.), use data URL approach
        let mimeType = 'application/octet-stream';
        switch (fileExtension) {
          case 'pdf':
            mimeType = 'application/pdf';
            break;
          case 'jpg':
          case 'jpeg':
            mimeType = 'image/jpeg';
            break;
          case 'png':
            mimeType = 'image/png';
            break;
          default:
            mimeType = 'application/octet-stream';
        }
        
        setViewAttachment({
          messageId,
          attachmentId,
          filename,
          content: `data:${mimeType};base64,${base64Data}`,
          type: 'document'
        });
      }
    } catch (err) {
      console.error('Error viewing attachment:', err);
      setError('Failed to view attachment. Please try again.');
    }
  };
  
  const handleChatForAttachment = (filename: string) => {
    setIsChatOpen(true); // Set this first
    
    // Then check if we have a currentFolder
    if (currentFolder?.id && chatAnalyzerRef.current) {
      // Reset chat to focus on the specific file
      chatAnalyzerRef.current.resetChat(filename);
    } else {
      // If attachments are not yet moved to drive, just scroll to chat
      const chatElement = document.getElementById('chat-window');
      if (chatElement) {
        chatElement.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  useEffect(() => {
    // Add handlers to window object
    (window as any).handleViewAttachment = handleViewAttachment;
    (window as any).handleChatForAttachment = handleChatForAttachment;
    (window as any).downloadAttachment = downloadAttachment;
  
    return () => {
      // Clean up
      delete (window as any).handleViewAttachment;
      delete (window as any).handleChatForAttachment;
      delete (window as any).downloadAttachment;
    };
  }, []);

  const isValidEmail = (email: string): boolean => {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailPattern.test(email);
  };

  const isValidDomain = (domain: string): boolean => {
    const domainPattern = /^[a-zA-Z0-9]+([-.][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;
    return domainPattern.test(domain);
  };

  const validateInput = (input: string): boolean => {
    // Allow email addresses, domains, or company names
    return isValidEmail(input) || isValidDomain(input) || /^[a-zA-Z0-9]+(?:[ -][a-zA-Z0-9]+)*$/.test(input);
  };

  const getSearchQuery = (input: string): string => {
    if (isValidEmail(input)) {
      // If it's an email address, search for emails from that specific address
      return `from:${input}`;
    } else if (isValidDomain(input)) {
      // If it's a domain, search for emails from that domain
      return `from:*@${input}`;
    } else {
      // If it's a company name, convert to domain and search
      const domainExtensions = ['.com', '.org', '.net', '.edu', '.gov', '.co', '.io', '.ai', '.biz', '.info', 
        '.ca', '.uk', '.de', '.fr', '.jp', '.cn', '.au', '.in', '.br', '.mx', '.ru', '.es', '.it', '.nl', 
        '.ch', '.se', '.no', '.dk', '.fi', '.pl', '.cz', '.at', '.be', '.ie', '.nz', '.sg', '.hk', '.kr', 
        '.tr', '.za', '.pt', '.gr', '.hu', '.ro', '.il', '.th', '.my', '.ph', '.vn', '.id', '.cl', '.ar', 
        '.co.uk', '.co.jp', '.com.au', '.co.in', '.com.br', '.com.mx', '.co.za', '.com.sg', '.com.ph', 
        '.com.my', '.com.vn', '.com.ar', '.com.tr', '.org.uk', '.net.au', '.bike'];
      const baseDomain = input.toLowerCase().replace(/[^a-z0-9]/g, '');
      const queries = domainExtensions.map(ext => `from:*@${baseDomain}${ext}`);
      return queries.join(' OR ');
    }
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

  const createDriveFolder = async (customFolderName: string) => {
    try {
      setIsMoving(true);
      setMoveProgress(0);
      setLoading(true);

      // Create main folder
      const mainFolderResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: customFolderName,
          mimeType: 'application/vnd.google-apps.folder'
        })
      });

      if (!mainFolderResponse.ok) {
        throw new Error('Failed to create main folder');
      }

      const mainFolder = await mainFolderResponse.json();
      setCurrentFolder({ id: mainFolder.id, name: customFolderName });
      setIsChatOpen(true);

      // Group attachments by year and month
      const attachmentsByDate: { [year: string]: { [month: string]: { monthName: string, emails: { email: typeof emailDetails[0], attachments: typeof emailDetails[0]['attachments'] }[] } } } = {};
      
      emailDetails.forEach(email => {
        const date = new Date(email.date);
        const year = date.getFullYear().toString();
        const monthIndex = date.getMonth();
        const monthKey = (monthIndex + 1).toString().padStart(2, '0'); // "01" for January
        const monthName = date.toLocaleString('default', { month: 'long' });
        const monthDisplay = `${monthKey} - ${monthName}`; // Format: "01 - January"

        if (!attachmentsByDate[year]) {
          attachmentsByDate[year] = {};
        }
        if (!attachmentsByDate[year][monthKey]) {
          attachmentsByDate[year][monthKey] = {
            monthName: monthDisplay,
            emails: []
          };
        }
        attachmentsByDate[year][monthKey].emails.push({ email, attachments: email.attachments });
      });

      // Calculate total attachments for progress
      const totalAttachments = emailDetails.reduce((sum, email) => sum + email.attachments.length, 0);
      let processedAttachments = 0;

      // Create year and month folders and move attachments
      for (const [year, months] of Object.entries(attachmentsByDate)) {
        // Create year folder
        const yearFolderResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: year,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [mainFolder.id]
          })
        });

        if (!yearFolderResponse.ok) {
          console.error(`Failed to create folder for year ${year}`);
          continue;
        }

        const yearFolder = await yearFolderResponse.json();

        // Process months in order (they're already sorted by monthKey)
        const sortedMonths = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]));

        for (const [monthKey, { monthName, emails }] of sortedMonths) {
          // First create folder with numeric name to maintain order
          const monthFolderResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: monthKey,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [yearFolder.id]
            })
          });

          if (!monthFolderResponse.ok) {
            console.error(`Failed to create folder for ${monthName} ${year}`);
            continue;
          }

          const monthFolder = await monthFolderResponse.json();

          // Then rename it to the actual month name
          await fetch(`https://www.googleapis.com/drive/v3/files/${monthFolder.id}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: monthName
            })
          });

          // Upload attachments to month folder
          for (const { email, attachments } of emails) {
            for (const attachment of attachments) {
              // Get attachment content
              const attachmentResponse = await fetch(
                `https://www.googleapis.com/gmail/v1/users/me/messages/${attachment.messageId}/attachments/${attachment.attachmentId}`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`
                  }
                }
              );

              if (!attachmentResponse.ok) {
                console.error(`Failed to fetch attachment: ${attachment.filename}`);
                continue;
              }

              const attachmentData = await attachmentResponse.json();
              const binaryData = atob(attachmentData.data.replace(/-/g, '+').replace(/_/g, '/'));
              const bytes = new Uint8Array(binaryData.length);
              for (let i = 0; i < binaryData.length; i++) {
                bytes[i] = binaryData.charCodeAt(i);
              }

              // Upload to Drive in month folder
              const metadata = {
                name: attachment.filename,
                parents: [monthFolder.id]
              };

              const form = new FormData();
              form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
              form.append('file', new Blob([bytes]));

              const uploadResponse = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`
                  },
                  body: form
                }
              );

              if (!uploadResponse.ok) {
                console.error(`Failed to upload: ${attachment.filename}`);
              }

              // Update progress
              processedAttachments++;
              setMoveProgress(Math.round((processedAttachments / totalAttachments) * 100));
            }
          }
        }
      }

      setStatus(prev => `${prev}\n\n✅ All attachments have been moved to Google Drive folder: "${customFolderName}" with year and month subfolders`);
      setShowFolderDialog(false);
      setFolderName('');
    } catch (err) {
      console.error('Error moving to Drive:', err);
      setError('Failed to move attachments to Drive. Please try again.');
    } finally {
      setLoading(false);
      setIsMoving(false);
      setMoveProgress(0);
    }
  };

  const createFolderWithoutSubfolders = async (folderName: string) => {
    try {
      setIsMoving(true);
      setMoveProgress(0);
      setLoading(true);
      
      // Create folder
      const folderResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder'
        })
      });

      if (!folderResponse.ok) {
        throw new Error('Failed to create folder');
      }

      const folder = await folderResponse.json();
      setCurrentFolder({ id: folder.id, name: folderName });
      setIsChatOpen(true);

      // Calculate total attachments for progress
      const totalAttachments = emailDetails.reduce((sum, email) => sum + email.attachments.length, 0);
      let processedAttachments = 0;

      // Upload each attachment to the folder
      for (const email of emailDetails) {
        for (const attachment of email.attachments) {
          // Get attachment content
          const attachmentResponse = await fetch(
            `https://www.googleapis.com/gmail/v1/users/me/messages/${attachment.messageId}/attachments/${attachment.attachmentId}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            }
          );

          if (!attachmentResponse.ok) {
            console.error(`Failed to fetch attachment: ${attachment.filename}`);
            continue;
          }

          const attachmentData = await attachmentResponse.json();
          const binaryData = atob(attachmentData.data.replace(/-/g, '+').replace(/_/g, '/'));
          const bytes = new Uint8Array(binaryData.length);
          for (let i = 0; i < binaryData.length; i++) {
            bytes[i] = binaryData.charCodeAt(i);
          }

          // Upload to Drive
          const metadata = {
            name: attachment.filename,
            parents: [folder.id]
          };

          const form = new FormData();
          form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
          form.append('file', new Blob([bytes]));

          const uploadResponse = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`
              },
              body: form
            }
          );

          if (!uploadResponse.ok) {
            console.error(`Failed to upload: ${attachment.filename}`);
          }

          // Update progress
          processedAttachments++;
          setMoveProgress(Math.round((processedAttachments / totalAttachments) * 100));
        }
      }

      setStatus(prev => `${prev}\n\n✅ All attachments have been moved to Google Drive folder: "${folderName}"`);
      setShowFolderDialog(false);
      setFolderName('');
    } catch (err) {
      console.error('Error moving to Drive:', err);
      setError('Failed to move attachments to Drive. Please try again.');
    } finally {
      setLoading(false);
      setIsMoving(false);
      setMoveProgress(0);
    }
  };

  const processEmails = async () => {
    if (!validateInput(searchInput)) {
      setError('Please enter a valid email address (e.g., "user@gruhas.com"), domain (e.g., "gruhas.com"), or company name');
      return;
    }

    setLoading(true);
    setError('');
    setStatus('');
    setEmailDetails([]);
    setShowFolderDialog(false); // Reset folder dialog when searching new email
    setFolderName(''); // Reset folder name
    setIsChatOpen(false); // Close chat when starting new search
setCurrentFolder(null); // Reset current folder

    try {
      const searchQuery = encodeURIComponent(`has:attachment ${getSearchQuery(searchInput)}`);
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
        setStatus(`No emails found with attachments from ${searchInput}`);
        return;
      }

      setStatus(`Found ${allMessages.length} emails with attachments from ${searchInput}`);
      
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
        setEmailDetails(validDetails);
        
        const emailContent = `
          <div style="font-family: 'Segoe UI', system-ui, sans-serif;">
            <div style="margin-bottom: 24px; padding: 16px; background: #e3f2fd; border-radius: 8px; color: #1565c0;">
              <h3 style="margin: 0; font-size: 18px;">Found ${validDetails.length} emails with attachments from ${searchInput}</h3>
            </div>
            ${validDetails.map((detail, i) => `
              <div style="background: #fff; padding: 20px; margin-bottom: 16px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <div style="width: 32px; height: 32px; background: #e3f2fd; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                    <span style="color: #1565c0; font-weight: 600;">${i + 1}</span>
                  </div>
                  <div style="flex-grow: 1;">
                    <div style="font-size: 16px; font-weight: 500; color: #1565c0;">
                      ${detail.fromName} 
                      ${detail.fromEmail ? `<span style="font-weight: normal; color: #666; font-size: 14px;">&lt;${detail.fromEmail}&gt;</span>` : ''}
                    </div>
                  </div>
                </div>
                <div style="margin-left: 44px;">
                  <div style="color: #666; margin-bottom: 8px; font-size: 14px;">
                    <strong style="color: #444;">Date:</strong> ${detail.formattedDate} (IST)
                  </div>
                  <div style="margin-bottom: 12px; font-size: 15px;">
                    <strong style="color: #444;">Subject:</strong> ${detail.subject}
                  </div>
                  <div>
                    <strong style="color: #444;">Attachments:</strong>
                    ${detail.attachments.length > 0 ? `
  <div style="margin-top: 8px; margin-left: 8px;">
    ${detail.attachments.map((att, index) => `
      <div style="margin-bottom: 8px; display: flex; align-items: center;">
        <span style="width: 24px; height: 24px; background: #f5f5f5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 8px; font-size: 12px; color: #666;">
          ${index + 1}
        </span>
        <span style="color: #666; flex-grow: 1;">${att.filename}</span>
        <div style="display: flex; gap: 12px; margin-left: 12px;">
          <a 
            href="#" 
            onclick="handleViewAttachment('${att.messageId}', '${att.attachmentId}', '${att.filename}'); return false;"
            style="color: #1976d2; text-decoration: none; font-size: 14px;"
            onmouseover="this.style.textDecoration='underline'"
            onmouseout="this.style.textDecoration='none'"
          >
            View
          </a>
          <a 
            href="#" 
            onclick="downloadAttachment('${att.messageId}', '${att.attachmentId}', '${att.filename}'); return false;"
            style="color: #1976d2; text-decoration: none; font-size: 14px;"
            onmouseover="this.style.textDecoration='underline'"
            onmouseout="this.style.textDecoration='none'"
          >
            Download
          </a>
          <a 
            href="#" 
            onclick="handleChatForAttachment('${att.filename}'); return false;"
            style="color: #1976d2; text-decoration: none; font-size: 14px;"
            onmouseover="this.style.textDecoration='underline'"
            onmouseout="this.style.textDecoration='none'"
          >
            Chat
          </a>
        </div>
      </div>
    `).join('')}
  </div>
` : '<span style="color: #666; font-style: italic;">No attachments</span>'}
                  </div>
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

  const handleChatToggle = (isOpen: boolean) => {
    setIsChatOpen(isOpen);
  };

  const handleFolderCreate = () => {
    setShowFolderDialog(true);
  };

  return (
    <Box sx={{ mt: 2 }}>
      <>
        <TextField
          fullWidth
          label="Email Address, Domain, or Company Name"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          margin="normal"
          variant="outlined"
          placeholder="e.g., user@gruhas.com, gruhas.com, or Gruhas"
          helperText="Enter an email address (e.g., 'user@gruhas.com'), domain (e.g., 'gruhas.com'), or company name (e.g., 'Gruhas/gruhas/GrUhAs/gRuHaS/etc.')"
          error={!!error}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: '#fff',
            }
          }}
        />
        
        <Button
          fullWidth
          variant="contained"
          onClick={processEmails}
          disabled={!searchInput || loading}
          sx={{
            mt: 3,
            mb: 2,
            py: 1.5,
            borderRadius: 2,
            textTransform: 'none',
            fontSize: '1rem',
            backgroundColor: '#1a73e8',
            '&:hover': {
              backgroundColor: '#1557b0'
            }
          }}
        >
          Process Emails
        </Button>
      </>

      {status && (
        <>
          <Box sx={{ mt: 3 }}>
            <div dangerouslySetInnerHTML={{ __html: status }} />
          </Box>
          
          {emailDetails.length > 0 && (
            <Box 
              sx={{ 
                mt: 3,
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                flexWrap: 'wrap',
                backgroundColor: '#f8f9fa',
                p: 2,
                borderRadius: 2
              }}
            >
              <Button
                variant="contained"
                color="primary"
                onClick={handleFolderCreate}
                disabled={loading}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  py: 1.5,
                  px: 3,
                  backgroundColor: '#1a73e8',
                  '&:hover': {
                    backgroundColor: '#1557b0'
                  }
                }}
              >
                Move Attachments to Drive
              </Button>
              
              {showFolderDialog && (
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexGrow: 1 }}>
                  <TextField
                    size="small"
                    label="Folder Name"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder={searchInput}
                    disabled={isMoving} // Disable input while processing
                    sx={{
                      flexGrow: 1,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        backgroundColor: '#fff'
                      }
                    }}
                  />
                  <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                    <Button
                      variant="contained"
                      onClick={() => {
                        setTempFolderName(folderName || searchInput);
                        setShowOrganizeDialog(true);
                      }}
                      disabled={isMoving}
                      sx={{
                        textTransform: 'none',
                        py: 1.5,
                        backgroundColor: isMoving ? '#f1f3f4' : '#34a853',
                        '&:hover': {
                          backgroundColor: isMoving ? '#f1f3f4' : '#2d8d47'
                        },
                        minWidth: '120px'
                      }}
                    >
                      {isMoving ? `${moveProgress}%` : 'Create & Move'}
                    </Button>
                    {isMoving && (
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: '3px',
                          backgroundColor: '#34a853',
                          borderBottomLeftRadius: '8px',
                          borderBottomRightRadius: '8px',
                          width: `${moveProgress}%`,
                          transition: 'width 0.3s ease-in-out'
                        }}
                      />
                    )}
                  </Box>
                  <Button
                    variant="outlined"
                    onClick={() => setShowFolderDialog(false)}
                    disabled={isMoving}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 2,
                      py: 1.5,
                      borderColor: '#dadce0',
                      color: '#3c4043',
                      '&:hover': {
                        borderColor: '#dadce0',
                        backgroundColor: '#f1f3f4'
                      }
                    }}
                  >
                    Cancel
                  </Button>
                </Box>
              )}

              {showOrganizeDialog && (
                <>
                  <Box
                    sx={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      backdropFilter: 'blur(4px)',
                      zIndex: 9998
                    }}
                    onClick={() => setShowOrganizeDialog(false)}
                  />
                  <Box
                    sx={{
                      position: isChatOpen ? 'fixed' : 'absolute',
                      ...(isChatOpen ? {
                        top: '60%', // Move it lower when chat is open
                        transform: 'translate(-50%, -50%)',
                      } : {
                        bottom: 50,
                        transform: 'translateX(-50%)',
                      }),
                      left: '50%',
                      backgroundColor: '#fff',
                      borderRadius: 2,
                      boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.1)',
                      p: 3,
                      width: '400px',
                      maxWidth: '90%',
                      zIndex: 9999
                    }}
                  >
                    <Box sx={{ mb: 2, fontSize: '1.25rem', fontWeight: 500, color: '#1a73e8' }}>
                      How would you like to organize the attachments?
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Button
                        variant="contained"
                        onClick={() => {
                          setShowOrganizeDialog(false);
                          createDriveFolder(tempFolderName);
                        }}
                        sx={{
                          textTransform: 'none',
                          py: 1.5,
                          backgroundColor: '#34a853',
                          '&:hover': { backgroundColor: '#2d8d47' }
                        }}
                      >
                        Create Year/Month Subfolders
                      </Button>
                      <Button
                        variant="contained"
                        onClick={() => {
                          setShowOrganizeDialog(false);
                          createFolderWithoutSubfolders(tempFolderName);
                        }}
                        sx={{
                          textTransform: 'none',
                          py: 1.5,
                          backgroundColor: '#1a73e8',
                          '&:hover': { backgroundColor: '#1557b0' }
                        }}
                      >
                        Keep All Files in One Folder
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setShowOrganizeDialog(false);
                        }}
                        sx={{
                          textTransform: 'none',
                          py: 1.5,
                          borderColor: '#dadce0',
                          color: '#3c4043',
                          '&:hover': {
                            borderColor: '#dadce0',
                            backgroundColor: '#f1f3f4'
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    </Box>
                  </Box>
                </>
              )}
            </Box>
          )}
        </>
      )}

{viewAttachment && (
  <Dialog
    open={true}
    onClose={() => setViewAttachment(null)}
    maxWidth="md"
    fullWidth
  >
    <DialogTitle>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">{viewAttachment.filename}</Typography>
        <IconButton onClick={() => setViewAttachment(null)}>
          <CloseIcon />
        </IconButton>
      </Box>
    </DialogTitle>
    <DialogContent>
  <Box sx={{ p: 2, height: '70vh', overflow: 'hidden' }}>
    {viewAttachment.type === 'excel' ? (
      <iframe
        src={viewAttachment.content}
        style={{ 
          width: '100%', 
          height: '100%', 
          border: 'none',
          backgroundColor: '#f8f9fa'
        }}
        title={viewAttachment.filename}
      />
    ) : (
      <object
        data={viewAttachment.content}
        type="application/pdf"
        style={{ width: '100%', height: '100%' }}
      >
        <iframe
          src={viewAttachment.content}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title={viewAttachment.filename}
        />
      </object>
    )}
  </Box>
</DialogContent>
  </Dialog>
)}

{isChatOpen && (
  <ChatAnalyzer
    ref={chatAnalyzerRef}
    accessToken={accessToken}
    folderId={currentFolder?.id || ''}
    folderName={currentFolder?.name || 'Attachments'}
    onChatToggle={handleChatToggle}
  />
)}

      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mt: 2,
            borderRadius: 2,
            '& .MuiAlert-message': {
              width: '100%'
            }
          }}
        >
          {error}
        </Alert>
      )}
    </Box>
  );
}

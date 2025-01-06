'use client';

import { useState, useRef, useEffect, forwardRef, ForwardedRef } from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  CircularProgress,
  Divider,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

interface ChatAnalyzerProps {
  accessToken: string;
  folderId: string;
  folderName: string;
  onChatToggle?: (isOpen: boolean) => void;
}

export default forwardRef(function ChatAnalyzer(
  { accessToken, folderId, folderName, onChatToggle }: ChatAnalyzerProps,
  ref: ForwardedRef<{ resetChat: (filename: string) => void }>
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const [currentFile, setCurrentFile] = useState<string | null>(null);

  const resetChat = (filename: string) => {
    setMessages([]);
    setCurrentFile(filename);
    // Add initial message about the specific file
    setMessages([{
      role: 'assistant',
      content: `I'm ready to help you analyze ${filename}. What would you like to know about it?`
    }]);
  };
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Notify parent that chat is open
    onChatToggle?.(true);
    return () => {
      // Notify parent that chat is closed
      onChatToggle?.(false);
    };
  }, [onChatToggle]);

  const analyzeFiles = async (query: string) => {
    try {
      setIsLoading(true);
      console.log('Starting file analysis with query:', query);
      console.log('Using folder ID:', folderId);
      console.log('Access token available:', !!accessToken);
      
      if (!folderId || !accessToken) {
        throw new Error('Missing folder ID or access token');
      }

      // First, list all Excel files in the folder
      const driveUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and (mimeType='application/vnd.ms-excel' or mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')&fields=files(id,name,mimeType)`;
      console.log('Fetching files from Drive:', driveUrl);
      
      const filesResponse = await fetch(
        driveUrl,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
      );

      console.log('Drive API response status:', filesResponse.status);
      
      if (!filesResponse.ok) {
        const errorText = await filesResponse.text();
        console.error('Drive API error:', errorText);
        throw new Error(`Failed to fetch files from Drive: ${filesResponse.status} ${errorText}`);
      }

      const filesData = await filesResponse.json();
      console.log('Files found:', filesData);
      
      const files = (filesData.files || []) as DriveFile[];

      if (files.length === 0) {
        return "No Excel files found in this folder. Please make sure you have uploaded Excel files to analyze.";
      }

      // Analyze each file
      console.log(`Analyzing ${files.length} files...`);
      const analysisPromises = files.map(async (file: DriveFile) => {
        try {
          console.log(`Starting analysis for file: ${file.name}`);
          const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileId: file.id,
              accessToken,
              query,
            }),
          });

          console.log(`Analysis API response status for ${file.name}:`, response.status);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Analysis API error for ${file.name}:`, errorText);
            throw new Error(`Failed to analyze file: ${file.name}`);
          }

          const result = await response.json();
          console.log(`Analysis completed for ${file.name}:`, result);
          return `Analysis of ${file.name}:\n${result.analysis}`;
        } catch (error) {
          console.error(`Error analyzing ${file.name}:`, error);
          return `Failed to analyze ${file.name}. Please try again.`;
        }
      });

      const analysisResults = await Promise.all(analysisPromises);
      console.log('All analyses completed');
      return analysisResults.join('\n\n');

    } catch (error) {
      console.error('Error in analyzeFiles:', error);
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}. Please make sure you have selected a folder and have proper permissions.`;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    // Get AI response
    const response = await analyzeFiles(userMessage);
    
    // Add AI response
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
  };

  if (ref) {
    ref.current = { resetChat };
  }

  return (
    <Box sx={{ width: '100%', mt: 4 }}>
      <Paper
        elevation={3}
        sx={{
          p: 2,
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ color: '#1a73e8', fontWeight: 600 }}>
          Chat Analysis for {folderName}
        </Typography>
        
        <Divider sx={{ my: 2 }} />

        {/* Messages Container */}
        <Box
          sx={{
            height: '400px',
            overflowY: 'auto',
            mb: 2,
            p: 2,
            backgroundColor: 'rgba(248, 249, 250, 0.5)',
            borderRadius: 1,
          }}
        >
          {messages.map((message, index) => (
            <Box
              key={index}
              sx={{
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                mb: 2,
              }}
            >
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  maxWidth: '70%',
                  backgroundColor: message.role === 'user' ? '#1a73e8' : '#fff',
                  color: message.role === 'user' ? '#fff' : 'text.primary',
                  borderRadius: 2,
                }}
              >
                <Typography variant="body1">
                  {message.content}
                </Typography>
              </Paper>
            </Box>
          ))}
          <div ref={messagesEndRef} />
        </Box>

        {/* Input Area */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Ask about your Excel files..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                backgroundColor: '#fff',
              }
            }}
          />
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={isLoading}
            sx={{
              bgcolor: '#1a73e8',
              color: '#fff',
              '&:hover': {
                bgcolor: '#1557b0',
              },
              '&.Mui-disabled': {
                bgcolor: '#ccc',
              },
            }}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
          </IconButton>
        </Box>
      </Paper>
    </Box>
  );
});

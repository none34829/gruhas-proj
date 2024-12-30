'use client';

import { useState, useEffect } from 'react';
import { Box, Container, Typography, Paper } from '@mui/material';
import Image from 'next/image';
import { Button } from '@mui/material';
import EmailProcessor from './components/EmailProcessor';

const config = {
    clientId: '341481391326-253sju86761fgk7pkkf6tlgievnj5eqp.apps.googleusercontent.com',
    apiKey: 'AIzaSyBPKu02MYi7QBnIogUY73G0g6wUgtF7A40',
};

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
        setGoogleLoaded(true);
        setIsLoading(false);
      } else {
        // Check again in 500ms
        setTimeout(initializeGoogleSignIn, 500);
      }
    };

    // Start checking for Google Sign-In
    initializeGoogleSignIn();

    // Set a timeout to stop checking after 10 seconds
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      if (!googleLoaded) {
        setError('Google Sign-In failed to load. Please refresh the page.');
      }
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, [googleLoaded]);

  const handleGoogleSignIn = () => {
    if (!window.google?.accounts?.oauth2) {
      setError('Google Sign-In is not available');
      return;
    }

    try {
      const client = window.google.accounts.oauth2;
      
      client.initTokenClient({
        client_id: config.clientId,
        scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive',
        callback: (response: any) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
            setIsAuthenticated(true);
            setError('');
            console.log('Authentication successful');
          } else {
            setError('Failed to get access token');
          }
        },
        error_callback: (error: any) => {
          console.error('Google Sign-In error:', error);
          setError('Failed to sign in with Google');
        }
      }).requestAccessToken();
    } catch (err) {
      console.error('Error initializing Google Sign-In:', err);
      setError('Failed to initialize Google Sign-In');
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ 
        mt: 8, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center' 
      }}>
        <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 500 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4 }}>
            Email Attachment Manager
          </Typography>
          
          {!isAuthenticated ? (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              gap: 2 
            }}>
              <Typography variant="body1" align="center" sx={{ mb: 2 }}>
                Sign in with Google to manage your email attachments
              </Typography>
              
              <Button
                variant="contained"
                onClick={handleGoogleSignIn}
                disabled={!googleLoaded || isLoading}
                sx={{
                  backgroundColor: '#fff',
                  color: '#757575',
                  textTransform: 'none',
                  px: 4,
                  py: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  '&:hover': {
                    backgroundColor: '#f5f5f5'
                  }
                }}
              >
                <Image
                  src="/google-logo.svg"
                  alt="Google Logo"
                  width={20}
                  height={20}
                  priority
                />
                Sign in with Google
              </Button>
              {(isLoading && !googleLoaded) && (
                <Typography variant="body2" color="text.secondary">
                  Loading Google Sign-In...
                </Typography>
              )}
              {error && (
                <Typography variant="body2" color="error.main">
                  {error}
                </Typography>
              )}
            </Box>
          ) : (
            <EmailProcessor accessToken={accessToken} />
          )}
        </Paper>
      </Box>
    </Container>
  );
}

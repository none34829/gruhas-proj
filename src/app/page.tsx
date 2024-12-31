'use client';

import { useState, useEffect } from 'react';
import { Box, Container, Typography, Paper, CircularProgress } from '@mui/material';
import Image from 'next/image';
import { Button } from '@mui/material';
import EmailProcessor from './components/EmailProcessor';

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string }) => void;
            error_callback: (error: unknown) => void;
          }) => {
            requestAccessToken: () => void;
          };
        };
      };
    };
  }
}

const config = {
  clientId: '341481391326-253sju86761fgk7pkkf6tlgievnj5eqp.apps.googleusercontent.com',
  apiKey: 'AIzaSyBPKu02MYi7QBnIogUY73G0g6wUgtF7A40',
};

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [accessToken, setAccessToken] = useState<string>('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
        callback: (response) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
            setIsAuthenticated(true);
            setError('');
            console.log('Authentication successful');
          } else {
            setError('Failed to get access token');
          }
        },
        error_callback: (error) => {
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
    <>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(125deg, #1a73e8 0%, #34a853 50%, #4285f4 100%)',
          opacity: 0.1,
          zIndex: -2,
        }}
      />
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          zIndex: -1,
          '&::before, &::after': {
            content: '""',
            position: 'absolute',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(26,115,232,0.2) 0%, rgba(26,115,232,0) 70%)',
            animation: 'float 20s infinite linear',
          },
          '&::before': {
            top: '-300px',
            left: '-300px',
          },
          '&::after': {
            bottom: '-300px',
            right: '-300px',
            background: 'radial-gradient(circle, rgba(52,168,83,0.2) 0%, rgba(52,168,83,0) 70%)',
          },
          '@keyframes float': {
            '0%': {
              transform: 'rotate(0deg) translate(100px) rotate(0deg)',
            },
            '100%': {
              transform: 'rotate(360deg) translate(100px) rotate(-360deg)',
            },
          },
        }}
      >
        <svg width="100%" height="100%" style={{ opacity: 0.3 }}>
          <pattern
            id="pattern-circles"
            x="0"
            y="0"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <circle cx="20" cy="20" r="1" fill="#1a73e8" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#pattern-circles)" />
        </svg>
      </Box>
      <Container maxWidth="md">
        <Box
          sx={{
            minHeight: '100vh',
            py: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            position: 'relative'
          }}
        >
          <Paper
            elevation={3}
            sx={{
              width: '100%',
              p: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              borderRadius: 2,
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{
                fontWeight: 600,
                color: '#1a73e8',
                textAlign: 'center',
                mb: 3
              }}
            >
              Email Attachment Manager
            </Typography>

            {!isAuthenticated ? (
              <Box
                sx={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3
                }}
              >
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ textAlign: 'center', mb: 2 }}
                >
                  Sign in with Google to manage your email attachments
                </Typography>

                <Button
                  variant="contained"
                  onClick={handleGoogleSignIn}
                  disabled={!googleLoaded || isLoading}
                  sx={{
                    py: 1.5,
                    px: 4,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontSize: '1rem',
                    backgroundColor: '#1a73e8',
                    '&:hover': {
                      backgroundColor: '#1557b0'
                    },
                    display: 'flex',
                    gap: 2,
                    alignItems: 'center',
                    color: '#fff'
                  }}
                >
                  <Image
                    src="/google-signin.svg"
                    alt="Google"
                    width={18}
                    height={18}
                    priority
                    style={{ marginRight: '8px' }}
                  />
                  Sign in with Google
                </Button>

                {(isLoading && !googleLoaded) && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    <CircularProgress size={16} />
                    Loading Google Sign-In...
                  </Typography>
                )}

                {error && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'error.main',
                      bgcolor: 'error.light',
                      p: 1,
                      borderRadius: 1,
                      width: '100%',
                      textAlign: 'center'
                    }}
                  >
                    {error}
                  </Typography>
                )}
              </Box>
            ) : (
              <EmailProcessor accessToken={accessToken} />
            )}
          </Paper>

          <Box
            sx={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              py: 2,
              bgcolor: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              borderTop: '1px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 1,
              boxShadow: '0 -4px 32px rgba(0, 0, 0, 0.05)',
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                fontSize: '0.875rem'
              }}
            >
              Made with 
              <Box
                component="span"
                sx={{
                  color: '#e25555',
                  animation: 'heartBeat 1.2s ease-in-out infinite',
                  display: 'inline-block',
                  '@keyframes heartBeat': {
                    '0%': {
                      transform: 'scale(1)',
                    },
                    '14%': {
                      transform: 'scale(1.3)',
                    },
                    '28%': {
                      transform: 'scale(1)',
                    },
                    '42%': {
                      transform: 'scale(1.3)',
                    },
                    '70%': {
                      transform: 'scale(1)',
                    },
                  }
                }}
              >
                ❤️
              </Box>
              at
              <Typography
                component="span"
                sx={{
                  color: '#1a73e8',
                  fontWeight: 600,
                  ml: 0.5
                }}
              >
                Gruhas
              </Typography>
            </Typography>
          </Box>
        </Box>
      </Container>
    </>
  );
}

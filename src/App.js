import React, { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { config } from './config';
import { Box, Container, Typography, CircularProgress } from '@mui/material';
import EmailProcessor from './components/EmailProcessor';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSuccess = (response) => {
    setAccessToken(response.access_token);
    setIsAuthenticated(true);
  };

  const onError = () => {
    console.log('Login Failed');
  };

  return (
    <GoogleOAuthProvider clientId={config.clientId}>
      <Container maxWidth="md">
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Email Attachment Manager
          </Typography>
          
          {!isAuthenticated ? (
            <Box sx={{ mt: 4 }}>
              <GoogleLogin
                onSuccess={onSuccess}
                onError={onError}
                scope={config.scope}
              />
            </Box>
          ) : (
            <Box sx={{ mt: 4 }}>
              {loading ? (
                <CircularProgress />
              ) : (
                <EmailProcessor accessToken={accessToken} />
              )}
            </Box>
          )}
        </Box>
      </Container>
    </GoogleOAuthProvider>
  );
}

export default App;

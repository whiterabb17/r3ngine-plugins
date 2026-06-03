import React from 'react';
import { Box, Chip, Tooltip } from '@mui/material';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { testBurpConnection } from '../api/burpApi';

export const ConnectionStatusBadge: React.FC = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['burp_health'],
    queryFn: testBurpConnection,
    refetchInterval: 30000, // Poll every 30s
    retry: 2,
  });

  if (isLoading) {
    return (
      <Chip
        icon={<RefreshCw size={12} style={{ animation: 'spin 2s linear infinite' }} />}
        label="CHECKING BURP CONNECTION..."
        sx={{
          fontFamily: 'Orbitron',
          fontSize: '0.65rem',
          fontWeight: 900,
          bgcolor: 'rgba(255, 255, 255, 0.05)',
          color: 'rgba(255, 255, 255, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          height: 28,
          '& .MuiChip-icon': { color: 'inherit' },
          '@keyframes spin': {
            '0%': { transform: 'rotate(0deg)' },
            '100%': { transform: 'rotate(360deg)' },
          },
        }}
      />
    );
  }

  const isConnected = !isError && data?.status === 'ok';
  const color = isConnected ? '#00ff62' : '#ff003c';
  const label = isConnected ? 'CONNECTED TO BURP' : 'BURP OFFLINE';
  const message = isConnected 
    ? data?.message || 'Successfully connected to Burp Suite REST API'
    : (error as Error)?.message || data?.message || 'Cannot reach Burp Suite API. Click settings to configure.';

  return (
    <Tooltip title={message} arrow>
      <Chip
        icon={
          isConnected ? (
            <CheckCircle size={12} color={color} />
          ) : (
            <XCircle size={12} color={color} />
          )
        }
        label={label}
        sx={{
          fontFamily: 'Orbitron',
          fontSize: '0.65rem',
          fontWeight: 900,
          bgcolor: `${color}15`,
          color: color,
          border: `1px solid ${color}44`,
          height: 28,
          cursor: 'help',
          '& .MuiChip-icon': { color: 'inherit' },
          animation: 'pulse 2s ease-in-out infinite',
          '@keyframes pulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.6 },
          },
        }}
      />
    </Tooltip>
  );
};

export default ConnectionStatusBadge;

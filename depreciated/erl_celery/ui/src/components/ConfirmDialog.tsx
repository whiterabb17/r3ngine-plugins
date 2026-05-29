import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  IconButton,
} from '@mui/material';
import { X, AlertTriangle, ShieldAlert } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'CONFIRM',
  cancelText = 'CANCEL',
  isDestructive = true,
  isLoading = false,
}) => {
  return (
    <Dialog
      open={open}
      onClose={isLoading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: '#0d0c14',
            backgroundImage: 'linear-gradient(rgba(255, 0, 60, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 0, 60, 0.02) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            border: `1px solid ${isDestructive ? 'rgba(255, 0, 60, 0.3)' : 'rgba(0, 243, 255, 0.3)'}`,
            borderRadius: 0,
            boxShadow: `0 0 30px rgba(0, 0, 0, 0.5), 0 0 10px ${isDestructive ? 'rgba(255, 0, 60, 0.1)' : 'rgba(0, 243, 255, 0.1)'}`,
          }
        }
      }}
    >
      <DialogTitle sx={{
        m: 0,
        p: 2,
        bgcolor: isDestructive ? 'rgba(255, 0, 60, 0.05)' : 'rgba(0, 243, 255, 0.05)',
        borderBottom: `1px solid ${isDestructive ? 'rgba(255, 0, 60, 0.1)' : 'rgba(0, 243, 255, 0.1)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          {isDestructive ? <ShieldAlert size={20} color="#ff003c" /> : <AlertTriangle size={20} color="#00f3ff" />}
          <Typography sx={{
            fontFamily: 'Orbitron',
            fontWeight: 900,
            color: '#fff',
            letterSpacing: '0.1rem',
            fontSize: '0.9rem'
          }}>
            {title.toUpperCase()}
          </Typography>
        </Stack>
        {!isLoading && (
          <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#fff' } }}>
            <X size={18} />
          </IconButton>
        )}
      </DialogTitle>

      <DialogContent sx={{ p: 3, pt: 4 }}>
        <Typography sx={{ 
          color: 'rgba(255,255,255,0.7)', 
          fontSize: '0.85rem', 
          lineHeight: 1.6,
          textAlign: 'center'
        }}>
          {message}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 2 }}>
        <Button
          onClick={onClose}
          disabled={isLoading}
          sx={{
            flex: 1,
            color: 'rgba(255,255,255,0.5)',
            fontFamily: 'Orbitron',
            fontWeight: 800,
            fontSize: '0.7rem',
            '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' }
          }}
        >
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isLoading}
          variant="contained"
          sx={{
            flex: 1,
            bgcolor: isDestructive ? '#ff003c' : '#00f3ff',
            color: '#000',
            fontFamily: 'Orbitron',
            fontWeight: 900,
            fontSize: '0.7rem',
            '&:hover': { bgcolor: isDestructive ? '#e60036' : '#00d8e4' }
          }}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

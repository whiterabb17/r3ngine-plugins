import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  CircularProgress,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip
} from '@mui/material';
import { FileText, Plus, Trash2, Upload, X } from 'lucide-react';
import { useCoreWordlists, useUploadWordlist, useDeleteWordlist } from '../api';

export const WordlistManager: React.FC = () => {
  const { data: wordlists, isLoading } = useCoreWordlists();
  const uploadWordlist = useUploadWordlist();
  const deleteWordlist = useDeleteWordlist();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleUpload = async () => {
    if (!file || !name || !shortName) return;
    const formData = new FormData();
    formData.append('wordlist_file', file);
    formData.append('name', name);
    formData.append('short_name', shortName);
    
    try {
      await uploadWordlist.mutateAsync(formData);
      setOpen(false);
      setName('');
      setShortName('');
      setFile(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this wordlist?")) {
      try {
        await deleteWordlist.mutateAsync({ id });
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontFamily: 'Orbitron', fontWeight: 900, color: '#fff' }}>
          Wordlist Custonization
        </Typography>
        <Button
          variant="contained"
          onClick={() => setOpen(true)}
          startIcon={<Plus size={16} />}
          sx={{
            bgcolor: 'rgba(0, 243, 255, 0.15)',
            color: '#00f3ff',
            border: '1px solid rgba(0, 243, 255, 0.3)',
            fontFamily: 'Orbitron',
            fontWeight: 900,
            fontSize: '0.75rem',
            '&:hover': { bgcolor: 'rgba(0, 243, 255, 0.25)', borderColor: '#00f3ff' }
          }}
        >
          UPLOAD WORDLIST
        </Button>
      </Box>

      <Card sx={{
        background: 'linear-gradient(135deg, rgba(20, 15, 30, 0.7) 0%, rgba(10, 10, 15, 0.9) 100%)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '16px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
      }}>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                {['Wordlist Name', 'Short Identifier', 'Total Items', 'Actions'].map((head) => (
                  <TableCell key={head} sx={{ bgcolor: 'transparent', color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron', fontWeight: 800, fontSize: '0.65rem', borderBottom: '1px solid rgba(255,255,255,0.05)', textTransform: 'uppercase' }}>
                    {head}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} align="center"><CircularProgress sx={{ color: '#00f3ff' }} /></TableCell></TableRow>
              ) : wordlists?.map((wl: any) => (
                <TableRow key={wl.id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                  <TableCell sx={{ color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <FileText size={16} color="#00f3ff" />
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{wl.name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(255,255,255,0.02)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {wl.short_name}
                  </TableCell>
                  <TableCell sx={{ color: '#00ff62', borderBottom: '1px solid rgba(255,255,255,0.02)', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 700 }}>
                    {wl.count}
                  </TableCell>
                  <TableCell sx={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <Tooltip title="Delete Wordlist">
                      <IconButton onClick={() => handleDelete(wl.id)} size="small" sx={{ color: '#ff0055', '&:hover': { bgcolor: 'rgba(255, 0, 85, 0.1)' } }}>
                        <Trash2 size={16} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && (!wordlists || wordlists.length === 0) && (
                <TableRow><TableCell colSpan={4} align="center" sx={{ color: 'rgba(255,255,255,0.4)', py: 6 }}>No custom wordlists found. Click upload to register one.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Upload Dialog */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, rgba(20, 15, 30, 0.97) 0%, rgba(10, 10, 15, 0.99) 100%)',
            border: '1px solid rgba(0, 243, 255, 0.15)',
            borderRadius: '18px',
            boxShadow: '0 0 60px rgba(0, 243, 255, 0.08)'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ color: '#fff', fontSize: '1rem', fontWeight: 900, fontFamily: 'Orbitron', letterSpacing: 0.5 }}>
            UPLOAD WORDLIST
          </Typography>
          <IconButton onClick={() => setOpen(false)} size="small" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            <X size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          <TextField
            fullWidth label="Wordlist Name" size="small"
            value={name} onChange={(e) => setName(e.target.value)}
            sx={textFieldStyles}
          />
          <TextField
            fullWidth label="Short Identifier (Slug)" size="small"
            placeholder="my_wordlist"
            value={shortName} onChange={(e) => setShortName(e.target.value)}
            sx={textFieldStyles}
          />
          <Button
            component="label"
            variant="outlined"
            startIcon={<Upload size={16} />}
            sx={{
              color: '#00f3ff',
              borderColor: 'rgba(0, 243, 255, 0.3)',
              fontFamily: 'Orbitron',
              fontSize: '0.75rem',
              fontWeight: 800,
              py: 1.5,
              '&:hover': { borderColor: '#00f3ff', bgcolor: 'rgba(0,243,255,0.05)' }
            }}
          >
            {file ? file.name : "SELECT TXT FILE"}
            <input type="file" accept=".txt" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </Button>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <Button onClick={() => setOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Orbitron', fontWeight: 800 }}>
            CANCEL
          </Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!file || !name || !shortName || uploadWordlist.isPending}
            sx={{
              bgcolor: 'rgba(0, 243, 255, 0.15)',
              color: '#00f3ff',
              border: '1px solid rgba(0, 243, 255, 0.3)',
              fontFamily: 'Orbitron',
              fontWeight: 900,
              '&:hover': { bgcolor: 'rgba(0, 243, 255, 0.25)', borderColor: '#00f3ff' },
              '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }
            }}
          >
            {uploadWordlist.isPending ? 'UPLOADING...' : 'UPLOAD'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const textFieldStyles = {
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    bgcolor: 'rgba(0,0,0,0.3)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
    '&:hover fieldset': { borderColor: 'rgba(0, 243, 255, 0.3)' },
    '&.Mui-focused fieldset': { borderColor: '#00f3ff' },
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '0.8rem',
    '&.Mui-focused': { color: '#00f3ff' }
  }
};

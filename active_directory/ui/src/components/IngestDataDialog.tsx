import React, { useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Select, MenuItem, FormControl, InputLabel,
  Typography, Box, LinearProgress
} from '@mui/material';
import { useIngestData } from '../api/adApi';

interface Props {
  open: boolean;
  assessmentId: number;
  onClose: () => void;
}

export function IngestDataDialog({ open, assessmentId, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [ingestType, setIngestType] = useState('auto');
  const [fileName, setFileName] = useState('');
  const { mutate: ingest, isPending } = useIngestData();

  const handleFileChange = () => {
    const file = fileRef.current?.files?.[0];
    setFileName(file?.name ?? '');
  };

  const handleSubmit = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    ingest({ assessmentId, file, type: ingestType }, {
      onSuccess: () => {
        setFileName('');
        setIngestType('auto');
        if (fileRef.current) fileRef.current.value = '';
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontFamily: 'Orbitron' }}>Ingest AD Data</DialogTitle>
      <DialogContent>
        {isPending && <LinearProgress sx={{ mb: 2 }} />}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Data Type</InputLabel>
            <Select value={ingestType} onChange={(e) => setIngestType(e.target.value)} label="Data Type">
              <MenuItem value="auto">Auto-detect</MenuItem>
              <MenuItem value="ldap">LDAP (ldapdomaindump)</MenuItem>
              <MenuItem value="bloodhound">BloodHound JSON</MenuItem>
            </Select>
          </FormControl>
          <Button variant="outlined" component="label">
            Choose File
            <input type="file" hidden ref={fileRef} accept=".json,.zip" onChange={handleFileChange} />
          </Button>
          {fileName && <Typography variant="caption" color="text.secondary">{fileName}</Typography>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isPending || !fileName}>
          {isPending ? 'Ingesting…' : 'Ingest'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box
} from '@mui/material';
import { useCreateAssessment } from '../api/adApi';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateAssessmentDialog({ open, onClose }: Props) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const { mutate: create, isPending } = useCreateAssessment();

  const handleSubmit = () => {
    if (!name.trim() || !domain.trim()) return;
    create({ name: name.trim(), target_domain: domain.trim() }, {
      onSuccess: () => {
        setName('');
        setDomain('');
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontFamily: 'Orbitron' }}>New AD Assessment</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Assessment Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label="Target Domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            fullWidth
            required
            placeholder="corp.example.com"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isPending || !name || !domain}>
          {isPending ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

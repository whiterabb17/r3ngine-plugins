import { useState } from 'react';
import {
  Box, Typography, Button, Table, TableHead, TableBody,
  TableRow, TableCell, IconButton, Tooltip, CircularProgress
} from '@mui/material';
import { Plus, Play, Eye } from 'lucide-react';
import { useAssessments, useStartAssessment } from '../api/adApi';
import { AssessmentStatusBadge } from '../components/AssessmentStatusBadge';
import { CreateAssessmentDialog } from '../components/CreateAssessmentDialog';

interface Props {
  onNavigate?: (path: string) => void;
}

export function ADAssessmentsPage({ onNavigate }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: assessments, isLoading, error } = useAssessments();
  const { mutate: start } = useStartAssessment();

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;
  if (error) return <Typography color="error">Failed to load assessments</Typography>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontFamily: 'Orbitron', letterSpacing: 2 }}>
          AD INTELLIGENCE
        </Typography>
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          onClick={() => setCreateOpen(true)}
        >
          New Assessment
        </Button>
      </Box>

      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>NAME</TableCell>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>TARGET DOMAIN</TableCell>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>STATUS</TableCell>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>CREATED</TableCell>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>ACTIONS</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(assessments ?? []).map((a) => (
            <TableRow key={a.id} hover>
              <TableCell>{a.name}</TableCell>
              <TableCell sx={{ fontFamily: 'monospace' }}>{a.target_domain}</TableCell>
              <TableCell><AssessmentStatusBadge status={a.status} /></TableCell>
              <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                {new Date(a.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {(a.status === 'PENDING' || a.status === 'FAILED') && (
                    <Tooltip title="Start assessment">
                      <IconButton size="small" onClick={() => start(a.id)} color="primary">
                        <Play size={16} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="View details">
                    <IconButton size="small" onClick={() => onNavigate?.(`assessment/${a.id}`)}>
                      <Eye size={16} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CreateAssessmentDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </Box>
  );
}

import React from 'react';
import {
  Box, Typography, Table, TableHead, TableBody,
  TableRow, TableCell, Chip, CircularProgress, Alert
} from '@mui/material';
import { useTrusts } from '../api/adApi';

interface Props {
  assessmentId: number;
}

export function ADTrustAnalyticsPage({ assessmentId }: Props) {
  const { data: trusts, isLoading, error } = useTrusts(assessmentId);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">Failed to load trust data</Alert>;
  const trustList = trusts?.results ?? [];

  if (!trustList.length) return (
    <Box>
      <Typography variant="h6" sx={{ fontFamily: 'Orbitron', mb: 2 }}>TRUST ANALYTICS</Typography>
      <Alert severity="info">No trust relationships found. Run an assessment to discover domain trusts.</Alert>
    </Box>
  );

  return (
    <Box>
      <Typography variant="h6" sx={{ fontFamily: 'Orbitron', mb: 2 }}>TRUST ANALYTICS</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>SOURCE DOMAIN</TableCell>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>TARGET DOMAIN</TableCell>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>TYPE</TableCell>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>DIRECTION</TableCell>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>TRANSITIVE</TableCell>
            <TableCell sx={{ fontFamily: 'Orbitron', fontSize: '0.7rem' }}>SID FILTERING</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {trustList.map((t) => (
            <TableRow key={t.id} hover>
              <TableCell sx={{ fontFamily: 'monospace' }}>{t.source_domain_fqdn}</TableCell>
              <TableCell sx={{ fontFamily: 'monospace' }}>{t.target_domain_name}</TableCell>
              <TableCell><Chip label={t.trust_type} size="small" /></TableCell>
              <TableCell>{t.direction}</TableCell>
              <TableCell>
                <Chip label={t.is_transitive ? 'YES' : 'NO'} color={t.is_transitive ? 'warning' : 'default'} size="small" />
              </TableCell>
              <TableCell>
                <Chip label={t.is_selective_auth ? 'ON' : 'OFF'} color={t.is_selective_auth ? 'success' : 'error'} size="small" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

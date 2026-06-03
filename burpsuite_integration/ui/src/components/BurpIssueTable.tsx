import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  Typography,
  TextField,
  FormControlLabel,
  Checkbox,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Pagination,
  IconButton,
  Tooltip,
  Drawer,
  Divider,
  CircularProgress,
  Alert
} from '@mui/material';
import { 
  Search, 
  Filter, 
  Link as LinkIcon, 
  Eye, 
  HelpCircle, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { useBurpIssues, BurpIssue } from '../api/burpApi';
import ManualMatchDialog from './ManualMatchDialog';

const SEVERITY_COLORS = ['#30a14e', '#2196f3', '#ffeb3b', '#ff9800', '#ff003c'];
const SEVERITY_LABELS = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const BurpIssueTable: React.FC = () => {
  // Filter States
  const [page, setPage] = useState(1);
  const [unmatchedOnly, setUnmatchedOnly] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); // Committed search query

  // Detail Drawer State
  const [detailIssue, setDetailIssue] = useState<BurpIssue | null>(null);

  // Manual Match Dialog State
  const [matchIssue, setMatchIssue] = useState<BurpIssue | null>(null);

  // Fetch issues
  const { data, isLoading, isError, error, refetch } = useBurpIssues({
    page,
    unmatched: unmatchedOnly,
    severity: selectedSeverity ?? undefined,
    q: searchQuery || undefined,
  });

  const issues = data?.results ?? [];

  // Debounced/Triggered search handler
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setSearchQuery(searchText);
      setPage(1);
    }
  };

  const handleSearchClick = () => {
    setSearchQuery(searchText);
    setPage(1);
  };

  const handleSeverityFilter = (sev: number | null) => {
    setSelectedSeverity(sev);
    setPage(1);
  };

  const handleUnmatchedToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUnmatchedOnly(e.target.checked);
    setPage(1);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      
      {/* Search and Filters Bar */}
      <Card
        sx={{
          bgcolor: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '12px',
          p: 2,
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} alignItems="center" justifyContent="space-between">
          
          {/* Search box */}
          <TextField
            placeholder="Search issue or host... (Press Enter)"
            size="small"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={handleSearchKeyPress}
            InputProps={{
              startAdornment: <Search size={14} style={{ marginRight: 8, color: 'rgba(255,255,255,0.3)' }} />,
              endAdornment: (
                <Button size="small" onClick={handleSearchClick} sx={{ color: '#FF6633', fontSize: '0.65rem', fontFamily: 'Orbitron', fontWeight: 900 }}>
                  GO
                </Button>
              ),
            }}
            sx={{
              width: { xs: '100%', md: '300px' },
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                fontSize: '0.8rem',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: 'rgba(255,102,51,0.3)' },
                '&.Mui-focused fieldset': { borderColor: '#FF6633' },
              },
            }}
          />

          {/* Severity Quick Filters */}
          <Stack direction="row" spacing={1} overflow="auto" sx={{ width: { xs: '100%', md: 'auto' } }}>
            <Chip
              label="ALL"
              size="small"
              onClick={() => handleSeverityFilter(null)}
              variant={selectedSeverity === null ? 'filled' : 'outlined'}
              sx={{
                fontFamily: 'Orbitron',
                fontSize: '0.6rem',
                fontWeight: 900,
                borderColor: 'rgba(255,255,255,0.15)',
                color: selectedSeverity === null ? '#000' : '#fff',
                bgcolor: selectedSeverity === null ? '#fff' : 'transparent',
                '&:hover': { bgcolor: selectedSeverity === null ? '#fff' : 'rgba(255,255,255,0.05)' },
              }}
            />
            {SEVERITY_LABELS.map((label, idx) => (
              <Chip
                key={label}
                label={label}
                size="small"
                onClick={() => handleSeverityFilter(idx)}
                variant={selectedSeverity === idx ? 'filled' : 'outlined'}
                sx={{
                  fontFamily: 'Orbitron',
                  fontSize: '0.6rem',
                  fontWeight: 900,
                  borderColor: `${SEVERITY_COLORS[idx]}55`,
                  color: selectedSeverity === idx ? '#000' : SEVERITY_COLORS[idx],
                  bgcolor: selectedSeverity === idx ? SEVERITY_COLORS[idx] : 'transparent',
                  '&:hover': { 
                    bgcolor: selectedSeverity === idx ? SEVERITY_COLORS[idx] : `${SEVERITY_COLORS[idx]}11`,
                    borderColor: SEVERITY_COLORS[idx]
                  },
                }}
              />
            ))}
          </Stack>

          {/* Unmatched toggle */}
          <FormControlLabel
            control={
              <Checkbox
                checked={unmatchedOnly}
                onChange={handleUnmatchedToggle}
                sx={{
                  color: 'rgba(255,255,255,0.2)',
                  '&.Mui-checked': { color: '#FF6633' },
                }}
              />
            }
            label={
              <Typography sx={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Orbitron', letterSpacing: 0.5 }}>
                UNMATCHED ONLY
              </Typography>
            }
          />

        </Stack>
      </Card>

      {/* Main Table */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <CircularProgress size={30} sx={{ color: '#FF6633' }} />
        </Box>
      ) : isError ? (
        <Alert severity="error" sx={{ bgcolor: 'rgba(255,0,60,0.1)', color: '#ff003c', border: '1px solid rgba(255,0,60,0.2)' }}>
          Failed to load Burp issues: {error.message}
        </Alert>
      ) : (
        <TableContainer
          component={Paper}
          sx={{
            bgcolor: 'transparent',
            boxShadow: 'none',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <Table size="small">
            <TableHead sx={{ bgcolor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <TableRow>
                <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.65rem', fontFamily: 'Orbitron', py: 1.5 }}>SEVERITY</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.65rem', fontFamily: 'Orbitron', py: 1.5 }}>VULNERABILITY NAME</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.65rem', fontFamily: 'Orbitron', py: 1.5 }}>HOST</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.65rem', fontFamily: 'Orbitron', py: 1.5 }}>PATH</TableCell>
                <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.65rem', fontFamily: 'Orbitron', py: 1.5 }}>CORRELATION</TableCell>
                <TableCell align="right" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: '0.65rem', fontFamily: 'Orbitron', py: 1.5 }}>ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {issues.length > 0 ? (
                issues.map((issue) => {
                  const severityColor = SEVERITY_COLORS[issue.severity] ?? '#fff';
                  const severityLabel = SEVERITY_LABELS[issue.severity] ?? 'INFO';
                  const isMatched = issue.linked_vulnerability_id !== null;

                  return (
                    <TableRow
                      key={issue.id}
                      sx={{
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.01)' },
                      }}
                    >
                      {/* Severity Chip */}
                      <TableCell sx={{ py: 1 }}>
                        <Chip
                          label={severityLabel}
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: '0.52rem',
                            fontWeight: 900,
                            fontFamily: 'Orbitron',
                            bgcolor: `${severityColor}18`,
                            color: severityColor,
                            border: `1px solid ${severityColor}44`,
                            borderRadius: '4px',
                          }}
                        />
                      </TableCell>
                      
                      {/* Vulnerability Name */}
                      <TableCell sx={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Tooltip title={issue.name} arrow>
                          <span>{issue.name}</span>
                        </Tooltip>
                      </TableCell>

                      {/* Host */}
                      <TableCell sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.72rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {issue.host}
                      </TableCell>

                      {/* Path */}
                      <TableCell sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', fontFamily: 'monospace', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {issue.path || '/'}
                      </TableCell>

                      {/* Correlation Badge */}
                      <TableCell>
                        {isMatched ? (
                          <Chip
                            icon={<CheckCircle size={10} color="#00ff62" />}
                            label="CORRELATED"
                            size="small"
                            sx={{
                              height: 16,
                              fontSize: '0.52rem',
                              fontWeight: 900,
                              fontFamily: 'Orbitron',
                              bgcolor: 'rgba(0,255,98,0.1)',
                              color: '#00ff62',
                              border: '1px solid rgba(0,255,98,0.2)',
                              '& .MuiChip-icon': { color: 'inherit' },
                            }}
                          />
                        ) : (
                          <Chip
                            icon={<AlertTriangle size={10} color="#ff9800" />}
                            label="UNMATCHED"
                            size="small"
                            sx={{
                              height: 16,
                              fontSize: '0.52rem',
                              fontWeight: 900,
                              fontFamily: 'Orbitron',
                              bgcolor: 'rgba(255,152,0,0.1)',
                              color: '#ff9800',
                              border: '1px solid rgba(255,152,0,0.2)',
                              '& .MuiChip-icon': { color: 'inherit' },
                            }}
                          />
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell align="right" sx={{ py: 0.5 }}>
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="View details">
                            <IconButton size="small" onClick={() => setDetailIssue(issue)} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}>
                              <Eye size={14} />
                            </IconButton>
                          </Tooltip>
                          
                          {!isMatched && (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => setMatchIssue(issue)}
                              startIcon={<LinkIcon size={10} />}
                              sx={{
                                fontFamily: 'Orbitron',
                                fontSize: '0.55rem',
                                fontWeight: 900,
                                height: 22,
                                px: 1,
                                borderColor: 'rgba(255, 102, 51, 0.3)',
                                color: '#FF6633',
                                '&:hover': { borderColor: '#FF6633', bgcolor: 'rgba(255, 102, 51, 0.08)' },
                              }}
                            >
                              MATCH
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8, color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', fontFamily: 'Orbitron' }}>
                    NO SCAN ISSUES IMPORTED YET
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Table Pagination */}
      {data && data.count > 10 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination
            count={Math.ceil(data.count / 10)}
            page={page}
            onChange={(_, p) => setPage(p)}
            sx={{
              '& .MuiPaginationItem-root': {
                color: 'rgba(255, 102, 51, 0.6)',
                borderColor: 'rgba(255, 102, 51, 0.2)',
                '&.Mui-selected': {
                  bgcolor: 'rgba(255, 102, 51, 0.2)',
                  color: '#FF6633',
                  borderColor: '#FF6633',
                },
                '&:hover': {
                  bgcolor: 'rgba(255, 102, 51, 0.1)',
                },
              },
            }}
          />
        </Box>
      )}

      {/* Manual Match dialog */}
      <ManualMatchDialog
        open={matchIssue !== null}
        onClose={() => setMatchIssue(null)}
        issue={matchIssue}
        onSuccess={() => {
          refetch();
          // Also refetch metrics if needed, but simple list refetch is fine
        }}
      />

      {/* Issue details slide drawer */}
      <Drawer
        anchor="right"
        open={detailIssue !== null}
        onClose={() => setDetailIssue(null)}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: '480px' },
            background: 'linear-gradient(135deg, rgba(20, 15, 30, 0.98) 0%, rgba(10, 10, 15, 0.99) 100%)',
            borderLeft: '1px solid rgba(255, 102, 51, 0.15)',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
            color: '#fff',
          },
        }}
      >
        {detailIssue && (
          <>
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', display: 'block', mb: 1 }}>
                BURP ISSUE SERIAL: {detailIssue.burp_serial_number}
              </Typography>
              <Typography variant="h6" sx={{ fontFamily: 'Orbitron', fontWeight: 900, fontSize: '1.05rem', lineHeight: 1.3, mb: 1.5 }}>
                {detailIssue.name}
              </Typography>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Chip
                  label={SEVERITY_LABELS[detailIssue.severity]}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.55rem',
                    fontWeight: 900,
                    fontFamily: 'Orbitron',
                    bgcolor: `${SEVERITY_COLORS[detailIssue.severity]}18`,
                    color: SEVERITY_COLORS[detailIssue.severity],
                    border: `1px solid ${SEVERITY_COLORS[detailIssue.severity]}44`,
                  }}
                />
                <Chip
                  label={`CONFIDENCE: ${detailIssue.confidence.toUpperCase()}`}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.55rem',
                    fontWeight: 900,
                    fontFamily: 'Orbitron',
                    bgcolor: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.7)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                />
              </Stack>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

            {/* Target Location */}
            <Box>
              <Typography sx={{ fontSize: '0.65rem', color: '#FF6633', fontWeight: 900, fontFamily: 'Orbitron', mb: 1, letterSpacing: 0.5 }}>
                TARGET LOCATION
              </Typography>
              <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                <Typography sx={{ fontSize: '0.72rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                  <strong>URL:</strong> {detailIssue.full_url}
                </Typography>
              </Box>
            </Box>

            {/* Description / Detail */}
            {detailIssue.issue_detail && (
              <Box>
                <Typography sx={{ fontSize: '0.65rem', color: '#FF6633', fontWeight: 900, fontFamily: 'Orbitron', mb: 1, letterSpacing: 0.5 }}>
                  ISSUE DETAIL
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: detailIssue.issue_detail }} />
              </Box>
            )}

            {/* Background */}
            {detailIssue.issue_background && (
              <Box>
                <Typography sx={{ fontSize: '0.65rem', color: '#FF6633', fontWeight: 900, fontFamily: 'Orbitron', mb: 1, letterSpacing: 0.5 }}>
                  ISSUE BACKGROUND
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: detailIssue.issue_background }} />
              </Box>
            )}

            {/* Remediation */}
            {detailIssue.remediation_detail && (
              <Box>
                <Typography sx={{ fontSize: '0.65rem', color: '#00ff62', fontWeight: 900, fontFamily: 'Orbitron', mb: 1, letterSpacing: 0.5 }}>
                  REMEDIATION
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: detailIssue.remediation_detail }} />
              </Box>
            )}

            {/* Link references */}
            {detailIssue.linked_vulnerability_id && (
              <Box sx={{ p: 1.5, bgcolor: 'rgba(0,255,98,0.05)', borderRadius: '6px', border: '1px solid rgba(0,255,98,0.15)', display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircle size={14} color="#00ff62" />
                <Box>
                  <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontWeight: 800 }}>LINKED VULNERABILITY</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#00ff62', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Vulnerability #{detailIssue.linked_vulnerability_id}
                  </Typography>
                </Box>
              </Box>
            )}

            <Button
              variant="outlined"
              onClick={() => setDetailIssue(null)}
              sx={{
                mt: 'auto',
                borderColor: 'rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.7)',
                fontFamily: 'Orbitron',
                fontSize: '0.7rem',
                fontWeight: 900,
                '&:hover': { borderColor: '#fff', color: '#fff', bgcolor: 'rgba(255,255,255,0.02)' },
              }}
            >
              CLOSE DETAILS
            </Button>
          </>
        )}
      </Drawer>

    </Box>
  );
};

export default BurpIssueTable;

import React from 'react';
import {
  Box, ToggleButton, ToggleButtonGroup,
  TextField, IconButton, Tooltip, InputAdornment,
} from '@mui/material';
import { Maximize2, Target, Download, Search, X } from 'lucide-react';
import type { LayoutName } from '../types';

const LAYOUTS: LayoutName[] = ['dagre', 'fcose', 'circle', 'concentric', 'grid'];

interface Props {
  layout: LayoutName;
  onLayoutChange: (l: LayoutName) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  focusMode: boolean;
  onFocusModeToggle: () => void;
  onFitGraph: () => void;
  onExportPng: () => void;
}

export function GraphToolbar({
  layout, onLayoutChange,
  searchQuery, onSearchChange,
  focusMode, onFocusModeToggle,
  onFitGraph, onExportPng,
}: Props) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={layout}
        onChange={(_e, v) => { if (v) onLayoutChange(v as LayoutName); }}
      >
        {LAYOUTS.map((l) => (
          <ToggleButton
            key={l}
            value={l}
            sx={{ fontSize: '0.6rem', py: 0.5, px: 1, textTransform: 'uppercase', fontFamily: 'Orbitron', letterSpacing: 0.5 }}
          >
            {l}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <TextField
        size="small"
        placeholder="Search nodes…"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{ width: 180, '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search size={14} color="rgba(255,255,255,0.4)" />
            </InputAdornment>
          ),
          endAdornment: searchQuery ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => onSearchChange('')} edge="end">
                <X size={12} />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
      />

      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Tooltip title="Fit graph to viewport">
          <IconButton size="small" onClick={onFitGraph}>
            <Maximize2 size={16} />
          </IconButton>
        </Tooltip>
        <Tooltip title={focusMode ? 'Disable focus mode' : 'Focus mode: highlight neighbors of selected node'}>
          <IconButton size="small" onClick={onFocusModeToggle} color={focusMode ? 'primary' : 'default'}>
            <Target size={16} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Export graph as PNG">
          <IconButton size="small" onClick={onExportPng}>
            <Download size={16} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

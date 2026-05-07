import React from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import clsx from 'clsx';

interface TacticalPanelProps {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  borderColor?: string;
  sx?: any;
  headerAction?: React.ReactNode;
}

export const TacticalPanel: React.FC<TacticalPanelProps> = ({ 
  title, 
  icon, 
  children, 
  className,
  borderColor = '#00f0ff',
  sx = {},
  headerAction
}) => {
  return (
    <Card 
      className={clsx("relative overflow-hidden group transition-all duration-500", className)}
      sx={{ 
        background: 'linear-gradient(135deg, rgba(20, 15, 30, 0.7) 0%, rgba(10, 10, 15, 0.9) 100%)',
        backdropFilter: 'blur(25px) saturate(180%)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '18px',
        position: 'relative',
        boxShadow: 'inset 0 0 30px rgba(0, 0, 0, 0.5), 0 15px 35px rgba(0, 0, 0, 0.8)',
        '&:hover': {
          transform: 'translateY(-6px) scale(1.005)',
          borderColor: 'rgba(0, 240, 255, 0.4)',
          boxShadow: `0 0 10px rgba(0, 240, 255, 0.6), 0 0 20px rgba(0, 240, 255, 0.3)`
        },
        ...sx,
        /* Dual Gradient Glow */
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          background: 'radial-gradient(circle at 20% 20%, rgba(255, 43, 214, 0.15), transparent 50%), radial-gradient(circle at 80% 80%, rgba(0, 240, 255, 0.1), transparent 50%)',
          opacity: 0.6,
          pointerEvents: 'none',
          zIndex: 0
        },
        /* Light Sweep Effect on Hover */
        '&::after': {
          content: '""',
          position: 'absolute',
          top: '-50%',
          left: '-150%',
          width: '200%',
          height: '200%',
          background: 'linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.05), transparent)',
          transform: 'rotate(45deg)',
          transition: '0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: 1
        },
        '&:hover::after': {
          left: '120%',
          opacity: 1
        }
      }}
    >
      <CardContent sx={{ position: 'relative', zIndex: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {icon && <Box sx={{ mr: 1.5, display: 'flex', filter: 'drop-shadow(0 0 5px rgba(0, 240, 255, 0.5))' }}>{icon}</Box>}
              <Typography variant="h6" sx={{ 
                fontSize: '0.75rem', 
                fontWeight: 800, 
                textTransform: 'uppercase', 
                letterSpacing: 2.5,
                fontFamily: 'Orbitron',
                color: '#8ba4c0',
                textShadow: '0 0 10px rgba(255, 43, 214, 0.4)'
              }}>
                {title}
              </Typography>
            </Box>
            {headerAction && <Box>{headerAction}</Box>}
          </Box>
        {children}
      </CardContent>
    </Card>
  );
};


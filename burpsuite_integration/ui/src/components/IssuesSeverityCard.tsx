import React from 'react';
import { Box, Card, CardContent, Grid, Typography } from '@mui/material';
import { 
  ShieldAlert, 
  AlertOctagon, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  HelpCircle 
} from 'lucide-react';
import { BurpMetrics } from '../api/burpApi';

interface IssuesSeverityCardsProps {
  metrics?: BurpMetrics;
  loading: boolean;
}

export const IssuesSeverityCards: React.FC<IssuesSeverityCardsProps> = ({ metrics, loading }) => {
  const data = metrics ?? {
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    unmatched: 0,
  };

  const cards = [
    {
      title: 'Total Issues',
      value: data.total,
      subtitle: 'All imported scan findings',
      icon: <ShieldAlert size={20} color="#FF6633" />,
      color: '#FF6633',
    },
    {
      title: 'Critical',
      value: data.critical,
      subtitle: 'Immediate action required',
      icon: <AlertOctagon size={20} color="#ff003c" />,
      color: '#ff003c',
    },
    {
      title: 'High',
      value: data.high,
      subtitle: 'Serious security vulnerabilities',
      icon: <AlertTriangle size={20} color="#ff9800" />,
      color: '#ff9800',
    },
    {
      title: 'Medium',
      value: data.medium,
      subtitle: 'Moderate impact bugs',
      icon: <AlertCircle size={20} color="#ffeb3b" />,
      color: '#ffeb3b',
    },
    {
      title: 'Unmatched',
      value: data.unmatched,
      subtitle: 'Pending manual link to subdomains',
      icon: <HelpCircle size={20} color="#00f3ff" />,
      color: '#00f3ff',
    },
  ];

  return (
    <Grid container spacing={3}>
      {cards.map((card, idx) => (
        <Grid item xs={12} sm={6} md={2.4} key={idx}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, rgba(20, 15, 30, 0.7) 0%, rgba(10, 10, 15, 0.9) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                borderColor: `${card.color}55`,
                boxShadow: `0 0 20px ${card.color}22`,
                transform: 'translateY(-2px)',
              },
            }}
          >
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    color: 'rgba(255,255,255,0.4)',
                    fontWeight: 800,
                    fontFamily: 'Orbitron',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  {card.title}
                </Typography>
                <Box sx={{ filter: `drop-shadow(0 0 4px ${card.color}aa)`, display: 'flex', alignItems: 'center' }}>
                  {card.icon}
                </Box>
              </Box>
              <Typography
                variant="h4"
                sx={{
                  fontFamily: 'Orbitron',
                  fontWeight: 900,
                  color: '#fff',
                  mb: 0.5,
                  textShadow: `0 0 10px ${card.color}33`,
                }}
              >
                {loading ? '...' : card.value.toLocaleString()}
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500, minHeight: 18 }}>
                {card.subtitle}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default IssuesSeverityCards;

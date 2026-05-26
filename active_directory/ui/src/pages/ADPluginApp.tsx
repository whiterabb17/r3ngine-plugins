import { useState, useEffect } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { ArrowLeft } from 'lucide-react';
import { ADAssessmentsPage } from './ADAssessmentsPage';
import { ADAssessmentDetailPage } from './ADAssessmentDetailPage';
import { ADGraphExplorerPage } from './ADGraphExplorerPage';
import { ADTrustAnalyticsPage } from './ADTrustAnalyticsPage';
import { ADExposureDashboardPage } from './ADExposureDashboardPage';
import { ADReportsPage } from './ADReportsPage';

type Route =
  | { view: 'list' }
  | { view: 'detail'; assessmentId: number }
  | { view: 'graph'; assessmentId: number }
  | { view: 'trusts'; assessmentId: number }
  | { view: 'exposures'; assessmentId: number }
  | { view: 'reports'; assessmentId: number };

function parseSubpath(subpath: string): Route {
  const m = subpath.match(/^assessment\/(\d+)(?:\/(\w+))?/);
  if (m) {
    const assessmentId = parseInt(m[1], 10);
    const view = m[2];
    if (view === 'graph') return { view: 'graph', assessmentId };
    if (view === 'trusts') return { view: 'trusts', assessmentId };
    if (view === 'exposures') return { view: 'exposures', assessmentId };
    if (view === 'reports') return { view: 'reports', assessmentId };
    return { view: 'detail', assessmentId };
  }
  return { view: 'list' };
}

export function ADPluginApp({ subpath = '' }: { subpath?: string }) {
  const [route, setRoute] = useState<Route>(() => parseSubpath(subpath));

  useEffect(() => { setRoute(parseSubpath(subpath)); }, [subpath]);

  const navigate = (path: string) => {
    if (!path) { setRoute({ view: 'list' }); return; }
    if (path.startsWith('assessment/')) { setRoute(parseSubpath(path)); return; }
    if ('assessmentId' in route) {
      const { assessmentId } = route;
      if (path === 'graph') { setRoute({ view: 'graph', assessmentId }); return; }
      if (path === 'trusts') { setRoute({ view: 'trusts', assessmentId }); return; }
      if (path === 'exposures') { setRoute({ view: 'exposures', assessmentId }); return; }
      if (path === 'reports') { setRoute({ view: 'reports', assessmentId }); return; }
    }
  };

  const goBack = () => {
    if (route.view === 'list') return;
    if (route.view === 'detail') { setRoute({ view: 'list' }); return; }
    if ('assessmentId' in route) setRoute({ view: 'detail', assessmentId: route.assessmentId });
  };

  return (
    <Box>
      {route.view !== 'list' && (
        <Box sx={{ mb: 1 }}>
          <Tooltip title="Back">
            <IconButton size="small" onClick={goBack} sx={{ color: 'rgba(255,255,255,0.6)' }}>
              <ArrowLeft size={18} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      {route.view === 'list' && <ADAssessmentsPage onNavigate={navigate} />}
      {route.view === 'detail' && (
        <ADAssessmentDetailPage assessmentId={route.assessmentId} onNavigate={navigate} />
      )}
      {route.view === 'graph' && <ADGraphExplorerPage assessmentId={route.assessmentId} />}
      {route.view === 'trusts' && <ADTrustAnalyticsPage assessmentId={route.assessmentId} />}
      {route.view === 'exposures' && <ADExposureDashboardPage assessmentId={route.assessmentId} />}
      {route.view === 'reports' && <ADReportsPage assessmentId={route.assessmentId} />}
    </Box>
  );
}

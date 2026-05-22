from temporalio import activity, workflow
from datetime import timedelta
import os
import sys
import logging

logger = logging.getLogger(__name__)

@activity.defn
def run_erl_activity(params: dict) -> dict:
    scan_history_id = params.get('scan_history_id')
    if not scan_history_id:
        logger.error("ERL Temporal Plugin: No scan_history_id in context")
        return {"status": "failed", "error": "No scan_history_id provided"}
        
    logger.info(f"ERL Temporal Plugin: Starting validation for scan {scan_history_id}")
    
    # Add current backend dir to sys.path to ensure erl.core.orchestrator is findable
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if backend_dir not in sys.path:
        sys.path.append(backend_dir)
        
    try:
        from erl.core.orchestrator import Orchestrator
        orchestrator = Orchestrator()
        orchestrator.process_scan(scan_history_id)
        logger.info(f"ERL Temporal Plugin: Completed validation for scan {scan_history_id}")
        return {"status": "success", "scan_history_id": scan_history_id}
    except Exception as e:
        logger.error(f"ERL Temporal Plugin: Failed validation: {str(e)}")
        raise e

@workflow.defn
class ERLTemporalWorkflow:
    @workflow.run
    async def run(self, payload: dict) -> dict:
        scan_history_id = payload.get('scan_history_id')
        
        result = await workflow.execute_activity(
            run_erl_activity,
            {"scan_history_id": scan_history_id},
            start_to_close_timeout=timedelta(hours=5)
        )
        
        return result

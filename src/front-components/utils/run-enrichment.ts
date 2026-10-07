import { RestApiClient } from 'twenty-client-sdk/rest';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

type RouteResult = { total?: number; summary?: string; error?: string; results?: { outcome: string; message: string }[] };

// Calls the app's HTTP route with the selected ids and shows the run summary.
// The route runs server-side as the clicking user; the Generect key never reaches the browser.
export const runEnrichment = async (path: string, recordIds: string[]) => {
  if (recordIds.length === 0) {
    await enqueueSnackbar({ message: 'Generect: select at least one record', variant: 'error' });
    return;
  }
  try {
    await enqueueSnackbar({
      message: `Generect: enriching ${recordIds.length} record(s)…`,
      variant: 'info',
    });
    const result = await new RestApiClient().post<RouteResult>(`/s${path}`, { recordIds });
    await enqueueSnackbar({
      message: result?.summary ?? `Generect: processed ${result?.total ?? recordIds.length} record(s)`,
      variant: result?.error ? 'error' : 'success',
      duration: 10000,
      detailedMessage: (result?.results ?? [])
        .slice(0, 10)
        .map((r) => `${r.outcome}: ${r.message}`)
        .join('\n'),
    });
  } catch (error) {
    await enqueueSnackbar({ message: `Generect enrichment failed: ${String((error as Error)?.message ?? error)}`, variant: 'error' });
  }
};

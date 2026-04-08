"use client";

import { PasoJournal } from "@/components/home/PasoJournal";
import { MapView } from "@/components/map/MapView";
import { usePasoJournal } from "@/hooks/usePasoJournal";

export function HomeWorkspace() {
  const journal = usePasoJournal();

  return (
    <>
      <MapView
        pois={journal.pois}
        status={journal.status}
        error={journal.error}
        selectedPoi={journal.selectedPoi}
        recentVisits={journal.recentVisits}
        onSelectPoi={journal.setSelectedPoiId}
      />
      <PasoJournal model={journal} />
    </>
  );
}

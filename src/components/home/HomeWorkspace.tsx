"use client";

import { useCallback, useState } from "react";

import { BottomNav, type TabType } from "@/components/ui/BottomNav";
import { Toast } from "@/components/ui/Toast";
import { MapTab } from "@/components/tabs/MapTab";
import { JournalTab } from "@/components/tabs/JournalTab";
import { ExploreTab } from "@/components/tabs/ExploreTab";
import { ProfileTab } from "@/components/tabs/ProfileTab";
import { usePasoJournal } from "@/hooks/usePasoJournal";

type ToastState = {
  message: string | null;
  type: "success" | "error" | "info";
};

export function HomeWorkspace() {
  const journal = usePasoJournal();
  const [activeTab, setActiveTab] = useState<TabType>("map");
  const [toast, setToast] = useState<ToastState>({ message: null, type: "success" });

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
  }, []);

  const dismissToast = useCallback(() => {
    setToast({ message: null, type: "success" });
  }, []);

  const navigateToJournal = useCallback(() => {
    setActiveTab("journal");
  }, []);

  const showOnMap = useCallback((poiId: string) => {
    journal.setSelectedPoiId(poiId);
    setActiveTab("map");
  }, [journal]);

  if (journal.status === "loading") {
    return (
      <div
        className="flex min-h-dvh items-center justify-center"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        <div className="text-center">
          <div
            className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
            style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }}
          />
          <p className="mt-4 text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            로컬 데이터를 준비하고 있어요
          </p>
        </div>
      </div>
    );
  }

  if (journal.status === "error") {
    return (
      <div
        className="flex min-h-dvh items-center justify-center px-6"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        <div
          className="max-w-sm rounded-2xl border p-6 text-center"
          style={{ borderColor: "var(--error)", backgroundColor: "var(--error-bg)" }}
        >
          <p className="text-3xl">⚠️</p>
          <h2 className="mt-3 font-semibold" style={{ color: "var(--error)" }}>
            데이터베이스 오류
          </h2>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            {journal.error?.message ?? "로컬 데이터를 불러올 수 없어요."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />

      {!journal.canPersist ? (
        <div
          role="alert"
          className="fixed inset-x-3 top-3 z-[60] mx-auto flex max-w-lg items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-xl"
          style={{
            borderColor: "color-mix(in srgb, var(--warning) 45%, var(--border))",
            backgroundColor: "color-mix(in srgb, var(--warning-bg) 94%, transparent)",
          }}
        >
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-black"
            style={{ backgroundColor: "var(--warning)", color: "var(--bg-primary)" }}
          >
            !
          </span>
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              이 기기에는 기록을 안전하게 저장할 수 없어요
            </p>
            <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              현재 임시 메모리 모드입니다. 브라우저 저장소를 허용하거나 앱을 다시 연 뒤 기록해 주세요.
            </p>
          </div>
        </div>
      ) : null}

      <div
        data-testid="app-viewport"
        className="flex h-dvh overflow-hidden flex-col"
        style={{ backgroundColor: "var(--bg-primary)" }}
      >
        {activeTab === "map" && (
          <MapTab
            pois={journal.pois}
            status={journal.status}
            error={journal.error}
            selectedPoi={journal.selectedPoi}
            recentVisits={journal.recentVisits}
            onSelectPoi={journal.setSelectedPoiId}
            onNavigateToJournal={navigateToJournal}
            onToggleSaved={journal.toggleSaved}
            canPersist={journal.canPersist}
          />
        )}
        {activeTab === "journal" && (
          <JournalTab model={journal} onToast={showToast} />
        )}
        {activeTab === "explore" && (
          <ExploreTab
            pois={journal.pois}
            selectedPoiId={journal.selectedPoi?.id ?? null}
            onSelectPoi={journal.setSelectedPoiId}
            onToggleSaved={journal.toggleSaved}
            onUpdateTags={journal.updatePoiTags}
            onShowOnMap={showOnMap}
            onToast={showToast}
            canPersist={journal.canPersist}
          />
        )}
        {activeTab === "profile" && (
          <ProfileTab model={journal} onToast={showToast} />
        )}
      </div>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  );
}

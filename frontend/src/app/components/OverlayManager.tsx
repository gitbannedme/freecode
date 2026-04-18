import React, { useCallback, useEffect } from "react";
import { useChatContext } from "../context/ChatContext";
import OnboardingModal from "./OnboardingModal";
import SettingsPanel from "./SettingsPanel";
import { ModelPicker, DirPicker } from "./Pickers";
import { ConfirmModal } from "./ConfirmModal";
import { getApiKey, saveApiKey } from "../lib/config";
import { BACKEND_URL } from "../lib/constants";

export function OverlayManager() {
  const {
    showOnboarding, setShowOnboarding,
    showSettings, setShowSettings,
    modelPickerOpen, setModelPickerOpen,
    dirPickerOpen, setDirPickerOpen,
    confirmModal, setConfirmModal,
    model, setModel, setMessages,
    handleDirSelect, handleBrowse,
    serverRecents, backendHasKey, wsRef
  } = useChatContext();

  // Initialization logic for onboarding
  useEffect(() => {
    if (!getApiKey()) {
      setShowOnboarding(true);
    }
  }, [setShowOnboarding]);

  const handleOnboardingComplete = useCallback(async (apiKey: string) => {
    saveApiKey(apiKey);
    backendHasKey.current = false;
    setShowOnboarding(false);
    if (wsRef.current) wsRef.current.close();
  }, [backendHasKey, setShowOnboarding, wsRef]);

  return (
    <>
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
        initialApiKey={getApiKey() || ""}
      />

      <SettingsPanel 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />

      {modelPickerOpen && (
        <ModelPicker 
          current={model} 
          onSelect={(id) => { 
            setModel(id); 
            setMessages(p => [...p, { kind: "system", text: `Model switched to ${id}` }]); 
          }} 
          onClose={() => setModelPickerOpen(false)} 
        />
      )}

      {dirPickerOpen && !showOnboarding && (
        <DirPicker 
          onSelect={(dir) => { handleDirSelect(dir); setDirPickerOpen(false); }} 
          onBrowse={handleBrowse} 
          onClose={() => setDirPickerOpen(false)} 
          recents={serverRecents} 
        />
      )}

      <ConfirmModal 
        isOpen={!!confirmModal} 
        title={confirmModal?.title || ""} 
        message={confirmModal?.message || ""} 
        onConfirm={confirmModal?.onConfirm || (() => {})} 
        onCancel={() => setConfirmModal(null)} 
      />
    </>
  );
}

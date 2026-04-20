import { useCallback, useEffect } from "react";
import { useChatContext } from "../context/ChatContext";
import OnboardingModal from "./OnboardingModal";
import { ModelPicker, DirPicker } from "./Pickers";
import { ConfirmModal } from "./ConfirmModal";
import { getApiKey, saveApiKey } from "../lib/config";

export function OverlayManager() {
  const {
    showOnboarding, setShowOnboarding,
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

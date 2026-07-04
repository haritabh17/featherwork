import React, { createContext, useContext, useState, ReactNode } from 'react';

export type MarkerId = 'P1' | 'P2' | 'P3' | 'P4' | 'Shuttle';

export type IconType = 'icon' | 'text' | 'photo';

export type MarkerCustomization = {
  size: number;
  color: string;
  isLeftHanded: boolean;
  icon: string;
  iconType: IconType;
};

export type Customizations = {
  [key in MarkerId]: MarkerCustomization;
};

interface MarkerCustomizationContextType {
  customizations: Customizations;
  updateMarkerCustomization: (markerId: MarkerId, customization: Partial<MarkerCustomization>) => void;
  resetCustomizations: () => void;
  selectedMarker: MarkerId;
  setSelectedMarker: (markerId: MarkerId) => void;
}

const defaultCustomizations: Customizations = {
  P1: { size: 56, color: '#ff7455', isLeftHanded: false, icon: 'account', iconType: 'icon' },
  P2: { size: 56, color: '#ff7455', isLeftHanded: false, icon: 'account', iconType: 'icon' },
  P3: { size: 56, color: '#3e8dff', isLeftHanded: false, icon: 'account', iconType: 'icon' },
  P4: { size: 56, color: '#3e8dff', isLeftHanded: false, icon: 'account', iconType: 'icon' },
  Shuttle: { size: 40, color: '#ffffff', isLeftHanded: false, icon: 'badminton', iconType: 'icon' },
};

const MarkerCustomizationContext = createContext<MarkerCustomizationContextType | undefined>(undefined);

export function MarkerCustomizationProvider({ children }: { children: ReactNode }) {
  const [customizations, setCustomizations] = useState<Customizations>(defaultCustomizations);
  const [selectedMarker, setSelectedMarker] = useState<MarkerId>('P1');

  const updateMarkerCustomization = (markerId: MarkerId, customization: Partial<MarkerCustomization>) => {
    setCustomizations(prev => ({
      ...prev,
      [markerId]: {
        ...prev[markerId],
        ...customization,
      },
    }));
  };

  const resetCustomizations = () => {
    setCustomizations(defaultCustomizations);
  };

  return (
    <MarkerCustomizationContext.Provider
      value={{
        customizations,
        updateMarkerCustomization,
        resetCustomizations,
        selectedMarker,
        setSelectedMarker,
      }}
    >
      {children}
    </MarkerCustomizationContext.Provider>
  );
}

export function useMarkerCustomization() {
  const context = useContext(MarkerCustomizationContext);
  if (!context) {
    throw new Error('useMarkerCustomization must be used within a MarkerCustomizationProvider');
  }
  return context;
}
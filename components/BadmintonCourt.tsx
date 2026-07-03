import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, Alert, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { PlayerMarker } from './PlayerMarker';
import { IconButton } from './IconButton';
import { CourtSvg } from './CourtSvg';
import { useCourtPositions } from '../hooks/useCourtPositions';
import { useStepSets } from '../hooks/useStepSets';
import { PositionTrail } from './PositionTrail';
import { SettingsPanel } from './SettingsPanel';
import { StepSetsPanel } from './StepSetsPanel';
import { useMarkerCustomization } from '../context/MarkerCustomizationContext';
import { createStepSet, decodeSharedStepSet } from '../utils/stepSharing';
import { StepSet } from '../types/drill';
import { palette, radii, shadows, spacing } from '../constants/theme';

const HEADER_CONTENT_HEIGHT = 56;
const DOCK_HEIGHT = 78;

// Module-level so remounts (e.g. via the +not-found redirect) never
// re-import a URL that was already handled in this app session.
const consumedShareUrls = new Set<string>();

export default function BadmintonCourt() {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  const headerTotal = insets.top + HEADER_CONTENT_HEIGHT;
  const dockTotal = DOCK_HEIGHT + Math.max(insets.bottom, spacing.md) + spacing.md;

  const courtWidth = screenWidth - spacing.md * 2;
  const courtHeight = screenHeight - headerTotal - dockTotal - spacing.md * 2;

  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isStepSetsVisible, setIsStepSetsVisible] = useState(false);
  const { customizations, updateMarkerCustomization } = useMarkerCustomization();
  const { stepSets, saveStepSet, deleteStepSet, replaceStepSet, importStepSet } = useStepSets();

  const {
    isDoubles,
    playerPositions,
    shuttlePosition,
    ghostPositions,
    updatePlayerPosition,
    updateShuttlePosition,
    handlePositionChangeComplete,
    toggleGameMode,
    resetPositions,
    undo,
    redo,
    canUndo,
    canRedo,
    showPlayerTrails,
    showShuttleTrail,
    togglePlayerTrails,
    toggleShuttleTrail,
    getStepsSnapshot,
    loadNormalizedSteps,
    stepCount,
  } = useCourtPositions({ width: courtWidth, height: courtHeight });

  const applyImport = useCallback(async (stepSet: StepSet, replaceId?: string) => {
    const saved = replaceId
      ? await replaceStepSet(replaceId, stepSet)
      : await importStepSet(stepSet);
    loadNormalizedSteps(saved.steps, saved.isDoubles);
    Alert.alert('Imported', `"${saved.name}" has been imported and loaded.`);
  }, [importStepSet, loadNormalizedSteps, replaceStepSet]);

  const handleImportStepSet = useCallback(async (stepSet: StepSet) => {
    const existing = stepSets.find((item) => item.name === stepSet.name);

    if (existing) {
      Alert.alert(
        'Drill already exists',
        `A drill named "${stepSet.name}" is already saved. Replace it?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: () => applyImport(stepSet, existing.id),
          },
        ]
      );
      return;
    }

    await applyImport(stepSet);
  }, [applyImport, stepSets]);

  const handleImportStepSetRef = useRef(handleImportStepSet);
  useEffect(() => {
    handleImportStepSetRef.current = handleImportStepSet;
  }, [handleImportStepSet]);

  useEffect(() => {
    const importFromUrl = (url: string | null) => {
      if (!url) return;
      const imported = decodeSharedStepSet(url);
      if (!imported) return;
      handleImportStepSetRef.current(imported);
    };

    Linking.getInitialURL().then((url) => {
      if (!url || consumedShareUrls.has(url)) return;
      consumedShareUrls.add(url);
      importFromUrl(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      consumedShareUrls.add(url);
      importFromUrl(url);
    });

    return () => subscription.remove();
  }, []);

  const handleSaveStepSet = useCallback(async (name: string) => {
    const steps = getStepsSnapshot();
    const stepSet = createStepSet(name, isDoubles, steps, {
      width: courtWidth,
      height: courtHeight,
    });
    await saveStepSet(stepSet);
  }, [courtHeight, courtWidth, getStepsSnapshot, isDoubles, saveStepSet]);

  const handleLoadStepSet = useCallback((stepSet: StepSet) => {
    loadNormalizedSteps(stepSet.steps, stepSet.isDoubles);
  }, [loadNormalizedSteps]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, height: headerTotal }]}>
        <View style={styles.headerLeft}>
          <View style={styles.logoBadge}>
            <MaterialCommunityIcons name="badminton" size={20} color={palette.accent} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Court Simulator</Text>
            <Text style={styles.headerSubtitle}>
              {isDoubles ? 'Doubles' : 'Singles'} · Step {stepCount}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => setIsMenuVisible(true)}
          hitSlop={8}
          style={({ pressed }) => [styles.headerAction, pressed && styles.headerActionPressed]}
        >
          <MaterialCommunityIcons name="tune-variant" size={22} color={palette.textPrimary} />
        </Pressable>
      </View>

      {/* Court */}
      <View style={[styles.courtWrapper, { marginBottom: dockTotal }]}>
        <View style={[styles.courtContainer, { width: courtWidth, height: courtHeight }]}>
          <CourtSvg width={courtWidth} height={courtHeight} />

          {showPlayerTrails && playerPositions.team1.map((pos, index) => (
            ghostPositions?.team1[index] && (
              <PositionTrail
                key={`trail-team1-${index}`}
                currentPosition={pos}
                ghostPosition={ghostPositions.team1[index]!}
                color={customizations[index === 0 ? 'P1' : 'P2'].color}
              />
            )
          ))}
          {showPlayerTrails && playerPositions.team2.map((pos, index) => (
            ghostPositions?.team2[index] && (
              <PositionTrail
                key={`trail-team2-${index}`}
                currentPosition={pos}
                ghostPosition={ghostPositions.team2[index]!}
                color={customizations[index === 0 ? 'P3' : 'P4'].color}
              />
            )
          ))}
          {showShuttleTrail && shuttlePosition && ghostPositions?.shuttle && (
            <PositionTrail
              currentPosition={shuttlePosition}
              ghostPosition={ghostPositions.shuttle}
              color={customizations.Shuttle.color}
            />
          )}

          {playerPositions.team1.map((pos, index) => (
            <PlayerMarker 
              key={`team1-${index}`}
              position={pos}
              color={customizations[index === 0 ? 'P1' : 'P2'].color}
              size={customizations[index === 0 ? 'P1' : 'P2'].size}
              isLeftHanded={customizations[index === 0 ? 'P1' : 'P2'].isLeftHanded}
              icon={customizations[index === 0 ? 'P1' : 'P2'].icon}
              iconType={customizations[index === 0 ? 'P1' : 'P2'].iconType}
              onPositionChange={(newPos) => updatePlayerPosition('team1', index, newPos)}
              onPositionStart={(newPos) => updatePlayerPosition('team1', index, newPos, true)}
              onPositionChangeComplete={handlePositionChangeComplete}
              onColorChange={(color) => updateMarkerCustomization(index === 0 ? 'P1' : 'P2', { color })}
              onSizeChange={(size) => updateMarkerCustomization(index === 0 ? 'P1' : 'P2', { size })}
              onIconChange={(icon) => updateMarkerCustomization(index === 0 ? 'P1' : 'P2', { icon })}
            />
          ))}
          {playerPositions.team2.map((pos, index) => (
            <PlayerMarker 
              key={`team2-${index}`}
              position={pos}
              color={customizations[index === 0 ? 'P3' : 'P4'].color}
              size={customizations[index === 0 ? 'P3' : 'P4'].size}
              isLeftHanded={customizations[index === 0 ? 'P3' : 'P4'].isLeftHanded}
              icon={customizations[index === 0 ? 'P3' : 'P4'].icon}
              iconType={customizations[index === 0 ? 'P3' : 'P4'].iconType}
              onPositionChange={(newPos) => updatePlayerPosition('team2', index, newPos)}
              onPositionStart={(newPos) => updatePlayerPosition('team2', index, newPos, true)}
              onPositionChangeComplete={handlePositionChangeComplete}
              onColorChange={(color) => updateMarkerCustomization(index === 0 ? 'P3' : 'P4', { color })}
              onSizeChange={(size) => updateMarkerCustomization(index === 0 ? 'P3' : 'P4', { size })}
              onIconChange={(icon) => updateMarkerCustomization(index === 0 ? 'P3' : 'P4', { icon })}
            />
          ))}

          <PlayerMarker
            position={shuttlePosition}
            color={customizations.Shuttle.color}
            size={customizations.Shuttle.size}
            icon={customizations.Shuttle.icon}
            iconType={customizations.Shuttle.iconType}
            onPositionChange={updateShuttlePosition}
            onPositionStart={(newPos) => updateShuttlePosition(newPos, true)}
            onPositionChangeComplete={handlePositionChangeComplete}
            onColorChange={(color) => updateMarkerCustomization('Shuttle', { color })}
            onSizeChange={(size) => updateMarkerCustomization('Shuttle', { size })}
            onIconChange={(icon) => updateMarkerCustomization('Shuttle', { icon })}
          />
        </View>
      </View>

      {/* Floating toolbar dock */}
      <View
        style={[
          styles.dock,
          {
            height: DOCK_HEIGHT,
            bottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        <IconButton icon="restart" label="Reset" onPress={resetPositions} />
        <IconButton
          icon={isDoubles ? 'account-group' : 'account'}
          label={isDoubles ? 'Doubles' : 'Singles'}
          onPress={() => toggleGameMode(!isDoubles)}
        />

        <View style={styles.dockDivider} />

        <IconButton icon="undo-variant" label="Undo" onPress={undo} disabled={!canUndo} />
        <IconButton icon="redo-variant" label="Redo" onPress={redo} disabled={!canRedo} />

        <View style={styles.dockDivider} />

        <IconButton
          icon="shoe-print"
          label="Trails"
          onPress={togglePlayerTrails}
          active={showPlayerTrails}
        />
        <IconButton
          icon="badminton"
          label="Shuttle"
          onPress={toggleShuttleTrail}
          active={showShuttleTrail}
        />

        <View style={styles.dockDivider} />

        <IconButton
          icon="playlist-play"
          label="Drills"
          onPress={() => setIsStepSetsVisible(true)}
        />
      </View>

      <SettingsPanel
        isVisible={isMenuVisible}
        onClose={() => setIsMenuVisible(false)}
      />

      <StepSetsPanel
        isVisible={isStepSetsVisible}
        onClose={() => setIsStepSetsVisible(false)}
        stepSets={stepSets}
        currentStepCount={stepCount}
        onSave={handleSaveStepSet}
        onLoad={handleLoadStepSet}
        onDelete={deleteStepSet}
        onImport={handleImportStepSet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: palette.bg,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionPressed: {
    backgroundColor: palette.surfaceRaised,
  },
  courtWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: spacing.md,
  },
  courtContainer: {
    position: 'relative',
    borderRadius: 24,
    ...shadows.floating,
  },
  dock: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: spacing.xs,
    backgroundColor: palette.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.hairline,
    ...shadows.floating,
  },
  dockDivider: {
    width: 1,
    height: 30,
    backgroundColor: palette.hairline,
  },
});

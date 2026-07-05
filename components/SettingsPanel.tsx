import React, { useEffect, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { appAlert } from '../utils/appAlert';
import { AppSlider } from './AppSlider';
import { ProPaywall } from './ProPaywall';
import { MascotHeadView, MascotView } from './mascots';
import {
  CIRCLE_LOOKS,
  COURT_THEMES,
  CourtTheme,
  isMascot,
  LookId,
  MASCOTS,
  mascotMeta,
  SHUTTLE_STYLES,
  ShuttleStyle,
  shuttleStyleById,
} from '../constants/customization';
import { MarkerId, useMarkerCustomization } from '../context/MarkerCustomizationContext';
import { useVaultAccess } from '../hooks/useVaultAccess';
import { getHueFromColor, hueToHex } from '../utils/color';
import { pickMarkerPhoto } from '../utils/pickMarkerPhoto';
import { AmberWord, Chalk, ChalkArrow, TutorialDots, TutorialRing } from './TutorialOverlay';
import {
  markerContentColor,
  markerRingColor,
  palette,
  radii,
  sora,
  spacing,
} from '../constants/theme';

// Hue slider ramp from the design spec
const HUE_RAMP = [
  '#FF4D4D', '#FFC94D', '#8CFF4D', '#4DFFC1', '#4D9BFF', '#A64DFF', '#FF4D4D',
] as const;

type Tab = 'players' | 'shuttle' | 'court';

const PLAYER_IDS: Exclude<MarkerId, 'Shuttle'>[] = ['P1', 'P2', 'P3', 'P4'];
const PLAYER_NUMBER: Record<string, string> = { P1: '1', P2: '2', P3: '3', P4: '4' };

// Speed slider bounds: left end = slow (800ms glide), right end = fast (80ms).
// The slider position is the inverse of the duration: pos = 880 - ms.
const GLIDE_SLOWEST = 800;
const GLIDE_FASTEST = 80;

// ─── Small shared pieces ─────────────────────────────────────────────────

function CheckBadge() {
  return (
    <View style={styles.checkBadge}>
      <MaterialCommunityIcons name="check-bold" size={10} color={palette.onAccent} />
    </View>
  );
}

function LockBadge({ left = false }: { left?: boolean }) {
  return (
    <View style={[styles.lockBadge, left ? styles.badgeLeft : styles.badgeRight]}>
      <MaterialCommunityIcons name="lock" size={9} color={palette.accent} />
    </View>
  );
}

/** Circle-look avatar at any size (icon / jersey text / photo). */
function CircleAvatar({
  size,
  color,
  iconType,
  icon,
  glyphScale = 0.45,
}: {
  size: number;
  color: string;
  iconType: 'icon' | 'text' | 'photo';
  icon: string;
  glyphScale?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: Math.max(2, size * 0.055),
        borderColor: markerRingColor(color),
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {iconType === 'icon' && (
        <MaterialCommunityIcons
          name={icon as any}
          size={size * glyphScale}
          color={markerContentColor(color)}
        />
      )}
      {iconType === 'text' && (
        <Text
          numberOfLines={1}
          style={{
            ...sora('700'),
            fontSize: size * (icon.length > 1 ? 0.3 : 0.42),
            color: markerContentColor(color),
          }}
        >
          {icon}
        </Text>
      )}
      {iconType === 'photo' && (
        <Image source={{ uri: icon }} style={{ width: '100%', height: '100%' }} />
      )}
    </View>
  );
}

/** Miniature themed court used by the Court-tab cards. */
function ThemePreview({ theme }: { theme: CourtTheme }) {
  const lines = { stroke: theme.line, strokeWidth: 1.1, fill: 'none' } as const;
  return (
    <View style={styles.themePreview}>
      <LinearGradient
        colors={[theme.top, theme.bottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg width="100%" height="100%" viewBox="0 0 179 58" preserveAspectRatio="none">
        {theme.deco === 'sun' && (
          <>
            <Circle cx={26} cy={12} r={16} fill="#FFEBC2" opacity={0.3} />
            <Circle cx={26} cy={12} r={9} fill="#FFEBC2" opacity={0.85} />
          </>
        )}
        {theme.deco === 'stripes' && (
          <>
            <Rect x={0} y={0} width={179} height={14.5} fill="#fff" opacity={0.06} />
            <Rect x={0} y={29} width={179} height={14.5} fill="#fff" opacity={0.06} />
          </>
        )}
        {theme.deco === 'planks' &&
          [30, 66, 102, 138, 168].map((x) => (
            <Line key={x} x1={x} y1={0} x2={x} y2={58} stroke="rgba(60,30,5,0.28)" strokeWidth={1.2} />
          ))}
        {theme.deco === 'snow' &&
          [[14, 10, 2], [30, 30, 1.6], [58, 14, 1.4], [150, 20, 2], [165, 42, 1.5], [95, 8, 1.3], [125, 48, 1.8], [48, 44, 1.5]].map(([x, y, r], i) => (
            <Circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={0.7} />
          ))}
        {theme.deco === 'stars' &&
          [[16, 10, 1.1], [158, 14, 1.3], [27, 44, 1], [120, 6, 0.9], [170, 30, 1]].map(([x, y, r], i) => (
            <Circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={0.7} />
          ))}
        {theme.deco === 'speckles' &&
          [[20, 16, 1], [50, 52, 1.2], [150, 10, 1], [166, 34, 1.2], [12, 42, 1.1]].map(([x, y, r], i) => (
            <Circle key={i} cx={x} cy={y} r={r} fill="rgba(120,80,20,0.25)" />
          ))}
        <Rect x={25} y={7} width={129} height={44} {...lines} strokeWidth={1.6} />
        {[32.3, 70.5, 108.5, 146.7].map((x) => (
          <Line key={x} x1={x} y1={7} x2={x} y2={51} {...lines} />
        ))}
        {[10.3, 47.7].map((y) => (
          <Line key={y} x1={25} y1={y} x2={154} y2={y} {...lines} />
        ))}
        <Line x1={25} y1={29} x2={70.5} y2={29} {...lines} />
        <Line x1={108.5} y1={29} x2={154} y2={29} {...lines} />
        <Line
          x1={89.5}
          y1={5}
          x2={89.5}
          y2={53}
          stroke={theme.net}
          strokeWidth={2.2}
          strokeDasharray="1.6 4"
          strokeOpacity={0.95}
        />
      </Svg>
    </View>
  );
}

/** Shuttle chip preview used by the Shuttle-tab tiles (and try-on pieces). */
function ShuttleChip({ style, size }: { style: ShuttleStyle; size: number }) {
  const outline = style.bg === 'transparent';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: style.bg,
        borderWidth: style.ring ? 2 : outline ? 2 : 0,
        borderColor: style.ring ?? 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MaterialCommunityIcons name="badminton" size={size * 0.46} color={style.glyph} />
    </View>
  );
}

// ─── The Customize sheet ─────────────────────────────────────────────────

interface SettingsPanelProps {
  isVisible: boolean;
  onClose: () => void;
  isDoubles: boolean;
  onGameModeChange: (isDoubles: boolean) => void;
  /** Glide duration between steps (ms). */
  stepAnimationMs: number;
  onStepAnimationChange: (ms: number) => void;
  /** Single vault-access instance owned by BadmintonCourt. */
  vault: ReturnType<typeof useVaultAccess>;
  /** A locked court theme was tapped: parent closes the sheet into try-on. */
  onStartThemeTryOn: () => void;
  /** First-run tour finale: chalk + only the Player 1 card and the ⓘ stay live. */
  tutorialDone?: boolean;
  onReplayTutorial?: () => void;
}

export function SettingsPanel({
  isVisible,
  onClose,
  isDoubles,
  onGameModeChange,
  stepAnimationMs,
  onStepAnimationChange,
  vault,
  onStartThemeTryOn,
  tutorialDone = false,
  onReplayTutorial,
}: SettingsPanelProps) {
  const {
    customizations,
    updateMarkerCustomization,
    resetCustomizations,
    selectedMarker,
    setSelectedMarker,
    shuttleStyle: keptShuttleStyle,
    setShuttleStyle,
    setCourtTheme,
    courtTheme,
    previews,
    previewLook,
    previewShuttleStyle,
    previewCourtTheme,
    commitPreviews,
    effectiveLooks,
    effectiveShuttleStyle,
    effectiveCourtTheme,
  } = useMarkerCustomization();

  const isSubscribed = vault.isSubscribed;
  const [tab, setTab] = useState<Tab>('players');
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Tour finale: open on the Players tab with Player 1 as the worked example.
  useEffect(() => {
    if (isVisible && tutorialDone) {
      setTab('players');
      setSelectedMarker('P1');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, tutorialDone]);

  const player: Exclude<MarkerId, 'Shuttle'> =
    selectedMarker === 'Shuttle' ? 'P1' : selectedMarker;
  const custom = customizations[player];
  const playerLook = effectiveLooks[player];

  // Switching mode reseeds the court, so ignore taps on the already-active option.
  const selectMode = (doubles: boolean) => {
    if (doubles !== isDoubles) onGameModeChange(doubles);
  };

  const confirmReset = () => {
    appAlert(
      'Reset all customizations',
      'Restore default looks, colors, sizes, shuttle style and court theme?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: resetCustomizations },
      ]
    );
  };

  const selectLook = (look: LookId) => {
    if (isMascot(look)) {
      if (mascotMeta(look).pro && !isSubscribed) {
        previewLook(player, look); // try it on; keep it only via Pro
        return;
      }
      previewLook(player, null);
      updateMarkerCustomization(player, { look });
      return;
    }
    previewLook(player, null);
    if (look === 'classic') {
      updateMarkerCustomization(player, { look, iconType: 'icon', icon: 'account' });
    } else if (look === 'jersey') {
      updateMarkerCustomization(player, {
        look,
        iconType: 'text',
        icon: custom.look === 'jersey' ? custom.icon : PLAYER_NUMBER[player],
      });
    } else if (look === 'initials') {
      updateMarkerCustomization(player, {
        look,
        iconType: 'text',
        icon: custom.look === 'initials' ? custom.icon : 'AB',
      });
    } else {
      // photo: only becomes the look once a picture was actually chosen
      pickMarkerPhoto((uri) =>
        updateMarkerCustomization(player, { look: 'photo', iconType: 'photo', icon: uri })
      );
    }
  };

  const selectShuttleStyle = (style: ShuttleStyle) => {
    if (style.pro && !isSubscribed) {
      previewShuttleStyle(style.id);
      return;
    }
    previewShuttleStyle(null);
    setShuttleStyle(style.id);
  };

  const selectTheme = (theme: CourtTheme) => {
    if (theme.pro && !isSubscribed) {
      previewCourtTheme(theme.id);
      onStartThemeTryOn();
      return;
    }
    previewCourtTheme(null);
    setCourtTheme(theme.id);
  };

  const previewedShuttle = previews.shuttleStyle
    ? shuttleStyleById(previews.shuttleStyle)
    : null;

  const sheetHeight = tutorialDone
    ? '62%'
    : tab === 'players' ? '86%' : tab === 'shuttle' ? '56%' : '78%';

  // ── Tab content renderers ──────────────────────────────────────────────

  const renderPlayerChip = (id: Exclude<MarkerId, 'Shuttle'>) => {
    const look = effectiveLooks[id];
    const c = customizations[id];
    const active = player === id;
    return (
      <TouchableOpacity
        key={id}
        style={styles.playerChipWrap}
        onPress={() => setSelectedMarker(id)}
      >
        <View style={[styles.playerChipRing, active && styles.playerChipRingActive]}>
          {isMascot(look) ? (
            <View style={styles.playerChipMascot}>
              <MascotHeadView mascot={look} band={c.color} size={34} />
            </View>
          ) : (
            <CircleAvatar size={38} color={c.color} iconType={c.iconType} icon={c.icon} />
          )}
        </View>
        <Text style={[styles.playerChipLabel, active && styles.playerChipLabelActive]}>
          {id}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderConfigCard = () => {
    const title = isMascot(playerLook)
      ? mascotMeta(playerLook).name
      : CIRCLE_LOOKS.find((l) => l.id === playerLook)?.name ?? 'Classic';
    return (
      <View style={styles.configCard}>
        {tutorialDone && <TutorialRing inset={-5} radius={20} rotate="-1deg" />}
        {isMascot(playerLook) ? (
          <MascotView mascot={playerLook} band={custom.color} label={PLAYER_NUMBER[player]} width={26} />
        ) : (
          <CircleAvatar size={40} color={custom.color} iconType={custom.iconType} icon={custom.icon} />
        )}
        <View style={styles.configBody}>
          <View style={styles.configTitleRow}>
            <Text style={styles.configTitle}>
              {title} · Player {PLAYER_NUMBER[player]}
            </Text>
            <Text style={styles.configSubtitle}>
              {isMascot(playerLook) ? 'full-body look' : 'circle look — color & size'}
            </Text>
          </View>
          <View style={styles.configControls}>
            {isMascot(playerLook) ? (
              <>
                <Text style={styles.handLabel}>RACKET HAND</Text>
                <View style={styles.handToggle}>
                  {(['L', 'R'] as const).map((hand) => {
                    const active = hand === (custom.isLeftHanded ? 'L' : 'R');
                    return (
                      <TouchableOpacity
                        key={hand}
                        style={[styles.handOption, active && styles.handOptionActive]}
                        onPress={() =>
                          updateMarkerCustomization(player, { isLeftHanded: hand === 'L' })
                        }
                      >
                        <Text style={[styles.handText, active && styles.handTextActive]}>
                          {hand}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                {(playerLook === 'jersey' || playerLook === 'initials') && (
                  <TextInput
                    style={styles.valueInput}
                    value={custom.icon}
                    onChangeText={(text) =>
                      updateMarkerCustomization(player, { icon: text.slice(0, 3) })
                    }
                    maxLength={3}
                    placeholder={playerLook === 'jersey' ? '7' : 'KM'}
                    placeholderTextColor={palette.textMuted}
                  />
                )}
                <View style={styles.hueSlider}>
                  <AppSlider
                    minimumValue={0}
                    maximumValue={360}
                    value={getHueFromColor(custom.color)}
                    onValueChange={(value) =>
                      updateMarkerCustomization(player, { color: hueToHex(Math.round(value)) })
                    }
                    thumbColor={custom.color}
                    thumbSize={18}
                    track={
                      <LinearGradient
                        colors={HUE_RAMP}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.hueTrack}
                      />
                    }
                  />
                </View>
              </>
            )}
            <MaterialCommunityIcons name="resize" size={14} color={palette.textMuted} />
            <View style={styles.sizeSlider}>
              <AppSlider
                minimumValue={20}
                maximumValue={80}
                value={custom.size}
                onValueChange={(value) =>
                  updateMarkerCustomization(player, { size: Math.round(value) })
                }
                trackColor="rgba(255, 255, 255, 0.16)"
                trackHeight={5}
                filledColor="rgba(255, 201, 77, 0.55)"
                thumbColor={palette.accent}
                thumbSize={16}
              />
            </View>
          </View>
        </View>
      </View>
    );
  };

  const lookTile = (
    look: LookId,
    content: React.ReactNode,
    name: string,
    opts: { pose?: string; locked?: boolean; plusBadge?: boolean } = {}
  ) => {
    const selected = playerLook === look;
    const kept = custom.look === look;
    return (
      <TouchableOpacity
        key={look}
        style={[styles.tile, selected && styles.tileSelected]}
        onPress={() => selectLook(look)}
      >
        {content}
        <Text style={styles.tileName}>{name}</Text>
        {opts.pose != null && <Text style={styles.tilePose}>{opts.pose}</Text>}
        {kept && <CheckBadge />}
        {opts.locked && <LockBadge left />}
        {opts.plusBadge && !selected && (
          <View style={[styles.plusBadge, styles.badgeRight]}>
            <MaterialCommunityIcons name="plus" size={10} color="rgba(255,255,255,0.85)" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderPlayersTab = () => (
    <>
      <View
        style={[styles.playerChips, tutorialDone && styles.tutDimmed]}
        pointerEvents={tutorialDone ? 'none' : 'auto'}
      >
        {PLAYER_IDS.map(renderPlayerChip)}
      </View>
      {renderConfigCard()}

      {!tutorialDone && (
      <>
      <Text style={styles.gridLabel}>INCLUDED</Text>
      <View style={styles.grid3}>
        {lookTile(
          'classic',
          <CircleAvatar size={44} color={custom.color} iconType="icon" icon="account" />,
          'Classic'
        )}
        {lookTile(
          'jersey',
          <CircleAvatar
            size={44}
            color={custom.color}
            iconType="text"
            icon={custom.look === 'jersey' ? custom.icon : PLAYER_NUMBER[player]}
          />,
          'Jersey'
        )}
        {lookTile(
          'initials',
          <CircleAvatar
            size={44}
            color={custom.color}
            iconType="text"
            icon={custom.look === 'initials' ? custom.icon : 'AB'}
          />,
          'Initials'
        )}
        {lookTile(
          'photo',
          custom.look === 'photo' ? (
            <CircleAvatar size={44} color={custom.color} iconType="photo" icon={custom.icon} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <MaterialCommunityIcons
                name="camera-outline"
                size={17}
                color="rgba(255,255,255,0.9)"
              />
            </View>
          ),
          'Photo',
          { plusBadge: true }
        )}
        {MASCOTS.filter((m) => !m.pro).map((m) =>
          lookTile(
            m.id,
            <MascotView mascot={m.id} band={custom.color} label={PLAYER_NUMBER[player]} width={46} />,
            m.name
          )
        )}
      </View>

      <View style={styles.gridLabelRow}>
        <Text style={styles.gridLabel}>MASCOTS · PRO</Text>
        <Text style={styles.gridLabelHint}>action poses · hero kits</Text>
      </View>
      <View style={styles.grid3}>
        {MASCOTS.filter((m) => m.pro).map((m) =>
          lookTile(
            m.id,
            <MascotView mascot={m.id} band={custom.color} label={PLAYER_NUMBER[player]} width={46} />,
            m.name,
            { pose: m.pose, locked: !isSubscribed }
          )
        )}
      </View>

      {!tutorialDone && !isSubscribed && (
        <View style={styles.proBanner}>
          <MaterialCommunityIcons name="lock" size={14} color={palette.accent} />
          <Text style={styles.proBannerText}>Action poses · hero capes</Text>
          <TouchableOpacity style={styles.proBannerButton} onPress={() => setPaywallOpen(true)}>
            <Text style={styles.proBannerButtonText}>Go Pro</Text>
          </TouchableOpacity>
        </View>
      )}
      </>
      )}

      <View style={styles.resetRow}>
        <TouchableOpacity
          style={[styles.resetButton, tutorialDone && styles.tutDimmed]}
          onPress={confirmReset}
          disabled={tutorialDone}
        >
          <MaterialCommunityIcons name="restore" size={17} color={palette.danger} />
          <Text style={styles.resetButtonText}>Reset all customizations</Text>
        </TouchableOpacity>
        <View>
          <TouchableOpacity
            style={styles.replayButton}
            onPress={onReplayTutorial}
            accessibilityLabel="Replay tour"
          >
            <MaterialCommunityIcons
              name="information-outline"
              size={19}
              color="rgba(255, 255, 255, 0.9)"
            />
          </TouchableOpacity>
          {tutorialDone && <TutorialRing inset={-5} />}
        </View>
      </View>
      {tutorialDone && (
        <View style={styles.tutReplayNote}>
          <View style={{ width: 200 }}>
            <Chalk size={19} weight="600" style={{ textAlign: 'right' }}>miss me already?</Chalk>
            <Chalk size={17} weight="600" dim style={{ textAlign: 'right' }}>
              replay the tour here
            </Chalk>
          </View>
          <ChalkArrow
            box={{ right: 10, top: -10, width: 44, height: 52 }}
            viewBox="0 0 44 52"
            d="M6 44 C 24 40, 34 26, 32 8"
            head="M32 8 l-10 8 M32 8 l3.5 12"
            strokeWidth={2.5}
          />
        </View>
      )}
    </>
  );

  const renderShuttleTab = () => (
    <>
      <View style={styles.gridLabelRow}>
        <Text style={styles.gridLabel}>SHUTTLE STYLE</Text>
        <Text style={styles.gridLabelHint}>2 free · 4 Pro</Text>
      </View>
      <View style={styles.grid3}>
        {SHUTTLE_STYLES.map((style) => {
          const selected = effectiveShuttleStyle === style.id;
          const kept = keptShuttleStyle === style.id;
          return (
            <TouchableOpacity
              key={style.id}
              style={[styles.tile, selected && styles.tileSelected]}
              onPress={() => selectShuttleStyle(style)}
            >
              {style.trail ? (
                <View style={styles.trailPreview}>
                  {style.trail.map((color, i) => (
                    <View
                      key={i}
                      style={{
                        width: 5 + i * 2,
                        height: 5 + i * 2,
                        borderRadius: 5,
                        backgroundColor: color,
                        opacity: 0.35 + i * 0.25,
                        marginRight: 2,
                      }}
                    />
                  ))}
                  <ShuttleChip style={style} size={40} />
                </View>
              ) : (
                <ShuttleChip style={style} size={44} />
              )}
              <Text style={styles.tileName}>{style.name}</Text>
              {kept && <CheckBadge />}
              {style.pro && !isSubscribed && <LockBadge />}
            </TouchableOpacity>
          );
        })}
      </View>

      {previewedShuttle && !isSubscribed && (
        <View style={styles.proBanner}>
          <MaterialCommunityIcons name="lock" size={14} color={palette.accent} />
          <Text style={styles.proBannerText}>{previewedShuttle.name} is a Pro style</Text>
          <TouchableOpacity style={styles.proBannerButton} onPress={() => setPaywallOpen(true)}>
            <Text style={styles.proBannerButtonText}>Unlock</Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={styles.previewFootnote}>
        Preview stays on the court until you close this sheet
      </Text>
    </>
  );

  const renderCourtTab = () => (
    <>
      <Text style={styles.sectionLabel}>Game mode</Text>
      <View style={styles.modeCard}>
        <TouchableOpacity
          style={[styles.modeOption, !isDoubles && styles.modeOptionActive]}
          onPress={() => selectMode(false)}
        >
          <MaterialCommunityIcons
            name="account"
            size={15}
            color={!isDoubles ? palette.onAccent : palette.textSecondary}
          />
          <Text style={[styles.modeOptionText, !isDoubles && styles.modeOptionTextActive]}>
            Singles
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeOption, isDoubles && styles.modeOptionActive]}
          onPress={() => selectMode(true)}
        >
          <MaterialCommunityIcons
            name="account-multiple"
            size={15}
            color={isDoubles ? palette.onAccent : palette.textSecondary}
          />
          <Text style={[styles.modeOptionText, isDoubles && styles.modeOptionTextActive]}>
            Doubles
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>Step speed</Text>
      <View style={styles.speedCard}>
        <MaterialCommunityIcons name="turtle" size={19} color={palette.textSecondary} />
        <View style={styles.speedSlider}>
          <AppSlider
            minimumValue={GLIDE_FASTEST}
            maximumValue={GLIDE_SLOWEST}
            value={GLIDE_SLOWEST + GLIDE_FASTEST - stepAnimationMs}
            onValueChange={(v) =>
              onStepAnimationChange(Math.round(GLIDE_SLOWEST + GLIDE_FASTEST - v))
            }
            trackColor="rgba(255, 255, 255, 0.16)"
            trackHeight={5}
            filledColor="rgba(255, 201, 77, 0.55)"
            thumbColor={palette.accent}
            thumbSize={16}
          />
        </View>
        <MaterialCommunityIcons name="rabbit" size={19} color={palette.textSecondary} />
      </View>

      <View style={styles.gridLabelRow}>
        <Text style={styles.gridLabel}>COURT THEME</Text>
        <Text style={styles.gridLabelHint}>2 free · 6 Pro</Text>
      </View>
      <View style={styles.grid2}>
        {COURT_THEMES.map((theme) => {
          const selected = effectiveCourtTheme === theme.id;
          const kept = courtTheme === theme.id;
          return (
            <TouchableOpacity
              key={theme.id}
              style={[styles.themeCard, selected && styles.tileSelected]}
              onPress={() => selectTheme(theme)}
            >
              <ThemePreview theme={theme} />
              <Text style={styles.themeName}>{theme.name}</Text>
              {kept && <CheckBadge />}
              {theme.pro && !isSubscribed && (
                <View style={[styles.proPill, styles.badgeRight]}>
                  <MaterialCommunityIcons name="lock" size={8} color={palette.accent} />
                  <Text style={styles.proPillText}>PRO</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {!isSubscribed && (
        <TouchableOpacity style={styles.upsellCard} onPress={() => setPaywallOpen(true)}>
          <View style={styles.upsellIcon}>
            <MaterialCommunityIcons name="crown" size={17} color={palette.onAccent} />
          </View>
          <View style={styles.upsellBody}>
            <Text style={styles.upsellTitle}>Featherwork Pro</Text>
            <Text style={styles.upsellMeta}>Unlock every Pro style + premium drills</Text>
          </View>
          <View style={styles.proBannerButton}>
            <Text style={styles.proBannerButtonText}>Go Pro</Text>
          </View>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionLabel}>About</Text>
      <TouchableOpacity
        style={styles.aboutRow}
        onPress={() =>
          Linking.openURL('https://badmlabs.github.io/privacy.html').catch(() => {})
        }
        accessibilityLabel="Privacy policy"
      >
        <MaterialCommunityIcons
          name="shield-lock-outline"
          size={17}
          color={palette.textSecondary}
        />
        <Text style={styles.aboutRowText}>Privacy Policy</Text>
        <MaterialCommunityIcons name="open-in-new" size={14} color={palette.textMuted} />
      </TouchableOpacity>
    </>
  );

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={[
            styles.overlay,
            // Undimmed court on the Shuttle tab so live previews stay visible.
            tab === 'shuttle' && styles.overlayClear,
          ]}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.bottomSheet, { height: sheetHeight as ViewStyle['height'] }]}>
          <View style={styles.grabHandle} />
          <View style={[styles.header, tutorialDone && styles.tutDimmed]}>
            <View>
              <Text style={styles.headerTitle}>Customize</Text>
              <Text style={styles.headerSubtitle}>Markers, shuttle and court themes</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Close settings"
              style={styles.closeButton}
            >
              <MaterialCommunityIcons name="close" size={18} color={palette.textPrimary} />
            </TouchableOpacity>
          </View>

          <View
            style={[styles.tabs, tutorialDone && styles.tutDimmed]}
            pointerEvents={tutorialDone ? 'none' : 'auto'}
          >
            {(
              [
                { key: 'players', label: 'Players', icon: 'account' },
                { key: 'shuttle', label: 'Shuttle', icon: 'badminton' },
                { key: 'court', label: 'Court', icon: 'rectangle-outline' },
              ] as const
            ).map(({ key, label, icon }) => {
              const active = tab === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.tabPill, active && styles.tabPillActive]}
                  onPress={() => setTab(key)}
                  accessibilityLabel={`${label} tab`}
                >
                  <MaterialCommunityIcons
                    name={icon as any}
                    size={13}
                    color={active ? palette.onAccent : 'rgba(255,255,255,0.75)'}
                  />
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {tab === 'players' && renderPlayersTab()}
            {tab === 'shuttle' && renderShuttleTab()}
            {tab === 'court' && renderCourtTab()}
          </ScrollView>
        </View>

        {tutorialDone && (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={styles.tutDotsHost}>
              <TutorialDots current={5} done />
            </View>
            <View style={styles.tutChalkTop}>
              <Chalk size={30} style={{ textAlign: 'center' }}>that&apos;s the tour —</Chalk>
              <Chalk size={25} style={{ textAlign: 'center', marginTop: 2 }}>
                court&apos;s yours, <AmberWord>coach</AmberWord>
              </Chalk>
            </View>
            <View style={styles.tutChalkHint}>
              <Chalk size={19} weight="600" dim style={{ textAlign: 'center' }}>
                sliders = <AmberWord>color &amp; size</AmberWord> · one card per player
              </Chalk>
            </View>
            <ChalkArrow
              box={{ left: '40%', top: 206, width: 60, height: 105 }}
              viewBox="0 0 60 105"
              d="M40 8 C 12 40, 40 68, 20 97"
              head="M20 97 l-1 -12 M20 97 l10.5 -6"
              strokeWidth={2.5}
            />
          </View>
        )}
      </View>

      <ProPaywall
        visible={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        vault={vault}
        onSubscribed={commitPreviews}
      />
    </Modal>
  );
}

// ─── Theme try-on bar (court preview with the sheet closed) ─────────────

interface ThemeTryOnBarProps {
  /** Distance from the screen bottom (sits above the dock). */
  bottom: number;
  isSubscribed: boolean;
  onUnlock: () => void;
  onClose: () => void;
}

export function ThemeTryOnBar({ bottom, isSubscribed, onUnlock, onClose }: ThemeTryOnBarProps) {
  const {
    setCourtTheme,
    previewCourtTheme,
    previews,
    effectiveCourtTheme,
  } = useMarkerCustomization();

  const active = COURT_THEMES.find((t) => t.id === effectiveCourtTheme) ?? COURT_THEMES[0];
  const previewing = previews.courtTheme != null;

  return (
    <View style={[styles.tryOnWrap, { bottom }]} pointerEvents="box-none">
      <View style={styles.tryOnDots}>
        {COURT_THEMES.map((theme) => {
          const isActive = theme.id === effectiveCourtTheme;
          const locked = theme.pro && !isSubscribed;
          return (
            <TouchableOpacity
              key={theme.id}
              style={[styles.tryOnDot, isActive && styles.tryOnDotActive]}
              onPress={() => {
                if (locked) {
                  previewCourtTheme(theme.id);
                } else {
                  setCourtTheme(theme.id);
                  previewCourtTheme(null); // owned pick ends the try-on
                }
              }}
            >
              <LinearGradient
                colors={[theme.top, theme.bottom]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.4, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {locked && (
                <View style={styles.tryOnDotLock}>
                  <MaterialCommunityIcons name="lock" size={7} color={palette.accent} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.tryOnBar}>
        <View style={styles.tryOnInfo}>
          <Text style={styles.tryOnName}>{active.name}</Text>
          <View style={styles.tryOnMetaRow}>
            {previewing && (
              <MaterialCommunityIcons name="lock" size={9} color={palette.accent} />
            )}
            <Text style={styles.tryOnMeta}>
              {previewing ? 'Pro theme · previewing' : 'Applied'}
            </Text>
          </View>
        </View>
        {previewing && (
          <TouchableOpacity style={styles.tryOnUnlock} onPress={onUnlock}>
            <Text style={styles.tryOnUnlockText}>Unlock Pro</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.tryOnClose}
          onPress={onClose}
          hitSlop={6}
          accessibilityLabel="Close theme preview"
        >
          <MaterialCommunityIcons name="close" size={14} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.overlay,
  },
  overlayClear: {
    backgroundColor: 'transparent',
  },
  bottomSheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    borderColor: palette.surfaceBorder,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -18 },
    shadowOpacity: 0.55,
    shadowRadius: 25,
    elevation: 16,
  },
  grabHandle: {
    alignSelf: 'center',
    width: 38,
    height: 4.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    ...sora('600'),
    fontSize: 19,
    color: palette.textPrimary,
  },
  headerSubtitle: {
    ...sora('400'),
    fontSize: 11.5,
    color: palette.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.hairline,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.hairline,
    padding: 4,
    gap: 4,
  },
  tabPill: {
    flex: 1,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.pill,
  },
  tabPillActive: {
    backgroundColor: palette.accent,
  },
  tabText: {
    ...sora('600'),
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  tabTextActive: {
    ...sora('700'),
    color: palette.onAccent,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  // Players tab
  playerChips: {
    flexDirection: 'row',
    gap: 13,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  playerChipWrap: {
    alignItems: 'center',
    gap: 3,
  },
  playerChipRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerChipRingActive: {
    borderColor: palette.accent,
  },
  playerChipMascot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerChipLabel: {
    ...sora('700'),
    fontSize: 9,
    color: palette.textMuted,
  },
  playerChipLabelActive: {
    color: palette.accent,
  },
  configCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: spacing.sm,
  },
  configBody: {
    flex: 1,
    gap: 7,
  },
  configTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  configTitle: {
    ...sora('600'),
    fontSize: 11.5,
    color: palette.textPrimary,
  },
  configSubtitle: {
    ...sora('400'),
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.45)',
  },
  configControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  handLabel: {
    ...sora('700'),
    fontSize: 8.5,
    letterSpacing: 1,
    color: palette.textMuted,
  },
  handToggle: {
    flexDirection: 'row',
    gap: 3,
    padding: 2.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: palette.hairline,
  },
  handOption: {
    height: 21,
    paddingHorizontal: 9,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handOptionActive: {
    backgroundColor: palette.accent,
  },
  handText: {
    ...sora('600'),
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  handTextActive: {
    ...sora('700'),
    color: palette.onAccent,
  },
  valueInput: {
    ...sora('700'),
    minWidth: 42,
    height: 28,
    paddingVertical: 0,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: palette.hairlineStrong,
    color: palette.textPrimary,
    fontSize: 12,
    textAlign: 'center',
  },
  hueSlider: {
    flex: 1.5,
  },
  hueTrack: {
    height: 8,
    borderRadius: radii.pill,
  },
  sizeSlider: {
    flex: 1,
  },
  // Grids
  gridLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  gridLabel: {
    ...sora('700'),
    fontSize: 10,
    letterSpacing: 1.6,
    color: palette.textMuted,
    marginTop: spacing.xs,
    marginBottom: 7,
  },
  gridLabelHint: {
    ...sora('400'),
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  grid3: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    // 3 per row: (100% - 2 gaps) / 3
    width: '31.7%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 9,
    paddingBottom: 7,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  tileSelected: {
    borderWidth: 2,
    borderColor: palette.accent,
  },
  tileName: {
    ...sora('600'),
    fontSize: 10,
    color: palette.textPrimary,
  },
  tilePose: {
    ...sora('400'),
    fontSize: 8.5,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: -3,
  },
  photoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    backgroundColor: '#2E4A3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(4, 16, 10, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 201, 77, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLeft: {
    top: 5,
    left: 5,
  },
  badgeRight: {
    top: 5,
    right: 5,
  },
  plusBadge: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailPreview: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 44,
    marginTop: spacing.md,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 7,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 201, 77, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 201, 77, 0.4)',
  },
  proBannerText: {
    ...sora('600'),
    flex: 1,
    fontSize: 11.5,
    color: palette.textPrimary,
  },
  proBannerButton: {
    height: 30,
    paddingHorizontal: 13,
    borderRadius: radii.pill,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBannerButtonText: {
    ...sora('700'),
    fontSize: 11,
    color: palette.onAccent,
  },
  previewFootnote: {
    ...sora('400'),
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.45)',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  // Court tab
  sectionLabel: {
    ...sora('700'),
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: palette.textMuted,
    marginTop: spacing.xs,
    marginBottom: 7,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    borderRadius: radii.md,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
  },
  aboutRowText: {
    ...sora('600'),
    flex: 1,
    color: palette.textPrimary,
    fontSize: 13,
  },
  modeCard: {
    flexDirection: 'row',
    gap: 5,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    borderRadius: radii.md,
    padding: 5,
    marginBottom: 6,
  },
  modeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: radii.sm,
  },
  modeOptionActive: {
    backgroundColor: palette.accent,
  },
  modeOptionText: {
    ...sora('600'),
    fontSize: 13,
    color: palette.textSecondary,
  },
  modeOptionTextActive: {
    ...sora('700'),
    color: palette.onAccent,
  },
  speedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 6,
  },
  speedSlider: {
    flex: 1,
  },
  themeCard: {
    // 2 per row: (100% - 1 gap) / 2
    width: '48.7%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  themePreview: {
    height: 56,
    width: '100%',
  },
  themeName: {
    ...sora('600'),
    fontSize: 10.5,
    color: palette.textPrimary,
    paddingHorizontal: 9,
    paddingTop: 6,
    paddingBottom: 8,
  },
  proPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 17,
    paddingHorizontal: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(4, 16, 10, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 201, 77, 0.55)',
  },
  proPillText: {
    ...sora('700'),
    fontSize: 8,
    letterSpacing: 0.5,
    color: palette.accent,
  },
  upsellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: spacing.md,
    padding: 10,
    paddingLeft: 12,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 201, 77, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 201, 77, 0.4)',
  },
  upsellIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upsellBody: {
    flex: 1,
    gap: 2,
  },
  upsellTitle: {
    ...sora('700'),
    fontSize: 12.5,
    color: palette.textPrimary,
  },
  upsellMeta: {
    ...sora('400'),
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  resetRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  // ⓘ beside Reset all: replays the first-run tour.
  replayButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── First-run tour finale ──
  tutDimmed: {
    opacity: 0.35,
  },
  tutDotsHost: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tutChalkTop: {
    position: 'absolute',
    top: 90,
    left: 40,
    right: 40,
    alignItems: 'center',
    transform: [{ rotate: '-2deg' }],
  },
  tutChalkHint: {
    position: 'absolute',
    top: 172,
    left: 20,
    right: 20,
    alignItems: 'center',
    transform: [{ rotate: '-1deg' }],
  },
  tutReplayNote: {
    marginTop: spacing.lg,
    alignItems: 'flex-end',
    paddingRight: 64,
  },
  resetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 46,
    backgroundColor: palette.dangerSoft,
    borderWidth: 1,
    borderColor: palette.dangerBorder,
    borderRadius: 14,
    marginTop: spacing.md,
  },
  resetButtonText: {
    ...sora('600'),
    color: palette.danger,
    fontSize: 14,
  },
  // Try-on bar
  tryOnWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    gap: 12,
  },
  tryOnDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  tryOnDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.75)',
  },
  tryOnDotActive: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2.5,
    borderColor: palette.accent,
  },
  tryOnDotLock: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: 'rgba(4, 16, 10, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 201, 77, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tryOnBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(6, 26, 18, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  tryOnInfo: {
    flex: 1,
    gap: 3,
  },
  tryOnName: {
    ...sora('600'),
    fontSize: 13.5,
    color: palette.textPrimary,
  },
  tryOnMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tryOnMeta: {
    ...sora('400'),
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  tryOnUnlock: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tryOnUnlockText: {
    ...sora('700'),
    fontSize: 12,
    color: palette.onAccent,
  },
  tryOnClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
